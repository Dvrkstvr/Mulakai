"""SP-4: fold results/measure_<song>.json (+ asr.json) into results.json and print the tables for RESULT.md.
python summarize.py   (Windows or WSL, stdlib)"""
import json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
SONGS = "ABCD"
SPANS = json.load(open(f"{HERE}/spans.json"))
asr_p = f"{HERE}/results/asr.json"
ASR = json.load(open(asr_p, encoding="utf-8")) if os.path.exists(asr_p) else {}
NEW_LYRICS = {}
sys.path.insert(0, HERE)


def lines_of(code):
    base = json.load(open(f"{HERE}/base/{code}.json", encoding="utf-8"))
    jb = json.load(open(f"{HERE}/jobs/{code}_L.json", encoding="utf-8"))
    blocks_old = base["lyrics"].split("\n\n"); blocks_new = jb["lyrics"].split("\n\n")
    ch_old = next(b for b in blocks_old if b.startswith("[Chorus]")).split("\n")[1:]
    ch_new = next(b for b in blocks_new if b.startswith("[Chorus]")).split("\n")[1:]
    return ch_old, ch_new


def wer(ref_lines, hyp):
    norm = lambda t: re.sub(r"[^\w\s]", " ", t.lower()).split()
    r = norm(" ".join(ref_lines)); h = norm(hyp)
    d = [[0] * (len(h) + 1) for _ in range(len(r) + 1)]
    for i in range(len(r) + 1): d[i][0] = i
    for j in range(len(h) + 1): d[0][j] = j
    for i in range(1, len(r) + 1):
        for j in range(1, len(h) + 1):
            d[i][j] = min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (r[i - 1] != h[j - 1]))
    return d[-1][-1] / max(len(r), 1)


def span_value(ename, a):
    s = a.get("span") or {}
    if ename == "reharm": return s.get("root_new")
    if ename == "phrase": return (s.get("instrumental") or {}).get("F1_new_fold")
    if ename == "repeat": return (s.get("copy_vs_first") or {}).get("fold")
    if ename == "cut": return s.get("root_8_bars_after_seam")
    return None


SNAP = {}
for _c in SONGS:
    _p = f"{HERE}/results/splice_{_c}.json"
    if os.path.exists(_p):
        for _k, _v in json.load(open(_p))["variants"].items():
            SNAP[(_c, _v["edit"], _v["variant"])] = _v["snap"]


def row_of(code, ename, vname, a, ctrl, floor):
    r = {"variant": vname}
    r["null_exact"] = a["null_exact"]; r["base_audio_changed_s"] = a["base_audio_changed_s"]; r["changed_ranges_s"] = a["base_changed_ranges_out_s"]
    r["rest_melody_F1_fold"] = a["rest_melody_vs_base"]["fold"]
    cv = span_value(ename, ctrl); vv = span_value(ename, a)
    if ename == "lyrics":
        old, new = lines_of(code)
        h = ASR.get(f"{code}_lyrics_{vname}", {}).get("text"); hc = ASR.get(f"{code}_ctrl", {}).get("text")
        vv = wer(new, h) if h is not None else None; cv = wer(new, hc) if hc is not None else None
        r["wer_vs_old"] = wer(old, h) if h is not None else None
        r["span_ok"] = None if vv is None or cv is None else vv <= cv + 0.05
        r["span"] = {"metric": "WER vs the new lines (lower is better)", "variant": vv, "control": cv}
    else:
        r["span"] = {"metric": {"reharm": "chord roots on edited bars vs new score", "phrase": "Ins phrase F1 (octave-folded) vs written notes",
                                "repeat": "copy vs first chorus melody F1", "cut": "chord roots, 8 bars after the seam"}[ename], "variant": vv, "control": cv}
        r["span_ok"] = None if vv is None or cv is None else vv >= cv - 0.05
    r["seams"] = []
    for k, s in enumerate(a["seams"]):
        lag = s["phase_err_ms"]; c = s["phase_corr"]
        sn = (SNAP.get((code, ename, vname.split("_")[0])) or [])
        snk = sn[k] if k < len(sn) else {}
        resolved = c >= 0.25 and abs(lag) < 140
        state = "unresolved" if not resolved else ("ok" if abs(lag) <= 20 else "fail")
        r["seams"].append({"at_s": s["out_s"], "lag_ms": lag, "corr": c, "state": state, "raw_misalign_ms": snk.get("delta_ms"), "raw_corr": snk.get("corr"), "snap_applied": snk.get("applied"),
                           "lag_ok_20ms": state != "fail", "lag_within_floor": abs(lag) <= max(20, floor["p95"]),
                           "lufs_step": s["lufs_step"], "lufs_excess": s.get("lufs_step_excess"), "centroid_excess_hz": s.get("centroid_step_excess"),
                           "lufs_ok_literal": abs(s["lufs_step"]) <= 1.0,
                           "lufs_ok_excess": (abs(s["lufs_step_excess"]) <= 1.0) if s.get("lufs_step_excess") is not None else (abs(s["lufs_step"]) <= 1.0)})
    hp = f"{HERE}/results/healpost_{code}_{ename}_{vname}.json"
    if "_" in vname and os.path.exists(hp):
        h = json.load(open(hp))
        r["heal_post"] = {"acestep_gain_db": h["gain_db"], "samples_different_outside_windows": h["samples_different_outside"],
                          "of_which_not_clipped_samples": h["of_which_not_where_src_exceeds_full_scale"], "window_lufs_delta_db": [w["lufs_delta"] for w in h["windows"]],
                          "repaint_seconds": sum(w["window_s"][1] - w["window_s"][0] for w in h["windows"])}
    r["extra_seconds"] = a["splice_seconds"] + (a.get("heal", {}).get("seconds_total", 0.0))
    if "gain_db" in a: r["gain_db"] = a["gain_db"]
    return r


