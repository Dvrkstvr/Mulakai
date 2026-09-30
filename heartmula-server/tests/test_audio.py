import numpy as np
import pytest
import soundfile as sf

from audio import CEILING, fit_to_ceiling, write_flac


def test_over_full_scale_is_turned_down_to_the_ceiling():
    audio = np.array([[1.33, -0.5], [0.2, -1.1]], dtype=np.float32)
    fitted, gain_db = fit_to_ceiling(audio)
    assert np.isclose(np.abs(fitted).max(), CEILING)
    assert gain_db == pytest.approx(20 * np.log10(CEILING / 1.33), abs=0.01)
    assert np.allclose(fitted / audio, fitted[0, 0] / audio[0, 0])  # one static gain


def test_audio_within_the_ceiling_is_untouched():
    audio = np.array([[0.5, -0.5]], dtype=np.float32)
    fitted, gain_db = fit_to_ceiling(audio)
    assert fitted is audio and gain_db == 0.0


def test_non_finite_samples_are_rejected():
    with pytest.raises(ValueError):
        fit_to_ceiling(np.array([[np.nan, 0.0]], dtype=np.float32))


def test_write_flac_is_24_bit_stereo_without_clipping(tmp_path):
    t = np.linspace(0, 1, 48_000, dtype=np.float32)
    wave = 1.25 * np.sin(2 * np.pi * 220 * t)
    info = write_flac(tmp_path / "a" / "audio.flac", np.stack([wave, wave], axis=1), 48_000)
    meta = sf.info(str(tmp_path / "a" / "audio.flac"))
    assert (meta.format, meta.subtype, meta.channels, meta.samplerate) == ("FLAC", "PCM_24", 2, 48_000)
    data, _ = sf.read(str(tmp_path / "a" / "audio.flac"))
    assert np.abs(data).max() <= CEILING + 1e-4
    assert info["audio_seconds"] == 1.0 and info["gain_db"] < -1.9
