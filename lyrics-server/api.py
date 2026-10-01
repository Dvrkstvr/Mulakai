"""
HTTP layer, built around an injected transcriber so tests need no model.
Speaks the contract in PLAN.md "lyrics-server contract": POST /transcribe
(multipart `audio`, optional `language`) -> {"language", "segments": [{text,
start, end, words}]}; GET /health -> 200 without loading anything.
"""
import tempfile
import threading
from pathlib import Path
from typing import Callable, Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile

from hallucinations import drop_hallucinations

Transcriber = Callable[[Path, Optional[str]], dict]


def create_app(transcribe: Transcriber, model_name: str) -> FastAPI:
    # Mulakai's genLock already sends one job at a time; this guards direct
    # callers, since two loaded models would not fit next to ACE-Step.
    lock = threading.Lock()
    app = FastAPI()

    @app.get("/health")
    def health():
        return {"ok": True, "backend": "faster-whisper", "model": model_name}

    # Plain `def`: FastAPI runs it in its threadpool, so a job doesn't block /health.
    @app.post("/transcribe")
    def transcribe_route(audio: UploadFile = File(...), language: str = Form("")):
        suffix = Path(audio.filename or "audio.wav").suffix or ".wav"
        with tempfile.TemporaryDirectory() as tmp:
            src = Path(tmp) / f"source{suffix}"
            src.write_bytes(audio.file.read())
            try:
                with lock:
                    result = transcribe(src, language.strip() or None)
            except Exception as err:
                raise HTTPException(status_code=500, detail=f"transcription failed: {err}") from err
        return {"language": result["language"], "segments": drop_hallucinations(result["segments"])}

    return app
