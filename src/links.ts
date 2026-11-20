// Links out to the Mathlib4 docs and to the source on GitHub, from a module name and a declaration name.
const DOCS = 'https://leanprover-community.github.io/mathlib4_docs'
const REPO = 'https://github.com/leanprover-community/mathlib4/blob'
// Top-level directories of the mathlib4 repository that hold Lean modules. Batteries, Std, Lean and Init live in other repositories.
const SOURCE_ROOTS = new Set(['Mathlib', 'Archive', 'Counterexamples'])

const modulePath = (module: string) => module.split('.').map(encodeURIComponent).join('/')

/** Docs page of the module, anchored at the declaration (the docs use the raw name as the element id). */
export function docsUrl(module: string | undefined, name?: string): string | null {
  if (!module) return null
  return `${DOCS}/${modulePath(module)}.html${name ? `#${encodeURIComponent(name)}` : ''}`
}

/** GitHub file for modules that live in the mathlib4 repository; null for Batteries, Std, Lean, Init. */
export function sourceUrl(module: string | undefined, commit: string | undefined): string | null {
  if (!module || !commit || !/^[0-9a-f]{7,40}$/i.test(commit) || !SOURCE_ROOTS.has(module.split('.')[0])) return null
  return `${REPO}/${commit}/${modulePath(module)}.lean`
}
