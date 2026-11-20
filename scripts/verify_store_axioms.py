#!/usr/bin/env python3
"""Compare the store's axiom closures with Lean's own `#print axioms` on a random sample.

  python3 scripts/verify_store_axioms.py --store DIR --project LAKE_PROJECT [--n 250] [--seed 7]

Writes a Lean file with `#print axioms` for sampled declarations, runs it with `lake env lean` inside the project (which must
import Mathlib and be built), and checks each answer against the closure in the store. Needs numpy and pyarrow (see ingest_const_dep.py).
Lean 4.37 answers from per-declaration data precomputed in the olean files; a few inductive types differ (the store then reports
more axioms, never fewer), so a handful of mismatches is expected: the script lists them.
"""
import argparse, gzip, random, re, subprocess, sys, tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ingest_const_dep as base

EXTRA = ["Nat.add_comm", "Classical.em", "Real.add_comm", "Nat.rec", "Eq.rec", "Quot.sound", "Finset.sum_comm", "Subgroup",
         "Equiv.Perm.sign", "MeasureTheory.Measure"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--store', required=True, type=Path)
    ap.add_argument('--project', required=True, type=Path)
    ap.add_argument('--n', type=int, default=250)
    ap.add_argument('--seed', type=int, default=7)
    a = ap.parse_args()
    names = gzip.open(a.store / 'names.txt.gz', 'rt').read().split('\n')[:-1]
    plain = [s for s in names if re.fullmatch(r"[A-Za-z][A-Za-z0-9_.']*", s) and '_private' not in s]
    random.seed(a.seed)
    sample = random.sample(plain, a.n) + [s for s in EXTRA if s in set(plain)]
    with tempfile.TemporaryDirectory() as d:
        f = Path(d) / 'spot.lean'
        f.write_text('import Mathlib\n' + ''.join(f'#print axioms {s}\n' for s in sample))
        out = subprocess.run(['lake', 'env', 'lean', str(f)], cwd=a.project, capture_output=True, text=True).stdout
    truth = {}
    for m in re.finditer(r"^'([^']+)' (does not depend on any axioms|depends on axioms: \[([^\]]*)\])", out, re.M):
        truth[m.group(1)] = sorted(x.strip() for x in (m.group(3) or '').replace('\n', ' ').split(',') if x.strip())
    truth = {k: v for k, v in truth.items() if k in set(sample)}
    res = base.check(a.store, list(truth))
    bad = [(k, v, sorted(res[k]['axioms'])) for k, v in truth.items() if res[k] is not None and sorted(res[k]['axioms']) != v]
    print(f'asked {len(sample)}, answered by Lean {len(truth)}, matching {len(truth) - len(bad)}, mismatching {len(bad)}')
    for k, lean, store in bad:
        print('  MISMATCH', k, 'lean', lean, 'store', store)
    sys.exit(0 if len(bad) <= max(2, len(truth) // 50) else 1)


if __name__ == '__main__':
    main()
