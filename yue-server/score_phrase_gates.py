"""WRITE_PHRASE's musical sanity gates (SP-2), run on the edited score once
upstream has parsed it and compare has held: a phrase needs at least 4
notes, at least 3 distinct pitches and at least 70% of its notes in the key,
and must not write the same bar 4 times. They catch what parses but is not
a phrase; they do not make it musical (F-026's listen is owed). Notes are
upstream's sounding notes (tied pieces count once, accidentals as upstream
resolves them), the key is the one in force where the phrase starts.
"""
from __future__ import annotations

import json
from collections import Counter

import scores  # noqa: F401  (puts the vendored upstream/ on sys.path)
from abc_tools import NATURAL, key_accidentals

MIN_NOTES = 4
MIN_PITCHES = 3
MIN_IN_KEY = 0.7
MAX_SAME_BAR = 3


def _window(score, op: dict):
    bars = score.voices["Ins"].bars
    first, last = bars[op["start_bar"] - 1], bars[op["start_bar"] + len(op["bars"]) - 2]
    return first[0], last[0] + last[1]


def phrase_gates(score, op: dict) -> list[str]:
    """The reasons `op`'s phrase fails a gate in the edited `score` (upstream's)."""
    begin, end = _window(score, op)
    ins = score.voices["Ins"]
    pitches = [pitch for onset, pitch, _ in ins.notes if begin <= onset < end]
    where = f"WRITE_PHRASE bars {op['start_bar']}-{op['start_bar'] + len(op['bars']) - 1}"
    out = []
    if len(pitches) < MIN_NOTES:
        out.append(f"{where}: the phrase has {len(pitches)} notes; write at least {MIN_NOTES}")
    if pitches and len(set(pitches)) < MIN_PITCHES:
        out.append(f"{where}: the phrase uses {len(set(pitches))} distinct pitches; use at least {MIN_PITCHES}")
    key = [name for onset, name in ins.keys if onset <= begin][-1]
    scale = {(NATURAL[letter] + shift) % 12 for letter, shift in key_accidentals(key).items()}
    in_key = sum(pitch % 12 in scale for pitch in pitches)
    if pitches and in_key < MIN_IN_KEY * len(pitches):
        out.append(f"{where}: {in_key} of {len(pitches)} notes ({in_key / len(pitches):.0%}) are in the key {key}; "
                   f"keep at least {MIN_IN_KEY:.0%} in the key")
    same = max(Counter(json.dumps(bar, sort_keys=True) for bar in _plain(op["bars"])).values())
    if same > MAX_SAME_BAR:
        out.append(f"{where}: the same bar is written {same} times; vary the bars")
    return out


def seam_kept(before, after, op: dict, phrases: list[dict]) -> str | None:
    """compare looks at the Vocal only once a phrase rewrote Ins bars, so this
    checks the one Ins note outside the phrase the edit can move: the first
    one after it, which upstream lets keep a tied accidental across the bar
    line; once the tie into it is cut it must still sound the same pitch."""
    last = op["start_bar"] + len(op["bars"]) - 1
    if any(p["start_bar"] <= last + 1 < p["start_bar"] + len(p["bars"]) for p in phrases):
        return None  # the next bar is another phrase's
    _, end = _window(after, op)
    note = next((n for n in after.voices["Ins"].notes if n[0] >= end), None)
    was = note and next((n for n in before.voices["Ins"].notes if n[0] <= note[0] < n[0] + n[2]), None)
    if note is None or note[0] != end or was is None or was[1] == note[1]:
        return None
    return (f"WRITE_PHRASE bars {op['start_bar']}-{last}: the Ins note at bar {last + 1} changes pitch once the "
            "tie into it is cut; end the phrase a bar earlier or later")


def _plain(bars: list[list[dict]]) -> list[list[tuple[str, float]]]:
    return [[(note["pitch"], float(note["beats"])) for note in bar] for bar in bars]
