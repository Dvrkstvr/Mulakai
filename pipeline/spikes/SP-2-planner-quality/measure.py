"""Per-model side measurements: cold load, tokens/s, GPU/CPU split, VRAM peak and release, raw-score prompt size (R-015).
Usage: python measure.py MODEL TAG. Writes results/measure_<tag>.json"""
import glob, json, os, subprocess, sys, time, urllib.request
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import run, planner as P, score as S

OL = P.OLLAMA


def http(method, path, body=None, timeout=900):
    req = urllib.request.Request(OL + path, data=None if body is None else json.dumps(body).encode(), method=method,
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read() or b"null")


def vram():
    o = subprocess.run(["nvidia-smi", "--query-gpu=memory.used", "--format=csv,noheader,nounits"], capture_output=True, text=True).stdout.strip()
    return int(o)


def ps():
    return http("GET", "/api/ps").get("models", [])


model, tag = sys.argv[1], sys.argv[2]
out = {"model": model}
# 1. unload and confirm the release
if ps():
    http("POST", "/api/generate", {"model": model, "keep_alive": 0})
    t0 = time.time()
    while ps() and time.time() - t0 < 30:
        time.sleep(0.25)
    time.sleep(1.0)
out["vram_idle_mib"] = vram()
# 2. cold load + first tiny reply (native API for the timing breakdown)
t0 = time.time()
r = http("POST", "/api/chat", {"model": model, "messages": [{"role": "user", "content": "Reply with the word ok."}], "stream": False,
                                "think": False, "options": {"num_ctx": 16384, "num_predict": 8}})
out["cold_load_total_s"] = round(time.time() - t0, 2)
out["cold_load_s"] = round(r.get("load_duration", 0) / 1e9, 2)
m = ps()[0]
out["ps"] = {"size_gib": round(m["size"] / 2**30, 2), "size_vram_gib": round(m["size_vram"] / 2**30, 2), "context_length": m["context_length"]}
out["vram_loaded_mib"] = vram()
# 3. real plan-sized generation speed: prompt eval and decode rates from a representative prompt
lib = run.library()
sc = lib[2]
doc = S.Doc(sc["text"])
user = P.user_prompt(doc, sc["lyrics"], sc["style"], "Give the first four bars of the chorus jazz chords.")
body = {"model": model, "messages": [{"role": "system", "content": P.system_prompt()}, {"role": "user", "content": user}], "stream": False,
        "think": False, "format": P.build_schema(), "options": {"num_ctx": 16384, "temperature": 0.3, "seed": 7, "num_predict": 700}}
r = http("POST", "/api/chat", body)
out["plan_call"] = {"prompt_tokens": r["prompt_eval_count"], "prompt_eval_s": round(r["prompt_eval_duration"] / 1e9, 2),
                    "prompt_tok_s": round(r["prompt_eval_count"] / (r["prompt_eval_duration"] / 1e9), 1),
                    "gen_tokens": r["eval_count"], "gen_s": round(r["eval_duration"] / 1e9, 2),
                    "gen_tok_s": round(r["eval_count"] / (r["eval_duration"] / 1e9), 1)}
out["vram_loaded_after_plan_mib"] = vram()
# 4. R-015: raw score + rules + lyrics + style, token counts with this model's tokenizer (prompt_eval_count, num_predict 1)
raw = []
for f in sorted(glob.glob(r"E:\repos\Mulakai\server\data\audio\*.abc")):
    t = open(f, encoding="utf-8").read()
    vid = os.path.basename(f)[:8]
    row = [s for s in lib if s["vid"][:8] == vid]
    lyr, sty = (row[0]["lyrics"], row[0]["style"]) if row else ("", "")
    msg = P.system_prompt() + f"\nSTYLE: {sty}\nLYRICS:\n{lyr}\nSCORE:\n{t}\nREQUEST: add a 4-bar sax phrase"
    rr = http("POST", "/api/chat", {"model": model, "messages": [{"role": "user", "content": msg}], "stream": False, "think": False,
                                    "options": {"num_ctx": 16384, "num_predict": 1}})
    raw.append({"vid": vid, "score_chars": len(t), "prompt_tokens": rr["prompt_eval_count"]})
out["raw_score_prompts"] = raw
# 5. unload + release timing
t0 = time.time()
http("POST", "/api/generate", {"model": model, "keep_alive": 0})
ack = time.time() - t0
while ps() and time.time() - t0 < 30:
    time.sleep(0.05)
out["unload"] = {"ack_s": round(ack, 3), "ps_empty_s": round(time.time() - t0, 3)}
for _ in range(60):
    if abs(vram() - out["vram_idle_mib"]) < 300:
        break
    time.sleep(0.25)
out["unload"]["vram_back_s"] = round(time.time() - t0, 2)
out["vram_after_unload_mib"] = vram()
# 6. warm-page-cache cold load (second load after unload)
t0 = time.time()
http("POST", "/api/chat", {"model": model, "messages": [{"role": "user", "content": "ok"}], "stream": False, "think": False,
                           "options": {"num_ctx": 16384, "num_predict": 4}})
out["reload_total_s"] = round(time.time() - t0, 2)
http("POST", "/api/generate", {"model": model, "keep_alive": 0})
json.dump(out, open(os.path.join(HERE, "results", f"measure_{tag}.json"), "w"), indent=1)
print(json.dumps(out, indent=1))
