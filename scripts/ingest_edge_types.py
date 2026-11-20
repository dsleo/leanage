#!/usr/bin/env python3
"""Turn the output of scripts/extract_edges.lean into the per-edge type file of the Leanage store.

  --tsv    output of extract_edges.lean (`name<TAB>type deps<TAB>value deps<TAB>kind letter`, lists joined by U+001F;
           first line `# lean <version> <githash>`)
  --store  directory with names.txt.gz, degrees.vbyte.gz, targets.vbyte.gz and meta.json (default public/store)
  --out    output directory (default public/store)

Writes edgetypes.u8 (+ .gz): one byte per store edge, in the order of targets.vbyte (node id order, targets
sorted ascending within a node), and edgetypes.json (+ .gz): legend, commit, lean version, counts, agreement.
Byte: bit0 = target appears in the TYPE of the source, bit1 = target appears in its VALUE,
bit2 = (with bit1) the source is a definition, so its value is part of what it means (not a theorem or opaque), bit7 = the store has
this edge but Lean's output does not (then bits 0 and 1 are 0).
"""
import argparse, gzip, json, os
import numpy as np


def read(path):
    if os.path.exists(path + '.gz'):
        return gzip.open(path + '.gz', 'rb').read()
    return open(path, 'rb').read()


def decode_varints(buf, count):
    b = np.frombuffer(buf, dtype=np.uint8)
    last = (b & 0x80) == 0
    assert int(last.sum()) == count, f'expected {count} varints, found {int(last.sum())}'
    group = np.cumsum(last) - last  # index of the varint each byte belongs to
    start = np.concatenate(([0], np.flatnonzero(last)[:-1] + 1))
    pos = np.arange(len(b)) - start[group]
    contrib = (b & 0x7F).astype(np.uint64) << (7 * pos).astype(np.uint64)
    return np.bincount(group, weights=contrib.astype(np.float64), minlength=count).astype(np.uint64)  # exact below 2**53


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--tsv', required=True)
    ap.add_argument('--store', default='public/store')
    ap.add_argument('--out', default='public/store')
    a = ap.parse_args()

    names = read(os.path.join(a.store, 'names.txt')).decode('utf-8').split('\n')
    if names and names[-1] == '':
        names.pop()
    n = len(names)
    meta = json.load(open(os.path.join(a.store, 'meta.json')))
    index = {s: i for i, s in enumerate(names)}
    deg = decode_varints(read(os.path.join(a.store, 'degrees.vbyte')), n).astype(np.int64)
    total = int(deg.sum())
    assert total == meta['edges'], (total, meta['edges'])
    tgt = decode_varints(read(os.path.join(a.store, 'targets.vbyte')), total).astype(np.int64)
    start = np.concatenate(([0], np.cumsum(deg)))
    for i in np.flatnonzero(deg):  # undo the delta coding per node
        lo, hi = start[i], start[i + 1]
        tgt[lo:hi] = np.cumsum(tgt[lo:hi])

    out = np.full(total, 0x80, dtype=np.uint8)
    lean_header = ''
    seen_nodes = 0
    extra_nodes = 0
    lean_edges = lean_self = lean_missing_target = lean_not_in_store = 0
    # per-source-kind breakdown of store edges absent from Lean
    with open(a.tsv, encoding='utf-8') as f:
        for line in f:
            line = line.rstrip('\n')
            if line.startswith('# '):
                lean_header = line[2:]
                continue
            name, _, rest = line.partition('\t')
            ty, _, rest = rest.partition('\t')
            va, _, kind = rest.partition('\t')
            isdef = 4 if kind == 'd' else 0
            i = index.get(name)
            if i is None:
                extra_nodes += 1
                continue
            seen_nodes += 1
            tset = {index.get(s) for s in ty.split('\x1f')} if ty else set()
            vset = {index.get(s) for s in va.split('\x1f')} if va else set()
            miss = (None in tset) + (None in vset)
            tset.discard(None); vset.discard(None)
            lean_missing_target += miss
            if i in tset or i in vset:
                lean_self += 1
                tset.discard(i); vset.discard(i)
            lo, hi = int(start[i]), int(start[i + 1])
            lean_edges += len(tset | vset)
            hit = 0
            for k in range(lo, hi):
                t = int(tgt[k])
                bits = (1 if t in tset else 0) | (2 if t in vset else 0)
                if bits & 2:
                    bits |= isdef
                if bits & 3:
                    out[k] = bits
                    hit += 1
            lean_not_in_store += len(tset | vset) - hit
    b = out
    defval = int(np.count_nonzero(b & 4))
    both = int(((b & 3) == 3).sum()); tonly = int((b == 1).sum()); vonly = int((b == 2).sum())
    absent = int(np.count_nonzero(b & 0x80))
    stats = {
        'store_edges': total,
        'type_only': tonly, 'value_only': vonly, 'type_and_value': both,
        'value_edges_of_definitions': defval,
        'in_store_not_in_lean': absent,
        'in_lean_not_in_store': lean_not_in_store,
        'lean_edges_excluding_self': lean_edges,
        'lean_self_edges_dropped': lean_self,
        'lean_names_not_in_store': lean_missing_target,
        'store_agreement_pct': round(100 * (total - absent) / total, 4),
        'lean_agreement_pct': round(100 * (lean_edges - lean_not_in_store) / max(lean_edges, 1), 4),
    }
    legend = {
        'mathlib_commit': meta.get('mathlib_commit'),
        'lean': lean_header,
        'bits': {'0': 'type', '1': 'value', '2': 'value_of_definition', '7': 'not_seen_by_lean_extraction'},
        'order': 'one byte per edge of targets.vbyte (node id order, targets ascending)',
        'nodes': n,
        'edges': total,
        'lean_constants_not_in_store': extra_nodes,
        'nodes_seen_in_lean': seen_nodes,
        'counts': stats,
    }
    os.makedirs(a.out, exist_ok=True)
    for fname, data in (('edgetypes.u8', out.tobytes()), ('edgetypes.json', (json.dumps(legend, indent=2) + '\n').encode())):
        with open(os.path.join(a.out, fname), 'wb') as f:
            f.write(data)
        with gzip.GzipFile(os.path.join(a.out, fname + '.gz'), 'wb', mtime=0) as f:
            f.write(data)
    print(json.dumps(legend, indent=2))


if __name__ == '__main__':
    main()
