"""SP-2 spike: a bar-level model of the YuE2 native two-voice ABC dialect, the op appliers, and the validator wrapper.
Throwaway. Validation is the vendored upstream abc_tools (parse_abc / compare); everything here only EDITS text and then
hands the result to that parser. Python stdlib only."""
from __future__ import annotations
import re, sys
from fractions import Fraction
from copy import deepcopy

sys.path.insert(0, r"E:\repos\Mulakai\yue-server\upstream")
import abc_tools as T  # noqa: E402

ALLOWED = sorted(T.DURATIONS, reverse=True)
VOICES = ("Vocal", "Ins")
NAT = T.NATURAL
SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]
QUALITY_ENUM = ["maj", "m", "dim", "aug", "7", "maj7", "m7", "dim7", "m7b5", "sus4", "sus2", "6", "m6", "7sus4", "m(maj7)"]
ROOT_ENUM = ["C", "C#", "Db", "D", "D#", "Eb", "E", "F", "F#", "Gb", "G", "G#", "Ab", "A", "A#", "Bb", "B"]
JAZZ_Q = {"7", "maj7", "m7", "m7b5", "dim7", "6", "m6", "7sus4", "m(maj7)"}


class OpError(ValueError):
    """An op that cannot be applied (bad reference, out of range). Message goes back to the planner verbatim."""


def decomp(n: int) -> list[int]:
    out = []
    while n > 0:
        d = next(x for x in ALLOWED if x <= n)
        out.append(d); n -= d
    return out


# ---------------------------------------------------------------- bar events
Event = list  # ["chord", text] | ["key", text] | ["note", acc, letter, oct, units:int, tie:str, raw_dur:str]


def parse_body(body: str) -> list:
    if body == "Z":
        return [["Z"]]
    ev, cur = [], 0
    while cur < len(body):
        if body[cur].isspace():
            cur += 1; continue
        m = T.TOKEN.match(body, cur)
        if m is None:
            raise OpError(f"unsupported token at {body[cur:cur+20]!r}")
        cur = m.end()
        if m.group("chord") is not None:
            ev.append(["chord", m.group("chord")])
        elif m.group("key") is not None:
            ev.append(["key", m.group("key")])
        else:
            d = m.group("duration")
            ev.append(["note", m.group("acc") or "", m.group("note"), m.group("oct"), int(d or "1"), m.group("tie"), d])
    return ev


def emit_body(ev: list) -> str:
    if ev == [["Z"]]:
        return "Z"
    out = []
    for e in ev:
        if e[0] == "chord":
            out.append(f'"{e[1]}"')
        elif e[0] == "key":
            out.append(f"[K:{e[1]}]")
        else:
            out.append(f"{e[1]}{e[2]}{e[3]}{e[6]}{e[5]}")
    return "".join(out)


def split_at(ev: list, offset: int) -> int:
    """Make `offset` (units from bar start) an event boundary by splitting a note/rest; return the insert index."""
    pos = 0
    for i, e in enumerate(ev):
        if e[0] != "note":
            if pos == offset and e[0] == "chord":
                pass
            continue
        if pos == offset:
            return i
        if pos < offset < pos + e[4]:
            a, b = offset - pos, pos + e[4] - offset
            first = decomp(a)
            second = decomp(b)
            letter = e[2]
            tie_all = letter != "z"
            pieces = []
            for k, u in enumerate(first):
                last_of_first = k == len(first) - 1
                tie = "-" if tie_all else ""
                pieces.append(["note", e[1] if k == 0 else "", letter, e[3], u, tie, str(u)])
            idx = len(pieces)
            for k, u in enumerate(second):
                tie = e[5] if k == len(second) - 1 else ("-" if tie_all else "")
                pieces.append(["note", "", letter, e[3], u, tie, str(u)])
            ev[i:i + 1] = pieces
            return i + idx
        pos += e[4]
    if pos == offset:
        return len(ev)
    raise OpError(f"offset {offset} is outside the bar ({pos} units)")


