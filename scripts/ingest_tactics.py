#!/usr/bin/env python3
"""Build a per-declaration tactic bitmask for the Leanage store.

Inputs (all must be at the SAME Mathlib commit as the store):
  --shards    directory with the parquet shards of HF mathlib-initiative/mathlib-tactics
  --mathlib   a Mathlib checkout (used only to find declaration names and line ranges,
              because the dataset has no declaration column: rows are module + position)
  --store     directory with names.txt.gz, modules.txt.gz, node_module.u32.gz
  --out       output directory (default public/store)

Output: tactics.u16 (+ .gz): one little-endian u16 per node id, and tactics.json (legend).
Bit 15 (COVERED) is set only when the declaration was resolved with certainty: its name,
built from namespace tracking, matches exactly one node of that module, and it is the only
declaration with that name in the file. A node without COVERED has NO tactic data (not "no
tactics"). Anything ambiguous is skipped: mutual blocks, unnamed instances, duplicate names.

Run untrusted parquet with `python -I`.
"""
import argparse, gzip, json, os, re, struct, sys, collections

COVERED = 1 << 15
# bit -> (label, elaborator suffixes recorded in the dataset)
BITS = [
    (0, 'induction', ['Tactic.evalInduction', 'Tactic.evalFunInduction']),
    (1, 'cases', ['Tactic.evalCases']),
    (2, 'rcases', ['RCases.evalRCases']),
    (3, 'obtain', ['RCases.evalObtain']),
    (4, 'by_cases', ['ByCases___macroRules_tacticBy_cases_:__1', 'ByCases___macroRules_tacticBy_cases_:__2', 'ByCases___macroRules_Mathlib_Tactic_ByCases_byCases!_1']),
    (5, 'by_contra', ['Tactic_Init___macroRules_Batteries_Tactic_byContra_1', 'Mathlib_Tactic_ByContra_byContra!_1']),
    (6, 'contrapose', ['Contrapose_contrapose!_1', 'Contrapose_contrapose_1']),
    (7, 'exfalso', ['tacticExfalso_1']),
    (8, 'fin_cases', ['FinCases___elabRules_Lean_Elab_Tactic_finCases_1', 'CasesM___elabRules_Mathlib_Tactic_casesM_1', 'IntervalCases___elabRules_Mathlib_Tactic_intervalCases_1']),
    (9, 'split_ifs', ['SplitIfs___elabRules_Mathlib_Tactic_splitIfs_1']),
    (10, 'rintro', ['RCases.evalRIntro']),
    (11, 'match', ['Tactic.evalMatch']),
]


def bit_of(elab):
    for bit, _, suffixes in BITS:
        for s in suffixes:
            if elab.endswith(s):
                return bit
    return None


def strip_comments(src):
    """Blank out comments and string literals but keep every newline."""
    out, i, n, depth = [], 0, len(src), 0
    while i < n:
        c = src[i]
        if depth:
            if src.startswith('/-', i):
                depth += 1; out.append('  '); i += 2
            elif src.startswith('-/', i):
                depth -= 1; out.append('  '); i += 2
            else:
                out.append('\n' if c == '\n' else ' '); i += 1
        elif src.startswith('/-', i):
            depth = 1; out.append('  '); i += 2
        elif src.startswith('--', i):
            while i < n and src[i] != '\n':
                out.append(' '); i += 1
        elif c == '"':
            out.append(' '); i += 1
            while i < n and src[i] != '"':
                if src[i] == '\\' and i + 1 < n:
                    out.append(' '); i += 1
                out.append('\n' if src[i] == '\n' else ' '); i += 1
            out.append(' '); i += 1
        else:
            out.append(c); i += 1
    return ''.join(out)


