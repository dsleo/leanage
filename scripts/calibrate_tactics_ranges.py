#!/usr/bin/env python3
"""Calibrates the source scan (ingest_tactics_ranges.py) against the tactics Lean actually ran (mathlib-tactics), on the commit that dataset is for.

  python3 -I scripts/calibrate_tactics_ranges.py --store OLD_STORE --ranges old-env.tsv.ranges --shards tactics-hf --scan DIR_WITH_tactics.u16

Ground truth is built here, not taken from the old tactics.u16: every dataset row (module, start line, elaborator) is mapped to a label and
attributed to every declaration whose Lean range contains the row's line (the same ranges the scan uses, so the comparison isolates the scan).
The elaborator names are normalised first (the dataset writes some as «_aux_..._:__2», which the old suffix match missed: that is why the old
by_cases / by_contra bits were incomplete). Nodes are compared when the scan covers them and they belong to a package the dataset has rows for.

Prints, per label: true/false positives and false negatives of the scan, precision and recall.
"""
import argparse, collections, glob, gzip, json, os, struct, sys

import pyarrow.parquet as pq

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ingest_tactics as it  # noqa: E402
import ingest_tactics_core as core  # noqa: E402

BITS = {b: (l, s) for b, l, s in it.BITS}


def label_of(elaborator):
    e = elaborator.replace('«', '').replace('»', '')
    for b, (_, suffixes) in BITS.items():
        if any(e.endswith(s) for s in suffixes):
            return b
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--store', required=True)
    ap.add_argument('--ranges', required=True)
    ap.add_argument('--shards', required=True)
    ap.add_argument('--scan', required=True)
    ap.add_argument('--json')
    a = ap.parse_args()
    names, modules, nm, by_module = core.load_store(a.store)
    raw = gzip.open(os.path.join(a.scan, 'tactics.u16.gz')).read() if os.path.exists(os.path.join(a.scan, 'tactics.u16.gz')) else open(os.path.join(a.scan, 'tactics.u16'), 'rb').read()
    scan = struct.unpack('<%dH' % (len(raw) // 2), raw)
    # declaration ranges per module: line -> node ids whose range contains it
    cover = collections.defaultdict(lambda: collections.defaultdict(list))
    for line in open(a.ranges, encoding='utf-8'):
        name, mod, rng = line.rstrip('\n').split('\t')
        i = by_module.get(mod, {}).get(name)
        if i is None:
            continue
        s, e = map(int, rng.split('-'))
        for ln in range(s, e + 1):
            cover[mod][ln].append(i)
    truth = collections.defaultdict(int)  # node -> label mask
    rows = collections.Counter()
    roots = set()  # top-level packages the dataset has rows for: elsewhere (Init, Std, Lean, Batteries, ...) it says nothing
    for f in sorted(glob.glob(os.path.join(a.shards, 'part-*.parquet'))):
        t = pq.read_table(f, columns=['module', 'startPos', 'elaborator'])
        mods, sp, el = t.column('module').to_pylist(), t.column('startPos').to_pylist(), t.column('elaborator').to_pylist()
        roots.update(m.split('.')[0] for m in set(mods) if m)
        for m, p, e in zip(mods, sp, el):
            if m not in cover:
                continue
            b = label_of(e)
            if b is None:
                continue
            rows[b] += 1
            for i in cover[m].get(p['line'], ()):
                truth[i] |= 1 << b
    both = [i for i in range(len(names)) if scan[i] & it.COVERED and modules[nm[i]].split('.')[0] in roots]
    print('packages with dataset rows:', sorted(roots))
    print('nodes the scan covers: %d; dataset rows by label: %s' % (len(both), {BITS[b][0]: n for b, n in sorted(rows.items())}))
    print('%-11s %7s %7s %7s  %9s %9s' % ('label', 'tp', 'fp', 'fn', 'precision', 'recall'))
    result = {}
    for b, (label, _) in sorted(BITS.items()):
        tp = fp = fn = 0
        fps, fns = [], []
        for i in both:
            mine, theirs = bool(scan[i] & (1 << b)), bool(truth.get(i, 0) & (1 << b))
            if mine and theirs: tp += 1
            elif mine: fp += 1; fps.append(names[i])
            elif theirs: fn += 1; fns.append(names[i])
        prec = tp / (tp + fp) if tp + fp else None
        rec = tp / (tp + fn) if tp + fn else None
        result[label] = {'tp': tp, 'fp': fp, 'fn': fn, 'precision': prec, 'recall': rec, 'fp_examples': fps[:60], 'fn_examples': fns[:60]}
        print('%-11s %7d %7d %7d  %9s %9s' % (label, tp, fp, fn, '%.4f' % prec if prec is not None else '-', '%.4f' % rec if rec is not None else '-'))
    for label, r in result.items():
        if r['fp_examples']: print('FP', label, r['fp_examples'])
        if r['fn_examples']: print('FN', label, r['fn_examples'])
    if a.json:
        json.dump({'nodes_compared': len(both), 'rows': {BITS[b][0]: n for b, n in rows.items()}, 'labels': result}, open(a.json, 'w'), indent=2)


if __name__ == '__main__':
    main()
