import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { LocalGraph, loadLocalGraph, type StoreFiles } from './localGraph'

function varint(values: number[]): Uint8Array {
  const out: number[] = []
  for (const value of values) {
    let v = value
    while (v >= 0x80) {
      out.push((v & 0x7f) | 0x80)
      v = Math.floor(v / 128)
    }
    out.push(v)
  }
  return Uint8Array.from(out)
}

function buildFiles(names: string[], edges: Record<string, string[]>, modules = ['M']): StoreFiles {
  const sorted = [...names].sort()
  const index = new Map(sorted.map((n, i) => [n, i]))
  const degrees: number[] = []
  const deltas: number[] = []
  let edgeCount = 0
  for (const name of sorted) {
    const targets = (edges[name] ?? []).map((t) => index.get(t)!).sort((a, b) => a - b)
    degrees.push(targets.length)
    edgeCount += targets.length
    targets.forEach((t, i) => deltas.push(i === 0 ? t : t - targets[i - 1]))
  }
  const nodeModule = new Uint8Array(sorted.length * 4)
  const view = new DataView(nodeModule.buffer)
  sorted.forEach((_, i) => view.setUint32(i * 4, i % modules.length, true))
  return {
    names: sorted.join('\n') + '\n',
    modules: modules.join('\n') + '\n',
    nodeModule,
    degrees: varint(degrees),
    targets: varint(deltas),
    meta: { nodes: sorted.length, edges: edgeCount },
  }
}

const NAMES = [
  'A.top',
  'A.left',
  'A.right',
  'A.bottom',
  'Cyc.a',
  'Cyc.b',
  'Cyc.c',
  'Chain.1',
  'Chain.2',
  'Chain.3',
  'Classical.choice',
  'Nonempty',
  'propext',
  'Uses.choice',
  'Uses.nothing',
  'Isolated',
]

const EDGES: Record<string, string[]> = {
  'A.top': ['A.left', 'A.right'],
  'A.left': ['A.bottom'],
  'A.right': ['A.bottom'],
  'Cyc.a': ['Cyc.b'],
  'Cyc.b': ['Cyc.c'],
  'Cyc.c': ['Cyc.a'],
  'Chain.1': ['Chain.2'],
  'Chain.2': ['Chain.3'],
  'Classical.choice': ['Nonempty'],
  'Uses.choice': ['Classical.choice', 'A.top'],
  'Uses.nothing': ['A.top'],
}

function small() {
  const graph = new LocalGraph(buildFiles(NAMES, EDGES, ['Mod.One', 'Mod.Two']))
  const id = (name: string) => graph.id(name)!
  const names = (ids: ArrayLike<number>) => Array.from(ids, (i) => graph.name(i)).sort()
  return { graph, id, names }
}