ATTR = r'@\[(?:[^\[\]]|\[[^\]]*\])*\]\s*'
MODS = r'(?:(?:protected|private|noncomputable|nonrec|unsafe|partial|public|meta)\s+)*'
DECL = re.compile(r'^(?:' + ATTR + r')*(?:' + MODS + r')(?P<kw>theorem|lemma|def|abbrev|instance|opaque|axiom|structure|class|inductive|example)\b[ \t]*(?P<name>[^\s:({\[⦃,]*)')
NS = re.compile(r'^namespace\s+(\S+)')
SEC = re.compile(r'^(?:noncomputable\s+|public\s+|meta\s+)*section\b')
END = re.compile(r'^end\b')
MUTUAL = re.compile(r'^mutual\b')


def parse_decls(path, module):
    """Return list of (name_or_None, start_line, end_line, skip) for a module file."""
    with open(path, encoding='utf-8') as fh:
        text = strip_comments(fh.read())
    lines = text.split('\n')
    stack = []  # ('ns', parts) | ('sec',) | ('mutual',)
    decls = []
    cur = None

    def close(upto):
        nonlocal cur
        if cur:
            cur[2] = upto
            decls.append(tuple(cur))
            cur = None

    in_attr = False
    for idx, line in enumerate(lines):
        ln = idx + 1
        if not line or line[0] in ' \t':
            continue
        if line[0] in ')]}|⟩·<>':
            continue
        # a multi-line attribute may start here; join a few lines so DECL can see through
        chunk = '\n'.join(lines[idx:idx + 6])
        close(ln - 1)
        m = DECL.match(chunk)
        nl = chunk.find('\n')
        if m and nl != -1 and m.start('kw') > nl:
            m = None  # attribute line only; the keyword line is matched on its own
        if m:
            kw, name = m.group('kw'), m.group('name')
            private = bool(re.search(r'\bprivate\b', chunk[:m.start('kw')]))
            skip = (kw in ('instance', 'example')) and (not name or name.startswith('('))
            if kw in ('structure', 'class', 'inductive', 'example'):
                skip = True  # not proof bodies we attribute (tactics inside would be field proofs)
            inmut = any(e[0] == 'mutual' for e in stack)
            cur = [name or None, ln, ln, skip or inmut or not name, private, ''.join(p + '.' for e in stack if e[0] == 'ns' for p in e[1])]
            continue
        mm = NS.match(line)
        if mm:
            stack.append(('ns', [p for p in mm.group(1).split('.') if p]))
        elif MUTUAL.match(line):
            stack.append(('mutual',))
        elif SEC.match(line):
            stack.append(('sec',))
        elif END.match(line):
            if stack:
                stack.pop()
    close(len(lines))
    return decls