# ---------------------------------------------------------------- document
class Doc:
    def __init__(self, text: str):
        lines = text.splitlines()
        self.header = lines[:8]
        self.sections: list[dict] = []  # {label, groups:[{meter, Vocal:{pre,bars}, Ins:{pre,bars}}]}
        cur, sec = 8, None
        meter = tuple(map(int, lines[2][2:].split("/")))
        while cur < len(lines):
            while cur < len(lines) and lines[cur].startswith("% "):
                sec = {"label": lines[cur][2:].strip(), "groups": []}
                self.sections.append(sec); cur += 1
            if cur >= len(lines):
                break
            if sec is None:
                sec = {"label": None, "groups": []}; self.sections.append(sec)
            g = {}
            for name in VOICES:
                assert lines[cur] == f"V: {name}", lines[cur]
                cur += 1
                pre = []
                while lines[cur].startswith(("M:", "K:")):
                    pre.append(lines[cur])
                    if lines[cur].startswith("M:"):
                        meter = tuple(map(int, lines[cur][2:].split("/")))
                    cur += 1
                bars = []
                for b in lines[cur][:-1].split("|"):
                    b = b.strip()
                    m = re.fullmatch(r"Z([2-4])?", b)
                    if m:
                        bars += [[["Z"]] for _ in range(int(m.group(1) or 1))]
                    else:
                        bars.append(parse_body(b))
                g[name] = {"pre": pre, "bars": bars}
                cur += 1
            g["meter"] = meter
            sec["groups"].append(g)

    # --- text out
    def text(self) -> str:
        out = list(self.header)
        for s in self.sections:
            if s["label"] is not None:
                out.append(f"% {s['label']}")
            for g in s["groups"]:
                for name in VOICES:
                    out.append(f"V: {name}")
                    out += g[name]["pre"]
                    parts, run = [], 0
                    for b in g[name]["bars"] + [None]:
                        if b == [["Z"]]:
                            run += 1; continue
                        if run:
                            parts.append("Z" if run == 1 else f"Z{run}"); run = 0
                        if b is not None:
                            parts.append(emit_body(b))
                    out.append("|".join(parts) + "|")
        return "\n".join(out) + "\n"

    # --- views
    @property
    def unit(self) -> int:
        return int(self.header[3].split("/")[1])

    @property
    def bpm(self) -> int:
        return int(self.header[4].split("=")[1])

    @property
    def key(self) -> str:
        return self.header[7][2:]

    def bar_refs(self):
        """[(section_index0, group, bar_index_in_group)] in global order"""
        refs = []
        for si, s in enumerate(self.sections):
            for g in s["groups"]:
                for k in range(len(g["Vocal"]["bars"])):
                    refs.append((si, g, k))
        return refs

    def nbars(self) -> int:
        return len(self.bar_refs())

    def units_per_bar(self, g) -> int:
        n, d = g["meter"]
        return int(Fraction(n, d) / Fraction(1, self.unit))

    def section_range(self, si: int):
        """(first_bar, last_bar) 1-based inclusive; None when the section has no bars"""
        idx = [i + 1 for i, (s, _, _) in enumerate(self.bar_refs()) if s == si]
        return (idx[0], idx[-1]) if idx else None

    def bar(self, n: int, voice: str):
        refs = self.bar_refs()
        if not 1 <= n <= len(refs):
            raise OpError(f"bar {n} does not exist (the score has {len(refs)} bars)")
        si, g, k = refs[n - 1]
        return g, k, g[voice]["bars"][k]

    def seconds(self) -> float:
        q = sum(Fraction(g["meter"][0] * 4, g["meter"][1]) for _, g, _ in self.bar_refs())
        return float(q * 60 / self.bpm)

    def chord_map(self):
        """bar -> [(beat_units_offset, chord)] for the Vocal voice"""
        res = {}
        for n, (si, g, k) in enumerate(self.bar_refs(), 1):
            ev, pos, lst = g["Vocal"]["bars"][k], 0, []
            for e in ev:
                if e[0] == "chord":
                    lst.append((pos, e[1]))
                elif e[0] == "note":
                    pos += e[4]
            res[n] = lst
        return res

    def bar_flags(self, n: int, voice: str):
        g, k, ev = self.bar(n, voice)
        notes = [e for e in ev if e[0] == "note" and e[2] != "z"]
        return len(notes)


