#!/usr/bin/env python3
"""Per-declaration tactic bitmask (tactics.u16 / tactics.json) from Lean's declaration ranges and a lexical scan of the source.

Replaces the join with the mathlib-tactics dataset (whose rows are tied to one Mathlib commit) for any commit and any library:

  python3 -I scripts/ingest_tactics_ranges.py --store DIR --ranges mathlib.tsv.ranges [--ranges tauceti.ranges ...] \\
      --root MATHLIB_DIR --root TAUCETI_DIR --root LEAN_SRC_DIR --mathlib-commit <40 hex> --out DIR

--ranges  files of `name<TAB>module<TAB>first-last` (written by scripts/extract_env.lean and extract_library_stream.lean): the lines of
          each declaration, from Lean itself.
--root    source directories; module A.B.C is looked up as ROOT/A/B/C.lean in each, first hit wins.
--store   the store (names.txt.gz, modules.txt.gz, node_module.u32.gz) the output is aligned to. A range counts only if the module in the
          file is the module the store gives that name (duplicate names dropped at ingest therefore stay unknown).

Same format as ingest_tactics.py: one little-endian u16 per node, bit 15 = covered (the declaration has a range and its source file was
read), bits 0..11 = tactic labels. A node without the covered bit has NO tactic data, which is not the same as "no tactics".
The scan is scripts/ingest_tactics_core.py's `scan`: a keyword counts only at the start of a tactic step, never in comments, strings,
quotations or names.

--compare TRUTH_DIR  also prints, per label, agreement with another tactics.u16(.gz) + tactics.json(.gz) over the nodes covered in both
                     (use it on the store the truth was built for, to calibrate the scan).
--labels a,b,c       only keep these labels in the output (default: all twelve).
"""
import argparse, collections, gzip, json, os, struct, sys, time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ingest_tactics as it  # noqa: E402
import ingest_tactics_core as core  # noqa: E402
import bisect, re  # noqa: E402

# Term-mode uses the calibration against mathlib-tactics found (`by_contra fun h => ...` is the library function, not the tactic; so is
# `by_cases (fun h => ...) fun h => ...`; `(induction := false)` and `exfalso : Bool := true` are names, not steps). Each rule only removes a
# match, and was checked against the dataset: see scripts/calibrate_tactics_ranges.py and docs/STORE_TACTICS_PLAN.md.
TERM_BY_CONTRA = re.compile(r'!?\s*(fun\b|λ|\(\s*fun\b|<\||\$)')
TERM_BY_CASES = re.compile(r'!?\s*(fun\b|λ|\(\s*fun\b|\(\s*by\b|<\||\$|Or\.|$)')


def term_form(bit, rest):
    r = rest.lstrip()
    if r.startswith(':='):  # (induction := false)
        return True
    if bit == 7 and r.startswith(':'):  # exfalso : Bool
        return True
    if bit == 5 and TERM_BY_CONTRA.match(rest):
        return True
    return bit == 4 and bool(TERM_BY_CASES.match(rest))


def scan(text):
    """core.scan with the term-mode rules above (same tactic-step logic otherwise)."""
    text = core.blank_quotations(text)
    iv = None
    mask = 0
    for m in core.KW_RE.finditer(text):
        bit = next((int(k[1:]) for k, v in m.groupdict().items() if v is not None), None)
        if bit is None or mask & (1 << bit):
            continue
        s = m.start()
        ls = text.rfind('\n', 0, s) + 1
        pre = text[ls:s]
        if pre.strip() == '' or core.BULLET.match(pre):
            pass
        elif not core.START_TAIL.search(pre[-80:]):
            continue
        le = text.find('\n', m.end())
        if term_form(bit, text[m.end(): le if le >= 0 else len(text)]):
            continue
        if bit == 11:
            if iv is None:
                iv = core.by_intervals(text)
            k = bisect.bisect_right(iv, (s, 1 << 60)) - 1
            if not any(a <= s < b for a, b in iv[max(0, k - 40):k + 1]):
                continue
            if pre.strip() == '' or core.BULLET.match(pre):
                prev, p = '', ls - 1
                while p > 0:
                    q = text.rfind('\n', 0, p)
                    prev = text[q + 1:p].rstrip()
                    if prev:
                        break
                    p = q
                if prev.endswith((':=', '←', '<|', '$', ',', 'fun', 'then', 'else')) or prev.endswith('=> fun'):
                    continue
        mask |= 1 << bit
    return mask

COVERED = it.COVERED
BITS = {b: label for b, label, _ in it.BITS}


