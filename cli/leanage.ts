#!/usr/bin/env tsx
import { parseArgs } from 'node:util'
import { axiomsCmd, checkCmd, closureCmd, defaultOptions, pathCmd, type Options, type Result } from './commands'
import { DEFAULT_STORE, loadStore } from './store'

const USAGE = `leanage <command> [options]

  axioms <name>             axioms reached by <name>, with evidence paths
  deps <name>               transitive dependencies
  rdeps <name>              transitive dependents
  path <from> <to>          shortest dependency path (exit 1 if none)
  check <name> --forbid X   exit 1 if the closure reaches X (repeatable; 'Pkg.*' prefix allowed)

options:
  --filter '<expr>'         e.g. 'Topology.* -Classical.* word'  (deps, rdeps)
  --no-generated            hide compiler-generated names
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
        filter: { type: 'string' }, 'no-generated': { type: 'boolean' }, format: { type: 'string' }, json: { type: 'boolean' },
        forbid: { type: 'string', multiple: true }, store: { type: 'string' }, limit: { type: 'string' }, help: { type: 'boolean', short: 'h' },
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
    ...defaultOptions, format: format as Options['format'], filter: values.filter ?? '', noGenerated: !!values['no-generated'],
    forbid: (values.forbid ?? []).flatMap((s) => s.split(',')).filter(Boolean), limit: Number(values.limit ?? defaultOptions.limit),
  }
  const need = cmd === 'path' ? 2 : 1
  if (!['axioms', 'deps', 'rdeps', 'path', 'check'].includes(cmd) || args.length !== need) return { out: '', err: USAGE, code: 2 }
  const graph = await loadStore(values.store ?? process.env.LEANAGE_STORE ?? DEFAULT_STORE)
  switch (cmd) {
    case 'axioms': return axiomsCmd(graph, args[0], o)
    case 'deps': return closureCmd(graph, args[0], 'dependencies', o)
    case 'rdeps': return closureCmd(graph, args[0], 'dependents', o)
    case 'path': return pathCmd(graph, args[0], args[1], o)
    default: return checkCmd(graph, args[0], o)
  }
}

main(process.argv.slice(2)).then(
  (r) => { process.stdout.write(r.out); process.stderr.write(r.err); process.exitCode = r.code },
  (e) => { process.stderr.write(`leanage: ${(e as Error).message}\n`); process.exitCode = 2 },
)
