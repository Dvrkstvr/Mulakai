import json, urllib.request
F=json.load(open('raw/facts.json')); sid='29f8457d-97d2-48a3-8f2e-255e2dc90549'; abc=F[sid]['abc']; style='dream pop, 87 bpm'
def n(p,b): return {'pitch':p,'beats':b}
bar=lambda *x:[n(p,b) for p,b in x]
good=[bar(('D',1),('F',1),('A',1),('D',1)),bar(('F',1),('A',1),('C',1),('F',1)),bar(('A',1),('G',1),('F',1),('E',1)),bar(('D',2),('F',1),('A',1))]
cases={
 'vocal_sings (start 20)':(20,[good[0],good[1]]),
 'beat sum 3.5 (bar 3 of phrase)':(11,[bar(('D',1),('F',1),('A',1),('D',1)),bar(('F',1),('A',1),('C',1),('F',1)),bar(('D',1),('F',1),('A',0.5),('D',1))] ),
 '3 notes only':(2,[bar(('D',2),('F',1),('A',1)),bar(('D',4)),bar(('D',4))][:1]),
 '2 distinct pitches':(2,[bar(('D',1),('F',1),('D',1),('F',1)),bar(('F',1),('D',1),('F',1),('D',1))]),
 'off key (^C ^F ^G)':(2,[bar(('^C',1),('^F',1),('^G',1),('D',1)),bar(('^F',1),('^G',1),('^C',1),('D',1))]),
 'four identical bars':(2,[good[0]]*4),
 'runs past the end (start 63, 4 bars)':(63,good),
 'ABC string':(2,['D2 F2 A2 d2']),
 'good, bars 2-5':(2,good),
}
out={}
for name,(start,bars) in cases.items():
    body={'abc':abc,'style':style,'ops':[{'op':'WRITE_PHRASE','start_bar':start,'instrument':'tenor saxophone','bars':bars}]}
    r=urllib.request.Request('http://127.0.0.1:8004/v1/scores/apply',data=json.dumps(body).encode(),headers={'content-type':'application/json'})
    try: d=json.load(urllib.request.urlopen(r)); res={'ok':d['ok'],'verdicts':d['verdicts'],'problems':d['checks']['problems'],'style':d['style']}
    except urllib.error.HTTPError as e: res={'http':e.code,'body':e.read().decode()[:300]}
    out[name]=res; print(name,'->',json.dumps(res)[:420])
json.dump(out,open('raw/edges_apply.json','w'),indent=1)
