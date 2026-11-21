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

export interface LibraryDecl { name: string; /** tactics found in the source: undefined = unknown, [] = none */ tactics?: string[]; module: string; kind: string; typeDeps: string[]; valueDeps: string[]; /** letters from extract_library.lean; undefined = not reported */ flags?: string; line?: number }

export const TACTIC_COVERED = 1 << 15
export interface TacticLegend {
  mathlib_commit?: string
  bits: Record<string, string>
}

// Same-commit flags extracted from Lean (scripts/extract_flags.lean): one byte per node.
export const FLAG_INSTANCE = 1
export const FLAG_PROJECTION = 2
export const FLAG_COE = 4
export const FLAG_COE_DECL = 8
export const FLAG_CLASS = 16
export const FLAG_STRUCTURE = 32
export const FLAG_STRUCTURE_CTOR = 64
export const FLAG_UNKNOWN = 128
export const BOILERPLATE_MASK = FLAG_INSTANCE | FLAG_PROJECTION | FLAG_COE | FLAG_COE_DECL
export interface FlagsLegend {
  mathlib_commit?: string
  bits?: Record<string, string>
}

// Same-commit edge types from Lean (scripts/extract_edges.lean): one byte per store edge, aligned to targets.vbyte.
export const EDGE_IN_TYPE = 1
export const EDGE_IN_VALUE = 2
export const EDGE_DEF_VALUE = 4 // with EDGE_IN_VALUE: the source is a definition, so its value is part of its meaning
export const EDGE_UNSEEN = 128
export interface EdgeTypesLegend {
  mathlib_commit?: string
  edges?: number
}
/**
 * 'proof' follows every edge. 'statement' asks what the claim means: from the root only references in its type, and from every
 * constant reached, references in its type plus, for definitions (not theorems), references in its value.
 */
export type Scope = 'proof' | 'statement'

