# Extending Leanage to Rocq and MathComp

Status: recommendation, not implemented. Written 2026-11-10.

## 1. Is there an equivalent of TheoremGraph for Rocq?

Not that I found. What exists:

| Resource | What it is | Gap |
| --- | --- | --- |
| [coq-dpdgraph](https://rocq-prover.org/p/coq-dpdgraph) | Rocq plugin exporting a library's dependency graph to `.dpd` (`dpd2dot`, `dpdusage`). Latest listing targets Rocq 9.0. | Local extraction tool, not a hosted graph or search service. |
| TheoremExtr / lemmasearch.com ([summary](https://newx.sg/paper/detail/15baed35-5fd7-11f1-b84c-00163e10baa7)) | Extracts theorems and definitions from 32 Rocq projects (71,795 theorems, 27,481 definitions), cross-project search, BM25. | Unconfirmed: whether it exposes dependency edges, and whether MathComp is among the 32 projects. |
| [RocqStar](https://arxiv.org/html/2505.22846v3) and its [embedder](https://huggingface.co/JetBrains-Research/rocq-language-theorem-embeddings) | Premise-selection model for Rocq. | No dependency graph; no MathComp-specific dataset found. |
| [TheoremGraph](https://huggingface.co/papers/2606.25363) | Statement-level graph of arXiv and Lean/Mathlib. | Lean only. |

Conclusion: the dependency layer for Rocq must be built, not consumed.
For Lean the situation differs: dependency datasets already exist (see [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)), so Lean ingests them while Rocq must extract.

## 2. Recommendation

1. **Make the data layer the product, UI second.** Define one neutral schema, filled by ingestion where datasets exist (Lean) and by an extractor where they do not (Rocq). The UI reads only the schema.
2. **Start with MathComp**, pinned to one release (`mathcomp.ssreflect`, `algebra`, `fingroup`, ...). A bounded, regular library gives a testable first target; "all of Rocq" does not.
3. **First Rocq extractor: coq-dpdgraph**, to get a graph in days. Replace it with a small plugin over kernel terms only if its output proves insufficient (missing edge kinds, no module info, no Rocq-version coverage).
4. **Search without embeddings first**: exact name, prefix, and BM25 over statements. MathComp names are very regular (`addnC`, `mulnA`, `eqP`), so lexical search serves people who know the library. Add embeddings (RocqStar's model or generic ones) only on demand.
5. **Reuse the evidence model** (`observed` / `lead` / `related`) with a per-system rule table, as `GRAPH_RULES` in `src/methods.ts` already is.

## 3. Neutral schema

```
decl   { id, system: "lean"|"rocq", library, commit, module, name, kind, statement, informal? }
edge   { src, dst, type: "proof" | "sig" | "def" }
meta   { system, library, commit, tool_version, extracted_at }
```

Edges come from the kernel term only: constants in the type (`sig`), in the proof body (`proof`), and in definition bodies (`def`). One shard per module, plus an index of names.

## 4. MathComp-specific issues

- **Boilerplate dominates the graph.** Canonical structures, packed classes, `eqType`/`choiceType` hierarchies, coercions and structure projections appear in nearly every proof. A **boilerplate filter** (hide instance/structure plumbing by default, with a toggle) matters more than in Lean.
- **Proof by reflection.** `ssreflect` views (`eqP`, `idP`) and boolean reflection mean the interesting dependency is often a computational lemma, not a logical one. The inspector should show kind and statement for every node so this stays readable.
- **Hints and automation are invisible.** `Hint Resolve` and `auto`-style steps produce kernel-term references that no source-level scan sees; kernel extraction does, which is the reason to prefer it.
- **Tactic evidence is weaker.** There is no MathlibGraph equivalent. Method detection stays graph-reference based (`nat_ind`, `or_ind`, `bool_ind`, `Print Assumptions` for axioms) until a source-level tactic extractor exists. Do not present these as tactic claims.
- **Versions.** Pin Rocq and MathComp together; record both in `meta` and in every permalink.

## 5. Detector mapping (starting point, to be validated)

| Question | Lean (today) | Rocq / MathComp |
| --- | --- | --- |
| Induction | `Nat.rec`, `Nat.recAux` | `nat_ind`, `nat_rect`, `Nat.rect`, `list_ind` |
| Case analysis | `Or.elim`, `Nat.casesAuxOn` | `or_ind`, `bool_ind`, `sumbool_ind` |
| Contradiction | `Decidable.byContradiction` | `Classical_Prop.NNPP`, `Decidable.dec_not_not` (verify names per version) |
| Axioms | `Classical.choice`, `propext`, `Quot.sound` | `Print Assumptions` output: `classic`, `functional_extensionality`, `propositional_extensionality`, `constructive_indefinite_description` |

Names above must be checked against the pinned Rocq and MathComp versions before shipping; do not copy them as facts.

## 6. Steps

1. Freeze the schema (section 3) with the Lean ingest script as the reference implementation.
2. Run coq-dpdgraph on one MathComp release; convert `.dpd` to the schema; check node and edge counts against `Print Assumptions` and a few hand-verified theorems.
3. Add `system` to the UI state, name search and the permalink format (`?sys=rocq&id=...&commit=...`).
4. Add the boilerplate filter, then the per-system detector table.
5. Validate on a fixed list of MathComp theorems, as `docs/feasibility/release-smoke-tests.md` does for Lean.
6. Only then consider cross-project Rocq search (TheoremExtr, RocqStar) as an optional layer.

## 7. Risks

- coq-dpdgraph's output may omit edge kinds or module info; budget for a custom plugin.
- Rocq version churn (the Coq to Rocq rename, 9.x changes) breaks extractors; pin and record versions.
- Rocq has fewer natural-language statements than Mathlib has slogans, so the "describe a theorem in words" flow will be weaker; name search is the primary entry point.
