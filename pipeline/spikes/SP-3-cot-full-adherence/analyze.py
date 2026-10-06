"""SP-3 analysis (run inside WSL with ~/sheetsage2/.venv/bin/python): compares each variant's SheetSage2 re-transcription
with the hand-edited score that was rendered, and with the unchanged re-render (a).
usage: analyze.py [song ...]  -> results.json + printed tables.

Method notes
- bar alignment: SheetSage2 gives downbeats (downbeat.lab); audio bar j <-> score bar i = j - o, o chosen as the integer
  offset (-4..4) that maximises root-chord agreement on UNEDITED bars only (so an edit cannot buy its own alignment).
- chord agreement: per-bar majority label of chord.lab vs the intended per-bar chord (longest-covering chord in the bar).
  levels: root (pitch class) and root+triad class (min / maj-family / dim / aug).
- chance: the same E-bar intended chords scored against the audio chords of every other bar offset (circular shifts,
  excluding |shift| < 4 bars), mean over shifts.
- melody F1: mir_eval, onset 0.25 s, pitch 50 cents, offsets ignored (same as the PLAN.md melody-survival harness), exact and
  octave-folded; notes are compared in score time (audio time -> score bar + fraction -> nominal seconds) so a tempo/length
  change does not need a fitted time scale.
"""
import json, math, os, re, sys
from collections import defaultdict
import numpy as np, pretty_midi, mir_eval

sys.path.insert(0, "/mnt/e/repos/Mulakai/yue-server/upstream")
from abc_tools import parse_abc  # noqa: E402

HERE = "/mnt/e/repos/Mulakai/pipeline/spikes/SP-3-cot-full-adherence"
SS = os.path.expanduser("~/sp3/ss")
REN = os.path.expanduser("~/sp3/render")
EDITS = json.load(open(f"{HERE}/edits.json"))
PC = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}


def root_pc(name):
    m = re.match(r"([A-G])(bb|##|b|#)?", name)
    pc = PC[m.group(1)] + {None: 0, "b": -1, "bb": -2, "#": 1, "##": 2}[m.group(2)]
    return pc % 12, name[m.end():]


def klass_intended(q):
    q = q.split("/")[0]
    if q.startswith("dim") or q.startswith("m7b5"):
        return "dim"
    if q.startswith("aug"):
        return "aug"
    if q.startswith("m") and not q.startswith("maj"):
        return "min"
    return "maj"


def klass_audio(q):
    if "dim" in q or "hdim" in q:
        return "dim"
    if "aug" in q:
        return "aug"
    if "min" in q:
        return "min"
    return "maj"


def parse_label(label):
    if label in (None, "N"):
        return None
    r, q = label.split(":")[0], (label.split(":") + [""])[1]
    pc, _ = root_pc(r)
    return pc, klass_audio(q)


def read_lab(path):
    rows = []
    for ln in open(path):
        p = ln.rstrip("\n").split("\t")
        if len(p) >= 3:
            rows.append((float(p[0]), float(p[1]), p[2]))
    return rows


class Tr:
    """one SheetSage2 transcription"""
    def __init__(self, name):
        d = f"{SS}/{name}"
        self.name = name
        self.down = [float(l.split("\t")[0]) for l in open(f"{d}/downbeat.lab") if l.strip()]
        self.chords = read_lab(f"{d}/chord.lab")
        self.beats = [float(l.split("\t")[0]) for l in open(f"{d}/beat.lab") if l.strip()]
        self.res = json.load(open(f"{d}/result.json"))
        self.dur = self.res["duration_seconds"]
        self.struct = read_lab(f"{d}/structure.lab") if os.path.exists(f"{d}/structure.lab") else []
        self.abc = open(f"{d}/score.abc").read()
        self.q = int(re.search(r"^Q:1/4=(\d+)", self.abc, re.M).group(1))
        self.notes = {}
        for part in ("vocal", "instrumental"):
            p = f"{d}/melody_{part}.mid"
            iv, pt = [], []
            if os.path.exists(p):
                for inst in pretty_midi.PrettyMIDI(p).instruments:
                    for n in inst.notes:
                        iv.append((n.start, max(n.end, n.start + 0.05))); pt.append(n.pitch)
            self.notes[part] = (np.array(iv).reshape(-1, 2), np.array(pt, dtype=int))

    def bars(self):
        """[(t0, t1)] per audio bar from the downbeats"""
        D = self.down
        return [(D[j], D[j + 1] if j + 1 < len(D) else self.dur) for j in range(len(D))]

    def bar_chords(self):
        out = []
        for t0, t1 in self.bars():
            cov = defaultdict(float)
            for a, b, lab in self.chords:
                ov = min(b, t1) - max(a, t0)
                if ov > 0 and lab != "N":
                    cov[lab] += ov
            out.append(max(cov, key=cov.get) if cov else None)
        return out

    def bpm_from_bars(self):
        # skip the first (pickup fragment) and last bar
        iv = np.diff(self.down[1:-1])
        return 4 * 60 / float(np.median(iv)) if len(iv) else None  # 4/4 only; meter-changing songs report None-ish


