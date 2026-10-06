"""SP-4: markdown tables for RESULT.md from results.json. python make_tables.py > results/tables.md"""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))
R = json.load(open(f"{HERE}/results.json"))
NAME = {"A": "A Purple Shinings", "B": "B Romantica", "C": "C Gertar", "D": "D Carinito"}
f = lambda x, d=3: "n/a" if x is None else f"{x:.{d}f}"
sg = lambda x: "--" if x is None else f"{x:+.1f}"


def seam_cell(s):
    st = {"ok": "ok", "fail": "FAIL", "unresolved": "unres."}[s["state"]]
    raw = "--" if s["raw_misalign_ms"] is None else f"{s['raw_misalign_ms']:+.0f}"
    return f"raw {raw} ms / {st} / LUFS {sg(s['lufs_step'])} (ex {sg(s['lufs_excess'])})"


def table(variants, edits, title):
    print(f"\n**{title}**\n")
    print("| edit | song | span metric: result vs full re-render | rest of song (melody F1, result vs control) | seam 1 | seam 2 | base audio changed |")
    print("|---|---|---|---|---|---|---|")
    for en in edits:
        for code in "ABCD":
            e = R["songs"][code]["edits"][en]; v = e["variants"].get(variants)
            if not v:
                continue
            sp = v["span"]; c = e["control"]
            ss = v["seams"]; s2 = seam_cell(ss[1]) if len(ss) > 1 and not (en == "repeat") else "(none)"
            metric = f"{f(sp['variant'])} vs {f(sp['control'])}" + ("" if sp["variant"] is None or sp["control"] is None else f" ({(sp['variant']-sp['control'])*100:+.1f} pt)")
            print(f"| {en} | {NAME[code]} | {metric} | {f(v['rest_melody_F1_fold'])} vs {f(c['rest_melody_F1_fold'])} | {seam_cell(ss[0])} | {s2} | {v['base_audio_changed_s']:.2f} s |")


table("A3", ["reharm", "phrase", "lyrics"], "Candidate A (A3: 1-beat equal-power crossfade, groove-snapped cuts, level-matched span) on local edits")
table("C1", ["repeat", "cut"], "Candidate C (audio-only REPEAT / CUT, 1-beat crossfade, groove-snapped cut) on structural edits")
print("\n**Candidate B (A3 or C1 + ACE-Step repaint of a 3 s window on each real seam), balanced vs conservative, against the unhealed splice**\n")
print("| edit | song | span metric: A3/C1 | bal | con | window loudness change in dB per window (bal , con) | worst seam LUFS step beyond the base (structure: raw step): A3/C1 -> bal -> con |")
print("|---|---|---|---|---|---|---|")
for en, base in (("reharm", "A3"), ("phrase", "A3"), ("lyrics", "A3"), ("repeat", "C1"), ("cut", "C1")):
    for code in "ABCD":
        e = R["songs"][code]["edits"][en]; v0 = e["variants"][base]; vb = e["variants"].get(base + "_bal"); vc = e["variants"].get(base + "_con")
        if not vb:
            continue
        mx = lambda v: max([abs(s["lufs_excess"] if s["lufs_excess"] is not None else s["lufs_step"]) for s in v["seams"][: (1 if en in ("repeat", "cut") else 2)]])
        wb = "/".join(f"{x:+.1f}" for x in vb["heal_post"]["window_lufs_delta_db"]) + " , " + "/".join(f"{x:+.1f}" for x in vc["heal_post"]["window_lufs_delta_db"])
        print(f"| {en} | {NAME[code]} | {f(v0['span']['variant'])} | {f(vb['span']['variant'])} | {f(vc['span']['variant'])} | {wb} | {mx(v0):.1f} -> {mx(vb):.1f} -> {mx(vc):.1f} |")
