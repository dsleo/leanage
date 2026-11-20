#!/usr/bin/env python3
"""Build the whole Leanage store (graph, edge types, boilerplate flags) from the output of scripts/extract_env.lean.

  python3 scripts/ingest_env_tsv.py --tsv env.tsv [--tsv library.tsv ...] --out DIR --mathlib-commit <40 hex> --toolchain leanprover/lean4:v4.37.0-rc1

Several --tsv files are merged into one store (for example Mathlib from extract_env.lean, then a library from extract_library*.lean
whose declarations reference Mathlib's). Rows with 5 columns (no flags) leave the flags of those nodes unknown. References to names
that are in no file are dropped and counted in meta.json (`unresolved_refs`).

Same output files as ingest_const_dep.py + ingest_edge_types.py + ingest_flags.py, for a commit that has no
mathlib-const-dep shards. The graph is the union of type and value references, as in the dataset.
"""
import argparse, gzip, subprocess, sys, tempfile, time
from array import array
from pathlib import Path

import numpy as np
import pyarrow as pa
import pyarrow.compute as pc

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ingest_const_dep as base


def opener(tsv: Path):
    return gzip.open(tsv, 'rt', encoding='utf-8') if str(tsv).endswith('.gz') else open(tsv, encoding='utf-8')


def lines(tsvs):
    """name, type deps, value deps, kind, module, flags (None when the file has no flags column)."""
    for tsv in tsvs:
        with opener(tsv) as f:
            for line in f:
                line = line.rstrip('\n')
                if line.startswith('#'):
                    continue
                c = line.split('\t')
                yield c[0], c[1], c[2], c[3], c[4], (c[5] if len(c) > 5 else None)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--tsv', required=True, type=Path, action='append')
    ap.add_argument('--out', required=True, type=Path)
    ap.add_argument('--mathlib-commit', required=True)
    ap.add_argument('--toolchain', required=True)
    ap.add_argument('--source', default='Lean extraction (scripts/extract_env.lean)')
    a = ap.parse_args()
    t0 = time.time()
    header = next(iter(opener(a.tsv[0]))).rstrip('\n')[2:]
    names, mods, seen = [], [], set()
    dropped = 0
    for f in lines(a.tsv):  # pass 1: names and modules (streamed; the dependency strings never sit in memory together)
        if f[0] in seen:  # generated lemmas (congr_simp, eq_1, ...) are realized again in every module that needs them: keep the first
            dropped += 1
            continue
        seen.add(f[0]); names.append(f[0]); mods.append(f[4])
    del seen
    n = len(names)
    arr = pa.array(names, type=pa.string())
    order = pc.sort_indices(arr)
    sorted_names = pc.take(arr, order)
    assert len(pc.unique(sorted_names)) == n, 'duplicate names'
    rank = np.empty(n, dtype=np.uint32)
    rank[order.to_numpy()] = np.arange(n, dtype=np.uint32)
    ident = {s: int(rank[i]) for i, s in enumerate(names)}
    srcs, dsts = array('I'), array('I')
    tmp = tempfile.TemporaryDirectory()
    ef, ff = open(Path(tmp.name) / 'edges.tsv', 'w', encoding='utf-8'), open(Path(tmp.name) / 'flags.tsv', 'w', encoding='utf-8')
    ef.write(f'# {header}\n'); ff.write(f'# {header}\n')
    unresolved = 0
    done = set()
    for name, ty, va, kind, _mod, fl in lines(a.tsv):  # pass 2: edges
        if name in done:
            continue
        done.add(name)
        i = ident[name]
        for lst in (ty, va):
            if lst:
                for t in lst.split('\x1f'):
                    j = ident.get(t)
                    if j is None:
                        unresolved += 1
                        continue
                    srcs.append(i); dsts.append(j)
        ef.write(f'{name}\t{ty}\t{va}\t{kind}\n')
        if fl is not None:
            ff.write(f'{name}\t{fl}\n')
    ef.close(); ff.close()
    src = np.frombuffer(srcs, dtype=np.uint32); dst = np.frombuffer(dsts, dtype=np.uint32)
    raw_edges = len(src)
    key = np.unique(src.astype(np.uint64) * n + dst)
    src = (key // n).astype(np.uint32)
    dst = (key % n).astype(np.uint32)
    keep = src != dst
    src, dst = src[keep], dst[keep]
    mod_dict = pc.dictionary_encode(pc.take(pa.array(mods, type=pa.string()), order))
    source = {'dataset': a.source, 'mathlib_commit': a.mathlib_commit, 'lean_toolchain': a.toolchain, 'lean': header,
              'built_at_utc': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'unresolved_refs': unresolved, 'duplicate_names_dropped': dropped}
    meta, _, _ = base.write(a.out, sorted_names, mod_dict, src, dst, raw_edges, source)
    print({k: v for k, v in meta.items() if k != 'sizes_bytes'})
    here = Path(__file__).resolve().parent
    for script, tsv in (('ingest_edge_types.py', 'edges.tsv'), ('ingest_flags.py', 'flags.tsv')):
        subprocess.run([sys.executable, '-I', str(here / script), '--tsv', str(Path(tmp.name) / tsv), '--store', str(a.out), '--out', str(a.out)],
                       check=True, stdout=subprocess.DEVNULL)
    tmp.cleanup()
    print('done in', round(time.time() - t0, 1), 's;', n, 'nodes,', len(dst), 'edges')


if __name__ == '__main__':
    main()
