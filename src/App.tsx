import { useEffect, useRef, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { ApiError, TheoremGraphClient } from './api'
import type { Candidate, Declaration, Objective, Policy, TraversalState } from './domain'
import { Explorer } from './explorer'
import { loadLocalGraph, type LocalGraph } from './localGraph'
import { localStates } from './localExplorer'
import { isLeanNameLike, lookupName, type LocalMatch } from './localLookup'
import { loadMethodIndex, type MethodIndex } from './methods'
import { interpretObjective, namedObjective, objectiveKey, resolvableText } from './objectives'
import { CandidateSection } from './CandidateSection'
import { ResultsSection } from './ResultsSection'
import { ConfirmedSection, QuestionSection, SearchSection, type Resolver, type SearchStatus } from './WorkflowSections'
import { displayedCandidates, isLeanNameQuery } from './searchCandidates'
import { SiteFooter, SiteHeader } from './SiteChrome'
import './design.css'
import './styles.css'

const client = new TheoremGraphClient()
const STORE_URL = (import.meta.env.VITE_STORE_URL as string | undefined) ?? 'https://huggingface.co/datasets/dsleo/leanage-mathlib-store/resolve/1567ab6ca80e5fbaa21805b40c71b648e042adc7'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Name permalinks carry the Mathlib commit they were made against, so a different store can say so.
function setDeclarationParams(url: URL, declaration: { id: string; name: string }, commit?: string) {
  if (UUID.test(declaration.id)) { url.searchParams.set('id', declaration.id); return }
  url.searchParams.set('name', declaration.name)
  if (commit) url.searchParams.set('commit', commit.slice(0, 7))
}

function initialUrl() {
  const params = new URLSearchParams(window.location.search)
  const query = params.get('q') ?? ''
  const raw = params.getAll('detect')
  const objectives = raw.map(interpretObjective).filter((value): value is Objective => Boolean(value))
  return { query, objectives, linkedId: params.get('id'), linkedName: params.get('name'), linkedCommit: params.get('commit') }
}

const initial = initialUrl()

function formatError(error: unknown) {
  if (error instanceof ApiError) return error.message
  if (error instanceof DOMException && error.name === 'AbortError') return 'Search cancelled.'
  if (error instanceof Error) return error.message
  return 'An unexpected error occurred.'
}

function debug(event: string, details: Record<string, unknown>) {
  console.debug(`[Leanage] ${event}`, details)
}

function App() {
  const [query, setQuery] = useState(initial.query)
  const [searchedQuery, setSearchedQuery] = useState(initial.query)
  const [searchOpen, setSearchOpen] = useState(true)
  const [draft, setDraft] = useState('')
  const [objectives, setObjectives] = useState<Objective[]>(initial.objectives)
  const [searchStatus, setSearchStatus] = useState<SearchStatus>('idle')
  const [searchError, setSearchError] = useState('')
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [visibleCandidates, setVisibleCandidates] = useState(5)
  const [confirmed, setConfirmed] = useState<Declaration | null>(null)
  const [analysisStarted, setAnalysisStarted] = useState(false)
  const [states, setStates] = useState<Map<Policy, TraversalState>>(new Map())
  const [searchSeconds, setSearchSeconds] = useState(0)
  const [searchNotice, setSearchNotice] = useState('')
  const [pauseRequested, setPauseRequested] = useState(false)
  const [methodIndex, setMethodIndex] = useState<MethodIndex | undefined>()
  const [includeDefinitions, setIncludeDefinitions] = useState(false)
  const [indexStatus, setIndexStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [indexError, setIndexError] = useState('')
  const [resolver, setResolver] = useState<Resolver | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)
  const [storeStatus, setStoreStatus] = useState<'idle' | 'loading' | 'ready' | 'unavailable'>('idle')
  const [storeNote, setStoreNote] = useState('')
  const localGraph = useRef<LocalGraph | null>(null)
  const storePromise = useRef<Promise<LocalGraph | null> | null>(null)
  const [storeMiss, setStoreMiss] = useState<LocalMatch[] | null>(null)
  const searchController = useRef<AbortController | null>(null)
  const resolveController = useRef<AbortController | null>(null)
  const searchInput = useRef<HTMLInputElement>(null)
  const searchSerial = useRef(0)
  const hydrationTail = useRef<Promise<void>>(Promise.resolve())
  const loggedTraversals = useRef(new Map<Policy, string>())
  const explorer = useRef(new Explorer(client, setStates))

  function ensureStore(): Promise<LocalGraph | null> {
    if (localGraph.current) return Promise.resolve(localGraph.current)
    if (!storePromise.current) {
      setStoreStatus('loading')
      storePromise.current = loadLocalGraph(STORE_URL).then((graph) => {
        localGraph.current = graph
        setStoreNote(`Local dependency store: Mathlib ${graph.meta.mathlib_commit?.slice(0, 7) ?? 'unknown commit'}, ${graph.meta.nodes.toLocaleString()} declarations. Complete closure; references are not typed.`)
        setStoreStatus('ready')
        return graph
      }).catch((error) => {
        debug('local store unavailable', { error: formatError(error) })
        setStoreStatus('unavailable')
        return null
      })
    }
    return storePromise.current
  }

  // A Lean name needs no API: the store can offer it directly, and still can when the API is down or does not know the name.
  async function localCandidates(text: string): Promise<Candidate[]> {
    if (!isLeanNameLike(text)) return []
    const graph = await ensureStore()
    if (!graph) return []
    const label = `Mathlib@${graph.meta.mathlib_commit?.slice(0, 7) ?? 'local'}`
    return lookupName(graph, text, 5).filter((match) => match.reason !== 'substring' && match.reason !== 'namespace-moved').map((match) => ({ id: match.name, name: match.name, sourceLabel: `${label} · ${match.module}`, score: 0, loading: false }))
  }

  const activeStates = Array.from(states.values())
  const scopedObjectives = objectives.map((objective) => includeDefinitions && objective.policy === 'proof' ? { ...objective, policy: 'body' as const } : objective)
  const isRunning = activeStates.some((state) => state.status === 'running')
  const canResume = activeStates.some((state) => state.status === 'paused' || state.status === 'error')
  const visibleResults = displayedCandidates(candidates, visibleCandidates, searchedQuery)

  function openSearch() {
    setSearchOpen(true)
    window.setTimeout(() => { document.getElementById('query-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); searchInput.current?.focus({ preventScroll: true }) }, 30)
  }

  useEffect(() => { if (!initial.linkedId) searchInput.current?.focus({ preventScroll: true }) }, [])

  useEffect(() => () => { searchController.current?.abort(); resolveController.current?.abort(); explorer.current.cancel() }, [])

  useEffect(() => {
    const url = new URL(window.location.href)
    url.searchParams.delete('id')
    url.searchParams.delete('name')
    url.searchParams.delete('commit')
    if (confirmed) setDeclarationParams(url, confirmed, localGraph.current?.meta.mathlib_commit)
    window.history.replaceState(null, '', url)
  }, [confirmed?.id, searchStatus])

  useEffect(() => {
    if (searchStatus !== 'searching') return
    const started = Date.now()
    const timer = window.setInterval(() => setSearchSeconds(Math.floor((Date.now() - started) / 1000)), 1000)
    return () => window.clearInterval(timer)
  }, [searchStatus])

  useEffect(() => {
    for (const state of states.values()) {
      if (state.status === 'idle' || state.status === 'running') continue
      const signature = `${state.rootId}:${state.status}:${state.completionReason}:${state.visited.size}:${state.requests}`
      if (loggedTraversals.current.get(state.policy) === signature) continue
      loggedTraversals.current.set(state.policy, signature)
      debug('traversal', { policy: state.policy, status: state.status, reason: state.completionReason, checked: state.visited.size, pending: state.frontier.length, requests: state.requests, elapsedMs: Math.round(state.elapsedMs), cache: client.cacheStats() })
    }
  }, [states])

  useEffect(() => {
    if (!initial.linkedId && initial.linkedName) {
      let live = true
      setSearchStatus('searching')
      void ensureStore().then((graph) => {
        if (!live) return
        const id = graph?.id(initial.linkedName!)
        if (!graph || id === undefined) { setSearchStatus('error'); setSearchError(`${initial.linkedName} is not in the local store.`); return }
        const declaration: Declaration = { id: initial.linkedName!, name: initial.linkedName!, sourceLabel: `Mathlib@${graph.meta.mathlib_commit?.slice(0, 7) ?? 'local'}` }
        const commit = graph.meta.mathlib_commit ?? ''
        if (initial.linkedCommit && !commit.startsWith(initial.linkedCommit)) setStoreNote(`This link was made against Mathlib ${initial.linkedCommit}; this store is Mathlib ${commit.slice(0, 7)}, so results may differ.`)
        setConfirmed(declaration)
        setCandidates([{ ...declaration, score: 0, loading: false }])
        setSearchStatus('ready')
      })
      return () => { live = false }
    }
    const id = initial.linkedId
    if (!id) return
    let live = true
    setSearchStatus('searching')
    const controller = new AbortController()
    searchController.current = controller
    void client.neighborhood(id, controller.signal).then(({ root }) => {
      if (!live || controller.signal.aborted) return
      const declaration: Declaration = { id: root.id, name: root.name, kind: root.kind, body: root.body, slogan: root.slogan, source: root.source, sourceLabel: root.sourceLabel }
      setConfirmed(declaration)
      setCandidates([{ ...root, score: 0, loading: false }])
      setSearchStatus('ready')
    }).catch((error) => {
      if (!live || controller.signal.aborted) return
      setSearchStatus('error')
      setSearchError(`The linked declaration could not be loaded: ${formatError(error)}`)
    })
    return () => { live = false; controller.abort() }
  }, [])

  function resetAnalysis(nextObjectives = objectives, index = methodIndex, definitionScope = includeDefinitions, root = confirmed) {
    if (!root) return
    loggedTraversals.current.clear()
    const scoped = nextObjectives.map((objective) => definitionScope && objective.policy === 'proof' ? { ...objective, policy: 'body' as const } : objective)
    const policies = Array.from(new Set(scoped.map((objective) => objective.policy).filter((value): value is Policy => Boolean(value))))
    const local = localGraph.current && policies.length ? localStates(localGraph.current, root, scoped, index) : null
    if (local) {
      explorer.current.cancel()
      setStates(local)
      setPauseRequested(false)
      return
    }
    explorer.current.setup(root, policies, scoped, index)
    if (policies.length) explorer.current.start()
    setPauseRequested(false)
  }

  function exploreDefinitions() {
    setIncludeDefinitions(true)
    resetAnalysis(objectives, methodIndex, true)
  }

  function removeObjective(id: string) {
    const next = objectives.filter((item) => item.id !== id)
    setObjectives(next)
    if (analysisStarted && confirmed) resetAnalysis(next)
  }

  function addObjective(objective: Objective) {
    if (objectives.some((item) => objectiveKey(item) === objectiveKey(objective))) { setDraft(''); return }
    const next = [...objectives, objective]
    setObjectives(next)
    setDraft('')
    if (analysisStarted && confirmed) resetAnalysis(next)
  }

  function addAndRefresh(value: string) {
    const text = resolvableText(value)
    if (text) { void resolve(text); return }
    const objective = interpretObjective(value)
    if (objective) addObjective(objective); else setDraft('')
  }

  function dismissResolver() {
    resolveController.current?.abort()
    setResolver(null)
  }

  // A free-text dependency is not a Lean name: find the result, let the user confirm it, then ask about it.
  async function resolve(text: string) {
    resolveController.current?.abort()
    const controller = new AbortController()
    resolveController.current = controller
    setDraft('')
    setResolver({ text, status: 'searching', candidates: [] })
    try {
      const found = (await client.search(text, controller.signal)).slice(0, 5)
      if (controller.signal.aborted) return
      if (!found.length) { setResolver({ text, status: 'empty', candidates: [] }); return }
      setResolver({ text, status: 'ready', candidates: found.map((item) => ({ ...item, loading: true })) })
      await Promise.allSettled(found.map(async (item) => {
        let patch: Partial<Candidate>
        try { patch = { ...(await client.neighborhood(item.id, controller.signal)).root, slogan: item.slogan, loading: false } } catch (error) { patch = { loading: false, error: formatError(error) } }
        if (controller.signal.aborted) return
        setResolver((current) => current?.text === text ? { ...current, candidates: current.candidates.map((candidate) => candidate.id === item.id ? { ...candidate, ...patch } : candidate) } : current)
      }))
    } catch (error) {
      if (controller.signal.aborted) return
      setResolver({ text, status: 'error', candidates: [], error: formatError(error) })
    }
  }

  function pickResolved(candidate: Candidate) {
    if (!resolver || candidate.loading || candidate.error) return
    const text = resolver.text
    setResolver(null)
    addObjective(namedObjective(text, candidate.name))
  }

  async function hydrate(items: Candidate[], controller: AbortController, serial: number, exactName?: string) {
    for (let offset = 0; offset < items.length; offset += 3) {
      if (controller.signal.aborted || serial !== searchSerial.current) return
      const started = performance.now()
      let matched = false
      await Promise.allSettled(items.slice(offset, offset + 3).map(async (item) => {
        try {
          const neighborhood = await client.neighborhood(item.id, controller.signal)
          if (controller.signal.aborted || serial !== searchSerial.current) return
          if (neighborhood.root.name === exactName) matched = true
          setCandidates((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, ...neighborhood.root, slogan: candidate.slogan, score: candidate.score, loading: false } : candidate))
        } catch (error) {
          if (controller.signal.aborted || serial !== searchSerial.current) return
          setCandidates((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, loading: false, error: formatError(error) } : candidate))
        }
      }))
      if (!controller.signal.aborted && serial === searchSerial.current) debug('candidate hydration', { count: Math.min(3, items.length - offset), elapsedMs: Math.round(performance.now() - started), cache: client.cacheStats() })
      if (matched && offset + 3 >= 5) return
    }
  }

  function showMoreCandidates() {
    const next = Math.min(candidates.length, visibleCandidates + 5)
    const items = candidates.slice(visibleCandidates, next)
    setVisibleCandidates(next)
    if (searchController.current) {
      const controller = searchController.current
      const serial = searchSerial.current
      hydrationTail.current = hydrationTail.current.then(() => hydrate(items, controller, serial))
    }
  }

  async function search() {
    if (!query.trim()) return
    const searchQuery = query.trim()
    searchController.current?.abort()
    dismissResolver()
    explorer.current.cancel()
    setStoreMiss(null)
    void ensureStore()
    setConfirmed(null)
    setIncludeDefinitions(false)
    setAnalysisStarted(false)
    setStates(new Map())
    setCandidates([])
    setVisibleCandidates(5)
    setSearchError('')
    setSearchNotice('')
    setSearchSeconds(0)
    setSearchStatus('searching')
    setSearchedQuery(searchQuery)
    const controller = new AbortController()
    searchController.current = controller
    const serial = ++searchSerial.current
    const started = performance.now()
    const local = localCandidates(searchQuery)
    const offerLocal = async (): Promise<boolean> => {
      const items = await local
      if (!items.length || serial !== searchSerial.current) return false
      setCandidates(items)
      setSearchStatus('ready')
      return true
    }
    try {
      const found = await client.search(searchQuery, controller.signal)
      if (serial !== searchSerial.current) return
      debug('semantic search', { count: found.length, elapsedMs: Math.round(performance.now() - started), cache: client.cacheStats() })
      if (!found.length) { if (!await offerLocal()) setSearchStatus('empty'); return }
      setCandidates(found)
      setSearchStatus('ready')
      void local.then((items) => { if (items.length && serial === searchSerial.current) setCandidates((current) => [...items.filter((item) => !current.some((candidate) => candidate.name === item.name && candidate.sourceLabel === item.sourceLabel)), ...current]) })
      window.setTimeout(() => document.getElementById('candidate-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30)
      hydrationTail.current = Promise.resolve().then(() => hydrate(isLeanNameQuery(searchQuery) ? found : found.slice(0, 5), controller, serial, isLeanNameQuery(searchQuery) ? searchQuery : undefined))
    } catch (error) {
      if (controller.signal.aborted || serial !== searchSerial.current) return
      if (await offerLocal()) return
      setSearchStatus('error')
      setSearchError(formatError(error))
    }
  }

  function cancelSearch() {
    searchController.current?.abort()
    searchSerial.current++
    setSearchStatus('idle')
    setSearchNotice('Search cancelled. Your query is still here.')
  }

  function confirm(candidate: Candidate) {
    if (candidate.loading || candidate.error) return
    dismissResolver()
    const declaration: Declaration = { id: candidate.id, name: candidate.name, kind: candidate.kind, body: candidate.body, slogan: candidate.slogan, source: candidate.source, sourceLabel: candidate.sourceLabel }
    setConfirmed(declaration)
    setIncludeDefinitions(false)
    setAnalysisStarted(false)
    setStates(new Map())
    explorer.current.cancel()
    window.setTimeout(() => document.getElementById('confirmed-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30)
  }

  async function copyDeclarationLink() {
    if (!confirmed) return
    const url = new URL(window.location.href)
    url.search = ''
    setDeclarationParams(url, confirmed, localGraph.current?.meta.mathlib_commit)
    try {
      await navigator.clipboard.writeText(url.toString())
      setLinkCopied(true)
      window.setTimeout(() => setLinkCopied(false), 1800)
    } catch {
      setLinkCopied(false)
    }
  }

  function changeResult() {
    dismissResolver()
    setStoreMiss(null)
    explorer.current.cancel()
    setConfirmed(null)
    setIncludeDefinitions(false)
    setAnalysisStarted(false)
    setStates(new Map())
  }

  async function begin() {
    if (!confirmed || !objectives.length) return
    setAnalysisStarted(true)
    const needsIndex = objectives.some((item) => item.kind === 'induction' || item.kind === 'cases' || item.kind === 'absurd')
    const graph = await ensureStore()
    setStoreMiss(graph && graph.id(confirmed.name) === undefined ? lookupName(graph, confirmed.name, 6).filter((match) => match.reason !== 'substring') : null)
    let index = methodIndex
    if (needsIndex && !index) {
      setIndexStatus('loading')
      try {
        index = await loadMethodIndex()
        setMethodIndex(index)
        setIndexStatus('ready')
        setIndexError('')
      } catch (error) {
        setIndexStatus('error')
        setIndexError(formatError(error))
      }
    }
    resetAnalysis(objectives, index)
    window.setTimeout(() => { const title = document.getElementById('results-title'); title?.scrollIntoView({ behavior: 'smooth', block: 'start' }); title?.focus({ preventScroll: true }) }, 30)
  }

  function analyseLocalName(name: string) {
    const declaration: Declaration = { id: name, name, sourceLabel: `Mathlib@${localGraph.current?.meta.mathlib_commit?.slice(0, 7) ?? 'local'}` }
    setConfirmed(declaration)
    setStoreMiss(null)
    resetAnalysis(objectives, methodIndex, includeDefinitions, declaration)
  }

  async function retryIndex() {
    setIndexStatus('loading')
    try {
      const index = await loadMethodIndex()
      setMethodIndex(index)
      setIndexStatus('ready')
      setIndexError('')
      explorer.current.setMethodIndex(index)
    } catch (error) {
      setIndexStatus('error')
      setIndexError(formatError(error))
    }
  }

  function resume() {
    explorer.current.resume()
    setPauseRequested(false)
  }

  return <div className={`app-shell ${searchOpen ? '' : 'intro-only'}`}>
    <SiteHeader />

    <main>
      <section className="intro" aria-labelledby="page-title">
        <h1 id="page-title">Leanage <em>explorer.</em></h1>
        <p>Describe a theorem and see what its proof relies on.</p>
        {!searchOpen && <button type="button" className="intro-cta" onClick={openSearch}>Explore a theorem <span className="intro-cta-arrow"><ArrowRight size={16} aria-hidden="true" /></span></button>}
      </section>

      {searchOpen && <section className="workspace" aria-label="Theorem analysis">
        <div className="workspace-grid">
          <div className="main-column">
            <SearchSection query={query} onQueryChange={setQuery} onSearch={() => void search()} onCancel={cancelSearch} inputRef={searchInput} status={searchStatus} seconds={searchSeconds} notice={searchNotice} error={searchError} />

            {searchStatus === 'ready' && !confirmed && <CandidateSection candidates={candidates} visible={visibleResults} visibleCount={visibleCandidates} query={searchedQuery} onConfirm={confirm} onShowMore={showMoreCandidates} />}

            {confirmed && <ConfirmedSection declaration={confirmed} onChange={changeResult} onCopyLink={() => void copyDeclarationLink()} linkCopied={linkCopied} />}

            {confirmed && <QuestionSection objectives={objectives} draft={draft} onDraftChange={setDraft} onAdd={addAndRefresh} onRemove={removeObjective} onBegin={() => void begin()} analysisStarted={analysisStarted} resolver={resolver} onPick={pickResolved} onDismissResolver={dismissResolver} />}

            {analysisStarted && confirmed && <ResultsSection
              theorem={states.values().next().value?.source === 'local' ? { ...confirmed, id: confirmed.name } : confirmed}
              storeNote={states.values().next().value?.source === 'local' ? storeNote : ''}
              storeLoading={storeStatus === 'loading'}
              storeMiss={storeMiss}
              onUseLocalName={analyseLocalName}
              localGraph={states.values().next().value?.source === 'local' ? localGraph.current : null}
              objectives={scopedObjectives}
              states={states}
              methodIndex={methodIndex}
              indexStatus={indexStatus}
              indexError={indexError}
              isRunning={isRunning}
              canResume={canResume}
              pauseRequested={pauseRequested}
              onPause={() => { explorer.current.pause(); setPauseRequested(true) }}
              onResume={resume}
              onRetryIndex={() => void retryIndex()}
              onIncludeDefinitions={exploreDefinitions}
              onContinue={(policy) => explorer.current.continueAfterWitness(policy)}
            />}
          </div>

        </div>
      </section>}
    </main>
    <SiteFooter />
  </div>
}

export default App
