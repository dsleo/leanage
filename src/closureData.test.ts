import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { LocalGraph, type StoreFiles } from './localGraph'
import {
  collapseSteps,
  applyFilter, axiomAudit, closureRows, collapsePath, groupByModule, isGeneratedName, ownerName, parseFilter, toCsv, toDot, toJson,
} from './closureData'

function varint(values: number[]): Uint8Array {
  const out: number[] = []
  for (let v of values) {
    while (v >= 128) { out.push((v & 127) | 128); v = Math.floor(v / 128) }
    out.push(v)
  }
  return Uint8Array.from(out)
}

function files(edges: Record<string, string[]>, modules: Record<string, string> = {}): StoreFiles {
  const names = [...new Set(Object.entries(edges).flat(2))].sort()
  const id = new Map(names.map((name, index) => [name, index]))
  const deps = names.map((name) => (edges[name] ?? []).map((dep) => id.get(dep)!).sort((a, b) => a - b))
  const targets = deps.flatMap((list) => list.map((value, index) => (index ? value - list[index - 1] : value)))
  const mods = [...new Set(['M', ...Object.values(modules)])]
  const nodeModule = new Uint8Array(names.length * 4)
  names.forEach((name, i) => { nodeModule[i * 4] = mods.indexOf(modules[name] ?? 'M') })
  return {
    names: names.join('\n') + '\n', modules: mods.join('\n') + '\n', nodeModule,
    degrees: varint(deps.map((list) => list.length)), targets: varint(targets),
    meta: { nodes: names.length, edges: deps.flat().length, dataset: 'ds', mathlib_commit: 'abc1234', lean_toolchain: 'v4.x' },
  }
}

const graph = new LocalGraph(files({
  'Test.root': ['Test.mid', 'Nat.zero_add', 'Topology.open'],
  'Test.mid': ['Test.mid._f', 'Test.root'],
  'Test.mid._f': ['Test.leaf'],
  'Test.leaf': ['propext'],
  'Nat.zero_add': [],
  'Topology.open': ['Classical.foo'],
  'Classical.foo': [],
  'propext': [],
}, { 'Test.root': 'Mathlib.Test.A', 'Test.mid': 'Mathlib.Test.A', 'Test.mid._f': 'Mathlib.Test.B', 'Test.leaf': 'Mathlib.Test.B', 'Topology.open': 'Mathlib.Topology.Basic', 'Classical.foo': 'Mathlib.Logic.Classical', 'Nat.zero_add': 'Init.Nat', propext: 'Init.Core' }))
const rootId = graph.id('Test.root')!

it('collapseSteps folds generated steps and keeps the final one', () => {
  const names = (l: string[]) => collapseSteps(l.map((name) => ({ name }))).map((x) => x.name)
  expect(names(['A', 'A._f', 'A._f.match_1', 'Nat.rec'])).toEqual(['A', 'Nat.rec'])
  expect(names(['A', 'B.proof_1', 'C'])).toEqual(['A', 'B', 'C'])
})

it('ownerName strips _private prefix', () => {
  expect(ownerName('_private.Mathlib.Foo.0.Bar.baz.match_1')).toBe('Bar.baz')
})

describe('names', () => {
  it('detects generated names', () => {
    for (const n of ['Foo._private', 'Foo.match_1', 'Foo.proof_2', 'Foo.eq_3', 'Foo._simp_1', 'Foo._sunfold', 'Foo._unary', 'Foo._cstage1', 'Foo._boxed', 'Foo._closed_1', '_x.Foo', 'Foo.match_1.x']) {
      expect(isGeneratedName(n), n).toBe(true)
    }
    for (const n of ['Nat.add_comm', 'Foo.matcher', 'Foo.bar_1', 'Foo.proof', 'Foo.eq_', 'Foo.xmatch_1']) expect(isGeneratedName(n), n).toBe(false)
  })
  it('strips trailing generated components', () => {
    expect(ownerName('Nat.add_comm._f')).toBe('Nat.add_comm')
    expect(ownerName('Foo.bar.match_1')).toBe('Foo.bar')
    expect(ownerName('Foo.bar.match_1._unary.proof_2')).toBe('Foo.bar')
    expect(ownerName('Nat.add_comm')).toBe('Nat.add_comm')
    expect(ownerName('Foo._x.bar')).toBe('Foo._x.bar')
    expect(ownerName('_x')).toBe('_x')
    expect(ownerName('_x._y')).toBe('_x._y')
  })
  it('collapses paths', () => {
    expect(collapsePath(['A', 'A._f', 'B'])).toEqual(['A', 'B'])
    expect(collapsePath(['A', 'A._f', 'A._g', 'B', 'A'])).toEqual(['A', 'B', 'A'])
    expect(collapsePath([])).toEqual([])
  })
})

