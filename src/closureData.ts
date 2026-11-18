import { AXIOM_NAMES, type LocalGraph } from './localGraph'

const GENERATED_PART = /^(_|match_\d|proof_\d|eq_\d|_simp_\d|_sunfold|_unary|_cstage|_boxed|_closed)/

export function isGeneratedName(name: string): boolean {
  return name.split('.').some((part) => GENERATED_PART.test(part))
}

export function ownerName(name: string): string {
  name = name.replace(/^_private\..*?\.0\./, '') // private decls: _private.<Module>.0.<Name>
  const parts = name.split('.')
  let end = parts.length
  while (end > 0 && GENERATED_PART.test(parts[end - 1])) end--
  return end === 0 ? name : parts.slice(0, end).join('.')
}

export function collapsePath(names: string[]): string[] {
  const out: string[] = []
  for (const name of names) {
    const owner = ownerName(name)
    if (out[out.length - 1] !== owner) out.push(owner)
  }
  return out
}

// Evidence paths: fold compiler-generated steps (Nat.add_comm._f) into their owner, keeping the final step as is.
export function collapseSteps<T extends { name: string }>(steps: T[]): T[] {
  const out: T[] = []
  steps.forEach((step, index) => {
    const owner = ownerName(step.name)
    const last = index === steps.length - 1
    if (!last && out.length && ownerName(out[out.length - 1].name) === owner) return
    out.push(last || owner === step.name ? step : { ...step, name: owner })
  })
  return out
}

export interface ClosureRow { id: number; name: string; module: string; depth: number; generated: boolean }

export function closureRows(graph: LocalGraph, rootId: number, direction: 'dependencies' | 'dependents' = 'dependencies'): ClosureRow[] {
  const { order, depth } = graph.reach(rootId, direction)
  const rows: ClosureRow[] = []
  for (let i = 0; i < order.length; i++) {
    const id = order[i]
    const name = graph.name(id)
    rows.push({ id, name, module: graph.module(id), depth: depth[id], generated: isGeneratedName(name) })
  }
  return rows
}

export interface RowFilter { include: string[]; exclude: string[]; text: string; hideGenerated: boolean }

// include/exclude keep the token as typed minus the leading '-', e.g. 'Topology.*' or 'foo'.
export function parseFilter(input: string, hideGenerated = false): RowFilter {
  const include: string[] = []
  const exclude: string[] = []
  const text: string[] = []
  for (const token of input.split(/\s+/)) {
    if (!token) continue
    if (token.startsWith('-')) {
      if (token.length > 1) exclude.push(token.slice(1))
    } else if (token.endsWith('.*')) include.push(token)
    else text.push(token)
  }
  return { include, exclude, text: text.join(' '), hideGenerated }
}

const isStar = (pattern: string) => pattern.endsWith('.*')

function matchesStar(row: ClosureRow, pattern: string): boolean {
  const prefix = pattern.slice(0, -1)
  return row.name.startsWith(prefix) || row.module.startsWith(prefix)
}

export function applyFilter(rows: ClosureRow[], filter: RowFilter): ClosureRow[] {
  const words = filter.text.toLowerCase().split(' ').filter(Boolean)
  return rows.filter((row) => {
    if (filter.hideGenerated && row.generated) return false
    const lower = row.name.toLowerCase()
    for (const pattern of filter.exclude) {
      if (isStar(pattern) ? matchesStar(row, pattern) : lower.includes(pattern.toLowerCase())) return false
    }
    if (filter.include.length && !filter.include.some((pattern) => matchesStar(row, pattern))) return false
    return words.every((word) => lower.includes(word))
  })
}

export interface AxiomPath { axiom: string; path: string[] }

export function axiomAudit(graph: LocalGraph, rootId: number): AxiomPath[] {
  const { order, parent } = graph.reach(rootId)
  const reached = new Set<number>(order)
  const out: AxiomPath[] = []
  for (const axiom of AXIOM_NAMES) {
    const id = graph.id(axiom)
    if (id === undefined || !reached.has(id)) continue
    const path: string[] = []
    for (let v = id; v !== -1; v = v === rootId ? -1 : parent[v]) path.push(graph.name(v))
    out.push({ axiom, path: collapsePath(path.reverse()) })
  }
  return out.sort((a, b) => (a.axiom < b.axiom ? -1 : a.axiom > b.axiom ? 1 : 0))
}

export function groupByModule(rows: ClosureRow[], depth = 2): { module: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const key = row.module.split('.').slice(0, depth).join('.')
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts].map(([module, count]) => ({ module, count })).sort((a, b) => b.count - a.count || (a.module < b.module ? -1 : a.module > b.module ? 1 : 0))
}

const csvCell = (value: string) => (/[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value)

export function toCsv(rows: ClosureRow[]): string {
  const lines = ['name,module,depth,generated']
  for (const row of rows) lines.push([csvCell(row.name), csvCell(row.module), row.depth, row.generated].join(','))
  return lines.join('\n') + '\n'
}

export function toJson(graph: LocalGraph, rootName: string, rows: ClosureRow[]): string {
  return JSON.stringify({
    root: rootName,
    source: { dataset: graph.meta.dataset, mathlib_commit: graph.meta.mathlib_commit, lean_toolchain: graph.meta.lean_toolchain },
    count: rows.length,
    declarations: rows.map(({ name, module, depth, generated }) => ({ name, module, depth, generated })),
  }, null, 2) + '\n'
}

const dotQuote = (name: string) => `"${name.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`

export function toDot(graph: LocalGraph, rows: ClosureRow[], limit = 300): string {
  const kept = rows.slice(0, limit)
  const ids = new Set(kept.map((row) => row.id))
  const lines = ['digraph closure {']
  for (const row of kept) lines.push(`  ${dotQuote(row.name)};`)
  for (const row of kept) {
    for (const dep of graph.dependencies(row.id)) {
      if (ids.has(dep)) lines.push(`  ${dotQuote(row.name)} -> ${dotQuote(graph.name(dep))};`)
    }
  }
  lines.push('}')
  return lines.join('\n') + '\n'
}

export function downloadText(filename: string, text: string, mime: string): void {
  if (typeof document === 'undefined') return
  const url = URL.createObjectURL(new Blob([text], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
