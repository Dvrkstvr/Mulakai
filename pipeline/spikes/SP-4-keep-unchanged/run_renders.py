"""SP-4 runner (copy of SP-3 run_renders.py, port 8044, outputs in ~/sp4) (run inside WSL, stdlib only): for each job body in jobs/, POST /v1/jobs to yue-server, wait, fetch the
audio, then transcribe it with SheetSage2 (default full task: melody + chords). Heavy artifacts go to ~/sp4 (outside the repo).
usage: python3 run_renders.py [--orig] [jobname ...]   (--orig also transcribes the three library originals first)"""
import json, os, subprocess, sys, time, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
YUE = os.environ.get("YUE_API_URL", "http://127.0.0.1:8044")
OUT = os.path.expanduser("~/sp4")
SS = os.path.expanduser("~/sheetsage2/SheetSage2")
SSPY = os.path.expanduser("~/sheetsage2/.venv/bin/python")
LIB = "/mnt/e/repos/Mulakai/server/data/audio/"
ORIG = {"A": "2c944049-75eb-4448-ac49-7f50f93be80d", "B": "3820c535-b81f-4716-94c2-370f9272f4b7", "C": "c8144c53-6612-4efc-8a4c-da279f2e0307", "D": "3c9e79de-0844-40dc-a89f-4c6864c8a23a"}
LOG = open(os.path.join(HERE, "logs", "run_renders.log"), "a", buffering=1)


def log(msg):
    line = time.strftime("%H:%M:%S ") + msg
    print(line, flush=True); LOG.write(line + "\n")


def http(method, url, body=None, raw=False, timeout=60):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, method=method, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            b = r.read()
            return r.status, (b if raw else json.loads(b or b"null"))
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


def transcribe(audio, name):
    out = os.path.join(OUT, "ss", name)
    if os.path.exists(os.path.join(out, "result.json")):
        log(f"transcribe {name}: cached"); return out
    os.makedirs(out, exist_ok=True)
    t0 = time.time()
    r = subprocess.run([SSPY, "infer.py", audio, "--output", out, "--local-files-only"], cwd=SS, capture_output=True, text=True)
    log(f"transcribe {name}: rc={r.returncode} {time.time() - t0:.1f}s files={len(os.listdir(out))}")
    if r.returncode:
        log("  " + (r.stdout + r.stderr)[-400:])
    return out


def render(name):
    d = os.path.join(OUT, "render", name)
    if os.path.exists(os.path.join(d, "job.json")) and json.load(open(os.path.join(d, "job.json"))).get("status") == "succeeded":
        log(f"render {name}: cached"); return d
    os.makedirs(d, exist_ok=True)
    body = json.load(open(os.path.join(HERE, "jobs", name + ".json"), encoding="utf-8"))
    t0 = time.time()
    code, job = http("POST", f"{YUE}/v1/jobs", body)
    if code not in (200, 202):
        log(f"render {name}: submit {code} {str(job)[:300]}"); return None
    jid = job["id"]; log(f"render {name}: job {jid}")
    while True:
        time.sleep(1.0)
        code, j = http("GET", f"{YUE}/v1/jobs/{jid}")
        if j["status"] not in ("queued", "running"):
            break
    log(f"render {name}: {j['status']} {time.time() - t0:.1f}s tokens={j.get('tokens')} trunc={(j.get('result') or {}).get('truncated')} audio_s={(j.get('result') or {}).get('audio_seconds')} err={j.get('error')}")
    json.dump(j, open(os.path.join(d, "job.json"), "w"), indent=1)
    if j["status"] != "succeeded":
        return None
    code, audio = http("GET", f"{YUE}/v1/jobs/{jid}/audio", raw=True, timeout=300)
    open(os.path.join(d, "audio.bin"), "wb").write(audio)
    code, sc = http("GET", f"{YUE}/v1/jobs/{jid}/score", raw=True)
    if code == 200:
        open(os.path.join(d, "score_returned.abc"), "wb").write(sc)
    # name the audio by sniffing the container
    ext = "flac" if audio[:4] == b"fLaC" else "wav" if audio[:4] == b"RIFF" else "mp3"
    os.replace(os.path.join(d, "audio.bin"), os.path.join(d, "audio." + ext))
    return d


def main():
    args = sys.argv[1:]
    os.makedirs(os.path.join(OUT, "render"), exist_ok=True)
    if "--orig" in args:
        args.remove("--orig")
        for code, vid in ORIG.items():
            transcribe(LIB + vid + ".wav", f"{code}_orig")
    names = args or sorted(f[:-5] for f in os.listdir(os.path.join(HERE, "jobs")) if f.endswith(".json"))
    for n in names:
        d = render(n)
        if d:
            audio = [os.path.join(d, f) for f in os.listdir(d) if f.startswith("audio.")][0]
            transcribe(audio, n)


main()
