export const AXIOM_NAMES = ['propext', 'Classical.choice', 'Quot.sound', 'sorryAx', 'Lean.ofReduceBool']

export interface StoreMeta {
  dataset?: string
  mathlib_commit?: string
  lean_toolchain?: string
  nodes: number
  edges: number
  built_at_utc?: string
}

export interface StoreFiles {
  names: string
  modules: string
  nodeModule: Uint8Array
  degrees: Uint8Array
  targets: Uint8Array
  meta: StoreMeta
}

export const TACTIC_COVERED = 1 << 15
export interface TacticLegend {
  mathlib_commit?: string
  bits: Record<string, string>
}

export type Direction = 'dependencies' | 'dependents'

export interface Reach {
  order: Uint32Array
  parent: Int32Array
  depth: Uint16Array
}

function splitLines(text: string): string[] {
  const lines = text.split('\n')
  if (lines.length && lines[lines.length - 1] === '') lines.pop()
  return lines
}

function decodeVarints(bytes: Uint8Array, count: number, label: string): Uint32Array {
  const out = new Uint32Array(count)
  let pos = 0
  const end = bytes.length
  for (let i = 0; i < count; i++) {
    let b = bytes[pos++]
    let value = b & 0x7f
    if (b & 0x80) {
      b = bytes[pos++]
      value |= (b & 0x7f) << 7
      if (b & 0x80) {
        b = bytes[pos++]
        value |= (b & 0x7f) << 14
        if (b & 0x80) {
          b = bytes[pos++]
          value |= (b & 0x7f) << 21
          if (b & 0x80) throw new Error(`Corrupt ${label}: varint longer than 4 bytes`)
        }
      }
    }
    if (pos > end) throw new Error(`Corrupt ${label}: truncated after ${i} values`)
    out[i] = value
  }
  if (pos !== end) throw new Error(`Corrupt ${label}: ${end - pos} trailing bytes`)
  return out
}

export class LocalGraph {
  readonly meta: StoreMeta
  readonly size: number
  private readonly names: string[]
  private readonly modules: string[]
  private readonly moduleOf: Uint32Array
  private readonly fwdStart: Uint32Array
  private readonly fwdTarget: Uint32Array
  private readonly revStart: Uint32Array
  private readonly revTarget: Uint32Array
  private byName?: Map<string, number>
  private nameOrder?: 'sorted' | 'unsorted'
  private axiomIds?: Map<number, string>
  private tacticBits?: Uint16Array
  private tacticLegend: string[] = []

  constructor(files: StoreFiles) {
    this.meta = files.meta
    this.names = splitLines(files.names)
    const n = this.names.length
    this.size = n
    if (files.meta.nodes !== n) {
      throw new Error(`Store meta says ${files.meta.nodes} nodes but names.txt has ${n}`)
    }
    this.modules = splitLines(files.modules)

    if (files.nodeModule.length !== n * 4) {
      throw new Error(`node_module.u32 has ${files.nodeModule.length} bytes, expected ${n * 4}`)
    }
    this.moduleOf = new Uint32Array(n)
    const view = new DataView(files.nodeModule.buffer, files.nodeModule.byteOffset, files.nodeModule.byteLength)
    for (let i = 0; i < n; i++) this.moduleOf[i] = view.getUint32(i * 4, true)

    const degrees = decodeVarints(files.degrees, n, 'degrees.vbyte')
    const fwdStart = new Uint32Array(n + 1)
    let total = 0
    for (let i = 0; i < n; i++) {
      fwdStart[i] = total
      total += degrees[i]
    }
    fwdStart[n] = total
    if (files.meta.edges !== total) {
      throw new Error(`Store meta says ${files.meta.edges} edges but degrees sum to ${total}`)
    }
    this.fwdStart = fwdStart

    const targets = decodeVarints(files.targets, total, 'targets.vbyte')
    for (let i = 0; i < n; i++) {
      const lo = fwdStart[i]
      const hi = fwdStart[i + 1]
      for (let k = lo + 1; k < hi; k++) targets[k] += targets[k - 1]
    }
    for (let k = 0; k < total; k++) {
      if (targets[k] >= n) throw new Error(`Corrupt targets.vbyte: target ${targets[k]} out of range`)
    }
    this.fwdTarget = targets

    const revStart = new Uint32Array(n + 1)
    for (let k = 0; k < total; k++) revStart[targets[k] + 1]++
    for (let i = 0; i < n; i++) revStart[i + 1] += revStart[i]
    const cursor = revStart.slice(0, n)
    const revTarget = new Uint32Array(total)
    for (let i = 0; i < n; i++) {
      for (let k = fwdStart[i], hi = fwdStart[i + 1]; k < hi; k++) revTarget[cursor[targets[k]]++] = i
    }
    this.revStart = revStart
    this.revTarget = revTarget
  }

