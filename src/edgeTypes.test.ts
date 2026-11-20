import { describe, expect, it } from 'vitest'
import { EDGE_DEF_VALUE as DV, EDGE_IN_TYPE as T, EDGE_IN_VALUE as V, EDGE_UNSEEN as U, LocalGraph } from './localGraph'
import { axiomAudit, closureRows } from './closureData'
import { axiomsCmd, checkCmd, closureCmd, defaultOptions } from '../cli/commands'

function varint(values: number[]): Uint8Array {
  const out: number[] = []
  for (let v of values) { while (v >= 128) { out.push((v & 127) | 128); v = Math.floor(v / 128) } out.push(v) }
  return Uint8Array.from(out)
}

// edges: from -> [target, bits]; the byte array follows the sorted-target order the store uses.
function build(edges: Record<string, Array<[string, number]>>) {
  const names = [...new Set(Object.entries(edges).flatMap(([k, v]) => [k, ...v.map((e) => e[0])]))].sort()
  const id = new Map(names.map((n, i) => [n, i]))
  const lists = names.map((n) => (edges[n] ?? []).map(([t, b]) => [id.get(t)!, b] as const).sort((a, b) => a[0] - b[0]))
  const deltas = lists.flatMap((l) => l.map(([t], i) => (i ? t - l[i - 1][0] : t)))
  const files = {
    names: names.join('\n') + '\n', modules: 'M\n', nodeModule: new Uint8Array(names.length * 4),
    degrees: varint(lists.map((l) => l.length)), targets: varint(deltas),
    meta: { nodes: names.length, edges: lists.flat().length, mathlib_commit: 'abc' },
  }
  return { graph: new LocalGraph(files), bytes: Uint8Array.from(lists.flatMap((l) => l.map(([, b]) => b))) }
}

// thm: statement mentions Nat only, proof uses Classical.choice via lemma; defn D mentions choice in its type.
const EDGES: Record<string, Array<[string, number]>> = {
  thm: [['Nat', T], ['lemma', V]],
  lemma: [['Classical.choice', V], ['Nat', T]],
  thmC: [['D', T], ['Nat', V]],
  D: [['Classical.choice', T]],
  weird: [['Nat', U], ['Classical.choice', V]],
  Dd: [['Classical.choice', V | DV]], // a definition implemented with choice
  thmDd: [['Dd', T], ['Nat', V]], // claim mentions Dd
  defRoot: [['Classical.choice', V | DV], ['Nat', T]], // root def: its own body is not its statement
}

describe('edge types', () => {
  it('is absent until loaded and rejects wrong length or commit', () => {
    const { graph, bytes } = build(EDGES)
    expect(graph.hasEdgeTypes).toBe(false)
    expect(() => graph.reach(0, 'dependencies', 'statement')).toThrow()
    expect(graph.setEdgeTypes(bytes.subarray(1))).toBe(false)
    expect(graph.setEdgeTypes(bytes, { mathlib_commit: 'other' })).toBe(false)
    expect(graph.hasEdgeTypes).toBe(false)
    expect(graph.setEdgeTypes(bytes, { mathlib_commit: 'abc' })).toBe(true)
  })

  it('splits dependencies into type and value', () => {
    const { graph, bytes } = build(EDGES)
    graph.setEdgeTypes(bytes)
    const names = (a: Uint32Array) => [...a].map((i) => graph.name(i)).sort()
    const thm = graph.id('thm')!
    expect(names(graph.dependenciesIn(thm, 'type'))).toEqual(['Nat'])
    expect(names(graph.dependenciesIn(thm, 'value'))).toEqual(['lemma'])
    expect(names(graph.dependenciesIn(graph.id('weird')!, 'type'))).toEqual([])
    expect(graph.edgeTypes(thm, 0)).toBe(T)
    expect(graph.edgeTypes(graph.id('weird')!, 1)).toBeNull()
  })

  it('statement scope sees choice only when the claim uses it', () => {
    const { graph, bytes } = build(EDGES)
    graph.setEdgeTypes(bytes)
    const ax = (n: string, scope: 'proof' | 'statement') => axiomAudit(graph, graph.id(n)!, scope).map((a) => a.axiom)
    expect(ax('thm', 'proof')).toEqual(['Classical.choice'])
    expect(ax('thm', 'statement')).toEqual([])
    expect(ax('thmC', 'statement')).toEqual(['Classical.choice'])
    expect(ax('weird', 'statement')).toEqual([])
    expect(ax('thmDd', 'statement')).toEqual(['Classical.choice'])
    expect(ax('defRoot', 'statement')).toEqual([])
    expect(ax('defRoot', 'proof')).toEqual(['Classical.choice'])
    expect(graph.axioms(graph.id('thm')!, 'statement').axioms).toEqual([])
    expect(graph.axioms(graph.id('thm')!).axioms).toEqual(['Classical.choice'])
    expect(closureRows(graph, graph.id('thm')!, 'dependencies', 'statement').map((r) => r.name)).toEqual(['thm', 'Nat'])
    expect(closureRows(graph, graph.id('thm')!).length).toBe(4)
  })

  it('CLI scope option', () => {
    const { graph, bytes } = build(EDGES)
    graph.setEdgeTypes(bytes)
    expect(axiomsCmd(graph, 'thm', { ...defaultOptions, scope: 'statement' }).out).toBe('statement of thm: no axioms\n')
    expect(axiomsCmd(graph, 'thm', defaultOptions).out).toContain('Classical.choice')
    expect(checkCmd(graph, 'thm', { ...defaultOptions, forbid: ['Classical.choice'], scope: 'statement' }).code).toBe(0)
    expect(checkCmd(graph, 'thm', { ...defaultOptions, forbid: ['Classical.choice'] }).code).toBe(1)
    expect(closureCmd(graph, 'thm', 'dependencies', { ...defaultOptions, scope: 'statement' }).out).toBe('Nat\t1\tM\n')
  })
})
