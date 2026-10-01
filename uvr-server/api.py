"""
HTTP layer, built around injected runners so tests need no torch. Speaks the
contract stemSplit.ts expects from DEMUCS_API_URL: POST /split ->
{"stems": {vocals, drums, bass, other}} of absolute float32 WAV URLs;
GET /health -> 200.
"""
import threading
from pathlib import Path
from typing import Callable

from fastapi import FastAPI, File, HTTPException, Request, UploadFile

from chain import Runner, run_chain
from job_files import JobFiles


def create_app(
    run_mdx: Runner,
    run_demucs: Runner,
    free_gpu: Callable[[], None],
    data_dir: Path,
    vocal_model: str,
    demucs_model: str,
    result_ttl: float = 900,
) -> FastAPI:
    files = JobFiles(data_dir, result_ttl)
    files.sweep()
    # Mulakai's genLock already sends one split at a time; this guards direct
    # callers, since two concurrent passes would not fit in VRAM.
    lock = threading.Lock()

    app = FastAPI()
    files.mount(app)

    @app.get("/health")
    def health():
        return {"ok": True, "backend": "uvr", "model": vocal_model, "demucs_model": demucs_model}

    # Plain `def`: FastAPI runs it in its threadpool, so a multi-minute
    # separation doesn't block /health.
    @app.post("/split")
    def split(request: Request, audio: UploadFile = File(...)):
        files.sweep()
        job_dir = files.new_job()
        try:
            src = job_dir / f"source{Path(audio.filename or 'audio.wav').suffix or '.wav'}"
            src.write_bytes(audio.file.read())
            with lock:
                try:
                    stems = run_chain(src, job_dir, vocal_model, demucs_model, run_mdx, run_demucs)
                finally:
                    free_gpu()
            src.unlink()
            # The instrumental and pass 2's Vocals (already folded into other)
            # are intermediates.
            kept = set(stems.values())
            for wav in job_dir.rglob("*.wav"):
                if wav not in kept:
                    wav.unlink()
        except Exception as err:
            files.discard(job_dir)
            raise HTTPException(status_code=500, detail=f"separation failed: {err}") from err

        base = str(request.base_url).rstrip("/")
        return {"stems": {kind: f"{base}/audio/{rel}" for kind, rel in files.publish(job_dir, stems).items()}}

    return app
