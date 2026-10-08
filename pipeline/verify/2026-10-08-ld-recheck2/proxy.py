import http.server, socketserver, urllib.request, json, time, sys
UP='http://127.0.0.1:11434'; LOG=[]
class H(http.server.BaseHTTPRequestHandler):
    protocol_version='HTTP/1.0'
    def log_message(s,*a): pass
    def do_GET(s):
        if s.path=='/__calls':
            b=json.dumps(LOG).encode(); s.send_response(200); s.end_headers(); s.wfile.write(b); return
        if s.path=='/__clear':
            LOG.clear(); s.send_response(200); s.end_headers(); s.wfile.write(b'ok'); return
        s.fwd(None)
    def do_POST(s):
        n=int(s.headers.get('content-length') or 0); body=s.rfile.read(n); s.fwd(body)
    def fwd(s,body):
        m=None
        if body and s.command=='POST':
            try: m=json.loads(body).get('model')
            except Exception: pass
            if m is not None:
                try: d=json.loads(body); ka=d.get('keep_alive')
                except Exception: ka=None
                LOG.append({'t':round(time.time(),2),'path':s.path,'model':m,'keep_alive':ka,'empty':not (d.get('messages') or d.get('prompt')),'think':d.get('think'),'loop_reason':(b'repeats' in body and b'appears once' in body)})
        r=urllib.request.Request(UP+s.path,data=body,method=s.command,headers={'content-type':'application/json'})
        try:
            f=urllib.request.urlopen(r,timeout=600); s.send_response(f.status); s.end_headers()
            while True:
                c=f.read(4096)
                if not c: break
                s.wfile.write(c); s.wfile.flush()
        except urllib.error.HTTPError as e:
            s.send_response(e.code); s.end_headers(); s.wfile.write(e.read())
class S(socketserver.ThreadingMixIn,http.server.HTTPServer): daemon_threads=True
S(('127.0.0.1',11438),H).serve_forever()
