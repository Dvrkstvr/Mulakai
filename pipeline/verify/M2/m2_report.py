"""M2/CP3 plan metrics from raw/run-*.json + the Ollama proxy trace + the /api/ps poller: attempts, prompt tokens, wall,
unload ack and /api/ps empty after the ack (the hand-off, per press)."""
import json, glob, os, sys
tr=[json.loads(l) for l in open('raw/proxy-trace.jsonl')]
ps=[json.loads(l) for l in open('raw/ps-trace.jsonl')]
rows=[]
for f in sorted(glob.glob('raw/run-*.json'), key=os.path.getmtime):
    r=json.load(open(f)); tag=r['tag']
    if 'planGet' not in r or not r.get('planGet'): continue
    t0,t1=r['t0'],r['t1']
    ev=[e for e in tr if t0-200<=e['t0']<=t1+3000]
    chats=[e for e in ev if e['path'].startswith('/v1/chat')]
    gens=[e for e in ev if e['path'].startswith('/api/generate')]
    ack=gens[-1] if gens else None
    empty=next((p for p in ps if ack and p['t']>=ack['t1'] and p.get('models')==''),None)
    run=r['planGet']['run']; plan=r['planGet'].get('plan')
    row={'tag':tag,'request':r['request'],'flags':r['flags'],'status':run['status'],'cause':run.get('cause'),'wall_s':round(r['planWallS'],1),
         'chat_calls':len(chats),'prompt_tokens':[c['usage']['prompt_tokens'] for c in chats if c.get('usage')],
         'completion_tokens':[c['usage']['completion_tokens'] for c in chats if c.get('usage')],
         'chat_s':[round((c['t1']-c['t0'])/1000,1) for c in chats],
         'unload_ack_ms':(ack['t1']-ack['t0']) if ack else None,'ps_empty_after_ack_ms':(empty['t']-ack['t1']) if empty else None,
         'unload_requests':[g.get('req') for g in gens]}
    if plan: row.update({'ops':[o['op'] for o in plan['ops']],'attempts':plan['attempts']})
    rows.append(row)
    print(json.dumps(row))
json.dump(rows,open('plan-metrics.json','w'),indent=1)
