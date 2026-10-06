"""SP-4 machine measures. WSL: ~/sheetsage2/.venv/bin/python measure.py [song ...]
Needs: results/splice_<song>.json (splice_all.py), SheetSage2 transcriptions of every control render and variant in ~/sp4/ss
(transcribe_outs.py), optionally results/asr.json (asr_spans.py) and the healed audio in TMP/heal (heal.py).
Writes results/measure_<song>.json: per edit, the control (full re-render, today) and every variant on the same measures."""
import json, os, re, sys
import numpy as np
from sp4lib import *

SPANS = json.load(open(f"{SPIKE}/spans.json"))
HEAL = f"{TMP}/heal"


def zone_s(sc, lo, hi):  # nominal seconds of score bars [lo, hi)
    return sc.bars[lo][0] * 60 / sc.bpm, (sc.bars[hi - 1][0] + sc.bars[hi - 1][1]) * 60 / sc.bpm


def edit_zone(kind, s, e):
    """bars [lo, hi) of the edit in NEW-score coordinates (None for a cut: no new music)"""
    n = e - s
    return {"local": (s, e), "repeat": (e, e + n), "cut": None}[kind]


def fit_idx(kind, s, e, N):
    n = e - s
    if kind == "local":
        return [i for i in range(N) if not (s <= i < e)]
    if kind == "repeat":
        return [i for i in range(N) if not (e <= i < e + n)]
    return list(range(N))


def prep(code, ename, ss_name, score):
    ed = SPANS[code]["edits"][ename]; s, e = ed["span"]; kind = ed["kind"]
    g = Grid(ss_name, score, fit_idx=None)
    z = edit_zone(kind, s, e)
    idx = fit_idx(kind, s, e, g.n)
    # refit the offset on unedited bars only (an edit must not buy its own alignment)
    ab = g.tr.bar_chords()
    g.o = A.best_offset(g.sc, g.tr, idx)
    g.root = A.agree(g.sc.chords, ab, g.o, idx)[0]
    return g, kind, s, e, z, idx


def base_notes_in_new(kind, s, e, sc_base, g_base, sc_new):
    """base notes in the new score's nominal time (removing a cut span, shifting what follows a repeat/cut)"""
    est = A.to_nominal(g_base.tr, g_base.o, A.tr_notes(g_base.tr), sc_base, sc_base.bpm)
    lo, hi = zone_s(sc_base, s, e)
    iv, pt = est
    if kind == "repeat":
        sh = hi - lo
        iv = iv.copy(); m = iv[:, 0] >= hi; iv[m] += sh
    elif kind == "cut":
        sh = hi - lo
        keep = ~((iv[:, 0] >= lo) & (iv[:, 0] < hi)); iv = iv[keep].copy(); pt = pt[keep]
        iv[iv[:, 0] >= hi] -= sh
    return iv, pt


def bars_out_for(v, kind, s, e, gb, gc, N):
    """start time (s) of every score bar of the edited score inside the spliced file, from how it was assembled (not from a tracker);
    N+1 entries, the last is the file end. v = a splice_all variant record, gb = base grid, gc = grid of the full re-render (the new music)."""
    mp = v["map"]; n = e - s; out = []
    P = lambda k: (mp[k][0], mp[k][3])             # out start, source start of part k
    if kind == "local":
        (o1, s1), (o2, s2), (o3, s3) = P(0), P(1), P(2)
        for i in range(N):
            out.append(gb.t(i) if i < s else (o2 + gc.t(i) - s2 if i < e else o3 + gb.t(i) - s3))
    elif kind == "repeat":
        (o1, s1), (o2, s2), (o3, s3) = P(0), P(1), P(2)
        for i in range(N):
            out.append(gb.t(i) if i < e else (o2 + gb.t(s + i - e) - s2 if i < e + n else o3 + gb.t(i - n) - s3))
    else:
        (o1, s1), (o2, s2) = P(0), P(1)
        for i in range(N):
            out.append(gb.t(i) if i < s else o2 + gb.t(i + n) - s2)
    out.append(v["out_seconds"])
    return out


