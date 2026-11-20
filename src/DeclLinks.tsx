import { useState } from 'react'
import { BookOpen, Check, Code2, Copy } from 'lucide-react'
import { docsUrl, sourceUrl } from './links'

/** Small external icon links to the Mathlib docs and (when it lives in mathlib4) the GitHub source. */
export function DeclLinks({ module, name, commit }: { module?: string; name: string; commit?: string }) {
  const docs = docsUrl(module, name)
  const source = commit ? sourceUrl(module, commit) : null
  if (!docs && !source) return null
  return <span className="decl-links">
    {docs && <a href={docs} target="_blank" rel="noopener noreferrer" aria-label={`Docs for ${name}`} title="Docs"><BookOpen size={14} aria-hidden="true" /></a>}
    {source && <a href={source} target="_blank" rel="noopener noreferrer" aria-label={`Source of ${name}`} title="Source"><Code2 size={14} aria-hidden="true" /></a>}
  </span>
}

/** Icon button that copies a Lean name. */
export function CopyNameButton({ name }: { name: string }) {
  const [done, setDone] = useState(false)
  const copy = () => {
    void navigator.clipboard?.writeText(name).then(() => { setDone(true); window.setTimeout(() => setDone(false), 1500) }, () => undefined)
  }
  return <button type="button" className="decl-copy" aria-label={`Copy Lean name ${name}`} title={done ? 'Copied' : 'Copy Lean name'} onClick={copy}>{done ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}</button>
}
