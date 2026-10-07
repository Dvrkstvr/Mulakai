"""POST /v1/scores/bars (chat C1, D-174; Q-120): a score's bar start times on a
take's downbeat grid, through the splice's own fit (splice_grid.fit), so the
chat's strip and the splice cannot disagree on where a bar starts.

The fit maps score bar i to the tracker's downbeat i + offset. Where that
lands outside the downbeats the splice clamps (Fit.t), which repeats times:
with a negative offset the first bars all start at the first downbeat, and a
score longer than the audio puts every bar past the last downbeat at the
song's end. The strip needs strictly increasing starts, so this reply states
its own rule for those bars:

- a bar before the first downbeat starts one median bar length back per bar,
  clamped at 0; bars that still meet at 0 share the audio's first seconds
  evenly (bar 1 of a take whose tracker missed its first downbeat starts at 0);
- a bar past the last downbeat is not in the audio: it is not timed, so
  `starts` can be shorter than `bars` (the score's count), and `end` closes
  the last timed bar.

Every start inside the downbeats is the fit's own (Fit.t).
"""
from __future__ import annotations

import math

import numpy as np
from fastapi import HTTPException

from splice_grid import Fit, GridError, fit, validate_grid


def audio_starts(f: Fit) -> tuple[list[float], float]:
    """(strictly increasing starts of the score bars the audio holds, the end of the last one)."""
    down = f.downbeats
    bar = float(np.median(np.diff(down))) if len(down) > 1 else 0.0
    end = round(f.t(f.bars), 4)
    starts: list[float] = []
    for i in range(f.bars):
        j = i + f.offset
        if j >= len(down):
            break
        t = down[j] if j >= 0 else max(0.0, down[0] + j * bar)
        starts.append(round(t, 4))
    starts = [t for t in starts if t < end]
    first = next((k for k, t in enumerate(starts) if t > 0), len(starts))
    if first > 1 and first < len(starts):  # several bars meet at 0: they share 0 .. the first later start
        starts[:first] = [round(starts[first] * k / first, 4) for k in range(first)]
    elif first > 1:  # every bar lies before the audio: none is in it
        starts = []
    return starts, end


def bar_times(abc: str, grid: dict) -> dict:
    """{offset, starts, end, agreement, bars}: score bar i (0-based) starts at starts[i] (bars past the audio are
    left out); end closes the last timed bar; agreement is the fit's chord-root agreement (null when no bar could
    be compared); bars is the score's count."""
    try:
        validate_grid(grid)
    except GridError as error:
        raise HTTPException(422, {"code": "bad_grid", "message": str(error)}) from None
    try:
        f = fit(grid, abc)
    except (ValueError, KeyError) as error:  # AbcError is a ValueError
        raise HTTPException(422, {"code": "bad_score", "message": f"not a native two-voice score: {error}"}) from None
    if f.bars == 0:
        raise HTTPException(422, {"code": "bad_score", "message": "the score has no bars"})
    starts, end = audio_starts(f)
    if not starts:
        raise HTTPException(422, {"code": "bad_grid", "message": "none of the score's bars falls inside the audio"})
    return {"offset": f.offset, "starts": starts, "end": end,
            "agreement": None if math.isnan(f.root) else round(f.root, 4), "bars": f.bars}
