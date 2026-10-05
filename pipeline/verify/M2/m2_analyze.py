"""M2/CP3 audio checks (verifier); run in WSL: ~/sheetsage2/.venv/bin/python m2_analyze.py. Reuses SP-3's analyze.py.
transpose: pitch-class histogram shift (base -> new render) and Krumhansl key estimate of both; chord roots vs the new score.
repeat: audio bars vs score bars, tempo, copy-vs-first-chorus melody F1 (SP-3 method, nominal time), chance = first chorus vs other windows.
rewrite: bar count / tempo only (the words are checked by ASR, raw/heard-words.txt)."""
import json, os, re, subprocess, sys
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "spikes", "SP-3-cot-full-adherence"))
import analyze as A  # noqa
A.SS = os.path.expanduser("~/m2/ss")
SS_DIR = os.path.expanduser("~/sheetsage2/SheetSage2"); SS_PY = os.path.expanduser("~/sheetsage2/.venv/bin/python")


def wsl(p):
    p = p.replace("\\", "/")
    return f"/mnt/{p[0].lower()}{p[2:]}" if re.match(r"^[A-Za-z]:", p) else p


def transcribe(audio, name):
    out = os.path.join(A.SS, name)
    if not os.path.exists(os.path.join(out, "result.json")):
        os.makedirs(out, exist_ok=True)
        r = subprocess.run([SS_PY, "infer.py", audio, "--output", out, "--local-files-only"], cwd=SS_DIR, capture_output=True, text=True)
        if r.returncode:
            raise RuntimeError((r.stdout + r.stderr)[-600:])
    return A.Tr(name)


KS_MAJ = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
KS_MIN = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]


def key_of(h):
    best = None
    for k in range(12):
        for nm, prof in (("major", KS_MAJ), ("minor", KS_MIN)):
            c = np.corrcoef(h, np.roll(prof, k))[0, 1]
            if best is None or c > best[0]:
                best = (float(c), f"{NAMES[k]} {nm}")
    return best


def pc_hist(tr):
    h = np.zeros(12)
    for part in ("vocal", "instrumental"):
        iv, pt = tr.notes[part]
        for (s, e), p in zip(iv, pt):
            h[p % 12] += e - s
    return h / h.sum()


def chord_root_hist(tr):
    h = np.zeros(12)
    for a, b, lab in tr.chords:
        p = A.parse_label(lab)
        if p:
            h[p[0]] += b - a
    return h / h.sum()


def thin_if_double(tr, sc, idx):
    """SheetSage2 sometimes tracks half bars (downbeats every 2 beats, bpm_from_bars about 2x Q) on a 4/4 score: keep every second
    downbeat, from the phase that agrees best with the score's chords; returns the note for the report."""
    b = tr.bpm_from_bars()
    if b and b / sc.bpm > 1.7:
        full = list(tr.down)
        best = None
        for k in (0, 1):
            tr.down = full[k::2]
            o = A.best_offset(sc, tr, idx)
            r = A.agree(sc.chords, tr.bar_chords(), o, idx)[0]
            if best is None or r > best[0]:
                best = (r, k)
        tr.down = full[best[1]::2]
        return {"thinned": True, "from": len(full), "phase": best[1], "chord_root_at_best": best[0]}
    return {"thinned": False}


