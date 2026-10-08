"""Fit the transcription's melody MIDI to a re-timed beat grid (SP-8). SheetSage2
snaps every note onto a fixed grid of SUBBEAT_DIVISION (4) subbeats per beat and
raises when a note collapses to nothing, which a slower grid (half time, a lower
BPM) makes common. This does the same snap first and repairs what the builder
would refuse: a note that collapses is stretched to one subbeat, or dropped when
the next subbeat is taken; an overlap shortens the earlier note. The count of
dropped notes is reported, never hidden (D-210).

Needs numpy and pretty_midi: run inside SheetSage2's venv (retime_cli.py) or with
requirements-test.txt.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass
class Fit:
    notes: int = 0
    kept: int = 0
    dropped: int = 0
    stretched: int = 0


def fit_midi(src: Path, dst: Path, beat_times: list[float], division: int = 4) -> Fit:
    import numpy as np
    import pretty_midi

    beats = np.asarray(beat_times, dtype=float)
    n = len(beats)
    subbeats = np.interp(np.arange(division * (n - 1) + 1) / float(division), np.arange(n), beats)
    bounds = (subbeats[:-1] + subbeats[1:]) / 2
    last = len(subbeats) - 1
    midi = pretty_midi.PrettyMIDI(str(src))
    fit = Fit()
    for instrument in midi.instruments:
        placed: list[list[int]] = []
        for note in sorted(instrument.notes, key=lambda x: (x.start, x.end, x.pitch)):
            fit.notes += 1
            a = min(max(int(np.searchsorted(bounds, note.start)), 0), last)
            b = min(max(int(np.searchsorted(bounds, note.end)), 0), last)
            stretched = b <= a
            if stretched:
                if a + 1 > last:
                    fit.dropped += 1
                    continue
                b = a + 1
            if placed and a < placed[-1][1]:
                if a <= placed[-1][0]:  # it would erase the earlier note
                    fit.dropped += 1
                    continue
                placed[-1][1] = a
            fit.stretched += stretched
            placed.append([a, b, note.pitch, note.velocity])
        instrument.notes = [pretty_midi.Note(velocity=v, pitch=p, start=float(subbeats[a]), end=float(subbeats[b]))
                            for a, b, p, v in placed]
        fit.kept += len(placed)
    midi.write(str(dst))
    return fit
