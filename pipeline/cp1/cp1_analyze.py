"""CP1 audible checks (run in WSL with ~/sheetsage2/.venv/bin/python), SP-3's method reused from its analyze.py:
SheetSage2 re-transcribes each CP1 render; tempo = median downbeat interval (4/4) vs the rendered score's Q:; chord
roots on the REHARMONIZE bars vs the edited score, at the offset fitted on the other bars only, next to chance (the
same chords at every other bar offset >= 4 away). Reads raw/log.json, writes raw/analysis.json; audio stays outside
the repo (throwaway DATA_DIR). usage: cp1_analyze.py"""
import json, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "spikes", "SP-3-cot-full-adherence"))
import analyze as A  # noqa: E402  (SP-3; its module-level reads only edits.json)

A.SS = os.path.expanduser("~/cp1/ss")
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


def window(ops):
    bars = set()
    for op in ops:
        if op.get("op") == "REHARMONIZE":
            bars.update(range(op["from_bar"] - 1, op["to_bar"]))
    return sorted(bars)


def main():
    log = json.load(open(os.path.join(HERE, "raw", "log.json"), encoding="utf-8"))
    plans = {p["index"]: p for p in log["plans"]}
    out = []
    for r in log["renders"]:
        if not r.get("versionId"):
            continue
        name = f"{r['songId'][:8]}_{r['key']}"
        tr = transcribe(wsl(r["audioFile"]), name)
        sc = A.Sc(os.path.join(os.path.dirname(wsl(r["audioFile"])), r["versionId"] + ".abc"))
        old = A.Sc(wsl(r["baseAbcFile"]))
        ops = plans[r["planIndex"]]["plan"]["ops"]
        E = window(ops)
        U = [i for i in range(len(sc.bars)) if i not in set(E)]
        o = A.best_offset(sc, tr, U)
        ab = tr.bar_chords()
        bpm = tr.bpm_from_bars()
        row = {"name": name, "Q": sc.bpm, "bpm_from_bars": bpm, "tempo_err_pct": 100 * (bpm - sc.bpm) / sc.bpm if bpm else None,
               "Q_transcribed": tr.q, "audio_s": tr.dur, "score_bars": len(sc.bars), "audio_bars": len(tr.down), "offset": o,
               "U_root": A.agree(sc.chords, ab, o, U)[0], "U_n": len(U)}
        if E:
            er, erq, en = A.agree(sc.chords, ab, o, E)
            ch = A.chance(sc, tr, E, o)
            changed = [i for i in E if A.root_pc(sc.chords[i])[0] != A.root_pc(old.chords[i])[0]] if len(old.chords) == len(sc.chords) else E
            row.update({"E_bars": [i + 1 for i in E], "E_root": er, "E_rq": erq, "E_n": en, "E_vs_old_root": A.agree(old.chords, ab, o, E)[0],
                        "E_root_changed_bars_only": A.agree(sc.chords, ab, o, changed)[0] if changed else None, "E_changed_n": len(changed),
                        "chance_root_mean": ch[0], "chance_root_p95": ch[2], "chance_n": ch[3]})
            # roots alone cannot tell old from new when the planner keeps the roots: add SP-3's chord-tone Jaccard and,
            # since the jazz plan was made on the tempo render's version (same seed, same notes, only chords differ),
            # whether the audio chord on each edited bar moved from that render's.
            ct = A.chance_tones(sc, tr, E, o)
            row.update({"E_tones_new": A.agree_tones(sc.chords, ab, o, E)[0], "E_tones_old": A.agree_tones(old.chords, ab, o, E)[0],
                        "chance_tones_mean": ct[0], "chance_tones_p95": ct[1]})
            base_name = f"{r['songId'][:8]}_tempo"
            prev = A.Tr(base_name).bar_chords() if os.path.exists(os.path.join(A.SS, base_name, "result.json")) else None
            if prev:
                po = A.best_offset(old, A.Tr(base_name), U)
                row["base_render_tones_old"] = A.agree_tones(old.chords, prev, po, E)[0]
                row["base_render_tones_new"] = A.agree_tones(sc.chords, prev, po, E)[0]
                row["audio_label_changed_vs_base_render"] = sum(1 for i in E if prev[i + po] != ab[i + o]) / len(E)
                row["audio_label_changed_unedited"] = sum(1 for i in U if 0 <= i + o < len(ab) and 0 <= i + po < len(prev) and prev[i + po] != ab[i + o]) / len(U)
            row["per_bar"] = [{"bar": i + 1, "old": old.chords[i], "new": sc.chords[i], "audio_base": prev[i + po] if prev else None,
                               "audio": ab[i + o] if 0 <= i + o < len(ab) else None} for i in E]
        out.append(row)
        print(json.dumps({k: v for k, v in row.items() if k != "per_bar"}, default=float))
    json.dump(out, open(os.path.join(HERE, "raw", "analysis.json"), "w"), indent=1, default=float)


main()