res = []
for s in json.load(open(os.path.join(HERE, "raw", "spec.json"))):
    tr = transcribe(wsl(s["newAudio"]), s["tag"] + "_new")
    trb = transcribe(wsl(s["baseAudio"]), s["tag"] + "_base")
    sc = A.Sc(wsl(s["newAbc"]))
    old = A.Sc(wsl(s["baseAbc"]))
    row = {"tag": s["tag"], "kind": s["kind"], "Q_new": sc.bpm, "Q_base": old.bpm, "bpm_from_bars_new": tr.bpm_from_bars(), "bpm_from_bars_base": trb.bpm_from_bars(),
           "score_bars_new": len(sc.bars), "audio_bars_new": len(tr.down), "score_bars_base": len(old.bars), "audio_bars_base": len(trb.down),
           "audio_s_new": tr.dur, "audio_s_base": trb.dur, "nominal_s_new": float(sc.p.voices["Vocal"].time * 60 / sc.bpm),
           "nominal_s_base": float(old.p.voices["Vocal"].time * 60 / old.bpm)}
    row["tempo_err_pct"] = 100 * (row["bpm_from_bars_new"] - sc.bpm) / sc.bpm if row["bpm_from_bars_new"] else None
    allb = list(range(len(sc.bars)))
    row["downbeat_thinning_new"] = thin_if_double(tr, sc, allb)
    row["downbeat_thinning_base"] = thin_if_double(trb, old, list(range(len(old.bars))))
    row["audio_bars_after_thinning_new"] = len(tr.down)
    row["audio_bars_after_thinning_base"] = len(trb.down)
    row["bars_by_duration_new"] = tr.dur / (sc.p.voices["Vocal"].time / len(sc.bars) * 60 / sc.bpm)
    row["bars_by_duration_base"] = trb.dur / (old.p.voices["Vocal"].time / len(old.bars) * 60 / old.bpm)
    row["bpm_from_bars_new"] = tr.bpm_from_bars()
    row["tempo_err_pct"] = 100 * (row["bpm_from_bars_new"] - sc.bpm) / sc.bpm if row["bpm_from_bars_new"] else None
    o = A.best_offset(sc, tr, allb)
    row["offset"] = o
    row["chord_root_vs_new_score"] = A.agree(sc.chords, tr.bar_chords(), o, allb)[0]
    ob = A.best_offset(old, trb, list(range(len(old.bars))))
    row["chord_root_base_vs_old_score"] = A.agree(old.chords, trb.bar_chords(), ob, list(range(len(old.bars))))[0]
    if s["kind"] == "transpose":
        hn, hb = pc_hist(tr), pc_hist(trb)
        corr = [float(np.corrcoef(np.roll(hb, k), hn)[0, 1]) for k in range(12)]
        row["melody_pc_shift_best_semitones"] = int(np.argmax(corr))
        row["melody_pc_shift_corr"] = corr
        cn, cb = chord_root_hist(tr), chord_root_hist(trb)
        corr2 = [float(np.corrcoef(np.roll(cb, k), cn)[0, 1]) for k in range(12)]
        row["chord_root_shift_best_semitones"] = int(np.argmax(corr2))
        row["chord_root_shift_corr"] = corr2
        row["key_estimate_new_render"] = key_of(hn)
        row["key_estimate_base_render"] = key_of(hb)
        row["key_estimate_new_render_chords"] = key_of(cn)
        row["key_estimate_base_render_chords"] = key_of(cb)
    if s["kind"] == "repeat":
        a, b = s["section_bars_base"]
        a0, b0 = a - 1, b
        n = b0 - a0
        bpm = sc.bpm
        est = A.to_nominal(tr, o, A.tr_notes(tr), sc, bpm)

        def t(i):
            return sc.bars[i][0] * 60 / bpm

        first = A.window(est, t(a0), t(b0))
        copy = A.window(est, t(b0), t(b0 + n))
        first_shift = (first[0] + (t(b0) - t(a0)), first[1])
        row["repeat_first_window_bars"] = [a0 + 1, b0]
        row["repeat_copy_window_bars"] = [b0 + 1, b0 + n]
        row["copy_vs_first"] = A.both(first_shift, copy)
        ch = []
        for st in range(0, len(sc.bars) - n):
            if abs(st - b0) < n or abs(st - a0) < n:
                continue
            w = A.window(est, t(st), t(st + n))
            sh = (w[0] + (t(b0) - t(st)), w[1])
            ch.append(A.f1(first_shift, sh, fold=True)[2])
        row["chance_fold_F1_mean"] = float(np.mean(ch))
        row["chance_fold_F1_p95"] = float(np.percentile(ch, 95))
        ab = tr.bar_chords()
        row["copy_chord_root_vs_score"] = A.agree(sc.chords, ab, o, list(range(b0, b0 + n)))[0]
        row["first_chord_root_vs_score"] = A.agree(sc.chords, ab, o, list(range(a0, b0)))[0]
    res.append(row)
    print(json.dumps(row, default=float), flush=True)
json.dump(res, open(os.path.join(HERE, "analysis.json"), "w"), indent=1, default=float)
