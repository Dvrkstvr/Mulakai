import json,sys
r=json.load(open(f'raw/run-{sys.argv[1]}.json'))
g=r['planGet']; p=g.get('plan'); run=g['run']
print(run['status'], run.get('cause'), run.get('reasons'), 'wall', round(r['planWallS'],1))
if p:
  print('attempts',p['attempts'],'refusals',[x[:2] if isinstance(x,list) else x for x in p['refusals']])
  for o in p['ops']: print(' ',o['op'],{k:v for k,v in o.items() if k not in('chords','op','lines','bars')},[(c['bar'],c['root']+c['quality']) for c in o.get('chords',[])])
  print(' verdicts',[(v['op'],v['ok'],v.get('reason'),v.get('note')) for v in p['verdicts']])
  if p.get('since'): print(' since',[ (m['mark'], (m.get('now') or m.get('was') or {}).get('op')) for m in p['since']['marks']], 'removed',p['since']['removed'])
