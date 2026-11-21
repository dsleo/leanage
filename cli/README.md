# leanage

Query the dependency graph of Lean 4 / Mathlib from the command line: which axioms a declaration reaches, what it depends on, and a CI check that fails if a forbidden axiom shows up. Part of [Leanage](https://github.com/dsleo/leanage). No runtime dependencies, Node >= 18.

```
npm i -g @dsleo/leanage          # then use `leanage` everywhere below; or try once with: npx @dsleo/leanage axioms Nat.add_comm
leanage axioms Nat.add_comm
leanage deps|rdeps <name> [--filter 'Topology.* -Classical.*'] [--no-generated] [--no-boilerplate] [--format text|json|csv|dot]
leanage path <from> <to>
leanage check <name> --forbid Classical.choice
leanage explore            # interactive: confirm a result of interest, then give a target (witness path) or none (axioms, closure size)
```

### Your own library on top of Mathlib

Run these in a Lake project that builds against Mathlib (the same Mathlib commit as the store; a mismatch only warns). Lean must be installed, because `index` reads the compiled files.

```
leanage index .                       # extract your declarations' dependencies with Lean -> .leanage/library.tsv
leanage libs --lib .                  # your theorems and the axioms each reaches (sorryAx = unfinished)
leanage check MyLib.main --forbid sorryAx --lib .
leanage explore --lib .
leanage report --lib .                # one self-contained HTML page: pick a result, name a target, get the answer, graph and closure
```

Every command accepts `--lib <project>` and then sees your library and Mathlib as one graph. Nothing leaves your machine.

`--json` is short for `--format json`. `--forbid` is repeatable and accepts a `Pkg.*` prefix.

## Store

The graph comes from a pinned revision of the Hugging Face dataset [dsleo/leanage-tauceti-store](https://huggingface.co/datasets/dsleo/leanage-tauceti-store) (Lean core, Batteries, Mathlib and TauCeti; about 80 MB, downloaded on the first run, which can take a minute, then cached in `~/.cache/leanage`). Override it with `--store <dir-or-url>` or the `LEANAGE_STORE` environment variable (a local directory or an https URL of a store).

## Exit codes

| code | meaning |
| ---- | ------- |
| 0 | ok (for `check`: no forbidden axiom reached) |
| 1 | `check` failed (a forbidden axiom is reached), or `path` found no path |
| 2 | name not found (up to 5 suggestions are printed), usage error, or store error |

## GitHub Action

```yaml
name: axioms
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      # Fails the job (exit 1) if the theorem depends on Classical.choice; exit 2 if the name is unknown.
      - run: npx --yes @dsleo/leanage@0.2.0 check MyProject.main_theorem --forbid Classical.choice
```

Pin the version so the check does not change under you. Without `--lib` the check runs against the store, so it covers Mathlib and TauCeti declarations. To check your own project, build it, run `leanage index .` and add `--lib .`.

## License

Apache-2.0.
