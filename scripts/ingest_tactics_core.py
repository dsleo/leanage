#!/usr/bin/env python3
"""Add tactic evidence for core Lean declarations (modules Init.*, Std.*, Lean.*) to tactics.u16/json.

mathlib-tactics only covers Mathlib. For the Lean toolchain sources we have no elaborator data, so this
script scans the source with the SAME declaration parser/join as scripts/ingest_tactics.py but detects
tactic uses lexically (a keyword counts only at a tactic-step start inside a `by` block, never in
comments, strings, quotations, identifiers or `induction'`-style names).

The scan is calibrated on Mathlib: for every Mathlib declaration resolved by ingest_tactics.py, the scan
result is compared with the elaborator ground truth already stored in the Mathlib tactics.u16. A tactic bit is
written for core only if its Mathlib precision >= --min-precision (default 0.99) with enough support.
Semantics are unchanged: COVERED + no bit = the source has no such tactic; no COVERED = unknown.
Core declarations are covered only when parsed and resolved unambiguously (same rule as Mathlib).

Run order: ingest_tactics.py first (writes Mathlib tactics.u16 into --base), then this script.
Output: tactics.u16/.gz and tactics.json/.gz in --out (Mathlib bits copied unchanged from --base).
"""
import argparse, bisect, collections, gzip, json, os, pickle, re, struct, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ingest_tactics as it  # noqa: E402

COVERED = it.COVERED
LABELS = {b: l for b, l, _ in it.BITS}
# bit -> keyword regex (alternatives are whole words; a trailing ! is allowed where Mathlib has a `!` variant)
KW = {
    0: r'induction|fun_induction',
    1: r'cases',
    2: r'rcases',
    3: r'obtain',
    4: r'by_cases!?',
    5: r'by_contra!?',
    6: r'contrapose!?',
    7: r'exfalso',
    8: r'fin_cases|interval_cases|casesm',
    9: r'split_ifs',
    10: r'rintro',
    11: r'match',
}
KW_RE = re.compile(r"(?<![\w'.!?`@#$«])(" + '|'.join('(?P<b%d>%s)' % (b, r) for b, r in KW.items()) + r")(?![\w'!?.»])")
START_TAIL = re.compile(
    r"(?:\bby|;|<;>|=>|·|\(|\{|\btry|\ball_goals|\bany_goals|\bfirst|<\|>|\bthen|\belse|\bnext|\brepeat|\bfocus|\bswap|\bdecreasing_by|\biterate\s+\d+|\bcase\b[^\n]*=>|\bon_goal\b[^\n]*=>|\|)\s*$")
BULLET = re.compile(r'^\s*[·.]\s*$')
BY = re.compile(r"(?<![\w'.])(?:by|decreasing_by)(?![\w'])")
QUOTE = re.compile(r"`\((?:\w+\|)?")
CHAR = re.compile(r"(?<![\w'])'(?:\\.[0-9a-fA-F]*|[^\\'\n])'")
OPEN, CLOSE = '([{⟨', ')]}⟩'


def blank_quotations(text):
    """Blank `(...) syntax quotations and char literals (they contain tactic syntax that is not run here)."""
    text = CHAR.sub(lambda m: ' ' * len(m.group(0)), text)
    out, i = [], 0
    while True:
        m = QUOTE.search(text, i)
        if not m:
            out.append(text[i:]); break
        out.append(text[i:m.start()])
        j, depth = m.start() + 2, 1
        while j < len(text) and depth:
            if text[j] == '(': depth += 1
            elif text[j] == ')': depth -= 1
            j += 1
        out.append(''.join('\n' if c == '\n' else ' ' for c in text[m.start():j]))
        i = j
    return ''.join(out)


def by_intervals(text):
    """Character intervals of `by` / `decreasing_by` blocks (indentation rule, clipped at the enclosing bracket)."""
    starts = [0]
    for m in re.finditer('\n', text):
        starts.append(m.end())
    lines = text.split('\n')
    ind = [len(l) - len(l.lstrip(' \t')) for l in lines]
    res = []
    for m in BY.finditer(text):
        li = bisect.bisect_right(starts, m.start()) - 1
        rest_from = m.end()
        line_end = starts[li] + len(lines[li])
        rest = text[rest_from:line_end]
        if rest.strip():
            c = None
            bound = ind[li]
            strict = True
        else:
            k = li + 1
            while k < len(lines) and not lines[k].strip():
                k += 1
            if k >= len(lines):
                continue
            c = ind[k]
            bound = c
            strict = False
        end_line = li
        k = li + 1
        while k < len(lines):
            if lines[k].strip():
                if (strict and ind[k] <= bound) or (not strict and ind[k] < bound):
                    break
            end_line = k
            k += 1
        end = starts[end_line] + len(lines[end_line])
        depth = 0
        for j in range(rest_from, end):
            ch = text[j]
            if ch in OPEN: depth += 1
            elif ch in CLOSE:
                depth -= 1
                if depth < 0:
                    end = j; break
        res.append((rest_from, end))
    res.sort()
    return res