def analyse(code, ename, ss_name, score, gb, sc_base, base_dur, bars_out=None):
    """one audio (control or variant) against its edited score and the base.
    bars_out: the known bar starts of a spliced file; when given they replace the tracker's downbeats (the chords and notes still come from the
    transcription), so a spurious downbeat from a repaint cannot shift the comparison."""
    g, kind, s, e, z, idx = prep(code, ename, ss_name, score)
    if bars_out is not None:
        g.tr.down = list(bars_out[:-1]); g.tr.dur = bars_out[-1]; g.o = 0
        g.root = A.agree(g.sc.chords, g.tr.bar_chords(), 0, idx)[0]
    tr, sc, o = g.tr, g.sc, g.o
    ab = tr.bar_chords()
    r = {"audio_bars": len(tr.down), "score_bars": g.n, "offset": o, "root_unedited": g.root, "bpm_from_bars": tr.bpm_from_bars(), "Q": sc.bpm, "dur_s": tr.dur}
    # the rest of the song vs the base (melody in score time, outside the edit zone)
    est_v = A.to_nominal(tr, o, A.tr_notes(tr), sc, sc.bpm)
    est_b = base_notes_in_new(kind, s, e, sc_base, gb, sc)
    if z:
        lo, hi = zone_s(sc, *z)
        r["rest_melody_vs_base"] = A.both(A.window(est_b, lo, hi, True), A.window(est_v, lo, hi, True))
    else:
        r["rest_melody_vs_base"] = A.both(est_b, est_v)
    # the edit
    if ename == "reharm":
        E = list(range(s, e))
        r["span"] = {"root_new": A.agree(sc.chords, ab, o, E)[0], "root_old": A.agree(sc_base.chords, ab, o, E)[0]}
    elif ename == "phrase":
        bars = tr.bars(); ph0, ph1 = s, e
        if 0 <= ph0 + o < len(bars):
            t0 = bars[ph0 + o][0]; t1 = bars[min(ph1 - 1 + o, len(bars) - 1)][1]
            new_ref = A.window(A.score_notes_to_audio(sc, tr, o, voices=("Ins",)), t0, t1)
            old_ref = A.window(A.score_notes_to_audio(sc_base, tr, o, voices=("Ins",)), t0, t1)
            r["span"] = {}
            for part in ("instrumental", "both"):
                w = A.window(A.tr_notes(tr, ("instrumental",) if part == "instrumental" else ("vocal", "instrumental")), t0, t1)
                r["span"][part] = {"n_est": int(len(w[1])), "F1_new_fold": A.f1(new_ref, w, fold=True)[2], "F1_new": A.f1(new_ref, w)[2], "F1_old_fold": A.f1(old_ref, w, fold=True)[2]}
    elif ename == "repeat":
        n = e - s
        bpm = sc.bpm; t = lambda i: sc.bars[i][0] * 60 / bpm
        first = A.window(est_v, t(s), t(e)); copy = A.window(est_v, t(e), t(e + n))
        first_shift = (first[0] + (t(e) - t(s)), first[1])
        r["span"] = {"copy_vs_first": A.both(first_shift, copy), "copy_root": A.agree(sc.chords, ab, o, list(range(e, e + n)))[0], "first_root": A.agree(sc.chords, ab, o, list(range(s, e)))[0]}
    elif ename == "cut":
        W = list(range(s, min(s + 8, g.n)))
        r["span"] = {"root_8_bars_after_seam": A.agree(sc.chords, ab, o, W)[0], "bars_expected": g.n, "bars_audio": len(tr.down)}
    return r


def wer(ref_lines, hyp):
    norm = lambda t: re.sub(r"[^\w\s]", " ", t.lower().replace("¿", " ").replace("¡", " ")).split()
    r = norm(" ".join(ref_lines)); h = norm(hyp)
    d = np.zeros((len(r) + 1, len(h) + 1), dtype=int); d[:, 0] = range(len(r) + 1); d[0, :] = range(len(h) + 1)
    for i in range(1, len(r) + 1):
        for j in range(1, len(h) + 1):
            d[i, j] = min(d[i - 1, j] + 1, d[i, j - 1] + 1, d[i - 1, j - 1] + (r[i - 1] != h[j - 1]))
    return float(d[-1, -1] / max(len(r), 1))


