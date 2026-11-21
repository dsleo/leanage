import { createInterface } from 'node:readline/promises'
import type { Readable, Writable } from 'node:stream'
import type { LocalGraph } from '../src/localGraph'
import { axiomsCmd, closureCmd, pathCmd, type Options } from './commands'

const HELP = 'Commands at the target prompt: a name = path to it · empty = axioms and size of the closure · :scope statement|proof · :new = another result · :quit'

/**
 * The webapp's flow in a terminal: 1. search and confirm a result of interest, 2. ask a question about it
 * (no target: axioms and closure size; with a target: the witness path), 3. repeat with another target or result.
 */
export async function explore(graph: LocalGraph, o: Options, input: Readable, output: Writable): Promise<void> {
  const rl = createInterface({ input })
  const lines = rl[Symbol.asyncIterator]()
  // Lines are read through the iterator so piped input is not lost; end of input counts as :quit.
  const ask = async (prompt: string) => { output.write(prompt); const r = await lines.next(); return r.done ? ':quit' : r.value }
  const say = (s: string) => output.write(s + '\n')
  const opts = { ...o }
  try {
    for (;;) {
      // 1. Result of interest: a few candidates, the user confirms one.
      const q = (await ask('Result of interest (Lean name or part of it, :quit): ')).trim()
      if (!q || q === ':quit') return
      const found = graph.id(q) !== undefined ? [q] : graph.search(q, 5)
      if (!found.length) { say(`No declaration matches "${q}".`); continue }
      let name = found[0]
      if (found.length > 1 || name !== q) {
        found.forEach((n, i) => say(`  ${i + 1}. ${n}   ${graph.module(graph.id(n)!)}`))
        const pick = (await ask(`Confirm which one? [1-${found.length}, Enter = none] `)).trim()
        const k = Number(pick)
        if (!k || k < 1 || k > found.length) continue
        name = found[k - 1]
      }
      const id = graph.id(name)!
      say(`Result of interest: ${name}  (${graph.isLibrary(id) ? 'library' : 'Mathlib'} · ${graph.module(id)})`)
      say(HELP)
      // 2. Questions about the confirmed result.
      for (;;) {
        const t = (await ask(`[${name}] target: `)).trim()
        if (t === ':quit') return
        if (t === ':new') break
        if (t.startsWith(':scope')) { const s = t.split(/\s+/)[1]; if (s === 'statement' || s === 'proof') { opts.scope = s; say(`Scope: ${s}`) } else say('Use :scope statement or :scope proof'); continue }
        if (!t) {
          const a = axiomsCmd(graph, name, opts)
          const n = JSON.parse(closureCmd(graph, name, 'dependencies', { ...opts, format: 'json' }).out).count
          say((a.out + a.err).trimEnd()); say(`${n} dependencies in the closure.`)
        } else {
          const to = graph.id(t) !== undefined ? t : graph.search(t, 1)[0]
          if (!to) { say(`No declaration matches "${t}".`); continue }
          const r = pathCmd(graph, name, to, opts)
          say((r.out || r.err || `No path from ${name} to ${to}.`).trimEnd())
        }
      }
    }
  } finally { rl.close() }
}
