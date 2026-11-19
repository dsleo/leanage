import { applyFilter, axiomAudit, closureRows, collapsePath, parseFilter, toCsv, toDot, toJson } from '../src/closureData'
import type { LocalGraph } from '../src/localGraph'
import { lookupName } from '../src/localLookup'

export interface Result { out: string; err: string; code: number }
export interface Options { format: 'text' | 'json' | 'csv' | 'dot'; filter: string; noGenerated: boolean; noBoilerplate: boolean; forbid: string[]; limit: number }
export const defaultOptions: Options = { format: 'text', filter: '', noGenerated: false, noBoilerplate: false, forbid: [], limit: 300 }

const done = (out: string, code = 0): Result => ({ out, err: '', code })
const json = (value: unknown) => JSON.stringify(value, null, 2) + '\n'

function missing(graph: LocalGraph, name: string): Result {
  const hints = lookupName(graph, name, 5)
  const err = `Unknown declaration: ${name}\n` + (hints.length ? 'Did you mean:\n' + hints.map((h) => `  ${h.name}`).join('\n') + '\n' : '')
  return { out: '', err, code: 2 }
}

export function axiomsCmd(graph: LocalGraph, name: string, o: Options): Result {
  const id = graph.id(name)
  if (id === undefined) return missing(graph, name)
  const audit = axiomAudit(graph, id)
  if (o.format === 'json') return done(json({ name, axioms: audit.map((a) => ({ axiom: a.axiom, path: a.path })) }))
  if (!audit.length) return done(`${name}: no axioms\n`)
  return done(`${name} depends on:\n` + audit.map((a) => `  ${a.axiom}\n    via ${a.path.join(' -> ')}\n`).join(''))
}

export function closureCmd(graph: LocalGraph, name: string, direction: 'dependencies' | 'dependents', o: Options): Result {
  const id = graph.id(name)
  if (id === undefined) return missing(graph, name)
  const rows = applyFilter(closureRows(graph, id, direction), parseFilter(o.filter, o.noGenerated, o.noBoilerplate)).filter((r) => r.id !== id)
  if (o.format === 'json') return done(toJson(graph, name, rows))
  if (o.format === 'csv') return done(toCsv(rows))
  if (o.format === 'dot') return done(toDot(graph, rows, o.limit))
  return done(rows.map((r) => `${r.name}\t${r.depth}\t${r.module}`).join('\n') + (rows.length ? '\n' : ''))
}

export function pathCmd(graph: LocalGraph, from: string, to: string, o: Options): Result {
  const a = graph.id(from)
  if (a === undefined) return missing(graph, from)
  const b = graph.id(to)
  if (b === undefined) return missing(graph, to)
  const raw = graph.pathTo(a, b)
  const path = raw && collapsePath(raw.map((i) => graph.name(i)))
  if (o.format === 'json') return { out: json({ from, to, path }), err: '', code: path ? 0 : 1 }
  if (!path) return { out: '', err: `No dependency path from ${from} to ${to}\n`, code: 1 }
  return done(path.join(' -> ') + '\n')
}

const matches = (name: string, pattern: string) => (pattern.endsWith('.*') ? name.startsWith(pattern.slice(0, -1)) : name === pattern)

export function checkCmd(graph: LocalGraph, name: string, o: Options): Result {
  const id = graph.id(name)
  if (id === undefined) return missing(graph, name)
  if (!o.forbid.length) return { out: '', err: 'check needs --forbid <name>\n', code: 2 }
  const { order, parent } = graph.reach(id)
  const violations: { forbidden: string; path: string[] }[] = []
  const seen = new Set<string>()
  for (const pattern of o.forbid) {
    for (let i = 0; i < order.length; i++) { // BFS order: first hit has the shortest path
      const hit = order[i]
      if (!matches(graph.name(hit), pattern)) continue
      const names: string[] = []
      for (let v = hit; v !== -1; v = v === id ? -1 : parent[v]) names.push(graph.name(v))
      const key = graph.name(hit)
      if (!seen.has(key)) violations.push({ forbidden: key, path: collapsePath(names.reverse()) })
      seen.add(key)
      break
    }
  }
  if (o.format === 'json') return { out: json({ name, ok: !violations.length, violations }), err: '', code: violations.length ? 1 : 0 }
  if (!violations.length) return done(`OK: ${name} does not reach ${o.forbid.join(', ')}\n`)
  return { out: violations.map((v) => `FAIL: ${name} reaches ${v.forbidden}\n  ${v.path.join(' -> ')}\n`).join(''), err: '', code: 1 }
}
