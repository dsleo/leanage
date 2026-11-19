import { useState } from 'react'
import { LoaderCircle, Pause, Play } from 'lucide-react'
import type { Declaration, Objective, Policy, TraversalState } from './domain'
import { findEvidence, type MethodIndex } from './methods'
import { GraphExplorer } from './GraphExplorer'
import { QuestionCard } from './Findings'
import { ClosurePanel } from './ClosurePanel'
import type { LocalGraph } from './localGraph'
import type { LocalMatch } from './localLookup'

interface Props {
  theorem: Declaration
  objectives: Objective[]
  states: Map<Policy, TraversalState>
  methodIndex?: MethodIndex
  indexStatus: 'idle' | 'loading' | 'ready' | 'error'
  indexError: string
  isRunning: boolean
  canResume: boolean
  pauseRequested: boolean
  onPause: () => void
  onResume: () => void
  onRetryIndex: () => void
  onIncludeDefinitions: () => void
  onContinue: (policy: Policy) => void
  storeNote?: string
  storeLoading?: boolean
  localGraph?: LocalGraph | null
  storeMiss?: LocalMatch[] | null
  onUseLocalName?: (name: string) => void
}

export function ResultsSection({ theorem, objectives, states, methodIndex, indexStatus, indexError, isRunning, canResume, pauseRequested, onPause, onResume, onRetryIndex, onIncludeDefinitions, onContinue, storeNote, storeLoading, localGraph, storeMiss, onUseLocalName }: Props) {
  const [showDetails, setShowDetails] = useState(false)
  const hasGraph = [...states.values()].some((state) => state.visited.size > 0)
  return <section className="results answer-stage" aria-labelledby="results-title">
    <div className="results-heading">
      <h2 id="results-title" className="sr-only" tabIndex={-1}>Answer</h2>
      <div className="result-actions">
        {isRunning && <button type="button" className="secondary-button" onClick={onPause}><Pause size={15} /> {pauseRequested ? 'Pausing' : 'Pause'}</button>}
        {!isRunning && canResume && <button type="button" className="secondary-button" onClick={onResume}><Play size={15} /> Resume</button>}
      </div>
    </div>
    {storeLoading && <div className="inline-state" role="status"><LoaderCircle size={16} className="spin" /> Loading the local dependency store (about 24 MB, cached after the first visit)…</div>}
    {storeMiss && <div className="inline-state" role="status"><span>
      <code>{theorem.name}</code> is not in the local store, so this answer uses live TheoremGraph data, which may be partial.
      {storeMiss.length > 0 && onUseLocalName && <> Similar names in the store: {storeMiss.map((match) => <button key={match.id} type="button" className="text-action" onClick={() => onUseLocalName(match.name)}>{match.name}</button>)}</>}
    </span></div>}
    {indexStatus === 'loading' && <div className="inline-state" role="status"><LoaderCircle size={16} className="spin" /> Loading the compact MathlibGraph method index…</div>}
    {indexStatus === 'error' && <div className="inline-state error" role="alert">Recorded tactic evidence is unavailable: {indexError} Graph-reference detectors can still run. <button type="button" onClick={onRetryIndex}>Retry index</button></div>}
    <div className="answers">{objectives.map((objective) => <QuestionCard key={objective.id} objective={objective} state={objective.policy ? states.get(objective.policy) : undefined} theorem={theorem} index={methodIndex} indexStatus={indexStatus} onIncludeDefinitions={onIncludeDefinitions} onResume={onResume} />)}</div>
    {(hasGraph || localGraph) && <details className="full-detail" onToggle={(event) => setShowDetails(event.currentTarget.open)}>
      <summary>Explore the full dependency graph and closure</summary>
      {showDetails && <>
        {hasGraph && <GraphExplorer states={states} root={theorem} onContinue={onContinue} canContinue={!isRunning} evidencePaths={objectives.flatMap((objective) => objective.policy ? findEvidence(states.get(objective.policy), objective, methodIndex).slice(0, 7).map((evidence) => ({ policy: objective.policy!, path: evidence.path })) : [])} />}
        {localGraph && <ClosurePanel graph={localGraph} rootName={theorem.name} />}
      </>}
    </details>}
    <p className="fine-print">A path confirms a reference. It does not reconstruct the Lean proof script.{storeNote ? ` ${storeNote}` : ''}</p>
  </section>
}
