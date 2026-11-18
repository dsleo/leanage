#!/usr/bin/env python3
"""Build a compact dependency store from the mathlib-const-dep parquet shards.

Usage:
  python3 scripts/ingest_const_dep.py --shards DIR --out DIR [--check]

Needs pyarrow and numpy. Output files (all little-endian):
  names.txt      declaration names, sorted, one per line; line number = node id
  modules.txt    distinct module names, one per line
  node_module.u32  module index per node (raw uint32)
  degrees.vbyte  out-degree per node, varint
  targets.vbyte  per node: sorted dependency ids, delta-coded, varint
  *.gz           gzip copy of each file above (served to the browser)
  meta.json      counts, sizes, source revision

Dependency lists come from the dataset untyped: a reference in a signature
and one in a proof body look the same. Self-edges and duplicates are dropped.
"""
import argparse, glob, gzip, json, lzma, re, time
from pathlib import Path

import numpy as np
import pyarrow as pa
import pyarrow.compute as pc
import pyarrow.parquet as pq

AXIOMS = ["propext", "Classical.choice", "Quot.sound", "sorryAx", "Lean.ofReduceBool"]
GENERATED = re.compile(r"(^|\.)(_|match_\d|proof_\d|eq_\d|_simp_\d|_sunfold|_unary|_cstage|_boxed|_closed)")


def vbyte(values: np.ndarray) -> bytes:
    """LEB128-style varint for uint values below 2**28, vectorised."""
    v = values.astype(np.uint64)
    assert v.size == 0 or int(v.max()) < (1 << 28)
    n = 1 + (v >= 1 << 7) + (v >= 1 << 14) + (v >= 1 << 21)
    ends = np.cumsum(n)
    out = np.empty(int(ends[-1]) if v.size else 0, dtype=np.uint8)
    starts = ends - n
    for k in range(4):
        mask = n > k
        byte = ((v[mask] >> (7 * k)) & 0x7F).astype(np.uint8)
        byte |= ((n[mask] > k + 1).astype(np.uint8) << 7)
        out[starts[mask] + k] = byte
    return out.tobytes()


