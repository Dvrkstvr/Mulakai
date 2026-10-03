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
