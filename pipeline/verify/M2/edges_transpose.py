import json, urllib.request, urllib.error
abc=open('E:/ai/tmp/m2v/data/audio/3c9e79de-0844-40dc-a89f-4c6864c8a23a.abc',encoding='utf-8').read()
out={}
for n in (-2, 11, -11, 12, -12, 0, 1.5, 'x'):
    body={'abc':abc,'style':'pop, 95 bpm, D minor','ops':[{'op':'TRANSPOSE','semitones':n}]}
    r=urllib.request.Request('http://127.0.0.1:8024/v1/scores/apply',data=json.dumps(body).encode(),headers={'content-type':'application/json'})
    try:
        d=json.load(urllib.request.urlopen(r)); res={'http':200,'ok':d['ok'],'verdicts':d['verdicts'],'style':d['style'][-30:],'K':[l for l in d['abc'].split('\n') if l.startswith('K:')][:2]}
    except urllib.error.HTTPError as e: res={'http':e.code,'body':e.read().decode()[:260]}
    out[str(n)]=res; print(n,'->',json.dumps(res)[:330])
json.dump(out,open('raw/edges_transpose.json','w'),indent=1)
