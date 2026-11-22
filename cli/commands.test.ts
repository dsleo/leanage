// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { gzipSync } from 'node:zlib'
import { LocalGraph } from '../src/localGraph'
import { axiomsCmd, checkCmd, closureCmd, defaultOptions, libsCmd, pathCmd } from './commands'
import { loadStore } from './store'
import { explore } from './explore'
import { Readable, Writable } from 'node:stream'
import { buildReport, renderReport } from './report'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Sorted names: 0 A.thm -> 1 A.lem, 2 Classical.choice ; 1 -> 3 A.lem._f ; 3 -> 2 ; 4 Nat.add_comm (no deps), 5 propext
const names = ['A.lem', 'A.lem._f', 'A.thm', 'Classical.choice', 'Nat.add_comm', 'propext']
const edges: number[][] = [[1], [3], [0], [], [], []]
const varint = (n: number) => { const o: number[] = []; do { let b = n & 0x7f; n >>>= 7; if (n) b |= 0x80; o.push(b) } while (n); return o }
function build() {
  const nodeModule = new Uint8Array(names.length * 4)
  const deg: number[] = []
  const tgt: number[] = []
  edges.forEach((e) => { deg.push(...varint(e.length)); let prev = 0; e.slice().sort((a, b) => a - b).forEach((t) => { tgt.push(...varint(t - prev)); prev = t }) })
  return {
    names: names.join('\n') + '\n', modules: 'M\n', nodeModule, degrees: new Uint8Array(deg), targets: new Uint8Array(tgt),
    meta: { nodes: names.length, edges: edges.flat().length },
  }
}
const g = new LocalGraph(build())
const o = defaultOptions

describe('cli --no-boilerplate', () => {
  it('drops flagged instances and coercions from deps', () => {
    const h = new LocalGraph(build())
    const flags = new Uint8Array(names.length)
    flags[h.id('A.lem')!] = 1
    h.setFlags(flags, {})
    expect(closureCmd(h, 'A.thm', 'dependencies', { ...defaultOptions, noBoilerplate: true }).out).not.toContain('A.lem\t')
    expect(closureCmd(h, 'A.thm', 'dependencies', defaultOptions).out).toContain('A.lem\t')
  })
})

describe('cli commands', () => {
  it('axioms reports collapsed evidence path', () => {
    const r = axiomsCmd(g, 'A.thm', o)
    expect(r.code).toBe(0)
    expect(r.out).toContain('Classical.choice')
    expect(r.out).toContain('A.thm -> A.lem -> Classical.choice')
    expect(axiomsCmd(g, 'Nat.add_comm', o).out).toContain('no axioms')
  })
  it('missing names exit 2 with suggestions', () => {
    const r = axiomsCmd(g, 'A.le', o)
    expect(r.code).toBe(2)
    expect(r.err).toContain('A.lem')
  })
  it('check exits 1 on violation, 0 otherwise, 2 on missing', () => {
    expect(checkCmd(g, 'A.thm', { ...o, forbid: ['Classical.choice'] }).code).toBe(1)
    expect(checkCmd(g, 'Nat.add_comm', { ...o, forbid: ['Classical.choice'] }).code).toBe(0)
    expect(checkCmd(g, 'Nope', { ...o, forbid: ['x'] }).code).toBe(2)
    expect(checkCmd(g, 'A.thm', { ...o, forbid: ['Classical.*'] }).code).toBe(1)
  })
  it('deps/rdeps with filters and formats', () => {
    expect(closureCmd(g, 'A.thm', 'dependencies', o).out).toContain('A.lem._f')
    expect(closureCmd(g, 'A.thm', 'dependencies', { ...o, noGenerated: true }).out).not.toContain('_f')
    expect(closureCmd(g, 'A.thm', 'dependencies', { ...o, filter: '-Classical.*' }).out).not.toContain('Classical')
    expect(closureCmd(g, 'Classical.choice', 'dependents', o).out).toContain('A.thm')
    expect(closureCmd(g, 'A.thm', 'dependencies', { ...o, format: 'csv' }).out.startsWith('name,module')).toBe(true)
    expect(JSON.parse(closureCmd(g, 'A.thm', 'dependencies', { ...o, format: 'json' }).out).count).toBe(3)
    expect(closureCmd(g, 'A.thm', 'dependencies', { ...o, format: 'dot' }).out).toContain('digraph')
  })
  it('path', () => {
    expect(pathCmd(g, 'A.thm', 'Classical.choice', o).out).toBe('A.thm -> A.lem -> Classical.choice\n')
    expect(pathCmd(g, 'Nat.add_comm', 'propext', o).code).toBe(1)
  })
  it('loads a store directory with gz files', async () => {
    const d = mkdtempSync(join(tmpdir(), 'leanage-'))
    const b = build()
    const put = (f: string, data: string | Uint8Array) => writeFileSync(join(d, f + '.gz'), gzipSync(data))
    put('names.txt', b.names); put('modules.txt', b.modules); put('node_module.u32', b.nodeModule)
    put('degrees.vbyte', b.degrees); put('targets.vbyte', b.targets); put('meta.json', JSON.stringify(b.meta))
    expect((await loadStore(d)).size).toBe(names.length)
  })
})

