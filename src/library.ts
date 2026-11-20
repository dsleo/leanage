import type { LibraryDecl } from './localGraph'

export interface LibraryFile { decls: LibraryDecl[]; mathlibCommit?: string; lean?: string; focus?: string[] }

/** Parses the output of scripts/extract_library.lean: `name<TAB>type deps<TAB>value deps<TAB>kind<TAB>module`, lists joined by U+001F. */
export function parseLibraryTsv(text: string): LibraryFile {
  const out: LibraryFile = { decls: [] }
  const list = (s: string) => (s ? s.split('\x1f').filter((x) => x && x !== '?missing') : [])
  for (const line of text.split('\n')) {
    if (!line) continue
    if (line.startsWith('#')) {
      const m = /^# mathlib (\S+)/.exec(line)
      if (m) out.mathlibCommit = m[1]
      else if (line.startsWith('# focus ')) out.focus = line.slice(8).split(',')
      else if (line.startsWith('# lean ')) out.lean = line.slice(7)
      continue
    }
    const [name, type, value, kind, module] = line.split('\t')
    if (!name || !module) throw new Error(`Malformed library line: ${line.slice(0, 80)}`)
    out.decls.push({ name, module, kind: kind ?? '?', typeDeps: list(type ?? ''), valueDeps: list(value ?? '') })
  }
  return out
}