  /**
   * Optional same-commit tactic data: one u16 per node (bit 15 = declaration resolved in the source, bits 0..11 = tactic labels from the legend).
   * Anything inconsistent with the store is ignored, never partially used.
   */
  setTactics(bytes: Uint8Array, legend: TacticLegend): boolean {
    if (bytes.length !== this.size * 2) return false
    if (legend.mathlib_commit && this.meta.mathlib_commit && legend.mathlib_commit !== this.meta.mathlib_commit) return false
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    const bits = new Uint16Array(this.size)
    for (let i = 0; i < this.size; i++) bits[i] = view.getUint16(i * 2, true)
    const labels: string[] = []
    for (const [bit, label] of Object.entries(legend.bits)) labels[Number(bit)] = label
    this.tacticBits = bits
    this.tacticLegend = labels
    return true
  }

  get hasTactics(): boolean {
    return this.tacticBits !== undefined
  }

  /** Tactic labels recorded in the proof source, or null when this declaration has no tactic data (which is not the same as "no tactics"). */
  tacticsOf(id: number): string[] | null {
    const bits = this.tacticBits?.[id]
    if (bits === undefined || !(bits & TACTIC_COVERED)) return null
    const out: string[] = []
    for (let b = 0; b < 15; b++) if (bits & (1 << b) && this.tacticLegend[b]) out.push(this.tacticLegend[b])
    return out
  }

  private ordered(): boolean {
    if (this.nameOrder === undefined) {
      let ok = true
      for (let i = 1; i < this.names.length; i++) {
        if (!(this.names[i - 1] < this.names[i])) {
          ok = false
          break
        }
      }
      this.nameOrder = ok ? 'sorted' : 'unsorted'
    }
    return this.nameOrder === 'sorted'
  }

  private lowerBound(prefix: string): number {
    let lo = 0
    let hi = this.names.length
    while (lo < hi) {
      const mid = (lo + hi) >>> 1
      if (this.names[mid] < prefix) lo = mid + 1
      else hi = mid
    }
    return lo
  }

  id(name: string): number | undefined {
    if (this.ordered()) {
      const i = this.lowerBound(name)
      return i < this.names.length && this.names[i] === name ? i : undefined
    }
    if (!this.byName) {
      this.byName = new Map()
      for (let i = 0; i < this.names.length; i++) this.byName.set(this.names[i], i)
    }
    return this.byName.get(name)
  }

  name(id: number): string {
    return this.names[id]
  }

  module(id: number): string {
    return this.modules[this.moduleOf[id]]
  }

  dependencies(id: number): Uint32Array {
    return this.fwdTarget.subarray(this.fwdStart[id], this.fwdStart[id + 1])
  }

  dependents(id: number): Uint32Array {
    return this.revTarget.subarray(this.revStart[id], this.revStart[id + 1])
  }

  reach(start: number, direction: Direction = 'dependencies'): Reach {
    const n = this.size
    const starts = direction === 'dependencies' ? this.fwdStart : this.revStart
    const targets = direction === 'dependencies' ? this.fwdTarget : this.revTarget
    const order = new Uint32Array(n)
    const parent = new Int32Array(n).fill(-1)
    const depth = new Uint16Array(n)
    const seen = new Uint8Array(n)
    seen[start] = 1
    order[0] = start
    let head = 0
    let tail = 1
    while (head < tail) {
      const u = order[head++]
      const d = depth[u] + 1
      for (let k = starts[u], hi = starts[u + 1]; k < hi; k++) {
        const v = targets[k]
        if (seen[v]) continue
        seen[v] = 1
        parent[v] = u
        depth[v] = d
        order[tail++] = v
      }
    }
    return { order: order.subarray(0, tail), parent, depth }
  }

