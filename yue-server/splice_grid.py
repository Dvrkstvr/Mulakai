"""Score bar -> audio seconds for one take, from SheetSage2's downbeats and chord
rows (SP-3 `analyze.py` / SP-4 `sp4lib.Grid`, ported). The tracker's audio bar j
is score bar j - o, with the integer offset o (-4..4) that best matches the
score's per-bar chord roots on the bars the caller names (the unedited ones, so
an edit cannot buy its own alignment). A take tracked at half bars is thinned to
every second downbeat first. A grid is kept as JSON (`grid_v: 1`), the shape
of the server's `${versionId}.grid.json` sidecar (D-107).
"""
from __future__ import annotations

import json
import math
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path

import numpy as np

import scores  # noqa: F401  (puts the vendored upstream/ on sys.path)
from abc_tools import parse_abc
from score_roots import ROOT, pitch_class

GRID_V = 1
OFFSETS = range(-4, 5)


class GridError(ValueError):
    pass


@dataclass(frozen=True)
class ScoreBars:
    chords: list  # the longest-sounding chord per bar (carried over a bar without one)
    bpm: int
    four_four: bool


def score_bars(abc: str) -> ScoreBars:
    parsed = parse_abc(abc)
    voice = parsed.voices["Vocal"]
    events = sorted(voice.chords, key=lambda c: c[0])
    chords: list = []
    for start, length, _ in voice.bars:
        inside = [(t, c) for t, c in events if start <= t < start + length]
        if not inside:
            chords.append(chords[-1] if chords else None)
            continue
        cover: dict = defaultdict(float)
        for k, (t, c) in enumerate(inside):
            cover[c] += float((inside[k + 1][0] if k + 1 < len(inside) else start + length) - t)
        chords.append(max(cover, key=cover.get))
    return ScoreBars(chords, parsed.bpm, all(meter == (4, 4) for _, _, meter in voice.bars))


def _root(label: str | None) -> int | None:
    if label in (None, "N"):
        return None
    match = ROOT.match(label.split(":")[0])
    return pitch_class(match.group()) if match else None


def bar_chords(downbeats: list[float], rows: list, duration: float) -> list:
    out = []
    for j, t0 in enumerate(downbeats):
        t1 = downbeats[j + 1] if j + 1 < len(downbeats) else duration
        cover: dict = defaultdict(float)
        for a, b, label in rows:
            overlap = min(b, t1) - max(a, t0)
            if overlap > 0 and label != "N":
                cover[label] += overlap
        out.append(max(cover, key=cover.get) if cover else None)
    return out


def agree(intended: list, audio: list, o: int, idx) -> float:
    """Share of score bars `idx` whose chord root matches the audio bar at offset o (nan if none)."""
    hits = n = 0
    for i in idx:
        j = i + o
        if not 0 <= j < len(audio) or intended[i] is None:
            continue
        n += 1
        heard = _root(audio[j])
        hits += heard is not None and heard == _root(intended[i])
    return hits / n if n else float("nan")


def best_offset(intended: list, audio: list, idx) -> int:
    return max(OFFSETS, key=lambda o: (np.nan_to_num(agree(intended, audio, o, idx), nan=-1), -abs(o)))


@dataclass(frozen=True)
class Fit:
    downbeats: list
    duration: float
    offset: int
    thinned: bool
    root: float
    bars: int
    beat: float  # the score's quarter note, s
    chords: tuple = ()  # the tracker's chord rows [t0, t1, label]

    def t(self, i: int) -> float:
        """Audio time at the start of score bar i (0-based); i == bars is the end of the song."""
        j = max(i + self.offset, 0) if i >= 0 else i + self.offset
        return self.duration if j >= len(self.downbeats) else self.downbeats[j]


def fit(grid: dict, abc: str, fit_idx=None) -> Fit:
    sb = score_bars(abc)
    idx = list(range(len(sb.chords)) if fit_idx is None else fit_idx)
    down, rows, duration = list(grid["downbeats"]), grid["chords"], float(grid["duration"])
    thinned = False
    inner = np.diff(down[1:-1])
    if len(inner) and 4 * 60 / float(np.median(inner)) / sb.bpm > 1.7:  # half bars on a 4/4 score
        best = None
        for k in (0, 1):
            audio = bar_chords(down[k::2], rows, duration)
            r = agree(sb.chords, audio, best_offset(sb.chords, audio, idx), idx)
            if best is None or r > best[0]:
                best = (r, k)
        down, thinned = down[best[1]::2], True
    audio = bar_chords(down, rows, duration)
    o = best_offset(sb.chords, audio, idx)
    return Fit(down, duration, o, thinned, agree(sb.chords, audio, o, idx), len(sb.chords), 60.0 / sb.bpm,
               tuple(tuple(r) for r in rows))


def validate_grid(grid) -> dict:
    """A grid from the server's cache is checked before it is trusted."""
    try:
        down, rows, duration = grid["downbeats"], grid["chords"], float(grid["duration"])
        ok = grid.get("grid_v") == GRID_V and len(down) >= 2 and all(
            isinstance(t, (int, float)) and math.isfinite(t) for t in down)
        ok = ok and all(b > a for a, b in zip(down, down[1:])) and duration >= down[-1]
        ok = ok and all(len(r) == 3 and isinstance(r[2], str) and r[1] >= r[0] for r in rows)
    except (KeyError, TypeError, ValueError):
        ok = False
    if not ok:
        raise GridError("not a grid_v 1 grid (increasing downbeats, chord rows [t0, t1, label], duration)")
    return grid


def read_grid(out: Path) -> dict:
    """The grid of a SheetSage2 output folder (downbeat.lab, chord.lab, result.json)."""
    down = [float(line.split()[0]) for line in (out / "downbeat.lab").read_text(encoding="utf-8").splitlines()
            if line.strip()]
    rows = []
    for line in (out / "chord.lab").read_text(encoding="utf-8").splitlines():
        parts = line.rstrip("\n").split("\t")
        if len(parts) >= 3:
            rows.append([float(parts[0]), float(parts[1]), parts[2]])
    duration = json.loads((out / "result.json").read_text(encoding="utf-8"))["duration_seconds"]
    return validate_grid({"grid_v": GRID_V, "source": "tracked", "downbeats": down, "chords": rows,
                          "duration": float(duration)})


def track(transcriber, source: Path, out: Path, *, cancelled, on_progress) -> dict:
    """The real tracker: SheetSage2 with chords kept and no piano render (D-131's flag)."""
    out.mkdir(parents=True, exist_ok=True)
    transcriber.run(source, out, cancelled=cancelled, on_progress=on_progress, chords=True)
    return read_grid(out)
