"""The /v1/splices routes (D-107, docs/decisions/0005): splice an edit into the
current version instead of keeping a whole re-render. Same auth, queue,
retention, upload sweep and Idempotency-Key replay as /v1/transcriptions; the
job runs on the worker thread, so it never overlaps a YuE2 render.

POST /v1/splices (multipart: `audio` = the base version's audio, `spec` =
JSON, splice_spec.py) -> 202 job; GET /v1/splices/{id}; POST .../cancel;
GET .../audio (the spliced float32 WAV, verdict ok only); GET .../grid/{base|
render|out} (the downbeat grids, for the server's sidecar cache).
"""
from __future__ import annotations

import hashlib
import json
import shutil
from pathlib import Path

from fastapi import Depends, FastAPI, Form, Header, HTTPException, UploadFile
from fastapi.responses import FileResponse, JSONResponse

from jobs import IdempotencyConflict, QueueFull
from splice_spec import SpecError, check_spec
from transcribe_routes import CHUNK, SUFFIX, _read_limited, _sweep

GRIDS = ("base", "render", "out")


def add_splice_routes(app: FastAPI, settings, store, worker, authorize) -> None:
    uploads = store.root / "splice-uploads"
    shutil.rmtree(uploads, ignore_errors=True)  # jobs don't outlive the process; nor do their uploads
    limit = int(settings.max_upload_mb * CHUNK)

    def get_job(job_id: str) -> dict:
        job = store.get(job_id, kind="splice")
        if job is None:
            raise HTTPException(404, "Splice not found")
        return job

    @app.post("/v1/splices", status_code=202, dependencies=[Depends(authorize)])
    async def submit(audio: UploadFile, spec: str = Form(...),
                     idempotency_key: str | None = Header(default=None, min_length=1, max_length=128),
                     x_admission_id: str | None = Header(default=None, max_length=128)):
        if worker.state != "ready":
            raise HTTPException(503, "Inference worker is not ready", headers={"Retry-After": "5"})
        try:
            checked = check_spec(json.loads(spec), store)
        except json.JSONDecodeError:
            raise HTTPException(422, "spec is not JSON") from None
        except SpecError as error:
            raise HTTPException(error.status, str(error)) from None
        data = await _read_limited(audio, limit)
        digest = hashlib.sha256(data).hexdigest()
        suffix = Path(audio.filename or "").suffix.lower()
        path = uploads / f"{digest}{suffix if SUFFIX.match(suffix) else '.bin'}"
        _sweep(uploads, store.retention_seconds)
        if not path.is_file():
            path.write_bytes(data)
        request = {"source": str(path), "filename": audio.filename or "audio", "sha256": digest, "spec": checked}
        try:
            job, created = store.submit(request, admission_id=x_admission_id,
                                        idempotency_key=idempotency_key, kind="splice")
        except QueueFull:
            raise HTTPException(429, "Queue is full", headers={"Retry-After": "5"}) from None
        except IdempotencyConflict:
            raise HTTPException(409, "Idempotency-Key was already used with different input") from None
        return JSONResponse(job, status_code=202 if created else 200,
                            headers={"Location": f"/v1/splices/{job['id']}"})

    @app.get("/v1/splices/{job_id}", dependencies=[Depends(authorize)])
    def status(job_id: str):
        return get_job(job_id)

    @app.post("/v1/splices/{job_id}/cancel", dependencies=[Depends(authorize)])
    def cancel(job_id: str):
        job = store.cancel(job_id, kind="splice")
        if job is None:
            raise HTTPException(404, "Splice not found")
        return job

    def artifact(job_id: str, name: str, media: str):
        if get_job(job_id)["status"] != "succeeded":
            raise HTTPException(409, "Artifact is not available for this job state")
        path = store.artifact_dir(job_id) / name
        if not path.is_file():
            raise HTTPException(404, "Artifact not found")
        return FileResponse(path, media_type=media, filename=f"{job_id}-{name}")

    @app.get("/v1/splices/{job_id}/audio", dependencies=[Depends(authorize)])
    def audio_file(job_id: str):
        return artifact(job_id, "audio.wav", "audio/wav")

    @app.get("/v1/splices/{job_id}/grid/{which}", dependencies=[Depends(authorize)])
    def grid(job_id: str, which: str):
        if which not in GRIDS:
            raise HTTPException(404, "Grid not found")
        return artifact(job_id, f"{which}.grid.json", "application/json")
