#!/usr/bin/env python3
"""Check that hiding compiler-generated declarations never loses a real declaration.

Usage: python3 scripts/check_generated_contraction.py [--store public/store] [--n 200] [--seed 0]

For a sample of declarations it computes the dependency closure
  A. over the full graph,
  B. over the contracted graph (generated nodes removed, edges rewired through
     them: u -> g1 -> ... -> gk -> v becomes u -> v, never dropped),
  C. over the owner-merged graph (what the UI's ownerName display implies: each
     generated node whose owner exists in the store is identified with its owner),
and compares the sets of non-generated declarations.
Expected: A == B exactly (contraction is correct by construction), C is a superset
of A (merging can only add paths, never lose them). Also reports generated nodes
whose ownerName is not in the store.

The GENERATED regex and owner_name mirror src/closureData.ts.
"""
import argparse, collections, gzip, json, random, re
from pathlib import Path

import numpy as np

GENERATED = re.compile(r"(^|\.)(_[^.]*|(?:match|proof|eq|congr_eq|hcongr|unsafe|unsafe_impl)_\d+|eq_def|eq_unfold)(?=\.|$)")
PART = re.compile(r"^(_|(match|proof|eq|congr_eq|hcongr|unsafe|unsafe_impl)_\d+$|eq_def$|eq_unfold$)")
PRIVATE = re.compile(r"^_private\..*?\.0\.")
FIXED = ["Nat.add_comm", "Nat.Prime.dvd_or_dvd", "Continuous.comp", "IsCompact.exists_isMinOn", "Classical.em",
         "Nat.rec", "Nat.prime_two", "Real.add_comm", "List.map", "Finset.sum_comm"]


def owner_name(name: str) -> str:
    name = PRIVATE.sub("", name)
    parts = name.split(".")
    end = len(parts)
    while end > 0 and PART.match(parts[end - 1]):
        end -= 1
    return name if end == 0 else ".".join(parts[:end])


def decode_vbyte(blob: bytes) -> np.ndarray:
    b = np.frombuffer(blob, dtype=np.uint8)
    last = np.flatnonzero(b < 128)  # final byte of each value
    start = np.concatenate(([0], last[:-1] + 1))
    pos = np.arange(len(b)) - np.repeat(start, last - start + 1)
    contrib = (b & 0x7F).astype(np.int64) << (7 * pos)
    return np.add.reduceat(contrib, start)


def load(store: Path):
    rd = lambda f: gzip.open(store / (f + ".gz")).read()
    names = rd("names.txt").decode().split("\n")
    if names[-1] == "":
        names.pop()
    deg = decode_vbyte(rd("degrees.vbyte"))
    delta = decode_vbyte(rd("targets.vbyte"))
    starts = np.concatenate(([0], np.cumsum(deg)))[:-1]
    has = deg > 0
    # undo delta coding: first target per node absolute, rest relative
    seg = np.repeat(np.arange(len(deg))[has], deg[has])
    csum = np.cumsum(delta)
    base = np.zeros(len(deg) + 1, dtype=np.int64)
    first = starts[has]
    prev = np.where(first > 0, csum[first - 1], 0)
    dst = csum - prev[np.searchsorted(first, np.arange(len(delta)), side="right") - 1]
    src = np.repeat(np.arange(len(deg)), deg)
    return names, src.astype(np.int64), dst.astype(np.int64)


class CSR:
    def __init__(self, n, src, dst):
        order = np.argsort(src, kind="stable")
        self.dst = dst[order]
        self.deg = np.bincount(src, minlength=n).astype(np.int64)
        self.off = np.concatenate(([0], np.cumsum(self.deg)))
        self.n = n

    def expand(self, nodes):
        c = self.deg[nodes]
        tot = int(c.sum())
        if not tot:
            return np.empty(0, dtype=np.int64), c
        base = np.repeat(self.off[nodes] - (np.cumsum(c) - c), c)
        return self.dst[base + np.arange(tot)], c

    def closure(self, start):
        seen = np.zeros(self.n, dtype=bool)
        seen[start] = True
        fr = np.array([start], dtype=np.int64)
        while fr.size:
            nb, _ = self.expand(fr)
            nb = np.unique(nb[~seen[nb]])
            seen[nb] = True
            fr = nb
        return seen


