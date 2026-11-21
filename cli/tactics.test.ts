// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { addTactics, scanTactics, stripComments } from './tactics'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const scan = (src: string) => scanTactics(stripComments(src))

describe('tactic scan', () => {
  it('finds tactic steps, in bullets, after `by` and after `;`', () => {
    expect(scan('theorem a : p := by\n  induction n with\n  | zero => rfl\n  | succ k ih => simp')).toEqual(['induction'])
    expect(scan('theorem a : p := by\n  rcases h with x | y\n  · obtain ⟨z⟩ := x\n    exact z\n  · by_contra!\n    simp')).toEqual(['rcases', 'obtain', 'by_contra'])
    expect(scan('theorem a : p := by cases h; exact foo')).toEqual(['cases'])
  })
  it('ignores comments, strings, names and quotations', () => {
    expect(scan('-- induction n\ntheorem a : p := by\n  /- cases h -/\n  simp [induction_on, cases_foo]\n  exact "by_cases"')).toEqual([])
    expect(scan("theorem a : p := by\n  induction' n\n  simp")).toEqual([])
    expect(scan('macro "m" : tactic => `(tactic| cases h)')).toEqual([])
  })
  it('counts match only inside a tactic block', () => {
    expect(scan('def f : Nat → Nat\n  | 0 => 1\n  | n+1 => match n with | 0 => 2 | _ => 3')).toEqual([])
    expect(scan('theorem a : p := by\n  match h with\n  | .inl x => exact x\n  | .inr y => exact y')).toEqual(['match'])
  })
  it('adds a tactics column from the declaration lines, empty when unknown', () => {
    const dir = mkdtempSync(join(tmpdir(), 'leanage-tac-'))
    writeFileSync(join(dir, 'A.lean'), 'theorem x : p := by\n  induction n\n  simp\n\ntheorem y : q := by\n  simp\n')
    const raw = 'x\t\t\tt\tA\t-\t1-3\ny\t\t\tt\tA\t-\t5-6\nz\t\t\tt\tA\t-\t\n'
    const out = addTactics(raw, dir, new Map([['A', 'A.lean']])).split('\n')
    expect(out[0].split('\t')[7]).toBe('induction')
    expect(out[1].split('\t')[7]).toBe('-')
    expect(out[2].split('\t')[7]).toBe('')
  })
})
