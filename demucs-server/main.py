"""
Thin HTTP wrapper around Demucs (https://github.com/adefossez/demucs) so Mulakai's
Node server can reach it the same way it reaches ACE-Step: a separate process, a
URL (DEMUCS_API_URL), no shared runtime. Speaks the contract stemSplit.ts already
expects: POST /split -> {"stems": {vocals, drums, bass, other}} of absolute
downloadable URLs; GET /health -> 200.

Uses demucs.separate.main() (the documented CLI-equivalent entry point) rather
than demucs.api.Separator - the latter isn't in the latest PyPI release (4.0.1)
yet, only on the unreleased main branch. This means each /split call reloads
the model from disk; if that ever becomes the bottleneck, switching to
demucs.api.Separator (kept warm at startup) is the fix, once available on PyPI.

Run: pip install -r requirements.txt && uvicorn main:app --port 8002
"""
import os
import uuid
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, Request
from fastapi.staticfiles import StaticFiles
import demucs.separate

MODEL_NAME = os.environ.get("DEMUCS_MODEL", "htdemucs")
DATA_DIR = Path(os.environ.get("DEMUCS_DATA_DIR", Path(__file__).parent / "data"))
DATA_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI()
app.mount("/audio", StaticFiles(directory=DATA_DIR), name="audio")


@app.get("/health")
def health():
    return {"ok": True, "model": MODEL_NAME}


@app.post("/split")
async def split(request: Request, audio: UploadFile = File(...)):
    job_id = uuid.uuid4().hex
    job_dir = DATA_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)

    src_path = job_dir / f"source{Path(audio.filename or 'audio.mp3').suffix or '.mp3'}"
    src_path.write_bytes(await audio.read())

    # --filename "{stem}.{ext}" drops demucs' default {track}/ prefix, so
    # output lands directly at job_dir/MODEL_NAME/{stem}.mp3 - deterministic,
    # no need to know the source track's basename. --mp3 specifically (not the
    # wav/flac default) because demucs encodes mp3 via lameenc directly, while
    # wav/flac route through torchaudio -> torchcodec, which needs an ffmpeg
    # shared-library ABI match that's brittle across platforms/versions.
    demucs.separate.main([
        "-n", MODEL_NAME,
        "-o", str(job_dir),
        "--filename", "{stem}.{ext}",
        "--mp3",
        str(src_path),
    ])
    src_path.unlink(missing_ok=True)

    base = str(request.base_url).rstrip("/")
    model_dir = job_dir / MODEL_NAME
    urls = {}
    # Demucs' htdemucs stem names (drums/bass/other/vocals) match Mulakai's
    # StemKind set exactly - no renaming needed.
    for stem_path in model_dir.glob("*.mp3"):
        urls[stem_path.stem] = f"{base}/audio/{job_id}/{MODEL_NAME}/{stem_path.name}"

    return {"stems": urls}