describe('LocalGraph on a small graph', () => {
  it('round-trips ids and names and reports missing names', () => {
    const { graph } = small()
    expect(graph.size).toBe(NAMES.length)
    for (const name of NAMES) expect(graph.name(graph.id(name)!)).toBe(name)
    expect(graph.id('Nope')).toBeUndefined()
    expect(graph.id('')).toBeUndefined()
    expect(graph.module(0)).toBe('Mod.One')
    expect(graph.module(1)).toBe('Mod.Two')
  })

  it('returns forward and reverse edges', () => {
    const { graph, id, names } = small()
    expect(names(graph.dependencies(id('A.top')))).toEqual(['A.left', 'A.right'])
    expect(names(graph.dependencies(id('A.bottom')))).toEqual([])
    expect(names(graph.dependents(id('A.bottom')))).toEqual(['A.left', 'A.right'])
    expect(names(graph.dependents(id('A.top')))).toEqual(['Uses.choice', 'Uses.nothing'])
    expect(names(graph.dependencies(id('Classical.choice')))).toEqual(['Nonempty'])
    expect(names(graph.dependents(id('Nonempty')))).toEqual(['Classical.choice'])
    expect(names(graph.dependents(id('Isolated')))).toEqual([])
  })

  it('reaches in BFS order with depths and parents', () => {
    const { graph, id } = small()
    const r = graph.reach(id('A.top'))
    expect(graph.name(r.order[0])).toBe('A.top')
    expect(r.order.length).toBe(4)
    expect(graph.name(r.order[3])).toBe('A.bottom')
    expect(r.depth[id('A.left')]).toBe(1)
    expect(r.depth[id('A.bottom')]).toBe(2)
    expect(r.parent[id('A.top')]).toBe(-1)
    expect([id('A.left'), id('A.right')]).toContain(r.parent[id('A.bottom')])

    const up = graph.reach(id('A.bottom'), 'dependents')
    expect(Array.from(up.order, (i) => graph.name(i)).slice(0, 1)).toEqual(['A.bottom'])
    expect(up.order.length).toBe(6)
    expect(up.depth[id('Uses.choice')]).toBe(3)
  })

  it('terminates on cycles', () => {
    const { graph, id } = small()
    const r = graph.reach(id('Cyc.a'))
    expect(Array.from(r.order, (i) => graph.name(i))).toEqual(['Cyc.a', 'Cyc.b', 'Cyc.c'])
    expect(graph.pathTo(id('Cyc.c'), id('Cyc.b'))).toEqual([id('Cyc.c'), id('Cyc.a'), id('Cyc.b')])
  })

  it('finds shortest paths', () => {
    const { graph, id } = small()
    expect(graph.pathTo(id('Chain.1'), id('Chain.3'))).toEqual([id('Chain.1'), id('Chain.2'), id('Chain.3')])
    expect(graph.pathTo(id('Chain.2'), id('Chain.2'))).toEqual([id('Chain.2')])
    expect(graph.pathTo(id('Chain.3'), id('Chain.1'))).toBeNull()
    expect(graph.pathTo(id('Isolated'), id('A.top'))).toBeNull()
    const path = graph.pathTo(id('Uses.choice'), id('A.bottom'))!
    expect(path).toHaveLength(4)
    expect(path[0]).toBe(id('Uses.choice'))
    expect(path[3]).toBe(id('A.bottom'))
  })

  it('collects axioms in the dependency closure', () => {
    const { graph, id } = small()
    expect(graph.axioms(id('Uses.choice'))).toEqual({ axioms: ['Classical.choice'], closureSize: 7 })
    expect(graph.axioms(id('Uses.nothing'))).toEqual({ axioms: [], closureSize: 5 })
    expect(graph.axioms(id('Classical.choice'))).toEqual({ axioms: ['Classical.choice'], closureSize: 2 })
    expect(graph.axioms(id('propext'))).toEqual({ axioms: ['propext'], closureSize: 1 })
    expect(graph.axioms(id('Isolated'))).toEqual({ axioms: [], closureSize: 1 })
  })

  it('searches by prefix with a limit', () => {
    const { graph } = small()
    expect(graph.search('A.')).toEqual(['A.bottom', 'A.left', 'A.right', 'A.top'])
    expect(graph.search('A.', 2)).toEqual(['A.bottom', 'A.left'])
    expect(graph.search('Chain.')).toEqual(['Chain.1', 'Chain.2', 'Chain.3'])
    expect(graph.search('Zzz')).toEqual([])
    expect(graph.search('Isolated')).toEqual(['Isolated'])
  })

  it('rejects mismatched meta and corrupt data', () => {
    const files = buildFiles(NAMES, EDGES)
    expect(() => new LocalGraph({ ...files, meta: { ...files.meta, nodes: NAMES.length + 1 } })).toThrow(/nodes/)
    expect(() => new LocalGraph({ ...files, meta: { ...files.meta, edges: files.meta.edges + 1 } })).toThrow(/edges/)
    expect(() => new LocalGraph({ ...files, degrees: files.degrees.subarray(0, 3) })).toThrow(/degrees/)
    expect(() => new LocalGraph({ ...files, targets: files.targets.subarray(0, 3) })).toThrow(/targets/)
  })
})

describe('varint decoding', () => {
  const values = [0, 1, 127, 128, 129, 16383, 16384, 16385, 2097151, 2097152, 2097153]

  it('round-trips values around byte boundaries as absolute targets', () => {
    const n = 2097154
    const bigNames = Array.from({ length: n }, (_, i) => String(i).padStart(8, '0'))
    const targets = values.filter((v) => v < n)
    const lines = bigNames.join('\n') + '\n'
    const degrees = new Array<number>(n).fill(0)
    degrees[0] = targets.length
    const deltas = targets.map((t, i) => (i === 0 ? t : t - targets[i - 1]))
    const nodeModule = new Uint8Array(n * 4)
    const graph = new LocalGraph({
      names: lines,
      modules: 'M\n',
      nodeModule,
      degrees: varint(degrees),
      targets: varint(deltas),
      meta: { nodes: n, edges: targets.length },
    })
    expect(Array.from(graph.dependencies(0))).toEqual(targets)
  })

  it('encodes with the expected byte lengths', () => {
    expect(varint([127]).length).toBe(1)
    expect(varint([128]).length).toBe(2)
    expect(varint([16383]).length).toBe(2)
    expect(varint([16384]).length).toBe(3)
    expect(varint([2097151]).length).toBe(3)
    expect(varint([2097152]).length).toBe(4)
    expect(Array.from(varint([128]))).toEqual([0x80, 0x01])
  })

  it('decodes boundary degrees', () => {
    const n = 3
    const files: StoreFiles = {
      names: 'a\nb\nc\n',
      modules: 'M\n',
      nodeModule: new Uint8Array(n * 4),
      degrees: varint([0, 0, 0]),
      targets: new Uint8Array(),
      meta: { nodes: n, edges: 0 },
    }
    expect(new LocalGraph(files).dependencies(2).length).toBe(0)
    expect(() => new LocalGraph({ ...files, degrees: Uint8Array.from([0, 0, 0x80]) })).toThrow(/degrees/)
    expect(() => new LocalGraph({ ...files, degrees: Uint8Array.from([0x80, 0x80, 0x80, 0x80, 1, 0, 0]) })).toThrow(/degrees/)
  })
})

