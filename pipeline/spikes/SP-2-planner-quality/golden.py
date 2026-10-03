"""R-016: golden cases for a TypeScript port of the upstream validator. For every library sidecar and a set of hand-made
mutations, record what the vendored Python parse_abc says (ok/error text + a few facts). Throwaway; writes golden.json."""
import json, os, re, sys, time
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import run, score as S
T = S.T

base = run.library()
cases = []


def verdict(text):
    t0 = time.perf_counter()
    try:
        sc = T.parse_abc(text)
        ms = (time.perf_counter() - t0) * 1000
        v = sc.voices["Vocal"]
        return {"ok": True, "ms": round(ms, 2), "bpm": sc.bpm, "bars": len(v.bars), "vocal_notes": len(v.notes),
                "ins_notes": len(sc.voices["Ins"].notes), "chords": len(v.chords), "quarters": str(v.time)}
    except T.AbcError as e:
        return {"ok": False, "error": str(e), "ms": round((time.perf_counter() - t0) * 1000, 2)}


import glob
for f in sorted(glob.glob(r"E:\repos\Mulakai\server\data\audio\*.abc")):
    t = open(f, encoding="utf-8").read()
    cases.append({"name": "library:" + os.path.basename(f)[:8], "chars": len(t), "text_file": os.path.basename(f), **verdict(t)})

t = base[1]["text"]            # 2c944049: 4/4, L:1/32, chords
lines = t.splitlines()


def mutate(name, fn):
    m = fn(t)
    cases.append({"name": "mut:" + name, "text": m, **verdict(m)})


mutate("bar one unit short (message prints a Fraction)", lambda x: x.replace("D4A4f4A4e4A4e4A4|", "D4A4f4A4e4A4e4A3|", 1))
mutate("bar one unit long (duration 5 hit first)", lambda x: x.replace("D4A4f4A4e4A4e4A4|", "D4A4f4A4e4A4e4A5|", 1))
mutate("duration 5 not allowed", lambda x: x.replace('"Bb"z32|', '"Bb"z27z5|', 1))
mutate("unsupported chord Cmaj9", lambda x: x.replace('"Bb"z32', '"Cmaj9"z32', 1))
mutate("chord Dm7b5 ok (m7b5 is native)", lambda x: x.replace('"Bb"z32', '"Dm7b5"z32', 1))
mutate("chord C/E ok", lambda x: x.replace('"Bb"z32', '"C/E"z32', 1))
mutate("chord Bbbm7 ok", lambda x: x.replace('"Bb"z32', '"Bbm7"z32', 1))
mutate("chord in Ins", lambda x: x.replace("D4A4f4A4e4A4e4A4|", '"Dm"D4A4f4A4e4A4e4A4|', 1))
mutate("tuplet", lambda x: x.replace("D4A4f4A4e4A4e4A4|", "(3D4A4f4A4e4A4e4A4|", 1))
mutate("repeat sign", lambda x: x.replace("D4A4f4A4e4A4e4A4|", "|:D4A4f4A4e4A4e4A4|", 1))
mutate("w: lyrics line", lambda x: x.replace("V: Vocal\n", "w: la la\nV: Vocal\n", 1))
mutate("tie across pitches", lambda x: x.replace("D4A4f4A4e4A4e4A4|", "D4-A4f4A4e4A4e4A4|", 1))
mutate("tie into rest", lambda x: x.replace("d8d8d2c6d4c2d2|", "d8d8d2c6d4c2d2-|", 1))
mutate("empty bar", lambda x: x.replace('"Bb"z32|"Bb"z32|"Dm"z32|"Dm"z32|', '"Bb"z32||"Dm"z32|"Dm"z32|', 1))
mutate("five bars in a group", lambda x: x.replace('"Bb"z32|"Bb"z32|"Dm"z32|"Dm"z32|', '"Bb"z32|"Bb"z32|"Dm"z32|"Dm"z32|"Dm"z32|', 1))
mutate("voices differ in bar count", lambda x: x.replace("B,4F4d4F4c4F4c4F4|B,4F4d4F4c4F4c4F4|D4A4f4A4e4A4e4A4|D4A4f4A4e4A4e4A4|", "B,4F4d4F4c4F4c4F4|B,4F4d4F4c4F4c4F4|D4A4f4A4e4A4e4A4|", 1))
mutate("Q: with text", lambda x: x.replace("Q:1/4=87", "Q:1/4=87 slow", 1))
mutate("missing final barline", lambda x: x.rstrip("\n").rstrip("|") + "\n")
mutate("unknown key", lambda x: x.replace("K:Dm", "K:Ddor", 1))
mutate("accidental propagates across octaves (valid)", lambda x: x.replace("D4A4f4A4e4A4e4A4|", "^F4f4A4A4e4A4e4A4|", 1))
mutate("lowercase z with accidental", lambda x: x.replace("z24", "^z24", 1))
mutate("Z with chord", lambda x: x.replace("Z|z24", '"Dm"Z|z24', 1))
mutate("trailing spaces in a music line", lambda x: x.replace("Z2|D4A4", "Z2| D4A4", 1))
mutate("T: not blank", lambda x: x.replace("T:\n", "T:Song\n", 1))
mutate("section comment without music at end", lambda x: x + "% outro\n")
mutate("note beyond meter end by a chord at end", lambda x: x.replace('"Bb"z32|"Bb"z32|"Dm"z32|"Dm"z32|', '"Bb"z32|"Bb"z32|"Dm"z32|"Dm"z32"Dm"|', 1))
mutate("CRLF line endings", lambda x: x.replace("\n", "\r\n"))
json.dump(cases, open(os.path.join(HERE, "golden.json"), "w", encoding="utf-8"), indent=1)
for c in cases:
    print(f"{c['name']:48s} {'ok ' if c['ok'] else 'ERR'} {c.get('error', '')[:90]} {c['ms']} ms")
ms = [c["ms"] for c in cases if c["name"].startswith("library:") and c["ok"]]
print("parse ms over library scores:", min(ms), max(ms))
