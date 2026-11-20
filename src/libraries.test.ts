import { describe, expect, it } from 'vitest'
import { parseMode, tagOf } from './libraries'

describe('library tags', () => {
  it('tags Mathlib, TauCeti, Lean core and Batteries modules', () => {
    expect(tagOf('Mathlib.Data.Nat.Prime.Defs')).toBe('Mathlib')
    expect(tagOf('Archive.Wiedijk100Theorems.AbelRuffini')).toBe('Mathlib')
    expect(tagOf('TauCeti.Algebra.Lie.F4.ModularLattice')).toBe('TauCeti')
    for (const m of ['Init.Prelude', 'Std.Data.HashMap.Basic', 'Lean.Elab.Term']) expect(tagOf(m)).toBe('Lean core')
    expect(tagOf('Batteries.Data.List.Basic')).toBe('Batteries')
    expect(tagOf('Aesop.Main')).toBeNull()
  })
  it('tags TheoremGraph results, which have a source label but no module, as Mathlib', () => {
    expect(tagOf(undefined, 'Mathlib_v427')).toBe('Mathlib')
    expect(tagOf(undefined, 'arXiv:1234')).toBeNull()
    expect(tagOf(undefined, undefined)).toBeNull()
  })
  it('reads the library switch from the URL', () => {
    expect(parseMode('tauceti')).toBe('tauceti')
    expect(parseMode('mathlib')).toBe('mathlib')
    expect(parseMode(null)).toBe('mathlib')
    expect(parseMode('anything')).toBe('mathlib')
  })
})
