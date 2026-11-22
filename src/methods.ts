import type { Declaration, Objective, PathStep, TraversalState } from './domain'
import { pathTo } from './paths'

export const DETECTOR_VERSION = 'methods-1'
export const MARKER_SOURCE_URL = 'https://huggingface.co/datasets/MathNetwork/MathlibGraph'
const INDEX_REVISION = '8c706461fe266802197b62af324de12a3f1aa7fb'
const INDEX_HASH = '3927807af5920b626b687565f415233219df017b5b1555a074a073809bff4f84'

export type MethodCategory = 'induction' | 'cases' | 'absurd'
export type EvidenceGrade = 'observed' | 'lead' | 'related'
export type JoinStatus = 'same-source' | 'unverified' | 'different-version'

export interface MarkerRecord {
  kind: string | null
  module: string | null
  matches: Partial<Record<MethodCategory, string[]>>
}
export interface MethodIndex {
  schemaVersion: number
  detectorVersion: string
  source: string
  datasetRevision: string
  mathlibCommit: string
  mathlibCommitStatus: 'resolved'
  sourceSha256: string
  sourceRows: number
  markers: Record<string, MarkerRecord>
}
export interface Evidence {
  id: string
  category: Objective['kind']
  grade: EvidenceGrade
  source: 'TheoremGraph' | 'MathlibGraph' | 'MathlibTactics'
  ruleId: string
  matchedName: string
  matchedToken?: string
  explanation: string
  joinStatus?: JoinStatus
  sourceRevision?: string
  graphSourceLabel?: string
  location: 'root' | 'dependency' | 'definition'
  path: PathStep[]
}

let indexPromise: Promise<MethodIndex> | null = null

export function parseMethodIndex(value: unknown): MethodIndex {
  const data = value as MethodIndex
  if (!data || data.schemaVersion !== 1 || data.detectorVersion !== DETECTOR_VERSION || data.datasetRevision !== INDEX_REVISION || data.sourceSha256 !== INDEX_HASH || data.mathlibCommit !== '534cf0b8f5267c3f20bf52f932ad5f9834187c35' || data.mathlibCommitStatus !== 'resolved' || typeof data.markers !== 'object' || !data.markers || data.sourceRows !== 235586) {
    throw new Error('The method index has an unexpected version or format.')
  }
  return data
}

export function loadMethodIndex(): Promise<MethodIndex> {
  if (!indexPromise) indexPromise = fetch('/method-markers.json').then(async (response) => {
    if (!response.ok) throw new Error(`Method index returned HTTP ${response.status}.`)
    return parseMethodIndex(await response.json())
  }).catch((error) => { indexPromise = null; throw error })
  return indexPromise
}

const GRAPH_RULES: Record<MethodCategory, { name: string; rule: string; explanation: string; grade: EvidenceGrade; signature?: RegExp }[]> = {
  induction: [
    { name: 'Nat.rec', rule: 'nat-recursor', explanation: 'Nat.rec is Lean’s built-in rule for induction on natural numbers, and this proof is built from it. That shows the argument runs by induction or recursion, but not that the author typed the induction tactic.', grade: 'observed' },
    { name: 'Nat.recAux', rule: 'nat-rec-aux', explanation: 'Nat.recAux is induction on natural numbers where the successor case receives the previous case as its hypothesis, and this proof is built from it. That shows the argument runs by induction, but not that the author typed the induction tactic.', grade: 'observed', signature: /succ\s*:\s*\(n\s*:\s*Nat\)\s*→\s*motive n\s*→\s*motive\s*\(n\s*\+\s*1\)/ },
  ],
  cases: [
    { name: 'Or.elim', rule: 'or-elimination', explanation: 'Reference to disjunction elimination, which splits an Or proof into alternatives.', grade: 'observed' },
    { name: 'Nat.casesAuxOn', rule: 'nat-cases-aux', explanation: 'Reference to Nat.casesAuxOn, which has separate zero and successor branches without an induction-hypothesis argument.', grade: 'observed', signature: /succ\s*:\s*\(n\s*:\s*Nat\)\s*→\s*motive\s*\(n\s*\+\s*1\)/ },
  ],
  absurd: [
    { name: 'Decidable.byContradiction', rule: 'by-contradiction-principle', explanation: 'Reference to the named contradiction principle.', grade: 'observed' },
    { name: 'False.elim', rule: 'false-elimination', explanation: 'Reference to False elimination (ex falso). This alone does not establish proof by contradiction.', grade: 'related' },
  ],
}

// Same-commit source tactics (local store). 'observed' only for tactics that perform the method itself; the others are context.
const SOURCE_TACTICS: Record<MethodCategory, { observed: string[]; related: string[] }> = {
  induction: { observed: ['induction'], related: [] },
  cases: { observed: ['cases', 'by_cases', 'split_ifs', 'fin_cases'], related: ['rcases', 'obtain', 'rintro', 'match'] },
  absurd: { observed: ['by_contra', 'contrapose'], related: ['exfalso'] },
}

export function sourceTactics(state: TraversalState, kind: MethodCategory, name: string): { token: string; grade: EvidenceGrade }[] {
  const recorded = state.source === 'local' ? state.tactics?.(name) : null
  if (!recorded) return []
  const rules = SOURCE_TACTICS[kind]
  return [
    ...rules.observed.filter((token) => recorded.includes(token)).map((token) => ({ token, grade: 'observed' as const })),
    ...rules.related.filter((token) => recorded.includes(token)).map((token) => ({ token, grade: 'related' as const })),
  ]
}

function location(path: PathStep[]): Evidence['location'] {
  if (path.length === 1) return 'root'
  return path.some((step) => step.via === 'def') ? 'definition' : 'dependency'
}