# ---------------------------------------------------------------- ops
def chord_text(c: dict) -> str:
    if "symbol" in c:
        return c["symbol"]
    q = "" if c["quality"] == "maj" else c["quality"]
    s = c["root"] + q
    if c.get("bass"):
        s += "/" + c["bass"]
    return s


def beat_units(doc: Doc, g, beat: int) -> int:
    per_q = int(Fraction(1, 4) / Fraction(1, doc.unit))
    off = (beat - 1) * per_q
    if beat < 1 or off >= doc.units_per_bar(g):
        raise OpError(f"beat {beat} is outside the bar")
    return off


def op_set_tempo(doc, lyr, style, op):
    bpm = op["bpm"]
    doc.header[4] = f"Q:1/4={bpm}"
    if re.search(r"\b\d+\s*bpm\b", style, re.I):
        style = re.sub(r"\b\d+(\s*bpm\b)", lambda m: f"{bpm}{m.group(1)}", style, flags=re.I)
    else:
        style = style.rstrip(", ") + f", {bpm} bpm"
    return lyr, style


def op_reharmonize(doc, lyr, style, op):
    a, b = op["from_bar"], op["to_bar"]
    n = doc.nbars()
    if not (1 <= a <= b <= n):
        raise OpError(f"REHARMONIZE bars {a}-{b} are outside the score (1-{n})")
    if b - a + 1 > 16:
        raise OpError("REHARMONIZE covers more than 16 bars")
    by_bar = {}
    for c in op["chords"]:
        if not a <= c["bar"] <= b:
            raise OpError(f"chord at bar {c['bar']} is outside from_bar..to_bar ({a}-{b})")
        by_bar.setdefault(c["bar"], []).append(c)
    missing = [x for x in range(a, b + 1) if x not in by_bar]
    if missing:
        raise OpError(f"no chord given for bar(s) {missing}; give at least a beat-1 chord for every bar {a}-{b}")
    for x in range(a, b + 1):
        g, k, ev = doc.bar(x, "Vocal")
        if not any(c["beat"] == 1 for c in by_bar[x]):
            raise OpError(f"bar {x} has no beat-1 chord")
        ev[:] = [e for e in ev if e[0] != "chord"]
        if ev == [["Z"]]:
            u = doc.units_per_bar(g)
            ev[:] = [["note", "", "z", "", d, "", str(d)] for d in decomp(u)]
        for c in sorted(by_bar[x], key=lambda c: -c["beat"]):
            if len({cc["beat"] for cc in by_bar[x]}) != len(by_bar[x]):
                raise OpError(f"bar {x} has two chords on the same beat")
            idx = split_at(ev, beat_units(doc, g, c["beat"]))
            ev.insert(idx, ["chord", chord_text(c)])
    return lyr, style


def _section(doc, idx):
    if not 1 <= idx <= len(doc.sections):
        raise OpError(f"section {idx} does not exist (sections are 1-{len(doc.sections)})")
    return doc.sections[idx - 1]


def lyric_blocks(lyr: str) -> list[str]:
    return [b for b in re.split(r"\n\s*\n", lyr.strip("\n")) if b.strip()]