class Sc:
    """a rendered score (the intended one)"""
    def __init__(self, path):
        self.text = open(path).read()
        self.p = parse_abc(self.text)
        v = self.p.voices["Vocal"]
        self.bars = [(float(s), float(d)) for s, d, _ in v.bars]
        self.bpm = self.p.bpm
        ch = sorted(v.chords, key=lambda x: x[0])
        self.chords = []
        for i, (s, d) in enumerate(self.bars):
            ev = [(float(t), c) for t, c in ch if s <= float(t) < s + d]
            if not ev:
                self.chords.append(self.chords[-1] if self.chords else None); continue
            cov = defaultdict(float)
            for k, (t, c) in enumerate(ev):
                te = ev[k + 1][0] if k + 1 < len(ev) else s + d
                cov[c] += te - t
            self.chords.append(max(cov, key=cov.get))
        self.notes = {"Vocal": [(float(t), p, float(d)) for t, p, d in v.notes],
                      "Ins": [(float(t), p, float(d)) for t, p, d in self.p.voices["Ins"].notes]}

    def locate(self, q):
        """quarter position -> (bar index, fraction)"""
        for i, (s, d) in enumerate(self.bars):
            if q < s + d - 1e-9:
                return i, (q - s) / d
        return len(self.bars) - 1, 1.0


def load_score(code, v):
    return Sc(f"{HERE}/scores/{code}_{v}.abc")


def agree(intended, audio, o, idx):
    """agreement over score bars idx at offset o: (root, root+class, n)"""
    r = rq = n = 0
    for i in idx:
        j = i + o
        if not (0 <= j < len(audio)) or intended[i] is None:
            continue
        a = parse_label(audio[j])
        if a is None:
            n += 1; continue
        pc, q = root_pc(intended[i]); n += 1
        r += (a[0] == pc); rq += (a[0] == pc and a[1] == klass_intended(q))
    return (r / n if n else float("nan"), rq / n if n else float("nan"), n)



QPCS = {"": (0, 4, 7), "m": (0, 3, 7), "dim": (0, 3, 6), "aug": (0, 4, 8), "7": (0, 4, 7, 10), "maj7": (0, 4, 7, 11), "m7": (0, 3, 7, 10),
        "dim7": (0, 3, 6, 9), "m7b5": (0, 3, 6, 10), "sus4": (0, 5, 7), "sus2": (0, 2, 7), "6": (0, 4, 7, 9), "m6": (0, 3, 7, 9),
        "7sus4": (0, 5, 7, 10), "m(maj7)": (0, 3, 7, 11)}


def pcs_intended(name):
    pc, q = root_pc(name.split("/")[0])
    return frozenset((pc + x) % 12 for x in QPCS[q.split("/")[0]])


def pcs_audio(label):
    if label in (None, "N"):
        return frozenset()
    r, q = label.split(":")[0], (label.split(":") + [""])[1].split("/")[0]
    pc, _ = root_pc(r)
    table = {"maj": (0, 4, 7), "min": (0, 3, 7), "dim": (0, 3, 6), "aug": (0, 4, 8), "7": (0, 4, 7, 10), "maj7": (0, 4, 7, 11), "min7": (0, 3, 7, 10),
             "dim7": (0, 3, 6, 9), "hdim7": (0, 3, 6, 10), "sus4": (0, 5, 7), "sus2": (0, 2, 7), "maj6": (0, 4, 7, 9), "min6": (0, 3, 7, 9),
             "minmaj7": (0, 3, 7, 11), "9": (0, 4, 7, 10), "maj9": (0, 4, 7, 11), "min9": (0, 3, 7, 10), "": (0, 4, 7)}
    return frozenset((pc + x) % 12 for x in table.get(q, (0, 4, 7) if "min" not in q else (0, 3, 7)))


def jacc(a, b):
    return len(a & b) / len(a | b) if a | b else 0.0


