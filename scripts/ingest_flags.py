#!/usr/bin/env python3
"""Turn the output of scripts/extract_flags.lean into the per-node flag file of the Leanage store.

  --tsv    output of extract_flags.lean (`name<TAB>letters`, first line `# lean <version> <githash>`)
  --store  directory with names.txt.gz and meta.json (default public/store)
  --out    output directory (default public/store)

Writes flags.u8 (+ .gz): one byte per node id of names.txt (line number = id), and flags.json (+ .gz): legend.
Bit 7 (UNKNOWN) marks nodes the Lean output did not contain: their other bits are meaningless.
"""
import argparse, gzip, json, os, collections

BITS = {
    0: ('instance', 'i'),
    1: ('projection', 'p'),
    2: ('coe', 'c'),
    3: ('coe_decl', 'd'),
    4: ('class', 'C'),
    5: ('structure', 'S'),
    6: ('structure_ctor', 'k'),
    7: ('unknown', None),
}
LETTER = {l: b for b, (_, l) in BITS.items() if l}
BOILERPLATE_MASK = 0b1111  # instance | projection | coe | coe_decl


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--tsv', required=True)
    ap.add_argument('--store', default='public/store')
    ap.add_argument('--out', default='public/store')
    a = ap.parse_args()

    names = gzip.open(os.path.join(a.store, 'names.txt.gz'), 'rt', encoding='utf-8').read().split('\n')
    if names and names[-1] == '':
        names.pop()
    meta = json.load(open(os.path.join(a.store, 'meta.json')))
    index = {n: i for i, n in enumerate(names)}
    flags = bytearray([1 << 7]) * len(names)
    lean_header = ''
    extra = 0
    seen = 0
    with open(a.tsv, encoding='utf-8') as f:
        for line in f:
            line = line.rstrip('\n')
            if line.startswith('# '):
                lean_header = line[2:]
                continue
            name, _, letters = line.partition('\t')
            i = index.get(name)
            if i is None:
                extra += 1
                continue
            v = 0
            if letters != '-':
                for ch in letters:
                    v |= 1 << LETTER[ch]
            flags[i] = v
            seen += 1
    unknown = sum(1 for b in flags if b & 0x80)
    counts = {label: sum(1 for b in flags if b & (1 << bit) and not b & 0x80) for bit, (label, _) in BITS.items() if bit != 7}
    counts['boilerplate'] = sum(1 for b in flags if not b & 0x80 and b & BOILERPLATE_MASK)
    counts['unknown'] = unknown
    legend = {
        'mathlib_commit': meta.get('mathlib_commit'),
        'lean': lean_header,
        'bits': {str(b): label for b, (label, _) in BITS.items()},
        'boilerplate_mask': BOILERPLATE_MASK,
        'nodes': len(names),
        'lean_constants_not_in_store': extra,
        'counts': counts,
    }
    os.makedirs(a.out, exist_ok=True)
    for fname, data in (('flags.u8', bytes(flags)), ('flags.json', (json.dumps(legend, indent=2) + '\n').encode())):
        with open(os.path.join(a.out, fname), 'wb') as f:
            f.write(data)
        with gzip.GzipFile(os.path.join(a.out, fname + '.gz'), 'wb', mtime=0) as f:
            f.write(data)
    print(json.dumps(legend, indent=2))

    # spot check: a few names per flag
    import random
    rnd = random.Random(1)
    by = collections.defaultdict(list)
    for i, b in enumerate(flags):
        if b & 0x80:
            continue
        for bit, (label, _) in BITS.items():
            if bit != 7 and b & (1 << bit):
                by[label].append(i)
    for label, ids in by.items():
        print(label, [names[i] for i in rnd.sample(ids, min(3, len(ids)))])


if __name__ == '__main__':
    main()
