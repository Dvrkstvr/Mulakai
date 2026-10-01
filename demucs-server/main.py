"""
Thin HTTP wrapper around Demucs (https://github.com/adefossez/demucs) so Mulakai's
Node server can reach it the same way it reaches ACE-Step: a separate process, a
URL (DEMUCS_API_URL), no shared runtime. Speaks the contract stemSplit.ts already
expects: POST /split -> {"stems": {vocals, drums, bass, other}} of absolute
downloadable URLs; GET /health -> 200. Stems are float32 WAV masters - the Node
side transcodes to the user's chosen format (see transcode.ts).

Uses demucs.separate.main() (the documented CLI-equivalent entry point) rather
than demucs.api.Separator - the latter isn't in the latest PyPI release (4.0.1)
yet, only on the unreleased main branch. This means each /split call reloads
the model from disk; if that ever becomes the bottleneck, switching to
demucs.api.Separator (kept warm at startup) is the fix, once available on PyPI.

Stems are written with soundfile, not demucs' own save_audio: see _save_wav.
The HTTP layer and the job files' lifecycle live in api.py and job_files.py.

Run: pip install -r requirements.txt && uvicorn main:app --port 8002
"""
import os
from pathlib import Path

import soundfile
import demucs.separate
from demucs.audio import prevent_clip

from api import create_app

_demucs_save_audio = demucs.separate.save_audio


def _save_wav(wav, path, samplerate, clip="rescale", as_float=False,
              bits_per_sample=16, **kwargs):
    # demucs 4.0.1 writes WAVs via torchaudio.save, which since torchaudio
    # 2.9 always routes through torchcodec - and torchcodec needs FFmpeg
    # *shared* libraries of a matching ABI, which static Windows FFmpeg
    # builds (winget/gyan) don't provide. Pinning torchaudio < 2.9 isn't an
    # option either: torch < 2.9 has no Python 3.14 wheels. soundfile bundles
    # libsndfile, so it works regardless of the torch or FFmpeg version.
    if not str(path).lower().endswith(".wav"):
        return _demucs_save_audio(wav, path, samplerate=samplerate, clip=clip,
                                  as_float=as_float,
                                  bits_per_sample=bits_per_sample, **kwargs)
    subtype = "FLOAT" if as_float else f"PCM_{bits_per_sample}"
    data = prevent_clip(wav, mode=clip).cpu().numpy().T  # (frames, channels)
    soundfile.write(str(path), data, samplerate, subtype=subtype)


# demucs.separate imported save_audio by name, so patch it there.
demucs.separate.save_audio = _save_wav

MODEL_NAME = os.environ.get("DEMUCS_MODEL", "htdemucs")
DATA_DIR = Path(os.environ.get("DEMUCS_DATA_DIR", Path(__file__).parent / "data"))
# Seconds an unfetched split's files are kept (see job_files.py).
RESULT_TTL = float(os.environ.get("DEMUCS_RESULT_TTL", "900"))


def _separate(src_path, job_dir):
    # --filename "{stem}.{ext}" drops demucs' default {track}/ prefix, so
    # output lands directly at job_dir/MODEL_NAME/{stem}.wav - deterministic,
    # no need to know the source track's basename.
    #
    # Float32 WAV, not mp3: this service now hands Mulakai a *lossless master*
    # and the Node side applies the user's chosen container/rate/depth once
    # (server/src/services/transcode.ts). Encoding mp3 here would make every
    # non-mp3 export a lossy->lossless upconvert.
    demucs.separate.main([
        "-n", MODEL_NAME,
        "-o", str(job_dir),
        "--filename", "{stem}.{ext}",
        "--float32",
        str(src_path),
    ])
    # Demucs' htdemucs stem names (drums/bass/other/vocals) match Mulakai's
    # StemKind set exactly - no renaming needed.
    return {p.stem: p for p in (job_dir / MODEL_NAME).glob("*.wav")}


app = create_app(_separate, DATA_DIR, MODEL_NAME, RESULT_TTL)