def agree_tones(intended, audio, o, idx):
    v = [jacc(pcs_intended(intended[i]), pcs_audio(audio[i + o])) for i in idx if 0 <= i + o < len(audio) and intended[i] is not None]
    return float(np.mean(v)) if v else float("nan"), len(v)


def chance_tones(sc, tr, idx, o0):
    ab = tr.bar_chords(); vals = []
    for o in range(-len(sc.chords) + 4, len(ab) - 4):
        if abs(o - o0) < 4:
            continue
        m, n = agree_tones(sc.chords, ab, o, idx)
        if n >= max(3, len(idx) // 2) and not math.isnan(m):
            vals.append(m)
    return float(np.mean(vals)), float(np.percentile(vals, 95))


def best_offset(sc, tr, idx):
    ab = tr.bar_chords()
    best = max(range(-4, 5), key=lambda o: (np.nan_to_num(agree(sc.chords, ab, o, idx)[0], nan=-1), -abs(o)))
    return best


def chance(sc, tr, idx, o0):
    ab = tr.bar_chords(); vals_r, vals_rq = [], []
    for o in range(-len(sc.chords) + 4, len(ab) - 4):
        if abs(o - o0) < 4:
            continue
        r, rq, n = agree(sc.chords, ab, o, idx)
        if n >= max(3, len(idx) // 2) and not math.isnan(r):
            vals_r.append(r); vals_rq.append(rq)
    return float(np.mean(vals_r)), float(np.mean(vals_rq)), float(np.percentile(vals_r, 95)), len(vals_r)


def score_notes_to_audio(sc, tr, o, voices=("Vocal", "Ins")):
    iv, pt = [], []
    bars = tr.bars()
    for v in voices:
        for t, p, d in sc.notes[v]:
            i, f = sc.locate(t)
            j = i + o
            if not (0 <= j < len(bars)):
                continue
            t0 = bars[j][0] + f * (bars[j][1] - bars[j][0])
            i2, f2 = sc.locate(t + d - 1e-6)
            j2 = i2 + o
            t1 = (bars[j2][0] + f2 * (bars[j2][1] - bars[j2][0])) if 0 <= j2 < len(bars) else t0 + 0.2
            iv.append((t0, max(t1, t0 + 0.05))); pt.append(p)
    order = np.argsort([a for a, _ in iv]) if iv else []
    return (np.array(iv)[order].reshape(-1, 2), np.array(pt, dtype=int)[order]) if iv else (np.zeros((0, 2)), np.zeros(0, dtype=int))


def tr_notes(tr, parts=("vocal", "instrumental")):
    iv = np.concatenate([tr.notes[p][0] for p in parts]); pt = np.concatenate([tr.notes[p][1] for p in parts])
    order = np.argsort(iv[:, 0]) if len(iv) else []
    return (iv[order], pt[order]) if len(iv) else (iv, pt)


def hz(p):
    return 440.0 * 2 ** ((np.asarray(p, dtype=float) - 69) / 12)


def f1(ref, est, fold=False, tol=0.25):
    (ri, rp), (ei, ep) = ref, est
    if len(ri) == 0 or len(ei) == 0:
        return (0.0, 0.0, 0.0)
    if fold:
        rp, ep = rp % 12 + 60, ep % 12 + 60
    p, r, f, _ = mir_eval.transcription.precision_recall_f1_overlap(ri, hz(rp), ei, hz(ep), onset_tolerance=tol, pitch_tolerance=50.0, offset_ratio=None)
    return (float(p), float(r), float(f))


def window(notes, t0, t1, outside=False):
    iv, pt = notes
    m = (iv[:, 0] >= t0) & (iv[:, 0] < t1)
    if outside:
        m = ~m
    return iv[m], pt[m]


def both(ref, est):
    return {"exact": f1(ref, est)[2], "fold": f1(ref, est, fold=True)[2], "n_ref": int(len(ref[1])), "n_est": int(len(est[1]))}


def to_nominal(tr, o, notes, sc, bpm):
    """audio-time notes -> score-time seconds (nominal tempo of the score)"""
    bars = tr.bars()
    iv, pt = notes
    out_iv, out_pt = [], []
    for (s, e), p in zip(iv, pt):
        for j, (b0, b1) in enumerate(bars):
            if s < b1:
                i = j - o
                if 0 <= i < len(sc.bars):
                    f = (s - b0) / (b1 - b0)
                    q = sc.bars[i][0] + f * sc.bars[i][1]
                    t = q * 60 / bpm
                    out_iv.append((t, t + max(e - s, 0.05))); out_pt.append(p)
                break
    return np.array(out_iv).reshape(-1, 2), np.array(out_pt, dtype=int)


def analyse(code):
    ed = EDITS[code]
    res = {}
    base_sc = load_score(code, "a")
    trs = {v: Tr(f"{code}_{v}") for v in ("a0", "a", "b", "bm", "c", "d", "e") if os.path.exists(f"{SS}/{code}_{v}/result.json")}
    orig = Tr(f"{code}_orig")
    res["orig_vs_a0"] = {"chord_lab_identical": open(f"{SS}/{code}_orig/chord.lab").read() == open(f"{SS}/{code}_a0/chord.lab").read(),
                          "melody_identical": all(open(f"{SS}/{code}_orig/melody_{p}.mid", "rb").read() == open(f"{SS}/{code}_a0/melody_{p}.mid", "rb").read() for p in ("vocal", "instrumental"))} if "a0" in trs else None
    nb = len(base_sc.bars)
    rf, rn = ed["reharm"]["first_bar"], ed["reharm"]["n"]
    chorus0 = ed["chorus0_bars"]
    ph0, ph1 = ed["phrase"]["bars"]
    if "a0" in trs and "a" in trs:
        o0 = best_offset(base_sc, trs["a0"], list(range(nb))); o1 = best_offset(base_sc, trs["a"], list(range(nb)))
        d_ = {"audio_s_a0": trs["a0"].dur, "audio_s_a": trs["a"].dur, "bars_a0": len(trs["a0"].down), "bars_a": len(trs["a"].down)}
        for part in (("vocal", "instrumental"), ("vocal",), ("instrumental",)):
            x = to_nominal(trs["a0"], o0, tr_notes(trs["a0"], part), base_sc, base_sc.bpm)
            y = to_nominal(trs["a"], o1, tr_notes(trs["a"], part), base_sc, base_sc.bpm)
            d_["_".join(part)] = both(x, y)
        ca = agree(base_sc.chords, trs["a0"].bar_chords(), o0, list(range(nb))); cb = agree(base_sc.chords, trs["a"].bar_chords(), o1, list(range(nb)))
        d_["chord_root_vs_score_a0"], d_["chord_root_vs_score_a"] = ca[0], cb[0]
        d_["melody_vs_score_a0"] = both(score_notes_to_audio(base_sc, trs["a0"], o0), tr_notes(trs["a0"]))
        d_["melody_vs_score_a"] = both(score_notes_to_audio(base_sc, trs["a"], o1), tr_notes(trs["a"]))
        res["a_vs_a0"] = d_
    for v, tr in trs.items():
        sc = load_score(code, "b" if v == "bm" else v)
        r = {"audio_s": tr.dur, "nominal_s": float(sc.p.voices["Vocal"].time * 60 / sc.bpm), "score_bars": len(sc.bars),
             "audio_bars": len(tr.down), "Q_score": sc.bpm, "Q_transcribed": tr.q, "bpm_from_bars": tr.bpm_from_bars(),
             "sections_transcribed": len(tr.struct), "sections_score": len(re.findall(r"^% ", sc.text, re.M)),
             "tempo_from_duration": sc.bpm * (float(sc.p.voices['Vocal'].time * 60 / sc.bpm) / tr.dur)}
        # edit windows in this variant's bar indices
        if v in ("b", "bm"):
            E = list(range(rf, rf + rn))
        elif v == "d":
            E = list(range(chorus0[1], chorus0[1] + (chorus0[1] - chorus0[0])))  # the added copy
        elif v == "e":
            E = list(range(ph0, ph1))
        else:
            E = []
        allb = list(range(len(sc.bars)))
        U = [i for i in allb if i not in set(E) and (v != "d" or i < chorus0[1])]
        o = best_offset(sc, tr, U)
        ab = tr.bar_chords()
        ur, urq, un = agree(sc.chords, ab, o, U)
        r.update({"offset": o, "U_root": ur, "U_rq": urq, "U_n": un, "U_tones": agree_tones(sc.chords, ab, o, U)[0]})
        if v == "d":  # second half alignment: bars after the added chorus
            U2 = [i for i in allb if i >= chorus0[1] + (chorus0[1] - chorus0[0])]
            o2 = best_offset(sc, tr, U2); r["offset_after_repeat"] = o2
            r["U2_root"], r["U2_rq"], r["U2_n"] = agree(sc.chords, ab, o2, U2)
            Ea = E
            r["E_offset_used"] = o + (o2 - o) * 0  # the added copy is judged at the pre-repeat offset
        if E and v in ("b", "d", "bm"):
            er, erq, en = agree(sc.chords, ab, o, E)
            ch = chance(sc, tr, E, o)
            ct = chance_tones(sc, tr, E, o)
            r.update({"E_root": er, "E_rq": erq, "E_n": en, "chance_root": ch[0], "chance_rq": ch[1], "chance_root_p95": ch[2],
                      "E_tones": agree_tones(sc.chords, ab, o, E)[0], "chance_tones": ct[0], "chance_tones_p95": ct[1]})
            # old chords on the same bars: did the render keep the ORIGINAL harmony instead?
            if v in ("b", "bm"):
                orr, orq, _ = agree(base_sc.chords, ab, o, E)
                r.update({"E_vs_old_root": orr, "E_vs_old_rq": orq, "E_vs_old_tones": agree_tones(base_sc.chords, ab, o, E)[0]})
                if "a" in trs:
                    ab_c = trs["a"].bar_chords()
                    r["E_audio_label_changed_vs_a"] = sum(1 for i in E if ab[i + o] != ab_c[i + o]) / len(E)
                    r["E_audio_root_changed_vs_a"] = sum(1 for i in E if (parse_label(ab[i + o]) or (None,))[0] != (parse_label(ab_c[i + o]) or (None,))[0]) / len(E)
        if v in ("b", "bm"):
            ab_a_ = trs["a"].bar_chords() if "a" in trs else []
            r["E_bars"] = [{"bar": i, "old": base_sc.chords[i], "new": sc.chords[i], "audio_a": ab_a_[i + o] if i + o < len(ab_a_) else None, "audio_b": ab[i + o] if i + o < len(ab) else None} for i in E]
        if v == "b" and "a" in trs:  # control: the unchanged render's audio chords on the same bars vs the new intended chords
            ab_a = trs["a"].bar_chords(); oa = best_offset(base_sc, trs["a"], [i for i in allb if i not in set(E)])
            r["control_a_audio_vs_NEW_intended_root"], r["control_a_audio_vs_NEW_intended_rq"], _ = agree(sc.chords, ab_a, oa, E)
            r["control_a_audio_vs_OLD_intended_root"], r["control_a_audio_vs_OLD_intended_rq"], _ = agree(base_sc.chords, ab_a, oa, E)
            r["control_a_offset"] = oa
        # melody vs the intended score, outside the edit window
        est = tr_notes(tr)
        ref = score_notes_to_audio(sc, tr, o)
        bars = tr.bars()
        if E:
            t0 = bars[E[0] + o][0] if 0 <= E[0] + o < len(bars) else 0
            t1 = bars[min(E[-1] + o, len(bars) - 1)][1]
            r["melody_vs_score_outside"] = both(window(ref, t0, t1, True), window(est, t0, t1, True))
            r["melody_vs_score_inside"] = both(window(ref, t0, t1), window(est, t0, t1))
        r["melody_vs_score_all"] = both(ref, est)
        # melody vs the unchanged re-render (a), in score time
        if "a" in trs and v not in ("a", "a0"):
            sc_a = base_sc
            tr_a = trs["a"]; oa = best_offset(sc_a, tr_a, list(range(nb)))
            est_v = to_nominal(tr, o, est, sc, sc.bpm)
            est_a = to_nominal(tr_a, oa, tr_notes(tr_a), sc_a, sc.bpm)  # a's quarters at the variant's nominal tempo
            if v == "d":
                n_ch = chorus0[1] - chorus0[0]
                q1 = sc.bars[chorus0[1]][0] * 60 / sc.bpm; q0 = sc.bars[chorus0[1] + n_ch][0] * 60 / sc.bpm
                iv_, pt_ = est_v
                copy = (iv_[(iv_[:, 0] >= q1) & (iv_[:, 0] < q0)], pt_[(iv_[:, 0] >= q1) & (iv_[:, 0] < q0)])
                keep = ~((iv_[:, 0] >= q1) & (iv_[:, 0] < q0))
                iv2 = iv_[keep].copy(); pt2 = pt_[keep]; iv2[iv2[:, 0] >= q0] -= (q0 - q1)
                est_v = (iv2, pt2)
                first = window(est_v, q1 - (q0 - q1), q1)
                r["repeat_copy_vs_first_chorus"] = both((first[0] + (q0 - q1), first[1]), copy)
            # per-part breakdown (vocal vs instrumental melody), outside the edit window, vs the unchanged re-render
            r["by_part_vs_a"] = {}
            for part in ("vocal", "instrumental"):
                pv = to_nominal(tr, o, tr_notes(tr, (part,)), sc, sc.bpm)
                pa = to_nominal(tr_a, oa, tr_notes(tr_a, (part,)), sc_a, sc.bpm)
                if v == "d":
                    q1_ = sc.bars[chorus0[1]][0] * 60 / sc.bpm; q0_ = sc.bars[chorus0[1] + (chorus0[1] - chorus0[0])][0] * 60 / sc.bpm
                    k_ = ~((pv[0][:, 0] >= q1_) & (pv[0][:, 0] < q0_)); iv3 = pv[0][k_].copy(); iv3[iv3[:, 0] >= q0_] -= (q0_ - q1_); pv = (iv3, pv[1][k_])
                elif E:
                    lo_ = sc.bars[E[0]][0] * 60 / sc.bpm; hi_ = (sc.bars[E[-1]][0] + sc.bars[E[-1]][1]) * 60 / sc.bpm
                    pv = window(pv, lo_, hi_, True); pa = window(pa, lo_, hi_, True)
                r["by_part_vs_a"][part] = both(pa, pv)
            if E and v != "d":
                lo = sc.bars[E[0]][0] * 60 / sc.bpm; hi = (sc.bars[E[-1]][0] + sc.bars[E[-1]][1]) * 60 / sc.bpm
                r["melody_vs_a_outside"] = both(window(est_a, lo, hi, True), window(est_v, lo, hi, True))
                r["melody_vs_a_inside"] = both(window(est_a, lo, hi), window(est_v, lo, hi))
            elif v == "d":
                lo = sc.bars[chorus0[0]][0] * 60 / sc.bpm; hi = sc.bars[chorus0[1]][0] * 60 / sc.bpm
                # base chorus window in base coordinates; compare the whole base-coordinate song, then the pre-repeat part
                r["melody_vs_a_all_after_shift"] = both(est_a, est_v)
            else:
                r["melody_vs_a_all"] = both(est_a, est_v)
        # Ins phrase presence (e)
        if v == "e":
            bars = tr.bars()
            t0 = bars[ph0 + o][0]; t1 = bars[min(ph1 - 1 + o, len(bars) - 1)][1]
            new_ref = score_notes_to_audio(sc, tr, o, voices=("Ins",)); new_ref = window(new_ref, t0, t1)
            old_sc = base_sc
            old_ref = score_notes_to_audio(old_sc, tr, o, voices=("Ins",)); old_ref = window(old_ref, t0, t1)
            for part in ("instrumental", "vocal", "both"):
                est_ = tr_notes(tr, ("vocal", "instrumental") if part == "both" else (part,))
                w = window(est_, t0, t1)
                r[f"phrase_{part}"] = {"n_est": int(len(w[1])), "F1_vs_new": f1(new_ref, w)[2], "F1_vs_new_fold": f1(new_ref, w, fold=True)[2],
                                         "F1_vs_old": f1(old_ref, w)[2], "F1_vs_old_fold": f1(old_ref, w, fold=True)[2], "recall_new": f1(new_ref, w)[1]}
            r["phrase_window_s"] = [t0, t1]; r["phrase_n_new"] = int(len(new_ref[1])); r["phrase_n_old"] = int(len(old_ref[1]))
            # chance: same phrase notes against windows shifted by whole bars elsewhere
            ch = []
            est_ = tr_notes(tr, ("instrumental",))
            for sh in range(-20, 21):
                if abs(sh) < 4 or ph0 + o + sh < 0 or ph1 + o + sh > len(bars):
                    continue
                a0_, a1_ = bars[ph0 + o + sh][0], bars[ph1 - 1 + o + sh][1]
                w = window(est_, a0_, a1_)
                shifted = (new_ref[0] + (bars[ph0 + o + sh][0] - t0), new_ref[1])
                ch.append(f1(shifted, w, fold=True)[2])
            r["phrase_chance_fold_F1_mean"] = float(np.mean(ch)); r["phrase_chance_fold_F1_p95"] = float(np.percentile(ch, 95)); r["phrase_chance_n"] = len(ch)
        res[v] = r
    return res


if __name__ == "__main__":
    songs = sys.argv[1:] or ["A", "B", "C"]
    out = {}
    for s in songs:
        out[s] = analyse(s)
    json.dump(out, open(f"{HERE}/results.json", "w"), indent=1, default=float)
    print(json.dumps(out, indent=1, default=float))
