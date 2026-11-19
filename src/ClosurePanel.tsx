import { Fragment, useDeferredValue, useEffect, useMemo, useState } from 'react'
import type { LocalGraph } from './localGraph'
import {
  applyFilter, axiomAudit, closureRows, collapsePath, downloadText, groupByModule, parseFilter, toCsv, toDot, toJson,
  type ClosureRow,
} from './closureData'
import { moduleCsv, moduleDot, moduleGraph, moduleGroup, moduleJson } from './moduleView'
import './closure.css'

const PAGE = 200
const byDepthName = (a: ClosureRow, b: ClosureRow) => a.depth - b.depth || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)

function NameButton({ name, onCopy }: { name: string; onCopy: (name: string) => void }) {
  return <button type="button" className="closure-name" title="Copy Lean name" aria-label={`Copy ${name}`} onClick={() => onCopy(name)}>{name}</button>
}

function RowTable({ rows, label, onCopy }: { rows: ClosureRow[]; label: string; onCopy: (name: string) => void }) {
  return <div className="closure-scroll" tabIndex={0} role="region" aria-label={label}>
    <table className="closure-table">
      <thead><tr><th scope="col">Name</th><th scope="col">Module</th><th scope="col" className="num">Depth</th></tr></thead>
      <tbody>{rows.map((row) => <tr key={row.id}>
        <td><NameButton name={row.name} onCopy={onCopy} /></td><td><code>{row.module}</code></td><td className="num">{row.depth}</td>
      </tr>)}</tbody>
    </table>
  </div>
}

function ShowMore({ shown, total, onMore }: { shown: number; total: number; onMore: () => void }) {
  if (shown >= total) return null
  return <div className="closure-more">
    <span>Showing {shown.toLocaleString()} of {total.toLocaleString()}</span>
    <button type="button" className="text-action" onClick={onMore}>Show {Math.min(PAGE, total - shown)} more</button>
  </div>
}

