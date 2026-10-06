"""SP-4 step 1 (Windows python, stdlib): edited scores + yue-server job bodies through the real /v1/scores/apply (the worktree
yue-server on :8044, the same route the chat will call). jobs/<song>_<edit>.json = POST /v1/jobs bodies (cot full, the library seed).
Edits: L = REWRITE_LYRICS on the first chorus; K = CUT of one verse; for D (new song) also b = REHARMONIZE first chorus,
e = WRITE_PHRASE 4 bars, d = REPEAT first chorus. A/B/C reuse SP-3's b/e/d renders (same edits, hand-made scores)."""
import json, os, re, urllib.request
HERE = os.path.dirname(os.path.abspath(__file__))
YUE = "http://127.0.0.1:8044"

NEW_LYRICS = {  # same line count as the old chorus block
    "A": ["Morning light is breaking through", "Washing all the grey away", "Open windows, open skies", "Nothing left for me to hide"],
    "B": ["Ya vete, vete, vete", "No quiero verte sufrir", "Que el viento se lleve todo", "Y me dejes el silencio",
          "Ya vete, vete, vete", "No quiero verte sufrir", "Que la noche te dé paz", "Y me dejes el silencio"],
    "C": ["Heute lasse ich dich los", "Der Morgen kommt ganz leise an", "Die Straße ruft mich weit hinaus", "Ich gehe fort und schaue nicht zurück"],
    "D": ["Ya vete, vete, vete", "No quiero verte sufrir", "Que el viento se lleve todo", "Y me dejes el silencio",
          "Ya vete, vete, vete", "No quiero verte sufrir", "Que la noche te dé paz", "Y me dejes el silencio"],
}
CHORUS_BLOCK = {"A": 3, "B": 4, "C": 3, "D": 4}   # facts.lyric_blocks index of the first chorus
CUT_SECTION = {"A": (2, "verse"), "B": (4, "verse"), "C": (5, "verse"), "D": (4, "verse")}
REPEAT_SECTION = {"A": (3, "chorus"), "B": (3, "chorus"), "C": (3, "chorus"), "D": (3, "chorus")}


def apply(abc, style, lyrics, ops):
    r = urllib.request.Request(YUE + "/v1/scores/apply", data=json.dumps({"abc": abc, "style": style, "lyrics": lyrics, "ops": ops}).encode("utf-8"),
                               headers={"content-type": "application/json"})
    return json.load(urllib.request.urlopen(r))


def job(base, out):
    return {"style": out["style"], "lyrics": out["lyrics"], "cot": "full", "seed": base["seed"], "abc": out["abc"]}


def main():
    made = {}
    for code in "ABCD":
        base = json.load(open(f"{HERE}/base/{code}.json", encoding="utf-8"))
        abc = open(f"{HERE}/base/{code}.abc", encoding="utf-8").read()
        facts = json.load(open(f"{HERE}/facts/{code}.json", encoding="utf-8"))["facts"]
        blk = [b for b in facts["lyric_blocks"] if b["index"] == CHORUS_BLOCK[code]][0]
        edits = {
            "L": [{"op": "REWRITE_LYRICS", "block": blk["index"], "tag": blk["tag"], "occurrence": blk["occurrence"], "lines": NEW_LYRICS[code]}],
            "K": [{"op": "CUT", "section": CUT_SECTION[code][0], "label": CUT_SECTION[code][1]}],
        }
        if code == "D":
            edits["b"] = [{"op": "REHARMONIZE", "from_bar": 23, "to_bar": 30, "chords": [
                {"bar": 23 + i, "beat": 1, "root": r, "quality": q} for i, (r, q) in enumerate(
                    [("G", "m7"), ("A", "7"), ("D", "m7"), ("E", "m7b5"), ("G", "m7"), ("A", "7"), ("D", "m7"), ("D", "m7")])]}]
            n = lambda p, b: {"pitch": p, "beats": b}
            edits["e"] = [{"op": "WRITE_PHRASE", "start_bar": 57, "instrument": "tenor saxophone", "bars": [
                [n("D", 2), n("F", 1), n("A", 1)], [n("d", 1.5), n("c", 0.5), n("A", 2)],
                [n("G", 2), n("A", 1), n("B", 1)], [n("A", 2), n("F", 1), n("D", 1)]]}]
            edits["d"] = [{"op": "REPEAT", "section": REPEAT_SECTION[code][0], "label": REPEAT_SECTION[code][1]}]
        for name, ops in edits.items():
            out = apply(abc, base["style"], base["lyrics"], ops)
            ok = out["ok"]
            print(code, name, "ok", ok, [v.get("reason") or v.get("note") for v in out["verdicts"]], out["checks"].get("problems"))
            if not ok:
                continue
            open(f"{HERE}/scores/{code}_{name}.abc", "w", encoding="utf-8", newline="\n").write(out["abc"])
            json.dump(job(base, out), open(f"{HERE}/jobs/{code}_{name}.json", "w", encoding="utf-8"), ensure_ascii=False)
            made[f"{code}_{name}"] = {"sections": out.get("sections"), "bpm": out.get("bpm"), "lyrics_changed": out["changed"]["lyrics"]}
    json.dump(made, open(f"{HERE}/jobs_made.json", "w", encoding="utf-8"), indent=1)


main()
