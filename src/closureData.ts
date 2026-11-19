import { AXIOM_NAMES, type LocalGraph } from './localGraph'

// Level 1 (hidden, collapsed to the owner): compiler/elaborator auxiliaries nobody writes by hand.
// Any component starting with `_` (_proof_N, _simp_N, _aux_N, _f, _unary, _sunfold, _cstage, _boxed, _closed,
// _lambda/_rarg/_spec, _sizeOf_N, _flat_ctor, _auto_N, _default, _private, _hyg, _@, _to_dual_N, ...), plus the
// unprefixed ones: match_N, proof_N, equation lemmas eq_N / eq_def / eq_unfold / congr_eq_N / hcongr_N, unsafe_N.
// Keep in sync with GENERATED in scripts/ingest_const_dep.py.
const GENERATED_PART = /^(_|(match|proof|eq|congr_eq|hcongr|unsafe|unsafe_impl)_\d+$|eq_def$|eq_unfold$)/
// Level 2 (kept visible): structural auxiliaries Lean derives for every inductive/structure; users do cite them.
const STRUCTURAL_PART = /^(rec|recOn|casesOn|noConfusion|noConfusionType|below|brecOn|binductionOn|ibelow|inj|injEq|sizeOf_spec|ctorIdx)(_\d+)?$/

export function isStructuralAuxName(name: string): boolean {
  return STRUCTURAL_PART.test(name.split('.').pop()!)
}

const PRIVATE_PREFIX = /^_private\..*?\.0\./

export function isGeneratedName(name: string): boolean {
  // `_private.<Module>.0.` only marks a private (real) declaration; judge the name behind it
  return name.replace(PRIVATE_PREFIX, '').split('.').some((part) => GENERATED_PART.test(part))
}

export function ownerName(name: string): string {
  name = name.replace(PRIVATE_PREFIX, '') // private decls: _private.<Module>.0.<Name>
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

export interface ClosureRow { id: number; name: string; module: string; depth: number; generated: boolean; boilerplate: boolean }

export function closureRows(graph: LocalGraph, rootId: number, direction: 'dependencies' | 'dependents' = 'dependencies'): ClosureRow[] {
  const { order, depth } = graph.reach(rootId, direction)
  const rows: ClosureRow[] = []
  for (let i = 0; i < order.length; i++) {
    const id = order[i]
    const name = graph.name(id)
    rows.push({ id, name, module: graph.module(id), depth: depth[id], generated: isGeneratedName(name), boilerplate: graph.isBoilerplate(id) })
  }
  return rows
}

export interface RowFilter { include: string[]; exclude: string[]; text: string; hideGenerated: boolean; hideBoilerplate: boolean }

// include/exclude keep the token as typed minus the leading '-', e.g. 'Topology.*' or 'foo'.
export function parseFilter(input: string, hideGenerated = false, hideBoilerplate = false): RowFilter {
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
  return { include, exclude, text: text.join(' '), hideGenerated, hideBoilerplate }
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
    if (filter.hideBoilerplate && row.boilerplate) return false
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
