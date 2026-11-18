import type { LocalGraph } from './localGraph'

export interface LocalMatch { id: number; name: string; module: string; reason: 'exact' | 'case' | 'prefix' | 'suffix' | 'substring' | 'namespace-moved' }

const GENERATED = /(^|\.)(_[^.]*|(match|proof|eq)_\d+)(\.|$)/
const IDENT = /^[\p{L}_][\p{L}\p{N}_']*(\.[\p{L}_][\p{L}\p{N}_']*)*$/u

export function isLeanNameLike(text: string): boolean {
  return IDENT.test(text)
}

export function lookupName(graph: LocalGraph, query: string, limit = 12): LocalMatch[] {
  let q = query.trim()
  while (q.startsWith('`')) q = q.slice(1)
  while (q.endsWith('`')) q = q.slice(0, -1)
  if (q.startsWith('_root_.')) q = q.slice(7)
  if (!q || /\s/.test(q)) return []
  const cap = Math.max(0, Math.min(Math.floor(limit), 50))
  if (!cap) return []

  const wantGenerated = GENERATED.test(q)
  const ok = (name: string) => wantGenerated || !GENERATED.test(name)
  const seen = new Set<number>()
  const out: LocalMatch[] = []
  const buckets: Record<'case' | 'suffix' | 'namespace-moved' | 'substring', number[]> = { case: [], suffix: [], 'namespace-moved': [], substring: [] }
  const push = (id: number, reason: LocalMatch['reason']) => {
    if (seen.has(id)) return
    seen.add(id)
    out.push({ id, name: graph.name(id), module: graph.module(id), reason })
  }

  const exact = graph.id(q)
  if (exact !== undefined) push(exact, 'exact')

  // Case-insensitive, suffix, moved and substring candidates come from one scan; each class keeps its own quota.
  const lower = q.toLowerCase()
  const dotSuffix = '.' + q
  const dot = q.lastIndexOf('.')
  const tail = dot >= 0 ? q.slice(dot) : ''
  const hasPrefix = (name: string) => name.startsWith(q)
  const scan = () => {
    const full = (k: keyof typeof buckets) => buckets[k].length >= cap
    for (let id = 0, n = graph.size; id < n; id++) {
      const name = graph.name(id)
      if (id === exact) continue
      let kind: keyof typeof buckets | undefined
      if (name.length === q.length && !full('case') && name.toLowerCase() === lower) kind = 'case'
      else if (hasPrefix(name)) continue
      else if (name.endsWith(dotSuffix)) kind = full('suffix') ? undefined : 'suffix'
      else if (tail && (name.endsWith(tail) || name === tail.slice(1))) kind = full('namespace-moved') ? undefined : 'namespace-moved'
      else if (!full('substring') && name.includes(q)) kind = 'substring'
      if (kind && ok(name)) buckets[kind].push(id)
      if (full('case') && full('suffix') && full('substring') && (!tail || full('namespace-moved'))) break
    }
  }
  scan()

  for (const id of buckets.case) push(id, 'case')
  for (let want = cap + 2; ; want *= 4) {
    const found = graph.search(q, want)
    for (const name of found) {
      const id = graph.id(name)
      if (id !== undefined && ok(name) && !seen.has(id)) push(id, 'prefix')
      if (out.length >= cap) break
    }
    if (out.length >= cap || found.length < want || want > 20000) break
  }
  for (const k of ['suffix', 'namespace-moved', 'substring'] as const) for (const id of buckets[k]) push(id, k)
  return out.slice(0, cap)
}
