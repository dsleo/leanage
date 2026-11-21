# Your library on top of Mathlib: scope and plan

**Update 2026-11-21 (state): CLI only for v1, same Mathlib commit assumed (a mismatch only warns), Lean extraction kept (a source parse cannot give kernel dependencies or honest axiom answers).** Built and tested, including a run of every command from a real terminal: `scripts/extract_library.lean` (whole project, flags, source lines), `LocalGraph.extend` (library ids after store ids), `src/library.ts`, `cli/library.ts`, `leanage index|libs|explore|report` and `--lib` on every command, layer-tagged `path`. The overlay is the extractor TSV itself, loaded in memory at query time. `leanage explore` is the interactive flow (confirm a result of interest, then a target or none). `leanage report` writes one self-contained HTML page that follows the webapp: result of interest, target or none, answer cards, the webapp's graph explorer, closure panel; it embeds the closure of your library (varint-packed edges) and runs the same walks in the page. The CLI and the webapp now share one store (Mathlib at TauCeti's pin + TauCeti). Not done: tactic evidence for library code, scoped-instance flags, plain-English search in the report, a size cap for very large closures, the web app integration (decided against for v1).

Goal: point Leanage at a directory of Lean files, treat every theorem and lemma in it as a result of interest, and answer the same questions as for Mathlib (what does it depend on, which axioms, which path, which tactics), with the dependency structure in two layers: Mathlib and core Lean at the bottom (the existing store), the user's library on top.

## 1. Scope

**In**
- A Lake project (or a directory inside one) that builds against Mathlib. Every declaration defined in the chosen directory is a node of the top layer.
- Edges from the top layer into itself and down into Mathlib/core; the reverse view ("which of my lemmas use `Nat.add_comm`", "what in my library depends on this").
- Same questions as today: dependencies, dependents, axioms (including `sorryAx`), path, statement-only scope, hide generated names and boilerplate.
- Layer-aware views: closure split into My library / Mathlib / Lean core, nodes coloured by layer, module tree of the library.
- Private by default: the user's code never leaves their machine.

