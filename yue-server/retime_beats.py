"""Re-time a transcription (PLAN.md "Re-time a Transcription", SP-8): correct
SheetSage2's saved beat list so the same saved outputs rebuild into a score at
half time, double time or a named BPM. Pure Python; run by retime_cli.py inside
SheetSage2's venv and by yue-server's tests.

A row is `[seconds, beat_in_bar, numerator, denominator]`, as SheetSage2 writes
`notation/song_beats.txt`. Rules from SP-8: a leading row whose meter is not the
song's main meter (a pickup stub, e.g. 1/8) is kept as is, never halved and never
given a midpoint (one flipped the whole header to M:1/8); a BPM grid is anchored
once at the first downbeat (re-anchoring at each section added odd bars).
"""
from __future__ import annotations

import statistics

MODES = ("half", "double", "bpm")


class BeatError(ValueError):
    pass


def read_rows(text: str) -> list[list]:
    rows = []
    for number, line in enumerate(text.splitlines(), 1):
        if not line.strip():
            continue
        cells = line.split("\t")
        if len(cells) < 4:
            raise BeatError(f"beats line {number}: expected 4 columns")
        rows.append([float(cells[0]), int(cells[1]), int(cells[2]), int(cells[3])])
    if len(rows) < 2:
        raise BeatError("the beat list has fewer than 2 beats")
    return rows


def write_rows(rows: list[list]) -> str:
    return "".join(f"{t:.3f}\t{b}\t{n}\t{d}\n" for t, b, n, d in rows)


def read_bpm(rows: list[list]) -> float:
    """The tempo the beat list reads as: 60 / the median gap between beats."""
    return 60.0 / statistics.median(b[0] - a[0] for a, b in zip(rows, rows[1:]))


def renumber(rows: list[list]) -> list[list]:
    """beat_in_bar cycles 1..numerator and restarts at 1 whenever the meter changes."""
    out, previous, n = [], None, 0
    for t, _, num, den in rows:
        n = 1 if (num, den) != previous else n % num + 1
        previous = (num, den)
        out.append([t, n, num, den])
    return out


def lead_in(rows: list[list]) -> int:
    """How many leading rows are a pickup stub in another meter than the song's main one."""
    main = statistics.mode((r[2], r[3]) for r in rows)
    k = 0
    while (rows[k][2], rows[k][3]) != main:
        k += 1
    return k


def _first_downbeat(rows: list[list], start: int) -> int:
    return next((i for i in range(start, len(rows)) if rows[i][1] == 1), start)


def half(rows: list[list]) -> list[list]:
    """Every 2nd beat from the first downbeat; beats before it stay in phase with it."""
    k = lead_in(rows)
    i0 = _first_downbeat(rows, k)
    pickup = rows[k:i0]
    return renumber(rows[:k] + pickup[len(pickup) % 2::2] + rows[i0::2])


def double(rows: list[list]) -> list[list]:
    """A midpoint between every two beats of the same meter."""
    out = []
    for a, b in zip(rows, rows[1:]):
        out.append(a)
        if (a[2], a[3]) == (b[2], b[3]):
            out.append([(a[0] + b[0]) / 2, 0, a[2], a[3]])
    out.append(rows[-1])
    return renumber(out)


def regular(rows: list[list], bpm: float) -> list[list]:
    """A regular grid at `bpm` from the first downbeat to the last detected beat; the
    beats before the first downbeat are kept, and the grid's first beat is beat 1."""
    k = lead_in(rows)
    i0 = _first_downbeat(rows, k)
    num, den = rows[i0][2], rows[i0][3]
    t, end, step = rows[i0][0], rows[-1][0], 60.0 / bpm
    grid = []
    while t < end + step * 0.75:
        grid.append([t, 0, num, den])
        t += step
    return renumber(rows[:i0]) + [[g[0], i % num + 1, num, den] for i, g in enumerate(grid)]


def transform(rows: list[list], mode: str, bpm: float | None = None) -> list[list]:
    if mode == "half":
        return half(rows)
    if mode == "double":
        return double(rows)
    if mode == "bpm":
        if not bpm or bpm <= 0:
            raise BeatError("mode bpm needs a positive bpm")
        return regular(rows, bpm)
    raise BeatError(f"unknown mode {mode!r}")