def scan(text):
    """Bitmask of tactic keywords used as tactic steps in a stripped declaration text."""
    text = blank_quotations(text)
    iv = None
    mask = 0
    for m in KW_RE.finditer(text):
        bit = next((int(k[1:]) for k, v in m.groupdict().items() if v is not None), None)
        if bit is None or mask & (1 << bit):
            continue
        s = m.start()
        ls = text.rfind('\n', 0, s) + 1
        pre = text[ls:s]
        if pre.strip() == '' or BULLET.match(pre):
            pass  # first token of its line
        elif not START_TAIL.search(pre[-80:]):
            continue
        if bit == 11:
            if iv is None:
                iv = by_intervals(text)
            k = bisect.bisect_right(iv, (s, 1 << 60)) - 1
            # any enclosing by-block (intervals may nest, so check the earlier ones as well)
            if not any(a <= s < b for a, b in iv[max(0, k - 40):k + 1]):
                continue
            if pre.strip() == '' or BULLET.match(pre):
                # a term-level `match` on its own line follows `:=`, `fun ... =>` is ambiguous; reject only `:=`/`<-`/`$`/`<|`
                j = text.rfind('\n', 0, ls - 1) if ls > 0 else -1
                prev = ''
                p = ls - 1
                while p > 0:
                    q = text.rfind('\n', 0, p)
                    prev = text[q + 1:p].rstrip()
                    if prev:
                        break
                    p = q
                if prev.endswith((':=', '←', '<|', '$', ',', 'fun', 'then', 'else')) or prev.endswith('=> fun') :
                    continue
        mask |= 1 << bit
    return mask


def module_files(root, top):
    out = collections.OrderedDict()
    for t in top:
        base = os.path.join(root, t)
        for dp, _, fs in os.walk(base):
            for fn in sorted(fs):
                if fn.endswith('.lean'):
                    p = os.path.join(dp, fn)
                    out[os.path.relpath(p, root)[:-5].replace(os.sep, '.')] = p
        if os.path.isfile(base + '.lean'):
            out[t] = base + '.lean'
    return out


def resolved_decls(path, mod, nm_mod):
    """[(node_id, start, end, text)] for declarations resolved unambiguously."""
    decls = it.parse_decls(path, mod)
    res = [it.resolve(d, mod, nm_mod) for d in decls]
    cnt = collections.Counter(r for r in res if r)
    with open(path, encoding='utf-8') as fh:
        lines = it.strip_comments(fh.read()).split('\n')
    out = []
    for d, r in zip(decls, res):
        if r and cnt[r] == 1:
            out.append((nm_mod[r], d[1], d[2], '\n'.join(lines[d[1] - 1:d[2]])))
    return out


