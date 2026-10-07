"""SP-6 runner: for each song and arm, POST /v1/jobs (render), then POST /v1/splices (the app's two calls), keep audio + grids + verdicts.
usage: python run.py [song:arm ...]   default = every song, arms Z A B C D BD.  Resumable (skips finished arms)."""
import json, os, sys, time, uuid, urllib.request, urllib.error
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = "E:/ai/tmp/sp6/out"; YUE = "http://127.0.0.1:8064"
INP = json.load(open(HERE + "/inputs.json"))
ARMS = ["Z", "A", "B", "C", "D", "BD"]
LOG = open("E:/ai/tmp/sp6/logs/run.log", "a", buffering=1)
def log(m):
    l = time.strftime("%H:%M:%S ") + m; print(l, flush=True); LOG.write(l + "\n")
def http(method, path, body=None, raw=False, headers=None, data=None, timeout=120):
    h = {"Content-Type": "application/json"} if body is not None else {}
    h.update(headers or {})
    req = urllib.request.Request(YUE + path, data=data if data is not None else (None if body is None else json.dumps(body).encode()), method=method, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            b = r.read(); return r.status, (b if raw else json.loads(b or b"null"))
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()
def multipart(fields, fname, fbytes):
    bd = uuid.uuid4().hex; parts = []
    for k, v in fields.items():
        parts.append(f'--{bd}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode())
    parts.append(f'--{bd}\r\nContent-Disposition: form-data; name="audio"; filename="{fname}"\r\nContent-Type: application/octet-stream\r\n\r\n'.encode() + fbytes + b"\r\n")
    parts.append(f"--{bd}--\r\n".encode())
    return b"".join(parts), {"Content-Type": f"multipart/form-data; boundary={bd}"}
def wait(prefix, jid, every=2.0):
    while True:
        time.sleep(every); c, j = http("GET", f"{prefix}/{jid}")
        if j["status"] not in ("queued", "running"): return j
def arm_request(s, arm):
    abc = {"Z": s["base_abc"], "D": s["triad_abc"], "BD": s["triad_abc"]}.get(arm, s["edited_abc"])
    style = s["style"]["B" if arm == "BD" else arm if arm in s["style"] else "A"]
    return dict(style=style, lyrics=s["lyrics"], cot=s["cot"], seed=s["seed"], abc=abc)
def do(key, arm):
    s = INP[key]; d = f"{OUT}/{key}/{arm}"; os.makedirs(d, exist_ok=True)
    if os.path.exists(d + "/done.json"): log(f"{key}:{arm} cached"); return
    body = arm_request(s, arm); json.dump(body, open(d + "/request.json", "w"), indent=1)
    t0 = time.time(); c, job = http("POST", "/v1/jobs", body, headers={"Idempotency-Key": uuid.uuid4().hex})
    if c not in (200, 202): log(f"{key}:{arm} submit {c} {str(job)[:300]}"); return
    j = wait("/v1/jobs", job["id"]); r = j.get("result") or {}
    log(f"{key}:{arm} render {j['status']} {time.time()-t0:.0f}s trunc={r.get('truncated')} audio_s={r.get('audio_seconds')} err={j.get('error')}")
    if j["status"] != "succeeded": json.dump(j, open(d + "/render_job.json", "w"), indent=1); return
    c, a = http("GET", f"/v1/jobs/{job['id']}/audio", raw=True, timeout=300)
    ext = "flac" if a[:4] == b"fLaC" else "wav"; open(f"{d}/render.{ext}", "wb").write(a)
    json.dump(j, open(d + "/render_job.json", "w"), indent=1)
    done = dict(render_job=job["id"], render_file=f"render.{ext}", render_s=round(time.time() - t0))
    if arm != "Z":
        v1 = open(s["v1_file"], "rb").read()
        spec = dict(op={"op": "REHARMONIZE", "from_bar": s["span"][0], "to_bar": s["span"][1]}, base_abc=s["base_abc"], render_job=job["id"], edited_abc=body["abc"])
        data, hdr = multipart({"spec": json.dumps(spec)}, os.path.basename(s["v1_file"]), v1)
        t1 = time.time(); c, sp = http("POST", "/v1/splices", headers=hdr, data=data, timeout=300)
        if c not in (200, 202): log(f"{key}:{arm} splice submit {c} {str(sp)[:300]}"); return
        sj = wait("/v1/splices", sp["id"]); res = sj.get("result") or {}
        log(f"{key}:{arm} splice {sj['status']} {time.time()-t1:.0f}s verdict={res.get('verdict')} reason={res.get('reason')} joins={res.get('joins_s')} null={res.get('null_test')} err={sj.get('error')}")
        json.dump(sj, open(d + "/splice_job.json", "w"), indent=1)
        if sj["status"] == "succeeded" and res.get("verdict") == "ok":
            c, a = http("GET", f"/v1/splices/{sp['id']}/audio", raw=True, timeout=300); open(d + "/spliced.wav", "wb").write(a)
        for g in ("base", "render", "out"):
            c, gj = http("GET", f"/v1/splices/{sp['id']}/grid/{g}")
            if c == 200: json.dump(gj, open(f"{d}/grid_{g}.json", "w"))
        done.update(splice_job=sp["id"], verdict=res.get("verdict"), joins_s=res.get("joins_s"))
    json.dump(done, open(d + "/done.json", "w"), indent=1)
want = sys.argv[1:] or [f"{k}:{a}" for k in INP for a in ARMS]
for w in want:
    k, a = w.split(":"); do(k, a)
log("run finished")
