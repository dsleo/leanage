import { describe, expect, it } from 'vitest'
import { LocalGraph, type StoreFiles } from './localGraph'
import { localStates } from './localExplorer'
import { findEvidence } from './methods'
import { pathTo } from './paths'
import { interpretObjective } from './objectives'

function varint(values: number[]): Uint8Array {
  const out: number[] = []
  for (let v of values) {
    while (v >= 128) { out.push((v & 127) | 128); v = Math.floor(v / 128) }
    out.push(v)
  }
  return Uint8Array.from(out)
}

function files(edges: Record<string, string[]>): StoreFiles {
  const names = [...new Set(Object.entries(edges).flat(2))].sort()
  const id = new Map(names.map((name, index) => [name, index]))
  const deps = names.map((name) => (edges[name] ?? []).map((dep) => id.get(dep)!).sort((a, b) => a - b))
  const targets = deps.flatMap((list) => list.map((value, index) => (index ? value - list[index - 1] : value)))
  return { names: names.join('\n') + '\n', modules: 'M\n', nodeModule: new Uint8Array(names.length * 4), degrees: varint(deps.map((list) => list.length)), targets: varint(targets), meta: { nodes: names.length, edges: deps.flat().length, mathlib_commit: 'abc1234' } }
}

const graph = new LocalGraph(files({
  'Test.root': ['Test.mid', 'Nat.zero_add'],
  'Test.mid': ['Nat.recAux', 'Classical.choice', 'Test.root.match_1'],
  'Test.root.match_1': ['Test.mid'],
  'Classical.choice': ['Nonempty'],
}))
const root = { id: 'uuid-1', name: 'Test.root' }

describe('local states', () => {
  it('finds a named dependency through the whole closure and keeps the path', () => {
    const objective = interpretObjective('axiom of choice')!
    const states = localStates(graph, root, [objective])!
    const state = states.get('body')!
    expect(state.source).toBe('local')
    const found = findEvidence(state, objective)[0]
    expect(found.grade).toBe('observed')
    expect(found.path.map((step) => step.name)).toEqual(['Test.root', 'Test.mid', 'Classical.choice'])
    expect(pathTo(state, 'Classical.choice').map((step) => step.id)).toEqual(['Test.root', 'Test.mid', 'Classical.choice'])
  })

  it('accepts a structural recursor by name because the commit is pinned', () => {
    const objective = interpretObjective('induction')!
    const state = localStates(graph, root, [objective])!.get('proof')!
    expect(findEvidence(state, objective)[0]).toMatchObject({ grade: 'observed', ruleId: 'nat-rec-aux' })
  })

  it('draws a bounded view whose edges stay inside it and survives cycles', () => {
    const objective = interpretObjective('axiom of choice')!
    const state = localStates(graph, root, [objective])!.get('body')!
    expect(state.viewIds!.has('Test.root')).toBe(true)
    expect(state.edges.every((edge) => state.viewIds!.has(edge.from) && state.viewIds!.has(edge.to))).toBe(true)
    expect(state.discovered.size).toBe(7)
  })

  it('returns null when the declaration is not in the store', () => {
    expect(localStates(graph, { id: 'x', name: 'Nope.missing' }, [interpretObjective('induction')!])).toBeNull()
  })
})

describe('source tactics (same commit)', () => {
  const legend = { mathlib_commit: 'abc1234', bits: { '0': 'induction', '1': 'cases', '2': 'rcases', '5': 'by_contra', '7': 'exfalso' } }
  function withTactics(bitsByName: Record<string, number>): LocalGraph {
    const g = new LocalGraph(files({
      'Test.root': ['Test.mid', 'Nat.zero_add'],
      'Test.mid': ['Classical.choice'],
      'Classical.choice': ['Nonempty'],
    }))
    const bytes = new Uint8Array(g.size * 2)
    const view = new DataView(bytes.buffer)
    for (const [name, bits] of Object.entries(bitsByName)) view.setUint16(g.id(name)! * 2, bits, true)
    expect(g.setTactics(bytes, legend)).toBe(true)
    return g
  }

  it('upgrades to observed only for a covered declaration whose source shows the tactic', () => {
    const g = withTactics({ 'Test.mid': (1 << 15) | 1, 'Nat.zero_add': 1 }) // zero_add has the bit but is not covered
    const objective = interpretObjective('induction')!
    const found = findEvidence(localStates(g, root, [objective])!.get('proof')!, objective)
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({ grade: 'observed', source: 'MathlibTactics', matchedToken: 'induction', matchedName: 'Test.mid' })
    expect(found[0].explanation).toMatch(/commit the dependency store was built from/)
  })

  it('keeps related tactics related and does not invent other methods', () => {
    const g = withTactics({ 'Test.mid': (1 << 15) | (1 << 2) | (1 << 7) })
    const cases = interpretObjective('case analysis')!
    const absurd = interpretObjective('contradiction')!
    const state = localStates(g, root, [cases, absurd])!.get('proof')!
    expect(findEvidence(state, cases).map((e) => [e.matchedToken, e.grade])).toEqual([['rcases', 'related']])
    expect(findEvidence(state, absurd).map((e) => [e.matchedToken, e.grade])).toEqual([['exfalso', 'related']])
    expect(findEvidence(state, interpretObjective('induction')!)).toEqual([])
  })

  it('reports no tactic data for uncovered declarations and for a store without tactics', () => {
    const plain = new LocalGraph(files({ 'Test.root': ['Test.mid'] }))
    expect(plain.hasTactics).toBe(false)
    expect(plain.tacticsOf(0)).toBeNull()
    const g = withTactics({})
    expect(g.tacticsOf(g.id('Test.mid')!)).toBeNull()
  })

  it('rejects tactic data of the wrong length or commit', () => {
    const g = new LocalGraph(files({ 'Test.root': ['Test.mid'] }))
    expect(g.setTactics(new Uint8Array(3), legend)).toBe(false)
    expect(g.setTactics(new Uint8Array(g.size * 2), { ...legend, mathlib_commit: 'other' })).toBe(false)
    expect(g.hasTactics).toBe(false)
  })
})
