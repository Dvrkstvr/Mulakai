import json,sys
ids=sys.argv[2].split(',')
for t in sys.argv[1].split(','):
    r=json.load(open(f'results/{t}.json',encoding='utf8'))
    for c in ids:
        x=r['cases'][c]; print(f"=== {t} {c} {x['title']}")
        for s in x['lyrics']: print(f"[{s['tag']}]"); print('\n'.join(s['lines']))
