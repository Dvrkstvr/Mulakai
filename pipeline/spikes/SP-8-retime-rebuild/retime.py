"""SP-8: correct SheetSage2's saved beats, rebuild ABC from the same saved files.
Run with the SheetSage2 venv python:
  PYTHONPATH=<SheetSage2 dir>:<yue-server dir> python retime.py <song_dir> [<song_dir> ...]
A song_dir holds notation/ (copy of an output's notation folder) and orig.abc.
"""
import json, shutil, statistics, sys, time
from pathlib import Path

sys.path.insert(0, "/home/calvin/sheetsage2")  # package parent, for relative imports if needed
import importlib; nsa = importlib.import_module("SheetSage2.notation_sheetsage2")
YS = Path("/mnt/e/repos/Mulakai/.claude/worktrees/mystifying-wu-90ac74/yue-server")
sys.path.insert(0, str(YS)); sys.path.insert(0, str(YS / "upstream"))
from scores import prepare_score          # yue-server's own check (parse_abc, strip chords)
from abc_tools import parse_abc, report   # noqa


# ---- beat transforms: rows are (time, beat_in_bar, numerator, denominator) -------------
def read_rows(p):
    return [[float(a), int(b), int(c), int(d)] for a, b, c, d in
            (l.split("\t")[:4] for l in Path(p).read_text().splitlines() if l.strip())]


def renumber(rows):
    """beat-in-bar cycles 1..numerator; restarts at 1 whenever the meter changes."""
    out, prev, n = [], None, 0
    for t, _, num, den in rows:
        n = 1 if (num, den) != prev else (n % num) + 1
        prev = (num, den)
        out.append([t, n, num, den])
    return out


def lead_in(rows):
    """leading rows whose meter differs from the song's main meter (pickup stub, e.g. 1/8)."""
    main = statistics.mode((r[2], r[3]) for r in rows)
    k = 0
    while (rows[k][2], rows[k][3]) != main:
        k += 1
    return k, main


def first_downbeat(rows, start):
    return next(i for i in range(start, len(rows)) if rows[i][1] == 1)


def half(rows):
    k, _ = lead_in(rows)
    i0 = first_downbeat(rows, k)
    pre = rows[k:i0]
    kept = rows[:k] + pre[len(pre) % 2::2] + rows[i0::2]   # keep pre-downbeat beats phase-aligned to the downbeat
    return renumber(kept)


def double(rows):
    out = []
    for a, b in zip(rows, rows[1:]):
        if (a[2], a[3]) != (b[2], b[3]):      # lead-in stub row (e.g. 1/8): no midpoint after it
            out.append(a); continue
        out += [a, [(a[0] + b[0]) / 2, 0, a[2], a[3]]]
    out.append(rows[-1])
    return renumber(out)


def regular(rows, bpm, anchors="first"):
    """Regular grid at `bpm`. anchors='first': one grid from the first detected downbeat.
    anchors='struct': grid restarts (beat 1) at each structure boundary and the first downbeat."""
    k, (num, den) = lead_in(rows)
    i0 = first_downbeat(rows, k)
    t0, tend, step = rows[i0][0], rows[-1][0], 60.0 / bpm
    starts = [t0]
    if anchors == "struct":
        starts += [s for s, _, _ in STRUCT if s > t0 + step]
        starts = sorted(set(round(s, 4) for s in starts))
    out = rows[:k] + [r for r in rows[k:i0]]  # keep the original lead-in/pickup beats untouched
    for j, s in enumerate(starts):
        e = starts[j + 1] if j + 1 < len(starts) else tend + 1e-6
        t, n = s, 0
        while t < e - step * 0.25:
            out.append([t, 0, num, den]); t += step; n += 1
    out = [r for r in out if True]
    out.sort(key=lambda r: r[0])
    # dedupe near-equal times
    ded = [out[0]]
    for r in out[1:]:
        if r[0] > ded[-1][0] + 1e-3: ded.append(r)
    return renumber_anchored(ded, starts, k, i0)


def renumber_anchored(rows, starts, k, i0):
    out, n = [], 0
    ss = set(starts)
    for idx, (t, _, num, den) in enumerate(rows):
        if idx < k: out.append([t, 1, num, den]); continue
        if round(t, 4) in ss: n = 1
        else: n = (n % num) + 1 if n else 1
        out.append([t, n, num, den])
    return out


# ---- fit the melody MIDI to a (coarser) beat grid so no note collapses --------------------
def fit_midi(src, dst, rows):
    """Snap notes to the 4-subbeats-per-beat grid the way the builder does, then repair what
    would make the builder raise: a note that collapses to zero length is stretched to one
    subbeat (or dropped if the next subbeat is taken); an overlap truncates the earlier note.
    Returns (kept, dropped, stretched)."""
    import numpy as np, pretty_midi
    D = nsa.SUBBEAT_DIVISION
    bt = np.array([r[0] for r in rows]); n = len(bt)
    sub = np.interp(np.arange(D * (n - 1) + 1) / float(D), np.arange(n), bt)
    bnd = (sub[:-1] + sub[1:]) / 2
    midi = pretty_midi.PrettyMIDI(str(src)); kept = dropped = stretched = 0
    for inst in midi.instruments:
        taken, out = {}, []
        for nt in sorted(inst.notes, key=lambda x: (x.start, x.end, x.pitch)):
            a = int(np.searchsorted(bnd, nt.start)); b = int(np.searchsorted(bnd, nt.end))
            a = max(0, min(a, len(sub) - 1)); b = max(0, min(b, len(sub) - 1))
            if b <= a:
                if a + 1 < len(sub): b = a + 1; stretched += 1
                else: dropped += 1; continue
            if out and a < out[-1][1]:                      # overlap with the previous note
                if a <= out[-1][0]: dropped += 1; continue   # would erase it entirely
                out[-1][1] = a
            out.append([a, b, nt.pitch, nt.velocity])
        inst.notes = [pretty_midi.Note(velocity=v, pitch=p, start=float(sub[a]), end=float(sub[b]))
                      for a, b, p, v in out]
        kept += len(out)
    midi.write(str(dst))
    return kept, dropped, stretched