def resolve(decl, module, names_in_module):
    name, _, _, skip, private, ns = decl
    if skip or not name:
        return None
    if name.startswith('_root_.'):
        cands = [name[7:]]
    else:
        cands = [ns + name]
    if private:
        cands = ['_private.%s.0.%s' % (module, c) for c in cands]
    ok = [c for c in cands if c in names_in_module]
    return ok[0] if len(ok) == 1 else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--shards', required=True)
    ap.add_argument('--mathlib', required=True)
    ap.add_argument('--store', default='public/store')
    ap.add_argument('--out', default='public/store')
    a = ap.parse_args()
    import pyarrow.parquet as pq

    names = gzip.open(os.path.join(a.store, 'names.txt.gz'), 'rt', encoding='utf-8').read().split('\n')
    if names and names[-1] == '':
        names.pop()
    modules = gzip.open(os.path.join(a.store, 'modules.txt.gz'), 'rt', encoding='utf-8').read().split('\n')
    if modules and modules[-1] == '':
        modules.pop()
    raw = gzip.open(os.path.join(a.store, 'node_module.u32.gz')).read()
    nm = struct.unpack('<%dI' % len(names), raw)
    meta = json.load(open(os.path.join(a.store, 'meta.json')))
    commit = meta.get('mathlib_commit')
    by_module = collections.defaultdict(dict)
    for i, nme in enumerate(names):
        by_module[modules[nm[i]]][nme] = i

    # 1. declaration ranges per module (only modules that have tactic rows)
    rows = collections.defaultdict(list)  # module -> [(line, bit)]
    total_rows = 0
    for f in sorted(os.listdir(a.shards)):
        if not f.endswith('.parquet'):
            continue
        t = pq.read_table(os.path.join(a.shards, f), columns=['module', 'startPos', 'elaborator'])
        mods, pos, el = t['module'].to_pylist(), t['startPos'].to_pylist(), t['elaborator'].to_pylist()
        for m, p, e in zip(mods, pos, el):
            total_rows += 1
            if m is None:
                continue
            rows[m].append((p['line'], bit_of(e)))

    bits = [0] * len(names)
    covered_decl = resolved = unresolved = 0
    unresolved_theorems = resolved_theorems = 0
    attributed = interesting = interesting_attr = 0
    missing_files = 0
    resolved_ids = set()
    all_files = collections.OrderedDict()
    for dirpath, _, files in os.walk(os.path.join(a.mathlib, 'Mathlib')):
        for fn in files:
            if fn.endswith('.lean'):
                p = os.path.join(dirpath, fn)
                mod = os.path.relpath(p, a.mathlib)[:-5].replace(os.sep, '.')
                all_files[mod] = p
    for mod, path in all_files.items():
        nm_mod = by_module.get(mod, {})
        decls = parse_decls(path, mod)
        spans = []
        counts = collections.Counter()
        res = []
        for d in decls:
            r = resolve(d, mod, nm_mod)
            res.append(r)
            if r:
                counts[r] += 1
        for d, r in zip(decls, res):
            kw_theorem = True
            if r is None or counts[r] != 1:
                unresolved += 1
                continue
            resolved += 1
            resolved_ids.add(nm_mod[r])
            bits[nm_mod[r]] |= COVERED
            spans.append((d[1], d[2], nm_mod[r]))
        spans.sort()
        starts = [s[0] for s in spans]
        import bisect
        for line, bit in rows.get(mod, []):
            k = bisect.bisect_right(starts, line) - 1
            hit = k >= 0 and spans[k][0] <= line <= spans[k][1]
            if bit is not None:
                interesting += 1
            if hit:
                attributed += 1
                if bit is not None:
                    interesting_attr += 1
                    bits[spans[k][2]] |= 1 << bit
    for mod in rows:
        if mod not in all_files:
            missing_files += 1

    out = os.path.join(a.out)
    os.makedirs(out, exist_ok=True)
    blob = struct.pack('<%dH' % len(bits), *bits)
    open(os.path.join(out, 'tactics.u16'), 'wb').write(blob)
    with gzip.GzipFile(os.path.join(out, 'tactics.u16.gz'), 'wb', mtime=0) as g:
        g.write(blob)
    legend = {
        'dataset': 'mathlib-initiative/mathlib-tactics',
        'mathlib_commit': commit,
        'covered_bit': 15,
        'bits': {str(b): label for b, label, _ in BITS},
        'method': 'tactic rows (module, line) attributed to the enclosing declaration parsed from the Mathlib source; ambiguous declarations are left uncovered',
        'nodes': len(names),
        'covered_nodes': resolved,
        'tactic_rows': total_rows,
        'rows_attributed': attributed,
        'method_rows': interesting,
        'method_rows_attributed': interesting_attr,
    }
    json.dump(legend, open(os.path.join(out, 'tactics.json'), 'w'), indent=2)
    with gzip.GzipFile(os.path.join(out, 'tactics.json.gz'), 'wb', mtime=0) as g:
        g.write(json.dumps(legend, indent=2).encode())
    print(json.dumps(legend, indent=2))
    print('declarations resolved', resolved, 'unresolved', unresolved, 'modules with rows but no file', missing_files)


if __name__ == '__main__':
    main()
