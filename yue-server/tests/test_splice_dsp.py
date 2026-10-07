"""splice_dsp on synthetic audio: the K-weighted loudness, the groove lag the snap
relies on, equal-power fades and the assemble map (SP-4's sp4lib, ported)."""
import numpy as np
import pytest

from splice_dsp import SR, assemble, band_level, fades, gain_ramp, lufs, pattern_lag
from splice_fixtures import groove


def sine(seconds: float, db: float, hz: float = 997.0) -> np.ndarray:
    t = np.arange(int(seconds * SR)) / SR
    mono = (10 ** (db / 20) * np.sin(2 * np.pi * hz * t)).astype(np.float32)
    return np.stack([mono, mono], axis=1)


def test_a_997_hz_sine_reads_its_level_in_lufs():
    # BS.1770: a 0 dBFS 997 Hz sine in both channels reads 0 LUFS.
    assert lufs(sine(3, -20)) == pytest.approx(-20.0, abs=0.1)
    assert lufs(sine(3, -6)) - lufs(sine(3, -26)) == pytest.approx(20.0, abs=0.05)


def test_silence_and_short_audio_read_as_floor():
    assert lufs(np.zeros((SR, 2), dtype=np.float32)) == -70.0
    assert lufs(np.zeros((10, 2), dtype=np.float32)) == -70.0


def test_fades_are_equal_power():
    fo, fi = fades(4800)
    assert np.allclose(fo ** 2 + fi ** 2, 1.0, atol=1e-6)
    assert fo[0, 0] > 0.999 and fi[-1, 0] > 0.999


@pytest.mark.parametrize("shift_ms", [-40.0, 0.0, 25.0])
def test_pattern_lag_finds_a_known_shift_within_a_millisecond(shift_ms):
    beat = 0.5
    song = groove(16, beat)
    window = int(8 * beat * SR)
    x1 = song[:window]
    start = window + int(round(shift_ms / 1000 * SR))
    lag, corr = pattern_lag(x1, song[start:start + window])
    assert corr > 0.5
    assert lag == pytest.approx(-shift_ms, abs=1.0)


def test_no_groove_gives_a_low_correlation():
    rng = np.random.default_rng(3)
    noise = (rng.standard_normal((4 * SR, 2)) * 0.1).astype(np.float32)
    _, corr = pattern_lag(noise[:2 * SR], noise[2 * SR:])
    assert corr < 0.15


def test_assemble_keeps_pieces_exact_outside_the_crossfades_and_maps_them():
    a = np.full((SR * 4, 2), 0.25, dtype=np.float32)
    b = np.full((SR * 4, 2), -0.5, dtype=np.float32)
    out, joins, rows = assemble([(a, 0.0, 2.0), (b, 1.0, 3.0)], [0.5])
    assert len(out) == 4 * SR and joins == [2.0]
    assert rows == [(0.0, 2.0, 0, 0.0), (2.0, 4.0, 1, 1.0)]
    assert np.all(out[:int(1.75 * SR)] == 0.25) and np.all(out[int(2.25 * SR):] == -0.5)
    middle = out[int(1.76 * SR):int(2.24 * SR), 0]
    assert middle.max() <= 0.25 + 1e-6 and middle.min() >= -0.5 - 1e-6


def test_assemble_with_no_crossfade_is_a_plain_cut():
    a = np.arange(SR * 2 * 2, dtype=np.float32).reshape(-1, 2)
    out, _, _ = assemble([(a, 0.0, 0.5), (a, 1.5, 2.0)], [0.0])
    assert np.array_equal(out, np.concatenate([a[:SR // 2], a[int(1.5 * SR):]]))


def test_gain_ramp_is_linear_in_db_and_flat_outside_the_anchors():
    x = np.ones((SR * 4, 2), dtype=np.float32)
    y = gain_ramp(x, [1.0, 3.0], [0.0, -20.0])
    assert y[0, 0] == pytest.approx(1.0) and y[-1, 0] == pytest.approx(0.1, rel=1e-4)
    assert y[2 * SR, 0] == pytest.approx(10 ** (-10 / 20), rel=1e-3)


def test_band_level_is_high_on_a_voice_band_tone_and_low_on_a_bass_tone():
    voice, bass = sine(1, -20, 1000.0), sine(1, -20, 80.0)
    assert band_level(voice, 0.5, 0.1) - band_level(bass, 0.5, 0.1) > 30
