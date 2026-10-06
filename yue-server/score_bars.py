"""Bar-level events of a native YuE2 score, for the score model and ops.

An event is ["chord", text], ["key", text], ["Z"] (a full-bar rest) or
["note", accidental, letter, octave marks, units, tie, written length];
lengths are in the score's L: units.
"""
from __future__ import annotations

import scores  # noqa: F401  (puts the vendored upstream/ on sys.path)
from abc_tools import DURATIONS, TOKEN

ALLOWED = sorted(DURATIONS, reverse=True)
FULL_REST = [["Z"]]


def bars_text(numbers: list[int]) -> str:
    return ("bar " if len(numbers) == 1 else "bars ") + ", ".join(map(str, numbers))


def decompose(units: int) -> list[int]:
    """`units` as upstream's allowed lengths, longest first (27 -> 24 + 3)."""
    out = []
    while units > 0:
        out.append(next(d for d in ALLOWED if d <= units))
        units -= out[-1]
    return out


def parse_bar(body: str) -> list:
    if body == "Z":
        return [["Z"]]
    events = []
    for match in TOKEN.finditer(body.replace(" ", "")):
        if match.group("chord") is not None:
            events.append(["chord", match.group("chord")])
        elif match.group("key") is not None:
            events.append(["key", match.group("key")])
        else:
            written = match.group("duration")
            events.append(["note", match.group("acc") or "", match.group("note"), match.group("oct"),
                           int(written or "1"), match.group("tie"), written])
    return events


def emit_bar(events: list) -> str:
    out = []
    for e in events:
        if e[0] == "chord":
            out.append(f'"{e[1]}"')
        elif e[0] == "key":
            out.append(f"[K:{e[1]}]")
        elif e[0] == "note":
            out.append(f"{e[1]}{e[2]}{e[3]}{e[6]}{e[5]}")
    return "".join(out)


def emit_line(bars: list[list]) -> str:
    parts, rests = [], 0
    for bar in bars + [None]:
        if bar == FULL_REST:
            rests += 1
            continue
        if rests:
            parts.append("Z" if rests == 1 else f"Z{rests}")
            rests = 0
        if bar is not None:
            parts.append(emit_bar(bar))
    return "|".join(parts) + "|"


def note_count(events: list) -> int:
    return sum(1 for e in events if e[0] == "note" and e[2] != "z")


def chord_offsets(events: list) -> list[tuple[int, str]]:
    """(units from the bar start, chord) for each chord symbol in the bar."""
    out, position = [], 0
    for e in events:
        if e[0] == "chord":
            out.append((position, e[1]))
        elif e[0] == "note":
            position += e[4]
    return out


def split_at(events: list, offset: int) -> int:
    """Make `offset` an event boundary, splitting a note (tied) or a rest into
    allowed lengths; returns the index to insert at."""
    position = 0
    for i, e in enumerate(events):
        if e[0] != "note":
            continue
        if position == offset:
            return i
        if position < offset < position + e[4]:
            tie = "" if e[2] == "z" else "-"
            head = [["note", e[1] if k == 0 else "", e[2], e[3], u, tie, str(u)]
                    for k, u in enumerate(decompose(offset - position))]
            tail = decompose(position + e[4] - offset)
            tail = [["note", "", e[2], e[3], u, e[5] if k == len(tail) - 1 else tie, str(u)]
                    for k, u in enumerate(tail)]
            events[i:i + 1] = head + tail
            return i + len(head)
        position += e[4]
    return len(events)
