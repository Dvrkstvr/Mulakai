"""In-memory job table and FIFO queue for yue-server.

The job record mirrors YuE2-Turbo's `yue2-serve` snapshot (id, status, stage,
tokens, timestamps, cancel_requested, result, error) so Mulakai's one generic
engine client reads both. `progress` is this wrapper's addition: the fraction
of the current stage, or null when the stage has no known total. Jobs live
only for this process's lifetime; artifacts are swept after the retention
window.
"""
from __future__ import annotations

import copy
import shutil
import threading
import time
import uuid
from collections import deque
from pathlib import Path

TERMINAL = {"succeeded", "truncated", "failed", "cancelled"}
PENDING = {"queued", "running"}


class QueueFull(Exception):
    pass


class JobStore:
    def __init__(self, root: Path, max_pending: int, retention_seconds: float, clock=time.time):
        self.root = Path(root)
        self.max_pending = max_pending
        self.retention_seconds = retention_seconds
        self._clock = clock
        self._jobs: dict[str, dict] = {}
        self._requests: dict[str, dict] = {}
        self._queue: deque[str] = deque()
        self._cond = threading.Condition()
        self._stopping = False

    def artifact_dir(self, job_id: str) -> Path:
        return self.root / job_id

    def submit(self, request: dict, admission_id: str | None = None) -> dict:
        with self._cond:
            if sum(j["status"] in PENDING for j in self._jobs.values()) >= self.max_pending:
                raise QueueFull()
            now = self._clock()
            job = dict(id=uuid.uuid4().hex, admission_id=admission_id, request_id=request.get("id"),
                       seed=request["seed"], status="queued", stage="queued", progress=None,
                       tokens={"abc": 0, "semantic": 0}, created_at=now, updated_at=now,
                       started_at=None, finished_at=None, cancel_requested=False,
                       result=None, error=None)
            self._jobs[job["id"]] = job
            self._requests[job["id"]] = dict(request)
            self._queue.append(job["id"])
            self._cond.notify_all()
            return copy.deepcopy(job)

    def get(self, job_id: str) -> dict | None:
        with self._cond:
            job = self._jobs.get(job_id)
            return copy.deepcopy(job) if job else None

    def claim(self, timeout: float | None = None) -> tuple[str, dict] | None:
        """Block until a queued job exists (or stop/timeout), then mark it running."""
        with self._cond:
            if not self._cond.wait_for(lambda: self._queue or self._stopping, timeout):
                return None
            if self._stopping:
                return None
            job_id = self._queue.popleft()
            job = self._jobs[job_id]
            job.update(status="running", started_at=self._clock(), updated_at=self._clock())
            return job_id, dict(self._requests[job_id])

    def cancel(self, job_id: str) -> dict | None:
        with self._cond:
            job = self._jobs.get(job_id)
            if job is None:
                return None
            if job["status"] not in TERMINAL:
                job["cancel_requested"] = True
                if job["status"] == "queued":
                    self._queue.remove(job_id)
                    self._close(job, "cancelled")
            return copy.deepcopy(job)

    def cancelled(self, job_id: str) -> bool:
        with self._cond:
            return self._stopping or self._jobs[job_id]["cancel_requested"]

    def progress(self, job_id: str, **fields) -> None:
        with self._cond:
            job = self._jobs[job_id]
            if job["status"] == "running":
                job.update(fields, updated_at=self._clock())

    def count_token(self, job_id: str, phase: str) -> None:
        with self._cond:
            tokens = self._jobs[job_id]["tokens"]
            tokens[phase] = tokens.get(phase, 0) + 1

    def finish(self, job_id: str, status: str, *, result: dict | None = None,
               error: dict | None = None) -> None:
        if status not in TERMINAL:
            raise ValueError("Expected a terminal status")
        with self._cond:
            job = self._jobs[job_id]
            # A cancel that raced a finishing job wins, as in yue2-serve.
            if job["cancel_requested"]:
                status, result, error = "cancelled", None, None
            job.update(result=result, error=error)
            self._close(job, status)
            self._requests.pop(job_id, None)
        self.sweep()

    def sweep(self) -> None:
        """Drop finished jobs (and their artifacts) older than the retention window."""
        cutoff = self._clock() - self.retention_seconds
        with self._cond:
            expired = [j["id"] for j in self._jobs.values()
                       if j["status"] in TERMINAL and j["finished_at"] < cutoff]
            for job_id in expired:
                del self._jobs[job_id]
        for job_id in expired:
            shutil.rmtree(self.artifact_dir(job_id), ignore_errors=True)

    def purge_orphans(self) -> None:
        """Delete artifact directories left by a previous run (jobs are not persisted).
        Only job-id-shaped names are touched, in case YUE_DATA_DIR is shared."""
        self.root.mkdir(parents=True, exist_ok=True)
        for path in self.root.iterdir():
            if path.is_dir() and len(path.name) == 32 and all(c in "0123456789abcdef" for c in path.name):
                shutil.rmtree(path, ignore_errors=True)

    def stop(self) -> None:
        with self._cond:
            self._stopping = True
            self._cond.notify_all()

    def _close(self, job: dict, status: str) -> None:
        now = self._clock()
        job.update(status=status, stage="finished", progress=None, finished_at=now, updated_at=now)
