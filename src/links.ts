// Links out to the docs and to the source on GitHub, from a module name and a declaration name. Two libraries have their own docs and repository:
// Mathlib (and the core modules it re-documents) and TauCeti. Batteries, Std, Lean and Init have docs on the Mathlib site but no source link here.
const LIBRARIES = {
  mathlib: { docs: 'https://leanprover-community.github.io/mathlib4_docs', repo: 'https://github.com/leanprover-community/mathlib4/blob', roots: new Set(['Mathlib', 'Archive', 'Counterexamples']) },
  tauceti: { docs: 'https://taucetiproject.github.io/TauCeti/docs', repo: 'https://github.com/TauCetiProject/TauCeti/blob', roots: new Set(['TauCeti']) },
}
export type LibraryId = keyof typeof LIBRARIES

/** Which library's repository holds a module's source, or null for Batteries, Std, Lean, Init and the like. */
export function libraryOf(module: string | undefined): LibraryId | null {
  const root = module?.split('.')[0]
  if (!root) return null
  return (Object.keys(LIBRARIES) as LibraryId[]).find((id) => LIBRARIES[id].roots.has(root)) ?? null
}

const modulePath = (module: string) => module.split('.').map(encodeURIComponent).join('/')

/** Docs page of the module, anchored at the declaration (the docs use the raw name as the element id). */
export function docsUrl(module: string | undefined, name?: string): string | null {
  if (!module) return null
  return `${LIBRARIES[libraryOf(module) === 'tauceti' ? 'tauceti' : 'mathlib'].docs}/${modulePath(module)}.html${name ? `#${encodeURIComponent(name)}` : ''}`
}

/** GitHub file for a module in the mathlib4 or TauCeti repository; null for other modules. `commit` must be the commit of that module's library. */
export function sourceUrl(module: string | undefined, commit: string | undefined): string | null {
  const lib = libraryOf(module)
  if (!module || !lib || !commit || !/^[0-9a-f]{7,40}$/i.test(commit)) return null
  return `${LIBRARIES[lib].repo}/${commit}/${modulePath(module)}.lean`
}
