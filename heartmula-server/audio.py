"""Write the engine's float audio as a lossless FLAC master.

HeartMuLa's float peaks run above full scale (1.12-1.33 in the spike), and
FLAC stores integers only (libsndfile rejects FLAC + FLOAT), so a plain
PCM_24 write would hard-clip them. Over-scale audio instead gets one static
gain down to CEILING: no clipping, no limiter coloring, dynamics untouched.
"""
import math
from pathlib import Path

import numpy as np
import soundfile as sf

CEILING = 10 ** (-0.1 / 20)  # -0.1 dBFS


def fit_to_ceiling(audio: np.ndarray) -> tuple[np.ndarray, float]:
    """Return (audio, gain_db). Only ever turns down, never up."""
    if not np.all(np.isfinite(audio)):
        raise ValueError("engine returned non-finite samples")
    peak = float(np.max(np.abs(audio))) if audio.size else 0.0
    if peak <= CEILING:
        return audio, 0.0
    gain = CEILING / peak
    return (audio * gain).astype(np.float32), round(20 * math.log10(gain), 2)


def write_flac(path: Path, audio: np.ndarray, sample_rate: int) -> dict:
    fitted, gain_db = fit_to_ceiling(np.asarray(audio, dtype=np.float32))
    path.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(path), fitted, sample_rate, format="FLAC", subtype="PCM_24")
    return {"audio_seconds": round(fitted.shape[0] / sample_rate, 2),
            "sample_rate": sample_rate, "gain_db": gain_db}
