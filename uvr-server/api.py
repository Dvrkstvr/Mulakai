"""
HTTP layer, built around injected runners so tests need no torch. Speaks the
contract stemSplit.ts expects from DEMUCS_API_URL: POST /split ->
{"stems": {vocals, drums, bass, other}} of absolute float32 WAV URLs;
GET /health -> 200.
"""
import threading
import uuid
from pathlib import Path
from typing import Callable

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.staticfiles import StaticFiles

from chain import Runner, run_chain


def create_app(
    run_mdx: Runner,
    run_demucs: Runner,
    free_gpu: Callable[[], None],
    data_dir: Path,
    vocal_model: str,
    demucs_model: str,
) -> FastAPI:
    data_dir.mkdir(parents=True, exist_ok=True)
    # Mulakai's genLock already sends one split at a time; this guards direct
    # callers, since two concurrent passes would not fit in VRAM.
    lock = threading.Lock()

    app = FastAPI()
    app.mount("/audio", StaticFiles(directory=data_dir), name="audio")

    @app.get("/health")
    def health():
        return {"ok": True, "backend": "uvr", "model": vocal_model, "demucs_model": demucs_model}

    # Plain `def`: FastAPI runs it in its threadpool, so a multi-minute
    # separation doesn't block /health.
    @app.post("/split")
    def split(request: Request, audio: UploadFile = File(...)):
        job_dir = data_dir / uuid.uuid4().hex
        job_dir.mkdir(parents=True)
        src = job_dir / f"source{Path(audio.filename or 'audio.wav').suffix or '.wav'}"
        src.write_bytes(audio.file.read())
        try:
            with lock:
                try:
                    stems = run_chain(src, job_dir, vocal_model, demucs_model, run_mdx, run_demucs)
                finally:
                    free_gpu()
        except Exception as err:
            raise HTTPException(status_code=500, detail=f"separation failed: {err}") from err
        finally:
            src.unlink(missing_ok=True)

        # The instrumental and pass 2's Vocals (already folded into other)
        # are intermediates.
        kept = set(stems.values())
        for wav in job_dir.rglob("*.wav"):
            if wav not in kept:
                wav.unlink()

        base = str(request.base_url).rstrip("/")
        return {
            "stems": {
                kind: f"{base}/audio/{path.relative_to(data_dir).as_posix()}"
                for kind, path in stems.items()
            }
        }

    return app
