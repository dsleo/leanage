import type { LocalGraph } from './localGraph'

export interface ModuleNode { module: string; count: number; dependsOn: string[]; usedBy: string[] }
export interface ModuleGraph { nodes: ModuleNode[]; edges: [string, string][] }

// Top-level namespace of a module: 'Mathlib.Topology.Basic' -> 'Mathlib.Topology', 'Init.Prelude' -> 'Init'.
export function moduleGroup(module: string): string {
  const parts = module.split('.')
  return (parts[0] === 'Mathlib' && parts.length > 1 ? parts.slice(0, 2) : parts.slice(0, 1)).join('.')
}

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

// Module-level graph of a closure: A -> B when a declaration of A in the closure depends on one of B (A != B).
// Linear in the edges of the closure members; edges leaving the closure are ignored.
export function moduleGraph(graph: LocalGraph, ids: ArrayLike<number>, group: (module: string) => string = (m) => m): ModuleGraph {
  const inClosure = new Uint8Array(graph.size)
  for (let i = 0; i < ids.length; i++) inClosure[ids[i]] = 1
  const index = new Map<string, number>()
  const labels: string[] = []
  const slot = (id: number) => {
    const label = group(graph.module(id))
    let k = index.get(label)
    if (k === undefined) { k = labels.length; index.set(label, k); labels.push(label) }
    return k
  }
  const slotOf = new Int32Array(graph.size).fill(-1)
  const counts: number[] = []
  for (let i = 0; i < ids.length; i++) {
    const k = (slotOf[ids[i]] = slot(ids[i]))
    counts[k] = (counts[k] ?? 0) + 1
  }
  const seen = new Set<number>()
  const out: Set<number>[] = labels.map(() => new Set())
  const inn: Set<number>[] = labels.map(() => new Set())
  const m = labels.length
  for (let i = 0; i < ids.length; i++) {
    const a = slotOf[ids[i]]
    for (const dep of graph.dependencies(ids[i])) {
      if (!inClosure[dep]) continue
      const b = slotOf[dep]
      if (a === b) continue
      const key = a * m + b
      if (seen.has(key)) continue
      seen.add(key)
      out[a].add(b)
      inn[b].add(a)
    }
  }
  const names = (set: Set<number>) => [...set].map((k) => labels[k]).sort(cmp)
  const nodes = labels.map((module, k) => ({ module, count: counts[k], dependsOn: names(out[k]), usedBy: names(inn[k]) }))
    .sort((x, y) => y.count - x.count || cmp(x.module, y.module))
  const edges: [string, string][] = []
  for (const n of nodes) for (const t of n.dependsOn) edges.push([n.module, t])
  edges.sort((x, y) => cmp(x[0], y[0]) || cmp(x[1], y[1]))
  return { nodes, edges }
}

const csvCell = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
const q = (v: string) => `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`

export function moduleCsv(g: ModuleGraph): string {
  return 'module,declarations,depends_on,used_by\n' + g.nodes.map((n) => [csvCell(n.module), n.count, n.dependsOn.length, n.usedBy.length].join(',')).join('\n') + (g.nodes.length ? '\n' : '')
}

export function moduleJson(g: ModuleGraph, root: string): string {
  return JSON.stringify({ root, modules: g.nodes, edges: g.edges.map(([from, to]) => ({ from, to })) }, null, 2) + '\n'
}

export function moduleDot(g: ModuleGraph): string {
  const lines = ['digraph modules {']
  for (const n of g.nodes) lines.push(`  ${q(n.module)} [label=${q(`${n.module}\n${n.count}`)}];`)
  for (const [a, b] of g.edges) lines.push(`  ${q(a)} -> ${q(b)};`)
  return lines.join('\n') + '\n}\n'
}
