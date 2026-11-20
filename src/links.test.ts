import { describe, expect, it } from 'vitest'
import { docsUrl, sourceUrl } from './links'

const commit = 'fc4f59e577feb1a4956671bc04ac18aaaf8cd842'
describe('links', () => {
  it('builds docs urls for Mathlib and core modules', () => {
    expect(docsUrl('Mathlib.Data.Nat.Prime.Defs', 'Nat.Prime')).toBe('https://leanprover-community.github.io/mathlib4_docs/Mathlib/Data/Nat/Prime/Defs.html#Nat.Prime')
    expect(docsUrl('Init.Prelude', 'Nat')).toBe('https://leanprover-community.github.io/mathlib4_docs/Init/Prelude.html#Nat')
    expect(docsUrl('Lean.Elab.Term')).toBe('https://leanprover-community.github.io/mathlib4_docs/Lean/Elab/Term.html')
  })
  it('encodes special characters in the anchor', () => {
    expect(docsUrl('Mathlib.Order.Basic', "le_trans'")).toMatch(/#le_trans'$/)
    expect(docsUrl('Mathlib.Order.Basic', '«term_⁻¹\'o_»')).toBe('https://leanprover-community.github.io/mathlib4_docs/Mathlib/Order/Basic.html#%C2%ABterm_%E2%81%BB%C2%B9\'o_%C2%BB')
    expect(decodeURIComponent(docsUrl('Mathlib.Order.Basic', 'a b#c')!.split('#')[1])).toBe('a b#c')
  })
  it('returns null without a module', () => {
    expect(docsUrl(undefined, 'x')).toBeNull()
    expect(docsUrl('', 'x')).toBeNull()
  })
  it('links source only for modules in the mathlib4 repository', () => {
    expect(sourceUrl('Mathlib.Data.Nat.Prime.Defs', commit)).toBe(`https://github.com/leanprover-community/mathlib4/blob/${commit}/Mathlib/Data/Nat/Prime/Defs.lean`)
    expect(sourceUrl('Archive.Wiedijk100Theorems.AbelRuffini', commit)).toContain('/Archive/Wiedijk100Theorems/AbelRuffini.lean')
    for (const m of ['Init.Prelude', 'Std.Data.HashMap.Basic', 'Lean.Elab.Term', 'Batteries.Data.List.Basic']) expect(sourceUrl(m, commit)).toBeNull()
    expect(sourceUrl('Mathlib.Order.Basic', undefined)).toBeNull()
    expect(sourceUrl('Mathlib.Order.Basic', 'not-a-hash')).toBeNull()
  })
})