def load_store(store):
    rd = lambda f: gzip.open(os.path.join(store, f), 'rt', encoding='utf-8').read().split('\n')
    names, modules = rd('names.txt.gz'), rd('modules.txt.gz')
    if names[-1] == '': names.pop()
    if modules[-1] == '': modules.pop()
    nm = struct.unpack('<%dI' % len(names), gzip.open(os.path.join(store, 'node_module.u32.gz')).read())
    by_module = collections.defaultdict(dict)
    for i, n in enumerate(names):
        by_module[modules[nm[i]]][n] = i
    return names, modules, nm, by_module


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--lean-src', default=os.path.expanduser('~/.elan/toolchains/leanprover--lean4---v4.36.0/src/lean'))
    ap.add_argument('--mathlib', required=True)
    ap.add_argument('--store', default='public/store')
    ap.add_argument('--base', required=True, help='directory with the Mathlib tactics.u16.gz/json from ingest_tactics.py')
    ap.add_argument('--out', required=True)
    ap.add_argument('--cache', help='pickle cache of parsed Mathlib declarations (speeds up re-runs)')
    ap.add_argument('--min-precision', type=float, default=0.99)
    ap.add_argument('--min-support', type=int, default=100, help='min Mathlib declarations the scan flags for a bit')
    a = ap.parse_args()

    names, modules, nm, by_module = load_store(a.store)
    meta = json.load(open(os.path.join(a.store, 'meta.json')))
    base_bits = list(struct.unpack('<%dH' % len(names), gzip.open(os.path.join(a.base, 'tactics.u16.gz')).read()))
    legend = json.load(open(os.path.join(a.base, 'tactics.json')))

    # 1. calibration on Mathlib
    if a.cache and os.path.exists(a.cache):
        cal = pickle.load(open(a.cache, 'rb'))
    else:
        cal = []
        for mod, path in module_files(a.mathlib, ['Mathlib']).items():
            for nid, s, e, text in resolved_decls(path, mod, by_module.get(mod, {})):
                if base_bits[nid] & COVERED:
                    cal.append((nid, text))
        if a.cache:
            pickle.dump(cal, open(a.cache, 'wb'))
    stat = {b: collections.Counter() for b in LABELS}
    for nid, text in cal:
        got, truth = scan(text), base_bits[nid]
        for b in LABELS:
            g, t = bool(got >> b & 1), bool(truth >> b & 1)
            stat[b]['tp' if g and t else 'fp' if g else 'fn' if t else 'tn'] += 1
    table, enabled = {}, []
    for b, c in stat.items():
        flagged, positives = c['tp'] + c['fp'], c['tp'] + c['fn']
        prec = c['tp'] / flagged if flagged else None
        rec = c['tp'] / positives if positives else None
        ok = prec is not None and prec >= a.min_precision and flagged >= a.min_support
        table[LABELS[b]] = {'tp': c['tp'], 'fp': c['fp'], 'fn': c['fn'], 'tn': c['tn'],
                            'precision': None if prec is None else round(prec, 5),
                            'recall': None if rec is None else round(rec, 5), 'enabled_for_core': ok}
        if ok: enabled.append(b)
    enabled_mask = sum(1 << b for b in enabled)
    print('calibration over %d Mathlib declarations' % len(cal))
    for l, r in table.items():
        print('%-11s tp=%-6d fp=%-5d fn=%-6d precision=%s recall=%s enabled=%s' % (l, r['tp'], r['fp'], r['fn'], r['precision'], r['recall'], r['enabled_for_core']))

    # 2. core scan
    bits = list(base_bits)
    files = module_files(a.lean_src, ['Init', 'Std', 'Lean'])
    nodes_core = sum(1 for i in range(len(names)) if re.match(r'(Init|Std|Lean)(\.|$)', modules[nm[i]]))
    covered = 0
    raw_counts = collections.Counter()
    for mod, path in files.items():
        nm_mod = by_module.get(mod, {})
        if not nm_mod:
            continue
        for nid, s, e, text in resolved_decls(path, mod, nm_mod):
            m = scan(text)
            bits[nid] = COVERED | (m & enabled_mask)
            covered += 1
            for b in LABELS:
                if m >> b & 1: raw_counts[LABELS[b]] += 1
    print('core nodes %d, covered %d' % (nodes_core, covered))
    print('core decls with bit (scan, before gating):', dict(raw_counts))

    # 3. write
    os.makedirs(a.out, exist_ok=True)
    blob = struct.pack('<%dH' % len(bits), *bits)
    open(os.path.join(a.out, 'tactics.u16'), 'wb').write(blob)
    with gzip.GzipFile(os.path.join(a.out, 'tactics.u16.gz'), 'wb', mtime=0) as g:
        g.write(blob)
    legend['covered_nodes'] = legend.get('covered_nodes_mathlib', legend['covered_nodes'])
    legend['covered_nodes_mathlib'] = legend['covered_nodes']
    legend['covered_nodes'] = legend['covered_nodes_mathlib'] + covered
    legend['core'] = {
        'method': 'calibrated source scan of the Lean toolchain sources (no elaborator data): same declaration join as Mathlib; a tactic keyword counts only as a tactic step start inside a by block, outside comments/strings/quotations/identifiers',
        'toolchain': meta.get('lean_toolchain'),
        'modules': 'Init.*, Std.*, Lean.*',
        'nodes': nodes_core,
        'covered_nodes': covered,
        'bits_enabled': {str(b): LABELS[b] for b in enabled},
        'bits_unknown': {str(b): LABELS[b] for b in LABELS if b not in enabled},
        'min_precision': a.min_precision,
        'calibration_declarations': len(cal),
        'calibration': table,
        'scan_counts_core': dict(raw_counts),
    }
    text = json.dumps(legend, indent=2)
    open(os.path.join(a.out, 'tactics.json'), 'w').write(text)
    with gzip.GzipFile(os.path.join(a.out, 'tactics.json.gz'), 'wb', mtime=0) as g:
        g.write(text.encode())


if __name__ == '__main__':
    main()
