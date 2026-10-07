"""SP-4: does a cut fall inside a sung word? Uses Whisper word times (results/asr.json, whole-song reads of the base and of each
local-edit control) at every cut point of every splice: the end of one source piece and the start of the next, in that piece's own audio.
A word 'straddles' a cut when it starts at least 30 ms before and ends at least 30 ms after it. Whisper word times are good to
roughly 50-100 ms, so this is a flag, not a proof. stdlib; python words_at_cuts.py -> results/words_at_cuts.json"""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))
ASR = json.load(open(f"{HERE}/results/asr.json", encoding="utf-8"))
M = 0.03
out = {}; tot = 0; hit = 0
for code in "ABCD":
    sj = json.load(open(f"{HERE}/results/splice_{code}.json"))
    spans = json.load(open(f"{HERE}/spans.json"))[code]["edits"]
    for key, v in sj["variants"].items():
        if v["variant"] not in ("A3", "C1"):
            continue
        ename = v["edit"]
        parts = list(zip(v["map"], v["src"]))
        rows = []
        for k in range(len(parts) - 1):
            (a0, a1, _, s0a), na = parts[k]; (b0, b1, _, s0b), nb = parts[k + 1]
            for side, name, t in (("before", na, s0a + (a1 - a0)), ("after", nb, s0b)):
                aid = f"{code}_full_base" if name in ("base", "copy") else f"{code}_full_ctrl_{ename}"
                words = ASR.get(aid, {}).get("words")
                if words is None:
                    continue
                span = [w for w in words if w["s"] < t - M and w["e"] > t + M]
                near = [w for w in words if abs(w["s"] - t) < 0.08 or abs(w["e"] - t) < 0.08]
                rows.append({"join": k, "side": side, "piece": name, "src_t": round(t, 3), "straddles": [w["w"] for w in span], "words_within_80ms_of_cut": [w["w"] for w in near]})
                tot += 1; hit += 1 if span else 0
        out[f'{code}_{key}'] = rows
json.dump(out, open(f"{HERE}/results/words_at_cuts.json", "w"), indent=1, ensure_ascii=False)
print("cut sides checked", tot, "with a word straddling the cut", hit)
both = 0; one = 0; none_ = 0; same = 0
norm = lambda w: "".join(ch for ch in w.lower() if ch.isalnum())
for k, rows in out.items():
    for j in sorted({r["join"] for r in rows}):
        side = [r for r in rows if r["join"] == j]
        n = sum(1 for r in side if r["straddles"])
        both += n == 2; one += n == 1; none_ += n == 0
        if n == 2 and {norm(w) for r in side for w in r["straddles"]} .__len__() == 1:
            same += 1
print("of the 'both sides' cut points, the same word on both sides:", same)
print("cut points: word straddles both sides", both, "| one side", one, "| neither", none_)
