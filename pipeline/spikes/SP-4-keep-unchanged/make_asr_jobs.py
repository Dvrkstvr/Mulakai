"""SP-4: Whisper jobs. Windows python (stdlib). usage: python make_asr_jobs.py -> asr_jobs.json
(1) REWRITE LYRICS: the first chorus's span (+-0.5 s) in the base, the full re-render (control), each splice and each healed splice.
(2) whole-song reads of each base and each local-edit control, for word timings at the cut points (words_at_cuts.py)."""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__)).replace("\\", "/")
LIB = "E:/repos/Mulakai/server/data/audio"
OUT = "E:/ai/tmp/sp4/out"; HEAL = "E:/ai/tmp/sp4/heal"
REN = "//wsl.localhost/Ubuntu-24.04/home/calvin/sp4/render"
LANG = {"A": "en", "B": "es", "C": "de", "D": "es"}
spans = json.load(open(f"{HERE}/spans.json"))
jobs = []; pad = 0.5
for code in "ABCD":
    sp = spans[code]; p = f"{HERE}/results/splice_{code}.json"
    if not os.path.exists(p):
        continue
    sj = json.load(open(p))
    jobs.append({"id": f"{code}_full_base", "wav": f"{LIB}/{sp['vid']}.wav", "start": 0, "end": 400, "lang": LANG[code]})
    for en in ("reharm", "phrase", "lyrics"):
        jobs.append({"id": f"{code}_full_ctrl_{en}", "wav": f"{REN}/{sp['edits'][en]['render']}/audio.flac", "start": 0, "end": 400, "lang": LANG[code]})
    vs = {k: v for k, v in sj["variants"].items() if v["edit"] == "lyrics"}
    any_v = next(iter(vs.values()))
    bs, be = any_v["base_span_s"]; ns, ne = any_v["new_span_s"]
    jobs.append({"id": f"{code}_base", "wav": f"{LIB}/{sp['vid']}.wav", "start": bs - pad, "end": be + pad, "lang": LANG[code]})
    jobs.append({"id": f"{code}_ctrl", "wav": f"{REN}/{sp['edits']['lyrics']['render']}/audio.flac", "start": ns - pad, "end": ne + pad, "lang": LANG[code]})
    for k, v in vs.items():
        a, b = v["edit_out_s"]
        jobs.append({"id": f"{code}_lyrics_{v['variant']}", "wav": v["path"].replace("/mnt/e/", "E:/"), "start": a - pad, "end": b + pad, "lang": LANG[code]})
        for mode in ("bal", "con"):
            hp = f"{HEAL}/{code}_lyrics_{v['variant']}_{mode}.wav"
            if os.path.exists(hp):
                jobs.append({"id": f"{code}_lyrics_{v['variant']}_{mode}", "wav": hp, "start": a - pad, "end": b + pad, "lang": LANG[code]})
json.dump(jobs, open(f"{HERE}/asr_jobs.json", "w", encoding="utf-8"), indent=1)
print(len(jobs), "asr jobs")
