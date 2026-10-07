"""The splice's signal code, ported from SP-4's `sp4lib.py` (pipeline/spikes/
SP-4-keep-unchanged): BS.1770 K-weighted short-term loudness, the 40-5000 Hz
onset envelope and its cross-correlation lag (the groove snap), equal-power
fades and `assemble`, which joins pieces of audio with crossfades centred on
each cut. numpy/scipy only; 48 kHz float32 stereo throughout (D-107).
"""
from __future__ import annotations

import numpy as np
from scipy import signal

SR = 48000
HOP = 240  # 5 ms onset frames at 48 kHz
SILENT_LUFS = -70.0


def _kweight_sos():
    # BS.1770 K-weighting at 48 kHz: a high shelf, then a high pass.
    f0, gain, q = 1681.974450955533, 3.999843853973347, 0.7071752369554196
    k = np.tan(np.pi * f0 / SR)
    vh = 10 ** (gain / 20)
    vb = vh ** 0.4996667741545416
    a0 = 1 + k / q + k * k
    b = np.array([(vh + vb * k / q + k * k) / a0, 2 * (k * k - vh) / a0, (vh - vb * k / q + k * k) / a0])
    a = np.array([1, 2 * (k * k - 1) / a0, (1 - k / q + k * k) / a0])
    f1, q1 = 38.13547087602444, 0.5003270373238773
    k1 = np.tan(np.pi * f1 / SR)
    a01 = 1 + k1 / q1 + k1 * k1
    a2 = np.array([1, 2 * (k1 * k1 - 1) / a01, (1 - k1 / q1 + k1 * k1) / a01])
    return signal.tf2sos(b, a), signal.tf2sos(np.array([1.0, -2.0, 1.0]), a2)


_SOS = _kweight_sos()


def lufs(x: np.ndarray) -> float:
    """Loudness of a short segment (no gating), LUFS; channels are summed as BS.1770 does."""
    if len(x) < 100:
        return SILENT_LUFS
    y = signal.sosfilt(_SOS[1], signal.sosfilt(_SOS[0], x, axis=0), axis=0)
    power = float(np.mean(y ** 2, axis=0).sum())
    return max(-0.691 + 10 * np.log10(max(power, 1e-12)), SILENT_LUFS)


def seconds(x: np.ndarray, t0: float, t1: float) -> np.ndarray:
    """x between two times, clipped to the audio."""
    return x[max(0, int(round(t0 * SR))):max(0, int(round(t1 * SR)))]


def onset_env(x: np.ndarray, band=(40, 5000)) -> np.ndarray:
    """Positive spectral flux in `band`, one value per 5 ms frame."""
    mono = x.mean(axis=1)
    if len(mono) < 1024:
        return np.zeros(0)
    f, _, z = signal.stft(mono, SR, nperseg=1024, noverlap=1024 - HOP, boundary=None, padded=False)
    mag = np.log1p(30 * np.abs(z[(f > band[0]) & (f < band[1])]))
    return np.maximum(np.diff(mag, axis=1), 0).sum(axis=0).astype(np.float64)


def pattern_lag(x1: np.ndarray, x2: np.ndarray, maxlag_s: float = 0.15, band=(40, 5000)) -> tuple[float, float]:
    """x1 = audio just before a join, x2 = just after (same length). Returns (lag_ms, corr):
    how much later (+) x2's onset pattern sits than x1's carries on, by normalised
    cross-correlation of the onset envelopes within +-maxlag, with a parabolic peak."""
    e1, e2 = onset_env(x1, band), onset_env(x2, band)
    n = min(len(e1), len(e2))
    if n < 4:
        return 0.0, 0.0
    e1, e2 = e1[:n] - e1[:n].mean(), e2[:n] - e2[:n].mean()
    norm = np.sqrt((e1 ** 2).sum() * (e2 ** 2).sum()) + 1e-12
    frames = int(maxlag_s * SR / HOP)
    c = np.array([np.sum(e1[max(0, -k):n - max(0, k)] * e2[max(0, k):n - max(0, -k)])
                  for k in range(-frames, frames + 1)]) / norm
    i = int(np.argmax(c))
    offset = 0.0
    if 0 < i < len(c) - 1:
        y0, y1, y2 = c[i - 1], c[i], c[i + 1]
        den = y0 - 2 * y1 + y2
        offset = 0.5 * (y0 - y2) / den if den else 0.0
    return (i - frames + offset) * HOP / SR * 1000.0, float(c[i])