**Out (v1)**
- Libraries that do not build (we need elaborated oleans; there is no honest way around this).
- Other third-party libraries as layers of their own (Batteries, Aesop, a second user project). They appear as "external" leaf nodes, or are in the base already. Generalising to N layers is a v2 that the design allows.
- Tactic evidence for the user layer (the Mathlib tactic data is a source-position join against a dataset; v2 can scan the user's syntax directly).
- Hosted multi-user service, accounts, incremental re-indexing on file change.

**Decisions that shape everything**
1. **Extraction must run Lean, so the browser cannot do it.** The web app stays static. A new CLI command builds a small *overlay store* on the user's machine; the app loads it.
2. **Same file format as the Mathlib store**, with ids continuing after the Mathlib ids (`id >= baseSize` is the library). One id space means `reach`, `pathTo`, `axioms`, the closure panel and the graph keep working unchanged.
3. **Names are the key across layers.** In one Lean environment a name is unique, so an overlay edge to `Nat.add_comm` resolves by name against the base `names.txt`. No new identity scheme.
4. **Version skew is the main risk.** The user's project pins a Mathlib commit; the base store is at one commit. Record the user's commit (from `lake-manifest.json`) in the overlay, compare with the base `meta.json`, and warn in the UI and CLI on mismatch. Names that do not resolve become `external` stub nodes (kept, shown, flagged "not in the Mathlib snapshot"), never silently dropped. A self-contained mode (v2: extractor also dumps the Mathlib closure it reaches) removes the problem for good at a size cost.
5. **Dependency-free CLI.** The Mathlib ingest uses Python/pyarrow; users will not have that. The overlay builder is TypeScript, in `cli/`, reusing the encoders and `LocalGraph`.

## 2. Architecture

```
user project (Lake, builds against Mathlib)
   │  lake build            (user does this; we check the oleans exist)
   ▼
scripts/extract_library.lean   one Lean run, one TSV
   │  per constant defined in the chosen directory's modules:
   │  name, module, kind, flags, type deps, value deps, file:line range, docstring present
   ▼
cli/overlay.ts   (TS)   resolve deps by name → base ids or overlay ids or external stubs
   │  writes the overlay store (names, modules, node_module, degrees, targets,
   │  flags, edgetypes, meta.json with layer, base commit, project commit, root dir, built_at)
   ▼
.leanage/  (folder, zippable)  ──►  CLI  (--lib .leanage)   and   web app (load overlay)
```

`scripts/extract_library.lean` merges what `extract_edges.lean` and `extract_flags.lean` already do (they iterate all of Mathlib; this one filters to constants whose defining module is in the library: `env.getModuleIdxFor? n` against the module list derived from the directory). One pass, same Lean toolchain as the project, run with `lake env lean --run` inside the user's project so imports resolve.

`LayeredGraph` (new, `src/layeredGraph.ts`) wraps `LocalGraph` (base) and an overlay `LocalGraph`:
- `id(name)`: overlay first, then base. `name(id)`, `module(id)`: dispatch on `id < baseSize`.
- `dependencies(id)`: overlay edges are already in the unified space. For base ids, base edges.
- `dependents(id)`: base reverse edges plus a small overlay-only reverse map (library nodes that point into Mathlib). This is the one real piece of new graph code.
- `reach`, `pathTo`, `axioms`: the existing BFS over the union; `layer(id)` is just `id >= baseSize`.
- `LocalGraph` today is a concrete class used by `localExplorer.ts`, `closureData.ts`, `localLookup.ts`, `cli/commands.ts`. Step 1 is extracting the read interface those use (`id/name/module/dependencies/dependents/reach/pathTo/axioms/flagsOf/edgeTypes/tacticsOf/search/size`) so `LayeredGraph` is a drop-in. Edge-type and flag byte arrays are also concatenated (base then overlay) so statement scope and boilerplate hiding cover both layers.

## 3. UI and app changes

**Entry.** The Google-style home keeps one search box. Add a layer chip beside it: `Mathlib` (default) and, once an overlay is loaded, `Mathlib + my-library`. Loading an overlay: a "Add your library" control in the footer/How it works and on the home page that accepts (a) a dropped `.leanage` folder or zip, (b) `?lib=http://localhost:5199` (from `leanage serve`, see step 6), (c) later a URL to a published overlay. Overlay metadata is kept in IndexedDB so a reload restores it (we already restore search/result/answer on reload; the overlay must be restored before the result is).

**Search and browse.** Name lookup (`lookupName`) searches the library first and tags results with a layer badge. A new **Library** view lists every theorem/lemma of the library as results of interest: module tree on the left (directory → file), list on the right with kind, `sorry` flag, axiom summary, and dependent count. This is the "any theorem/lemma there" entry point. Selecting one runs the normal question flow.

**Answer and closure panel.** Today the closure groups by Mathlib module. Add a top-level split, computed from the layer of each node:
- *In your library* (the part you wrote and must read), grouped by file;
- *From Mathlib* (grouped by module as now);
- *Lean core*;
- *Axioms*, with `sorryAx` called out as "depends on unfinished proofs" and the list of library declarations that contain the `sorry` directly (the ones to fix).
The scope toggle, boilerplate and generated filters apply to both layers unchanged.

**Graph.** Colour or outline nodes by layer (library accent, Mathlib neutral), with a legend entry; collapse long Mathlib tails behind "n Mathlib declarations" nodes when the path leaves the library, since the user cares about the boundary crossing. Node inspector shows `file:line` for library declarations and links to the local file (`vscode://file/…` when the root path is in the overlay metadata), Mathlib keeps its docs/source links.

**Library health strip** (small, high value, cheap since all data is in the graph): theorems that reach `sorryAx`; theorems that reach `Classical.choice` that a user may want constructive; declarations with no dependents inside the library (candidates for dead code); the most-used Mathlib declarations by the library. Each is a filtered list in the Library view, not a new page.

**Permalinks and history.** Today `commit=` pins the Mathlib commit. Library results are not shareable by URL (the data is local); the link keeps the name and the UI says "needs your library loaded". Reload restore works through IndexedDB.

**Copy.** How it works gains a "Your library" section: what is extracted, that nothing is uploaded, the version-skew rule, and the limit (must build).

## 4. CLI

```
leanage index <dir> [--project .] [--out .leanage]     # extract + build overlay (runs lake env lean)
leanage deps|rdeps|axioms|path|check ... --lib .leanage   # same commands over Mathlib + library
leanage check --lib .leanage --forbid sorryAx          # CI use: fails if any library theorem reaches it
leanage libs <overlay>                                 # list library theorems, with sorry/axiom flags
leanage serve --lib .leanage [--port 5199]             # static server with CORS for the web app
```

`check --forbid sorryAx` over a whole library is the most CI-friendly output of this feature; it also gives a natural GitHub Action.

## 5. Phases

| # | Work | Done when | Size |
|---|------|-----------|------|
| 0 | Spike: run `extract_edges`-style code on a tiny Lake project (3 files, one `sorry`, one use of `Nat.add_comm`); hand-check edges | TSV matches `#print axioms` and `Expr.getUsedConstants` for every declaration | 0.5 d |
| 1 | `scripts/extract_library.lean`: directory → module list, filtered constants, type/value deps, flags, ranges | Real project (a mid-size one, e.g. a pinned public Lean repo) extracts; counts match `lake` module list | 1.5 d |
| 2 | `cli/overlay.ts`: TSV → overlay store; name resolution, external stubs, skew check; round-trip test against `LocalGraph` | Overlay loads in `LocalGraph`; `axioms` agrees with Lean `#print axioms` on all theorems of the sample | 2 d |
| 3 | Read interface extracted from `LocalGraph`; `LayeredGraph` with overlay reverse map; unit tests incl. cross-layer path and dependents | All existing 117 tests pass unchanged on the interface; new tests for rdeps of a Mathlib name from the library | 2 d |
| 4 | CLI: `--lib`, `index`, `libs`, `check` | Commands work end to end on the sample; exit codes as today | 1 d |
| 5 | App: load overlay (drop + IndexedDB), layer chip, lookup with layers, Library view, layered closure panel, graph colouring, health strip | Browser run: load the sample, find a library theorem, see axioms with `sorry` called out, path crosses into Mathlib | 4 d |
| 6 | `leanage serve` + `?lib=`; How it works section; README; `update_store.sh`-style doc for the library workflow | Fresh user can go from `leanage index .` to a loaded app in a few commands | 1 d |
| 7 (v2) | Tactic evidence from user syntax; self-contained mode; N layers; GitHub Action; incremental re-index | not scheduled | |

Total v1: about 12 working days. Order matters: 0 to 3 are the risk (extraction correctness, id-space merge); 5 is the bulk but mostly composition of existing pieces.

## 6. Validation

- Axiom ground truth: for the sample library, generate `#print axioms` for every theorem in Lean itself and compare with the layered `axioms()`; same method as `compare_axioms.py` for Mathlib.
- Edge ground truth: Lean `getUsedConstants` recomputation on a random sample of library declarations (as done for the 12 statement-scope results).
- Skew test: build an overlay against Mathlib commit A, load against base commit B, check the warning and that unresolved names become external stubs rather than missing edges.
- Privacy check: the app loaded with an overlay makes no network request containing a library name (the TheoremGraph fallback must be skipped for names that resolve to the library layer).

## 7. Open questions for you

1. Primary entry: CLI-then-drop (recommended, simple, private) or also a hosted "paste a GitHub repo URL" flow (needs a build service; much bigger)?
2. Do you want libraries that depend on other non-Mathlib libraries (Batteries is in the base already; others would be external stubs in v1)?
3. Should library results be searchable by statement text (needs the `ppExpr` of each type in the extractor, a modest size increase), or by name only in v1?
