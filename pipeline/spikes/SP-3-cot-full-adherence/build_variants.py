"""SP-3: hand-edit (no LLM) library YuE2 scores into variants a0,a,b,c,d,e and validate each with the
vendored upstream abc_tools. Reads the library read-only. Writes scores/<song>_<variant>.abc and jobs/<song>_<variant>.json
(POST /v1/jobs bodies) plus edits.json (the edit windows in score quarters, used by the analysis)."""
import json, os, re, sqlite3, sys
from fractions import Fraction

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, r"E:\repos\Mulakai\yue-server\upstream")
from abc_tools import parse_abc, compare, report, QUALITIES, CHORD  # noqa: E402

DATA = r"E:\repos\Mulakai\server\data"
db = sqlite3.connect(f"file:{DATA}/mulakai.db?mode=ro", uri=True)

SONGS = {
    # code: (version prefix, lyric block -> score section map, reharm chords (first N bars of the 1st chorus), phrase, phrase target)
    "A": dict(vid="2c944049",
              retag=[("intro", [0]), ("verse", [1]), ("chorus", [2]), ("outro", [6])],
              reharm=["Gm7", "A7", "Dm7", "Em7b5", "Gm7", "A7", "Dm7", "Dm7"],
              phrase=("chorus", 0, 1, ["D8F4A4d8c4A4", "A8F4E4D8z8", "B8d4f4e8d4B4", "A12G4F8E4D4"]),  # chorus #0, Ins line #1 (bars 5-8)
              ),
    "B": dict(vid="3820c535",
              retag=[("intro", [0]), ("verse", [1, 2]), ("chorus", [3]), ("verse", [4]), ("chorus", [5]), ("outro", [6])],
              reharm=["Cm7", "F7", "Dm7", "Gm7", "Am7b5", "D7", "Gm7", "Cm7"],
              phrase=("outro", 0, 0, ["G8B4d4g8d4B4", "e8g4b4a8g4e4", "d8f4d4B8z8", "c8A4c4f8e4c4"]),
              ),
    "C": dict(vid="c8144c53",
              retag=[("intro", [0]), ("verse", [1]), ("chorus", [2]), ("interlude", []), ("verse", [3]), ("chorus", [4]),
                     ("bridge", [5]), ("chorus", [2]), ("interlude", []), ("outro", [6])],
              reharm=["Gm7", "A7", "Dm7", "G7", "Em7b5", "A7", "Dm7", "Gm7"],
              phrase=("interlude", 0, 0, ["A8d4f4a8f4d4", "d8f4d4B8z8", "c8A4F4c8e4f4", "e12d4c8G4E4"]),
              ),
}


def request_of(vid):
    row = db.execute("select id, params_json from versions where id like ?", (vid + "%",)).fetchone()
    return row[0], json.loads(row[1])["request"]


def sections(text):
    """[(label, [line indexes])] for every `% label` block, in order; lines index into text.splitlines()."""
    lines = text.splitlines()
    out = []
    for i, ln in enumerate(lines):
        if ln.startswith("% "):
            out.append([ln[2:].strip(), i, None])
    for k, s in enumerate(out):
        s[2] = out[k + 1][1] if k + 1 < len(out) else len(lines)
    return lines, [(lab, a, b) for lab, a, b in out]


def nth_section(secs, label, n):
    return [s for s in secs if s[0] == label][n]


def music_lines(lines, a, b, voice):
    cur, res = None, []
    for i in range(a, b):
        if lines[i].startswith("V: "):
            cur = lines[i][3:].strip(); continue
        if cur == voice and lines[i] and not lines[i].startswith(("M:", "K:", "Q:", "L:")):
            res.append(i)
    return res


def reharmonize(text, label, n, chords):
    lines, secs = sections(text)
    _, a, b = nth_section(secs, label, n)
    left = list(chords); touched = []
    for i in music_lines(lines, a, b, "Vocal"):
        bars = lines[i].split("|")  # ends with "" after the last bar line
        for k, bar in enumerate(bars):
            if not bar or not left:
                continue
            if '"' in bar:
                new = left.pop(0)
                assert CHORD.fullmatch(new), new
                bars[k] = re.sub(r'"[^"]*"', f'"{new}"', bar, count=1)
                touched.append(new)
        lines[i] = "|".join(bars)
    assert not left, f"ran out of chord slots, {left} left"
    return "\n".join(lines) + "\n"


