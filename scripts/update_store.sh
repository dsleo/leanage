#!/usr/bin/env bash
# Rebuild the whole Leanage store for one Mathlib commit, then print the upload and pin steps.
#
#   MATHLIB_COMMIT=<40-hex> WORK=/path/to/workdir scripts/update_store.sh [step ...]
#
# Steps (all run in this order when none is given): download ingest checkout lean flags edges tactics core verify
# Needs: python3 with numpy and pyarrow (set PYTHON to a venv python), hf (huggingface_hub CLI), git, elan/lake, enough disk
# (Mathlib checkout with oleans is ~8 GB). The Lean steps take 15-30 minutes each on a busy machine.
# The commit MUST be the one mathlib-initiative/mathlib-const-dep and mathlib-tactics were built from: check their
# manifest.json / README first; the script refuses to continue if the const-dep manifest names another commit.
set -euo pipefail

: "${MATHLIB_COMMIT:?set MATHLIB_COMMIT to the full 40-character commit}"
: "${WORK:?set WORK to a scratch directory}"
PYTHON=${PYTHON:-python3}
REPO=$(cd "$(dirname "$0")/.." && pwd)
OUT=${OUT:-$WORK/store}
TOOLCHAIN=${TOOLCHAIN:-leanprover/lean4:v4.36.0}
LEAN_SRC=${LEAN_SRC:-$HOME/.elan/toolchains/${TOOLCHAIN//[\/:]/--}/src/lean}
mkdir -p "$WORK" "$OUT"
py() { "$PYTHON" -I "$@"; }
say() { printf '\n== %s\n' "$*"; }

step_download() {
  say "download const-dep and tactics shards"
  hf download mathlib-initiative/mathlib-const-dep --repo-type dataset --local-dir "$WORK/constdep"
  hf download mathlib-initiative/mathlib-tactics --repo-type dataset --local-dir "$WORK/tactics-hf"
  if ! grep -q "$MATHLIB_COMMIT" "$WORK/constdep/manifest.json" 2>/dev/null; then
    echo "const-dep manifest does not mention $MATHLIB_COMMIT; check which commit it was built from" >&2; exit 1
  fi
}
step_ingest() {
  say "dependency store (names, modules, edges)"
  py "$REPO/scripts/ingest_const_dep.py" --shards "$WORK/constdep" --out "$OUT" --mathlib-commit "$MATHLIB_COMMIT" --toolchain "$TOOLCHAIN" --check
}
step_checkout() {
  say "Mathlib checkout with prebuilt oleans"
  [ -d "$WORK/mathlib" ] || git clone https://github.com/leanprover-community/mathlib4 "$WORK/mathlib"
  git -C "$WORK/mathlib" checkout "$MATHLIB_COMMIT"
  (cd "$WORK/mathlib" && lake exe cache get)
}
lean_run() { (cd "$WORK/mathlib" && lake env lean --run "$REPO/scripts/$1" "${@:2}"); }
step_lean() { step_flags_lean; step_edges_lean; }
step_flags_lean() { say "Lean: instance/coercion flags"; lean_run extract_flags.lean "$WORK/flags.tsv"; }
step_edges_lean() { say "Lean: statement vs proof edges"; lean_run extract_edges.lean "$WORK/edges.tsv"; }
step_flags() { say "flags.u8"; py "$REPO/scripts/ingest_flags.py" --tsv "$WORK/flags.tsv" --store "$OUT" --out "$OUT"; }
step_edges() { say "edgetypes.u8"; py "$REPO/scripts/ingest_edge_types.py" --tsv "$WORK/edges.tsv" --store "$OUT" --out "$OUT"; }
step_tactics() {
  say "tactics.u16 (Mathlib, from mathlib-tactics)"
  mkdir -p "$WORK/tactics-base"
  py "$REPO/scripts/ingest_tactics.py" --shards "$WORK/tactics-hf" --mathlib "$WORK/mathlib" --store "$OUT" --out "$WORK/tactics-base"
}
step_core() {
  say "tactics.u16 (adds core Lean from a calibrated source scan)"
  py "$REPO/scripts/ingest_tactics_core.py" --lean-src "$LEAN_SRC" --mathlib "$WORK/mathlib" --store "$OUT" --base "$WORK/tactics-base" --out "$OUT" --cache "$WORK/calib.pkl"
}
step_verify() {
  say "verify"
  gt="$REPO/docs/feasibility/axioms-ground-truth-${MATHLIB_COMMIT:0:7}.json"
  if [ -f "$gt" ]; then py "$REPO/scripts/compare_axioms.py" "$gt" "$OUT"
  else echo "No Lean ground truth for ${MATHLIB_COMMIT:0:7}. Regenerate one with docs/feasibility/axioms.lean (see docs/IMPLEMENTATION_PLAN.md, Phase 1 results), save it as $gt, then rerun: scripts/update_store.sh verify"; fi
  for f in flags.json edgetypes.json tactics.json meta.json; do
    "$PYTHON" -I - "$OUT/$f" "${MATHLIB_COMMIT:0:7}" <<'PY'
import json, sys
m = json.load(open(sys.argv[1]))
c = m.get('mathlib_commit') or m.get('commit') or ''
print(sys.argv[1].split('/')[-1], 'commit', c[:7], 'OK' if c.startswith(sys.argv[2]) else 'MISMATCH')
sys.exit(0 if c.startswith(sys.argv[2]) else 1)
PY
  done
  cat <<E

Next, by hand (publishing is yours to decide):
  1. Copy only the .gz files, meta.json and the dataset card into an upload folder, then
       hf upload <user>/leanage-mathlib-store <folder> . --repo-type dataset --commit-message "Mathlib ${MATHLIB_COMMIT:0:7}"
  2. Put the new dataset revision in STORE_URL (src/App.tsx) and DEFAULT_STORE (cli/store.ts).
  3. Update the Mathlib commit shown on the How it works page, run the tests, and release the CLI if its default changed.
E
}

steps=("$@")
[ ${#steps[@]} -eq 0 ] && steps=(download ingest checkout lean flags edges tactics core verify)
for s in "${steps[@]}"; do "step_$s"; done
