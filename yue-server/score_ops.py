"""The M0 score ops (D-018): SET_TEMPO, REHARMONIZE and EDIT_STYLE, applied in
order to a score upstream has accepted. Each op is tried on a copy and kept
only when it applies, so one bad op never half-edits the score; every op gets
a verdict whose reason goes back to the planner on its next attempt.

The style's "NNN bpm" follows the score's Q: (R-018: upstream wants the two
changed together): SET_TEMPO rewrites it or appends one, and an EDIT_STYLE
that names a bpm gets the score's.
"""
from __future__ import annotations

import copy
import re

import scores  # noqa: F401  (puts the vendored upstream/ on sys.path)
from abc_tools import QUALITIES as NATIVE_QUALITIES
from score_bars import bars_text, split_at
from score_model import Doc, OpError

ROOTS = ("C", "C#", "Db", "D", "D#", "Eb", "E", "F", "F#", "Gb", "G", "G#", "Ab", "A", "A#", "Bb", "B")
# Upstream's 15 native qualities; its major ("") is spelled "maj" in the op schema.
QUALITIES = tuple(q or "maj" for q in NATIVE_QUALITIES)
MAX_REHARMONIZE_BARS = 16
BPM_WORD = re.compile(r"\b\d+(\s*bpm)\b", re.IGNORECASE)


def sync_style_bpm(style: str, bpm: int, append: bool) -> str:
    if BPM_WORD.search(style):
        return BPM_WORD.sub(lambda m: f"{bpm}{m.group(1)}", style)
    if not append:
        return style
    return f"{style.rstrip(', ')}, {bpm} bpm" if style.strip() else f"{bpm} bpm"


def chord_text(chord: dict) -> str:
    quality = "" if chord["quality"] == "maj" else chord["quality"]
    return chord["root"] + quality + (f"/{chord['bass']}" if chord.get("bass") else "")


def set_tempo(doc: Doc, style: str, op: dict) -> str:
    doc.set_bpm(op["bpm"])
    return style


def edit_style(doc: Doc, style: str, op: dict) -> str:
    text = op["style"].strip()
    if not text:
        raise OpError("the style is empty")
    return text


def _chords_by_bar(doc: Doc, op: dict) -> dict[int, list[dict]]:
    first, last, total = op["from_bar"], op["to_bar"], doc.nbars()
    if first > last:
        raise OpError(f"from_bar {first} is after to_bar {last}")
    if not (1 <= first and last <= total):
        raise OpError(f"bars {first}-{last} are outside the score (1-{total})")
    if last - first + 1 > MAX_REHARMONIZE_BARS:
        raise OpError(f"covers {last - first + 1} bars; at most {MAX_REHARMONIZE_BARS} at a time")
    by_bar: dict[int, list[dict]] = {}
    for chord in op["chords"]:
        if not first <= chord["bar"] <= last:
            raise OpError(f"a chord at bar {chord['bar']} is outside bars {first}-{last}")
        by_bar.setdefault(chord["bar"], []).append(chord)
    missing = [n for n in range(first, last + 1) if n not in by_bar]
    if missing:
        raise OpError(f"no chord given for {bars_text(missing)}; give a beat-1 chord for every bar {first}-{last}")
    per_quarter = doc.units_per_quarter()
    if per_quarter.denominator != 1:
        raise OpError(f"the score's unit L:1/{doc.unit} is longer than a beat")
    for n, chords in by_bar.items():
        beats = [c["beat"] for c in chords]
        twice = next((b for b in beats if beats.count(b) > 1), None)
        if twice is not None:
            raise OpError(f"bar {n} has two chords on beat {twice}")
        if 1 not in beats:
            raise OpError(f"bar {n} has no beat-1 chord")
        units = doc.units_per_bar(n)
        for beat in beats:
            if (beat - 1) * per_quarter >= units:
                raise OpError(f"bar {n}: beat {beat} is outside the bar ({float(units / per_quarter):g} beats)")
    return by_bar


def reharmonize(doc: Doc, style: str, op: dict) -> str:
    """Replace the Vocal chord symbols of bars from_bar..to_bar; a beat inside
    a note or rest splits it (a note with a tie, so it still sounds once)."""
    per_quarter = int(doc.units_per_quarter())
    for n, chords in _chords_by_bar(doc, op).items():
        events = doc.edit(n, "Vocal")
        events[:] = [e for e in events if e[0] != "chord"]
        for chord in sorted(chords, key=lambda c: -c["beat"]):
            events.insert(split_at(events, (chord["beat"] - 1) * per_quarter), ["chord", chord_text(chord)])
    return style


OPS = {"SET_TEMPO": set_tempo, "REHARMONIZE": reharmonize, "EDIT_STYLE": edit_style}


def apply_ops(abc: str, style: str, ops: list[dict]) -> dict:
    """{abc, style, verdicts}: the edited score and style, one verdict per op."""
    doc, verdicts, kinds = Doc(abc), [], set()
    for index, op in enumerate(ops, 1):
        verdict = {"index": index, "op": op["op"], "ok": False, "reason": None}
        verdicts.append(verdict)
        if op["op"] not in OPS:
            verdict["reason"] = f"unknown op {op['op']!r}"
            continue
        trial = copy.deepcopy(doc)
        try:
            style, doc = OPS[op["op"]](trial, style, op), trial
        except OpError as error:
            verdict["reason"] = str(error)
            continue
        verdict["ok"] = True
        kinds.add(op["op"])
    if kinds & {"SET_TEMPO", "EDIT_STYLE"}:
        style = sync_style_bpm(style, doc.bpm, append="SET_TEMPO" in kinds)
    return {"abc": doc.text(), "style": style, "verdicts": verdicts}