function compatibleKind(graphKind: string | undefined, indexKind: string | null): boolean {
  if (!graphKind || !indexKind) return true
  const canonical = (value: string) => ({ thm: 'theorem', lemma: 'theorem', def: 'definition' })[value] ?? value
  return canonical(graphKind) === canonical(indexKind)
}

function mayMatch(state: TraversalState, objective: Objective, declaration: Declaration, id: string, index?: MethodIndex): boolean {
  if (objective.kind === 'named') return objective.target === declaration.name && id !== state.rootId
  if (objective.kind === 'unknown') return false
  if (id !== state.rootId && GRAPH_RULES[objective.kind].some((rule) => rule.name === declaration.name)) return true
  if (sourceTactics(state, objective.kind, declaration.name).length) return true
  return Boolean(index && state.visited.has(id) && index.markers[declaration.name]?.matches[objective.kind]?.length)
}

function evidenceForNode(state: TraversalState, objective: Objective, id: string, index?: MethodIndex): Evidence[] {
  const declaration = state.names.get(id)
  if (!declaration || !mayMatch(state, objective, declaration, id, index)) return []
  const path = pathTo(state, id)
  if (!path.length) return []
  const found: Evidence[] = []
  if (objective.kind === 'named' && objective.target === declaration.name && id !== state.rootId) {
    found.push({ id: `named:${id}`, category: objective.kind, grade: 'observed', source: 'TheoremGraph', ruleId: 'exact-lean-name', matchedName: declaration.name, explanation: `Exact declaration reference through ${state.policy === 'body' ? 'proof and definition' : 'proof'} edges.`, graphSourceLabel: state.rootSourceLabel, location: location(path), path })
  }
  if (objective.kind !== 'induction' && objective.kind !== 'cases' && objective.kind !== 'absurd') return found
  if (id !== state.rootId) {
    for (const rule of GRAPH_RULES[objective.kind]) {
      if (declaration.name === rule.name && (!rule.signature || state.source === 'local' || (state.visited.has(id) && rule.signature.test(declaration.body ?? '')))) found.push({ id: `graph:${rule.rule}:${id}`, category: objective.kind, grade: rule.grade, source: 'TheoremGraph', ruleId: rule.rule, matchedName: rule.name, explanation: rule.explanation, graphSourceLabel: declaration.sourceLabel ?? state.rootSourceLabel, location: location(path), path })
    }
  }
  const observedTokens = new Set<string>()
  for (const { token, grade } of sourceTactics(state, objective.kind, declaration.name)) {
    if (grade === 'observed') observedTokens.add(token)
    found.push({ id: `source-tactic:${objective.kind}:${id}:${token}`, category: objective.kind, grade, source: 'MathlibTactics', ruleId: `source-tactic:${token}`, matchedName: declaration.name, matchedToken: token, explanation: grade === 'observed' ? `The ${token} tactic is written in the source of this declaration, read at the commit the dependency store was built from.` : `${token} is written in the source of this declaration, but it does not by itself establish the specific method.`, graphSourceLabel: declaration.sourceLabel ?? state.rootSourceLabel, location: location(path), path })
  }
  if (!index || !state.visited.has(id)) return found
  const marker = index.markers[declaration.name]
  const tokens = marker?.matches[objective.kind]
  if (!tokens?.length || !compatibleKind(declaration.kind, marker.kind)) return found
  const graphVersion = state.rootSourceLabel
  const joinStatus: JoinStatus = !graphVersion || graphVersion === 'Mathlib_v428' ? 'unverified' : 'different-version'
  for (const token of tokens) {
    if (observedTokens.has(token)) continue
    const isSecondary = (objective.kind === 'cases' && token === 'rcases') || (objective.kind === 'absurd' && ['exfalso', 'absurd'].includes(token))
    found.push({ id: `tactic:${objective.kind}:${id}:${token}`, category: objective.kind, grade: isSecondary ? 'related' : 'lead', source: 'MathlibGraph', ruleId: `exact-tactic:${token}`, matchedName: declaration.name, matchedToken: token, explanation: isSecondary ? `${token} is related to this question but does not by itself establish the specific method.` : `MathlibGraph records the ${token} tactic for this declaration name. Proof-version identity with TheoremGraph is unverified.`, joinStatus, sourceRevision: index.mathlibCommit, graphSourceLabel: graphVersion, location: location(path), path })
  }
  return found
}

export function findEvidence(state: TraversalState | undefined, objective: Objective, index?: MethodIndex): Evidence[] {
  if (!state || objective.capability === 'unavailable') return []
  const result: Evidence[] = []
  for (const id of state.discovered) result.push(...evidenceForNode(state, objective, id, index))
  const order: Record<EvidenceGrade, number> = { observed: 0, lead: 1, related: 2 }
  return result.sort((a, b) => order[a.grade] - order[b.grade] || a.path.length - b.path.length || a.matchedName.localeCompare(b.matchedName))
}

export function primaryEvidence(state: TraversalState | undefined, objective: Objective, index?: MethodIndex): Evidence | undefined {
  return findEvidence(state, objective, index).find((item) => item.grade !== 'related')
}

export function pendingSignatureCandidates(state: TraversalState, objective: Objective): string[] {
  if (objective.kind !== 'induction' && objective.kind !== 'cases' && objective.kind !== 'absurd') return []
  const names = new Set(GRAPH_RULES[objective.kind].filter((rule) => rule.signature).map((rule) => rule.name))
  return [...state.discovered].filter((id) => !state.visited.has(id) && names.has(state.names.get(id)?.name ?? ''))
}
