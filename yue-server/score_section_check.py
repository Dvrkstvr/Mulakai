"""The checks of a plan's applied REPEAT/CUT ops (F-030), between the score
the bar ops left and the final one. Upstream compare cannot hold here (the
bar grid moves on purpose), so this allows exactly the change the ops imply
and nothing else: upstream accepts the score; its sections are the expected
labels in the expected order; the bar count is the old one plus the repeated
bars minus the cut ones; every bar equals the bar it comes from in each voice
(events, chords included; only a section's last note may lose its tie, the
seam), with the same meter and key; and each section's first note sounds the
pitch it did (a note that kept a tied accidental across the bar line would
change once the tie into it is cut).
"""
from __future__ import annotations

from bisect import bisect_right

import scores  # noqa: F401  (puts the vendored upstream/ on sys.path)
from abc_tools import VOICES, parse_abc
from score_bars import bars_text
from score_check import bar_sums, message
from score_model import Doc
from score_sections import layout


def _key_at(voice, start) -> str:
    times = [t for t, _ in voice.keys]
    return voice.keys[bisect_right(times, start) - 1][1]


def _same(old: list, new: list, seam: bool) -> bool:
    if old == new or not seam:
        return old == new
    untied = [list(e) for e in old]
    notes = [e for e in untied if e[0] == "note"]
    if notes:
        notes[-1][5] = ""
    return untied == new


def _pitch(voice, start, sounding: bool) -> int | None:
    for onset, pitch, length in voice.notes:
        if onset == start or (sounding and onset < start < onset + length):
            return pitch
    return None


def check_sections(mid_abc: str, after_abc: str, ops: list[dict]) -> dict:
    """{ok, problems}; `ops` are the applied REPEAT/CUT ops."""
    if not ops:
        return {"ok": True, "problems": []}
    try:
        mid = parse_abc(mid_abc)
    except ValueError:
        return {"ok": True, "problems": []}  # the bar ops' check (score_check) reports it
    try:
        after = parse_abc(after_abc)
    except ValueError as error:
        return {"ok": False, "problems": [f"ABC check failed: {error}", *map(message, bar_sums(after_abc))]}
    old, new = Doc(mid_abc), Doc(after_abc)
    spans, first = [], 1
    for section in old.sections:
        count = sum(len(g["Vocal"]["bars"]) for g in section["groups"])
        spans.append(range(first, first + count))
        first += count
    order = layout(len(old.sections), ops)
    want = [old.sections[i]["label"] for i in order]
    got = [s["label"] for s in new.sections]
    problems = [] if got == want else [f"the sections are {', '.join(got)}; expected {', '.join(want)}"]
    source = [n for i in order for n in spans[i]]
    if new.nbars() != len(source):
        problems.append(f"the score has {new.nbars()} bars; the section ops should leave {len(source)} "
                        f"(from {old.nbars()})")
        return {"ok": False, "problems": problems}
    ranges = new.section_ranges()
    ends, starts = {b for *_, b in ranges}, {a for _, _, a, _ in ranges}
    differ, moved = [], []
    for n, o in enumerate(source, 1):
        (start, *grid), (was, *old_grid) = after.voices["Vocal"].bars[n - 1], mid.voices["Vocal"].bars[o - 1]
        if (grid != old_grid or _key_at(after.voices["Vocal"], start) != _key_at(mid.voices["Vocal"], was)
                or not all(_same(old.bar(o, v), new.bar(n, v), n in ends) for v in VOICES)):
            differ.append(n)
        if n in starts:
            pitches = [(_pitch(after.voices[v], start, False), _pitch(mid.voices[v], was, True)) for v in VOICES]
            if any(p is not None and q is not None and p != q for p, q in pitches):
                moved.append(n)
    if differ:
        one = len(differ) == 1
        problems.append(f"{bars_text(differ)} {'does' if one else 'do'} not match the "
                        f"{'bar it comes' if one else 'bars they come'} from")
    if moved:
        problems.append(f"the first note of {bars_text(moved)} changes pitch once the tie into it is cut; "
                        "the section before it ends on a tied note spelled by the tie")
    return {"ok": not problems, "problems": problems}
