"""SP-4 shared helpers (run inside WSL with ~/sheetsage2/.venv/bin/python): audio IO via ffmpeg, bar grids from SheetSage2
downbeats, centred crossfade splicing, and the seam measures (beat-phase error, short-term LUFS, spectral centroid).
Canonical format: 48 kHz stereo float32 (every YuE2 render and library WAV already is)."""
import json, os, subprocess, sys
import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48000
HOME = os.path.expanduser("~")
SPIKE = "/mnt/e/repos/Mulakai/pipeline/spikes/SP-4-keep-unchanged"
TMP = "/mnt/e/ai/tmp/sp4"          # big temp data on E:
SS = f"{HOME}/sp4/ss"              # SheetSage2 transcriptions
REN = f"{HOME}/sp4/render"
LIB = "/mnt/e/repos/Mulakai/server/data/audio/"

sys.path.insert(0, "/mnt/e/repos/Mulakai/pipeline/spikes/SP-3-cot-full-adherence")
import analyze as A  # noqa: E402  (SP-3 helpers: Tr, Sc, best_offset, agree, f1 ...)
A.SS = SS


def load(path):
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-f", "f32le", "-ac", "2", "-ar", str(SR), "-"], capture_output=True, check=True)
    return np.frombuffer(r.stdout, dtype=np.float32).reshape(-1, 2).copy()


def save_wav(path, x):
    wavfile.write(path, SR, np.ascontiguousarray(x, dtype=np.float32))


def save_flac(path, x):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", "-", "-c:a", "flac", "-sample_fmt", "s32", path],
                   input=np.ascontiguousarray(x, dtype=np.float32).tobytes(), check=True)


# ---------------------------------------------------------------- grids
def thin_if_double(tr, sc, idx):
    """SheetSage2 sometimes tracks half bars on a 4/4 score (m2_analyze.py): keep every second downbeat from the better phase."""
    b = tr.bpm_from_bars()
    if b and b / sc.bpm > 1.7:
        full = list(tr.down); best = None
        for k in (0, 1):
            tr.down = full[k::2]
            o = A.best_offset(sc, tr, idx)
            r = A.agree(sc.chords, tr.bar_chords(), o, idx)[0]
            if best is None or r > best[0]:
                best = (r, k)
        tr.down = full[best[1]::2]
        return True
    return False


class Grid:
    """score bar i (0-based) -> audio time, for one render, with the offset fitted on `fit_idx` (bars not touched by the edit)."""
    def __init__(self, ss_name, score_path, fit_idx=None):
        self.tr = A.Tr(ss_name)
        self.sc = A.Sc(score_path)
        idx = list(range(len(self.sc.bars))) if fit_idx is None else fit_idx
        self.thinned = thin_if_double(self.tr, self.sc, idx)
        self.o = A.best_offset(self.sc, self.tr, idx)
        ab = self.tr.bar_chords()
        self.root = A.agree(self.sc.chords, ab, self.o, idx)[0]
        self.bars = self.tr.bars()
        self.dur = self.tr.dur
        self.n = len(self.sc.bars)

    def t(self, i):
        """audio time (s) at the start of score bar i (i == n gives the end of the last bar)"""
        j = i + self.o
        if j <= 0 and i >= 0:
            j = max(j, 0)
        if j >= len(self.bars):
            return self.dur
        return self.bars[j][0]

    def bar_s(self):
        d = np.diff([b[0] for b in self.bars[1:-1]])
        return float(np.median(d))


# ---------------------------------------------------------------- splicing
def _fades(n):
    x = np.linspace(0.0, np.pi / 2, n, endpoint=False) + (np.pi / 4) / n
    return np.cos(x).astype(np.float32)[:, None], np.sin(x).astype(np.float32)[:, None]


