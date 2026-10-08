import json,statistics as st
out={}
for t in ('qwen3','gemma4','gemma3','mistral'):
    r=json.load(open(f'results/{t}.json',encoding='utf8'))
    nl=0;tot=0;words=[];walls=[];toks=[]
    bad=[]
    for c,x in r['cases'].items():
        for s in x['lyrics']:
            for l in s['lines']:
                tot+=1; words.append(len(l.split()))
                if '\n' in l or len(l.strip())<6: nl+=1; bad.append(c)
        walls.append(x['wall']); toks.append(x['completion_tokens'])
    de=[x['wall'] for c,x in r['cases'].items() if x['lang']=='de']
    print(t,'lines',tot,'broken',nl,sorted(set(bad)),'words/line med',st.median(words),'p90',sorted(words)[int(.9*len(words))],'max',max(words),'median s',st.median(walls),'max s',max(walls),'tok med',st.median(toks),'load',r['load_s'],'ps',r['ps'][0]['size_vram']/r['ps'][0]['size'],round(r['ps'][0]['size']/1e9,1),'vram base/loaded/peak',r['vram_baseline_mb'],r['vram_loaded_mb'],r['vram_peak_after_mb'],'release',r['release'])
