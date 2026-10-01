"""Each score section's start in seconds, for placing read lyrics by time
(PLAN.md "Section start times with a transcription").

SheetSage2 writes a `% label` comment before each section's measures, and
score bar i is the audio's downbeat i in downbeat.lab. The downbeats are
used rather than the score's tempo grid, which runs a bar late when
SheetSage2 starts the score on a fragment of a bar. Bars are counted by the
vendored parser's rules; abc_tools is upstream's and records no sections.
"""
from __future__ import annotations

import re
from pathlib import Path

REST = re.compile(r"Z([2-4])?")
TEMPO = re.compile(r"^Q:1/4=(\d+)\s*$", re.M)
METER = re.compile(r"^M:(\d+)/(\d+)\s*$", re.M)


def section_bars(abc: str) -> list[tuple[str, int]]:
    """(label, 0-based first bar) for each `% label` comment, in score order."""
    sections: list[tuple[str, int]] = []
    bar, voice = 0, None
    for line in abc.splitlines():
        if line.startswith("% "):
            sections.append((line[2:].strip(), bar))
        elif line.startswith("V:"):
            voice = (line[2:].split() or [None])[0]
        elif voice == "Vocal" and line.endswith("|"):
            for measure in line[:-1].split("|"):
                if rest := REST.fullmatch(measure.strip()):
                    bar += int(rest.group(1) or 1)
                elif measure.strip():
                    bar += 1
    return sections


def bar_seconds(abc: str) -> float | None:
    """One bar on the score's tempo grid, for sections past the last downbeat."""
    tempo, meter = TEMPO.search(abc), METER.search(abc)
    if not tempo or not meter:
        return None
    quarters = int(meter.group(1)) * 4 / int(meter.group(2))
    return quarters * 60 / int(tempo.group(1))


def read_downbeats(path: Path) -> list[float]:
    """downbeat.lab's first column; empty when the file is missing or unreadable."""
    try:
        return [float(line.split()[0]) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
    except (OSError, ValueError, IndexError):
        return []


def section_starts(abc: str, downbeats: list[float]) -> list[dict] | None:
    """[{label, bar, seconds}] per section, or None when there is nothing to anchor it to."""
    sections = section_bars(abc)
    if not sections or not downbeats:
        return None
    grid = bar_seconds(abc)
    starts = []
    for label, bar in sections:
        if bar < len(downbeats):
            seconds = downbeats[bar]
        elif grid:
            seconds = downbeats[-1] + (bar - len(downbeats) + 1) * grid
        else:
            return None
        starts.append({"label": label, "bar": bar, "seconds": round(seconds, 2)})
    return starts
