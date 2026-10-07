"""SP-4: heal jobs for heal.py. usage: python make_heal_jobs.py <bal|con> [songs]  -> heal_jobs_<mode>.json
Source of each job: A3 (level-matched splice) for local edits, C1 (1-beat crossfade) for REPEAT / CUT. One ~3 s window centred on each real seam."""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
mode = sys.argv[1]; songs = sys.argv[2:] or list("ABCD")
OUT = r"E:\ai\tmp\sp4\out"; HEAL = r"E:\ai\tmp\sp4\heal_raw"; os.makedirs(HEAL, exist_ok=True)
H = 3.0
LANG = {"A": "en", "B": "es", "C": "de", "D": "es"}
SP3 = os.path.join(HERE, "..", "SP-3-cot-full-adherence", "jobs")
M = {"bal": ("balanced", 0.5), "con": ("conservative", 0.5)}[mode]
jobs = []
for code in songs:
    sj = json.load(open(f"{HERE}/results/splice_{code}.json"))
    spans = json.load(open(f"{HERE}/spans.json"))[code]["edits"]
    for key, v in sj["variants"].items():
        ename, var = v["edit"], v["variant"]
        kind = spans[ename]["kind"]
        if (kind == "local" and var != "A3") or (kind != "local" and var != "C1"):
            continue
        render = spans[ename]["render"]
        jp = os.path.join(SP3, render.split("_")[0] + "_" + render.split("_")[1] + ".json")
        jp = jp if os.path.exists(jp) else os.path.join(HERE, "jobs", render + ".json")
        job = json.load(open(jp, encoding="utf-8"))
        joins = v["join_out_s"][:1] if kind == "repeat" else v["join_out_s"]
        jobs.append({"id": f"{code}_{ename}_{var}_{mode}", "src": f"{OUT}\{code}_{ename}_{var}.wav", "out": f"{HEAL}\{code}_{ename}_{var}_{mode}.wav",
                     "windows": [[round(t - H / 2, 3), round(t + H / 2, 3)] for t in joins], "mode": M[0], "strength": M[1],
                     "prompt": job["style"], "lyrics": job["lyrics"], "lang": LANG[code], "steps": 8})
json.dump(jobs, open(f"{HERE}/heal_jobs_{mode}.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(len(jobs), "jobs,", sum(len(j["windows"]) for j in jobs), "windows")
