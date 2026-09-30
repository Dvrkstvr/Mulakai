"""
Thin HTTP wrapper around HeartMuLa (https://github.com/HeartMuLa/heartlib) so
Mulakai's Node server can reach it the way it reaches ACE-Step and Demucs: a
separate process behind a URL (HEARTMULA_API_URL), no shared runtime.

Speaks the job contract every Mulakai engine wrapper shares (PLAN.md,
"Multiple Song-Creation Engines", point 3), whose shapes follow YuE2-Turbo's
yue2-serve: POST /v1/jobs -> 202 job snapshot; GET /v1/jobs/{id};
POST /v1/jobs/{id}/cancel; GET /v1/jobs/{id}/audio (FLAC); GET /health/ready.
There is no /score route: HeartMuLa produces no score, so it 404s.

Run: python main.py   (or: uvicorn --factory main:create_app --port 8003)
"""
import logging
import os
import secrets
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

import config
from engine_api import Engine
from jobs import IdempotencyConflict, JobStore, QueueFull
from request import GenerateRequest
from worker import Worker

log = logging.getLogger("heartmula.api")


def create_app(engine: Engine | None = None, settings: config.Settings | None = None) -> FastAPI:
    settings = settings or config.from_env()
    if engine is None:
        from engine import HeartMulaEngine  # imports torch + heartlib; tests pass a fake instead
        engine = HeartMulaEngine(settings.model_path, settings.version, settings.device,
                                 settings.vram_budget_gb)
    store = JobStore(settings.max_pending)
    worker = Worker(engine, store, settings.data_dir)

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        worker.start()
        yield
        worker.stop()

    app = FastAPI(title="Mulakai HeartMuLa server", lifespan=lifespan)
    app.state.worker, app.state.store = worker, store
    bearer = HTTPBearer(auto_error=False)

    def authorize(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)) -> None:
        if not settings.api_key:
            return
        if credentials is None or not secrets.compare_digest(
                credentials.credentials.encode(), settings.api_key.encode()):
            raise HTTPException(401, "Invalid bearer token", headers={"WWW-Authenticate": "Bearer"})

    def get_job(job_id: str) -> dict:
        job = store.get(job_id)
        if job is None:
            raise HTTPException(404, "Job not found")
        return job

    @app.get("/health/live")
    def live():
        return {"status": "alive"}

    @app.get("/health/ready")
    def ready():
        if not worker.ready:
            if worker.startup_error:
                return JSONResponse({"status": "failed", "error": worker.startup_error}, status_code=503)
            return JSONResponse({"status": "loading"}, status_code=503)
        return {"status": "ready"}

    @app.post("/v1/jobs", status_code=202, dependencies=[Depends(authorize)])
    def submit(request: GenerateRequest,
               idempotency_key: str | None = Header(default=None, min_length=1, max_length=128)):
        # Mulakai sends its own job id as the Idempotency-Key, so a retried submit
        # replays the original job and both sides' logs can be matched.
        if not worker.ready:
            raise HTTPException(503, "Inference worker is not ready", headers={"Retry-After": "5"})
        for job_id in store.prune(settings.retention_hours * 3600):
            worker.remove_artifacts(job_id)
        try:
            job, created = store.submit(request.model_dump(), idempotency_key)
        except QueueFull:
            raise HTTPException(429, "Queue is full", headers={"Retry-After": "5"}) from None
        except IdempotencyConflict:
            raise HTTPException(409, "Idempotency-Key was already used with different input") from None
        log.info("job %s %s (Idempotency-Key %s)", job["id"], "queued" if created else "replayed", idempotency_key)
        return JSONResponse(job, status_code=202 if created else 200,
                            headers={"Location": f"/v1/jobs/{job['id']}"})

    @app.get("/v1/jobs/{job_id}", dependencies=[Depends(authorize)])
    def status(job_id: str):
        return get_job(job_id)

    @app.post("/v1/jobs/{job_id}/cancel", dependencies=[Depends(authorize)])
    def cancel(job_id: str):
        job = store.cancel(job_id)
        if job is None:
            raise HTTPException(404, "Job not found")
        return job

    @app.get("/v1/jobs/{job_id}/audio", dependencies=[Depends(authorize)])
    def audio(job_id: str):
        job = get_job(job_id)
        if job["status"] not in ("succeeded", "truncated"):
            raise HTTPException(409, "Artifact is not available for this job state")
        path = worker.audio_path(job_id)
        if not path.is_file():
            raise HTTPException(404, "Artifact not found")
        return FileResponse(path, media_type="audio/flac", filename=f"{job_id}-audio.flac")

    return app


if __name__ == "__main__":
    import uvicorn

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
    uvicorn.run(create_app(), host=os.environ.get("HEARTMULA_HOST", "127.0.0.1"),
                port=int(os.environ.get("HEARTMULA_PORT", "8003")))