def op_repeat(doc, lyr, style, op):
    s = _section(doc, op["section"])
    if not s["groups"]:
        raise OpError(f"section {op['section']} has no bars")
    times = op.get("times", 1)
    if not 1 <= times <= 3:
        raise OpError("times must be 1-3")
    idx = op["section"] - 1
    copies = [deepcopy(s) for _ in range(times)]
    # a tie out of the section's last note would land on the repeat's first note (different pitch): upstream's parser
    # rejects that, so the seam between copies is un-tied (the final copy keeps its tie into the following section)
    for c in [s] + copies[:-1]:
        for name in VOICES:
            last = c["groups"][-1][name]["bars"][-1]
            for e in reversed(last):
                if e[0] == "note":
                    e[5] = ""
                    break
    doc.sections[idx + 1:idx + 1] = copies
    # lyrics: duplicate the lyric block that matches this occurrence by label, when there is one
    blocks = lyric_blocks(lyr)
    label = (s["label"] or "").lower()
    occ = sum(1 for x in doc.sections[:idx] if (x["label"] or "").lower() == label)
    m = [i for i, b in enumerate(blocks) if label and label in b.split("\n")[0].lower()]
    if m:
        j = m[min(occ, len(m) - 1)]
        for _ in range(times):
            blocks.insert(j + 1, blocks[j])
        lyr = "\n\n".join(blocks) + "\n"
    return lyr, style


def op_cut(doc, lyr, style, op):
    _section(doc, op["section"])
    if len(doc.sections) < 3:
        raise OpError("cannot cut: the song would be nearly empty")
    del doc.sections[op["section"] - 1]
    return lyr, style


def op_rewrite_lyrics(doc, lyr, style, op):
    blocks = lyric_blocks(lyr)
    i = op["block"]
    if not 1 <= i <= len(blocks):
        raise OpError(f"lyric block {i} does not exist (blocks are 1-{len(blocks)})")
    tag, *old = blocks[i - 1].split("\n")
    if not old:
        raise OpError(f"lyric block {i} ({tag}) has no lyric lines to rewrite")
    new = [x.strip() for x in op["lines"]]
    if len(new) != len(old):
        raise OpError(f"block {i} has {len(old)} lines; you gave {len(new)}. Keep the line count so the melody still fits")
    if any(not x or x.startswith("[") for x in new):
        raise OpError("lines must be non-empty lyric text, not section tags")
    blocks[i - 1] = "\n".join([tag] + new)
    return "\n\n".join(blocks) + "\n", style


def op_edit_style(doc, lyr, style, op):
    if not op["style"].strip():
        raise OpError("style is empty")
    return lyr, op["style"].strip()


def op_write_phrase(doc, lyr, style, op):
    start, bars = op["start_bar"], op["bars"]
    n = doc.nbars()
    if len(bars) < 1 or not 1 <= start <= start + len(bars) - 1 <= n:
        raise OpError(f"phrase of {len(bars)} bars at bar {start} does not fit the score (1-{n})")
    for off, text in enumerate(bars):
        g, k, vev = doc.bar(start + off, "Vocal")
        if isinstance(text, list):          # structured notes [{pitch, beats}] -> ABC; code owns the unit arithmetic
            upq = int(Fraction(1, 4) / Fraction(1, doc.unit))
            beats_bar = Fraction(doc.units_per_bar(g), upq)
            tot = sum(Fraction(str(n["beats"])) for n in text)
            if tot != beats_bar:
                raise OpError(f"phrase bar {off + 1} (score bar {start + off}) adds up to {float(tot):g} beats but a bar here is {float(beats_bar):g} beats "
                              f"({'too long by' if tot > beats_bar else 'too short by'} {abs(float(tot - beats_bar)):g})")
            text = "".join(f"{n['pitch']}{int(Fraction(str(n['beats'])) * upq)}" for n in text)
        if doc.bar_flags(start + off, "Vocal"):
            raise OpError(f"bar {start + off}: the Vocal sings here; write the phrase over bars where the Vocal rests")
        try:
            ev = parse_body(text.strip())
        except OpError as e:
            raise OpError(f"phrase bar {off + 1}: {e}")
        if any(e[0] == "chord" for e in ev):
            raise OpError(f"phrase bar {off + 1}: chord symbols belong in Vocal, not in the Ins phrase")
        total, want = sum(e[4] for e in ev if e[0] == "note"), doc.units_per_bar(g)
        if total != want:
            raise OpError(f"phrase bar {off + 1} (score bar {start + off}) adds up to {total} units but a bar here is {want} units "
                          f"({'too long by' if total > want else 'too short by'} {abs(total - want)}); re-add the note lengths")
        g["Ins"]["bars"][k] = ev
    instr = op.get("instrument", "").strip().lower()
    if instr and instr not in style.lower():
        style = style.rstrip(", ") + f", {instr}"
    return lyr, style


