import { axiomAudit, isGeneratedName, isStructuralAuxName } from '../src/closureData'
import type { LocalGraph } from '../src/localGraph'
import { REPORT_HTML } from './reportHtml'

export interface ReportDecl {
  n: string // name
  m: number // module index
  k: string // kind letter
  f: boolean // in the modules of interest
  d: number[] // direct library dependencies (decl indexes), generated helper declarations looked through
  ml: string[] // direct Mathlib/core dependencies (names, capped)
  mc: number // how many direct Mathlib/core dependencies in total
  ax: { a: string; p: string[] }[] // axioms reached, with the witness path
  s: boolean // refers to sorryAx directly
  u: number // number of library declarations that use it
  l?: number // source line
  b: boolean // instance, projection or coercion
}
export interface ReportData {
  project: string
  mathlib?: string
  built: string
  root?: string // project directory, for editor links
  files: string[] // source file per module index (empty when unknown)
  mods: string[]
  decls: ReportDecl[]
}

declare const __REPORT_FONTS__: string | undefined // injected by cli/build.mjs
const KINDS = new Set(['t', 'd', 'i', 'a', 'o'])

export function buildReport(graph: LocalGraph, project: string): ReportData {
  const start = graph.libraryStart!
  const real: number[] = []
  for (let id = start; id < graph.size; id++) if (KINDS.has(graph.libraryKind(id) ?? '') && !isGeneratedName(graph.name(id))) real.push(id)
  const index = new Map(real.map((id, i) => [id, i]))
  const mods: string[] = []
  const modIdx = new Map<string, number>()
  const sorry = graph.id('sorryAx')

  // Direct dependencies of a declaration, looking through the generated helpers (proof_1, match_1, ...) of the library.
  const look = (id: number, seen = new Set<number>()): number[] => {
    const out: number[] = []
    for (const t of graph.dependencies(id)) {
      if (seen.has(t)) continue
      seen.add(t)
      if (graph.isLibrary(t) && isGeneratedName(graph.name(t))) out.push(...look(t, seen))
      else out.push(t)
    }
    return out
  }

  const uses = new Array<number>(real.length).fill(0)
  const decls: ReportDecl[] = real.map((id) => {
    const module = graph.module(id)
    if (!modIdx.has(module)) { modIdx.set(module, mods.length); mods.push(module) }
    const deps = look(id)
    const lib = [...new Set(deps.filter((t) => index.has(t) && t !== id).map((t) => index.get(t)!))]
    for (const t of lib) uses[t]++
    const ext = [...new Set(deps.filter((t) => !graph.isLibrary(t) && !isGeneratedName(graph.name(t)) && !graph.isBoilerplate(t)).map((t) => graph.name(t)))]
    return {
      n: graph.name(id), m: modIdx.get(module)!, k: graph.libraryKind(id)!, f: graph.inFocus(id), d: lib, ml: ext.slice(0, 40), mc: ext.length,
      ax: graph.libraryKind(id) === 't' || graph.libraryKind(id) === 'd' ? axiomAudit(graph, id).map((a) => ({ a: a.axiom, p: a.path })) : [],
      s: sorry !== undefined && deps.includes(sorry), u: 0, l: graph.libraryLine(id), b: graph.isBoilerplate(id) || isStructuralAuxName(graph.name(id)),
    }
  })
  decls.forEach((d, i) => { d.u = uses[i] })
  return { project, mathlib: graph.meta.mathlib_commit, built: new Date().toISOString().slice(0, 10), root: graph.libraryRoot, files: mods.map((m) => graph.libraryFiles?.get(m) ?? ''), mods, decls }
}

export function renderReport(data: ReportData): string {
  const json = JSON.stringify(data).replace(/</g, '\\u003c')
  return REPORT_HTML.replace('/*DATA*/null', () => json).replace('/*FONTS*/', () => (typeof __REPORT_FONTS__ !== 'undefined' ? __REPORT_FONTS__ : '')).replace('{{TITLE}}', () => data.project.replace(/[<>&"]/g, ''))
}
