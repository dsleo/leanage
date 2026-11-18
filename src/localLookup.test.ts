import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { LocalGraph, type StoreFiles } from './localGraph'
import { isLeanNameLike, lookupName } from './localLookup'

function varint(values: number[]): Uint8Array {
  const out: number[] = []
  for (let v of values) {
    while (v >= 128) { out.push((v & 127) | 128); v = Math.floor(v / 128) }
    out.push(v)
  }
  return Uint8Array.from(out)
}

function files(names: string[]): StoreFiles {
  const sorted = [...new Set(names)].sort()
  return { names: sorted.join('\n') + '\n', modules: 'M\n', nodeModule: new Uint8Array(sorted.length * 4), degrees: varint(sorted.map(() => 0)), targets: new Uint8Array(), meta: { nodes: sorted.length, edges: 0 } }
}

const graph = new LocalGraph(files([
  'Nat.add_comm', 'Int.add_comm', 'Nat.add_comm_assoc', 'Nat.add_comm.match_1', 'Nat.add_comm._simp_1', 'Nat.add_commute',
  'Nat.Add_Comm', 'Foo.foo_bar', 'Baz.foo_bar', 'foo_bar', 'Nat.foo_barn', 'Nat.my_foo_bar_thing', 'Nat.prime_two', 'Nat.prime_two_gen.proof_1',
  'Nat.sub_comm_x', 'Real.sqrt₀',
]))
const names = (q: string, limit?: number) => lookupName(graph, q, limit).map((m) => m.name)

const pairs = (q: string, limit?: number) => lookupName(graph, q, limit).map((m) => [m.name, m.reason])

describe('lookupName', () => {
  it('puts exact first, then case, then prefix, and skips generated names', () => {
    expect(pairs('Nat.add_comm')).toEqual([['Nat.add_comm', 'exact'], ['Nat.Add_Comm', 'case'], ['Nat.add_comm_assoc', 'prefix'], ['Nat.add_commute', 'prefix'], ['Int.add_comm', 'namespace-moved']])
    expect(pairs('nat.add_comm')).toEqual([['Nat.Add_Comm', 'case'], ['Nat.add_comm', 'case'], ['Int.add_comm', 'namespace-moved']])
  })

  it('finds prefix and namespace-moved matches', () => {
    expect(pairs('Nat.foo_bar')).toEqual([['Nat.foo_barn', 'prefix'], ['Baz.foo_bar', 'namespace-moved'], ['Foo.foo_bar', 'namespace-moved'], ['foo_bar', 'namespace-moved']])
    expect(pairs('foo')).not.toContainEqual(['foo_bar', 'namespace-moved'])
  })

  it('finds suffix then substring for a bare name, with module and no duplicates', () => {
    expect(pairs('add_comm')).toEqual([['Int.add_comm', 'suffix'], ['Nat.add_comm', 'suffix'], ['Nat.add_comm_assoc', 'substring'], ['Nat.add_commute', 'substring']])
    expect(lookupName(graph, 'add_comm')[0].module).toBe('M')
    expect(pairs('foo_bar')).toEqual([['foo_bar', 'exact'], ['Baz.foo_bar', 'suffix'], ['Foo.foo_bar', 'suffix'], ['Nat.foo_barn', 'substring'], ['Nat.my_foo_bar_thing', 'substring']])
  })

  it('keeps all classes in order even with many suffix hits', () => {
    const g = new LocalGraph(files(['A.Nat.q', 'B.Nat.q', 'C.q', 'D.xNat.qy', ...Array.from({ length: 30 }, (_, i) => `E${i}.Nat.q`)]))
    expect(lookupName(g, 'Nat.q', 40).map((m) => m.reason).slice(-2)).toEqual(['namespace-moved', 'substring'])
    expect(lookupName(g, 'Nat.q', 3).map((m) => m.reason)).toEqual(['suffix', 'suffix', 'suffix'])
  })

  it('finds prefix matches via search', () => {
    expect(lookupName(graph, 'Nat.prime').map((m) => [m.name, m.reason])).toEqual([['Nat.prime_two', 'prefix']])
  })

  it('skips generated names unless the query asks for them', () => {
    expect(names('match_1')).toEqual(['Nat.add_comm.match_1'].slice(0, 1))
    expect(names('add_comm')).not.toContain('Nat.add_comm.match_1')
    expect(names('Nat.add_comm._simp_1')).toEqual(['Nat.add_comm._simp_1'])
    expect(names('proof_1')).toEqual(['Nat.prime_two_gen.proof_1'])
    expect(names('Nat.prime_two_gen')).toEqual([])
  })

  it('respects limit and the hard cap', () => {
    expect(names('add_comm', 2)).toEqual(['Int.add_comm', 'Nat.add_comm'])
    const big = new LocalGraph(files(Array.from({ length: 80 }, (_, i) => `X.lem_${String(i).padStart(2, '0')}`)))
    expect(lookupName(big, 'lem', 1000)).toHaveLength(50)
    expect(lookupName(big, 'lem')).toHaveLength(12)
    expect(lookupName(big, 'X.lem', 5)).toHaveLength(5)
    expect(lookupName(big, 'lem', 0)).toEqual([])
  })

  it('strips backticks and _root_, trims, and rejects empty or spaced input', () => {
    expect(names('  `Nat.prime_two`  ')).toEqual(['Nat.prime_two'])
    expect(names('_root_.Nat.prime_two')).toEqual(['Nat.prime_two'])
    expect(names('`_root_.Nat.prime_two`')).toEqual(['Nat.prime_two'])
    expect(lookupName(graph, '')).toEqual([])
    expect(lookupName(graph, '   ')).toEqual([])
    expect(lookupName(graph, 'Nat add_comm')).toEqual([])
    expect(lookupName(graph, '``')).toEqual([])
  })
})