def op_transpose(doc, lyr, style, op):
    transpose(doc, op["semitones"])
    return lyr, style


OPS = {"SET_TEMPO": op_set_tempo, "REHARMONIZE": op_reharmonize, "REPEAT": op_repeat, "CUT": op_cut,
       "REWRITE_LYRICS": op_rewrite_lyrics, "EDIT_STYLE": op_edit_style, "WRITE_PHRASE": op_write_phrase,
       "TRANSPOSE": op_transpose}


# ---------------------------------------------------------------- transpose
def key_pc(key: str) -> int:
    m = re.match(r"([A-G])(b|#)?", key)
    return (NAT[m.group(1)] + {"b": -1, "#": 1, None: 0}[m.group(2)]) % 12


def new_key(key: str, n: int) -> str:
    minor = key.endswith("m")
    pc = (key_pc(key) + n) % 12
    cands = [k for k in T.KEYS if k.endswith("m") == minor and key_pc(k) == pc]
    return min(cands, key=lambda k: (abs(T.KEYS[k]), T.KEYS[k] < 0))


def pc_name(pc: int, key: str) -> str:
    return (FLAT_NAMES if T.KEYS[key] < 0 else SHARP_NAMES)[pc % 12]


def spell(pitch: int, key: str, local: dict):
    """choose (letter, alteration) for a midi pitch in `key`; prefer the key signature, then fewest accidentals"""
    ka = T.key_accidentals(key)
    pc = pitch % 12
    flat = T.KEYS[key] < 0
    best = None
    for L, base in NAT.items():
        for alt in (-2, -1, 0, 1, 2):
            if (base + alt) % 12 != pc:
                continue
            cost = (abs(alt), 0 if alt == ka[L] else 1, 0 if (alt < 0) == flat or alt == 0 else 1)
            if best is None or cost < best[0]:
                best = (cost, L, alt)
    _, L, alt = best
    return L, alt


ACC = {-2: "__", -1: "_", 0: "=", 1: "^", 2: "^^"}


def transpose(doc: Doc, n: int) -> None:
    """Shift every note, chord and K: by n semitones, re-spelling accidentals for the new key (replays the parser's
    accidental/tie rules so the sounding pitches are exactly +n)."""
    if n == 0:
        return
    orig_header = doc.header[7][2:]
    doc.header[7] = "K:" + new_key(orig_header, n)
    for name in VOICES:
        key_old, key_new = orig_header, new_key(orig_header, n)
        pending = None  # (sounding pitch, written pitch) of an open tie
        for s in doc.sections:
            for g in s["groups"]:
                pre = g[name]["pre"]
                for i, line in enumerate(pre):
                    if line.startswith("K:"):
                        key_old = line[2:]; key_new = new_key(key_old, n); pre[i] = "K:" + key_new
                for bar in g[name]["bars"]:
                    if bar == [["Z"]]:
                        continue
                    local_old, local_new = {}, {}
                    for e in bar:
                        if e[0] == "chord":
                            m = re.fullmatch(f"({T.PITCH_NAME})(.*?)(?:/({T.PITCH_NAME}))?", e[1])
                            def sh(p):
                                pc = (NAT[p[0]] + sum({"#": 1, "b": -1}[c] for c in p[1:]) + n) % 12
                                return pc_name(pc, key_new)
                            e[1] = sh(m.group(1)) + m.group(2) + ("/" + sh(m.group(3)) if m.group(3) else "")
                        elif e[0] == "key":
                            key_old = e[1]; key_new = new_key(key_old, n); e[1] = key_new
                            local_old, local_new = {}, {}
                        else:
                            _, acc, note, octv, units, tie, _raw = e
                            if note == "z":
                                continue
                            letter = note.upper()
                            written = 60 + NAT[letter] + (12 if note.islower() else 0) + 12 * (octv.count("'") - octv.count(","))
                            alt = local_old.get(letter, T.key_accidentals(key_old)[letter])
                            if acc:
                                alt = {"=": 0, "_": -1, "__": -2, "^": 1, "^^": 2}[acc]
                                local_old[letter] = alt
                            if pending is not None and not acc and written == pending[1]:
                                pitch_old = pending[0]
                            else:
                                pitch_old = written + alt
                            pitch = pitch_old + n
                            L, a2 = spell(pitch, key_new, local_new)
                            ka = T.key_accidentals(key_new)[L]
                            wr = pitch - a2
                            o = (wr - (60 + NAT[L])) // 12
                            txt, marks = (L, "," * (-o)) if o <= 0 else (L.lower(), "'" * (o - 1))
                            cur_alt = local_new.get(L, ka)
                            need = a2 != cur_alt or (pending is not None and a2 != ka)
                            e[1] = ACC[a2] if need else ""
                            if need:
                                local_new[L] = a2
                            e[2], e[3] = txt, marks
                            pending = (pitch_old, written) if tie else None


