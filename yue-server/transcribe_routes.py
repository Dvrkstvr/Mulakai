"""The /v1/transcriptions routes: SheetSage2 reads a source song's melody into
a score for a YuE2 cover (PLAN.md, "YuE2 Melody Covers via SheetSage2" and
"yue-server transcription decisions"). Same auth, queue, retention and
Idempotency-Key replay as /v1/jobs; a `yue2-serve` backend has none of this,
which the unauthenticated health route makes visible.
"""
from __future__ import annotations

import hashlib
import re
import shutil
import time
from pathlib import Path

from fastapi import Depends, FastAPI, Form, Header, HTTPException, UploadFile
from fastapi.responses import FileResponse, JSONResponse

from jobs import IdempotencyConflict, QueueFull

SUFFIX = re.compile(r"^\.[a-z0-9]{1,8}$")
CHUNK = 1024 * 1024


def add_transcription_routes(app: FastAPI, settings, store, worker, authorize) -> None:
    uploads = store.root / "uploads"
    shutil.rmtree(uploads, ignore_errors=True)  # jobs don't outlive the process; nor do their uploads
    limit = int(settings.max_upload_mb * CHUNK)

    def availability() -> tuple[str, str]:
        status, detail = worker.transcriber.status()
        if status == "ready" and worker.state != "ready":
            return worker.state, "the YuE2 worker is not ready"
        return status, detail

    def get_job(job_id: str) -> dict:
        job = store.get(job_id, kind="transcription")
        if job is None:
            raise HTTPException(404, "Transcription not found")
        return job

    @app.get("/v1/transcriptions/health")
    def health():
        status, detail = availability()
        if status != "ready":
            return JSONResponse({"status": status, "detail": detail}, status_code=503)
        return {"status": "ready"}

    @app.post("/v1/transcriptions", status_code=202, dependencies=[Depends(authorize)])
    async def submit(audio: UploadFile, chords: bool = Form(False),
                     idempotency_key: str | None = Header(default=None, min_length=1, max_length=128),
                     x_admission_id: str | None = Header(default=None, max_length=128)):
        status, detail = availability()
        if status != "ready":
            raise HTTPException(503, f"Transcription is not available: {status}. {detail}".strip(),
                                headers={"Retry-After": "5"})
        data = await _read_limited(audio, limit)
        digest = hashlib.sha256(data).hexdigest()
        suffix = Path(audio.filename or "").suffix.lower()
        path = uploads / f"{digest}{suffix if SUFFIX.match(suffix) else '.bin'}"
        _sweep(uploads, store.retention_seconds)
        if not path.is_file():
            path.write_bytes(data)
        request = {"source": str(path), "filename": audio.filename or "audio", "sha256": digest, "chords": chords}
        try:
            job, created = store.submit(request, admission_id=x_admission_id,
                                        idempotency_key=idempotency_key, kind="transcription")
        except QueueFull:
            raise HTTPException(429, "Queue is full", headers={"Retry-After": "5"}) from None
        except IdempotencyConflict:
            raise HTTPException(409, "Idempotency-Key was already used with different input") from None
        return JSONResponse(job, status_code=202 if created else 200,
                            headers={"Location": f"/v1/transcriptions/{job['id']}"})

    @app.get("/v1/transcriptions/{job_id}", dependencies=[Depends(authorize)])
    def status(job_id: str):
        return get_job(job_id)

    @app.post("/v1/transcriptions/{job_id}/cancel", dependencies=[Depends(authorize)])
    def cancel(job_id: str):
        job = store.cancel(job_id, kind="transcription")
        if job is None:
            raise HTTPException(404, "Transcription not found")
        return job

    def artifact(job_id: str, name: str, media: str):
        if get_job(job_id)["status"] != "succeeded":
            raise HTTPException(409, "Artifact is not available for this job state")
        path = store.artifact_dir(job_id) / name
        if not path.is_file():
            raise HTTPException(404, "Artifact not found")
        return FileResponse(path, media_type=media, filename=f"{job_id}-{name}")

    @app.get("/v1/transcriptions/{job_id}/score", dependencies=[Depends(authorize)])
    def score(job_id: str):
        return artifact(job_id, "score.abc", "text/plain; charset=utf-8")

    @app.get("/v1/transcriptions/{job_id}/preview", dependencies=[Depends(authorize)])
    def preview(job_id: str):
        return artifact(job_id, "piano_mix.wav", "audio/wav")


async def _read_limited(audio: UploadFile, limit: int) -> bytes:
    data = bytearray()
    while chunk := await audio.read(CHUNK):
        data += chunk
        if len(data) > limit:
            raise HTTPException(413, f"Audio is over the {limit // CHUNK} MB upload limit")
    if not data:
        raise HTTPException(400, "Audio is empty")
    return bytes(data)


def _sweep(uploads: Path, retention_seconds: float) -> None:
    uploads.mkdir(parents=True, exist_ok=True)
    cutoff = time.time() - retention_seconds
    for path in uploads.iterdir():
        if path.is_file() and path.stat().st_mtime < cutoff:
            path.unlink(missing_ok=True)