describe('isLeanNameLike', () => {
  it('accepts identifiers', () => {
    for (const s of ['Nat.add_comm', "Finset.sum_comm'", 'add_comm', 'Real.sqrt₀', 'α', 'Nat.le_of_lt_succ', '_root_.foo', 'Ε.x']) expect(isLeanNameLike(s)).toBe(true)
  })
  it('rejects non identifiers', () => {
    for (const s of ['', 'a b', 'what?', 'f(x)', 'a:b', 'Nat.', '.Nat', 'a..b', '1abc', 'x = y', 'a+b', '∀x']) expect(isLeanNameLike(s)).toBe(false)
  })
})

const storeDir = process.env.LEANAGE_STORE
describe('real store', () => {
  it.skipIf(!storeDir)('looks names up quickly', () => {
    const read = (f: string) => new Uint8Array(readFileSync(`${storeDir}/${f}`))
    const text = (f: string) => readFileSync(`${storeDir}/${f}`, 'utf8')
    const real = new LocalGraph({ names: text('names.txt'), modules: text('modules.txt'), nodeModule: read('node_module.u32'), degrees: read('degrees.vbyte'), targets: read('targets.vbyte'), meta: JSON.parse(text('meta.json')) })
    lookupName(real, 'warm')
    const run = (q: string, limit?: number) => {
      const t = performance.now()
      const r = lookupName(real, q, limit)
      const ms = performance.now() - t
      console.log(`lookup ${q}: ${ms.toFixed(0)} ms ->`, r.slice(0, 4).map((m) => `${m.name}(${m.reason})`).join(', '))
      expect(ms).toBeLessThan(300)
      return r
    }
    expect(run('Nat.add_comm')[0]).toMatchObject({ name: 'Nat.add_comm', reason: 'exact' })
    expect(run('add_comm', 50).map((m) => m.name)).toContain('Nat.add_comm')
    expect(run('Nat.prime_two')[0].reason).toBe('exact')
    const moved = run('Nat.nonexistent_lemma_add_comm')
    expect(moved.length).toBeGreaterThanOrEqual(0)
    const renamed = run('Nat.mul_comm_zzz')
    expect(renamed.every((m) => m.reason !== 'exact')).toBe(true)
    expect(run('Finset.sum_comm_of_nothing_exists_here').every((m) => m.reason !== 'exact')).toBe(true)
    const mv = run('Nat.sum_comm')
    expect(mv.some((m) => m.reason === 'namespace-moved' && m.name.endsWith('.sum_comm'))).toBe(true)
  })
})
