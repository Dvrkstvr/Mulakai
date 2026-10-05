"""Shared data for the score-agent tests: SP-2's golden cases (10 library
sidecars and the hand-made mutations, with upstream's verdict for each)
copied into tests/data/score_golden.json, the library texts inlined."""
from __future__ import annotations

import json
from pathlib import Path

DATA = Path(__file__).parent / "data"
GOLDEN = json.loads((DATA / "score_golden.json").read_text(encoding="utf-8"))
BY_NAME = {case["name"]: case for case in GOLDEN}


def library(short_id: str) -> str:
    return BY_NAME[f"library:{short_id}"]["text"]


# The 9 library sidecars upstream accepts (0a7cff01 is the planner's own
# output cut at 4,096 tokens and fails).
PARSEABLE = [c["name"].split(":")[1] for c in GOLDEN if c["name"].startswith("library:") and c["ok"]]

CHORDS = library("2c944049")     # 4/4, L:1/32, Q:87, Dm, 65 bars, chords on every bar
METER = library("3820c535")      # header M:2/4, groups switch to M:4/4
SIXTEENTH = library("83921775")  # L:1/16, instrumental (no sung notes), chords
BROKEN = library("0a7cff01")

LYRICS = "[Verse]\nwalking out\ninto the rain\n\n[Chorus]\nhold on\n\n[Chorus]\nhold on\nlet go\n"
STYLE = "dark pop, 90 bpm, F minor, female vocal"

# D-055: 2c944049's chorus (bars 47-54: Dm Dm Bbmaj7 Bbmaj7, twice) only recoloured, as every
# plan in the M0 A/B did: 7ths, 6ths and slash basses on the old roots.
RECOLOURED = {"op": "REHARMONIZE", "from_bar": 47, "to_bar": 54, "chords": [
    {"bar": b, "beat": 1, "root": r, "quality": q, **({"bass": s} if s else {})}
    for b, r, q, s in [(47, "D", "m7", None), (48, "D", "m7", "F"), (49, "Bb", "maj7", None), (50, "Bb", "6", None),
                       (51, "D", "m7", None), (52, "D", "m6", None), (53, "Bb", "maj7", "D"), (54, "Bb", "maj7", None)]]}
RECOLOURED_TEXT = ("REHARMONIZE 47-54 keeps the old root in 8 of 8 bars; change the root in at least one chord "
                   "per 2 bars (bars 47-48, 49-50, 51-52, 53-54 keep every root; a 7th or a slash bass on the "
                   "same root does not count)")
