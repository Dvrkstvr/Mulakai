"""SP-1 driver: planner (Ollama) <-> YuE2 (yue-server) VRAM hand-off. Throwaway.
Stdlib only. NVML via ctypes for 50 ms VRAM sampling; events are logged with
wall-clock times so they can be matched against nvidia-smi.log."""
import ctypes, json, os, sys, threading, time, urllib.request, datetime

OLLAMA = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11435")
YUE = os.environ.get("YUE_API_URL", "http://127.0.0.1:8004")
MODEL = os.environ.get("MODEL", "qwen3:14b")
HERE = os.path.dirname(os.path.abspath(__file__))

# ---- NVML sampler -------------------------------------------------------
class Mem(ctypes.Structure):
    _fields_ = [("total", ctypes.c_ulonglong), ("free", ctypes.c_ulonglong), ("used", ctypes.c_ulonglong)]
_nv = ctypes.CDLL("nvml.dll"); _nv.nvmlInit_v2()
_h = ctypes.c_void_p(); _nv.nvmlDeviceGetHandleByIndex_v2(0, ctypes.byref(_h))
def used_mib():
    m = Mem(); _nv.nvmlDeviceGetMemoryInfo(_h, ctypes.byref(m)); return m.used / 2**20

def ts(t=None):
    return datetime.datetime.fromtimestamp(t or time.time()).strftime("%Y/%m/%d %H:%M:%S.%f")[:-3]

class Sampler(threading.Thread):
    def __init__(self, path):
        super().__init__(daemon=True); self.f = open(path, "w", buffering=1); self.stop = False
        self.f.write("time,epoch,used_mib\n"); self.samples = []
    def run(self):
        while not self.stop:
            t = time.time(); u = used_mib(); self.samples.append((t, u))
            self.f.write(f"{ts(t)},{t:.3f},{u:.1f}\n"); time.sleep(0.05)
    def peak(self, t0, t1):
        v = [u for t, u in self.samples if t0 <= t <= t1]; return max(v) if v else None

events = open(os.path.join(HERE, "events.log"), "a", buffering=1)
def ev(msg):
    line = f"{ts()} {msg}"; print(line, flush=True); events.write(line + "\n")

# ---- http ---------------------------------------------------------------
def http(method, url, body=None, timeout=600):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, method=method, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()

def ps():
    return http("GET", f"{OLLAMA}/api/ps", timeout=10)[1].get("models", [])

def settle(secs=2.0, tol=30):
    """wait until VRAM stable (±tol MiB) for secs; return it"""
    last, since = used_mib(), time.time()
    while time.time() - since < secs:
        time.sleep(0.1); u = used_mib()
        if abs(u - last) > tol: last, since = u, time.time()
    return last

def unload_and_time(sampler, baseline):
    t_req = time.time()
    code, _ = http("POST", f"{OLLAMA}/api/generate", {"model": MODEL, "keep_alive": 0})
    t_ack = time.time(); ev(f"unload ack code={code} after {t_ack - t_req:.2f}s")
    while ps():
        time.sleep(0.25)
    t_empty = time.time(); ev(f"/api/ps empty at ack+{t_empty - t_ack:.2f}s")
    t_base = None
    while time.time() - t_ack < 30:
        if used_mib() <= baseline + 300: t_base = time.time(); break  # 0.3 GB = ~307 MiB
        time.sleep(0.05)
    ev(f"VRAM within 0.3GB of baseline at ack+{(t_base - t_ack) if t_base else float('nan'):.2f}s (baseline {baseline:.0f} MiB, now {used_mib():.0f})")
    return {"ack_s": t_ack - t_req, "empty_after_ack_s": t_empty - t_ack,
            "baseline_after_ack_s": (t_base - t_ack) if t_base else None, "t_ack": t_ack}

# ---- yue ----------------------------------------------------------------
def yue_job(body, label, poll=0.5, cancel_after=None):
    t0 = time.time(); ev(f"{label}: POST /v1/jobs")
    code, job = http("POST", f"{YUE}/v1/jobs", body)
    if code not in (200, 202):
        ev(f"{label}: submit {code} {str(job)[:300]}"); return {"submit_code": code, "error": job}
    jid = job["id"]; t_run = None; live = []; cancelled = False
    while True:
        code, j = http("GET", f"{YUE}/v1/jobs/{jid}", timeout=30)
        now = time.time()
        if j["status"] == "running" and t_run is None: t_run = now; ev(f"{label}: running (queued {now - t0:.1f}s)")
        if j["status"] == "running": live.append((now, j.get("stage"), dict(j.get("tokens") or {})))
        if j["status"] not in ("queued", "running"): break
        if cancel_after and t_run and now - t_run > cancel_after and not cancelled:
            ev(f"{label}: cancelling after {now - t_run:.0f}s run time"); http("POST", f"{YUE}/v1/jobs/{jid}/cancel"); cancelled = True
        time.sleep(poll)
    t1 = time.time(); ev(f"{label}: {j['status']} in {t1 - (t_run or t0):.1f}s run, tokens={j.get('tokens')}")
    res = j.get("result") or {}
    tm = res.get("timing", {})
    out = {"id": jid, "status": j["status"], "queued_s": (t_run or t0) - t0, "run_s": t1 - (t_run or t0), "t_run": t_run, "t1": t1,
           "tokens": j.get("tokens"), "timing": tm, "truncated": res.get("truncated"),
           "audio_seconds": res.get("audio_seconds"), "error": j.get("error"), "cancelled": cancelled}
    tk = j.get("tokens") or {}
    if tm.get("semantic_seconds") and tk.get("semantic"): out["semantic_tok_s"] = tk["semantic"] / tm["semantic_seconds"]
    # live semantic rate (works for cancelled jobs too): tokens delta over time while stage == semantic
    sem = [(t, tk_.get("semantic", 0)) for t, st, tk_ in live if st == "semantic" and tk_.get("semantic", 0) > 0]
    if len(sem) >= 2 and sem[-1][0] > sem[0][0]:
        out["live_semantic_tok_s"] = (sem[-1][1] - sem[0][1]) / (sem[-1][0] - sem[0][0])
    return out
