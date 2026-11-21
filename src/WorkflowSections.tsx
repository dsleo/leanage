import type { RefObject } from 'react'
import { ArrowRight, LoaderCircle, Plus, Search, X } from 'lucide-react'
import type { Candidate, Declaration, Objective } from './domain'
import { MathText } from './MathText'
import { DeclLinks } from './DeclLinks'
import { LibraryTag } from './LibraryTag'
import { CandidateCard } from './CandidateSection'
import { SUGGESTIONS } from './objectives'

export type SearchStatus = 'idle' | 'searching' | 'ready' | 'empty' | 'error'

interface SearchProps {
  query: string
  onQueryChange: (query: string) => void
  onSearch: () => void
  onCancel: () => void
  inputRef: RefObject<HTMLInputElement | null>
  status: SearchStatus
  seconds: number
  notice: string
  error: string
}

export function SearchSection({ query, onQueryChange, onSearch, onCancel, inputRef, status, seconds, notice, error }: SearchProps) {
  return <section className="form-section search-stage" aria-label="Result of interest">
    <form className="search-form" onSubmit={(event) => { event.preventDefault(); onSearch() }}>
      <Search size={19} aria-hidden="true" />
      <input ref={inputRef} aria-label="Lean name or mathematical description" value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="e.g. a prime dividing a product, or Nat.add_comm" />
      <button type="submit" aria-label="Search" title="Search" disabled={!query.trim() || status === 'searching'}>{status === 'searching' ? <LoaderCircle size={17} className="spin" /> : <ArrowRight size={17} />}</button>
    </form>
    <div className="example-line">Try <button type="button" onClick={() => onQueryChange('if a prime number divides a product then it divides one of the factors')}>Euclid’s lemma</button><button type="button" onClick={() => onQueryChange('continuous function on a compact interval attains its maximum')}>maximum on a compact interval</button><button type="button" onClick={() => onQueryChange('Nat.add_comm')}>Nat.add_comm</button></div>
    {status === 'searching' && <div className="inline-state search-progress" role="status"><LoaderCircle size={16} className="spin" /><span>{seconds < 10 ? 'Searching for matching results…' : `Still searching (${Math.floor(seconds / 5) * 5}s). This can take a while.`}</span><button type="button" onClick={onCancel}>Cancel search</button></div>}
    {notice && status === 'idle' && <div className="inline-state" role="status">{notice}</div>}
    {status === 'empty' && <div className="inline-state">No matching results appeared. Try a different name or a more precise description.</div>}
    {status === 'error' && <div className="inline-state error" role="alert">{error} <button type="button" onClick={onSearch}>Try again</button></div>}
  </section>
}

function isDefinition(kind?: string) { return /^def(?:inition)?$/i.test(kind ?? '') }

// Like a search results page: the confirmed result stays in a banner above the pages that follow.
export function ContextBar({ declaration }: { declaration: Declaration }) {
  return <div className="context-bar"><div className="context-inner">
    <div className="context-result">
      <span className="context-label">Result of interest</span>
      {declaration.slogan
        ? <><strong className="context-statement"><MathText text={declaration.slogan} /></strong><div className="context-id"><code>{declaration.name}</code><LibraryTag module={declaration.module} sourceLabel={declaration.sourceLabel} /><DeclLinks module={declaration.module} name={declaration.name} /></div></>
        : <div className="context-id"><strong className="context-name">{declaration.name}</strong><LibraryTag module={declaration.module} sourceLabel={declaration.sourceLabel} /><DeclLinks module={declaration.module} name={declaration.name} /></div>}
    </div>
  </div>
  {isDefinition(declaration.kind) && <div className="declaration-kind-note"><strong>This is a definition, not a theorem</strong><p>Its body may contain proofs. If the proof-only scan stops here, you can choose to explore its definition dependencies.</p></div>}
  </div>
}

interface QuestionProps {
  objectives: Objective[]
  draft: string
  onDraftChange: (draft: string) => void
  onAdd: (value: string) => void
  onRemove: (id: string) => void
  onBegin: () => void
  resolver: Resolver | null
  onPick: (candidate: Candidate) => void
  onDismissResolver: () => void
}

export interface Resolver { text: string; status: 'searching' | 'ready' | 'empty' | 'error'; candidates: Candidate[]; error?: string }

export function QuestionSection({ objectives, draft, onDraftChange, onAdd, onRemove, onBegin, resolver, onPick, onDismissResolver }: QuestionProps) {
  return <section className="form-section question-stage" aria-labelledby="objective-title">
    <h2 id="objective-title">What would you like to detect?</h2>
    <form className="search-form" onSubmit={(event) => { event.preventDefault(); if (draft.trim()) onAdd(draft) }}>
      <Search size={19} aria-hidden="true" />
      <input id="objective-input" autoFocus aria-label="A method or a result the proof should depend on" value={draft} onChange={(event) => onDraftChange(event.target.value)} placeholder="e.g. uses Zorn’s lemma, or depends on Nat.zero_add" />
      <button type="submit" aria-label="Add question" title="Add question" disabled={!draft.trim()}><Plus size={17} /></button>
    </form>
    <div className="example-line">Try this on {SUGGESTIONS.map((item) => <button type="button" key={item.value} onClick={() => onDraftChange(item.value)} title={item.caption}>{item.short}</button>)}</div>
    {resolver && <div className="resolver" role="region" aria-label={`Matches for ${resolver.text}`}>
      <div className="resolver-head"><h3>Is this the result you mean by “{resolver.text}”?</h3><button type="button" className="resolver-close" onClick={onDismissResolver} aria-label="Dismiss"><X size={16} /></button></div>
      {resolver.status === 'searching' && <div className="inline-state" role="status"><LoaderCircle size={16} className="spin" /> Searching for matching results…</div>}
      {resolver.status === 'empty' && <div className="inline-state">No matching results appeared. Try describing the result differently.</div>}
      {resolver.status === 'error' && <div className="inline-state error" role="alert">{resolver.error}</div>}
      {resolver.candidates.map((candidate) => <CandidateCard key={candidate.id} candidate={candidate} onConfirm={onPick} />)}
    </div>}
    {objectives.length > 0 && <div className="question-picked">
      <ul className="question-chips" aria-label="Selected questions">{objectives.map((objective) => <li key={objective.id}><span>{objective.original}</span>{objective.capability === 'unavailable' && <small>No detector</small>}<button type="button" onClick={() => onRemove(objective.id)} aria-label={`Remove ${objective.original}`}><X size={14} /></button></li>)}</ul>
      <button type="button" className="primary-button icon-only" onClick={onBegin} aria-label="Explore dependencies" title="Explore dependencies"><ArrowRight size={18} /></button>
    </div>}
  </section>
}
