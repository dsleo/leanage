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
              <li><strong>Search.</strong> Type a Lean name, or describe the result in words. A name is looked up directly in the store, in Mathlib or TauCeti; a description is sent to TheoremGraph, which returns close Mathlib statements.</li>
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
            <p>Dependencies come from one local store, extracted with Lean: <strong>1.65 million declarations</strong> and 73.6 million references between them, covering Lean core, Batteries, Mathlib at commit <code>31ce06e</code> (Lean v4.37.0-rc1) and <Ext href="https://github.com/TauCetiProject/TauCeti">TauCeti</Ext> at commit <code>8794ab3</code>. The store is a static copy loaded into your browser; closures are computed there, not on a server. Every search and every answer runs over all of it at once.</p>
            <p><strong>Mathlib and TauCeti.</strong> Mathlib is the large human-written library. TauCeti is an AI-written Lean library built on top of Mathlib: its declarations may depend on Mathlib, and Mathlib never depends on TauCeti. A result carries a Mathlib, TauCeti, Lean core or Batteries tag, and its documentation link goes to that library's own docs. The practical difference is how you find a result: Mathlib statements can be searched in plain English, through TheoremGraph, while TauCeti is found by its Lean name only (for example a name copied from its docs), because TheoremGraph does not index it. Once you have a result, dependency paths and axiom answers behave the same in both, and a TauCeti result can lead straight into Mathlib.</p>
            <p>The store has no same-commit tactic records: the tactic dataset we used before is for an older Mathlib commit and cannot be matched to this one. Method questions (induction, case analysis, contradiction) therefore rest on structural markers in the compiled proofs, such as <code>Nat.rec</code>, plus an index of tactics from an older Mathlib snapshot. TheoremGraph is used only for search by description and for statements shown beside results; it does not decide any dependency answer when the store has the declaration.</p>
            <p>Everything is pinned to those two commits. A newer version may differ, and the store is updated by hand.</p>
          </div>
        </section>

        <section aria-labelledby="g-answers">
          <div><h2 id="g-answers">What each answer means</h2></div>
          <div>
            <dl className="guide-terms">
              <dt>Found in dependencies</dt>
              <dd>The closure contains a declaration that implements the method (for example <code>Nat.rec</code> for induction) or the exact name you asked for. The path shows how it is reached.</dd>
              <dt>Written in the proof</dt>
              <dd>The source of this declaration or one of its dependencies contains that tactic (for example <code>induction</code>). The command-line report reads this from your own Lean files; the web store has no such records for Mathlib or TauCeti at the moment.</dd>
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
              <li><strong>Tactic records are limited.</strong> Without same-commit tactic data, a method that leaves no structural trace is reported as not found, which is not proof of absence. Your own library, analysed with the command-line report, does not have this limit: its tactics are read from your Lean files. We checked that scan on a sample of 3,204 Mathlib declarations against Mathlib's recorded tactics. It agreed exactly for induction, cases, rcases, obtain, contrapose, rintro, split_ifs and fin_cases, and it finds <code>by_cases</code> and <code>by_contra</code> in the source more often than the recorded data does (where we looked, the source did contain them).</li>
              
              <li><strong>Scoped instances.</strong> Instances, projections and coercions can be hidden as boilerplate, using flags extracted from Lean. Scoped instances are flagged for your own library; this store was built before that was added, so scoped instances of Mathlib and TauCeti are still shown.</li>
              <li><strong>Generated names.</strong> Lean creates helper declarations (names containing parts like <code>_proof_1</code> or <code>match_1</code>). They are hidden by default and folded into the declaration that owns them, but they stay in the store because real dependencies sometimes pass through them.</li>
              <li><strong>Two pinned commits.</strong> Results say nothing about other versions of Mathlib or TauCeti. If your result is not in the store, or its name changed, it cannot be analysed.</li>
            </ul>
          </div>
        </section>

        <section aria-labelledby="g-closure">
          <div><h2 id="g-closure">Closure panel and links</h2></div>
          <div>
            <p>The closure panel lists the axioms reached with one path to each, for the whole proof or for the statement only. The download icon next to the graph exports the full dependency closure as CSV, JSON or Graphviz DOT, without compiler-generated names. The command line offers filters, reverse dependencies and the instance and coercion filter.</p>
            <p>Any declaration has a permanent link of the form <code>/?name=Nat.add_comm&amp;commit=31ce06e</code>. The commit records which Mathlib the link was made against, so a different store can tell you the answer may differ.</p>
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
              <li><Ext href="https://huggingface.co/datasets/mathlib-initiative/mathlib-const-dep">mathlib-initiative/mathlib-const-dep</Ext>: the dependency graph the first store was built from (Apache-2.0).</li>
              <li><Ext href="https://huggingface.co/datasets/mathlib-initiative/mathlib-tactics">mathlib-initiative/mathlib-tactics</Ext>: tactic records from Mathlib source, used to calibrate the tactic scan (Apache-2.0).</li>
              <li><Ext href="https://github.com/leanprover-community/mathlib4">Mathlib</Ext>: the library analysed (Apache-2.0).</li>
              <li><Ext href="https://github.com/TauCetiProject/TauCeti">TauCeti</Ext>: the AI-written Lean library built on Mathlib, analysed in the second store (Apache-2.0).</li>
              <li><Ext href="https://www.theoremsearch.com/docs">TheoremGraph</Ext> (api.theoremsearch.com): search by description and statements.</li>
              <li><Ext href="https://lean-lang.org">Lean</Ext>: the proof assistant, used to extract instance and coercion flags and to check axioms.</li>
              <li><Ext href="https://huggingface.co/datasets/dsleo/leanage-tauceti-store">dsleo/leanage-tauceti-store</Ext>: the compact store Leanage extracted from Lean for Mathlib and TauCeti (Apache-2.0).</li>
            </ul>
          </div>
        </section>
      </div>
    </main>
    <SiteFooter />
  </div>
}
