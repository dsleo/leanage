#!/usr/bin/env tsx
import { parseArgs } from 'node:util'
import { axiomsCmd, checkCmd, closureCmd, defaultOptions, libsCmd, pathCmd, type Options, type Result } from './commands'
import { DEFAULT_STORE, loadStore } from './store'
import { indexLibrary, loadLibrary } from './library'
import { buildReport, renderReport } from './report'
import { writeFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'

const USAGE = `leanage <command> [options]

  axioms <name>             axioms reached by <name>, with evidence paths
  deps <name>               transitive dependencies
  rdeps <name>              transitive dependents
  path <from> <to>          shortest dependency path (exit 1 if none)
  check <name> --forbid X   exit 1 if the closure reaches X (repeatable; 'Pkg.*' prefix allowed)
  index <project>           extract your library's dependencies with Lean (project must be built); writes <project>/.leanage/library.tsv
  libs --lib <project>      list your library's theorems with the axioms each reaches
  report --lib <project>    write a self-contained HTML report (health, module graph, per-declaration witness paths); --out <file>

options:
  --lib <project|file.tsv>  put your library on top of Mathlib: every command then sees both layers (same Mathlib commit as the store)
  --dir <subdir>            index: mark the modules under this directory as the ones of interest (libs and report list them; the whole project is always extracted)
  --filter '<expr>'         e.g. 'Topology.* -Classical.* word'  (deps, rdeps)
  --scope statement|proof   axioms, deps, check: follow only references in types (needs edgetypes.u8) or all edges (default)
  --no-generated            hide compiler-generated names
  --no-boilerplate          hide instances, projections and coercions (needs flags.u8 in the store; otherwise an error)
  --format text|json|csv|dot   (--json is a shortcut for --format json)
  --limit <n>               max nodes for dot output (default 300)
  --store <dir-or-url>      default: $LEANAGE_STORE, else the Hugging Face store (cached in ~/.cache/leanage)

exit codes: 0 ok, 1 check failed / no path, 2 name missing or usage error
`

export async function main(argv: string[]): Promise<Result> {
  let parsed
  try {
    parsed = parseArgs({
      args: argv, allowPositionals: true,
      options: {
        filter: { type: 'string' }, 'no-generated': { type: 'boolean' }, 'no-boilerplate': { type: 'boolean' }, format: { type: 'string' }, json: { type: 'boolean' },
        forbid: { type: 'string', multiple: true }, store: { type: 'string' }, lib: { type: 'string' }, out: { type: 'string' }, dir: { type: 'string' }, limit: { type: 'string' }, scope: { type: 'string' }, help: { type: 'boolean', short: 'h' },
      },
    })
  } catch (e) {
    return { out: '', err: `${(e as Error).message}\n${USAGE}`, code: 2 }
  }
  const { values, positionals: [cmd, ...args] } = parsed
  if (values.help || !cmd) return { out: USAGE, err: '', code: values.help ? 0 : 2 }
  const format = values.json ? 'json' : (values.format ?? 'text')
  if (!['text', 'json', 'csv', 'dot'].includes(format)) return { out: '', err: `Unknown format: ${format}\n`, code: 2 }
  const o: Options = {
    ...defaultOptions, format: format as Options['format'], filter: values.filter ?? '', noGenerated: !!values['no-generated'], noBoilerplate: !!values['no-boilerplate'],
    forbid: (values.forbid ?? []).flatMap((s) => s.split(',')).filter(Boolean), limit: Number(values.limit ?? defaultOptions.limit),
  }
  if (values.scope !== undefined && !['statement', 'proof'].includes(values.scope)) return { out: '', err: `Unknown scope: ${values.scope}\n`, code: 2 }
  if (values.scope && !['axioms', 'deps', 'check', 'libs'].includes(cmd)) return { out: '', err: '--scope applies to axioms, deps and check\n', code: 2 }
  o.scope = values.scope as Options['scope']
  const need = cmd === 'path' ? 2 : cmd === 'libs' || cmd === 'report' ? 0 : 1
  if (!['axioms', 'deps', 'rdeps', 'path', 'check', 'index', 'libs', 'report'].includes(cmd) || args.length !== need) return { out: '', err: USAGE, code: 2 }
  if (cmd === 'index') {
    const r = indexLibrary(args[0], values.dir)
    return r.err ? { out: '', err: r.err, code: 2 } : { out: `Indexed ${r.modules} modules${r.focus ? ` (${r.focus} of interest)` : ''} into ${r.file}\n`, err: '', code: 0 }
  }
  const graph = await loadStore(values.store ?? process.env.LEANAGE_STORE ?? DEFAULT_STORE)
  let warn = ''
  if (values.lib) {
    try { warn = loadLibrary(graph, values.lib).join('') } catch (e) { return { out: '', err: `${(e as Error).message}\n`, code: 2 } }
  }
  if (o.noBoilerplate && !graph.hasFlags) return { out: '', err: '--no-boilerplate needs a store with flags.u8, and this one has none\n', code: 2 }
  if (o.scope === 'statement' && !graph.hasEdgeTypes) return { out: '', err: '--scope statement needs a store with edgetypes.u8, and this one has none\n', code: 2 }
  if (cmd === 'report') {
    if (!values.lib) return { out: '', err: 'report needs --lib <project>\n', code: 2 }
    const file = resolve(values.out ?? (values.lib.endsWith('.tsv') ? 'leanage-report.html' : `${values.lib}/.leanage/report.html`))
    const data = buildReport(graph, basename(resolve(values.lib.replace(/\.leanage\/library\.tsv$/, ''))))
    writeFileSync(file, renderReport(data))
    return { out: `Wrote ${file} (${data.decls.length} declarations)\n`, err: warn, code: 0 }
  }
  const r = ((): Result => {
    switch (cmd) {
      case 'axioms': return axiomsCmd(graph, args[0], o)
      case 'deps': return closureCmd(graph, args[0], 'dependencies', o)
      case 'rdeps': return closureCmd(graph, args[0], 'dependents', o)
      case 'path': return pathCmd(graph, args[0], args[1], o)
      case 'libs': return libsCmd(graph, o)
      default: return checkCmd(graph, args[0], o)
    }
  })()
  return { ...r, err: warn + r.err }
}

process.stdout.on('error', (e: NodeJS.ErrnoException) => { if (e.code !== 'EPIPE') throw e }) // `leanage deps x | head` closes the pipe early
main(process.argv.slice(2)).then(
  (r) => { process.stdout.write(r.out); process.stderr.write(r.err); process.exitCode = r.code },
  (e) => { process.stderr.write(`leanage: ${(e as Error).message}\n`); process.exitCode = 2 },
)