def set_tempo(text, bpm):
    return re.sub(r"^Q:1/4=\d+", f"Q:1/4={bpm}", text, count=1, flags=re.M)


def repeat_section(text, label, n):
    lines, secs = sections(text)
    _, a, b = nth_section(secs, label, n)
    block = lines[a:b]
    return "\n".join(lines[:b] + block + lines[b:]) + "\n"


def replace_ins(text, label, n, k, bars):
    lines, secs = sections(text)
    _, a, b = nth_section(secs, label, n)
    idx = music_lines(lines, a, b, "Ins")[k]
    lines[idx] = "|".join(bars) + "|"
    return "\n".join(lines) + "\n"


def blocks_of(lyrics):
    return [b for b in lyrics.split("\n\n")]


def body(block):
    return "\n".join(block.split("\n")[1:]).strip("\n")  # drop the [Tag] line


def retag(lyrics, plan):
    blk = blocks_of(lyrics)
    out = []
    for label, srcs in plan:
        text = "\n".join(b for b in (body(blk[s]) for s in srcs) if b)
        out.append(f"[{label.title()}]" + (("\n" + text) if text else ""))
    return "\n\n".join(out) + "\n"


def retag_from_score(lyrics, plan, abc):
    """Tags follow the (edited) score's `% sections` in order; plan gives the source blocks per section occurrence."""
    labels = [s[0] for s in sections(abc)[1]]
    return labels


def ins_window(text, label, n, k):
    """quarter-note start/end of the replaced Ins line, via parse of the Ins voice bar grid."""
    lines, secs = sections(text)
    _, a, b = nth_section(secs, label, n)
    before = [lines[i] for i in range(0, a)]
    # bars before this section on the Ins voice
    sc = parse_abc("\n".join(lines) + "\n")
    # count bars in Ins voice up to the target line by re-parsing prefix (valid ABC at a section boundary)
    return None


def vocal_bar_times(text):
    sc = parse_abc(text)
    return sc, [(float(s), float(s + d)) for s, d, _ in sc.voices["Vocal"].bars]


def bar_range_of_line(text, line_index, voice):
    """(first bar, last bar) in the voice's bar list for the music line at line_index (0-based into splitlines)."""
    lines = text.splitlines()
    sc = parse_abc(text)
    ml = sc.music_lines
    nbars = 0
    for i in sorted(ml):
        if ml[i] != voice:
            continue
        ln = lines[i]
        cnt = len([x for x in ln.split("|") if x.strip()])
        # a "Z4" style multi-measure rest counts as 4 bars
        zs = re.findall(r"(?:^|\|)Z(\d*)(?=\||$)", ln)
        if zs:
            cnt += sum((int(z) if z else 1) - 1 for z in zs)
        if i == line_index:
            return nbars, nbars + cnt
        nbars += cnt
    raise KeyError(line_index)