def contract(n, src, dst, gen):
    """Edges among real nodes, rewired through generated chains."""
    rr = ~gen[src] & ~gen[dst]
    out_s, out_d = [src[rr]], [dst[rr]]
    full = CSR(n, src, dst)
    m = ~gen[src] & gen[dst]
    pr, pg = src[m], dst[m]
    key = np.unique(pr * n + pg)
    seen = key
    rounds = 0
    while key.size:
        rounds += 1
        r, g = key // n, key % n
        tg, c = full.expand(g)
        rr_ = np.repeat(r, c)
        real = ~gen[tg]
        out_s.append(rr_[real]); out_d.append(tg[real])
        nk = np.unique(rr_[~real] * n + tg[~real])
        key = np.setdiff1d(nk, seen, assume_unique=True)
        seen = np.union1d(seen, key)
    s, d = np.concatenate(out_s), np.concatenate(out_d)
    k = np.unique(s * n + d)
    return k // n, k % n, rounds


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--store", default="public/store", type=Path)
    ap.add_argument("--n", type=int, default=200)
    ap.add_argument("--seed", type=int, default=0)
    a = ap.parse_args()
    names, src, dst = load(a.store)
    n = len(names)
    idx = {s: i for i, s in enumerate(names)}
    gen = np.array([bool(GENERATED.search(PRIVATE.sub("", s))) for s in names])
    print(f"nodes {n}, edges {len(src)}, generated {int(gen.sum())}")

    # owner lookup for generated nodes
    missing = [i for i in np.flatnonzero(gen) if owner_name(names[i]) not in idx]
    print(f"generated nodes whose ownerName is not in the store: {len(missing)} of {int(gen.sum())}")
    shape = collections.Counter(re.sub(r"\d+", "N", names[i].rsplit(".", 1)[-1]) for i in missing)
    print("  by last component:", shape.most_common(8))
    print("  examples:", [(names[i], owner_name(names[i])) for i in missing[:5]])
    print("  owner == name (all components generated):", sum(owner_name(names[i]) == names[i] for i in missing))

    full = CSR(n, src, dst)
    cs, cd, rounds = contract(n, src, dst, gen)
    cont = CSR(n, cs, cd)
    print(f"contracted graph: {len(cs)} edges among {int((~gen).sum())} real nodes (rewire rounds {rounds}); real-real edges in full graph {int((~gen[src] & ~gen[dst]).sum())}")

    # owner-merged graph: generated node -> owner if the owner exists
    rep = np.arange(n)
    for i in np.flatnonzero(gen):
        o = idx.get(owner_name(names[i]))
        if o is not None:
            rep[i] = o
    ms, md = rep[src], rep[dst]
    k = ms != md
    merged = CSR(n, ms[k], md[k])

    rng = random.Random(a.seed)
    pool = [i for i in range(n) if not gen[i] and full.deg[i] > 0]
    sample = [idx[s] for s in FIXED if s in idx] + rng.sample(pool, a.n - len([s for s in FIXED if s in idx]))
    lost_total = extra_total = 0
    lost_examples, rows = [], []
    for r in sample:
        A = full.closure(r) & ~gen
        B = cont.closure(r) & ~gen
        C = merged.closure(rep[r])
        C = C & (rep == np.arange(n)) & ~gen  # real nodes only
        lost = int((A & ~B).sum()); extra_b = int((B & ~A).sum())
        lost_m = int((A & ~C).sum()); extra = int((C & ~A).sum())
        lost_total += lost + lost_m
        extra_total += extra + extra_b
        if lost or lost_m or extra_b:
            lost_examples.append((names[r], lost, lost_m, extra_b))
        rows.append((int(A.sum()), int((full.closure(r) & gen).sum()), extra))
    arr = np.array(rows)
    print(f"sampled roots: {len(sample)}")
    print(f"real closure size: median {int(np.median(arr[:, 0]))}, max {int(arr[:, 0].max())}; generated nodes hidden per closure: median {int(np.median(arr[:, 1]))}, max {int(arr[:, 1].max())}")
    print(f"real declarations unreachable after contraction or owner-merge: {lost_total}")
    print(f"extra real declarations reachable only after owner-merge (over-approximation): total {extra_total}, roots affected {int((arr[:, 2] > 0).sum())}, max per root {int(arr[:, 2].max())}")
    for e in lost_examples[:10]:
        print("  mismatch", e)
    print(json.dumps({"roots": len(sample), "lost": lost_total, "extra_after_owner_merge": extra_total}))


if __name__ == "__main__":
    main()
