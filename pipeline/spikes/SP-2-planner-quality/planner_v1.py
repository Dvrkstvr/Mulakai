"""SP-2 spike: op schema, prompt builder, mini JSON-schema validator, Ollama client. Throwaway; stdlib only."""
from __future__ import annotations
import json, re, time, urllib.request
import score as S

OLLAMA = "http://127.0.0.1:11435"

NOTE_PAT = (r"(?:(?:\^\^|__|\^|_|=)?[A-Ga-g][,']{0,2}|z)(?:48|32|24|16|12|1|2|3|4|6|8)?-?")
BAR_PAT = "^(?:" + NOTE_PAT + ")+$"


def op_schemas(phrase_bars: int | None = None, pattern: bool = True) -> list[dict]:
    chord = {"type": "object", "additionalProperties": False, "required": ["bar", "beat", "root", "quality"],
             "properties": {"bar": {"type": "integer", "minimum": 1}, "beat": {"type": "integer", "minimum": 1, "maximum": 6},
                            "root": {"enum": S.ROOT_ENUM}, "quality": {"enum": S.QUALITY_ENUM}, "bass": {"enum": S.ROOT_ENUM}}}
    bar = {"type": "string", "minLength": 1, "maxLength": 120}
    if pattern:
        bar["pattern"] = BAR_PAT
    bars = {"type": "array", "items": bar, "minItems": 1, "maxItems": 8}
    if phrase_bars:
        bars["minItems"] = bars["maxItems"] = phrase_bars

    def o(name, props, req):
        return {"type": "object", "additionalProperties": False, "required": ["op"] + req,
                "properties": {"op": {"const": name}, **props}}
    return [
        o("SET_TEMPO", {"bpm": {"type": "integer", "minimum": 40, "maximum": 240}}, ["bpm"]),
        o("TRANSPOSE", {"semitones": {"type": "integer", "minimum": -11, "maximum": 11}}, ["semitones"]),
        o("REHARMONIZE", {"from_bar": {"type": "integer", "minimum": 1}, "to_bar": {"type": "integer", "minimum": 1},
                          "chords": {"type": "array", "items": chord, "minItems": 1, "maxItems": 40}}, ["from_bar", "to_bar", "chords"]),
        o("REPEAT", {"section": {"type": "integer", "minimum": 1}, "times": {"type": "integer", "minimum": 1, "maximum": 3}}, ["section", "times"]),
        o("CUT", {"section": {"type": "integer", "minimum": 1}}, ["section"]),
        o("REWRITE_LYRICS", {"block": {"type": "integer", "minimum": 1},
                             "lines": {"type": "array", "items": {"type": "string", "minLength": 1, "maxLength": 120}, "minItems": 1, "maxItems": 16}}, ["block", "lines"]),
        o("EDIT_STYLE", {"style": {"type": "string", "minLength": 1, "maxLength": 1200}}, ["style"]),
        o("WRITE_PHRASE", {"start_bar": {"type": "integer", "minimum": 1}, "instrument": {"type": "string", "maxLength": 40}, "bars": bars},
          ["start_bar", "instrument", "bars"]),
    ]


def build_schema(phrase_bars=None, pattern=True) -> dict:
    return {"type": "object", "additionalProperties": False, "required": ["ops"],
            "properties": {"ops": {"type": "array", "minItems": 1, "maxItems": 6, "items": {"anyOf": op_schemas(phrase_bars, pattern)}}}}


