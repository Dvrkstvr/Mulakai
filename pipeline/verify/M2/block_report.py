import json
rows=[]
for l in open('block_trials.txt'):
    tag,sid,req,want=l.strip().split('|'); want=int(want)
    r=json.load(open(f'raw/run-{tag}.json'))
    blocks={b['index']:b for b in r['scoreBefore']['blocks']}
    g=r['planGet']; p=g.get('plan'); run=g['run']
    row={'tag':tag,'request':req,'intended':want,'status':run['status']}
    if p:
        rw=[o for o in p['ops'] if o['op']=='REWRITE_LYRICS']
        row['ops']=[o['op'] for o in p['ops']]
        if rw:
            o=rw[0]; b=blocks.get(o['block'])
            row['chosen']=o['block']; row['chosen_tag']=f"{o['tag']} #{o['occurrence']}"; row['right']=(o['block']==want)
            row['lines_same']=bool(b) and len(o['lines'])==b['lines']; row['tag_in_lines']=any(x.strip().startswith('[') for x in o['lines'])
            row['tag_matches_block']=bool(b) and b['tag']==o['tag'] and b['occurrence']==o['occurrence']
        row['attempts']=p['attempts']
    else: row['reasons']=run.get('reasons')
    rows.append(row); print(json.dumps(row,ensure_ascii=False))
ok=[x for x in rows if 'right' in x]
print('plans with a REWRITE op',len(ok),'of',len(rows),'; right block',sum(x['right'] for x in ok),'; same line count',sum(x['lines_same'] for x in ok),'; tag written',sum(x['tag_in_lines'] for x in ok))
json.dump(rows,open('block-trials.json','w'),indent=1,ensure_ascii=False)
