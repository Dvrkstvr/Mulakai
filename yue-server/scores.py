"""Checks a supplied score (a cover's `abc`) before it is queued, so a bad one
is a 422 rather than a failed job (PLAN.md, "yue-server transcription
decisions"). The parser is upstream's, vendored in upstream/.

`cot="melody"` does not strip chord symbols itself, so they are stripped
here; strip_chords checks every note, onset, meter and tempo survives.
"""
from __future__ import annotations

import sys
from pathlib import Path

UPSTREAM = str(Path(__file__).parent / "upstream")
if UPSTREAM not in sys.path:
    sys.path.insert(0, UPSTREAM)
from abc_tools import parse_abc, strip_chords  # noqa: E402  (vendored; needs the path above)


class ScoreError(ValueError):
    pass


def prepare_score(abc: str, cot: str) -> str:
    """The score to generate from: validated, and chord-free for `melody`."""
    try:
        score = parse_abc(abc)
        if cot == "melody" and any(voice.chords for voice in score.voices.values()):
            abc = strip_chords(abc)
    except ValueError as error:  # the vendored AbcError is a ValueError
        raise ScoreError(f"Not a score in YuE2's native two-voice ABC: {error}") from None
    return abc