describe('library layer', () => {
  // Base: Nat.add_comm (no deps), propext, sorryAx. Library: Lib.helper -> Nat.add_comm (value); Lib.main -> Lib.helper (value), Lib.stmt (type); Lib.bad -> sorryAx (value).
  const base = ['Nat.add_comm', 'propext', 'sorryAx']
  const mk = () => new LocalGraph({ names: base.join('\n') + '\n', modules: 'Init\n', nodeModule: new Uint8Array(12), degrees: new Uint8Array([0, 0, 0]), targets: new Uint8Array(0), meta: { nodes: 3, edges: 0 } })
  const decls = [
    { name: 'Lib.helper', module: 'Lib.A', kind: 't', typeDeps: [], valueDeps: ['Nat.add_comm', 'Other.Pkg.x'] },
    { name: 'Lib.main', module: 'Lib.B', kind: 't', typeDeps: ['Lib.stmt'], valueDeps: ['Lib.helper'] },
    { name: 'Lib.stmt', module: 'Lib.A', kind: 'd', typeDeps: [], valueDeps: [] },
    { name: 'Lib.bad', module: 'Lib.B', kind: 't', typeDeps: [], valueDeps: ['sorryAx'] },
  ]
  const g2 = mk()
  g2.extend(decls)

  it('puts library ids after the store and resolves names across layers', () => {
    expect(g2.libraryStart).toBe(3)
    expect(g2.id('Lib.main')).toBe(4)
    expect(g2.id('Nat.add_comm')).toBe(0)
    expect(g2.isLibrary(4)).toBe(true)
    expect(g2.isLibrary(0)).toBe(false)
    expect(g2.libraryUnresolved).toBe(1)
    expect(g2.module(g2.id('Lib.bad')!)).toBe('Lib.B')
  })

  it('finds paths and dependents across the boundary', () => {
    const p = pathCmd(g2, 'Lib.main', 'Nat.add_comm', o)
    expect(p.out).toContain('[library] Lib.B')
    expect(p.out).toContain('[Mathlib] Init')
    expect(closureCmd(g2, 'Nat.add_comm', 'dependents', o).out).toContain('Lib.main')
  })

  it('reports sorryAx for the unfinished library theorem only', () => {
    expect(axiomsCmd(g2, 'Lib.bad', o).out).toContain('sorryAx')
    expect(axiomsCmd(g2, 'Lib.main', o).out).toContain('no axioms')
    const libs = libsCmd(g2, o).out.split('\n').filter(Boolean)
    expect(libs).toEqual(['Lib.helper\tLib.A\t', 'Lib.bad\tLib.B\tsorryAx', 'Lib.main\tLib.B\t'])
  })

  it('keeps search and base lookups working', () => {
    expect(g2.search('Lib.', 10)).toContain('Lib.stmt')
    expect(g2.search('Nat.', 10)).toEqual(['Nat.add_comm'])
    expect(g2.id('missing')).toBeUndefined()
  })

  it('builds report data: the library first, then its closure, with statement bits and a self-contained page', () => {
    const r = buildReport(g2, 'Lib')
    expect(r.nLib).toBe(4)
    expect(r.names.slice(0, 4).sort()).toEqual(['Lib.bad', 'Lib.helper', 'Lib.main', 'Lib.stmt'])
    expect(r.names).toContain('Nat.add_comm')
    expect(r.names).toContain('sorryAx')
    expect(r.focus.length).toBe(4)
    expect(r.kinds).toHaveLength(4)
    const html = renderReport(r)
    expect(html).toContain('"Lib.main"')
    expect(html).not.toContain('/*DATA*/null')
  })

  it('embeds tactics for store nodes and library nodes in the report', () => {
    const h = mk()
    // store nodes: Nat.add_comm (covered, induction), propext (covered, none), sorryAx (unknown)
    const bytes = new Uint8Array(6); const dv = new DataView(bytes.buffer)
    dv.setUint16(0, (1 << 15) | 1, true); dv.setUint16(2, 1 << 15, true); dv.setUint16(4, 0, true)
    expect(h.setTactics(bytes, { bits: { '0': 'induction' } })).toBe(true)
    h.extend([
      { name: 'Lib.t', module: 'Lib.A', kind: 't', typeDeps: [], valueDeps: ['Nat.add_comm'], tactics: ['by_contra'] },
      { name: 'Lib.u', module: 'Lib.A', kind: 't', typeDeps: [], valueDeps: ['Lib.t'] },
    ])
    const r = buildReport(h, 'Lib')
    const at = (n: string) => r.tac[r.names.indexOf(n)]
    expect(at('Lib.t')).toBe('by_contra')
    expect(at('Nat.add_comm')).toBe('induction')
    expect(at('Lib.u')).toBeUndefined() // no tactic data is not the same as none: nothing is embedded
    expect(at('propext')).toBeUndefined()
  })

  it('applies library flags and keeps source lines', () => {
    const h = mk()
    h.setFlags(new Uint8Array(3), {})
    h.extend([
      { name: 'Lib.inst', module: 'Lib.A', kind: 'd', typeDeps: [], valueDeps: [], flags: 'i', line: 7 },
      { name: 'Lib.plain', module: 'Lib.A', kind: 'd', typeDeps: [], valueDeps: [], flags: '', line: 9 },
      { name: 'Lib.old', module: 'Lib.A', kind: 'd', typeDeps: [], valueDeps: [] },
    ])
    expect(h.isBoilerplate(h.id('Lib.inst')!)).toBe(true)
    expect(h.isBoilerplate(h.id('Lib.plain')!)).toBe(false)
    expect(h.flagsOf(h.id('Lib.old')!)).toBeNull()
    expect(h.libraryLine(h.id('Lib.inst')!)).toBe(7)
    expect(h.libraryLine(0)).toBeUndefined()
  })
})

describe('explore', () => {
  it('confirms a result, then answers with and without a target', async () => {
    let out = ''
    const sink = new Writable({ write(c, _e, cb) { out += c; cb() } })
    await explore(g, o, Readable.from(['A.thm\n', '\n', 'Classical.choice\n', ':quit\n']), sink)
    expect(out).toContain('Result of interest: A.thm')
    expect(out).toContain('Classical.choice')
    expect(out).toContain('A.thm -> A.lem -> Classical.choice')
  })
})