# ---------------------------------------------------------------- validation
def validate(before_text: str, after_text: str, ops: list[dict], before: "T.Score|None" = None) -> tuple[list[str], dict]:
    """Return (errors, info). errors empty = valid. Uses upstream parse_abc + compare, plus op-specific invariants."""
    errs: list[str] = []
    info: dict = {}
    try:
        a = before or T.parse_abc(before_text)
        b = T.parse_abc(after_text)
    except T.AbcError as e:
        return [f"ABC check failed: {e}"], info
    kinds = [o["op"] for o in ops]
    info["bpm_after"] = b.bpm
    tempo_ok = "SET_TEMPO" in kinds
    structural = {"REPEAT", "CUT", "TRANSPOSE", "WRITE_PHRASE"} & set(kinds)
    if not structural:
        c = T.compare(a, b, T.VOICES, allow_tempo_change=tempo_ok)
        if not c["match"]:
            errs.append("melody or bar grid changed: " + "; ".join(c["differences"]))
    if "WRITE_PHRASE" in kinds and not ({"REPEAT", "CUT", "TRANSPOSE"} & set(kinds)):
        c = T.compare(a, b, ("Vocal",), allow_tempo_change=tempo_ok)
        if not c["match"]:
            errs.append("the Vocal melody changed: " + "; ".join(c["differences"]))
    if "SET_TEMPO" in kinds:
        want = [o["bpm"] for o in ops if o["op"] == "SET_TEMPO"][-1]
        if b.bpm != want:
            errs.append(f"Q: is {b.bpm}, expected {want}")
    secs = float(b.voices["Vocal"].time * 60 / b.bpm)
    info["seconds"] = round(secs, 1)
    if secs > 360:
        errs.append(f"the song would be {secs:.0f} s; YuE2 truncates at 360 s")
    est_tokens = int(len(after_text) * 0.8)
    info["est_tokens"] = est_tokens
    if est_tokens > 4096:
        errs.append(f"the score would be about {est_tokens} YuE tokens; the limit is 4096")
    return errs, info


def apply_ops(text: str, lyr: str, style: str, ops: list[dict]):
    """Apply in order on a copy. Raises OpError. Returns (new_text, new_lyrics, new_style)."""
    doc = Doc(text)
    for i, op in enumerate(ops, 1):
        fn = OPS.get(op["op"])
        if fn is None:
            raise OpError(f"op {i}: unknown op {op['op']!r}")
        try:
            lyr, style = fn(doc, lyr, style, op)
        except OpError as e:
            raise OpError(f"op {i} {op['op']}: {e}")
        except (KeyError, TypeError, ValueError) as e:
            raise OpError(f"op {i} {op['op']}: malformed ({type(e).__name__}: {e})")
    return doc.text(), lyr, style
