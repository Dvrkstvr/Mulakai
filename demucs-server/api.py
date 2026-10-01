"""
HTTP layer, built around an injected separate() so tests need no torch.
Speaks the contract stemSplit.ts expects from DEMUCS_API_URL: POST /split ->
{"stems": {vocals, drums, bass, other}} of absolute float32 WAV URLs;
GET /health -> 200.
"""
import threading
from pathlib import Path
from typing import Callable, Dict

from fastapi import FastAPI, File, HTTPException, Request, UploadFile

from job_files import JobFiles

# (source file, output dir) -> stem kind -> WAV path under the output dir
Separate = Callable[[Path, Path], Dict[str, Path]]


def create_app(separate: Separate, data_dir: Path, model: str, result_ttl: float = 900) -> FastAPI:
    files = JobFiles(data_dir, result_ttl)
    files.sweep()
    # Mulakai's genLock already sends one split at a time; this guards direct
    # callers, since two concurrent passes would not fit in VRAM.
    lock = threading.Lock()

    app = FastAPI()
    files.mount(app)

    @app.get("/health")
    def health():
        return {"ok": True, "model": model}

    # Plain `def`: FastAPI runs it in its threadpool, so a multi-minute
    # separation doesn't block /health.
    @app.post("/split")
    def split(request: Request, audio: UploadFile = File(...)):
        files.sweep()
        job_dir = files.new_job()
        try:
            src = job_dir / f"source{Path(audio.filename or 'audio.mp3').suffix or '.mp3'}"
            src.write_bytes(audio.file.read())
            with lock:
                stems = separate(src, job_dir)
            src.unlink()
            if not stems:
                raise RuntimeError("separation produced no stems")
        # demucs.separate.main() calls sys.exit(1) on a file it can't decode.
        except (Exception, SystemExit) as err:
            files.discard(job_dir)
            raise HTTPException(status_code=500, detail=f"separation failed: {err!r}") from err

        base = str(request.base_url).rstrip("/")
        return {"stems": {kind: f"{base}/audio/{rel}" for kind, rel in files.publish(job_dir, stems).items()}}

    return app
