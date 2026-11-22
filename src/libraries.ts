import { libraryOf } from './links'

export type Tag = 'Mathlib' | 'TauCeti' | 'Lean core' | 'Batteries'

/** One store for everything: Mathlib at TauCeti's pin, with the TauCeti declarations in the same graph. */
const HF = 'https://huggingface.co/datasets/dsleo'
export const STORE_URL = (import.meta.env.VITE_TAUCETI_STORE_URL as string | undefined) ?? `${HF}/leanage-tauceti-store/resolve/41bd905332cf49133c03bef77825ea0d21d778af`

/** The library a result belongs to: from its module when known, else from a TheoremGraph source label (those results are all Mathlib). Other packages get no tag. */
export function tagOf(module?: string, sourceLabel?: string): Tag | null {
  const lib = libraryOf(module)
  if (lib === 'tauceti') return 'TauCeti'
  if (lib === 'mathlib') return 'Mathlib'
  const root = module?.split('.')[0]
  if (root === 'Init' || root === 'Std' || root === 'Lean') return 'Lean core'
  if (root === 'Batteries') return 'Batteries'
  if (!module && sourceLabel && /^Mathlib/i.test(sourceLabel)) return 'Mathlib'
  return null
}