const storeDir = process.env.LEANAGE_STORE

describe('real store', () => {
  it.skipIf(!storeDir)('matches Lean ground truth axioms', () => {
    const read = (f: string) => new Uint8Array(readFileSync(`${storeDir}/${f}`))
    const text = (f: string) => readFileSync(`${storeDir}/${f}`, 'utf8')
    let t = performance.now()
    const graph = new LocalGraph({
      names: text('names.txt'),
      modules: text('modules.txt'),
      nodeModule: read('node_module.u32'),
      degrees: read('degrees.vbyte'),
      targets: read('targets.vbyte'),
      meta: JSON.parse(text('meta.json')),
    })
    console.log(`load ${(performance.now() - t).toFixed(0)} ms, ${graph.size} nodes, ${graph.meta.edges} edges`)
    const truth = JSON.parse(readFileSync('docs/feasibility/axioms-ground-truth-fc4f59e.json', 'utf8')).results as Record<string, string[]>
    t = performance.now()
    for (const [name, expected] of Object.entries(truth)) {
      const id = graph.id(name)
      expect(id, name).toBeDefined()
      expect(graph.axioms(id!).axioms, name).toEqual([...expected].sort())
    }
    console.log(`axioms for ${Object.keys(truth).length} declarations ${(performance.now() - t).toFixed(0)} ms`)
    t = performance.now()
    const closure = graph.axioms(graph.id('Nat.Prime.dvd_or_dvd')!)
    console.log(`Nat.Prime.dvd_or_dvd closure ${closure.closureSize} in ${(performance.now() - t).toFixed(1)} ms`)
  }, 120_000)
})

describe('optional tactics file', () => {
  const files = buildFiles(['A', 'B'], { A: ['B'] })
  const legend = { mathlib_commit: undefined, bits: { '0': 'induction' } }
  const bytes = (b: Uint8Array | string) => typeof b === 'string' ? new TextEncoder().encode(b) : b
  function serve(extra: Record<string, Response | undefined>) {
    const table: Record<string, Uint8Array | string> = {
      'names.txt': files.names, 'modules.txt': files.modules, 'node_module.u32': files.nodeModule,
      'degrees.vbyte': files.degrees, 'targets.vbyte': files.targets, 'meta.json': JSON.stringify(files.meta),
    }
    globalThis.fetch = (async (url: string) => {
      const file = String(url).replace('/store/', '')
      if (extra[file]) return extra[file]!.clone()
      if (table[file] !== undefined) return new Response(bytes(table[file]) as BodyInit, { status: 200, headers: { 'content-type': 'application/octet-stream' } })
      return new Response('nope', { status: 404 })
    }) as typeof fetch
  }
  it('loads without tactic data when the file is missing, 404 or an HTML fallback', async () => {
    serve({})
    expect((await loadLocalGraph('/store')).hasTactics).toBe(false)
    serve({ 'tactics.u16': new Response('<html></html>', { status: 200, headers: { 'content-type': 'text/html' } }), 'tactics.u16.gz': new Response('<html></html>', { status: 200, headers: { 'content-type': 'text/html' } }) })
    expect((await loadLocalGraph('/store')).hasTactics).toBe(false)
  })
  it('loads tactic bits and reports only covered declarations', async () => {
    const u16 = new Uint8Array(4)
    new DataView(u16.buffer).setUint16(2, (1 << 15) | 1, true) // B covered, induction
    serve({ 'tactics.u16': new Response(u16 as BodyInit, { status: 200 }), 'tactics.json': new Response(JSON.stringify(legend), { status: 200 }) })
    const graph = await loadLocalGraph('/store')
    expect(graph.hasTactics).toBe(true)
    expect(graph.tacticsOf(graph.id('A')!)).toBeNull()
    expect(graph.tacticsOf(graph.id('B')!)).toEqual(['induction'])
  })
})
