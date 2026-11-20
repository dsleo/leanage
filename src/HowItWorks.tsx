import { useEffect } from 'react'
import { ArrowRight, ExternalLink } from 'lucide-react'
import { SiteFooter, SiteHeader } from './SiteChrome'
import './design.css'
import './styles.css'

function Ext({ href, children }: { href: string; children: string }) {
  return <a href={href} target="_blank" rel="noreferrer">{children} <ExternalLink size={13} aria-hidden="true" /></a>
}

export default function HowItWorks() {
  useEffect(() => { document.title = 'How it works — Leanage' }, [])
  return <div className="app-shell">
    <SiteHeader />
    <main className="guide-page">
      <div className="guide-intro">
        <h1>How it works</h1>
        <p>Leanage shows what a Lean declaration in Mathlib depends on, and which axioms it ends up using. This page explains what each answer means and where it stops being reliable.</p>
        <a className="guide-cta" href="/">Search for a result <ArrowRight size={16} aria-hidden="true" /></a>
      </div>
      <div className="guide-sections">
        <section aria-labelledby="g-what">
          <div><h2 id="g-what">What Leanage does</h2></div>
          <div>
            <p>A Lean proof refers to other declarations: lemmas, definitions, and the foundations underneath them. Following those references all the way down gives the <strong>complete dependency closure</strong> of a declaration. Leanage computes it, so it can list everything a result relies on, show one chain of references to any item, and report the axioms reached, as Lean’s <code>#print axioms</code> does.</p>
            <p>We checked the axiom sets against real Lean on 59 declarations (core, algebra, analysis, topology, number theory, category theory): all 59 agree. That is a spot check, not a proof that every declaration agrees.</p>
          </div>
        </section>

        <section aria-labelledby="g-flow">
          <div><h2 id="g-flow">The four steps</h2></div>
          <div>
            <div className="guide-chain" aria-hidden="true"><span>Search</span><span>→</span><span>Confirm</span><span>→</span><span>Choose what to detect</span><span>→</span><span>Answer</span></div>
            <ol className="guide-list">
              <li><strong>Search.</strong> Type a Lean name, or describe the result in words. A name is looked up directly; a description is sent to TheoremGraph, which returns close Mathlib statements.</li>
              <li><strong>Confirm.</strong> Search by description is approximate, so you pick the exact declaration you mean.</li>
              <li><strong>Choose what to detect.</strong> Pick a method (induction, case analysis, proof by contradiction, the axiom of choice) or name a result the proof should depend on, such as <code>Nat.zero_add</code>.</li>
              <li><strong>Answer.</strong> For each question you get a label, one path through the dependencies, and the closure panel.</li>
            </ol>
            <p>Each step is a browser history entry, so Back and Forward move between them.</p>
          </div>
        </section>

        <section aria-labelledby="g-data">
          <div><h2 id="g-data">The data</h2></div>
          <div>
            <p>Dependencies come from a local store built from the open dataset <code>mathlib-const-dep</code>: <strong>807,065 declarations</strong> of Mathlib at commit <code>fc4f59e</code> (Lean v4.36.0), with every reference between them. The store is a static copy loaded into your browser; closures are computed there, not on a server.</p>
            <p>Same-commit tactic information comes from <code>mathlib-tactics</code>, matched to declarations by module and source position. TheoremGraph is used only for search by description and for statements shown beside results; it does not decide any dependency answer when the store has the declaration.</p>
            <p>Everything is pinned to that one Mathlib commit. A newer Mathlib may differ, and the store is updated by hand.</p>
          </div>
        </section>

        <section aria-labelledby="g-answers">
          <div><h2 id="g-answers">What each answer means</h2></div>
          <div>
            <dl className="guide-terms">
              <dt>Found in dependencies</dt>
              <dd>The closure contains a declaration that implements the method (for example <code>Nat.rec</code> for induction) or the exact name you asked for. The path shows how it is reached.</dd>
              <dt>Written in the proof</dt>
              <dd>The Mathlib source, at the same commit, records that tactic (for example <code>induction</code>) in this declaration or one of its dependencies.</dd>
              <dt>Possible, older Mathlib</dt>
              <dd>A tactic was recorded for a declaration of the same name in an older Mathlib snapshot. The proof may have changed since.</dd>
              <dt>Possible, unconfirmed</dt>
              <dd>A tactic was recorded in a Mathlib snapshot we cannot match to this commit.</dd>
              <dt>Related only</dt>
              <dd>Something nearby was found, such as <code>exfalso</code> or <code>rcases</code>, which does not by itself show the method.</dd>
              <dt>Never reached</dt>
              <dd>You asked for a named declaration and the complete closure does not contain it. This is a definite absence, at this Mathlib commit.</dd>
              <dt>Not found</dt>
              <dd>No evidence of the method appeared. For methods this is not proof of absence, because evidence comes from markers and recorded tactics that miss some cases.</dd>
            </dl>
            <p>Other labels (limit reached, paused, partial evidence, definition scope needed, error) mean the check was incomplete, and the card says what was skipped.</p>
          </div>
        </section>

        <section aria-labelledby="g-induction">
          <div><h2 id="g-induction">Evidence, not a transcript</h2></div>
          <div>
            <p>“Uses induction” means the proof is built from the induction principle on natural numbers, <code>Nat.rec</code>. It does not show the author typed the <code>induction</code> tactic: <code>omega</code>, <code>simp</code>, a library lemma or a definition by recursion can produce the same term. The reverse also holds: a proof can mention a tactic in its source and not contain what you expect.</p>
            <p>That is why “Found in dependencies” (a fact about the compiled proof) and “Written in the proof” (a fact about the source) are separate labels.</p>
          </div>
        </section>

        <section aria-labelledby="g-limits">
          <div><h2 id="g-limits">Limits</h2></div>
          <div>
            <ul className="guide-list">
              <li><strong>“Statement only” follows definitions.</strong> The closure panel can show what the statement alone depends on. It follows the statement’s references and, through any definition they mention, that definition’s body. So a statement about <code>Real.sqrt</code> reaches the choice that defines the reals. Proofs of theorems that appear inside a statement are not followed. A few links from a type to its constructors are not seen (0.05% of references).</li>
              <li><strong>Core Lean tactics come from a source scan.</strong> Declarations from Lean itself (<code>Init</code>, <code>Std</code>, <code>Lean</code>) have no recorded tactics, so we scan their source and keep only the tactics where that scan was accurate on Mathlib (induction, cases, rcases, obtain and a few more). <code>by_cases</code>, <code>by_contra</code> and <code>match</code> are not reported for them, and proofs written by the equation compiler show no <code>induction</code> even though they recurse.</li>
              <li><strong>Tactics are about 97% complete.</strong> Matching source to declarations misses about 3% of tactics. Nothing was wrongly attached in our keyword check.</li>
              <li><strong>Scoped instances are not flagged.</strong> Instances, projections and coercions can be hidden as boilerplate, using flags extracted from Lean, but scoped instances are not covered.</li>
              <li><strong>Generated names.</strong> Lean creates helper declarations (names containing parts like <code>_proof_1</code> or <code>match_1</code>). They are hidden by default and folded into the declaration that owns them, but they stay in the store because real dependencies sometimes pass through them.</li>
              <li><strong>One Mathlib commit.</strong> Results say nothing about other versions. If your result is not in Mathlib, or its name changed, it cannot be analysed.</li>
            </ul>
          </div>
        </section>

        <section aria-labelledby="g-closure">
          <div><h2 id="g-closure">Closure panel and links</h2></div>
          <div>
            <p>The closure panel lists the axioms reached with one path to each, for the whole proof or for the statement only. The download icon next to the graph exports the full dependency closure as CSV, JSON or Graphviz DOT, without compiler-generated names. The command line offers filters, reverse dependencies and the instance and coercion filter.</p>
            <p>Any declaration has a permanent link of the form <code>/?name=Nat.add_comm&amp;commit=fc4f59e</code>. The commit records which Mathlib the link was made against, so a different store can tell you the answer may differ.</p>
          </div>
        </section>

        <section aria-labelledby="g-cli">
          <div><h2 id="g-cli">Command line</h2></div>
          <div>
            <p>The <code>leanage</code> tool queries the same store from a terminal or from CI.</p>
            <pre className="guide-code" tabIndex={0}>{`leanage axioms <name>
leanage deps|rdeps <name> [--filter 'Topology.* -Classical.*']
leanage path <from> <to>
leanage check <name> --forbid Classical.choice`}</pre>
            <p><code>check</code> exits with 1 if the forbidden declaration is reached and 2 if the name is missing. Output formats are text, JSON, CSV and DOT. See the Command line section of the project README for all options.</p>
          </div>
        </section>

        <section id="credits" aria-labelledby="g-credits">
          <div><h2 id="g-credits">Data and credits</h2></div>
          <div>
            <ul className="guide-list">
              <li><Ext href="https://huggingface.co/datasets/mathlib-initiative/mathlib-const-dep">mathlib-initiative/mathlib-const-dep</Ext>: the dependency graph (Apache-2.0).</li>
              <li><Ext href="https://huggingface.co/datasets/mathlib-initiative/mathlib-tactics">mathlib-initiative/mathlib-tactics</Ext>: tactic records from Mathlib source (Apache-2.0).</li>
              <li><Ext href="https://github.com/leanprover-community/mathlib4">Mathlib</Ext>: the library analysed (Apache-2.0).</li>
              <li><Ext href="https://www.theoremsearch.com/docs">TheoremGraph</Ext> (api.theoremsearch.com): search by description and statements.</li>
              <li><Ext href="https://lean-lang.org">Lean</Ext>: the proof assistant, used to extract instance and coercion flags and to check axioms.</li>
              <li><Ext href="https://huggingface.co/datasets/dsleo/leanage-mathlib-store">dsleo/leanage-mathlib-store</Ext>: the compact store Leanage derived from the datasets above (Apache-2.0).</li>
            </ul>
          </div>
        </section>
      </div>
    </main>
    <SiteFooter />
  </div>
}
