"""Usage: python3 scripts/compare_axioms.py GROUND_TRUTH.json STORE_DIR"""
import sys, json
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import ingest_const_dep as m
gt=json.load(open(sys.argv[1]))['results']
res=m.check(Path(sys.argv[2]), list(gt))
ok=bad=missing=0
for k,v in gt.items():
    r=res[k]
    if r is None: missing+=1; print('MISSING',k); continue
    got=sorted(r['axioms']); exp=sorted(v)
    if got==exp: ok+=1
    else: bad+=1; print('MISMATCH',k,'expected',exp,'got',got,'closure',r['closure_size'])
print('match',ok,'mismatch',bad,'missing',missing,'of',len(gt))
