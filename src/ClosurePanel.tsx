import { useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import type { LocalGraph, Scope } from './localGraph'
import { applyFilter, axiomAudit, closureRows, collapsePath, downloadText, parseFilter, toCsv, toDot, toJson } from './closureData'
import './closure.css'

function NameButton({ name, onCopy }: { name: string; onCopy: (name: string) => void }) {
  return <button type="button" className="closure-name" title="Copy Lean name" aria-label={`Copy ${name}`} onClick={() => onCopy(name)}>{name}</button>
}

function ScopeControl({ scope, onChange, available, name }: { scope: Scope; onChange: (scope: Scope) => void; available: boolean; name: string }) {
  return <div className="closure-scope-row">
    <div role="group" aria-label={`Scope (${name})`} className="closure-scope">
      <button type="button" className="closure-button" aria-pressed={scope === 'proof'} onClick={() => onChange('proof')}>Whole proof</button>
      <button type="button" className="closure-button" aria-pressed={scope === 'statement'} disabled={!available} onClick={() => onChange('statement')}>Statement only</button>
    </div>
    {!available && <span className="closure-help" id={`${name}-note`}>Unavailable: this store has no edge types.</span>}
  </div>
}

export function ClosurePanel({ graph, rootName }: { graph: LocalGraph; rootName: string }) {
  const rootId = graph.id(rootName)
  const [copied, setCopied] = useState('')
  const [scopeChoice, setScope] = useState<Scope>('proof')
  const scope: Scope = scopeChoice === 'statement' && graph.hasEdgeTypes ? 'statement' : 'proof'
  const audit = useMemo(() => (rootId === undefined ? [] : axiomAudit(graph, rootId, scope)), [graph, rootId, scope])
  if (rootId === undefined) return null

  const copy = (name: string) => {
    void Promise.resolve(navigator.clipboard?.writeText(name)).catch(() => {})
    setCopied(name)
  }

  return <section className="closure-panel" aria-label={`Closure of ${rootName}`}>
    <p className="eyebrow">Dependency closure</p>
    <p className="closure-live" role="status" aria-live="polite">{copied && `Copied ${copied}`}</p>

    <details open className="closure-section">
      <summary><h3>Axioms</h3></summary>
      <ScopeControl scope={scope} onChange={setScope} available={graph.hasEdgeTypes} name="axioms-scope" />
      {audit.length === 0
        ? <p className="closure-note">{scope === 'statement' ? 'No axioms: the statement (type) of this declaration does not reach any axiom through type references.' : 'No axioms: this declaration does not depend on any axiom at this Mathlib commit.'}</p>
        : <>
          <p className="closure-note">{scope === 'statement'
            ? 'Shortest path to each axiom that the claim itself reaches: references in its type, then, for each definition it mentions, that definition\u2019s type and body. Proofs of theorems are not followed.'
            : <>Shortest dependency path to each axiom. This equals what <code>#print axioms</code> reports.</>}</p>
          <ul className="closure-axioms">{audit.map((item) => <li key={item.axiom}>
            <strong><NameButton name={item.axiom} onCopy={copy} /></strong>
            <ol className="closure-path" aria-label={`Path to ${item.axiom}`}>
              {collapsePath(item.path).map((name, i) => <li key={i}>{i > 0 && <span aria-hidden="true">→ </span>}<NameButton name={name} onCopy={copy} /></li>)}
            </ol>
          </li>)}</ul>
        </>}
    </details>
  </section>
}

/** One download icon with a format menu; exports the whole-proof closure without compiler-generated names. */
export function ExportMenu({ graph, rootName }: { graph: LocalGraph; rootName: string }) {
  const rootId = graph.id(rootName)
  if (rootId === undefined) return null
  const commit = (graph.meta.mathlib_commit ?? 'unknown').slice(0, 7)
  const rows = () => applyFilter(closureRows(graph, rootId, 'dependencies', 'proof'), parseFilter('', true, false))
  const run = (ext: 'csv' | 'json' | 'dot') => {
    const file = `${rootName}.deps.${ext}`
    if (ext === 'csv') downloadText(file, toCsv(rows()), 'text/csv')
    else if (ext === 'json') downloadText(file, toJson(graph, rootName, rows()), 'application/json')
    else downloadText(file, toDot(graph, rows()), 'text/vnd.graphviz')
  }
  return <details className="export-menu">
    <summary aria-label="Download the dependency closure" title="Download the dependency closure"><Download size={18} aria-hidden="true" /></summary>
    <div className="export-list" role="menu">
      <button type="button" role="menuitem" onClick={() => run('csv')}>CSV</button>
      <button type="button" role="menuitem" onClick={() => run('json')}>JSON</button>
      <button type="button" role="menuitem" onClick={() => run('dot')}>Graphviz DOT</button>
      <p className="closure-help">Dependency closure of the whole proof, compiler-generated names left out, references untyped. Mathlib {commit}.</p>
    </div>
  </details>
}

export default ClosurePanel