def main():
    edits = {}
    for code, cfg in SONGS.items():
        vid, req = request_of(cfg["vid"])
        base = open(f"{DATA}/audio/{vid}.abc", encoding="utf-8").read()
        sc0 = parse_abc(base)
        orig_sections = [s[0] for s in sections(base)[1]]
        style = req["style"]
        sty_bpm = re.search(r"(\d+) bpm", style)
        rep = lambda n, bpm: re.sub(r"\d+ bpm", f"{bpm} bpm", style) if sty_bpm else style + f", {bpm} bpm"

        variants = {}
        retagged = retag(req["lyrics"], cfg["retag"])
        variants["a0"] = (base, req["lyrics"], style)  # the stored request, byte for byte
        variants["a"] = (base, retagged, style)

        # b: reharmonize the first 8 chord slots of the first chorus (native vocabulary only)
        bb = reharmonize(base, "chorus", 0, cfg["reharm"])
        variants["b"] = (bb, retagged, style)

        # c: tempo +15 %, matching style text
        q0 = sc0.bpm; q1 = round(q0 * 1.15)
        variants["c"] = (set_tempo(base, q1), retagged, rep(0, q1))

        # d: first chorus repeated right after itself; lyrics gain the same block
        dd = repeat_section(base, "chorus", 0)
        lab = [p for p in cfg["retag"]]
        first_chorus = next(i for i, (l, _) in enumerate(lab) if l == "chorus")
        lab2 = lab[:first_chorus + 1] + [lab[first_chorus]] + lab[first_chorus + 1:]
        variants["d"] = (dd, retag(req["lyrics"], lab2), style)

        # e: a 4-bar Ins phrase over Vocal rests, tenor saxophone in the style
        lab_e, secn, insk, bars = cfg["phrase"]
        ee = replace_ins(base, lab_e, secn, insk, bars)
        lines, secs = sections(base)
        _, a, b = nth_section(secs, lab_e, secn)
        ins_line = music_lines(lines, a, b, "Ins")[insk]
        voc_line_bars = None
        style_e = re.sub(r"(, \d+ bpm.*)$", r", tenor saxophone solo phrase\1", style) if sty_bpm else style + ", tenor saxophone"
        variants["e"] = (ee, retagged, style_e)

        # ---- validate ----
        for name, (abc, lyr, sty) in variants.items():
            sc = parse_abc(abc)  # raises on a native-dialect violation
            assert all(CHORD.fullmatch(c) for v in sc.voices.values() for _, c in v.chords)
            if name in ("a0", "a", "b", "c"):
                cmp_ = compare(sc0, sc, allow_tempo_change=(name == "c"))
                assert cmp_["match"], (code, name, cmp_)
            if name == "b":
                diff = [(float(o[0]), o[1], n[1]) for o, n in zip(sc0.voices["Vocal"].chords, sc.voices["Vocal"].chords) if o != n]
                assert len(diff) == len(cfg["reharm"]), diff
            if name == "e":
                cmp_ = compare(sc0, sc, names=("Vocal",)); assert cmp_["match"], cmp_
                assert sc.voices["Ins"].notes != sc0.voices["Ins"].notes
            tags = re.findall(r"^\[([^\]]+)\]", lyr, re.M)
            if name != "a0":
                assert [t.lower() for t in tags if t.lower() in set(orig_sections)] , tags
            dur = float(sc.voices["Vocal"].time * 60 / sc.bpm)
            print(f"{code}.{name}: ok bpm={sc.bpm} nominal={dur:.0f}s sections={[s[0] for s in sections(abc)[1]]} lyric_tags={tags[:12]}{'...' if len(tags) > 12 else ''}")
            os.makedirs(f"{HERE}/scores", exist_ok=True); os.makedirs(f"{HERE}/jobs", exist_ok=True)
            open(f"{HERE}/scores/{code}_{name}.abc", "w", encoding="utf-8", newline="\n").write(abc)
            json.dump({"style": sty, "lyrics": lyr, "cot": "full", "seed": req["seed"], "abc": abc},
                      open(f"{HERE}/jobs/{code}_{name}.json", "w", encoding="utf-8"), ensure_ascii=False)

        # ---- edit windows (score seconds at the *variant's* tempo, bars of the Vocal voice grid) ----
        sc_b, bars_b = vocal_bar_times(variants["b"][0])
        _, a_, b_ = nth_section(sections(base)[1], "chorus", 0)
        # bars of the first chorus: first chorus's first vocal line index -> bar index
        lines_b = base.splitlines()
        vlines = music_lines(lines_b, a_, b_, "Vocal")
        b0, _ = bar_range_of_line(base, vlines[0], "Vocal")
        edits[code] = {
            "vid": vid, "bpm": sc0.bpm, "bpm_c": q1, "base_nominal_s": float(sc0.voices["Vocal"].time * 60 / sc0.bpm),
            "reharm": {"first_bar": b0, "n": len(cfg["reharm"]), "from": [c for _, c in sc0.voices["Vocal"].chords][0:0],
                       "new": cfg["reharm"]},
            "phrase": {"label": lab_e, "ins_line": ins_line,
                       "bars": list(bar_range_of_line(base, ins_line, "Ins")), "notes": cfg["phrase"][3]},
            "chorus0_bars": [bar_range_of_line(base, vlines[0], "Vocal")[0], bar_range_of_line(base, vlines[-1], "Vocal")[1]],
        }
        print(code, "edits", json.dumps(edits[code])[:300])
    json.dump(edits, open(f"{HERE}/edits.json", "w"), indent=1)


if __name__ == "__main__":
    main()