def assemble(parts, w):
    """parts: [(audio, t0_s, t1_s)]. Consecutive parts join at the cut with an equal-power crossfade of total width w seconds
    CENTRED on the join (the earlier part's audio runs w/2 past its end, the later part's starts w/2 before its start).
    Returns (out, joins_s, map) where joins_s are the output times of the joins and map lists (out_start_s, out_end_s, part idx, src_t0_s)."""
    h = int(round(w * SR / 2))
    segs = [(a, int(round(t0 * SR)), int(round(t1 * SR))) for a, t0, t1 in parts]
    total = sum(e - s for _, s, e in segs)
    out = np.zeros((total, 2), dtype=np.float32)
    pos = 0; joins = []; mp = []
    for k, (a, s, e) in enumerate(segs):
        n = e - s
        out[pos:pos + n] = a[s:e]
        mp.append((pos / SR, (pos + n) / SR, k, s / SR))
        pos += n
        if k + 1 < len(segs):
            joins.append(pos / SR)
    if h > 0:
        pos = 0
        for k in range(len(segs) - 1):
            a, s, e = segs[k]; b, s2, e2 = segs[k + 1]
            pos += e - s
            fo, fi = _fades(2 * h)
            tail = _slice(a, e - h, e + h); head = _slice(b, s2 - h, s2 + h)
            lo = pos - h
            seg = tail * fo + head * fi
            if lo < 0:
                seg = seg[-lo:]; lo = 0
            hi = min(lo + len(seg), total)
            out[lo:hi] = seg[:hi - lo]
    return out, joins, mp


def _slice(a, i0, i1):
    out = np.zeros((i1 - i0, 2), dtype=np.float32)
    lo, hi = max(i0, 0), min(i1, len(a))
    if hi > lo:
        out[lo - i0:hi - i0] = a[lo:hi]
    return out


# ---------------------------------------------------------------- seam measures
def _sos_kweight():
    # BS.1770 K-weighting (48 kHz): high-shelf + high-pass
    f0, G, Q = 1681.974450955533, 3.999843853973347, 0.7071752369554196
    K = np.tan(np.pi * f0 / SR); Vh = 10 ** (G / 20); Vb = Vh ** 0.4996667741545416
    a0 = 1 + K / Q + K * K
    b = np.array([(Vh + Vb * K / Q + K * K) / a0, 2 * (K * K - Vh) / a0, (Vh - Vb * K / Q + K * K) / a0])
    a = np.array([1, 2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0])
    f1 = 38.13547087602444; Q1 = 0.5003270373238773
    K1 = np.tan(np.pi * f1 / SR); a01 = 1 + K1 / Q1 + K1 * K1
    b2 = np.array([1, -2, 1]); a2 = np.array([1, 2 * (K1 * K1 - 1) / a01, (1 - K1 / Q1 + K1 * K1) / a01])
    return signal.tf2sos(b, a), signal.tf2sos(b2, a2)


_SOS = None


def lufs(x):
    """integrated loudness of a short segment (no gating), LUFS"""
    global _SOS
    if _SOS is None:
        _SOS = _sos_kweight()
    if len(x) < 100:
        return -70.0
    y = signal.sosfilt(_SOS[0], x, axis=0); y = signal.sosfilt(_SOS[1], y, axis=0)
    ms = float(np.mean(y ** 2, axis=0).sum())
    return -0.691 + 10 * np.log10(max(ms, 1e-12))


def centroid(x):
    m = x.mean(axis=1)
    f, _, Z = signal.stft(m, SR, nperseg=2048, noverlap=1024)
    mag = np.abs(Z).mean(axis=1)
    return float((f * mag).sum() / max(mag.sum(), 1e-12))


def step_stats(x, t, win=3.0):
    """short-term loudness (3 s) and spectral centroid just before and just after time t of audio x"""
    i = int(round(t * SR)); n = int(win * SR)
    before, after = x[max(0, i - n):i], x[i:i + n]
    return {"lufs_before": lufs(before), "lufs_after": lufs(after), "lufs_step": lufs(after) - lufs(before),
            "centroid_before": centroid(before), "centroid_after": centroid(after), "centroid_step": centroid(after) - centroid(before)}