# ---- run one variant ------------------------------------------------------------------
FIT = {}


def write_variant(src_nota, dst, rows, fit=True):
    if dst.exists(): shutil.rmtree(dst)
    shutil.copytree(src_nota, dst)
    (dst / "song_beats.txt").write_text(
        "".join(f"{t:.3f}\t{b}\t{n}\t{d}\n" for t, b, n, d in rows))
    if fit:
        orig_notes = sum(len(i.notes) for i in __import__("pretty_midi").PrettyMIDI(str(src_nota / "song_melody.mid")).instruments)
        k, d, st = fit_midi(src_nota / "song_melody.mid", dst / "song_melody.mid", rows)
        FIT[dst.name] = dict(orig=orig_notes, kept=k, dropped=d, stretched=st)
    return dst / "song_melody.mid"


def _names(ch):
    seq = [c[-1] if isinstance(c, (tuple, list)) else str(c) for c in (ch.items() if isinstance(ch, dict) else ch)]
    seq = [x if isinstance(x, str) else str(x) for x in seq]
    return len([x for i, x in enumerate(seq) if i == 0 or x != seq[i - 1]])


def facts(abc):
    sc = parse_abc(abc)
    v, i = sc.voices["Vocal"], sc.voices["Ins"]
    lines = abc.splitlines()
    return dict(
        Q=next((l for l in lines if l.startswith("Q:")), None), M=next((l for l in lines if l.startswith("M:")), None),
        bars=len(v.bars), vocal_notes=len(v.notes), ins_notes=len(i.notes),
        chords=len(v.chords) + len(i.chords), chord_names=_names(v.chords), sections=sum(1 for l in lines if l.startswith("% ")),
        dur_s=round(float(v.time * 60 / sc.bpm), 1))


def run(name, melody, melody_only):
    t = time.perf_counter()
    try:
        abc, score, _ = nsa.generate_abc_from_exports(melody, meter_conflict="infer", melody_only=melody_only)
    except Exception as e:
        return dict(variant=name, error=f"{type(e).__name__}: {str(e)[:200]}")
    wall = time.perf_counter() - t
    r = dict(variant=name, wall_s=round(wall, 3), diag=list(score.diagnostics)[:3])
    try:
        r.update(facts(abc)); prepare_score(abc, "melody"); r["valid"] = True
    except Exception as e:
        r["valid"] = False; r["val_err"] = f"{type(e).__name__}: {str(e)[:200]}"
    (Path(melody).parent / f"out_{'mo' if melody_only else 'ch'}.abc").write_text(abc)
    r["abc_bytes"] = len(abc)
    if name == "base":
        orig = (Path(melody).parent.parent / "orig.abc").read_text()
        r["same_as_orig_abc"] = (abc.strip() == orig.strip())
    return r


def main():
    global STRUCT
    import os
    if os.environ.get('SP8_DIV'): nsa.SUBBEAT_DIVISION = int(os.environ['SP8_DIV'])
    for sd in map(Path, sys.argv[1:]):
        nota = sd / "notation"
        rows = read_rows(nota / "song_beats.txt")
        STRUCT = nsa.read_structures(nota / "song_structures.txt")
        gaps = [b[0] - a[0] for a, b in zip(rows, rows[1:])]
        bpm = 60 / statistics.median(gaps)
        k, main_m = lead_in(rows)
        print(f"\n### {sd.name}: {len(rows)} beats, detected {bpm:.1f} BPM, meter {main_m}, lead-in rows {k}, "
              f"bytes {sum(p.stat().st_size for p in nota.iterdir())}")
        variants = {"base": rows, "half": half(rows), "double": double(rows),
                    "bpm_mean": regular(rows, 60 / statistics.mean(g for g in gaps if g < 1.5 * statistics.median(gaps))),
                    "bpm_x2/3": regular(rows, bpm * 2 / 3), "bpm_x2/3_struct": regular(rows, bpm * 2 / 3, "struct"),
                    "bpm_round": regular(rows, round(bpm / 10) * 10 + (0 if round(bpm / 10) * 10 != round(bpm) else 5)),
                    "bpm_round_struct": regular(rows, round(bpm / 10) * 10 + (0 if round(bpm / 10) * 10 != round(bpm) else 5), "struct")}
        for mo in (False, True):
            print(f"-- melody_only={mo}")
            for vn, vr in variants.items():
                mel = write_variant(nota, sd / f"v_{vn.replace('/', '_')}_{'mo' if mo else 'ch'}", vr, fit=(vn != "base"))
                r = run(vn, mel, mo); r["fit"] = FIT.get("v_" + vn.replace("/", "_") + ("_mo" if mo else "_ch"))
                print(json.dumps(r))


main()
