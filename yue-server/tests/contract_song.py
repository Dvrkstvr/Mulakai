"""The contract song (read-ok.json's score, 65 bars at 87 BPM, 179.3 s) as a
chords run would hear a take of it: one downbeat per score bar and the score's
own chord per bar, in the tracker's lab files. The chat e2e's fake yue-server
replays its grid and bar-time replies (transcription-grid-contract,
scores-bars-contract) so the chat's strip has bars to mark (CL-8b)."""
from __future__ import annotations

import json
import re

from contract import DIR
from splice_grid import score_bars

ROOT = re.compile(r"^[A-G][#b]?")


def contract_abc() -> str:
    return json.loads((DIR / "read-ok.json").read_text(encoding="utf-8"))["request"]["body"]["abc"]


def seconds() -> float:
    return json.loads((DIR / "read-ok.json").read_text(encoding="utf-8"))["response"]["body"]["facts"]["header"]["seconds"]


def _label(chord: str | None) -> str:
    if chord is None:
        return "N"
    root = ROOT.match(chord).group()
    rest = chord[len(root):]
    return f"{root}:{'min' if rest.startswith('m') and not rest.startswith('maj') else 'maj'}"


def labs() -> tuple[str, str, float]:
    """(downbeat.lab, chord.lab, duration): a downbeat every bar from 0.3 s at the score's tempo."""
    sb = score_bars(contract_abc())
    bar = 4 * 60 / sb.bpm
    down = [round(0.3 + i * bar, 4) for i in range(len(sb.chords))]
    end = seconds()
    rows = [(t, down[i + 1] if i + 1 < len(down) else end, _label(c)) for i, (t, c) in enumerate(zip(down, sb.chords))]
    return ("".join(f"{t}\n" for t in down), "".join(f"{a}\t{b}\t{c}\n" for a, b, c in rows), end)


def grid() -> dict:
    """The grid GET /v1/transcriptions/{id}/grid answers for those labs (splice_grid.read_grid's shape)."""
    down, chords, end = labs()
    rows = [[float(a), float(b), c] for a, b, c in (line.split("\t") for line in chords.splitlines())]
    return {"grid_v": 1, "source": "tracked", "downbeats": [float(t) for t in down.split()], "chords": rows,
            "duration": float(end)}
