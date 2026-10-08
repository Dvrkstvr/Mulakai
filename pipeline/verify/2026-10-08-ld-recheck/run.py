import sys, json, time, threading, urllib.request
sys.path.insert(0,'E:/repos/Mulakai/.claude/worktrees/silly-solomon-bc6848/pipeline/verify/2026-10-08-ld-live')
import drive
drive.API='http://127.0.0.1:3301/api'; drive.OL='http://127.0.0.1:11434'
OUT='E:/ai/tmp/ld-recheck/raw/'; drive.OUT=OUT
PX='http://127.0.0.1:11437'
def calls(): return json.loads(urllib.request.urlopen(PX+'/__calls').read())
def run_turn(tag, text):
    urllib.request.urlopen(PX+'/__clear').read()
    st,d=drive.req('GET',drive.API+'/chat/draft'); th=d['id']
    before=d['draft']['fields']
    r=drive.turn(tag,th,text)
    c=calls()
    st,d2=drive.req('GET',drive.API+'/chat/draft'); after=d2['draft']['fields']
    msgs=r['thread']['messages']; last=[m for m in msgs if m['role']=='assistant'][-1]
    ps_models=sorted({m for row in r['timeline'] if isinstance(row.get('ps'),list) for m in row['ps']})
    out={'tag':tag,'text':text,'secs':round(r['turn_seconds'],1),'job_status':r['job']['status'] if r.get('job') else None,
      'reply_kind':last['kind'],'reply_text':(last.get('text') or '')[:200],'n_calls':len(c),'calls_detail':c,'call_models':[x['model'] for x in c],
      'ps_models_seen':ps_models,'ps_after':r['ps_after'],'vram_peak':r['vram_peak'],
      'bpm_before':before.get('bpm'),'bpm_after':after.get('bpm'),'lyrics_same':before.get('lyrics')==after.get('lyrics'),'lang':after.get('language'),
      'lyrics_before':before.get('lyrics'),'lyrics_after':after.get('lyrics'),'style_after':after.get('style')}
    json.dump(out,open(OUT+'S_'+tag+'.json','w',encoding='utf-8'),indent=1,ensure_ascii=False)
    s={k:v for k,v in out.items() if k not in('lyrics_before','lyrics_after')}
    print(json.dumps(s,ensure_ascii=False)); sys.stdout.flush()
    return out
if __name__=='__main__':
    name=sys.argv[1]; first=sys.argv[2]; fu=sys.argv[3]
    drive.req('POST',drive.API+'/chat/draft/reset',{})
    run_turn(name+'_first',first); run_turn(name+'_fu',fu)
