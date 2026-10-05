"""M1/CP2 audio checks (verifier); run in WSL: ~/sheetsage2/.venv/bin/python m1_analyze.py. Reuses SP-3's analyze.py (as M0).
Per song: tempo from the median bar length vs Q:; chord change base->new on edited (REHARMONIZE) vs unedited bars;
phrase bars: Ins notes intended (new score) vs SheetSage2's transcribed instrumental+vocal notes in that audio window, new render vs base render."""
import json, os, re, subprocess, sys
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "spikes", "SP-3-cot-full-adherence"))
import analyze as A  # noqa
A.SS = os.path.expanduser("~/m1/ss")
SS_DIR = os.path.expanduser("~/sheetsage2/SheetSage2"); SS_PY = os.path.expanduser("~/sheetsage2/.venv/bin/python")
def wsl(p):
    p = p.replace("\\", "/"); return f"/mnt/{p[0].lower()}{p[2:]}" if re.match(r"^[A-Za-z]:", p) else p
def transcribe(audio, name):
    out = os.path.join(A.SS, name)
    if not os.path.exists(os.path.join(out, "result.json")):
        os.makedirs(out, exist_ok=True)
        r = subprocess.run([SS_PY, "infer.py", audio, "--output", out, "--local-files-only"], cwd=SS_DIR, capture_output=True, text=True)
        if r.returncode: raise RuntimeError((r.stdout + r.stderr)[-600:])
    return A.Tr(name)
res = []
for s in json.load(open(os.path.join(HERE, "raw", "spec.json"))):
    tr = transcribe(wsl(s["newAudio"]), s["tag"] + "_new"); trb = transcribe(wsl(s["baseAudio"]), s["tag"] + "_base")
    sc = A.Sc(wsl(s["newAbc"])); old = A.Sc(wsl(s["baseAbc"]))
    E = sorted({b - 1 for op in s["ops"] if op["op"] == "REHARMONIZE" for b in range(op["from_bar"], op["to_bar"] + 1)})
    P = sorted({op["start_bar"] - 1 + i for op in s["ops"] if op["op"] == "WRITE_PHRASE" for i in range(len(op["bars"]))})
    U = [i for i in range(len(sc.bars)) if i not in set(E) and i not in set(P)]
    o = A.best_offset(sc, tr, U); po = A.best_offset(old, trb, U)
    ab, pb = tr.bar_chords(), trb.bar_chords()
    bpm = tr.bpm_from_bars()
    row = {"tag": s["tag"], "Q": sc.bpm, "base_Q": old.bpm, "bpm_from_bars": bpm, "tempo_err_pct": 100 * (bpm - sc.bpm) / sc.bpm if bpm else None,
           "base_bpm_from_bars": trb.bpm_from_bars(), "audio_s": tr.dur, "base_audio_s": trb.dur, "score_bars": len(sc.bars), "audio_bars": len(tr.down),
           "offset": o, "base_offset": po, "E_bars": [i + 1 for i in E], "P_bars": [i + 1 for i in P]}
    row["audio_label_changed_edited"] = sum(1 for i in E if pb[i + po] != ab[i + o]) / len(E)
    row["audio_label_changed_unedited"] = sum(1 for i in U if 0 <= i + o < len(ab) and 0 <= i + po < len(pb) and pb[i + po] != ab[i + o]) / len(U)
    row["audio_root_changed_edited"] = sum(1 for i in E if (A.parse_label(pb[i + po]) or (None,))[0] != (A.parse_label(ab[i + o]) or (None,))[0]) / len(E)
    row["audio_root_changed_unedited"] = sum(1 for i in U if 0 <= i + o < len(ab) and 0 <= i + po < len(pb) and (A.parse_label(pb[i + po]) or (None,))[0] != (A.parse_label(ab[i + o]) or (None,))[0]) / len(U)
    row["E_root_vs_new"] = A.agree(sc.chords, ab, o, E)[0]; row["E_root_vs_old"] = A.agree(old.chords, ab, o, E)[0]
    row["chance_root_mean"] = A.chance(sc, tr, E, o)[0]
    # phrase window: intended Ins notes (new score) in P bars, mapped to audio time of each render; transcribed notes in the window
    def phrase(trx, off, scx):
        bars = trx.bars(); j0, j1 = P[0] + off, P[-1] + off
        if not (0 <= j0 < len(bars) and j1 < len(bars)): return None
        t0, t1 = bars[j0][0], bars[j1][1]
        iv = np.concatenate([trx.notes[p][0] for p in ("vocal", "instrumental")]); pt = np.concatenate([trx.notes[p][1] for p in ("vocal", "instrumental")])
        inst_iv, inst_pt = trx.notes["instrumental"]
        m = (inst_iv[:, 0] >= t0) & (inst_iv[:, 0] < t1) if len(inst_iv) else np.zeros(0, bool)
        w = (iv[:, 0] >= t0) & (iv[:, 0] < t1) if len(iv) else np.zeros(0, bool)
        ref = A.score_notes_to_audio(scx, trx, off, voices=("Ins",))
        ref = A.window(ref, t0, t1)
        est_all = (iv[w], pt[w]); est_ins = (inst_iv[m], inst_pt[m])
        return {"window_s": [t0, t1], "intended_notes": int(len(ref[1])), "transcribed_instrumental_notes": int(m.sum()), "transcribed_all_notes": int(w.sum()),
                "f1_exact_vs_instrumental": A.f1(ref, est_ins)[2], "f1_fold_vs_instrumental": A.f1(ref, est_ins, fold=True)[2],
                "f1_fold_vs_all": A.f1(ref, est_all, fold=True)[2], "median_pitch_transcribed_ins": float(np.median(inst_pt[m])) if m.any() else None}
    row["phrase_in_new_render"] = phrase(tr, o, sc)
    # same intended phrase scored against the BASE render at the same bars: what chance/other material scores
    row["phrase_intended_vs_base_render"] = phrase(trb, po, sc)
    res.append(row)
    print(json.dumps({k: v for k, v in row.items()}, default=float))
json.dump(res, open(os.path.join(HERE, "analysis.json"), "w"), indent=1, default=float)
