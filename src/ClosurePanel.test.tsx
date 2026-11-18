import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LocalGraph, type StoreFiles } from './localGraph'
import { ClosurePanel } from './ClosurePanel'
import { downloadText } from './closureData'

vi.mock('./closureData', async (original) => ({ ...(await original<typeof import('./closureData')>()), downloadText: vi.fn() }))

function varint(values: number[]): Uint8Array {
  const out: number[] = []
  for (let v of values) {
    while (v >= 128) { out.push((v & 127) | 128); v = Math.floor(v / 128) }
    out.push(v)
  }
  return Uint8Array.from(out)
}

function files(edges: Record<string, string[]>): StoreFiles {
  const names = [...new Set(Object.entries(edges).flat(2))].sort()
  const id = new Map(names.map((name, index) => [name, index]))
  const deps = names.map((name) => (edges[name] ?? []).map((dep) => id.get(dep)!).sort((a, b) => a - b))
  const targets = deps.flatMap((list) => list.map((value, index) => (index ? value - list[index - 1] : value)))
  return { names: names.join('\n') + '\n', modules: 'M\n', nodeModule: new Uint8Array(names.length * 4), degrees: varint(deps.map((list) => list.length)), targets: varint(targets), meta: { nodes: names.length, edges: deps.flat().length, mathlib_commit: 'abc1234def' } }
}

const small = new LocalGraph(files({
  'Test.root': ['Test.mid', 'Nat.zero_add', 'Test.root.match_1'],
  'Test.mid': ['Classical.choice'],
  'Test.user': ['Test.root'],
  'Classical.choice': ['Nonempty'],
}))
const clean = new LocalGraph(files({ 'Test.pure': ['Nat.zero_add'] }))
const chain = (() => {
  const names = Array.from({ length: 450 }, (_, i) => `Chain.root.match_${String(i).padStart(3, '0')}`)
  const edges: Record<string, string[]> = { 'Chain.root': [names[0]] }
  names.forEach((name, i) => { edges[name] = i + 1 < names.length ? [names[i + 1]] : ['Nat.zero'] })
  return new LocalGraph(files(edges))
})()
const rowCount = () => document.querySelectorAll('.closure-table tbody tr').length

afterEach(() => { cleanup(); vi.clearAllMocks() })

describe('ClosurePanel', () => {
  it('lists axioms with a path, or states there are none', () => {
    render(<ClosurePanel graph={small} rootName="Test.root" />)
    const axioms = document.querySelector('.closure-axioms')!
    expect(within(axioms as HTMLElement).getAllByRole('button', { name: 'Copy Classical.choice' }).length).toBe(2)
    expect(screen.getByText(/#print axioms/)).toBeTruthy()
    cleanup()
    render(<ClosurePanel graph={clean} rootName="Test.pure" />)
    expect(screen.getByText(/No axioms: this declaration does not depend on any axiom/)).toBeTruthy()
  })

  it('renders nothing for an unknown declaration', () => {
    const { container } = render(<ClosurePanel graph={small} rootName="Nope" />)
    expect(container.textContent).toBe('')
  })

  it('filters the table and lists direct dependents', async () => {
    render(<ClosurePanel graph={small} rootName="Test.root" />)
    const before = rowCount()
    fireEvent.change(screen.getByLabelText('Filter'), { target: { value: 'zero_add' } })
    await vi.waitFor(() => expect(rowCount()).toBe(1))
    expect(before).toBeGreaterThan(1)
    expect(screen.getByText(/1 declaration depends/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Copy Test.user' })).toBeTruthy()
  })

  it('toggles compiler-generated names', () => {
    render(<ClosurePanel graph={small} rootName="Test.root" />)
    const hidden = rowCount()
    fireEvent.click(screen.getByLabelText(/Hide compiler-generated names/))
    expect(rowCount()).toBe(hidden + 1)
  })

  it('caps rows at 200 and shows more on request', () => {
    render(<ClosurePanel graph={chain} rootName="Chain.root" />)
    fireEvent.click(screen.getByLabelText(/Hide compiler-generated names/))
    expect(rowCount()).toBe(200)
    fireEvent.click(screen.getByRole('button', { name: 'Show 200 more' }))
    expect(rowCount()).toBe(400)
  })

  it('exports the filtered rows', () => {
    render(<ClosurePanel graph={small} rootName="Test.root" />)
    fireEvent.click(screen.getByRole('button', { name: 'CSV' }))
    expect(downloadText).toHaveBeenCalledWith('Test.root.deps.csv', expect.stringContaining('Test.mid'), 'text/csv')
    fireEvent.click(screen.getByRole('button', { name: 'Graphviz DOT' }))
    expect(vi.mocked(downloadText).mock.calls[1][0]).toBe('Test.root.deps.dot')
  })
})
