"""What the planner is told about a score instead of the raw ABC (SP-2's v2
prompt): the header, the key's note names, sections with bar ranges, the
lyric blocks numbered with their occurrence, and one BAR MAP line per bar
(`n: chord@beat ... | V:sung/rest | I:<Ins notes>`) with a line wherever the
meter changes. Duration is the bars' lengths over Q:, as YuE2 plays them.
"""
from __future__ import annotations

from fractions import Fraction

import scores  # noqa: F401  (puts the vendored upstream/ on sys.path)
from abc_tools import key_accidentals, parse_abc
from score_bars import chord_offsets, note_count
from score_lyrics import block_facts
from score_model import Doc


def seconds(score) -> float:
    vocal = score.voices["Vocal"]
    return round(float(sum(length for _, length, _ in vocal.bars) * 60 / score.bpm), 1)


def key_notes(key: str) -> str:
    accidentals = key_accidentals(key)
    order = "CDEFGAB"
    start = order.index(key[0])
    return " ".join(letter + {1: "#", -1: "b", 0: ""}[accidentals[letter]]
                    for letter in order[start:] + order[:start])


def lyric_blocks(lyrics: str) -> list[dict]:
    """Blocks split on blank lines, numbered, each with its tag and its
    occurrence among blocks of its kind ([Verse 2] is a verse): score_lyrics.py."""
    return block_facts(lyrics)


def _number(value: Fraction) -> int | float:
    return int(value) if value.denominator == 1 else float(value)


def bar_map(doc: Doc) -> list[str]:
    per_quarter = doc.units_per_quarter()
    lines, meter = [], None
    for index, label, first, last in doc.section_ranges():
        lines.append(f"-- S{index} {label} --")
        for n in range(first, last + 1):
            if doc.meter(n) != meter:
                meter = doc.meter(n)
                lines.append(f"(meter M:{meter[0]}/{meter[1]} from here: one bar = {doc.units_per_bar(n)} units)")
            vocal = doc.bar(n, "Vocal")
            chords = " ".join(f"{chord}@{_number(offset / per_quarter + 1)}"
                              for offset, chord in chord_offsets(vocal)) or "-"
            lines.append(f"{n}: {chords} | V:{'sung' if note_count(vocal) else 'rest'} | "
                         f"I:{note_count(doc.bar(n, 'Ins'))}")
    return lines


def read_facts(abc: str, lyrics: str) -> dict:
    """The planner's facts for a score upstream accepts."""
    score, doc = parse_abc(abc), Doc(abc)
    return {
        "header": {"meter": doc.header[2][2:], "unit": doc.header[3][2:], "bpm": score.bpm, "key": doc.key,
                   "bars": doc.nbars(), "seconds": seconds(score),
                   "units_per_quarter": _number(doc.units_per_quarter())},
        "key_notes": key_notes(doc.key),
        "sections": [{"index": i, "label": label, "from_bar": a, "to_bar": b}
                     for i, label, a, b in doc.section_ranges()],
        "lyric_blocks": lyric_blocks(lyrics),
        "bar_map": bar_map(doc),
    }
