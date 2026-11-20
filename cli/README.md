# leanage

Query the dependency graph of Lean 4 / Mathlib from the command line: which axioms a declaration reaches, what it depends on, and a CI check that fails if a forbidden axiom shows up. Part of [Leanage](https://github.com/dsleo/leanage). No runtime dependencies, Node >= 18.

```
npx leanage axioms Nat.add_comm
npx leanage deps|rdeps <name> [--filter 'Topology.* -Classical.*'] [--no-generated] [--no-boilerplate] [--format text|json|csv|dot]
npx leanage path <from> <to>
npx leanage check <name> --forbid Classical.choice
```

`--json` is short for `--format json`. `--forbid` is repeatable and accepts a `Pkg.*` prefix.

## Store

The graph comes from a pinned revision of the Hugging Face dataset [dsleo/leanage-mathlib-store](https://huggingface.co/datasets/dsleo/leanage-mathlib-store), downloaded once into `~/.cache/leanage`. Override it with `--store <dir-or-url>` or the `LEANAGE_STORE` environment variable (a local directory or an https URL of a store).

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
      - run: npx --yes leanage@0.1.0 check MyProject.main_theorem --forbid Classical.choice
```

Pin the version so the check does not change under you. The check runs against the Mathlib snapshot in the store, so it covers Mathlib declarations, not your own project's.

## License

Apache-2.0.
