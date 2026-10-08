import json,sys
for l in open('out_all.txt'):
    if l.startswith('###') or l.startswith('--'): print(l.strip()); continue
    if not l.startswith('{'): print(l.strip()); continue
    r=json.loads(l)
    if 'error' in r: print(r['variant'],'ERROR',r['error'][:140]); continue
    f=r.get('fit') or {}
    print(f"{r['variant']:17} {r['wall_s']*1000:4.0f}ms {r['Q']:10} {r['M']} bars={r['bars']:3} vN={r['vocal_notes']:3} iN={r['ins_notes']:3} ch={r['chords']:3} sec={r['sections']} dur={r['dur_s']} ok={r['valid']} drop={f.get('dropped')} same={r.get('same_as_orig_abc')}")
