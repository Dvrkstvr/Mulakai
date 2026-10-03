"""SP-1 phases. usage: python run.py <phase> ...   phases: baseline planner_cycle handoff negative cpu near all"""
import json, sys, time
from spike import *

HERE_ = os.path.dirname(os.path.abspath(__file__))
P = json.load(open(os.path.join(HERE_, "planner_prompt.json"), encoding="utf-8"))
NORMAL = json.load(open(os.path.join(HERE_, "yue_request_normal.json"), encoding="utf-8"))
NEAR = json.load(open(os.path.join(HERE_, "yue_request_near.json"), encoding="utf-8"))
NEAR_REAL = json.load(open(os.path.join(HERE_, "yue_request_near_real.json"), encoding="utf-8"))
RES = os.path.join(HERE_, "results.json")
results = json.load(open(RES)) if os.path.exists(RES) else {}
def save(k, v): results[k] = v; json.dump(results, open(RES, "w"), indent=1)

sm = Sampler(os.path.join(HERE_, "vram_ndr.csv")); sm.start()
time.sleep(0.3)

def planner_call(keep_alive=None, tag="plan"):
    body = {"model": MODEL, "messages": P["messages"], "temperature": 0, "max_tokens": 1500, "reasoning_effort": os.environ.get("REASONING", "none"),
            "response_format": {"type": "json_schema", "json_schema": {"name": "plan", "schema": P["schema"], "strict": True}}}
    t0 = time.time(); ev(f"{tag}: POST /v1/chat/completions (cold load)")
    code, r = http("POST", f"{OLLAMA}/v1/chat/completions", body, timeout=900)
    t1 = time.time()
    if code != 200: ev(f"{tag}: HTTP {code} {str(r)[:300]}"); return {"error": str(r)[:300]}
    u = r.get("usage", {}); txt = r["choices"][0]["message"]["content"]
    try: json.loads(txt); valid = True
    except Exception: valid = False
    m = (ps() or [{}])[0]
    ev(f"{tag}: done {t1 - t0:.1f}s prompt_tokens={u.get('prompt_tokens')} completion_tokens={u.get('completion_tokens')} json_valid={valid} "
       f"ps.size_vram={m.get('size_vram',0)/2**30:.2f}GiB size={m.get('size',0)/2**30:.2f}GiB ctx={m.get('context_length')} used_now={used_mib():.0f}MiB")
    return {"wall_s": t1 - t0, "usage": u, "json_valid": valid, "out_head": txt[:300], "t0": t0, "t1": t1,
            "ps": {k: m.get(k) for k in ("size", "size_vram", "context_length", "expires_at")}, "used_after_mib": used_mib()}

phases = sys.argv[1:] or ["all"]
want = lambda p: p in phases or "all" in phases

if want("baseline"):
    b = settle(3); ev(f"BASELINE idle VRAM {b:.0f} MiB; ps={ps()}"); save("baseline_mib", b)
baseline = results.get("baseline_mib") or settle(3)

if want("handoff"):
    # steps 2+3: planner call, unload with ack, poll /api/ps, then YuE2 immediately
    b0 = settle(3); ev(f"[handoff] pre-run idle {b0:.0f} MiB (baseline {baseline:.0f})")
    pc = planner_call(tag="handoff.plan")
    peak_plan = sm.peak(pc["t0"], time.time())
    un = unload_and_time(sm, b0)
    ev("[handoff] YuE2 job starts immediately after unload ack/empty")
    yj = yue_job(NORMAL, "handoff.yue")
    peak_y = sm.peak(yj["t_run"] or yj["t1"], yj["t1"]) if yj.get("t_run") else None
    ev(f"[handoff] planner peak {peak_plan:.0f} MiB; yue job peak card {peak_y} MiB; yue run {yj.get('run_s')}")
    save(os.environ.get("KEY", "handoff"), {"baseline_before": b0, "planner": pc, "planner_peak_mib": peak_plan, "unload": un, "yue": yj, "yue_peak_mib": peak_y,
                     "settled_after_yue_mib": settle(3)})

