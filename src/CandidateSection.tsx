import { ArrowDown, Check, LoaderCircle } from 'lucide-react'
import type { Candidate } from './domain'
import { MathText } from './MathText'
import { isLeanNameQuery } from './searchCandidates'
import { LibraryTag } from './LibraryTag'

interface Props {
  candidates: Candidate[]
  visible: Candidate[]
  visibleCount: number
  query: string
  onConfirm: (candidate: Candidate) => void
  onShowMore: () => void
  pending?: boolean
}

export function CandidateCard({ candidate, index, exactMatch, onConfirm }: { candidate: Candidate; index?: number; exactMatch?: boolean; onConfirm: (candidate: Candidate) => void }) {
  return <article className={index === undefined ? 'candidate no-index' : 'candidate'}>
    {index !== undefined && <div className="candidate-index">{String(index).padStart(2, '0')}</div>}
    <div className="candidate-body">
      {exactMatch && <span className="candidate-exact">Exact name match</span>} {!candidate.loading && <LibraryTag module={candidate.module} sourceLabel={candidate.sourceLabel} />}
      {candidate.slogan ? <h3 className="candidate-statement"><MathText text={candidate.slogan} /></h3> : <h3>{candidate.loading ? 'Loading…' : candidate.name}</h3>}
      {!candidate.loading && candidate.slogan && <p className="candidate-lean"><span>Lean</span> <code>{candidate.name}</code></p>}
      {candidate.body && <p className="formal-body">{candidate.body}</p>}
      {candidate.error && <p className="candidate-error">Statement unavailable: {candidate.error}</p>}
    </div>
    <button className="candidate-select" type="button" aria-label="Confirm this result" title="Confirm this result" disabled={candidate.loading || Boolean(candidate.error)} onClick={() => onConfirm(candidate)}>{candidate.loading ? <LoaderCircle className="spin" size={16} /> : <Check size={17} />}</button>
  </article>
}

export function CandidateSection({ candidates, visible, visibleCount, query, onConfirm, onShowMore, pending }: Props) {
  const exactQuery = isLeanNameQuery(query)
  const exact = exactQuery && candidates.some((candidate) => !candidate.loading && !candidate.error && candidate.name === query.trim())
  const checking = candidates.some((candidate) => candidate.loading)
  const failed = candidates.some((candidate) => candidate.error)

  return <section className="candidate-section" aria-labelledby="candidate-title">
    <h2 id="candidate-title" tabIndex={-1}>Is this your statement?</h2>
    {pending && <div className="inline-state" role="status"><LoaderCircle size={16} className="spin" /> Searching TheoremGraph for more matches…</div>}
    {exactQuery && !exact && <p className="search-advice" role="status">
      {checking ? <>Checking the matches for <code>{query.trim()}</code>…</> : failed ? <>Some matches could not be checked. <code>{query.trim()}</code> has not been confirmed; try a mathematical description.</> : <><code>{query.trim()}</code> did not appear among these {candidates.length} matches. Try describing the mathematics.</>}
    </p>}
    <div className="candidate-list">
      {visible.map((candidate) => <CandidateCard key={candidate.id} candidate={candidate} index={candidates.findIndex((item) => item.id === candidate.id) + 1} exactMatch={exactQuery && !candidate.loading && candidate.name === query.trim()} onConfirm={onConfirm} />)}
    </div>
    {visibleCount < candidates.length && <button type="button" className="candidate-more" onClick={onShowMore}>Show more results <ArrowDown size={15} /></button>}
  </section>
}
