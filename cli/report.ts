import { isGeneratedName, isStructuralAuxName } from '../src/closureData'
import { EDGE_DEF_VALUE, EDGE_IN_TYPE, EDGE_IN_VALUE, type LocalGraph } from '../src/localGraph'
import { REPORT_HTML } from './reportHtml'

declare const __REPORT_FONTS__: string | undefined // injected by cli/build.mjs

/**
 * The closure of your library inside the store, compact enough to ship in one HTML file: nodes are numbered with your library first,
 * then everything it reaches (Mathlib and core). `edges` is, per node, a varint count followed by varints of (delta to previous target) * 4 + type bits:
 * 1 = the reference is in the statement, 2 = it is in the value of a definition. The page runs the same questions as the webapp on it.
 */
export interface ReportData {
  project: string
  mathlib?: string
  built: string
  root?: string // project directory, for editor links
  files: Record<string, string> // module -> source file, for your library
  mods: string[]
  nm: number[] // module index per node
  names: string[]
  nLib: number // nodes below this index are your library
  kinds: string // one letter per library node: t theorem, d definition, i instance, a axiom, o other
  focus: number[] // library nodes of interest (the modules you pointed at), real declarations only
  lines: Record<number, number> // source line per library node
  bp: number[] // instances, projections, coercions, structure helpers
  tac: Record<number, string> // tactics written in the source, per node (comma separated)
  edges: string // base64
  scope: boolean // statement-only questions are possible
}

const KINDS = new Set(['t', 'd', 'i', 'a', 'o'])

export function buildReport(graph: LocalGraph, project: string): ReportData {
  const start = graph.libraryStart!
  const order: number[] = []
  const idx = new Map<number, number>()
  const add = (id: number) => { if (!idx.has(id)) { idx.set(id, order.length); order.push(id) } }
  for (let id = start; id < graph.size; id++) add(id)
  const nLib = order.length
  for (let h = 0; h < order.length; h++) for (const t of graph.dependencies(order[h])) add(t)

  const bytes: number[] = []
  const varint = (n: number) => { while (n >= 128) { bytes.push((n % 128) | 128); n = Math.floor(n / 128) } bytes.push(n) }
  for (const id of order) {
    const deps = graph.dependencies(id)
    const row: [number, number][] = []
    for (let i = 0; i < deps.length; i++) {
      const b = graph.edgeTypes(id, i)
      row.push([idx.get(deps[i])!, b === null ? 0 : (b & EDGE_IN_TYPE ? 1 : 0) + ((b & (EDGE_IN_VALUE | EDGE_DEF_VALUE)) === (EDGE_IN_VALUE | EDGE_DEF_VALUE) ? 2 : 0)])
    }
    row.sort((a, b) => a[0] - b[0])
    varint(row.length)
    let prev = 0
    for (const [t, bits] of row) { varint((t - prev) * 4 + bits); prev = t }
  }

  const mods: string[] = []
  const modIdx = new Map<string, number>()
  const nm = order.map((id) => {
    const m = graph.module(id)
    if (!modIdx.has(m)) { modIdx.set(m, mods.length); mods.push(m) }
    return modIdx.get(m)!
  })
  const names = order.map((id) => graph.name(id))
  const kinds = order.slice(0, nLib).map((id) => graph.libraryKind(id) ?? 'o').join('')
  const focus: number[] = []
  const lines: Record<number, number> = {}
  for (let i = 0; i < nLib; i++) {
    const id = order[i]
    if (graph.inFocus(id) && KINDS.has(kinds[i]) && !isGeneratedName(names[i]) && !graph.isBoilerplate(id) && !isStructuralAuxName(names[i])) focus.push(i)
    const l = graph.libraryLine(id)
    if (l !== undefined) lines[i] = l
  }
  const tac: Record<number, string> = {} // library nodes from your source; Mathlib and TauCeti nodes from the store, when it has tactic records
  for (let i = 0; i < order.length; i++) { const t = graph.tacticsOf(order[i]); if (t?.length) tac[i] = t.join(',') }
  const bp: number[] = []
  order.forEach((id, i) => { if (graph.isBoilerplate(id) || isStructuralAuxName(names[i])) bp.push(i) })
  const files: Record<string, string> = {}
  for (const m of new Set(nm.slice(0, nLib).map((i) => mods[i]))) { const f = graph.libraryFiles?.get(m); if (f) files[m] = f }
  return {
    project, mathlib: graph.meta.mathlib_commit, built: new Date().toISOString().slice(0, 10), root: graph.libraryRoot, files, mods, nm, names, nLib, kinds, focus, lines, bp, tac,
    edges: Buffer.from(bytes).toString('base64'), scope: graph.hasEdgeTypes,
  }
}

export function renderReport(data: ReportData): string {
  const json = JSON.stringify(data).replace(/</g, '\\u003c')
  return REPORT_HTML.replace('/*FONTS*/', () => (typeof __REPORT_FONTS__ !== 'undefined' ? __REPORT_FONTS__ : '')).replace('/*DATA*/null', () => json).replace('{{TITLE}}', () => data.project.replace(/[<>&"]/g, ''))
}