describe('closureRows', () => {
  it('is BFS from the root with depths and survives cycles', () => {
    const rows = closureRows(graph, rootId)
    expect(rows[0]).toMatchObject({ name: 'Test.root', depth: 0, generated: false })
    expect(rows).toHaveLength(8 - 0)
    const byName = Object.fromEntries(rows.map((r) => [r.name, r]))
    expect(byName['Test.mid'].depth).toBe(1)
    expect(byName['Test.mid._f']).toMatchObject({ depth: 2, generated: true, module: 'Mathlib.Test.B' })
    expect(byName['propext'].depth).toBe(4)
    expect(rows.map((r) => r.depth)).toEqual([...rows.map((r) => r.depth)].sort((a, b) => a - b))
  })
  it('follows dependents', () => {
    const rows = closureRows(graph, graph.id('Test.leaf')!, 'dependents')
    expect(rows.map((r) => r.name)).toEqual(['Test.leaf', 'Test.mid._f', 'Test.mid', 'Test.root'])
  })
})

describe('filters', () => {
  const rows = closureRows(graph, rootId)
  const names = (input: string, hide = false) => applyFilter(rows, parseFilter(input, hide)).map((r) => r.name).sort()
  it('parses tokens', () => {
    expect(parseFilter('Topology.* -Classical.* -foo Nat zero', true)).toEqual({ include: ['Topology.*'], exclude: ['Classical.*', 'foo'], text: 'Nat zero', hideGenerated: true })
    expect(parseFilter('   ')).toEqual({ include: [], exclude: [], text: '', hideGenerated: false })
  })
  it('includes by name or module prefix, OR-ed', () => {
    expect(names('Topology.*')).toEqual(['Topology.open'])
    expect(names('Mathlib.Topology.* Nat.*')).toEqual(['Nat.zero_add', 'Topology.open'])
  })
  it('excludes by prefix or substring', () => {
    expect(names('-Classical.*')).not.toContain('Classical.foo')
    expect(names('-Classical.*')).toHaveLength(7)
    expect(names('-MID')).toEqual(['Classical.foo', 'Nat.zero_add', 'Test.leaf', 'Test.root', 'Topology.open', 'propext'])
  })
  it('requires all substring tokens, case-insensitively', () => {
    expect(names('test mid')).toEqual(['Test.mid', 'Test.mid._f'])
    expect(names('ZERO')).toEqual(['Nat.zero_add'])
    expect(names('zzz')).toEqual([])
  })
  it('hides generated rows', () => {
    expect(names('mid', true)).toEqual(['Test.mid'])
    expect(names('')).toHaveLength(8)
  })
})

describe('axiomAudit', () => {
  it('finds the axiom through a generated step with a collapsed path', () => {
    expect(axiomAudit(graph, rootId)).toEqual([{ axiom: 'propext', path: ['Test.root', 'Test.mid', 'Test.leaf', 'propext'] }])
  })
  it('returns nothing when no axiom is reachable', () => {
    expect(axiomAudit(graph, graph.id('Topology.open')!)).toEqual([])
  })
  it('handles cycles, sorting, and Classical.choice behind a generated name', () => {
    const g = new LocalGraph(files({
      'T.a': ['T.b', 'Quot.sound'],
      'T.b': ['T.a', 'T.b.proof_1'],
      'T.b.proof_1': ['Classical.choice'],
      'Classical.choice': [],
      'Quot.sound': [],
    }))
    expect(axiomAudit(g, g.id('T.a')!)).toEqual([
      { axiom: 'Classical.choice', path: ['T.a', 'T.b', 'Classical.choice'] },
      { axiom: 'Quot.sound', path: ['T.a', 'Quot.sound'] },
    ])
  })
  it('reports an axiom root as its own path', () => {
    expect(axiomAudit(graph, graph.id('propext')!)).toEqual([{ axiom: 'propext', path: ['propext'] }])
  })
})