def onset_env(x, hop=240, band=(40, 5000)):
    """low-band spectral flux, 5 ms frames (hop 240 @ 48 kHz); returns (env, frame_rate)"""
    m = x.mean(axis=1)
    f, tt, Z = signal.stft(m, SR, nperseg=1024, noverlap=1024 - hop, boundary=None, padded=False)
    mag = np.log1p(30 * np.abs(Z[(f > band[0]) & (f < band[1])]))
    fl = np.maximum(np.diff(mag, axis=1), 0).sum(axis=0)
    return fl.astype(np.float64), SR / hop


def beat_period(x, nominal_s):
    """quarter-note period (s) of x: the period within +-3% of nominal that maximises the envelope's Fourier magnitude"""
    env, fr = onset_env(x)
    t = np.arange(len(env)) / fr; env = env - env.mean()
    best = None
    for p in np.linspace(nominal_s * 0.97, nominal_s * 1.03, 121):
        v = abs(np.sum(env * np.exp(-2j * np.pi * t / p)))
        if best is None or v > best[0]:
            best = (v, p)
    return best[1]


def beat_phase(x, t0, t1, p, tref):
    """phase (s, in [0,p)) of the beat grid inside x[t0:t1] measured from tref, and the strength of that phase (vector length / total)"""
    seg = x[int(t0 * SR):int(t1 * SR)]
    env, fr = onset_env(seg)
    t = (t0 - tref) + np.arange(len(env)) / fr + 0.5 * 1024 / SR
    z = np.sum((env - env.mean()) * np.exp(-2j * np.pi * t / p))
    return float((-np.angle(z) / (2 * np.pi)) % 1.0 * p), float(abs(z) / max(np.sum(np.abs(env - env.mean())), 1e-9))


def wrap(d, p):
    return (d + p / 2) % p - p / 2


def pattern_lag(x1, x2, fr_hz=SR / 240, maxlag_s=0.15, band=(40, 5000)):
    """x1 = audio just before a join, x2 = audio just after (same length W). The groove of x2 should be x1's one window later.
    Returns (lag_ms, corr): how much LATER (+) / earlier (-) x2's onset pattern sits than x1's, by normalised cross-correlation of the
    low-band onset envelopes (5 ms frames, parabolic peak), searched within +-maxlag."""
    e1, _ = onset_env(x1, band=band); e2, _ = onset_env(x2, band=band)
    n = min(len(e1), len(e2)); e1 = e1[:n] - e1[:n].mean(); e2 = e2[:n] - e2[:n].mean()
    d = np.sqrt((e1 ** 2).sum() * (e2 ** 2).sum()) + 1e-12
    L = int(maxlag_s * fr_hz)
    c = np.array([np.sum(e1[max(0, -k):n - max(0, k)] * e2[max(0, k):n - max(0, -k)]) for k in range(-L, L + 1)]) / d
    i = int(np.argmax(c))
    off = 0.0
    if 0 < i < len(c) - 1:
        y0, y1, y2 = c[i - 1], c[i], c[i + 1]; den = y0 - 2 * y1 + y2
        off = 0.5 * (y0 - y2) / den if den else 0.0
    return (i - L + off) / fr_hz * 1000.0, float(c[i])


VERIFY_BAND = (2000, 12000)   # snapping uses 40-5000 Hz; the check uses the band above it so it is not circular


def seam_phase_error(out, t, p, span=None, guard=0.0):
    """groove continuity across the join at output time t: lag (ms) between the W = 8 beats before and the 8 beats after (adjacent windows,
    p = 60/Q the quarter note, so a continuing groove gives 0). Returns (lag_ms, corr, corr)."""
    W = span or 8 * p
    i0 = max(0, int((t - W) * SR)); i1 = int(t * SR)
    n = i1 - i0
    lag, c = pattern_lag(out[i0:i1], out[i1:i1 + n], band=VERIFY_BAND)
    return lag, c, c
