"""The single inference thread: loads the pipeline once, then runs queued jobs
one at a time through plan -> semantic -> synthesis -> decode. An
instrumental's plan is converted first (instrumental.py). Transcription jobs
(transcriber.py) run on the same thread, so they never share the GPU with a
song.

`pipe` is the adapter in yue_pipeline.py (or a fake in tests). Cancel is
checked at every stage boundary, and the pipeline also polls it inside its
token and ODE-step loops. The model is parked in system RAM *before* a job is
marked terminal, so Mulakai never sees a finished job while YuE2 still holds
VRAM (PLAN.md, design point 10).
"""
from __future__ import annotations

import json
import logging
import threading
import time

from instrumental import arrange
from jobs import JobStore
from transcriber import run_transcription

log = logging.getLogger("yue-server")


class Worker:
    def __init__(self, store: JobStore, pipeline_factory, transcriber=None):
        self.store = store
        self._factory = pipeline_factory
        self.transcriber = transcriber
        self.pipe = None
        self.state = "loading"  # loading | ready | failed
        self._thread: threading.Thread | None = None

    def start(self) -> None:
        self._thread = threading.Thread(target=self._main, name="yue-worker", daemon=True)
        self._thread.start()

    def stop(self, timeout: float = 30) -> None:
        self.store.stop()
        if self._thread is not None:
            self._thread.join(timeout)

    def fits_plan_budget(self, abc: str) -> bool:
        """Only meaningful once ready; the submit routes return 503 before that."""
        return self.pipe is None or self.pipe.fits_plan_budget(abc)

    def count_tokens(self, abc: str) -> int | None:
        """The score's size in the planner's tokens; None until the pipeline is loaded."""
        return None if self.pipe is None else self.pipe.count_tokens(abc)

    def _main(self) -> None:
        try:
            self.pipe = self._factory()
        except Exception:
            log.exception("YuE2 pipeline failed to load")
            self.state = "failed"
            return
        self.state = "ready"
        while (claimed := self.store.claim()) is not None:
            job_id, request = claimed
            if self.store.get(job_id, kind="transcription") is not None:
                run_transcription(self.transcriber, self.store, job_id, request)
            else:
                run_job(self.pipe, self.store, job_id, request)


def run_job(pipe, store: JobStore, job_id: str, request: dict) -> None:
    log.info("job %s started (seed %s)", job_id, request["seed"])
    timing: dict[str, float] = {}
    clock = {"stage": None, "t": time.monotonic()}

    def cancelled() -> bool:
        return store.cancelled(job_id)

    def enter(stage: str) -> None:
        now = time.monotonic()
        if clock["stage"]:
            timing[f"{clock['stage']}_seconds"] = round(now - clock["t"], 3)
        clock.update(stage=stage, t=now)
        if cancelled():
            raise InterruptedError(f"Cancelled before {stage}")
        store.progress(job_id, stage=stage, progress=None)

    def on_token(phase: str, _token: int) -> None:
        store.count_token(job_id, phase)

    def on_fraction(completed: int, total: int) -> None:
        store.progress(job_id, progress=round(completed / total, 4) if total else None)

    started = time.monotonic()
    try:
        enter("planning")
        plan = pipe.plan(request, cancelled=cancelled, on_token=on_token)
        plan, request, instrumental = arrange(pipe, request, plan, cancelled=cancelled, on_token=on_token)
        enter("semantic")
        semantic = pipe.semantic(plan, cancelled=cancelled, on_token=on_token)
        enter("synthesis")
        latents = pipe.synthesize(semantic, cancelled=cancelled, on_progress=on_fraction)
        enter("decode")
        audio = pipe.decode(latents, on_progress=on_fraction)
        enter("saving")
        timing["total_seconds"] = round(time.monotonic() - started, 3)
        outcome = _save(pipe, store, job_id, request, plan, semantic, audio, timing, instrumental)
    except InterruptedError:
        outcome = ("cancelled", None, None)
    except Exception as error:  # every failure must reach the job record
        outcome = ("failed", None, _error(error))
    finally:
        parking = time.monotonic()
        pipe.park()
    status, result, error = outcome
    log.info("job %s %s (parked in %.1f s)%s", job_id, status, time.monotonic() - parking,
             f": {error['message']}" if error else "")
    store.finish(job_id, status, result=result, error=error)


def _save(pipe, store, job_id, request, plan, semantic, audio, timing, instrumental=None):
    out = store.artifact_dir(job_id)
    out.mkdir(parents=True, exist_ok=True)
    pipe.save_audio(audio, out / "audio.flac")
    if plan.abc:
        (out / "score.abc").write_bytes(plan.abc.encode("utf-8"))
    extra = {}
    if instrumental is not None:
        instrumental = dict(instrumental)
        if (planned := instrumental.pop("planned_abc", None)) is not None:
            (out / "planned.abc").write_bytes(planned.encode("utf-8"))
        extra["instrumental"] = instrumental
    truncated = {"abc": bool(plan.truncated), "semantic": bool(semantic.truncated)}
    result = {
        "audio_url": f"/v1/jobs/{job_id}/audio",
        "score_url": f"/v1/jobs/{job_id}/score" if plan.abc else None,
        "audio_seconds": round(len(audio) / pipe.sample_rate, 3),
        "sample_rate": pipe.sample_rate,
        "truncated": truncated,
        "timing": timing,
    }
    # request is the one the audio came from: an instrumental's carries its converted score.
    (out / "result.json").write_text(json.dumps({**result, **extra, "request": request}, indent=2),
                                     encoding="utf-8")
    return ("truncated" if any(truncated.values()) else "succeeded", result, None)


def _error(error: Exception) -> dict:
    name = type(error).__name__
    if name == "OutOfMemoryError":
        code = "out_of_memory"
    elif isinstance(error, (ValueError, TypeError)):
        code = "invalid_generation"
    else:
        code = "inference_failed"
    if code == "invalid_generation":
        log.warning("generation rejected: %s: %s", name, error)
    else:
        log.error("generation failed", exc_info=error)
    return {"code": code, "message": f"{name}: {error}"}
