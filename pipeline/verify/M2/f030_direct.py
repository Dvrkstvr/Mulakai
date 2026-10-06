import json, sqlite3, urllib.request, re
def apply(abc, lyrics, ops, style='x'):
    body={'abc':abc,'style':style,'lyrics':lyrics,'ops':ops}
    r=urllib.request.Request('http://127.0.0.1:8024/v1/scores/apply',data=json.dumps(body).encode(),headers={'content-type':'application/json'})
    return json.load(urllib.request.urlopen(r))
con=sqlite3.connect('file:E:/ai/tmp/m2v/data/mulakai.db?mode=ro',uri=True)
# CUT on 5c8e6586 (unrendered base v1): bridge S6
sid='5c8e6586-9ac0-4a5f-a087-da17656c7639'
lyr=con.execute('select lyrics from songs where id=?',(sid,)).fetchone()[0]
vid=con.execute('select v.id from versions v join layers l on l.id=v.layer_id where l.song_id=? order by v.created_at limit 1',(sid,)).fetchone()[0]
abc=open(f'E:/ai/tmp/m2v/data/audio/{vid}.abc',encoding='utf-8').read()
tags=lambda t: re.findall(r'^\[[^\]]+\]',t,re.M)
print('base tags',tags(lyr))
d=apply(abc,lyr,[{'op':'CUT','section':6,'label':'bridge'}])
print('CUT bridge: ok',d['ok'],'verdicts',d['verdicts'])
print(' abc sections', re.findall(r'^% (\w+)',d['abc'],re.M))
print(' lyrics tags', tags(d['lyrics']))
print(' bridge words gone:', 'Manchmal spür ich' not in d['lyrics'], ' lines', len(lyr.split('\n')),'->',len(d['lyrics'].split('\n')))
print(' repeat signs in abc:', bool(re.search(r'\|:|:\|',d['abc'])))
# REPEAT chorus S3 on the same song: seam un-tie
d2=apply(abc,lyr,[{'op':'REPEAT','section':3,'label':'chorus'}])
print('REPEAT chorus S3: ok',d2['ok'],d2['verdicts'],'checks',d2['checks'])
print(' abc sections', re.findall(r'^% (\w+)',d2['abc'],re.M),' repeat signs:', bool(re.search(r'\|:|:\|',d2['abc'])))
print(' lyric tags', tags(d2['lyrics']))
json.dump({'cut':{k:d[k] for k in ('ok','verdicts','checks')},'repeat':{k:d2[k] for k in ('ok','verdicts','checks')}},open('raw/f030_direct.json','w'),indent=1)
