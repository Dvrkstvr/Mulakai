"""Audio in and out for the splice: 48 kHz float32 stereo (SP-4's canonical
format; every YuE2 render and library WAV already is). A 48 kHz WAV is read
directly; anything else (a FLAC render, an MP3 library file) is decoded by
ffmpeg, as SP-4 did. The result is written as a float32 WAV, so the null test
can read back exactly what was written."""
from __future__ import annotations

import subprocess
from pathlib import Path

import numpy as np
from scipy.io import wavfile

from splice_dsp import SR


class AudioError(ValueError):
    pass


def _to_float_stereo(data: np.ndarray) -> np.ndarray:
    if data.dtype == np.int16:
        data = data.astype(np.float32) / 32768.0
    elif data.dtype == np.int32:
        data = data.astype(np.float32) / 2147483648.0
    elif data.dtype == np.uint8:
        data = (data.astype(np.float32) - 128.0) / 128.0
    data = data.astype(np.float32)
    if data.ndim == 1:
        data = np.stack([data, data], axis=1)
    if data.shape[1] == 1:
        data = np.repeat(data, 2, axis=1)
    return np.ascontiguousarray(data[:, :2])


def read_audio(path: Path) -> np.ndarray:
    path = Path(path)
    with path.open("rb") as handle:
        head = handle.read(4)
    if head == b"RIFF":
        try:
            rate, data = wavfile.read(path)
        except ValueError:
            rate, data = None, None
        if rate == SR:
            return _to_float_stereo(data)
    try:
        run = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-f", "f32le", "-ac", "2",
                              "-ar", str(SR), "-"], capture_output=True, check=True)
    except FileNotFoundError:
        raise AudioError("ffmpeg is not on PATH; it decodes non-WAV audio for the splice") from None
    except subprocess.CalledProcessError as error:
        raise AudioError(f"ffmpeg could not decode {path.name}: {error.stderr.decode(errors='replace')[-300:]}") from None
    audio = np.frombuffer(run.stdout, dtype=np.float32).reshape(-1, 2).copy()
    if not len(audio):
        raise AudioError(f"{path.name} decoded to no audio")
    return audio


def write_wav(path: Path, audio: np.ndarray) -> None:
    wavfile.write(path, SR, np.ascontiguousarray(audio, dtype=np.float32))
