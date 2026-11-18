import type { Declaration, Edge, Objective, Policy, TraversalState } from './domain'
import type { LocalGraph } from './localGraph'
import { findEvidence, type MethodIndex } from './methods'

const VIEW_NODES = 140
const EVIDENCE_PER_QUESTION = 7

// The local store has the whole closure and no edge types, so every reference is reported as 'proof'.
// ponytail: policy 'proof' and 'body' share one state; typed edges would need the TheoremGraph join.
export function localStates(graph: LocalGraph, root: Declaration, objectives: Objective[], index?: MethodIndex): Map<Policy, TraversalState> | null {
  const start = graph.id(root.name)
  if (start === undefined) return null
  const { order, parent } = graph.reach(start)
  const rootId = root.name
  const names = new Map<string, Declaration>()
  const parents: TraversalState['parents'] = new Map()
  for (const id of order) {
    const name = graph.name(id)
    names.set(name, name === rootId ? { ...root, id: name } : { id: name, name })
    parents.set(name, parent[id] < 0 ? null : { from: graph.name(parent[id]), edge: 'proof' })
  }
  const discovered = new Set(names.keys())
  const base = { rootId, rootSourceLabel: root.sourceLabel, status: 'complete' as const, completionReason: 'exhausted' as const, visited: discovered, discovered, names, parents, frontier: [], requests: 0, elapsedMs: 0, rootDefinitionEdges: 0, source: 'local' as const, edges: [] as Edge[] }

  const states = new Map<Policy, TraversalState>()
  for (const policy of new Set(objectives.map((objective) => objective.policy).filter((value): value is Policy => Boolean(value)))) states.set(policy, { ...base, policy })

  const view = new Set<string>([rootId])
  // Keep the view closed under parents, so every drawn node has a drawn path back to the root.
  const grow = (name: string) => { for (let cursor: string | undefined = name; cursor && !view.has(cursor); cursor = parents.get(cursor)?.from) view.add(cursor) }
  for (const objective of objectives) {
    const state = states.get(objective.policy as Policy)
    if (!state) continue
    for (const evidence of findEvidence(state, objective, index).slice(0, EVIDENCE_PER_QUESTION)) for (const step of evidence.path) grow(step.id)
  }
  for (const id of graph.dependencies(start)) {
    if (view.size >= VIEW_NODES) break
    grow(graph.name(id))
  }
  const edges: Edge[] = []
  for (const name of view) {
    const id = graph.id(name)!
    for (const dep of graph.dependencies(id)) {
      const target = graph.name(dep)
      if (view.has(target)) edges.push({ from: name, to: target, type: 'proof' })
    }
  }
  for (const state of states.values()) { state.viewIds = view; state.edges = edges }
  return states
}