if want("control"):
    b0 = settle(3); ev(f"[control] YuE2 alone, planner never loaded; idle {b0:.0f} MiB; ps={ps()}")
    yj = yue_job(NORMAL, "control.yue")
    peak_y = sm.peak(yj["t_run"], yj["t1"]) if yj.get("t_run") else None
    key = os.environ.get("KEY", "control")
    save(key, {"yue": yj, "yue_peak_mib": peak_y, "baseline_before": b0}); ev(f"[control] peak {peak_y}")

if want("negative"):
    b0 = settle(3); ev(f"[negative] pre-run idle {b0:.0f} MiB; planner stays loaded (keep_alive 5m)")
    pc = planner_call(tag="negative.plan")
    ev(f"[negative] ps={[(m['name'], m.get('expires_at')) for m in ps()]}")
    yj = yue_job(NORMAL, "negative.yue", cancel_after=int(os.environ.get("NEG_CANCEL_S", "200")))
    peak_y = sm.peak(yj["t_run"], yj["t1"]) if yj.get("t_run") else None
    ev(f"[negative] yue card peak {peak_y} MiB")
    un = unload_and_time(sm, b0)
    save(os.environ.get("KEY", "negative"), {"planner": pc, "yue": yj, "yue_peak_mib": peak_y, "unload": un, "settled_mib": settle(3)})

if want("cpu"):
    ev("[cpu] num_gpu 0 planner call via /api/chat")
    b0 = settle(3); body = {"model": MODEL, "stream": False, "messages": P["messages"], "format": P["schema"], "keep_alive": 0, "think": os.environ.get("THINK", "0") == "1",
                            "options": {"num_gpu": 0, "num_ctx": 16384, "temperature": 0, "num_predict": 1500}}
    t0 = time.time(); code, r = http("POST", f"{OLLAMA}/api/chat", body, timeout=1800); t1 = time.time()
    peak = sm.peak(t0, t1)
    out = {"wall_s": t1 - t0, "code": code, "vram_before": b0, "vram_peak": peak}
    if code == 200:
        out.update({k: r.get(k) for k in ("load_duration", "prompt_eval_count", "prompt_eval_duration", "eval_count", "eval_duration")})
        try: json.loads(r["message"]["content"]); out["json_valid"] = True
        except Exception: out["json_valid"] = False
    ev(f"[cpu] {out}"); save(os.environ.get("KEY", "cpu"), out)

if want("near"):
    b0 = settle(3); ev(f"[near] pre-run idle {b0:.0f} MiB; planner loaded? {ps()}")
    yj = yue_job(NEAR, "near.yue")
    peak_y = sm.peak(yj["t_run"], yj["t1"]) if yj.get("t_run") else None
    ev(f"[near] card peak {peak_y} MiB; truncated={yj.get('truncated')}")
    save("near", {"baseline_before": b0, "yue": yj, "yue_peak_mib": peak_y, "settled_mib": settle(3)})

if want("near_real"):
    b0 = settle(3); ev(f"[near_real] pre-run idle {b0:.0f} MiB")
    yj = yue_job(NEAR_REAL, "near_real.yue")
    peak_y = sm.peak(yj["t_run"], yj["t1"]) if yj.get("t_run") else None
    ev(f"[near_real] card peak {peak_y} MiB; truncated={yj.get('truncated')}")
    save("near_real", {"baseline_before": b0, "yue": yj, "yue_peak_mib": peak_y, "settled_mib": settle(3)})

for _t in ("2700", "3300"):
    if want("near_" + _t):
        body = json.load(open(os.path.join(HERE_, f"yue_request_near_{_t}.json"), encoding="utf-8"))
        b0 = settle(3); ev(f"[near_{_t}] pre-run idle {b0:.0f} MiB")
        yj = yue_job(body, f"near_{_t}.yue")
        peak_y = sm.peak(yj["t_run"], yj["t1"]) if yj.get("t_run") else None
        ev(f"[near_{_t}] card peak {peak_y} MiB; truncated={yj.get('truncated')}")
        save("near_" + _t, {"baseline_before": b0, "yue": yj, "yue_peak_mib": peak_y, "settled_mib": settle(3)})

sm.stop = True; time.sleep(0.2)
