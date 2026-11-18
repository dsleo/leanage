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
