import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Tactic evidence for your own library, read from your source. A port of the lexical scan in scripts/ingest_tactics_core.py (which is calibrated on
 * Mathlib against the elaborator's own records): a keyword counts only as the start of a tactic step, never in comments, strings, quotations or names.
 * The declaration's lines come from Lean (declaration ranges), so no Lean parsing is done here.
 */
export const TACTIC_LABELS = ['induction', 'cases', 'rcases', 'obtain', 'by_cases', 'by_contra', 'contrapose', 'exfalso', 'fin_cases', 'split_ifs', 'rintro', 'match']

const KW = [
  'induction|fun_induction', 'cases', 'rcases', 'obtain', 'by_cases!?', 'by_contra!?', 'contrapose!?', 'exfalso', 'fin_cases|interval_cases|casesm', 'split_ifs', 'rintro', 'match',
]
const KW_RE = new RegExp("(?<![\\p{L}\\p{N}_'.!?`@#$«])(" + KW.map((r, b) => `(?<b${b}>${r})`).join('|') + ")(?![\\p{L}\\p{N}_'!?.»])", 'gu')
const START_TAIL = /(?:\bby|;|<;>|=>|·|\(|\{|\btry|\ball_goals|\bany_goals|\bfirst|<\|>|\bthen|\belse|\bnext|\brepeat|\bfocus|\bswap|\bdecreasing_by|\biterate\s+\d+|\bcase\b[^\n]*=>|\bon_goal\b[^\n]*=>|\|)\s*$/
const BULLET = /^\s*[·.]\s*$/
const BY = /(?<![\p{L}\p{N}_'.])(?:by|decreasing_by)(?![\p{L}\p{N}_'])/gu
const QUOTE = /`\((?:\w+\|)?/g
const CHAR = /(?<![\p{L}\p{N}_'])'(?:\\.[0-9a-fA-F]*|[^\\'\n])'/gu
const OPEN = '([{⟨'
const CLOSE = ')]}⟩'

/** Blanks comments and string literals, keeping every newline (so line numbers still match the file). */
export function stripComments(src: string): string {
  const out: string[] = []
  let i = 0, depth = 0
  const n = src.length
  while (i < n) {
    const c = src[i]
    if (depth) {
      if (src.startsWith('/-', i)) { depth++; out.push('  '); i += 2 }
      else if (src.startsWith('-/', i)) { depth--; out.push('  '); i += 2 }
      else { out.push(c === '\n' ? '\n' : ' '); i++ }
    } else if (src.startsWith('/-', i)) { depth = 1; out.push('  '); i += 2 }
    else if (src.startsWith('--', i)) { while (i < n && src[i] !== '\n') { out.push(' '); i++ } }
    else if (c === '"') {
      out.push(' '); i++
      while (i < n && src[i] !== '"') { if (src[i] === '\\' && i + 1 < n) { out.push(' '); i++ } out.push(src[i] === '\n' ? '\n' : ' '); i++ }
      out.push(' '); i++
    } else { out.push(c); i++ }
  }
  return out.join('')
}

function blankQuotations(text: string): string {
  text = text.replace(CHAR, (m) => ' '.repeat(m.length))
  const out: string[] = []
  let i = 0
  for (;;) {
    QUOTE.lastIndex = i
    const m = QUOTE.exec(text)
    if (!m) { out.push(text.slice(i)); break }
    out.push(text.slice(i, m.index))
    let j = m.index + 2, depth = 1
    while (j < text.length && depth) { if (text[j] === '(') depth++; else if (text[j] === ')') depth--; j++ }
    out.push(text.slice(m.index, j).replace(/[^\n]/g, ' '))
    i = j
  }
  return out.join('')
}

/** Character intervals of `by` / `decreasing_by` blocks (indentation rule, clipped at the enclosing bracket). */
function byIntervals(text: string): [number, number][] {
  const lines = text.split('\n')
  const starts: number[] = [0]
  for (let p = 0; p < text.length; p++) if (text[p] === '\n') starts.push(p + 1)
  const ind = lines.map((l) => l.length - l.replace(/^[ \t]+/, '').length)
  const res: [number, number][] = []
  const lineOf = (pos: number) => { let lo = 0, hi = starts.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= pos) lo = mid; else hi = mid - 1 } return lo }
  for (const m of text.matchAll(BY)) {
    const li = lineOf(m.index!)
    const restFrom = m.index! + m[0].length
    const lineEnd = starts[li] + lines[li].length
    let bound: number, strict: boolean
    if (text.slice(restFrom, lineEnd).trim()) { bound = ind[li]; strict = true }
    else {
      let k = li + 1
      while (k < lines.length && !lines[k].trim()) k++
      if (k >= lines.length) continue
      bound = ind[k]; strict = false
    }
    let endLine = li
    for (let k = li + 1; k < lines.length; k++) {
      if (lines[k].trim() && ((strict && ind[k] <= bound) || (!strict && ind[k] < bound))) break
      endLine = k
    }
    let end = starts[endLine] + lines[endLine].length
    let depth = 0
    for (let j = restFrom; j < end; j++) {
      const ch = text[j]
      if (OPEN.includes(ch)) depth++
      else if (CLOSE.includes(ch)) { depth--; if (depth < 0) { end = j; break } }
    }
    res.push([restFrom, end])
  }
  return res.sort((a, b) => a[0] - b[0] || a[1] - b[1])
}

/** Tactic labels used as tactic steps in the (comment-stripped) text of one declaration. */
export function scanTactics(text: string): string[] {
  text = blankQuotations(text)
  let iv: [number, number][] | undefined
  let mask = 0
  for (const m of text.matchAll(KW_RE)) {
    const bit = Object.entries(m.groups!).find(([, v]) => v !== undefined)?.[0].slice(1)
    if (bit === undefined || mask & (1 << +bit)) continue
    const b = +bit, s = m.index!
    const ls = text.lastIndexOf('\n', s - 1) + 1
    const pre = text.slice(ls, s)
    if (pre.trim() === '' || BULLET.test(pre)) { /* first token of its line */ }
    else if (!START_TAIL.test(pre.slice(-80))) continue
    if (b === 11) {
      iv ??= byIntervals(text)
      let k = -1
      for (let lo = 0, hi = iv.length - 1; lo <= hi;) { const mid = (lo + hi) >> 1; if (iv[mid][0] <= s) { k = mid; lo = mid + 1 } else hi = mid - 1 }
      if (!iv.slice(Math.max(0, k - 40), k + 1).some(([x, y]) => x <= s && s < y)) continue
      if (pre.trim() === '' || BULLET.test(pre)) {
        // a term-level `match` on its own line follows `:=`; `fun ... =>` is ambiguous
        let prev = ''
        let p = ls - 1
        while (p > 0) { const q = text.lastIndexOf('\n', p - 1); prev = text.slice(q + 1, p).trimEnd(); if (prev) break; p = q }
        if ([':=', '←', '<|', '$', ',', 'fun', 'then', 'else'].some((t) => prev.endsWith(t)) || prev.endsWith('=> fun')) continue
      }
    }
    mask |= 1 << b
  }
  return TACTIC_LABELS.filter((_, b) => mask & (1 << b))
}

/**
 * Adds a tactics column to extractor output (`name, type deps, value deps, kind, module, flags, start-end line`): the labels found in the
 * declaration's lines of its source file, `-` when none, empty when the file or the range is unknown (unknown is not the same as none).
 */
export function addTactics(raw: string, project: string, files: Map<string, string>): string {
  const cache = new Map<string, string[] | null>()
  const lines = (file: string) => {
    if (!cache.has(file)) { const p = join(project, file); cache.set(file, existsSync(p) ? stripComments(readFileSync(p, 'utf8')).split('\n') : null) }
    return cache.get(file)!
  }
  return raw.split('\n').map((row) => {
    if (!row || row.startsWith('#')) return row
    const c = row.split('\t')
    const range = /^(\d+)-(\d+)$/.exec(c[6] ?? '')
    const file = files.get(c[4])
    const src = range && file ? lines(file) : null
    if (!src || !range) return row + '\t'
    const found = scanTactics(src.slice(+range[1] - 1, +range[2]).join('\n'))
    return row + '\t' + (found.length ? found.join(',') : '-')
  }).join('\n')
}
