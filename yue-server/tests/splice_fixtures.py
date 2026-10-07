"""Synthetic songs for the splice tests: a 4/4 drum groove (the same waveform for
every hit, so the onset pattern repeats exactly), a pad whose level can change
per bar, optional sung-word bursts in the voice band, and the matching native
score and tracker grid. No model, no real audio."""
from __future__ import annotations

import io

import numpy as np
from scipy.io import wavfile

from splice_dsp import SR

CHORDS = [("C", "C:maj"), ("Am", "A:min"), ("F", "F:maj"), ("G", "G:maj")]
_RNG = np.random.default_rng(11)
_NOISE = (_RNG.standard_normal(int(0.12 * SR))).astype(np.float32)


def _hit(kind: str) -> np.ndarray:
    n = len(_NOISE)
    t = np.arange(n) / SR
    if kind == "kick":
        return (0.9 * np.sin(2 * np.pi * 60 * t) * np.exp(-t / 0.05)).astype(np.float32)
    if kind == "snare":
        return (0.5 * _NOISE * np.exp(-t / 0.04)).astype(np.float32)
    return (0.2 * np.diff(_NOISE, prepend=0.0) * np.exp(-t / 0.01)).astype(np.float32)


HITS = [(0.0, "kick"), (1.0, "snare"), (1.75, "kick"), (2.0, "kick"), (3.0, "snare")] + \
       [(k / 2, "hat") for k in range(8)]


def groove(bars: int, beat: float, *, lead: float = 0.0, tail: float = 1.0,
           pad_db=None, words=()) -> np.ndarray:
    """`bars` bars of 4/4 starting at `lead` s; pad_db(i) is bar i's pad level (dB,
    default -24); words = [(t0, t1)] voice-band bursts."""
    n = int((lead + bars * 4 * beat + tail) * SR)
    mono = np.zeros(n, dtype=np.float32)
    for i in range(bars):
        for at, kind in HITS:
            s = int(round((lead + (i * 4 + at) * beat) * SR))
            h = _hit(kind)[:max(0, n - s)]
            mono[s:s + len(h)] += h
    t = np.arange(n) / SR
    level = np.full(n, -24.0)
    for i in range(bars):
        a, b = int((lead + i * 4 * beat) * SR), int((lead + (i + 1) * 4 * beat) * SR)
        level[a:b] = pad_db(i) if pad_db else -24.0
    # a sustained part in the voice band too (440 Hz), as real accompaniment has between drum hits
    pad = (np.sin(2 * np.pi * 110 * t) + 0.5 * np.sin(2 * np.pi * 165 * t) + 0.5 * np.sin(2 * np.pi * 440 * t))         * 10 ** (level / 20)
    mono += pad.astype(np.float32)
    for t0, t1 in words:
        a, b = int(t0 * SR), int(t1 * SR)
        tt = np.arange(b - a) / SR
        mono[a:b] += (0.3 * np.sin(2 * np.pi * 700 * tt) * np.sin(np.pi * tt / (tt[-1] + 1e-9))).astype(np.float32)
    return np.stack([mono, mono * 0.9], axis=1).astype(np.float32)


def downbeats(bars: int, beat: float, lead: float = 0.0) -> list[float]:
    return [round(lead + i * 4 * beat, 4) for i in range(bars)]


def grid(bars: int, beat: float, lead: float = 0.0, duration: float | None = None,
         chord_of=lambda i: CHORDS[i % 4][1]) -> dict:
    """A tracker grid (sidecar shape) for a groove: one downbeat and one chord row per bar."""
    d = downbeats(bars, beat, lead)
    end = duration if duration is not None else lead + bars * 4 * beat + 1.0
    rows = [[t, d[i + 1] if i + 1 < bars else end, chord_of(i)] for i, t in enumerate(d)]
    return {"grid_v": 1, "source": "tracked", "downbeats": d, "chords": rows, "duration": end}


def score(bars: int, bpm: int, chord_of=lambda i: CHORDS[i % 4][0], meter: str = "4/4",
          sections=None) -> str:
    """A native two-voice score: `bars` bars in groups of 4, one chord per bar.
    sections = [(label, first bar 0-based)]; default one `% verse`."""
    head = ["X:1", "T:", f"M:{meter}", "L:1/32", f"Q:1/4={bpm}",
            'V: Vocal clef=treble name="Vocal Melody" snm="Vocal"',
            'V: Ins clef=treble name="Ins Melody" snm="Inst."', "K:C"]
    num, den = (int(x) for x in meter.split("/"))
    rest = f"z{32 * num // den}|"
    starts = dict((first, label) for label, first in (sections or [("verse", 0)]))
    lines, i = [], 0
    while i < bars:
        if i in starts:
            lines.append(f"% {starts[i]}")
        stop = min([s for s in starts if s > i] + [bars, i + 4])
        lines += ["V: Vocal", "".join(f'"{chord_of(k)}"{rest}' for k in range(i, stop)),
                  "V: Ins", rest * (stop - i)]
        i = stop
    return "\n".join(head + lines) + "\n"


def wav_bytes(x: np.ndarray) -> bytes:
    buf = io.BytesIO()
    wavfile.write(buf, SR, np.ascontiguousarray(x, dtype=np.float32))
    return buf.getvalue()
