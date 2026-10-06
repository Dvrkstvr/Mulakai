"""SP-4: the cross-song numbers quoted in RESULT.md. python aggregate.py (stdlib) -> results/aggregate.json"""
import glob, json, os, statistics as st
HERE = os.path.dirname(os.path.abspath(__file__))
R = json.load(open(f"{HERE}/results.json"))
out = {}
# raw tracker misalignment (before the groove snap) and verified residual
raw, res = [], {"resolved": 0, "ok": 0, "fail": 0, "unresolved": 0}
exc = {}
for code, song in R["songs"].items():
    for en, e in song["edits"].items():
        for vn, v in e["variants"].items():
            if vn not in ("A3", "C1"):
                pass
            for k, s in enumerate(v["seams"]):
                if en == "repeat" and k == 1:
                    continue          # the copy hands back to the music that followed anyway: not a seam
                if vn in ("A3", "C1") and s["raw_misalign_ms"] is not None and (s["raw_corr"] or 0) >= 0.25:
                    raw.append(abs(s["raw_misalign_ms"]))
                if vn in ("A3", "C1"):
                    res[s["state"] if s["state"] != "ok" and s["state"] != "fail" else s["state"]] = res.get(s["state"], 0) + 1
                if s["lufs_excess"] is not None:
                    exc.setdefault(vn, []).append(abs(s["lufs_excess"]))
out["raw_misalignment_ms"] = {"n": len(raw), "median": st.median(raw), "share_over_20ms": sum(1 for x in raw if x > 20) / len(raw), "max": max(raw)}
out["verified_residual_seams_A3_C1"] = {k: v for k, v in res.items() if k in ("ok", "fail", "unresolved")}
out["lufs_excess_abs"] = {vn: {"n": len(x), "median": st.median(x), "max": max(x), "share_le_1dB": sum(1 for y in x if y <= 1.0) / len(x)} for vn, x in sorted(exc.items())}
# heal windows
hp = {"bal": [], "con": []}; hs = {"bal": [], "con": []}
for f in glob.glob(f"{HERE}/results/healpost_*.json"):
    d = json.load(open(f)); mode = d["id"].rsplit("_", 1)[1]
    hp[mode] += [w["lufs_delta"] for w in d["windows"]]
for f in glob.glob(f"{HERE}/results/heal_*.json"):
    d = json.load(open(f)); mode = d["id"].rsplit("_", 1)[1]
    hs[mode] += [s["seconds"] for s in d["steps"]]
out["heal_window_lufs_delta_db"] = {m: {"n": len(x), "median": st.median(x), "min": min(x), "share_below_minus_1dB": sum(1 for y in x if y < -1) / len(x), "share_below_minus_3dB": sum(1 for y in x if y < -3) / len(x)} for m, x in hp.items() if x}
out["heal_seconds_per_window"] = {m: {"n": len(x), "median": st.median(x), "max": max(x)} for m, x in hs.items() if x}
# span adherence deltas for A3 vs heals
d = {}
for code, song in R["songs"].items():
    for en, e in song["edits"].items():
        for vn, v in e["variants"].items():
            sp = v["span"]
            if sp["variant"] is None or sp["control"] is None:
                continue
            delta = (sp["variant"] - sp["control"]) * (-1 if en == "lyrics" else 1)
            d.setdefault(f"{en}/{vn}", []).append(round(delta, 3))
out["span_delta_vs_control_points"] = {k: v for k, v in sorted(d.items()) if k.split("/")[1] in ("A3", "C1", "A3_bal", "A3_con", "C1_bal", "C1_con")}
# splice seconds + base audio changed
sec = [v["extra_seconds"] for song in R["songs"].values() for e in song["edits"].values() for vn, v in e["variants"].items() if vn in ("A3", "C1")]
out["splice_seconds"] = {"median": st.median(sec), "max": max(sec)}
chg = [v["base_audio_changed_s"] for song in R["songs"].values() for e in song["edits"].values() for vn, v in e["variants"].items() if vn in ("A3", "C1")]
out["base_audio_changed_s_A3_C1"] = {"median": st.median(chg), "max": max(chg)}
json.dump(out, open(f"{HERE}/results/aggregate.json", "w"), indent=1)
print(json.dumps(out, indent=1))
