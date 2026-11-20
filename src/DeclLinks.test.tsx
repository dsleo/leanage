import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { CopyNameButton, DeclLinks } from './DeclLinks'

afterEach(cleanup)
const commit = 'fc4f59e577feb1a4956671bc04ac18aaaf8cd842'

describe('DeclLinks', () => {
  it('shows docs and source links for a Mathlib declaration', () => {
    render(<DeclLinks module="Mathlib.Data.Nat.Prime.Defs" name="Nat.Prime" commit={commit} />)
    expect(screen.getByRole('link', { name: 'Docs for Nat.Prime' }).getAttribute('href')).toContain('Mathlib/Data/Nat/Prime/Defs.html#Nat.Prime')
    expect(screen.getByRole('link', { name: 'Source of Nat.Prime' }).getAttribute('href')).toContain(`/blob/${commit}/Mathlib/Data/Nat/Prime/Defs.lean`)
  })
  it('shows docs only for core Lean, nothing without a module', () => {
    const { container } = render(<DeclLinks module="Init.Prelude" name="Nat" commit={commit} />)
    expect(screen.queryByRole('link', { name: /Source of/ })).toBeNull()
    expect(screen.getByRole('link', { name: 'Docs for Nat' })).toBeTruthy()
    cleanup()
    const empty = render(<DeclLinks name="Nat" commit={commit} />)
    expect(empty.container.innerHTML).toBe('')
    expect(container).toBeTruthy()
  })
  it('has a copy button', () => {
    render(<CopyNameButton name="Nat.Prime" />)
    expect(screen.getByRole('button', { name: 'Copy Lean name Nat.Prime' })).toBeTruthy()
  })
})