def main(codes):
    asr = json.load(open(f"{SPIKE}/results/asr.json", encoding="utf-8")) if os.path.exists(f"{SPIKE}/results/asr.json") else {}
    for code in codes:
        sp = SPANS[code]; sj = json.load(open(f"{SPIKE}/results/splice_{code}.json"))
        sc_base = A.Sc(sp["base_score"]); gb = Grid(sp["base_ss"], sp["base_score"])
        base = load(LIB + sp["vid"] + ".wav")
        res = {"song": code, "context": sj["context"], "edits": {}}
        for ename, ed in sp["edits"].items():
            gc = prep(code, ename, ed["render"], ed["score"])[0]
            Nn = len(A.Sc(ed["score"]).bars)
            row = {"label": ed["label"], "kind": ed["kind"], "span": ed["span"], "control": analyse(code, ename, ed["render"], ed["score"], gb, sc_base, len(base) / SR), "variants": {}}
            for key, v in sj["variants"].items():
                if v["edit"] != ename:
                    continue
                stems = {v["variant"]: v["path"]}
                for hp in sorted(os.listdir(HEAL)) if os.path.isdir(HEAL) else []:
                    if hp.startswith(f"{code}_{ename}_{v['variant']}_") and hp.endswith(".wav") and ".w0." not in hp:
                        stems[hp[len(f"{code}_{ename}_"):-4]] = f"{HEAL}/{hp}"
                for vname, path in stems.items():
                    stem = f"{code}_{ename}_{vname}"
                    if not os.path.exists(f"{SS}/{stem}/result.json"):
                        continue
                    a = analyse(code, ename, stem, ed["score"], gb, sc_base, len(base) / SR, bars_out=bars_out_for(v, ed["kind"], ed["span"][0], ed["span"][1], gb, gc, Nn))
                    out = load(path)
                    a["path"] = path; a["joins"] = v["join_out_s"]
                    # how much of the base-derived audio was changed (A: the crossfades; B: + the repaint windows)
                    ch = 0; maxd = 0.0; ext = []
                    for (o0, o1, k, s0), srcn in zip(v["map"], v["src"]):
                        if srcn != "base":
                            continue
                        x = out[int(round(o0 * SR)):int(round(o1 * SR))]; y = base[int(round(s0 * SR)):int(round(s0 * SR)) + len(x)]
                        n = min(len(x), len(y)); dif = np.abs(x[:n] - y[:n]).max(axis=1) > 1e-4
                        ch += int(dif.sum()); maxd = max(maxd, float(np.abs(x[:n] - y[:n]).max()) if n else 0.0)
                        if dif.any():
                            idxs = np.flatnonzero(dif); ext.append([round(o0 + idxs[0] / SR, 2), round(o0 + idxs[-1] / SR, 2)])
                    a["base_audio_changed_s"] = ch / SR; a["base_changed_ranges_out_s"] = ext
                    a["null_exact"] = v["null_test"]["identical"]
                    a["seams"] = seam_rows(out, base, v, sj["context"], "_" in vname)
                    a["splice_seconds"] = v["splice_seconds"]
                    if "gain_db" in v:
                        a["gain_db"] = v["gain_db"]
                    hp = f"{SPIKE}/results/heal_{stem}.json"
                    if os.path.exists(hp):
                        a["heal"] = json.load(open(hp))
                    # whisper on the span (REWRITE LYRICS)
                    if ename == "lyrics":
                        k = f"{stem}"
                        if k in asr:
                            a["words_heard"] = asr[k]["text"]
                    row["variants"][vname] = a
            res["edits"][ename] = row
            print(code, ename, "control root_unedited", round(row["control"]["root_unedited"], 2), "variants", list(row["variants"]), flush=True)
        json.dump(res, open(f"{SPIKE}/results/measure_{code}.json", "w"), indent=1, default=float)


def seam_rows(out, base, v, ctx, healed):
    from splice_all import seam_report
    h = max(v["half_xfade_s"], 1.5 if healed else 0.0)
    return seam_report(out, base, v["join_out_s"], ctx["beat_s"], h, v.get("base_pts"))


if __name__ == "__main__":
    main(sys.argv[1:] or ["A", "B", "C", "D"])
