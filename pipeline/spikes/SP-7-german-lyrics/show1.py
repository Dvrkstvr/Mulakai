import json,sys
# first occurrence of each distinct section only (compact)
for t in sys.argv[1].split(','):
    r=json.load(open(f'results/{t}.json',encoding='utf8'))
    for c in sys.argv[2].split(','):
        x=r['cases'][c]; print(f"=== {t} {c} {x['title']} secs={[len(s['lines']) for s in x['lyrics']]}"); seen=set()
        for s in x['lyrics']:
            k=tuple(s['lines'])
            if k in seen: print(f"[{s['tag']}] (repeat)"); continue
            seen.add(k); print(f"[{s['tag']}]"); print('\n'.join(s['lines']))
