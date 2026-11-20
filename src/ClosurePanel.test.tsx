import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LocalGraph, type StoreFiles } from './localGraph'
import { ClosurePanel, ExportMenu } from './ClosurePanel'
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

  it('downloads the dependency closure in the chosen format', () => {
    render(<ExportMenu graph={small} rootName="Test.root" />)
    fireEvent.click(screen.getByRole('menuitem', { name: 'CSV' }))
    expect(downloadText).toHaveBeenCalledTimes(1)
    const [file, text] = vi.mocked(downloadText).mock.calls[0]
    expect(file).toBe('Test.root.deps.csv')
    expect(text).toContain('Test.mid')
    expect(text).not.toContain('Test.root.match_1')
  })
})

describe('ClosurePanel scope', () => {
  afterEach(cleanup)
  it('disables the statement scope without edge types', () => {
    render(<ClosurePanel graph={small} rootName="Test.root" />)
    expect((screen.getAllByRole('button', { name: 'Statement only' })[0] as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getAllByText(/no edge types/i).length).toBeGreaterThan(0)
  })

  it('statement scope drops the axiom reached only through the proof', () => {
    const graph = new LocalGraph(files({
      'Test.root': ['Test.mid', 'Nat.zero_add', 'Test.root.match_1'],
      'Test.mid': ['Classical.choice'],
      'Classical.choice': ['Nonempty'],
    }))
    // sorted ids: Classical.choice, Nat.zero_add, Nonempty, Test.mid, Test.root, Test.root.match_1
    // Test.mid -> Classical.choice (value); Test.root -> Nat.zero_add (type), Test.mid (value), match_1 (value); Classical.choice -> Nonempty (type)
    expect(graph.setEdgeTypes(Uint8Array.from([1, 2, 1, 2, 2]), { mathlib_commit: 'abc1234def' })).toBe(true)
    render(<ClosurePanel graph={graph} rootName="Test.root" />)
    expect(screen.getAllByRole('button', { name: 'Copy Classical.choice' }).length).toBeGreaterThan(0)
    fireEvent.click(screen.getAllByRole('button', { name: 'Statement only' })[0])
    expect(screen.getByText(/statement \(type\) of this declaration does not reach any axiom/)).toBeTruthy()
  })
})