def check_schema(v, s, path="$") -> list[str]:
    errs = []
    if "anyOf" in s:
        subs = [check_schema(v, x, path) for x in s["anyOf"]]
        if all(subs):
            best = min(subs, key=len)
            errs += best[:3]
        return errs
    if "const" in s and v != s["const"]:
        return [f"{path}: expected {s['const']!r}"]
    if "enum" in s and v not in s["enum"]:
        return [f"{path}: {v!r} not in enum"]
    t = s.get("type")
    if t == "object":
        if not isinstance(v, dict):
            return [f"{path}: not an object"]
        for r in s.get("required", []):
            if r not in v:
                errs.append(f"{path}: missing {r}")
        for k, x in v.items():
            if k in s.get("properties", {}):
                errs += check_schema(x, s["properties"][k], f"{path}.{k}")
            elif s.get("additionalProperties") is False:
                errs.append(f"{path}: unexpected {k}")
    elif t == "array":
        if not isinstance(v, list):
            return [f"{path}: not an array"]
        if len(v) < s.get("minItems", 0) or len(v) > s.get("maxItems", 10**9):
            errs.append(f"{path}: {len(v)} items, want {s.get('minItems', 0)}..{s.get('maxItems', '')}")
        for i, x in enumerate(v):
            errs += check_schema(x, s["items"], f"{path}[{i}]")
    elif t == "integer":
        if isinstance(v, bool) or not isinstance(v, int):
            return [f"{path}: not an integer"]
        if v < s.get("minimum", -10**9) or v > s.get("maximum", 10**9):
            errs.append(f"{path}: {v} out of range")
    elif t == "string":
        if not isinstance(v, str):
            return [f"{path}: not a string"]
        if len(v) < s.get("minLength", 0) or len(v) > s.get("maxLength", 10**9):
            errs.append(f"{path}: string length")
        if "pattern" in s and not re.search(s["pattern"], v):
            errs.append(f"{path}: does not match pattern")
    return errs


# ------------------------------------------------------------------ prompt
SYSTEM = """You are the planner behind a song-score editor. The song is a two-voice score (Vocal and Ins) in a narrow ABC dialect; you never write the whole score. You answer with ONE JSON object {"ops":[...]} and nothing else. Code applies the ops to the score, validates them, and shows the user the change list, so every op must be exact.

Ops (bars are numbered 1..N over the whole song, as in the BAR MAP; sections are numbered as in SECTIONS):
- SET_TEMPO {bpm}: change the tempo. Code rewrites Q: and the tempo words in the style text for you.
- TRANSPOSE {semitones}: shift the whole song up (+) or down (-) by semitones. Code re-spells notes and chords.
- REHARMONIZE {from_bar, to_bar, chords:[{bar, beat, root, quality, bass?}]}: replace the chord symbols in those bars. Give at least a beat-1 chord for EVERY bar from from_bar to to_bar; beats count quarter notes from 1; a second chord in a bar goes on beat 3 (or 2 or 4). quality is one of: maj m dim aug 7 maj7 m7 dim7 m7b5 sus4 sus2 6 m6 7sus4 m(maj7). bass is an optional slash-bass root. Melody notes are never changed. Pick chords that fit the melody's key; jazz means extended/seventh chords (maj7, m7, 7, m7b5, 6).
- REPEAT {section, times}: play a section again right after itself (times 1 = once more). Code duplicates the matching lyric block too.
- CUT {section}: remove a section.
- REWRITE_LYRICS {block, lines}: replace the lines of one lyric block (numbered in LYRIC BLOCKS) with new lines about the new topic. Keep exactly the same number of lines and a similar syllable count per line so the melody still fits. Never write section tags.
- EDIT_STYLE {style}: replace the style text (a comma-separated description of genre, instruments, mood).
- WRITE_PHRASE {start_bar, instrument, bars:[...]}: write a short melodic phrase in the Ins voice, replacing the Ins bars start_bar..start_bar+N-1. Only choose bars where the Vocal rests (BAR MAP shows V:rest). `instrument` names the instrument for the style text (for example tenor saxophone). `bars` has one string per bar.
  Phrase bar notation: a note is [accidental][letter][octave marks][length]. Letters C D E F G A B are the octave from middle C up (C=middle C); lowercase c d e f g a b is the octave above; add , to go an octave lower, ' an octave higher. Accidentals: ^ sharp, _ flat, = natural; they last to the end of the bar for that letter. The key signature is already applied (K: in the header). z is a rest. length is a whole number of units (the unit is shown in the header line as UNIT); allowed lengths: 1 2 3 4 6 8 12 16 24 32 48. A trailing - ties to the next note of the same pitch. No spaces, no bar lines, no chord symbols, no tuplets, no repeat signs. Every bar must add up EXACTLY to the bar length in units: add up the lengths of each bar before you answer.
  Example (bar length 32 units): D8F4A4d8c4A4 = 8+4+4+8+4+4 = 32.
  Example (bar length 16 units): A4c4e4c4 = 4+4+4+4 = 16.
Order the ops as the user would apply them. Make only the changes the user asked for."""


