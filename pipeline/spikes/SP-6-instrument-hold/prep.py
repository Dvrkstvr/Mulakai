"""SP-6 prep: build per-song inputs (v1 audio, base/edited ABC, style per arm). Windows python, stdlib only.
Reads the C0b scratch copy of the library (read-only) and the real library's v1 files (read-only)."""
import json, sqlite3, urllib.request, re, shutil, os
HERE = os.path.dirname(os.path.abspath(__file__))
TMP = "E:/ai/tmp/sp6"
LIBR = "E:/repos/Mulakai/server/data/audio/"        # real library, read-only
LIBC = "E:/ai/tmp/c0b-live/data/audio/"             # C0b copy, has the v2 sidecars
YUE = "http://127.0.0.1:8064"
PAIR = "E:/repos/Mulakai/.claude/worktrees/docs-c3/pipeline/verify/C0b/"
SONGS = {
  "Acid":  dict(title="Acid Houzzzz", pair="pair-Acid-Houzzzz.json", v1="83921775-d3d3-4bd6-b598-0e56d0b01d7c", v2="f0cef09a-1e0f-4de7-b108-c4c3ef7f0499", v1ext="wav"),
  "Gertar": dict(title="Gertar", pair="pair-Gertar.json", v1="c8144c53-6612-4efc-8a4c-da279f2e0307", v2="ba3c7f98-1734-4e2e-806a-aa0940e405a9", v1ext="wav"),
  "Funky": dict(title="Funky Jazz Groove", pair="pair-Funky-Jazz-Groove.json", v1="edf5c7b7-7997-490f-9cbe-4b9164b499f3", v2="9442fad7-f6d1-495a-8af9-b0724318b6aa", v1ext="flac"),
}
# instruments first and explicit (arm B); from v1's style, plus the stored caption where the style is prose
INSTR = {
  "Acid": "tb 303 acid bassline, 808 drum machine, synth lead",
  "Gertar": "clean fingerpicked acoustic guitar, subtle bassline, simple drum machine beat, atmospheric synth pads, earnest female vocal",
  "Funky": "saxophone, funky plucked bass guitar",
}
REST = {  # the old style's non-instrument words (genre, mood, vocal), instruments removed so nothing is said twice
  "Acid": "acid house, energetic",
  "Gertar": "intimate, melancholic, somber singer-songwriter piece",
  "Funky": "funky jazz, energetic, male vocals, English",
}
KEEP = "same instrumentation as the original"

def post(path, body):
    r = urllib.request.Request(YUE + path, data=json.dumps(body).encode(), headers={"Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(r))

db = sqlite3.connect("file:E:/ai/tmp/c0b-live/data/mulakai.db?mode=ro", uri=True)
out = {}
for key, s in SONGS.items():
    p = json.loads(db.execute("select params_json from versions where id=?", (s["v2"],)).fetchone()[0])
    req = p["request"]; pair = json.load(open(PAIR + s["pair"], encoding="utf-8"))
    base_abc = open(LIBR + s["v1"] + ".abc", encoding="utf-8").read()
    v2_abc = open(LIBC + s["v2"] + ".abc", encoding="utf-8").read()
    op = pair["ops"][0]
    style = req["style"]
    # the style tail the app keeps ("..., 128 bpm, F Major, 4/4 time"): bpm/key/time words stay last in every arm
    m = re.search(r",\s*\d+ bpm, [A-G][#b]? (?:major|minor|Major|Minor), \d+/\d+ time$", style)
    tail = m.group(0) if m else ""
    head = style[:m.start()] if m else style
    # arm A: today
    arms = {"A": style}
    # arm B: instruments first, plainly, then the old style text
    arms["B"] = f"{INSTR[key]}, {REST[key]}{tail}"
    arms["C"] = f"{INSTR[key]}, {REST[key]}, {KEEP}{tail}"
    # check the app's own edit reproduces the stored v2 score
    got = post("/v1/scores/apply", {"abc": base_abc, "style": style, "lyrics": req["lyrics"], "ops": [op]})
    same = got.get("abc") == v2_abc
    # arm D: same roots, triads (no 7ths / maj7 / m7b5 words) in the span only
    tri = []
    for c in op["chords"]:
        q = c["quality"]
        q2 = "m" if q.startswith("m") and not q.startswith("maj") else "maj"
        tri.append({**c, "quality": q2})
    op_d = {**op, "chords": tri}
    got_d = post("/v1/scores/apply", {"abc": base_abc, "style": style, "lyrics": req["lyrics"], "ops": [op_d]})
    out[key] = dict(title=s["title"], v1=s["v1"], v2=s["v2"], v1_file=LIBR + s["v1"] + "." + s["v1ext"], seed=req["seed"], cot=req["cot"],
                    lyrics=req["lyrics"], style=arms, span=[op["from_bar"], op["to_bar"]], base_abc=base_abc, edited_abc=v2_abc, triad_abc=got_d["abc"],
                    apply_reproduces_v2=same, apply_checks=got.get("checks"), triad_checks=got_d.get("checks"),
                    qualities=sorted({c["quality"] for c in op["chords"]}), roots=[(c["bar"], c["beat"], c["root"], c["quality"]) for c in op["chords"]])
    print(key, "apply==v2 sidecar:", same, "| triad ok:", (got_d.get("checks") or {}).get("ok"), "| qualities:", out[key]["qualities"])
    for a, t in arms.items(): print("  ", a, t)
json.dump(out, open(HERE + "/inputs.json", "w", indent=1) if False else open(HERE + "/inputs.json", "w"), indent=1)