def main():
    out = {"songs": {}, "tally": {}}
    tally = {}
    for code in SONGS:
        p = f"{HERE}/results/measure_{code}.json"
        if not os.path.exists(p):
            continue
        m = json.load(open(p)); floor = m["context"]["base_abs_phase_err_ms_bar_lines"]
        song = {"context": m["context"], "edits": {}}
        for ename, e in m["edits"].items():
            ctrl = e["control"]
            ent = {"label": e["label"], "kind": e["kind"], "span_bars_0based": e["span"],
                   "control": {"rest_melody_F1_fold": ctrl["rest_melody_vs_base"]["fold"], "span": span_value(ename, ctrl), "root_unedited": ctrl["root_unedited"]},
                   "variants": {}}
            for vn, a in e["variants"].items():
                r = row_of(code, ename, vn, a, ctrl, floor)
                ent["variants"][vn] = r
                seam_ok = all(s["lag_ok_20ms"] for s in r["seams"]); lufs_lit = all(s["lufs_ok_literal"] for s in r["seams"]); lufs_ex = all(s["lufs_ok_excess"] for s in r["seams"])
                healed = "_" in vn
                null_ok = r["null_exact"] if not healed else (r.get("heal_post", {}).get("of_which_not_clipped_samples", 1) == 0)
                r["pass_machine_literal"] = bool(null_ok and r["span_ok"] is not False and seam_ok and lufs_lit)
                r["pass_machine_excess"] = bool(null_ok and r["span_ok"] is not False and seam_ok and lufs_ex)
                r["pass_machine_floor"] = bool(null_ok and r["span_ok"] is not False and all(s["lag_within_floor"] for s in r["seams"]) and lufs_ex)
                for k in ("literal", "excess", "floor"):
                    t = tally.setdefault((ename, vn), {"literal": [], "excess": [], "floor": []})
                    t[k].append(r[f"pass_machine_{k}"])
            song["edits"][ename] = ent
        out["songs"][code] = song
    out["tally"] = {f"{e}/{v}": {k: f"{sum(x)}/{len(x)}" for k, x in t.items()} for (e, v), t in sorted(tally.items())}
    json.dump(out, open(f"{HERE}/results.json", "w"), indent=1, default=float)
    # printed tables
    for code, song in out["songs"].items():
        print(f"\n=== song {code} · floor |lag| median/p95 {song['context']['base_abs_phase_err_ms_bar_lines']['median']:.0f}/{song['context']['base_abs_phase_err_ms_bar_lines']['p95']:.0f} ms")
        for ename, e in song["edits"].items():
            c = e["control"]
            print(f"  {ename:7s} control: rest F1 {c['rest_melody_F1_fold']:.3f} span {c['span'] if c['span'] is None else round(c['span'], 3)}")
            for vn, r in e["variants"].items():
                sp = r["span"]
                fm = lambda x: "n/a" if x is None else f"{x:.3f}"
                print(f"    {vn:8s} null {str(r['null_exact'])[0]} changed {r['base_audio_changed_s']:.2f}s rest F1 {r['rest_melody_F1_fold']:.3f} span {fm(sp['variant'])} (ctl {fm(sp['control'])}) ok={r['span_ok']} | seams "
                      + " ; ".join(f"lag {s['lag_ms']:+.0f}ms c{s['corr']:.2f} {s['state'][:3]} raw {('%+.0f' % s['raw_misalign_ms']) if s['raw_misalign_ms'] is not None else '--'} lufs {s['lufs_step']:+.1f} (ex {('%+.1f' % s['lufs_excess']) if s['lufs_excess'] is not None else '--'})" for s in r["seams"])
                      + f" | pass lit/ex/floor {int(r['pass_machine_literal'])}/{int(r['pass_machine_excess'])}/{int(r['pass_machine_floor'])}")
    print("\nTALLY (songs passing the machine half, of those measured)")
    for k, v in out["tally"].items():
        print(" ", k, v)


if __name__ == "__main__":
    main()
