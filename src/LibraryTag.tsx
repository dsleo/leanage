import { tagOf } from './libraries'

/** Small pill naming the library a result lives in: Mathlib, TauCeti, Lean core or Batteries. */
export function LibraryTag({ module, sourceLabel }: { module?: string; sourceLabel?: string }) {
  const tag = tagOf(module, sourceLabel)
  if (!tag) return null
  return <span className={`lib-tag lib-${tag.toLowerCase().replace(' ', '-')}`} title={`${tag} declaration`}>{tag}</span>
}
