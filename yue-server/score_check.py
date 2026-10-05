"""Checks around upstream's parser and comparer: a score's verdict (upstream's
own ok/error text), the per-bar unit sums of every bar that does not fill its
meter (upstream stops at the first, often with "event after the measure
end", and SP-2 measured that retries only work with numbers), and an edit's
checks: upstream compare (melody and bar grid unchanged, tempo only for
SET_TEMPO; the Vocal only when a WRITE_PHRASE rewrote Ins bars; after a
TRANSPOSE against the old score moved by n, K: names included), Q: as
asked, no chord changed outside the REHARMONIZE bars (compare does not look
at chords; chords compare by pitch class), each REHARMONIZE moves at least one root per 2 bars
(score_roots.py, D-055), and, only once all of that holds (SP-2's order),
each WRITE_PHRASE's sanity gates (score_phrase_gates.py).
"""
from __future__ import annotations

import re
from bisect import bisect_right
from fractions import Fraction

import scores  # noqa: F401  (puts the vendored upstream/ on sys.path)
from abc_tools import TOKEN, VOICES, compare, parse_abc
from score_bars import bars_text
from score_model import Doc
from score_phrase_gates import phrase_gates, seam_kept
from score_roots import kept_roots
from score_transpose import chord_class, shifted


def _units(body: str) -> int | None:
    total, cursor, body = 0, 0, body.replace(" ", "")
    while cursor < len(body):
        match = TOKEN.match(body, cursor)
        if match is None:
            return None
        cursor = match.end()
        if match.group("note") is not None:
            total += int(match.group("duration") or "1")
    return total


def _bar_units(meter: str, unit: int) -> int | None:
    match = re.fullmatch(r"([1-9][0-9]*)/([1-9][0-9]*)", meter)
    value = Fraction(int(match.group(1)) * unit, int(match.group(2))) if match else None
    return int(value) if value is not None and value.denominator == 1 else None


def bar_sums(abc: str) -> list[dict]:
    """{bar, voice, units, expected} for each bar whose lengths do not add up to
    its meter; bars upstream's tokens cannot read are skipped."""
    lines = abc.splitlines()
    unit = re.fullmatch(r"L:1/([1-9][0-9]*)", lines[3]) if len(lines) > 8 else None
    if unit is None or not lines[2].startswith("M:"):
        return []
    meters = {name: lines[2][2:] for name in VOICES}
    counts = {name: 0 for name in VOICES}
    out, voice = [], None
    for line in lines[8:]:
        if line.startswith("V: ") and line[3:] in VOICES:
            voice = line[3:]
        elif voice is not None and line.startswith("M:"):
            meters[voice] = line[2:]
        elif voice is not None and not line.startswith(("K:", "% ")):
            for body in line.removesuffix("|").split("|"):
                body = body.strip()
                rests = re.fullmatch(r"Z([2-4])?", body)
                counts[voice] += int(rests.group(1) or 1) if rests else 1 if body else 0
                units, expected = _units(body), _bar_units(meters[voice], int(unit.group(1)))
                if body and not rests and None not in (units, expected) and units != expected:
                    out.append({"bar": counts[voice], "voice": voice, "units": units, "expected": expected})
            voice = None
    return out


def message(bar: dict) -> str:
    gap = bar["units"] - bar["expected"]
    return (f"bar {bar['bar']} ({bar['voice']}): {bar['units']} of {bar['expected']} units, "
            f"too {'long' if gap > 0 else 'short'} by {abs(gap)}")


def verdict(abc: str) -> dict:
    """{ok, error, bar_sums, messages, chords_present}; error is upstream's text."""
    try:
        score = parse_abc(abc)
    except ValueError as error:  # the vendored AbcError is a ValueError
        sums = bar_sums(abc)
        return {"ok": False, "error": str(error), "bar_sums": sums, "messages": [message(s) for s in sums],
                "chords_present": None}
    return {"ok": True, "error": None, "bar_sums": [], "messages": [],
            "chords_present": bool(score.voices["Vocal"].chords)}


def _chords_per_bar(score) -> dict[int, list]:
    starts = [start for start, _, _ in score.voices["Vocal"].bars]
    out: dict[int, list] = {}
    for onset, chord in score.voices["Vocal"].chords:
        out.setdefault(bisect_right(starts, onset), []).append((onset, chord_class(chord)))
    return out


def check_edit(before_abc: str, after_abc: str, ops: list[dict]) -> dict:
    """{ok, problems, differences} for an edit made by `ops` (the applied ones);
    differences are upstream compare's own lines."""
    before = parse_abc(before_abc)
    try:
        after = parse_abc(after_abc)
    except ValueError as error:
        return {"ok": False, "problems": [f"ABC check failed: {error}", *map(message, bar_sums(after_abc))],
                "differences": []}
    tempos = [op["bpm"] for op in ops if op["op"] == "SET_TEMPO"]
    phrases = [op for op in ops if op["op"] == "WRITE_PHRASE"]
    voices = ("Vocal",) if phrases else VOICES
    shifts = [op["semitones"] for op in ops if op["op"] == "TRANSPOSE"]
    before = shifted(before, shifts[0]) if shifts else before  # what every check below expects
    differences = compare(before, after, voices, allow_tempo_change=bool(tempos))["differences"]
    problems = []
    if tempos and after.bpm != tempos[-1]:
        problems.append(f"Q: is {after.bpm}, expected {tempos[-1]}")
    if shifts and after.voices["Vocal"].keys != before.voices["Vocal"].keys:
        named = [", ".join(k for _, k in s.voices["Vocal"].keys) for s in (after, before)]
        problems.append(f"TRANSPOSE {shifts[0]:+d}: the K: lines name {named[0]}, expected {named[1]}")
    window = {n for op in ops if op["op"] == "REHARMONIZE" for n in range(op["from_bar"], op["to_bar"] + 1)}
    old, new = _chords_per_bar(before), _chords_per_bar(after)
    stray = sorted(n for n in old.keys() | new.keys() if n not in window and old.get(n) != new.get(n))
    if stray:
        problems.append(f"chords changed outside the REHARMONIZE bars: {bars_text(stray)}")
    reharms = [op for op in ops if op["op"] == "REHARMONIZE"]
    old_doc = Doc(before_abc) if reharms else None
    problems += [text for op in reharms if (text := kept_roots(old_doc, op))]
    problems += [text for op in phrases if (text := seam_kept(before, after, op, phrases))]
    if not problems and not differences:
        problems += [text for op in phrases for text in phrase_gates(after, op)]
    return {"ok": not problems and not differences, "problems": problems, "differences": differences}
