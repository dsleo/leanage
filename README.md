# Leanage

Leanage answers dependency questions about Lean declarations in Mathlib, TauCeti and your own project: what does this theorem depend on, which axioms does it reach (and by which path), does it use `sorry`, and was induction, case analysis or contradiction written in its proof.

- **Web app:** <https://leanage.vercel.app>. Search a result, confirm it, ask about a target or a method, read the witness path and the graph. [How it works](https://leanage.vercel.app/how-it-works) explains the evidence and its limits.
- **Command line:** `@dsleo/leanage`, same data, plus a layer for your own Lean project.

## Command line

```sh
npm i -g @dsleo/leanage          # or try once: npx @dsleo/leanage axioms Nat.add_comm
leanage axioms <name>            # axioms reached, with one witness path each
leanage deps|rdeps <name>        # what it depends on / what depends on it (--filter, --no-generated, --no-boilerplate, --format text|json|csv|dot)
leanage path <from> <to>         # shortest dependency path
leanage check <name> --forbid Classical.choice   # exit 1 if reached, 2 if the name is unknown
leanage explore                  # interactive: confirm a result of interest, then give a target (or none)
```

The first run downloads the store (about 85 MB) into `~/.cache/leanage`. `--scope statement` follows only what the statement mentions. `--store <dir-or-url>` or `LEANAGE_STORE` selects another store. See [cli/README.md](cli/README.md) for the CI example and exit codes.

### Your own Lean project

Needs Lean installed and your Lake project built (`lake build`) against the Mathlib commit of the store (a mismatch only warns).

```sh
leanage index <project>                   # Lean extracts your declarations' dependencies and reads the tactics from your files
leanage libs --lib <project>              # your theorems and the axioms each reaches (sorryAx = unfinished)
leanage check MyLib.main --forbid sorryAx --lib <project>
leanage explore --lib <project>
leanage report --lib <project>            # one self-contained HTML page: the webapp flow over your project
```

`--lib` works with every command and tags each path step `[library]` or `[Mathlib]`. Nothing leaves your machine, except the text of a plain-English search if you click that button in the report. Design notes: [docs/LIBRARY_LAYER_PLAN.md](docs/LIBRARY_LAYER_PLAN.md).

## How it works

Everything runs on one static store, [dsleo/leanage-tauceti-store](https://huggingface.co/datasets/dsleo/leanage-tauceti-store) on Hugging Face (Lean core, Batteries, Mathlib at the commit TauCeti pins, and TauCeti; 1.65M declarations, 73.6M links). It is extracted with Lean and loaded into memory by the browser or the CLI, so there is no server doing the work.

| File | Content |
|---|---|
| names, modules, `degrees` / `targets` | each declaration, and which declarations its compiled proof uses (links as flat arrays) |
| `edgetypes` | whether a link is in the statement, the proof or both (the "statement only" scope) |
| `flags` | instances (including scoped ones), projections, coercions, classes, structures (unknown for TauCeti) |
| `tactics` | per declaration, which tactics are written in its own source: induction, cases, rcases, obtain, by_cases, by_contra, contrapose, exfalso, fin_cases, split_ifs, rintro |

A question is a walk over those arrays from your theorem: the closure, the axioms reached, the shortest path to a named target, the nearest declaration whose source has a given tactic. Lean-name search runs on the names in memory; plain-English search goes to TheoremGraph and finds Mathlib statements only.

The graph comes from running Lean, not from reading files. The tactic records come from a scan of each declaration's source lines (Lean provides the line ranges), checked on 347,049 Mathlib declarations against the tactics Lean recorded: [docs/feasibility/tactics-scan-calibration.md](docs/feasibility/tactics-scan-calibration.md).

## Develop

```sh
npm install
npm run dev          # http://127.0.0.1:5173 (Vite proxies /tg/* to api.theoremsearch.com)
npm test             # vitest
npm run build        # web app
npm run build:cli    # cli/dist/leanage.mjs
```

To use a local copy of the store, put its files in `public/store/` (gitignored) and set `VITE_TAUCETI_STORE_URL=/store`; the CLI takes `--store <dir>`.

Layout: `src/` web app (`localGraph.ts` is the graph, `methods.ts` the method evidence, `GraphExplorer.tsx` the graph view), `cli/` command line and report generator (`tactics.ts` the source scan for your project), `scripts/` store extraction and ingestion (Lean and Python), `docs/` plans and validation records ([IMPLEMENTATION_PLAN](docs/IMPLEMENTATION_PLAN.md), [method validation](docs/feasibility/method-validation.md), [Rocq/MathComp extension idea](docs/ROCQ_MATHCOMP_EXTENSION.md)).

### Rebuilding the store

Follow [docs/STORE_TACTICS_PLAN.md](docs/STORE_TACTICS_PLAN.md): `scripts/extract_env.lean` (Mathlib) and `scripts/extract_library_stream.lean` (TauCeti) write the graph and the line ranges, `scripts/ingest_env_tsv.py` builds the store, `scripts/ingest_tactics_ranges.py` adds the tactics, `scripts/verify_store_axioms.py` checks axioms against Lean's `#print axioms`. Upload the files to the dataset and update the pin in `src/libraries.ts` and `cli/store.ts`. Run one Lean extraction at a time (macOS has about 30,000 system file handles).

## Deploying

CI (`.github/workflows/ci.yml`) runs the type check, tests and both builds on every push. Hosting is Vercel's Git integration: a push to `main` deploys production, other branches get preview URLs. The CLI is released with `cd cli && npm publish --access public` (npm asks for 2FA).

Licensed Apache-2.0.
