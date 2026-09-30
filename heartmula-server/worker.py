"""The single inference thread: load the engine once, then run jobs one at a
time. One job at a time is a GPU requirement on the 16 GB target card, not a
tuning choice (PLAN.md point 10)."""
import logging
import re
import shutil
import threading
import time
from pathlib import Path

from audio import write_flac
from engine_api import Engine, JobCancelled
from jobs import JobStore

log = logging.getLogger("heartmula.worker")
JOB_DIR = re.compile(r"^[0-9a-f]{32}$")

OOM_MESSAGE = ("GPU out of memory. Is another model holding VRAM? ACE-Step must run with "
               "ACESTEP_OFFLOAD_TO_CPU=true, and YuE2 must be idle.")


class Worker:
    def __init__(self, engine: Engine, store: JobStore, data_dir: Path):
        self.engine, self.store, self.data_dir = engine, store, data_dir
        self.ready = False
        self.startup_error: str | None = None
        self._stop = threading.Event()
        self._thread = threading.Thread(target=self._run, name="heartmula-worker", daemon=True)

    def start(self) -> None:
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        self._thread.join(timeout=5)

    def audio_path(self, job_id: str) -> Path:
        return self.data_dir / job_id / "audio.flac"

    def remove_artifacts(self, job_id: str) -> None:
        shutil.rmtree(self.data_dir / job_id, ignore_errors=True)

    def clear_stale_artifacts(self) -> None:
        """Jobs live in memory, so job folders left by an earlier process are orphans."""
        self.data_dir.mkdir(parents=True, exist_ok=True)
        for child in self.data_dir.iterdir():
            if child.is_dir() and JOB_DIR.match(child.name):
                shutil.rmtree(child, ignore_errors=True)

    def _run(self) -> None:
        try:
            self.clear_stale_artifacts()
            started = time.monotonic()
            self.engine.load()
            log.info("engine loaded to RAM in %.1f s", time.monotonic() - started)
            self.ready = True
        except Exception as error:  # the process stays up so /health/ready can report it
            log.exception("engine failed to load")
            self.startup_error = f"{type(error).__name__}: {error}"
            return
        while not self._stop.is_set():
            claimed = self.store.claim(timeout=0.5)
            if claimed:
                self.run_job(*claimed)

    def run_job(self, job_id: str, request: dict) -> None:
        def on_stage(name: str) -> None:
            if self.store.cancel_requested(job_id):
                raise JobCancelled(f"cancelled before {name}")
            self.store.stage(job_id, name)

        started = time.monotonic()
        try:
            generated = self.engine.generate(request, on_stage, lambda: self.store.cancel_requested(job_id))
            on_stage("saving")
            saved = write_flac(self.audio_path(job_id), generated.audio, generated.sample_rate)
            result = {"audio_url": f"/v1/jobs/{job_id}/audio", "score_url": None, **saved,
                      "truncated": generated.truncated,
                      "timing": {"seconds": round(time.monotonic() - started, 1)}}
            status = self.store.finish(job_id, "truncated" if generated.truncated else "succeeded",
                                       result=result)
        except JobCancelled:
            status = self.store.finish(job_id, "cancelled")
        except Exception as error:
            log.exception("job %s failed", job_id)
            status = self.store.finish(job_id, "failed", error=classify(error))
        finally:
            self.engine.cleanup()  # after the traceback is gone, so its tensors can be freed
        if status in ("failed", "cancelled"):
            self.remove_artifacts(job_id)
        log.info("job %s %s after %.1f s", job_id, status, time.monotonic() - started)


def classify(error: Exception) -> dict:
    # By name, so this module never imports torch: torch.cuda.OutOfMemoryError.
    if type(error).__name__ == "OutOfMemoryError":
        return {"code": "out_of_memory", "message": OOM_MESSAGE}
    if isinstance(error, ValueError):
        return {"code": "invalid_generation", "message": str(error)}
    return {"code": "inference_failed",
            "message": "Inference failed; see the heartmula-server log for this job ID."}
