import { libraryOf } from './links'

/** Which store the app searches. `tauceti` is one graph: Mathlib at TauCeti's pin, and the TauCeti declarations referencing it. */
export type Mode = 'mathlib' | 'tauceti'
export type Tag = 'Mathlib' | 'TauCeti' | 'Lean core' | 'Batteries'

const HF = 'https://huggingface.co/datasets/dsleo'
export const STORE_URLS: Record<Mode, string> = {
  mathlib: (import.meta.env.VITE_STORE_URL as string | undefined) ?? `${HF}/leanage-mathlib-store/resolve/d530ba8562c45508109e9bae033f2e08c760c218`,
  tauceti: (import.meta.env.VITE_TAUCETI_STORE_URL as string | undefined) ?? `${HF}/leanage-tauceti-store/resolve/eff464ac66d0408149dca4ff629effc128102dc7`,
}

export const MODE_LABEL: Record<Mode, string> = { mathlib: 'Mathlib', tauceti: 'Mathlib + TauCeti' }

export function parseMode(value: string | null): Mode {
  return value === 'tauceti' ? 'tauceti' : 'mathlib'
}

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
