"""Cheap audio for the owed WRITE PHRASE musicality listen: render LLM-written phrases (passing the validator) as a plain
synth (melody + chord pad, 3 s lead-in click-free) so the user can judge the MELODY. Not YuE2 audio, not a sax.
Usage: python phrase_wav.py  -> phrases/*.wav + phrases/index.html. Stdlib only."""
import json, math, os, struct, sys, wave
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import run, score as S
from fractions import Fraction
T = S.T
SR = 22050
OUT = os.path.join(HERE, "phrases")
CH = {"": (0, 4, 7), "m": (0, 3, 7), "dim": (0, 3, 6), "aug": (0, 4, 8), "7": (0, 4, 7, 10), "maj7": (0, 4, 7, 11), "m7": (0, 3, 7, 10),
      "dim7": (0, 3, 6, 9), "m7b5": (0, 3, 6, 10), "sus4": (0, 5, 7), "sus2": (0, 2, 7), "6": (0, 4, 7, 9), "m6": (0, 3, 7, 9),
      "7sus4": (0, 5, 7, 10), "m(maj7)": (0, 3, 7, 11)}


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def tone(buf, t0, dur, midi, amp, kind):
    n0, n = int(t0 * SR), int(dur * SR)
    for i in range(n):
        t = i / SR
        env = min(1, i / (0.01 * SR)) * min(1, (n - i) / (0.04 * SR)) if kind == "lead" else min(1, i / (0.05 * SR)) * min(1, (n - i) / (0.1 * SR))
        f = hz(midi)
        v = math.sin(2 * math.pi * f * t) + (0.35 * math.sin(2 * math.pi * 2 * f * t) + 0.18 * math.sin(2 * math.pi * 3 * f * t) if kind == "lead" else 0)
        if n0 + i < len(buf):
            buf[n0 + i] += amp * env * v


def chord_midi(sym):
    import re
    m = re.fullmatch(f"({T.PITCH_NAME})(.*?)(?:/({T.PITCH_NAME}))?", sym)
    root = m.group(1)
    pc = (T.NATURAL[root[0]] + sum({"#": 1, "b": -1}[c] for c in root[1:])) % 12
    return [48 + pc + x - (12 if pc > 6 else 0) for x in CH.get(m.group(2), CH[""])]


def render(after_text, start, nbars, name):
    sc = T.parse_abc(after_text)
    doc = S.Doc(after_text)
    bars = sc.voices["Vocal"].bars
    t0q, t1q = bars[start - 1][0], bars[start - 1 + nbars - 1][0] + bars[start - 1 + nbars - 1][1]
    sec_per_q = 60 / sc.bpm
    total = float(t1q - t0q) * sec_per_q + 1.0
    buf = [0.0] * int(total * SR)
    for onset, midi, dur in sc.voices["Ins"].notes:
        if t0q <= onset < t1q:
            tone(buf, float(onset - t0q) * sec_per_q, float(dur) * sec_per_q * 0.95, midi, 0.30, "lead")
    for onset, sym in sc.voices["Vocal"].chords:
        if t0q <= onset < t1q:
            nxt = min([o for o, _ in sc.voices["Vocal"].chords if o > onset] + [t1q])
            for m in chord_midi(sym):
                tone(buf, float(onset - t0q) * sec_per_q, float(min(nxt, t1q) - onset) * sec_per_q, m, 0.06, "pad")
    pk = max(1e-9, max(abs(x) for x in buf))
    with wave.open(os.path.join(OUT, name + ".wav"), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(b"".join(struct.pack("<h", int(max(-1, min(1, x / pk * 0.9)) * 32767)) for x in buf))
    return sc.bpm, doc.key


def main():
    os.makedirs(OUT, exist_ok=True)
    lib = {s["vid"][:8]: s for s in run.library()}
    items = []
    for tag in sys.argv[1:]:
        seen = set()
        for ln in open(os.path.join(HERE, "results", tag + ".jsonl"), encoding="utf-8"):
            r = json.loads(ln)
            if "attempts" not in r or r["tmpl"] not in ("T6_WRITE_PHRASE", "T7_COMPOUND"):
                continue
            a = r["attempts"][-1]
            if a.get("stage") != "ok" or not a.get("intent_ok") or r["vid"] in seen:
                continue
            ops = a["ops"]
            wp = next(o for o in ops if o["op"] == "WRITE_PHRASE")
            sc = lib[r["vid"]]
            nt, nl, ns = S.apply_ops(sc["text"], sc["lyrics"], sc["style"], ops)
            seen.add(r["vid"])
            name = f"{tag}_{r['vid']}_{r['tmpl'][:2]}"
            bpm, key = render(nt, wp["start_bar"], len(wp["bars"]), name)
            items.append((tag, r["vid"], r["request"], key, bpm, wp, name))
            if len(seen) >= 5:
                break
    rows = []
    for tag, vid, req, key, bpm, wp, name in items:
        rows.append(f"<tr><td>{tag}<br>{vid}</td><td>{req}<br><small>key {key}, {bpm} bpm, bars {wp['start_bar']}-{wp['start_bar'] + len(wp['bars']) - 1}, instrument written as: {wp['instrument']}</small>"
                    f"<pre>{json.dumps(wp['bars'])}</pre></td><td><audio controls src='{name}.wav'></audio></td></tr>")
    open(os.path.join(OUT, "index.html"), "w", encoding="utf-8").write(
        "<!doctype html><meta charset=utf-8><title>SP-2 phrases</title><body style='font-family:sans-serif'>"
        "<h3>SP-2 WRITE PHRASE listen (LLM-written, plain synth)</h3><p>Melody (bright tone) over the song's chords (soft pad). "
        "Judge only the tune: is it a musical phrase, in key, with a shape? This is NOT YuE2 audio and not a saxophone.</p>"
        "<table border=1 cellpadding=6>" + "".join(rows) + "</table>")
    print(len(items), "phrases")


if __name__ == "__main__":
    main()