def read_u16(directory):
    for name in ('tactics.u16', 'tactics.u16.gz'):
        p = os.path.join(directory, name)
        if os.path.exists(p):
            raw = gzip.open(p).read() if name.endswith('.gz') else open(p, 'rb').read()
            return struct.unpack('<%dH' % (len(raw) // 2), raw)
    raise SystemExit('no tactics.u16 in ' + directory)


def find_source(roots, module, cache):
    if module not in cache:
        rel = os.path.join(*module.split('.')) + '.lean'
        cache[module] = next((os.path.join(r, rel) for r in roots if os.path.isfile(os.path.join(r, rel))), None)
    return cache[module]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--store', required=True)
    ap.add_argument('--ranges', required=True, action='append')
    ap.add_argument('--root', required=True, action='append')
    ap.add_argument('--mathlib-commit', required=True)
    ap.add_argument('--extra', action='append', default=[], help='KEY=VALUE recorded in tactics.json (for example tauceti_commit=...)')
    ap.add_argument('--out', required=True)
    ap.add_argument('--labels', default=','.join(BITS.values()))
    ap.add_argument('--compare')
    a = ap.parse_args()
    keep = 0
    for label in a.labels.split(','):
        keep |= 1 << next(b for b, l in BITS.items() if l == label)
    t0 = time.time()
    names, modules, nm, by_module = core.load_store(a.store)
    bits = [0] * len(names)
    rows = collections.defaultdict(list)
    for rf in a.ranges:
        with open(rf, encoding='utf-8') as f:
            for line in f:
                name, mod, rng = line.rstrip('\n').split('\t')
                i = by_module.get(mod, {}).get(name)
                if i is None:
                    continue  # not this store's node (dropped duplicate, or defined in another module)
                s, e = rng.split('-')
                rows[mod].append((i, int(s), int(e)))
    print('ranges for %d nodes in %d modules (%.0fs)' % (sum(map(len, rows.values())), len(rows), time.time() - t0), file=sys.stderr)
    cache, no_file, covered = {}, 0, 0
    for k, (mod, items) in enumerate(rows.items()):
        path = find_source(a.root, mod, cache)
        if path is None:
            no_file += len(items)
            continue
        with open(path, encoding='utf-8', errors='replace') as fh:
            lines = it.strip_comments(fh.read()).split('\n')
        for i, s, e in items:
            if s < 1 or e > len(lines) or e < s:
                no_file += 1
                continue
            bits[i] = COVERED | (scan('\n'.join(lines[s - 1:e])) & keep)
            covered += 1
        if k % 5000 == 0:
            print('  %d/%d modules (%.0fs)' % (k, len(rows), time.time() - t0), file=sys.stderr)
    os.makedirs(a.out, exist_ok=True)
    blob = struct.pack('<%dH' % len(bits), *bits)
    open(os.path.join(a.out, 'tactics.u16'), 'wb').write(blob)
    with gzip.GzipFile(os.path.join(a.out, 'tactics.u16.gz'), 'wb', mtime=0) as g:
        g.write(blob)
    per_label = {l: sum(1 for x in bits if x & (1 << b)) for b, l in BITS.items() if keep & (1 << b)}
    legend = {
        'dataset': 'Leanage source scan (scripts/ingest_tactics_ranges.py)',
        'mathlib_commit': a.mathlib_commit,
        'covered_bit': 15,
        'bits': {str(b): l for b, l in BITS.items() if keep & (1 << b)},
        'method': "declaration line ranges from Lean (declRangeExt); each declaration's source lines are scanned for tactic keywords at the start of a tactic step, never in comments, strings, quotations or names. A node without the covered bit has no tactic data.",
        'nodes': len(names),
        'covered_nodes': covered,
        'ranges_without_source': no_file,
        'declarations_with_label': per_label,
    }
    for kv in a.extra:
        k, v = kv.split('=', 1)
        legend[k] = v
    json.dump(legend, open(os.path.join(a.out, 'tactics.json'), 'w'), indent=2)
    with gzip.GzipFile(os.path.join(a.out, 'tactics.json.gz'), 'wb', mtime=0) as g:
        g.write(json.dumps(legend, indent=2).encode())
    print('covered %d of %d nodes, %d ranges without a source line (%.0fs)' % (covered, len(names), no_file, time.time() - t0), file=sys.stderr)
    print(json.dumps(per_label), file=sys.stderr)

    if a.compare:
        truth = read_u16(a.compare)
        tl = json.load(open(os.path.join(a.compare, 'tactics.json')) if os.path.exists(os.path.join(a.compare, 'tactics.json')) else gzip.open(os.path.join(a.compare, 'tactics.json.gz')))
        tbit = {l: int(b) for b, l in tl['bits'].items()}
        both = [i for i in range(len(names)) if bits[i] & COVERED and truth[i] & COVERED]
        print('compared on %d nodes covered in both (scan covers %d, truth covers %d)' % (len(both), covered, sum(1 for x in truth if x & COVERED)))
        print('%-11s %7s %7s %7s  %9s %9s' % ('label', 'tp', 'fp', 'fn', 'precision', 'recall'))
        for b, l in BITS.items():
            if not keep & (1 << b) or l not in tbit:
                continue
            tp = fp = fn = 0
            for i in both:
                mine, theirs = bool(bits[i] & (1 << b)), bool(truth[i] & (1 << tbit[l]))
                tp += mine and theirs
                fp += mine and not theirs
                fn += theirs and not mine
            print('%-11s %7d %7d %7d  %9s %9s' % (l, tp, fp, fn, '%.4f' % (tp / (tp + fp)) if tp + fp else '-', '%.4f' % (tp / (tp + fn)) if tp + fn else '-'))


if __name__ == '__main__':
    main()