describe('groupByModule', () => {
  it('groups by prefix, count desc then name', () => {
    const rows = closureRows(graph, rootId)
    expect(groupByModule(rows)).toEqual([
      { module: 'Mathlib.Test', count: 4 },
      { module: 'Init.Core', count: 1 },
      { module: 'Init.Nat', count: 1 },
      { module: 'Mathlib.Logic', count: 1 },
      { module: 'Mathlib.Topology', count: 1 },
    ])
    expect(groupByModule(rows, 1)).toEqual([{ module: 'Mathlib', count: 6 }, { module: 'Init', count: 2 }])
  })
})

describe('exports', () => {
  const odd = new LocalGraph(files({ 'A,"b"': ['C\\d'], 'C\\d': [] }, { 'A,"b"': 'M.x,y' }))
  const oddRows = closureRows(odd, odd.id('A,"b"')!)
  it('quotes CSV per RFC 4180', () => {
    expect(toCsv(oddRows)).toBe('name,module,depth,generated\n"A,""b""","M.x,y",0,false\nC\\d,M,1,false\n')
    expect(toCsv([])).toBe('name,module,depth,generated\n')
  })
  it('writes JSON with source and declarations', () => {
    const rows = closureRows(graph, rootId).slice(0, 2)
    const parsed = JSON.parse(toJson(graph, 'Test.root', rows))
    expect(parsed).toEqual({
      root: 'Test.root',
      source: { dataset: 'ds', mathlib_commit: 'abc1234', lean_toolchain: 'v4.x' },
      count: 2,
      declarations: rows.map(({ name, module, depth, generated }) => ({ name, module, depth, generated })),
    })
    expect(toJson(graph, 'Test.root', rows)).toContain('\n  "root"')
  })
  it('writes escaped DOT limited to the first rows', () => {
    const dot = toDot(odd, oddRows)
    expect(dot).toContain('"A,\\"b\\"" -> "C\\\\d";')
    expect(dot.startsWith('digraph')).toBe(true)
    const small = toDot(graph, closureRows(graph, rootId), 2)
    expect(small).toContain('"Test.root" -> "Nat.zero_add";')
    expect(small).not.toContain('Test.mid')
  })
})

const storeDir = process.env.LEANAGE_STORE
describe('real store', () => {
  it.skipIf(!storeDir)('filters and audits Nat.Prime.dvd_or_dvd', () => {
    const read = (f: string) => new Uint8Array(readFileSync(`${storeDir}/${f}`))
    const text = (f: string) => readFileSync(`${storeDir}/${f}`, 'utf8')
    const g = new LocalGraph({ names: text('names.txt'), modules: text('modules.txt'), nodeModule: read('node_module.u32'), degrees: read('degrees.vbyte'), targets: read('targets.vbyte'), meta: JSON.parse(text('meta.json')) })
    const id = g.id('Nat.Prime.dvd_or_dvd')!
    const rows = closureRows(g, id)
    expect(rows).toHaveLength(3190)
    const filtered = applyFilter(rows, parseFilter('Nat.* -Classical.*', true))
    expect(filtered.length).toBeGreaterThan(0)
    expect(filtered.every((r) => !r.generated && !r.name.startsWith('Classical.') && (r.name.startsWith('Nat.') || r.module.startsWith('Nat.')))).toBe(true)
    const audit = axiomAudit(g, id)
    expect(audit.map((a) => a.axiom)).toEqual(['Classical.choice', 'Quot.sound', 'propext'])
    for (const a of audit) {
      expect(a.path[0]).toBe('Nat.Prime.dvd_or_dvd')
      expect(a.path[a.path.length - 1]).toBe(a.axiom)
    }
  }, 120_000)
})
