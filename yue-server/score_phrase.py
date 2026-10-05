"""WRITE_PHRASE (F-026): a short instrument line the planner composed as notes,
written by code into the Ins voice. The planner gives each bar as
[{pitch, beats}]; code owns the ABC: lengths in the score's L: units (a
length upstream cannot write in one piece becomes tied pieces), exact bar
sums against each bar's meter, and the seam (a tie running into the phrase
from the bar before is undone, since the phrase's first note is a new one).
The phrase lands only where the Vocal rests (an overlay, the Vocal never
moves). SP-2 measured that retries only work with numbers, so a refusal
names the beats a bar sums to, or the bars the Vocal sings in and the bars
that are free. Free ABC strings are never accepted (the route's schema).

The Ins voice always exists: upstream refuses a score without both native
voice lines, and /v1/scores/apply refuses such a base before any op runs.
"""
from __future__ import annotations

import re
from fractions import Fraction

from score_bars import decompose, note_count
from score_model import Doc, OpError

# An ABC pitch as upstream's TOKEN reads it (no mixed octave marks) or z.
PITCH = r"^(?:z|(?:\^|_|=)?[A-Ga-g](?:,{1,2}|'{1,2})?)$"
BEATS = (0.5, 1, 1.5, 2, 3, 4)
MAX_BARS = 8
MAX_NOTES = 16
_PARTS = re.compile(r"(\^|_|=)?([A-Ga-gz])([,']*)")


def _runs(numbers: list[int]) -> list[tuple[int, int]]:
    runs: list[list[int]] = []
    for number in numbers:
        if runs and runs[-1][1] == number - 1:
            runs[-1][1] = number
        else:
            runs.append([number, number])
    return [(a, b) for a, b in runs]


def ranges(numbers: list[int]) -> str:
    """[33, 34, 35, 36, 40] -> "33-36, 40"."""
    return ", ".join(f"{a}-{b}" if a != b else str(a) for a, b in _runs(numbers))


def note_events(note: dict, unit: int) -> list:
    """One planner note as bar events in L:1/`unit` units, tied when one
    allowed length cannot hold it (a rest is split, never tied)."""
    units = Fraction(str(note["beats"])) * Fraction(unit, 4)
    if units.denominator != 1:
        raise OpError(f"a {float(note['beats']):g}-beat note does not fit the score's unit L:1/{unit}")
    acc, letter, octave = _PARTS.fullmatch(note["pitch"]).groups()
    pieces = decompose(int(units))
    tie = "" if letter == "z" else "-"
    return [["note", (acc or "") if k == 0 else "", letter, octave, u, tie if k < len(pieces) - 1 else "", str(u)]
            for k, u in enumerate(pieces)]


def _free_runs(doc: Doc, size: int) -> list[str]:
    """Runs of at least `size` bars where the Vocal rests, as "a-b"."""
    free = [b for b in range(1, doc.nbars() + 1) if not note_count(doc.bar(b, "Vocal"))]
    return [ranges(list(range(a, b + 1))) for a, b in _runs(free) if b - a + 1 >= size]


def _problems(doc: Doc, start: int, bars: list[list[dict]]) -> list[str]:
    window = range(start, start + len(bars))
    sung = [b for b in window if note_count(doc.bar(b, "Vocal"))]
    out = []
    if sung:
        free = ", ".join(_free_runs(doc, len(bars))) or f"no {len(bars)} bars in a row"
        out.append(f"the Vocal sings in {'bar' if len(sung) == 1 else 'bars'} {ranges(sung)}; free: {free}")
    for offset, notes in enumerate(bars):
        need = Fraction(doc.units_per_bar(start + offset)) / doc.units_per_quarter()
        got = sum(Fraction(str(note["beats"])) for note in notes)
        if got != need:
            out.append(f"bar {offset + 1} of the phrase (score bar {start + offset}) sums to {float(got):g} beats, "
                       f"the meter needs {float(need):g} (too {'long' if got > need else 'short'} by "
                       f"{float(abs(got - need)):g})")
    return out


def _untie_into(doc: Doc, bar: int) -> None:
    if bar < 2:
        return
    notes = [e for e in doc.bar(bar - 1, "Ins") if e[0] == "note"]
    if notes and notes[-1][5] == "-":
        doc.edit(bar - 1, "Ins")
        notes[-1][5] = ""


def write_phrase(doc: Doc, style: str, op: dict) -> str:
    """Replace the Ins bars start_bar.. with the phrase; the style is
    left alone here (apply_ops appends the instrument after every op)."""
    start, bars = op["start_bar"], op["bars"]
    last, total = start + len(bars) - 1, doc.nbars()
    if last > total:
        raise OpError(f"a {len(bars)}-bar phrase at bar {start} runs past the last bar ({total})")
    problems = _problems(doc, start, bars)
    if problems:
        raise OpError("; ".join(problems))
    written = [[e for note in notes for e in note_events(note, doc.unit)] for notes in bars]
    _untie_into(doc, start)
    for offset, events in enumerate(written):
        bar = doc.edit(start + offset, "Ins")
        bar[:] = [e for e in bar if e[0] == "key"] + events
    return style


def add_instrument(style: str, instrument: str) -> str:
    """The style with the instrument appended, unless it already names it."""
    name = instrument.strip()
    if not name or name.lower() in style.lower():
        return style
    return f"{style.rstrip(', ')}, {name}" if style.strip() else name
