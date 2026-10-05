import json, glob
tr=[json.loads(l) for l in open('raw/proxy-trace.jsonl')]
ps=[json.loads(l) for l in open('raw/ps-trace.jsonl')]
yt=[json.loads(l) for l in open('raw/yue-trace.jsonl')]
out=[]
for tag in ['s1_purple','s2_gertar','s3_carinito']:
    r=json.load(open(f'raw/run-{tag}.json'))
    t0,t1=r['t0'],r['t1']
    ev=[e for e in tr if t0-200<=e['t0']<=t1+3000]
    chats=[e for e in ev if e['path'].startswith('/v1/chat')]
    gens=[e for e in ev if e['path'].startswith('/api/generate')]
    ack=gens[-1] if gens else None
    empty=next((p for p in ps if ack and p['t']>=ack['t1'] and p.get('models')==''),None)
    plan=r['planGet'].get('plan'); run=r['planGet']['run']
    print('=====',tag,'plan status',run['status'],'attempts',plan['attempts'] if plan else None,'wall',round(r['planWallS'],1),'chat calls',len(chats))
    fb=[]
    for i,c in enumerate(chats):
        ns=c['nonSystem']
        print(f' chat{i+1}: {(c["t1"]-c["t0"])/1000:.1f}s usage {c.get("usage")}')
        if len(ns)>1:
            for m in ns[1:]:
                if m['role']=='user': fb.append((i+1,m['content'])); 
    # distinct feedback: last user message of each later call
    for i,c in enumerate(chats[1:],start=2):
        print(f'  feedback before attempt {i}:', c['nonSystem'][-1]['content'][:1200].replace('\n',' | '))
    if ack: print(' unload ack ms',ack['t1']-ack['t0'],' ps empty after ack ms',(empty['t']-ack['t1']) if empty else None, 'req',json.dumps(ack.get('req')))
    if plan:
        for o in plan['ops']:
            if o['op']=='WRITE_PHRASE': print(' PHRASE start',o['start_bar'],o['instrument'],'bars',len(o['bars'])); [print('   bar',i+o['start_bar'],' '.join(f"{n['pitch']}{n['beats']}" for n in b)) for i,b in enumerate(o['bars'])]
            else: print(' op',o['op'],{k:v for k,v in o.items() if k not in('chords','op')})
        print(' verdicts',json.dumps(plan['verdicts'])); print(' checks',json.dumps(plan['checks'])); print(' style tail',plan['style'][-80:])
    rn=r.get('render',{}).get('run')
    yj=[e for e in yt if e.get('job') and r['render']['t0']-2000<=e['t1']<=r['render']['t1']+5000]
    if yj:
        j=yj[-1]['job']; res=j['result']; sem=j['tokens']['semantic']; ts=res['timing']
        print(' RENDER wall',r['render']['wallS'],'status',j['status'],'sem tok',sem,'sem s',ts.get('semantic_seconds'),'tok/s',round(sem/ts['semantic_seconds'],1),'audio s',res['audio_seconds'],'trunc',res['truncated'],'version',rn['version'])
print()