def fades(n: int) -> tuple[np.ndarray, np.ndarray]:
    """Equal-power fade out / fade in of n samples (cos^2 + sin^2 = 1 at every sample)."""
    x = np.linspace(0.0, np.pi / 2, n, endpoint=False) + (np.pi / 4) / n
    return np.cos(x).astype(np.float32)[:, None], np.sin(x).astype(np.float32)[:, None]


def _window(a: np.ndarray, i0: int, i1: int) -> np.ndarray:
    out = np.zeros((i1 - i0, 2), dtype=np.float32)
    lo, hi = max(i0, 0), min(i1, len(a))
    if hi > lo:
        out[lo - i0:hi - i0] = a[lo:hi]
    return out


def assemble(parts, widths) -> tuple[np.ndarray, list[float], list[tuple[float, float, int, float]]]:
    """parts: [(audio, t0_s, t1_s)]; widths: one crossfade width (s) per join. Each join is an
    equal-power crossfade centred on the cut: the earlier piece runs w/2 past its end, the
    later one starts w/2 before its start. Returns (out, joins_s, map) where map rows are
    (out_start_s, out_end_s, part index, src_t0_s)."""
    segs = [(a, int(round(t0 * SR)), int(round(t1 * SR))) for a, t0, t1 in parts]
    total = sum(e - s for _, s, e in segs)
    out = np.zeros((total, 2), dtype=np.float32)
    pos, joins, rows, starts = 0, [], [], []
    for k, (a, s, e) in enumerate(segs):
        out[pos:pos + e - s] = a[s:e]
        rows.append((pos / SR, (pos + e - s) / SR, k, s / SR))
        pos += e - s
        starts.append(pos)
        if k + 1 < len(segs):
            joins.append(pos / SR)
    for k in range(len(segs) - 1):
        h = int(round(widths[k] * SR / 2))
        if h <= 0:
            continue
        (a, _, e), (b, s2, _) = segs[k], segs[k + 1]
        fo, fi = fades(2 * h)
        mixed = _window(a, e - h, e + h) * fo + _window(b, s2 - h, s2 + h) * fi
        lo = starts[k] - h
        if lo < 0:
            mixed, lo = mixed[-lo:], 0
        hi = min(lo + len(mixed), total)
        out[lo:hi] = mixed[:hi - lo]
    return out, joins, rows


def gain_ramp(audio: np.ndarray, times_s, gains_db) -> np.ndarray:
    """audio scaled by a gain linear in dB between (time, dB) anchors, held flat outside them."""
    t = np.arange(len(audio)) / SR
    db = np.interp(t, np.asarray(times_s, dtype=np.float64), np.asarray(gains_db, dtype=np.float64))
    return (audio * (10 ** (db / 20)).astype(np.float32)[:, None]).astype(np.float32)


def band_level(x: np.ndarray, t: float, half: float, band=(300, 3400)) -> float:
    """Mean power (dB) of x in `band` over t +- half: where a sung word sits, it is loud."""
    seg = seconds(x, t - half, t + half).mean(axis=1)
    if len(seg) < 1024:
        return -120.0
    f, _, z = signal.stft(seg, SR, nperseg=1024, noverlap=1024 - HOP, boundary=None, padded=False)
    power = (np.abs(z[(f > band[0]) & (f < band[1])]) ** 2).sum(axis=0)
    return float(10 * np.log10(power.mean() + 1e-12))
