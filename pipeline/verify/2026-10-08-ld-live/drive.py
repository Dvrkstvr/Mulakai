import sys, json, time, subprocess, threading, urllib.request
API='http://127.0.0.1:3001/api'; OL='http://127.0.0.1:11435'
OUT='E:/ai/tmp/ld-live/raw/'
def req(method, url, body=None):
    r=urllib.request.Request(url, method=method, data=json.dumps(body).encode() if body is not None else None, headers={'content-type':'application/json'})
    try:
        with urllib.request.urlopen(r, timeout=30) as f: return f.status, json.loads(f.read() or 'null')
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or 'null')
def vram():
    return int(subprocess.check_output(['nvidia-smi','--query-gpu=memory.used','--format=csv,noheader,nounits']).decode().split()[0])
class Mon(threading.Thread):
    def __init__(s, tag, jobid_ref):
        super().__init__(daemon=True); s.tag=tag; s.stop=False; s.rows=[]; s.ref=jobid_ref
    def run(s):
        t0=time.time(); last=None
        while not s.stop:
            row={'t':round(time.time()-t0,1),'vram':vram()}
            try: row['ps']=[m['name'] for m in req('GET',OL+'/api/ps')[1]['models']]
            except Exception as e: row['ps']='err'
            try:
                q=req('GET',API+'/generate/queue')[1]; row['run']=(q['running'] or {}).get('kind'); row['queued']=[x['kind'] for x in q['queued']]
            except Exception: pass
            for j in s.ref: 
                try:
                    st,jb=req('GET',API+'/generate/'+j); row['job_'+j[:6]]=[jb.get('status'),jb.get('progressText')]
                except Exception: pass
            sig=json.dumps({k:v for k,v in row.items() if k not in('t',)}); 
            if sig!=last: s.rows.append(row); last=sig
            time.sleep(0.5)
def settle(jobid, timeout=900):
    t0=time.time()
    while time.time()-t0<timeout:
        st,j=req('GET',API+'/generate/'+jobid)
        if j and j['status'] in('done','failed'): return j, round(time.time()-t0,1)
        time.sleep(0.5)
    return None, timeout
def turn(tag, thread, text):
    ref=[]; m=Mon(tag,ref); 
    ps0=req('GET',OL+'/api/ps')[1]
    m.start(); t0=time.time()
    st,r=req('POST',f'{API}/chat/threads/{thread}/turns',{'text':text}); print(st,r)
    if st!=202: m.stop=True; return r
    ref.append(r['jobId'])
    job,secs=settle(r['jobId'])
    t_end=time.time()-t0
    time.sleep(1.5)
    ps_after=req('GET',OL+'/api/ps')[1]
    m.stop=True; time.sleep(0.7)
    th=req('GET',f'{API}/chat/threads/{thread}')[1]
    res={'tag':tag,'text':text,'turn_seconds':t_end,'job':job,'ps_after':ps_after,'timeline':m.rows,'vram_peak':max(r['vram'] for r in m.rows),'thread':th}
    json.dump(res,open(OUT+tag+'.json','w',encoding='utf-8'),indent=1,ensure_ascii=False)
    return res
if __name__=='__main__':
    cmd=sys.argv[1]
    if cmd=='reset':
        print(req('POST',API+'/chat/draft/reset',{}))
    if cmd=='turn':
        tag,text=sys.argv[2],sys.argv[3]
        st,d=req('GET',API+'/chat/draft'); r=turn(tag,d['id'],text)
        print(json.dumps({k:r[k] for k in ('turn_seconds','job','ps_after','vram_peak')},ensure_ascii=False))
        for row in r['timeline']: print(row)