function statementEdge(b: number, fromRoot: boolean): boolean {
  if (b & EDGE_UNSEEN) return false
  return (b & EDGE_IN_TYPE) !== 0 || (!fromRoot && (b & (EDGE_IN_VALUE | EDGE_DEF_VALUE)) === (EDGE_IN_VALUE | EDGE_DEF_VALUE))
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
  meta: StoreMeta
  size: number
  private names: string[]
  private modules: string[]
  private moduleOf: Uint32Array
  private fwdStart: Uint32Array
  private fwdTarget: Uint32Array
  private revStart: Uint32Array
  private revTarget: Uint32Array
  private baseSize = 0
  private libByName?: Map<string, number>
  private libKinds: string[] = []
  private libUnresolved = 0
  /** Modules of interest chosen at index time (a subset of the library); undefined means all of it. */
  libraryFocus?: Set<string>
  /** Source file of each library module, relative to `libraryRoot` (the project directory); set by the CLI loader. */
  libraryFiles?: Map<string, string>
  libraryRoot?: string
  private libLines: (number | undefined)[] = []
  private libTactics: (string[] | undefined)[] = []
  private byName?: Map<string, number>
  private nameOrder?: 'sorted' | 'unsorted'
  private axiomIds?: Map<number, string>
  private tacticBits?: Uint16Array
  private tacticLegend: string[] = []
  private flagBytes?: Uint8Array
  private edgeBytes?: Uint8Array

  constructor(files: StoreFiles) {
    this.meta = files.meta
    this.names = splitLines(files.names)
    const n = this.names.length
    this.size = n
    this.baseSize = n
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

    this.revStart = new Uint32Array(0)
    this.revTarget = new Uint32Array(0)
    this.buildReverse()
  }

  private buildReverse(): void {
    const n = this.size
    const targets = this.fwdTarget
    const fwdStart = this.fwdStart
    const total = targets.length
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
    if (this.isLibrary(id)) return this.libTactics[id - this.baseSize] ?? null
    const bits = this.tacticBits?.[id]
    if (bits === undefined || !(bits & TACTIC_COVERED)) return null
    const out: string[] = []
    for (let b = 0; b < 15; b++) if (bits & (1 << b) && this.tacticLegend[b]) out.push(this.tacticLegend[b])
    return out
  }

  /** Optional same-commit flags: one byte per node. Anything inconsistent with the store is ignored. */
  setFlags(bytes: Uint8Array, legend: FlagsLegend): boolean {
    if (bytes.length !== this.size) return false
    if (legend.mathlib_commit && this.meta.mathlib_commit && legend.mathlib_commit !== this.meta.mathlib_commit) return false
    this.flagBytes = bytes
    return true
  }

  get hasFlags(): boolean {
    return this.flagBytes !== undefined
  }

  /** Flag bits of a node, or null when the store has no flags or Lean did not report this node. */
  flagsOf(id: number): number | null {
    const b = this.flagBytes?.[id]
    return b === undefined || b & FLAG_UNKNOWN ? null : b
  }

  /** True for instances, projection functions and coercions; false when unflagged or unknown. */
  isBoilerplate(id: number): boolean {
    const b = this.flagBytes?.[id]
    return b !== undefined && !(b & FLAG_UNKNOWN) && (b & BOILERPLATE_MASK) !== 0
  }

  /** Optional same-commit edge types: one byte per edge. Anything inconsistent with the store is ignored. */
  setEdgeTypes(bytes: Uint8Array, legend: EdgeTypesLegend = {}): boolean {
    if (bytes.length !== this.fwdTarget.length) return false
    if (legend.mathlib_commit && this.meta.mathlib_commit && legend.mathlib_commit !== this.meta.mathlib_commit) return false
    this.edgeBytes = bytes
    return true
  }

  get hasEdgeTypes(): boolean {
    return this.edgeBytes !== undefined
  }

  /** Type bits of the i-th dependency of `from` (same order as dependencies(from)); null when unknown or absent. */
  edgeTypes(from: number, i: number): number | null {
    const b = this.edgeBytes?.[this.fwdStart[from] + i]
    return b === undefined || b & EDGE_UNSEEN ? null : b
  }

  /** Dependencies that occur in the type ('type') or in the value ('value') of `id`; edges Lean did not report count as neither. */
  dependenciesIn(id: number, part: 'type' | 'value'): Uint32Array {
    const bytes = this.edgeBytes
    if (!bytes) throw new Error('This store has no edge types')
    const bit = part === 'type' ? EDGE_IN_TYPE : EDGE_IN_VALUE
    const lo = this.fwdStart[id]
    const out: number[] = []
    for (let k = lo, hi = this.fwdStart[id + 1]; k < hi; k++) if (bytes[k] & bit && !(bytes[k] & EDGE_UNSEEN)) out.push(this.fwdTarget[k])
    return Uint32Array.from(out)
  }

  private ordered(): boolean {
    if (this.nameOrder === undefined) {
      let ok = true
      for (let i = 1; i < this.baseSize; i++) {
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
    let hi = this.baseSize
    while (lo < hi) {
      const mid = (lo + hi) >>> 1
      if (this.names[mid] < prefix) lo = mid + 1
      else hi = mid
    }
    return lo
  }

  /**
   * Adds a library layer on top of the store: its declarations get ids from `size` upward and may point at store nodes or at each other.
   * Store nodes never point at the library. Edges to names found nowhere are counted in `libraryUnresolved`, not stored.
   * Library edge bytes follow the same bits as the store's (type, value, definition value); flags are unknown and tactics absent.
   */
  extend(decls: LibraryDecl[]): void {
    if (this.libByName) throw new Error('A library layer is already loaded')
    const n0 = this.size
    const n = n0 + decls.length
    this.libByName = new Map(decls.map((d, i) => [d.name, n0 + i]))
    const moduleIds = new Map(this.modules.map((m, i) => [m, i]))
    const moduleOf = new Uint32Array(n)
    moduleOf.set(this.moduleOf)
    const lists: [number, number][][] = []
    const unresolved = new Set<string>()
    decls.forEach((d, i) => {
      if (!moduleIds.has(d.module)) { moduleIds.set(d.module, this.modules.length); this.modules.push(d.module) }
      moduleOf[n0 + i] = moduleIds.get(d.module)!
      const bits = new Map<number, number>()
      const add = (deps: string[], bit: number) => {
        for (const dep of deps) {
          const t = this.id(dep)
          if (t === undefined) { unresolved.add(dep); continue }
          if (t === n0 + i) continue
          bits.set(t, (bits.get(t) ?? 0) | bit | (bit === EDGE_IN_VALUE && d.kind === 'd' ? EDGE_DEF_VALUE : 0))
        }
      }
      add(d.typeDeps, EDGE_IN_TYPE)
      add(d.valueDeps, EDGE_IN_VALUE)
      lists.push([...bits].sort((a, b) => a[0] - b[0]))
    })
    const added = lists.reduce((s, l) => s + l.length, 0)
    const total = this.fwdTarget.length
    const fwdStart = new Uint32Array(n + 1)
    fwdStart.set(this.fwdStart)
    const fwdTarget = new Uint32Array(total + added)
    fwdTarget.set(this.fwdTarget)
    const edgeBytes = this.edgeBytes && new Uint8Array(total + added)
    edgeBytes?.set(this.edgeBytes!)
    let k = total
    lists.forEach((l, i) => {
      for (const [t, b] of l) { fwdTarget[k] = t; if (edgeBytes) edgeBytes[k] = b; k++ }
      fwdStart[n0 + i + 1] = k
    })
    this.names = this.names.concat(decls.map((d) => d.name))
    this.moduleOf = moduleOf
    this.fwdStart = fwdStart
    this.fwdTarget = fwdTarget
    this.edgeBytes = edgeBytes
    if (this.flagBytes) {
      const f = new Uint8Array(n).fill(FLAG_UNKNOWN)
      f.set(this.flagBytes)
      const bit: Record<string, number> = { i: FLAG_INSTANCE, p: FLAG_PROJECTION, c: FLAG_COE, d: FLAG_COE_DECL, C: FLAG_CLASS, S: FLAG_STRUCTURE, k: FLAG_STRUCTURE_CTOR }
      decls.forEach((d, i) => { if (d.flags !== undefined) f[n0 + i] = [...d.flags].reduce((b, ch) => b | (bit[ch] ?? 0), 0) })
      this.flagBytes = f
    }
    this.libLines = decls.map((d) => d.line)
    this.libTactics = decls.map((d) => d.tactics)
    if (this.tacticBits) { const t = new Uint16Array(n); t.set(this.tacticBits); this.tacticBits = t }
    this.libKinds = decls.map((d) => d.kind)
    this.libUnresolved = unresolved.size
    this.size = n
    this.meta = { ...this.meta, nodes: n, edges: total + added }
    this.axiomIds = undefined
    this.buildReverse()
  }

  /** First library id, or undefined when no library is loaded. */
  get libraryStart(): number | undefined {
    return this.libByName ? this.baseSize : undefined
  }

  /** Distinct names the library referenced that are in neither the store nor the library (other packages, or a different Mathlib). */
  get libraryUnresolved(): number {
    return this.libUnresolved
  }

  /** True for library nodes in the modules of interest (all library nodes when no focus was chosen). */
  inFocus(id: number): boolean {
    return this.isLibrary(id) && (!this.libraryFocus || this.libraryFocus.has(this.module(id)))
  }

  /** 1-based source line of a library declaration, when Lean reported one. */
  libraryLine(id: number): number | undefined {
    return this.isLibrary(id) ? this.libLines[id - this.baseSize] : undefined
  }

  isLibrary(id: number): boolean {
    return this.libByName !== undefined && id >= this.baseSize
  }

  /** Declaration kind letter from the extractor (t theorem, d definition, ...), for library nodes. */
  libraryKind(id: number): string | undefined {
    return this.isLibrary(id) ? this.libKinds[id - this.baseSize] : undefined
  }

  id(name: string): number | undefined {
    const lib = this.libByName?.get(name)
    if (lib !== undefined) return lib
    if (this.ordered()) {
      const i = this.lowerBound(name)
      return i < this.baseSize && this.names[i] === name ? i : undefined
    }
    if (!this.byName) {
      this.byName = new Map()
      for (let i = 0; i < this.baseSize; i++) this.byName.set(this.names[i], i)
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

  reach(start: number, direction: Direction = 'dependencies', scope: Scope = 'proof'): Reach {
    const typeOnly = scope === 'statement'
    if (typeOnly && direction !== 'dependencies') throw new Error("Scope 'statement' applies to dependencies only")
    if (typeOnly && !this.edgeBytes) throw new Error('This store has no edge types')
    const edgeBytes = typeOnly ? this.edgeBytes! : undefined
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
        if (edgeBytes && !statementEdge(edgeBytes[k], u === start)) continue
        seen[v] = 1
        parent[v] = u
        depth[v] = d
        order[tail++] = v
      }
    }
    return { order: order.subarray(0, tail), parent, depth }
  }

  pathTo(from: number, to: number, scope: Scope = 'proof'): number[] | null {
    if (from === to) return [from]
    const { parent } = this.reach(from, 'dependencies', scope)
    if (parent[to] === -1) return null
    const path = [to]
    for (let v = parent[to]; v !== from; v = parent[v]) path.push(v)
    path.push(from)
    return path.reverse()
  }

  axioms(id: number, scope: Scope = 'proof'): { axioms: string[]; closureSize: number } {
    if (!this.axiomIds) {
      this.axiomIds = new Map()
      for (const a of AXIOM_NAMES) {
        const i = this.id(a)
        if (i !== undefined) this.axiomIds.set(i, a)
      }
    }
    const { order } = this.reach(id, 'dependencies', scope)
    const found: string[] = []
    for (let i = 0; i < order.length; i++) {
      const a = this.axiomIds.get(order[i])
      if (a !== undefined) found.push(a)
    }
    return { axioms: found.sort(), closureSize: order.length }
  }

  search(prefix: string, limit = 20): string[] {
    const out: string[] = []
    for (let i = this.baseSize; i < this.names.length && out.length < limit; i++) if (this.names[i].startsWith(prefix)) out.push(this.names[i])
    if (!this.ordered()) {
      for (let i = 0; i < this.baseSize && out.length < limit; i++) if (this.names[i].startsWith(prefix)) out.push(this.names[i])
      return out
    }
    for (let i = this.lowerBound(prefix); i < this.baseSize && out.length < limit; i++) {
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
  // Optional: a store without flags.* simply cannot hide instances and coercions.
  try {
    const [bytes, legend] = await Promise.all([get('flags.u8'), get('flags.json')])
    graph.setFlags(bytes, JSON.parse(decoder.decode(legend)) as FlagsLegend)
  } catch (error) {
    if (signal?.aborted) throw error
  }
  // Optional: a store without edgetypes.* cannot separate the statement from the proof.
  try {
    const [bytes, legend] = await Promise.all([get('edgetypes.u8'), get('edgetypes.json')])
    graph.setEdgeTypes(bytes, JSON.parse(decoder.decode(legend)) as EdgeTypesLegend)
  } catch (error) {
    if (signal?.aborted) throw error
  }
  return graph
}