def build(shards: Path):
    files = sorted(glob.glob(str(shards / "part-*.parquet")))
    assert files, "no parquet shards found"
    table = pa.concat_tables([pq.read_table(f, columns=["name", "module", "deps"]) for f in files]).combine_chunks()
    names = table["name"].combine_chunks()
    order = pc.sort_indices(names)
    sorted_names = pc.take(names, order)
    n = len(sorted_names)
    assert len(pc.unique(sorted_names)) == n, "duplicate names"
    rank = np.empty(n, dtype=np.uint32)  # original row -> node id
    rank[order.to_numpy()] = np.arange(n, dtype=np.uint32)

    deps = table["deps"].combine_chunks()
    flat = pc.list_flatten(deps)
    parent = pc.list_parent_indices(deps).to_numpy()
    dst = pc.index_in(flat, value_set=sorted_names)
    assert dst.null_count == 0, "dependency target that is not a declaration"
    src = rank[parent]
    dst = dst.to_numpy().astype(np.uint32)
    raw_edges = len(src)

    key = np.unique(src.astype(np.uint64) * n + dst)  # sorts and removes duplicates
    src = (key // n).astype(np.uint32)
    dst = (key % n).astype(np.uint32)
    keep = src != dst
    src, dst = src[keep], dst[keep]

    modules = pc.take(table["module"].combine_chunks(), order)
    mod_dict = pc.dictionary_encode(modules)
    return sorted_names, mod_dict, src, dst, raw_edges


def write(out: Path, sorted_names, mod_dict, src, dst, raw_edges, source, xz=False):
    out.mkdir(parents=True, exist_ok=True)
    n = len(sorted_names)
    names_blob = ("\n".join(sorted_names.to_pylist()) + "\n").encode()
    (out / "names.txt").write_bytes(names_blob)
    (out / "modules.txt").write_text("\n".join(mod_dict.dictionary.to_pylist()) + "\n")
    (out / "node_module.u32").write_bytes(mod_dict.indices.to_numpy(zero_copy_only=False).astype("<u4").tobytes())
    deg = np.bincount(src, minlength=n).astype(np.uint32)
    starts = np.concatenate(([0], np.cumsum(deg.astype(np.int64))))[:-1]
    delta = dst.copy()
    delta[1:] = dst[1:] - dst[:-1]
    has = deg > 0
    delta[starts[has]] = dst[starts[has]]  # first target of each node is absolute
    (out / "degrees.vbyte").write_bytes(vbyte(deg))
    (out / "targets.vbyte").write_bytes(vbyte(delta))
    sizes = {}
    for f in ["names.txt", "modules.txt", "node_module.u32", "degrees.vbyte", "targets.vbyte"]:
        raw = (out / f).read_bytes()
        packed = gzip.compress(raw, 9)
        (out / (f + ".gz")).write_bytes(packed)  # what the browser fetches
        sizes[f] = {"raw": len(raw), "gzip": len(packed)}
        if xz:
            sizes[f]["xz"] = len(lzma.compress(raw, preset=9))
    gen = np.array([bool(GENERATED.search(s)) for s in sorted_names.to_pylist()])
    meta = {
        **source,
        "nodes": n,
        "edges": int(len(dst)),
        "raw_edges_before_dedup_and_selfedges": int(raw_edges),
        "generated_looking_names": int(gen.sum()),
        "edges_between_non_generated_names": int((~gen[src] & ~gen[dst]).sum()),
        "sizes_bytes": sizes,
        "total_gzip_bytes": sum(v["gzip"] for v in sizes.values()),
    }
    if xz:
        meta["total_xz_bytes"] = sum(v["xz"] for v in sizes.values())
    (out / "meta.json").write_text(json.dumps(meta, indent=2) + "\n")
    return meta, deg, gen


class Graph:
    def __init__(self, names, deg, dst):
        self.names = names
        self.index = {s: i for i, s in enumerate(names)}
        self.deg = deg.astype(np.int64)
        self.off = np.concatenate(([0], np.cumsum(self.deg)))
        self.dst = dst

    def closure(self, start: int) -> np.ndarray:
        seen = np.zeros(len(self.names), dtype=bool)
        seen[start] = True
        frontier = np.array([start], dtype=np.int64)
        while frontier.size:
            counts = self.deg[frontier]
            total = int(counts.sum())
            if not total:
                break
            base = np.repeat(self.off[frontier] - np.concatenate(([0], np.cumsum(counts)))[:-1], counts)
            nbrs = self.dst[base + np.arange(total)]
            nbrs = np.unique(nbrs[~seen[nbrs]])
            seen[nbrs] = True
            frontier = nbrs.astype(np.int64)
        return np.flatnonzero(seen)

    def axioms(self, name: str):
        ids = self.closure(self.index[name])
        ax = {self.index[a] for a in AXIOMS if a in self.index}
        return sorted(self.names[i] for i in ids if i in ax), len(ids)


def check(out: Path, sample):
    names = (out / "names.txt").read_text().splitlines()
    deg_blob = (out / "degrees.vbyte").read_bytes()
    # simple decoder for the check only
    def decode(blob):
        vals, cur, shift = [], 0, 0
        for b in blob:
            cur |= (b & 0x7F) << shift
            if b & 0x80:
                shift += 7
            else:
                vals.append(cur); cur = 0; shift = 0
        return np.array(vals, dtype=np.int64)
    deg = decode(deg_blob)
    delta = decode((out / "targets.vbyte").read_bytes())
    dst = np.empty_like(delta)
    pos = 0
    for d in deg:
        if d:
            dst[pos:pos + d] = np.cumsum(delta[pos:pos + d])
            pos += d
    g = Graph(names, deg, dst)
    results = {}
    for name in sample:
        if name not in g.index:
            results[name] = None
            continue
        t = time.perf_counter()
        ax, size = g.axioms(name)
        results[name] = {"axioms": ax, "closure_size": size, "ms": round((time.perf_counter() - t) * 1000, 1)}
    return results


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--shards", required=True, type=Path)
    ap.add_argument("--out", required=True, type=Path)
    ap.add_argument("--dataset", default="mathlib-initiative/mathlib-const-dep")
    ap.add_argument("--mathlib-commit", default="fc4f59e577feb1a4956671bc04ac18aaaf8cd842")
    ap.add_argument("--toolchain", default="leanprover/lean4:v4.36.0")
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--xz", action="store_true", help="also measure xz sizes (slow)")
    a = ap.parse_args()
    t0 = time.perf_counter()
    built = build(a.shards)
    meta, _, _ = write(a.out, *built, {"dataset": a.dataset, "mathlib_commit": a.mathlib_commit, "lean_toolchain": a.toolchain, "built_at_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}, xz=a.xz)
    print(json.dumps({k: v for k, v in meta.items() if k != "sizes_bytes"}, indent=2))
    print("build seconds", round(time.perf_counter() - t0, 1))
    if a.check:
        sample = ["Nat.add_comm", "Nat.rec", "Classical.em", "Classical.choice", "propext", "Real.add_comm", "Nat.Prime.dvd_or_dvd", "Nat.prime_two", "Continuous.comp", "IsCompact.exists_isMinOn", "CategoryTheory.Yoneda.fullyFaithful"]
        print(json.dumps(check(a.out, sample), indent=2))


if __name__ == "__main__":
    main()
