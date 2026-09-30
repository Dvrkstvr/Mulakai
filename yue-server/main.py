"""
Thin HTTP wrapper around the official YuE2 pipeline
(https://github.com/multimodal-art-projection/YuE), run inside WSL2 so the
acoustic stage gets FlashAttention instead of Windows' MATH fallback. Mulakai
reaches it at YUE_API_URL like any other engine.

It speaks the shared engine contract (PLAN.md, "Multiple Song-Creation
Engines", design point 3), which is YuE2-Turbo's `yue2-serve` job API, so the
same client can point at either: POST /v1/jobs -> 202 job, GET /v1/jobs/{id},
POST /v1/jobs/{id}/cancel, GET /v1/jobs/{id}/audio (FLAC), GET
/v1/jobs/{id}/score (ABC), GET /health/ready. One job runs at a time.
SheetSage2 transcription for covers adds /v1/transcriptions
(transcribe_routes.py).

Run (inside WSL, in the yue2 venv): python main.py
"""
from __future__ import annotations

import asyncio
import logging
import secrets
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from jobs import IdempotencyConflict, JobStore, QueueFull
from request_model import GenerateRequest
from scores import ScoreError, prepare_score
from settings import Settings
from transcribe_routes import add_transcription_routes
from transcriber import Transcriber
from worker import Worker

log = logging.getLogger("yue-server")


def create_app(settings: Settings | None = None, pipeline_factory=None) -> FastAPI:
    settings = settings or Settings.from_env()
    store = JobStore(settings.data_dir, settings.max_pending, settings.retention_hours * 3600)
    if pipeline_factory is None:
        def pipeline_factory():
            from yue_pipeline import YuePipeline
            return YuePipeline(settings)
    transcriber = Transcriber(settings.sheetsage_python, settings.sheetsage_dir)
    worker = Worker(store, pipeline_factory, transcriber)

    @asynccontextmanager
    async def lifespan(_app):
        store.purge_orphans()
        worker.start()
        yield
        await asyncio.to_thread(worker.stop)

    app = FastAPI(title="yue-server", lifespan=lifespan)
    app.state.store, app.state.worker = store, worker
    bearer = HTTPBearer(auto_error=False)

    def authorize(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)):
        if not settings.api_key:
            return
        if credentials is None or not secrets.compare_digest(
                credentials.credentials.encode(), settings.api_key.encode()):
            raise HTTPException(401, "Invalid bearer token", headers={"WWW-Authenticate": "Bearer"})

    def get_job(job_id: str) -> dict:
        job = store.get(job_id, kind="song")
        if job is None:
            raise HTTPException(404, "Job not found")
        return job

    @app.get("/health/live")
    def live():
        return {"status": "alive"}

    @app.get("/health/ready")
    def ready():
        if worker.state != "ready":
            return JSONResponse({"status": worker.state}, status_code=503)
        return {"status": "ready"}

    @app.post("/v1/jobs", status_code=202, dependencies=[Depends(authorize)])
    def submit(request: GenerateRequest,
               idempotency_key: str | None = Header(default=None, min_length=1, max_length=128),
               x_admission_id: str | None = Header(default=None, max_length=128)):
        if worker.state != "ready":
            raise HTTPException(503, "Inference worker is not ready", headers={"Retry-After": "5"})
        body = request.model_dump(exclude_none=True)
        if "abc" in body:
            try:
                body["abc"] = prepare_score(body["abc"], body["cot"])
            except ScoreError as error:
                raise HTTPException(422, str(error)) from None
            if not worker.fits_plan_budget(body["abc"]):
                raise HTTPException(422, "The score is over YuE2's 4096-token planning budget")
        try:
            job, created = store.submit(body,
                                        admission_id=x_admission_id, idempotency_key=idempotency_key)
        except QueueFull:
            raise HTTPException(429, "Queue is full", headers={"Retry-After": "5"}) from None
        except IdempotencyConflict:
            raise HTTPException(409, "Idempotency-Key was already used with different input") from None
        log.info("job %s %s (Idempotency-Key %s)", job["id"], "queued" if created else "replayed",
                 idempotency_key)
        return JSONResponse(job, status_code=202 if created else 200,
                            headers={"Location": f"/v1/jobs/{job['id']}"})

    @app.get("/v1/jobs/{job_id}", dependencies=[Depends(authorize)])
    def status(job_id: str):
        return get_job(job_id)

    @app.post("/v1/jobs/{job_id}/cancel", dependencies=[Depends(authorize)])
    def cancel(job_id: str):
        job = store.cancel(job_id, kind="song")
        if job is None:
            raise HTTPException(404, "Job not found")
        return job

    def artifact(job_id: str, name: str, media: str):
        job = get_job(job_id)
        if job["status"] not in {"succeeded", "truncated"}:
            raise HTTPException(409, "Artifact is not available for this job state")
        path = store.artifact_dir(job_id) / name
        if not path.is_file():
            raise HTTPException(404, "Artifact not found")
        return FileResponse(path, media_type=media, filename=f"{job_id}-{name}")

    @app.get("/v1/jobs/{job_id}/audio", dependencies=[Depends(authorize)])
    def audio(job_id: str):
        return artifact(job_id, "audio.flac", "audio/flac")

    @app.get("/v1/jobs/{job_id}/score", dependencies=[Depends(authorize)])
    def score(job_id: str):
        return artifact(job_id, "score.abc", "text/plain; charset=utf-8")

    add_transcription_routes(app, settings, store, worker, authorize)
    return app


def main() -> None:
    import uvicorn
    settings = Settings.from_env()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    uvicorn.run(create_app(settings), host=settings.host, port=settings.port, workers=1)


if __name__ == "__main__":
    main()