def bar_map(doc: S.Doc) -> tuple[str, str]:
    cm = doc.chord_map()
    lines = []
    sec_lines = []
    for si, s in enumerate(doc.sections):
        r = doc.section_range(si)
        if r:
            sec_lines.append(f"S{si + 1} {s['label']} bars {r[0]}-{r[1]}")
    prev = [None]
    for si, s in enumerate(doc.sections):
        r = doc.section_range(si)
        if not r:
            continue
        lines.append(f"-- S{si + 1} {s['label']} --")
        for b in range(r[0], r[1] + 1):
            per_q = int(S.Fraction(1, 4) / S.Fraction(1, doc.unit))
            ch = " ".join(f"{c}@{o // per_q + 1}" for o, c in cm[b]) or "-"
            v = doc.bar_flags(b, "Vocal")
            i = doc.bar_flags(b, "Ins")
            gm = doc.bar(b, "Vocal")[0]
            if gm["meter"] != prev[0]:
                lines.append(f"(meter M:{gm['meter'][0]}/{gm['meter'][1]} from here: one bar = {doc.units_per_bar(gm)} units)")
                prev[0] = gm["meter"]
            lines.append(f"{b}: {ch} | V:{'sung' if v else 'rest'} | I:{i}")
    return "\n".join(sec_lines), "\n".join(lines)


def user_prompt(doc: S.Doc, lyr: str, style: str, request: str) -> str:
    secs, bm = bar_map(doc)
    g = doc.bar_refs()[0][1]
    upb = doc.units_per_bar(g)
    blocks = S.lyric_blocks(lyr)
    lb = "\n".join(f"{i}: {b.split(chr(10))[0]} ({len(b.split(chr(10))) - 1} lines)" +
                   (f" first line: {b.split(chr(10))[1][:50]}" if len(b.split("\n")) > 1 else "")
                   for i, b in enumerate(blocks, 1))
    return (f"HEADER: M:{doc.header[2][2:]} {doc.header[3]} (UNIT = 1/{doc.unit} note; the BAR MAP states the bar length in units wherever the meter changes) {doc.header[4]} {doc.header[7]}; "
            f"{doc.nbars()} bars, about {doc.seconds():.0f} s (the hard limit is 360 s)\n"
            f"STYLE: {style}\n\nSECTIONS:\n{secs}\n\nLYRIC BLOCKS:\n{lb}\n\nBAR MAP (bar: chords@beat | vocal | number of Ins notes):\n{bm}\n\n"
            f"REQUEST: {request}\nReply with the JSON op list only.")


# ------------------------------------------------------------------ client
def chat(model: str, messages: list[dict], schema: dict, seed: int, temperature=0.3, max_tokens=2000, timeout=900):
    body = {"model": model, "messages": messages, "temperature": temperature, "seed": seed, "max_tokens": max_tokens,
            "reasoning_effort": "none",
            "response_format": {"type": "json_schema", "json_schema": {"name": "ops", "strict": True, "schema": schema}}}
    req = urllib.request.Request(OLLAMA + "/v1/chat/completions", data=json.dumps(body).encode(), method="POST",
                                 headers={"Content-Type": "application/json"})
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            data = json.loads(r.read())
        err = None
    except urllib.error.HTTPError as e:
        data, err = None, f"HTTP {e.code}: {e.read().decode()[:300]}"
    except Exception as e:
        data, err = None, f"{type(e).__name__}: {e}"
    return data, err, time.time() - t0
