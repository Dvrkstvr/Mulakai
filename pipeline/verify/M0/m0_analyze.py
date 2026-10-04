"""M0 W5 audible checks (run in WSL with ~/sheetsage2/.venv/bin/python), CP1's method (cp1_analyze.py / SP-3 analyze.py).
Input: raw/spec.json (written by make_spec.py from the throwaway DB: per score version, its audio, its .abc, its base's audio
and .abc, the edited bars). Output: raw/analysis.json. Audio and chord labels stay under raw/ (gitignored).
Per version: tempo from the median bar length vs Q:, root + chord-tone agreement on the edited bars next to chance, and
the share of bars whose transcribed chord moved from the base render's, edited vs unedited bars (CP1's Q-034 measure)."""
import json, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "spikes", "SP-3-cot-full-adherence"))
import analyze as A  # noqa: E402

A.SS = os.path.expanduser("~/m0/ss")
SS_DIR = os.path.expanduser("~/sheetsage2/SheetSage2")
SS_PY = os.path.expanduser("~/sheetsage2/.venv/bin/python")


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


def main():
    spec = json.load(open(os.path.join(HERE, "raw", "spec.json"), encoding="utf-8"))
    out = []
    for r in spec:
        tr = transcribe(wsl(r["audio"]), r["name"])
        base_tr = transcribe(wsl(r["baseAudio"]), r["baseName"])
        sc, old = A.Sc(wsl(r["abc"])), A.Sc(wsl(r["baseAbc"]))
        E = sorted({i for a, b in r["edited"] for i in range(a - 1, b)})
        U = [i for i in range(len(sc.bars)) if i not in set(E)]
        o = A.best_offset(sc, tr, U)
        ab, bb = tr.bar_chords(), base_tr.bar_chords()
        bpm = tr.bpm_from_bars()
        row = {"name": r["name"], "Q": sc.bpm, "bpm_from_bars": bpm, "tempo_err_pct": 100 * (bpm - sc.bpm) / sc.bpm if bpm else None,
               "Q_transcribed": tr.q, "audio_s": tr.dur, "base_audio_s": base_tr.dur, "base_Q": old.bpm, "base_bpm_from_bars": base_tr.bpm_from_bars(),
               "score_bars": len(sc.bars), "audio_bars": len(tr.down), "offset": o, "U_root": A.agree(sc.chords, ab, o, U)[0], "U_n": len(U)}
        if E:
            er, erq, en = A.agree(sc.chords, ab, o, E)
            ch = A.chance(sc, tr, E, o)
            changed = [i for i in E if A.root_pc(sc.chords[i])[0] != A.root_pc(old.chords[i])[0]] if len(old.chords) == len(sc.chords) else E
            ct = A.chance_tones(sc, tr, E, o)
            po = A.best_offset(old, base_tr, U)
            row.update({"E_bars": [i + 1 for i in E], "E_root": er, "E_rq": erq, "E_n": en, "E_vs_old_root": A.agree(old.chords, ab, o, E)[0],
                        "E_roots_changed_by_plan": len(changed), "chance_root_mean": ch[0], "chance_root_p95": ch[2], "chance_n": ch[3],
                        "E_tones_new": A.agree_tones(sc.chords, ab, o, E)[0], "E_tones_old": A.agree_tones(old.chords, ab, o, E)[0],
                        "chance_tones_mean": ct[0], "chance_tones_p95": ct[1],
                        "audio_label_changed_vs_base_render_edited": sum(1 for i in E if bb[i + po] != ab[i + o]) / len(E),
                        "audio_label_changed_unedited": sum(1 for i in U if 0 <= i + o < len(ab) and 0 <= i + po < len(bb) and bb[i + po] != ab[i + o]) / len(U),
                        "per_bar": [{"bar": i + 1, "old": old.chords[i], "new": sc.chords[i], "audio_base": bb[i + po] if 0 <= i + po < len(bb) else None,
                                     "audio": ab[i + o] if 0 <= i + o < len(ab) else None} for i in E]})
        out.append(row)
        print(json.dumps({k: v for k, v in row.items() if k != "per_bar"}, default=float))
    json.dump(out, open(os.path.join(HERE, "raw", "analysis.json"), "w"), indent=1, default=float)


main()
