# Leanage implementation plan

Revised 2026-11-18 after checking existing datasets. Replaces the earlier chat plan.
Goal: a tool mathematicians and formal engineers use, so exact answers, scriptable output and honest provenance come before visuals.

## 0. What already exists (checked 2026-11-18)

| Dataset | Content | License | Useful for | Limits |
| --- | --- | --- | --- | --- |
| [uw-math-ai/math-graph](https://huggingface.co/datasets/uw-math-ai/math-graph) (TheoremGraph's data) | `formal_dependency.csv` (1.05 GB): typed edges `extends/field/sig/proof/def/docref`, with `tactic_context`, `position`, `binder`, `role`, `via_proj`. `statement_formal.csv` (89.5 MB): `decl_name`, `module`, `kind`, `is_instance`, `docstring`. Mathlib has 351,397 declarations and about 9.3M edges. | CC-BY-4.0 (`body`/`proof` text is license-gated) | Backbone of the graph: same edges the app uses today, offline and complete. | Three Mathlib snapshots (`Mathlib_v427/428/429`) with `mathlib_rev` and `git_commit` empty in `paper_lean_repo.csv`, so no exact commit. Rows seen include self-edges (a `def` edge from a declaration to itself) that must be filtered. |
| [MathNetwork/MathlibGraph](https://huggingface.co/datasets/MathNetwork/MathlibGraph) | One pinned commit `534cf0b` (2 Feb 2026): 308,129 declarations, 8.4M edges, module import graph, namespace graph, metrics, `is_instance`, `is_coercion`, `tactic_usage.ndjson`. Pipeline in `MathNetwork/mathlib-network`. | Apache-2.0 | Module graph, boilerplate flags, tactic profiles at a known commit (already used for the method index). | Card reports 74.2% "synthesized" edges. Meaning is not documented in the card; read the pipeline before trusting edge semantics. Edges are untyped (no `sig`/`proof`/`def`). |
| [mathlib-initiative/mathlib-const-dep](https://huggingface.co/datasets/mathlib-initiative/mathlib-const-dep), plus sibling [mathlib-types](https://huggingface.co/datasets/mathlib-initiative/mathlib-types) and [mathlib-tactics](https://huggingface.co/datasets/mathlib-initiative/mathlib-tactics) | Scheduled runs of the open-source `lean_scout` extractor, all at Mathlib commit `fc4f59e`, Lean `v4.36.0`, generated 2026-11-17. `const-dep`: per declaration `name`, `module`, `deps` list, in 128 parquet shards of about 1 MB. `tactics`: tactic invocations with positions and goal states. | Apache-2.0 | **Primary candidate for the backbone**: exact pinned commit, recent, three datasets from one commit (deps, types, tactics). | `deps` is untyped (cannot tell signature from proof references). Not yet checked: whether core Lean declarations (`Nat.rec`, `propext`, ...) appear as rows, which the axiom closure needs. |

Consequence: the dependency data is **not** something to build from scratch first. The original Phase 1 (write a Lean extractor) is demoted to a fallback.

What none of them gives: a single, exactly pinned commit with typed edges **and** tactic evidence from the same source, a query engine, an axiom audit, reverse dependencies, export, or a CLI. Those are Leanage's job.

## 0b. Why not just keep TheoremGraph's live API?

Checked against its [docs](https://www.theoremsearch.com/docs) on 2026-11-18. The API offers semantic search, `/graph/statement/{id}` (`direction` = `src`, `dep` or `both`: one hop, so reverse dependencies exist), and `/graph/paper` (a whole repository). It has no closure, path or axiom endpoint, and the docs state no rate limit, versioning promise or terms.

| Need | Live API | Local store |
| --- | --- | --- |
| Semantic search in words | Yes (embedding model and index are theirs) | No; not replicable here |
| One-hop neighbors, both directions | Yes | Yes |
| Full closure, shortest path, axiom set | One request per node, about 0.5 s each, budgets and 429 retries; answers stay partial | Exact, milliseconds |
| Fixed, citable version | No: moving target, no commit | Yes: dataset revision recorded |
| Scripting, CI, offline | Depends on their uptime and format | Yes |

Decision: **search stays on TheoremGraph. The graph store is added only for what needs whole-graph queries**, and only if the Phase 1 gate passes (below). If the gate fails, keep the live API and ship the features that work with one hop (reverse dependencies via `direction=dep`, boilerplate filter, export).

Querying Hugging Face directly instead of ingesting (tested 2026-11-18): the dataset viewer's `/filter` endpoint is a point lookup (one request per node, the same pattern as TheoremGraph) and returned HTTP 500 after 10 s on `Nat.add_comm`; reverse dependencies and closure cannot be answered by lookups. Reading the parquet shards directly from the browser (HF serves CORS headers and byte ranges on `resolve/` URLs; the signed CDN redirect was not tested) would still touch most of the roughly 130 MB. So ingest once at build time and publish a compact derived store, possibly as our own Hugging Face dataset so that HF serves the bytes.

Hosting: the store is static files on the same CDN that already serves the app. Users do not download the dataset; the browser fetches shards on demand and the CLI fetches once. Redistribution of edge and name tables follows the dataset's CC-BY-4.0 terms with attribution; the license-gated `body`/`proof` text is not shipped.

## 1. Strategy

1. **Ingest, don't extract (default).** Build the local store from `mathlib-const-dep` (one pinned, recent commit). Add `math-graph` only for typed edges and `MathlibGraph` only for the module graph and flags, each labelled with its own snapshot.
2. **Be explicit about version.** Every answer states which snapshot it came from. Never join a `Mathlib_v42x` edge to a `534cf0b` tactic record without a stated join status (the app already does this; keep it).
3. **Cross-check before trusting.** Validate the ingested edges against `#print axioms` and `lean_scout` output on a sample (see Phase 1 acceptance).
4. **Extract only if justified.** Run `lean_scout` (or a small `Environment` walker) on one pinned commit if any of these hold after Phase 1: edge semantics cannot be verified, same-commit tactic evidence is required, freshness matters, or Rocq needs a shared reference implementation.

## 2. Phases

### Phase 0: cleanup (done 2026-11-17)
Docs under `docs/`, dead links removed, one product name, English test titles.

### Phase 1: ingest and verify (about 1 week)
1. `scripts/ingest_const_dep.py`: read the `mathlib-const-dep` parquet shards (one pinned commit, `fc4f59e`); output SQLite (`decls`, `edges`, `meta`) plus sharded, compressed static files. First check that core declarations and the axioms (`propext`, `Classical.choice`, `Quot.sound`) are reachable as rows or dependency names. If typed edges are wanted, join `math-graph` `formal_dependency` on declaration name and label it as a different snapshot.
2. Only if `math-graph` is joined: resolve the three-snapshot question (prefer the newest, document it, report how many declarations differ between snapshots).
3. Import MathlibGraph v2 module graph and flags (`is_instance`, `is_coercion`, `to_additive_pair`) by declaration name, at its pinned commit.
4. **Acceptance tests (golden):**
   - `Classical.em` reaches `Classical.choice` with the path in `docs/feasibility/body-edge-results.json`.
   - `Nat.add_comm` matches `docs/feasibility/fixture-Nat.add_comm.json` edge for edge.
   - 50 random theorems: the axiom set derived from the closure equals `#print axioms` run on a local Mathlib at the nearest version. Report mismatches, do not hide them.
   - Edge-count comparison against `mathlib-const-dep` on a sample, grouped by whether the dependency is in the type, the proof or a definition body.
5. Record the extraction date, dataset revision hashes and checksums in `meta`, as `scripts/build_method_index.py` already does.
6. **Measure before choosing the runtime:** store size, load time, closure query latency. Decide SQLite-in-browser versus a small server before Phase 2.

**Gate for Phase 2:** continue only if (a) the compressed Mathlib store is small enough to serve statically (target to confirm by measurement, not assumed), (b) closure queries are fast on a typical device, and (c) the axiom check passes. Otherwise stay on the live API as described in section 0b.

Stop condition: if the axiom check shows systematic mismatches that cannot be explained, switch to the fallback (run `lean_scout` on one commit) before building anything on top.

### Phase 1 results (2026-11-18): gate passed on `mathlib-const-dep`

Source: `mathlib-initiative/mathlib-const-dep`, Mathlib `fc4f59e`, Lean `v4.36.0`. Built with `scripts/ingest_const_dep.py`.

| Check | Result |
| --- | --- |
| Completeness | 807,065 declarations, 21.5M edges after removing 13,785 duplicate and self-edges. Every dependency target is itself a row. Core `Init.*` declarations and the axioms `propext`, `Classical.choice`, `Quot.sound`, `sorryAx` are present; `Lean.ofReduceBool` is not a row. |
| Size | 23.8 MB gzip, 18.7 MB xz in total (names 4.0 MB, edges 18.9 MB gzip). |
| Speed | Closures in 1–60 ms in unoptimised Python/NumPy (largest tested: 3,190 declarations in 18 ms). Not yet measured in a browser. |
| Axiom match | 59 of 59 declarations match real `#print axioms` run with Lean `v4.36.0` on Mathlib `fc4f59e` (ground truth in `docs/feasibility/axioms-ground-truth-fc4f59e.json`, compared with `scripts/compare_axioms.py`). The sample covers core, algebra, analysis, topology, number theory and category theory. |

Caveats:
- 59 declarations is a spot check, not proof of equality for all declarations.
- `deps` stays untyped (no signature versus proof distinction).
- 313,054 names (39%) look compiler-generated; they are kept for now. Dropping them would leave 13.5M of the 21.5M edges but could hide real dependencies.
- Browser load time of the 24 MB store is not measured yet.

### Phase 2: local query engine (first slice done 2026-11-18)

Done so far:
- `src/localGraph.ts`: browser decoder for the store, forward and reverse edges, shortest paths, axioms, prefix search. Loads the real store (807,065 nodes, 21.5M edges) in about 0.8 s from memory in Node; its axiom output equals the 59 Lean ground-truth sets.
- `src/localExplorer.ts`: builds the app's existing traversal state from the full closure (ids are declaration names). Evidence rules, paths and the graph view are reused; the drawn graph is bounded (about 140 nodes) while evidence uses the whole closure.
- `src/App.tsx`: loads `/store` when the user starts an analysis, falls back to the live API if it is missing or the name is absent. Named questions answer "Not in closure" exactly in local mode.
- Browser check (dev server, localhost): a 1,743-declaration closure answered three questions in about 3 s including loading the store.
- `vite.config.ts`: added the `/tg` dev proxy that the README described but the config lacked.

Not done yet:
- Production hosting of the store (Vercel static files or a Hugging Face dataset) and measured load time over a real network.
- Edge types: local edges are all shown as `proof`; the "Proof references" and "Proofs and definitions" scopes give the same answer in local mode.
- Paths often pass through compiler-generated declarations (for example `Nat.add_comm` reaches `Nat.zero_add` through `Nat.add_comm._f`); see section 2b.
- Reverse dependencies, axiom audit panel, export (Phase 3).
- Resolving a declaration that TheoremGraph knows by UUID but whose name is absent from the store.

- A `Store` interface with two implementations: the existing TheoremGraph HTTP client (kept as a fallback) and the local store.
- Closure, shortest path, reverse dependencies and per-module aggregation become local queries. Remove the 180-node, 180-request and 100 s budgets from the default path; keep a render cap only.
- TheoremGraph's live API stays as an optional layer for informal slogans and semantic search, clearly labelled.

### Phase 3: features experts need (about 2 weeks)

Status 2026-11-18 (local mode only):
- Done: axiom audit with shortest paths; dependency table with filter syntax (`Topology.* -Classical.* word`), module chips, hide-generated toggle with counts; "used by" (direct dependents, transitive count); CSV, JSON and DOT export of the filtered rows (`src/closureData.ts`, `src/ClosurePanel.tsx`); app opens on the search box; name permalinks (`?name=`); searching a Lean name offers the store's match with no API call, also when the API is down; names missing from the store show "similar names in the store" (`src/localLookup.ts`).
- Open: panel at 390 px width and keyboard pass; `_private.<Module>.0.<Name>` steps are not collapsed to `<Name>` in paths; permalinks do not record the store commit; module-level view from the import graph; per-declaration "used by" for deep reverse closure UI limits; the evidence cards still show raw paths through generated names.

In priority order:
1. **Axiom audit**: exact axiom set for any declaration, with one path to each. Replaces the single choice detector.
2. **Full closure table**: name, kind, module, depth, edge type; filter and sort.
3. **Reverse dependencies and impact**: who uses this, grouped by module.
4. **Boilerplate filter** using `is_instance`, `is_coercion`, `via_proj` and structure edges; counts shown, off by one toggle.
5. **Module and namespace grouping** from the MathlibGraph import graph.
6. **Free-form filters**: "reaches `Topology.*`", "avoids `Classical.*`".
7. **Export**: JSON, CSV, DOT; copy Lean name; source link.
8. **Open on the search box**; permalinks that include dataset snapshot.

### Phase 4: method evidence from source (conditional, 1–2 weeks)
The `mathlib-tactics` dataset is at the same commit as `mathlib-const-dep`, so same-commit tactic evidence may need no new extraction: ingest it and check that it can replace the MathlibGraph-based index (pinned to a different commit, `534cf0b`) so leads can become same-commit witnesses. Extract ourselves only if it cannot. Keep the `observed`/`lead`/`related` grades.

### Phase 5: CLI and batch (about 3 days)
`leanage deps|rdeps|axioms <name>` over the same SQLite file, JSON output, exit codes for CI use.

### Phase 6: Rocq and MathComp (about 3 weeks, after Phase 2)
See [ROCQ_MATHCOMP_EXTENSION.md](ROCQ_MATHCOMP_EXTENSION.md). No Rocq equivalent of the datasets above was found, so this is the one place where extraction really must be built (coq-dpdgraph first).

## 2b. Later: compiler-generated names (do not forget)

About 39% of the names in `mathlib-const-dep` (313,054 of 807,065) look compiler-generated: `_f`, `match_1`, `proof_1`, `eq_1`, `_simp_1`, `_sunfold`, `_unary`, `_cstage`, `_boxed`, `_closed`. They are kept in the store today because dropping them could hide real dependencies: a theorem often reaches other theorems only through these auxiliary declarations. Edges among the remaining names are 13.5M of 21.5M.

To do after Phase 2, as a display and size decision, not a data deletion:
1. Hide generated names in the UI by default (collapse them into the declaration that owns them, so `Nat.add_comm._f` appears as part of `Nat.add_comm`), with a toggle and counts. This is the boilerplate filter of Phase 3.
2. Check that collapsing keeps every real path: for a sample of theorems, compare the closure over real names with and without collapsing, and report any real declaration that becomes unreachable.
3. Only if the store needs to shrink, build a second store where generated names are contracted (edges rewired through them, not dropped), and measure its size and the axiom match again.
4. Refine the name patterns against Lean's actual rules for auxiliary declarations before relying on them (the current regex in `scripts/ingest_const_dep.py` is a rough guess).

### 2b results (2026-11-19): items 2 and 4

**Item 4, two-level classification** (vocabulary read off the 807,065 store names; most frequent last components: `_proof_N` 102k, `_simp_N_N` 51k, `eq_N` 22k, `_simp_N` 21k, `match_N` 18k, `_proof_N_N` 17k, `match_N_N` 11k, `noConfusion` 10.6k, `rec`/`casesOn`/`recOn` 7k each, `_flat_ctor` 6k, `sizeOf_spec` 6k, `_sparseCasesOn_N` 5k, `noConfusionType`/`inj`/`injEq` 4.8k, `_sizeOf_N`, `_unsafe_rec`, `_sizeOf_inst`, `_auto_N`, `_f`, `_aux_N`, `_default`, `_sunfold`, `eq_def`, `_inherited_default`, `_autoParam`, `_impl`, `_to_dual_N`, `_unary`, ...).
- Level 1, generated, hidden and collapsed to the owner (`GENERATED_PART` in `src/closureData.ts`, `GENERATED` in `scripts/ingest_const_dep.py`): any name component starting with `_` (this covers `_proof_N`, `_simp_N`, `_aux_N`, `_f`, `_unary`, `_sunfold`, `_cstage`, `_boxed`, `_closed`, `_lambda_N`, `_rarg`, `_spec_N`, `_elambda_N`, `_sizeOf_N`, `_sizeOf_inst`, `_flat_ctor`, `_sparseCasesOn_N`, `_unsafe_rec`, `_auto_N`, `_autoParam`, `_default`, `_inherited_default`, `_impl`, `_to_dual_N`, `_regBuiltin`, `_hyg`, `_@`, `_private_N`, `_mutual`, `_override`, `_arg_pusher`), plus the unprefixed `match_N`, `proof_N`, `eq_N`, `eq_def`, `eq_unfold`, `congr_eq_N`, `hcongr_N`, `unsafe_N`, `unsafe_impl_N` (now anchored with `$`, so `match_1x` no longer counts). Equation lemmas (`eq_N`, `eq_def`) are Lean-generated on demand and rarely written by hand, so they are level 1.
- Level 2, structural auxiliaries Lean derives for every inductive or structure, kept visible because users cite them (`rw [Foo.mk.injEq]`, `cases` via `casesOn`): `rec`, `recOn`, `casesOn`, `noConfusion`, `noConfusionType`, `below`, `brecOn`, `binductionOn`, `ibelow`, `inj`, `injEq`, `sizeOf_spec`, `ctorIdx` (and `_N` variants for mutual types). Exported as `isStructuralAuxName` for badges or a future toggle; not collapsed.
- Not generated: instance names `inst*` (real, user-facing; their `._proof_N`/`._aux_N` children are generated), `f.induct`, `f.fun_cases` (functional induction principles, used with `induction ... using`).
- Fix: `_private.<Module>.0.` is only the prefix of a private real declaration, not a generated marker; before, all ~148k names containing it (private real theorems included) counted as generated. `isGeneratedName` and the ingest now judge the name behind the prefix.
- New count: `generated_looking_names` becomes 285,172 (was 313,054; 35.3% of nodes), and edges between non-generated names 14,293,166 (was 13,519,379). Computed by `scripts/check_generated_contraction.py`; the full ingest was not re-run and `public/store/meta.json` is unchanged, so re-ingest to refresh the two meta fields.

**Item 2, contraction check** (`scripts/check_generated_contraction.py`, 200 roots: Nat.add_comm, Nat.Prime.dvd_or_dvd, Continuous.comp, IsCompact.exists_isMinOn, Classical.em and others, plus 190 random declarations with dependencies; seed 0). Closures were computed over the full graph, over the contracted graph (generated nodes removed, edges rewired through chains of generated nodes, 26 rewiring rounds; 16.8M contracted edges among 521,893 real nodes, versus 14.3M direct real-real edges), and over the owner-merged graph the UI display implies.
- Real declarations unreachable after contraction: 0 (median real closure 1,527, max 30,510; median 280 and max 11,842 generated nodes hidden per closure). Contraction keeps every real path, as expected.
- Owner-merge (identifying each generated node with its owner) loses nothing either, but over-approximates: it adds 481,556 real declarations in total over the 200 roots (198 roots affected, up to 7,746 per root) that are reachable only because a generated node of one owner points at another declaration. So evidence paths must use the real chain (collapsed step by step), not owner-merged reachability; closure counts must come from the full graph or the contracted graph.
- Owner not in the store: 27,749 of 285,172 generated nodes have an `ownerName` that is not a node (before the private fix, 56,150). Main causes: `match_N`, `_proof_N`, `_simp_N_N` under private declarations (the owner exists only with its `_private.<Module>.0.` prefix, which `ownerName` strips for display), `_sparseCasesOn_N`, `_unsafe_rec`, `splitter`, and `_inherited_default` owners that are structure fields not declared under that name. In the UI this is harmless for display (the collapsed row shows the owner text) but the owner cannot be opened or linked as a node; any code that navigates from an owner name must fall back to the generated node itself when `graph.id(owner)` is undefined. Never happens with all components generated (0 cases).

## 3. Risks and open questions

- **Edge provenance:** MathlibGraph's "synthesized" edges are undocumented in the card; read `mathlib-network` before using its declaration edges at all. Prefer `math-graph` edges for the declaration graph.
- **Snapshot ambiguity:** `mathlib_rev`/`git_commit` are empty, so "which Mathlib" can only be answered as `v427/v428/v429`. Say so in the UI.
- **Download size and licensing:** `formal_dependency.csv` is 1.05 GB (all libraries); only the Mathlib subset ships. CC-BY-4.0 requires attribution; do not ship the license-gated `body`/`proof` text without checking the terms.
- **Maintenance:** a new Mathlib release means a new ingest. Keep the script reproducible and the data versioned.
- **Unverified:** I did not download the full CSVs; the schema and snapshot facts above come from the dataset cards, the 3.8 kB `paper_lean_repo.csv` and the first rows of `formal_dependency.csv`.


Update 2026-11-18: closure panel checked at 390 px (no horizontal overflow); `_private.<Module>.0.` prefixes now collapse in `ownerName`. Still open: keyboard pass, store hosting, store commit in permalinks.

Update 2026-11-18 (later): store published at huggingface.co/datasets/dsleo/leanage-mathlib-store (CORS verified, full load works from the app). Hosting decided: Hugging Face, manual updates. Done: generated steps collapsed in evidence paths, `commit=` in permalinks, keyboard/used-by/export checks.

Update 2026-11-19: Phase 4 done via a source join (mathlib-tactics has no declaration names, so `scripts/ingest_tactics.py` attributes tactic rows to declarations by module and source position; 239,553 declarations resolved, 99.4% of source theorems/lemmas, 0 false positives in a keyword check, about 3% false negatives). Core-Lean declarations (Init) have no tactic data and stay leads. Phase 5 done (`cli/`, `npm run leanage`). Module view built. Boilerplate filter (instances, coercions) not built: no dataset carries those flags; needs our own Lean extraction. Store republished (tactics files, corrected generated-name counts); app and CLI pin the new revision.

Update 2026-11-20: instance/coercion/projection flags extracted from Lean (`scripts/extract_flags.lean`, `scripts/ingest_flags.py`; 44,834 instances, 15,981 projections, 282 @[coe]) and published as `flags.u8`; the closure panel and CLI (`--no-boilerplate`) can hide them. Scoped instances are not covered. Staged search flow (search, question, answer) with history support replaced the single page.

Update 2026-11-20 (later): done: How it works page rewritten with data credits; per-declaration docs and source links; edge types (`scripts/extract_edges.lean`, `scripts/ingest_edge_types.py`, `edgetypes.u8`: 99.95% agreement with the store, 0 Lean edges missing; 'Statement only' scope follows types and, through definitions, their bodies; 12 of 12 results matched an independent Lean recomputation); core-Lean tactics from a calibrated source scan (49% of non-generated core declarations covered; by_cases, by_contra, match not reported for core); CI (`.github/workflows/ci.yml`, deploy on push to main needs three secrets); CLI packaged as `leanage` (not yet published); `scripts/update_store.sh` rebuilds the whole store for a new Mathlib commit. Still open: publishing the CLI (needs npm login and a LICENSE decision), GitHub secrets for deploy, real-network load test, a mirror for the store if Hugging Face is down.
