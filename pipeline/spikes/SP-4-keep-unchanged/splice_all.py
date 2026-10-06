"""SP-4 candidates A (bar-aligned splice of the new render into the base) and C (REPEAT / CUT on the base audio alone).
Run in WSL: ~/sheetsage2/.venv/bin/python splice_all.py [song ...]
Writes TMP/out/<song>_<edit>_<variant>.wav (float32, git-ignored, on E:) and results/splice.json.
Variants: A1 / A2 = local edits with a 1-beat / 1-bar crossfade centred on each seam; C1 / C2 = REPEAT or CUT on the base audio.
Cut points are the SheetSage2 downbeats of each render (offset fitted on unedited bars, SP-3), then snapped by up to half a beat
so the two renders' beat grids are continuous across the join (beat-phase of the low-band onset envelope)."""
import json, os, sys, time
import numpy as np
from sp4lib import *

SPANS = json.load(open(f"{SPIKE}/spans.json"))
OUT = f"{TMP}/out"; os.makedirs(OUT, exist_ok=True); os.makedirs(f"{SPIKE}/results", exist_ok=True)
CORR_MIN = 0.15         # pattern correlation below this: no snap
SNAP_CAP = 0.08         # never move a cut by more than 80 ms


def snap(prev_a, prev_t1, next_a, next_t0, p, mode):
    """groove-continuity shift in seconds for the adjustable end (mode 'next' moves next_t0, 'prev' moves prev_t1), from the lag between the
    onset pattern of the 8 beats before the join (prev) and the 8 beats after it (next)."""
    W = 8 * p
    x1 = prev_a[int((prev_t1 - W) * SR):int(prev_t1 * SR)]; x2 = next_a[int(next_t0 * SR):int((next_t0 + W) * SR)]
    n = min(len(x1), len(x2))
    lag, c = pattern_lag(x1[-n:], x2[:n])      # + = the next pattern sits later than the previous one carries on
    d = lag / 1000.0 if mode == "next" else -lag / 1000.0
    ok = c >= CORR_MIN and abs(d) <= SNAP_CAP
    return (d if ok else 0.0), {"delta_ms": d * 1000, "applied": bool(ok), "corr": c}


def null_test(out, base, mp, h, parts_src):
    """every sample of a base part, away from the crossfade windows, equals the base sample it came from"""
    res = {"base_parts": []}
    bad = 0; checked = 0
    for (o0, o1, k, s0), src in zip(mp, parts_src):
        if src != "base":
            continue
        lo = o0 + (h if k > 0 else 0); hi = o1 - (h if k < len(mp) - 1 else 0)
        if hi <= lo:
            continue
        a = out[int(round(lo * SR)):int(round(hi * SR))]
        b = base[int(round((s0 + lo - o0) * SR)):int(round((s0 + hi - o0) * SR))]
        n = min(len(a), len(b))
        d = float(np.max(np.abs(a[:n] - b[:n]))) if n else 0.0
        bad += int(np.sum(np.abs(a[:n] - b[:n]) > 0)); checked += n
        res["base_parts"].append({"out_s": [lo, hi], "base_s": [s0 + lo - o0, s0 + hi - o0], "max_abs_diff": d})
    res["samples_checked"] = checked; res["samples_different"] = bad; res["identical"] = bad == 0
    return res


def seam_report(out, base, joins, p, h, base_pts):
    rows = []
    for k, t in enumerate(joins):
        err, sb, sa = seam_phase_error(out, t, p)
        st = step_stats(out, t)
        row = {"join": k, "out_s": t, "phase_err_ms": err, "phase_corr": sb, **st}
        if base_pts and k < len(base_pts) and base_pts[k] is not None:
            row["base_phase_err_ms"] = seam_phase_error(base, base_pts[k], p)[0]
            row["phase_err_excess_ms"] = row["phase_err_ms"] - row["base_phase_err_ms"]
            bs = step_stats(base, base_pts[k])
            row["base_lufs_step"] = bs["lufs_step"]; row["base_centroid_step"] = bs["centroid_step"]
            row["lufs_step_excess"] = st["lufs_step"] - bs["lufs_step"]
            row["centroid_step_excess"] = st["centroid_step"] - bs["centroid_step"]
        rows.append(row)
    return rows