  pathTo(from: number, to: number): number[] | null {
    if (from === to) return [from]
    const { parent } = this.reach(from)
    if (parent[to] === -1) return null
    const path = [to]
    for (let v = parent[to]; v !== from; v = parent[v]) path.push(v)
    path.push(from)
    return path.reverse()
  }

  axioms(id: number): { axioms: string[]; closureSize: number } {
    if (!this.axiomIds) {
      this.axiomIds = new Map()
      for (const a of AXIOM_NAMES) {
        const i = this.id(a)
        if (i !== undefined) this.axiomIds.set(i, a)
      }
    }
    const { order } = this.reach(id)
    const found: string[] = []
    for (let i = 0; i < order.length; i++) {
      const a = this.axiomIds.get(order[i])
      if (a !== undefined) found.push(a)
    }
    return { axioms: found.sort(), closureSize: order.length }
  }

  search(prefix: string, limit = 20): string[] {
    if (!this.ordered()) {
      const out: string[] = []
      for (const name of this.names) {
        if (name.startsWith(prefix)) {
          out.push(name)
          if (out.length >= limit) break
        }
      }
      return out
    }
    const out: string[] = []
    for (let i = this.lowerBound(prefix); i < this.names.length && out.length < limit; i++) {
      if (!this.names[i].startsWith(prefix)) break
      out.push(this.names[i])
    }
    return out
  }
}

async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  if (bytes.length < 2 || bytes[0] !== 0x1f || bytes[1] !== 0x8b) return bytes
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

// Dev servers and SPA hosts answer a missing file with index.html and status 200, so HTML counts as missing.
const isMissing = (response: Response) => response.status === 404 || (response.ok && (response.headers.get('content-type') ?? '').includes('text/html'))

async function fetchStoreFile(baseUrl: string, file: string, signal?: AbortSignal): Promise<Uint8Array> {
  const gz = await fetch(`${baseUrl}/${file}.gz`, { signal })
  if (gz.ok && !isMissing(gz)) return gunzip(new Uint8Array(await gz.arrayBuffer()))
  if (!isMissing(gz)) throw new Error(`Failed to fetch ${file}.gz: HTTP ${gz.status}`)
  const plain = await fetch(`${baseUrl}/${file}`, { signal })
  if (!plain.ok || isMissing(plain)) throw new Error(`Failed to fetch ${file}: HTTP ${plain.status}`)
  return gunzip(new Uint8Array(await plain.arrayBuffer()))
}

export async function loadLocalGraph(baseUrl: string, signal?: AbortSignal): Promise<LocalGraph> {
  const base = baseUrl.replace(/\/+$/, '')
  const get = (file: string) => fetchStoreFile(base, file, signal)
  const [names, modules, nodeModule, degrees, targets, metaBytes] = await Promise.all([
    get('names.txt'),
    get('modules.txt'),
    get('node_module.u32'),
    get('degrees.vbyte'),
    get('targets.vbyte'),
    get('meta.json'),
  ])
  const decoder = new TextDecoder()
  const meta = JSON.parse(decoder.decode(metaBytes)) as StoreMeta
  const graph = new LocalGraph({
    names: decoder.decode(names),
    modules: decoder.decode(modules),
    nodeModule,
    degrees,
    targets,
    meta,
  })
  // Optional: a store without tactics.* simply has no source-tactic evidence.
  try {
    const [bytes, legend] = await Promise.all([get('tactics.u16'), get('tactics.json')])
    graph.setTactics(bytes, JSON.parse(decoder.decode(legend)) as TacticLegend)
  } catch (error) {
    if (signal?.aborted) throw error
  }
  return graph
}
