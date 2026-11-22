# Same-commit tactic records (and scoped-instance flags) for the combined store

Goal: the webapp, the CLI and the report answer "is induction (cases, by_contra, ...) written in this proof?" for Mathlib, Batteries, core Lean and TauCeti, not only for your own library. The store (Mathlib `31ce06e` + TauCeti `8794ab3`, Lean v4.37.0-rc1, 1,646,902 nodes) has no `tactics.u16` today: the `mathlib-tactics` dataset is for Mathlib `fc4f59e` and cannot be joined by source position to a different commit. The scoped-instance flags are also missing from `flags.u8`.

Approach: stop depending on a dataset. Get each declaration's source lines from Lean (declaration ranges), scan the source with the lexical scan we already trust, write the same `tactics.u16` / `tactics.json` format the app already reads (`LocalGraph.setTactics`: bit 15 = covered, bits 0..11 = labels).

## What already exists

- `cli/tactics.ts` and `scripts/ingest_tactics_core.py`: the scan. The TS version was checked on 3,204 Mathlib declarations against Mathlib's recorded tactics: exact for induction, cases, rcases, obtain, contrapose, rintro, split_ifs, fin_cases; `by_cases` and `by_contra` come out more complete than the recorded data; `match` untested.
- `scripts/extract_env.lean` (Mathlib environment, flags) and `scripts/extract_library_stream.lean` (TauCeti, one module at a time because 34,759 modules exhaust file handles), merged by `scripts/ingest_env_tsv.py`. `extract_env.lean` already has the scoped-instance patch.
- Webapp and CLI code paths for tactic bits (`setTactics`, `tacticsOf`, `findEvidence`). The app needs no logic change.

## Steps

1. **Ranges from Lean, Mathlib side.** Add `first-last line` (as in `extract_library.lean`) to `extract_env.lean`. Run it in the Mathlib 31ce06e checkout (one environment: Mathlib, Batteries, Std, Lean, Init). Output also gives the scoped-instance flags.
2. **Ranges from Lean, TauCeti side.** `extract_library_stream.lean` has no environment, so it cannot call `declRangeExt.find?`. Read the module's own `declRangeExt` entries from the module data (it is a map extension; entries are stored per module) and write the same range column. Check on a handful of modules against `extract_library.lean`, which does have an environment. Instance flags for TauCeti (currently unknown) can be read from the module's `instanceExtension` entries the same way; coercion/projection flags need the environment, so TauCeti flags stay partly unknown unless we find a cheap route.
3. **Sources.** Mathlib at 31ce06e, TauCeti at 8794ab3, Batteries at the revision in the lake manifest, Lean toolchain sources (`src/lean`) for Init, Std, Lean. About 15 GB of disk with oleans.
4. **Scan script** `scripts/ingest_tactics_ranges.py`: for each ranged declaration, strip comments, take its lines, run the scan (reuse `scan()` from `ingest_tactics_core.py`), write `tactics.u16` aligned to `names.txt`. A declaration is "covered" when it has a range and its name is unique in the store; the 3,653 duplicate names dropped at ingest stay unknown. Generated declarations (no range) stay unknown, which the app already treats as "no data", not "no tactics".
5. **Calibration before publishing.** Re-run steps 1 and 4 on Mathlib `fc4f59e` (the test project already has it built) and compare the whole of Mathlib, 807k nodes, with the old `tactics.u16`. Publish only labels with precision >= 0.99 and enough support, as `ingest_tactics_core.py` does for core; for `by_cases`/`by_contra`/`match` decide from the numbers, and say so on How it works.
6. **Assemble the store**: `ingest_env_tsv.py` with the new range-bearing TSVs, plus the new flags (scoped instances), plus tactics; then `verify_store_axioms.py` and the axiom comparison against Lean's `#print axioms` (previous result 99.6%, one `propext` mismatch).
7. **Publish** (needs your go-ahead, outward-facing): upload a new revision of `dsleo/leanage-tauceti-store`, pin it in `src/libraries.ts` and `cli/store.ts`.
8. **Use it**: add `tactics.u16`/`tactics.json` to the CLI store download; the report embeds tactic labels for Mathlib/TauCeti nodes in the closure too (today only library nodes); restore "Written in the proof" wording on How it works for Mathlib and TauCeti; keep the older MathlibGraph markers index as a fallback. Release CLI 0.4.0.

## Verification

- Calibration table (step 5) committed under `docs/`.
- Spot checks in the webapp: a Mathlib theorem with a known `induction` proof, a TauCeti theorem, a generated name (stays unknown).
- Axiom answers unchanged (compare store revisions on a sample of 200 declarations).
- CLI and report on the test project and on your other project against the new store.
- Size: `tactics.u16` is about 3.3 MB raw, a few hundred KB gzipped; the store grows by under 1%.

## Risks

- **TauCeti ranges without an environment** (step 2): if `declRangeExt` entries are not readable that way, fall back to importing TauCeti in several smaller environments, or scan TauCeti declarations by a source parser (`ingest_tactics.py`'s `parse_decls`). This is the step to prove first, on a few modules.
- **Compute**: two Lean extractions at 15-30 minutes each on a quiet machine (the TauCeti stream run was longer), plus a calibration extraction of Mathlib at the old commit. Plan for several hours elapsed, mostly waiting.
- **Disk**: the two checkouts plus oleans; clean the scratchpad first.
- **Scan limits**: tactics inside macros or generated code are missed; equation-compiler proofs show no `induction`. These are already documented and do not change.

## Decisions needed from you

1. Go-ahead for the heavy local runs (disk, hours of CPU).
2. Include the scoped-instance flags in the same store revision (recommended, the extraction is the same pass).
3. Go-ahead to upload the new revision to Hugging Face and to redeploy the webapp and publish CLI 0.4.0 at the end.