def run(code):
    sp = SPANS[code]
    base = load(LIB + sp["vid"] + ".wav")
    g_base = Grid(sp["base_ss"], sp["base_score"])
    p_base = 60.0 / sp["bpm"]          # nominal quarter note: YuE2 keeps the bar tempo within 0.1% of Q (SP-3)
    bar_s = 4 * p_base
    # the base's own loudness-step distribution at bar lines (context for a seam's step)
    steps = [abs(step_stats(base, g_base.t(i))["lufs_step"]) for i in range(8, g_base.n - 4, 2)]
    nf = {}
    errs = [abs(seam_phase_error(base, g_base.t(i), p_base)[0]) for i in range(8, g_base.n - 8, 2)]
    nf = {"median": float(np.median(errs)), "p95": float(np.percentile(errs, 95)), "max": float(np.max(errs))}
    ctx = {"base_abs_phase_err_ms_bar_lines": nf, "base_abs_lufs_step_bar_lines": {"median": float(np.median(steps)), "p95": float(np.percentile(steps, 95))}, "beat_s": p_base, "bar_s": bar_s,
           "base_grid_offset": g_base.o, "base_root_agree": g_base.root, "base_thinned": g_base.thinned}
    res = {"song": code, "context": ctx, "variants": {}}
    for ename, ed in sp["edits"].items():
        kind = ed["kind"]; s, e = ed["span"]; n = e - s
        # ---------- candidate A (local) needs the new render and its grid; repeat/cut: C needs only the base
        variants = {"local": ("A1", "A2", "A3"), "repeat": ("C1", "C2"), "cut": ("C1", "C2")}[kind]
        if kind == "local":
            apath = [f"{REN}/{ed['render']}/audio.flac"]
            new = load(apath[0])
            nsc = A.Sc(ed["score"]); N = len(nsc.bars)
            g_pre = Grid(ed["render"], ed["score"], fit_idx=list(range(0, s)))
            g_post = Grid(ed["render"], ed["score"], fit_idx=list(range(e, N)))
        for v in variants:
            t0 = time.time()
            w = bar_s if v.endswith("2") else p_base
            h = w / 2
            info = {"edit": ename, "variant": v, "crossfade_s": w, "span_bars_0based": [s, e]}
            if kind == "local":
                tb_s, tb_e = g_base.t(s), g_base.t(e)
                tn_s, tn_e = g_pre.t(s), g_post.t(e)
                info.update({"base_span_s": [tb_s, tb_e], "new_span_s": [tn_s, tn_e], "offsets": {"base": g_base.o, "new_pre": g_pre.o, "new_post": g_post.o},
                             "root_agree_unedited": {"pre": g_pre.root, "post": g_post.root}, "span_len_diff_ms": ((tn_e - tn_s) - (tb_e - tb_s)) * 1000})
                d1, s1 = snap(base, tb_s, new, tn_s, p_base, "next")
                d2, s2 = snap(new, tn_e, base, tb_e, p_base, "prev")
                tn_s2, tn_e2 = tn_s + d1, tn_e + d2
                newv = new
                if v == "A3":   # level-match the new take to the base at both ends of the span: linear-in-dB gain ramp over the span
                    L = 3.0
                    g_in = lufs(base[int(tb_s * SR):int((tb_s + L) * SR)]) - lufs(new[int(tn_s2 * SR):int((tn_s2 + L) * SR)])
                    g_out = lufs(base[int((tb_e - L) * SR):int(tb_e * SR)]) - lufs(new[int((tn_e2 - L) * SR):int(tn_e2 * SR)])
                    tt = np.arange(len(new)) / SR
                    gdb = np.interp(tt, [tn_s2, tn_e2], [g_in, g_out])
                    newv = (new * (10 ** (gdb / 20))[:, None]).astype(np.float32)
                    info["gain_db"] = {"in": g_in, "out": g_out}
                parts = [(base, 0.0, tb_s), (newv, tn_s2, tn_e2), (base, tb_e, len(base) / SR)]
                src = ["base", "new", "base"]
                base_pts = [tb_s, tb_e]
                info["snap"] = [s1, s2]
            elif kind == "repeat":
                tb_s, tb_e = g_base.t(s), g_base.t(e)
                d1, s1 = snap(base, tb_e, base, tb_s, p_base, "next")      # end of the chorus -> start of the copy (the only real seam)
                s2 = {"delta_ms": 0.0, "applied": False, "note": "the copy ends where the chorus ended, so the audio after it is what followed anyway"}
                parts = [(base, 0.0, tb_e), (base, tb_s + d1, tb_e), (base, tb_e, len(base) / SR)]
                src = ["base", "copy", "base"]
                base_pts = [None, None]
                info.update({"base_span_s": [tb_s, tb_e], "snap": [s1, s2]})
            else:  # cut
                tb_s, tb_e = g_base.t(s), g_base.t(e)
                d1, s1 = snap(base, tb_s, base, tb_e, p_base, "next")
                parts = [(base, 0.0, tb_s), (base, tb_e + d1, len(base) / SR)]
                src = ["base", "base"]
                base_pts = [None]
                info.update({"base_span_s": [tb_s, tb_e], "snap": [s1]})
            out, joins, mp = assemble(parts, w)
            info["join_out_s"] = joins; info["splice_seconds"] = time.time() - t0
            info["out_seconds"] = len(out) / SR; info["base_seconds"] = len(base) / SR
            path = f"{OUT}/{code}_{ename}_{v}.wav"
            save_wav(path, out)
            info["path"] = path; info["map"] = mp; info["src"] = src; info["base_pts"] = base_pts; info["half_xfade_s"] = h
            chk = load(path)  # the saved file, not the in-memory array
            info["null_test"] = null_test(chk, base, mp, h + 1.0 / SR, src)
            if kind == "local":
                info["edit_out_s"] = [mp[1][0], mp[1][1]]
            elif kind == "repeat":
                info["edit_out_s"] = [mp[1][0], mp[1][1]]
            info["seams"] = seam_report(chk, base, joins, p_base, h, base_pts)
            res["variants"][f"{ename}_{v}"] = info
            print(code, ename, v, "joins", [round(j, 2) for j in joins], "phase_err_ms", [round(r["phase_err_ms"], 1) for r in info["seams"]],
                  "lufs_step", [round(r["lufs_step"], 2) for r in info["seams"]], "null", info["null_test"]["identical"], flush=True)
    json.dump(res, open(f"{SPIKE}/results/splice_{code}.json", "w"), indent=1, default=float)
    return res


if __name__ == "__main__":
    for c in (sys.argv[1:] or ["A", "B", "C", "D"]):
        run(c)
