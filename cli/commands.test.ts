// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { gzipSync } from 'node:zlib'
import { LocalGraph } from '../src/localGraph'
import { axiomsCmd, checkCmd, closureCmd, defaultOptions, pathCmd } from './commands'
import { loadStore } from './store'
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