export function ClosurePanel({ graph, rootName }: { graph: LocalGraph; rootName: string }) {
  const rootId = graph.id(rootName)
  const [text, setText] = useState('')
  const [hideGenerated, setHideGenerated] = useState(true)
  const [hideBoilerplate, setHideBoilerplate] = useState(false)
  const [depLimit, setDepLimit] = useState(PAGE)
  const [useLimit, setUseLimit] = useState(PAGE)
  const [copied, setCopied] = useState('')
  const [byNamespace, setByNamespace] = useState(false)
  const [modLimit, setModLimit] = useState(PAGE)
  const deferred = useDeferredValue(text)

  const audit = useMemo(() => (rootId === undefined ? [] : axiomAudit(graph, rootId)), [graph, rootId])
  const deps = useMemo(() => (rootId === undefined ? [] : closureRows(graph, rootId, 'dependencies').slice().sort(byDepthName)), [graph, rootId])
  const users = useMemo(() => (rootId === undefined ? [] : closureRows(graph, rootId, 'dependents')), [graph, rootId])
  const generatedCount = useMemo(() => deps.reduce((n, row) => n + (row.generated ? 1 : 0), 0), [deps])
  const boilerplateCount = useMemo(() => deps.reduce((n, row) => n + (row.boilerplate ? 1 : 0), 0), [deps])
  const hideBoiler = hideBoilerplate && graph.hasFlags
  const filtered = useMemo(() => applyFilter(deps, parseFilter(deferred, hideGenerated, hideBoiler)), [deps, deferred, hideGenerated, hideBoiler])
  const mods = useMemo(() => moduleGraph(graph, deps.map((row) => row.id), byNamespace ? moduleGroup : undefined), [graph, deps, byNamespace])
  const chips = useMemo(() => groupByModule(filtered, 2).slice(0, 5), [filtered])
  const direct = useMemo(() => users.filter((row) => row.depth === 1 && !(hideGenerated && row.generated)).sort(byDepthName), [users, hideGenerated])
  const directGroups = useMemo(() => {
    const groups = new Map<string, ClosureRow[]>()
    for (const row of direct) {
      const key = row.module.split('.').slice(0, 2).join('.')
      groups.set(key, [...(groups.get(key) ?? []), row])
    }
    return [...groups].sort((a, b) => b[1].length - a[1].length || (a[0] < b[0] ? -1 : 1))
  }, [direct])

  useEffect(() => setDepLimit(PAGE), [rootName, deferred, hideGenerated, hideBoiler])
  useEffect(() => setModLimit(PAGE), [rootName, byNamespace])
  useEffect(() => setUseLimit(PAGE), [rootName, hideGenerated])
  useEffect(() => { setText(''); setCopied('') }, [rootName])

  if (rootId === undefined) return null

  const copy = (name: string) => {
    void Promise.resolve(navigator.clipboard?.writeText(name)).catch(() => {})
    setCopied(name)
  }
  const commit = (graph.meta.mathlib_commit ?? 'unknown').slice(0, 7)
  const exportAs = (ext: 'csv' | 'json' | 'dot') => {
    const file = `${rootName}.deps.${ext}`
    if (ext === 'csv') downloadText(file, toCsv(filtered), 'text/csv')
    else if (ext === 'json') downloadText(file, toJson(graph, rootName, filtered), 'application/json')
    else downloadText(file, toDot(graph, filtered), 'text/vnd.graphviz')
  }
  const exportModules = (ext: 'csv' | 'json' | 'dot') => {
    const file = `${rootName}.modules.${ext}`
    if (ext === 'csv') downloadText(file, moduleCsv(mods), 'text/csv')
    else if (ext === 'json') downloadText(file, moduleJson(mods, rootName), 'application/json')
    else downloadText(file, moduleDot(mods), 'text/vnd.graphviz')
  }
  const dependents = Math.max(users.length - 1, 0)
  const shownDeps = filtered.slice(0, depLimit)
  const shownUsers = direct.slice(0, useLimit)
  let remaining = shownUsers.length

  return <section className="closure-panel" aria-label={`Closure of ${rootName}`}>
    <p className="eyebrow">Dependency closure</p>
    <p className="closure-live" role="status" aria-live="polite">{copied && `Copied ${copied}`}</p>

    <details open className="closure-section">
      <summary><h3>Axioms</h3></summary>
      {audit.length === 0
        ? <p className="closure-note">No axioms: this declaration does not depend on any axiom at this Mathlib commit.</p>
        : <>
          <p className="closure-note">Shortest dependency path to each axiom. This equals what <code>#print axioms</code> reports.</p>
          <ul className="closure-axioms">{audit.map((item) => <li key={item.axiom}>
            <strong><NameButton name={item.axiom} onCopy={copy} /></strong>
            <ol className="closure-path" aria-label={`Path to ${item.axiom}`}>
              {collapsePath(item.path).map((name, i) => <li key={i}>{i > 0 && <span aria-hidden="true">→ </span>}<NameButton name={name} onCopy={copy} /></li>)}
            </ol>
          </li>)}</ul>
        </>}
    </details>

    <details open className="closure-section">
      <summary><h3>Dependencies</h3></summary>
      <p className="closure-note" aria-live="polite">
        {deps.length.toLocaleString()} total · {filtered.length.toLocaleString()} shown after filter · {hideGenerated ? generatedCount.toLocaleString() : 0} compiler-generated hidden{hideBoiler ? ` · ${boilerplateCount.toLocaleString()} instances and coercions hidden` : ''}
      </p>
      <div className="closure-controls">
        <label htmlFor="closure-filter">Filter</label>
        <input id="closure-filter" type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="Topology.* -Classical.* continuous" autoComplete="off" spellCheck={false} aria-describedby="closure-filter-help" />
        <label className="closure-check"><input type="checkbox" checked={hideGenerated} onChange={(e) => setHideGenerated(e.target.checked)} /> Hide compiler-generated names ({generatedCount.toLocaleString()})</label>
        <label className="closure-check"><input type="checkbox" checked={hideBoiler} disabled={!graph.hasFlags} onChange={(e) => setHideBoilerplate(e.target.checked)} /> Hide instances and coercions{graph.hasFlags ? ` (${boilerplateCount.toLocaleString()})` : ' (unavailable: this store has no flags)'}</label>
      </div>
      <p id="closure-filter-help" className="closure-help">Words separated by spaces. A word ending in <code>.*</code> matches a name prefix; a leading <code>-</code> excludes; other words match as substrings.</p>
      {chips.length > 0 && <p className="closure-chips"><span>Top modules:</span>{chips.map((chip) => <button key={chip.module} type="button" className="status-pill neutral" onClick={() => setText(`${chip.module}.*`)}>{chip.module} · {chip.count.toLocaleString()}</button>)}</p>}
      {filtered.length === 0
        ? <p className="inline-state">No dependency matches this filter.</p>
        : <><RowTable rows={shownDeps} label={`Dependencies of ${rootName}`} onCopy={copy} /><ShowMore shown={shownDeps.length} total={filtered.length} onMore={() => setDepLimit((n) => n + PAGE)} /></>}
    </details>

    <details open className="closure-section">
      <summary><h3>Used by</h3></summary>
      <p className="closure-note">{dependents.toLocaleString()} {dependents === 1 ? 'declaration depends' : 'declarations depend'} on this directly or indirectly. {direct.length.toLocaleString()} directly{hideGenerated ? ' (compiler-generated names hidden)' : ''}.</p>
      {direct.length === 0 ? <p className="inline-state">No direct dependents.</p> : <>
        {directGroups.map(([module, rows]) => {
          const take = Math.min(rows.length, remaining)
          remaining -= take
          return take > 0 && <Fragment key={module}>
            <h4 className="closure-group">{module} <span>{rows.length.toLocaleString()}</span></h4>
            <ul className="closure-users">{rows.slice(0, take).map((row) => <li key={row.id}><NameButton name={row.name} onCopy={copy} /></li>)}</ul>
          </Fragment>
        })}
        <ShowMore shown={shownUsers.length} total={direct.length} onMore={() => setUseLimit((n) => n + PAGE)} />
      </>}
    </details>

    <details open className="closure-section">
      <summary><h3>Modules</h3></summary>
      <p className="closure-note">{mods.nodes.length.toLocaleString()} {byNamespace ? 'namespaces' : 'modules'} hold the {deps.length.toLocaleString()} declarations of the closure, with {mods.edges.length.toLocaleString()} dependency edges between them (closure only, compiler-generated names included).</p>
      <div className="closure-controls">
        <label className="closure-check"><input type="checkbox" checked={byNamespace} onChange={(e) => setByNamespace(e.target.checked)} /> Group by top-level namespace</label>
      </div>
      <div className="closure-scroll" tabIndex={0} role="region" aria-label={`Modules in the closure of ${rootName}`}>
        <table className="closure-modules">
          <thead><tr><th scope="col">{byNamespace ? 'Namespace' : 'Module'}</th><th scope="col" className="num">Decls</th><th scope="col">Depends on</th><th scope="col">Used by</th></tr></thead>
          <tbody>{mods.nodes.slice(0, modLimit).map((n) => <tr key={n.module}>
            <td><code>{n.module}</code></td><td className="num">{n.count.toLocaleString()}</td>
            <td className="closure-wrap">{n.dependsOn.length ? <details><summary>{n.dependsOn.length.toLocaleString()}</summary><ul className="closure-mods">{n.dependsOn.map((m) => <li key={m}><code>{m}</code></li>)}</ul></details> : 0}</td>
            <td className="closure-wrap">{n.usedBy.length ? <details><summary>{n.usedBy.length.toLocaleString()}</summary><ul className="closure-mods">{n.usedBy.map((m) => <li key={m}><code>{m}</code></li>)}</ul></details> : 0}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <ShowMore shown={Math.min(modLimit, mods.nodes.length)} total={mods.nodes.length} onMore={() => setModLimit((n) => n + PAGE)} />
      <div className="closure-export">
        <button type="button" className="closure-button" onClick={() => exportModules('csv')}>Modules CSV</button>
        <button type="button" className="closure-button" onClick={() => exportModules('json')}>Modules JSON</button>
        <button type="button" className="closure-button" onClick={() => exportModules('dot')}>Modules DOT</button>
      </div>
    </details>

    <details open className="closure-section">
      <summary><h3>Export</h3></summary>
      <div className="closure-export">
        <button type="button" className="closure-button" onClick={() => exportAs('csv')}>CSV</button>
        <button type="button" className="closure-button" onClick={() => exportAs('json')}>JSON</button>
        <button type="button" className="closure-button" onClick={() => exportAs('dot')}>Graphviz DOT</button>
      </div>
      <p className="closure-help">Exports the {filtered.length.toLocaleString()} currently filtered dependency rows. Edges are untyped. Store: Mathlib {commit}.</p>
    </details>
  </section>
}

export default ClosurePanel
