"""In-memory job table and FIFO queue.

Snapshots mirror YuE2-Turbo's yue2-serve job records (the shared contract,
PLAN.md "Multiple Song-Creation Engines" point 3). Jobs do not survive a
restart; Mulakai's poll loop treats the resulting 404s as a failed job.
"""
import queue
import threading
import time
import uuid

TERMINAL = {"succeeded", "truncated", "failed", "cancelled"}


class QueueFull(Exception):
    pass


class JobStore:
    def __init__(self, max_pending: int):
        self.max_pending = max_pending
        self._lock = threading.Lock()
        self._jobs: dict[str, dict] = {}
        self._requests: dict[str, dict] = {}
        self._queue: "queue.Queue[str]" = queue.Queue()

    def submit(self, request: dict) -> dict:
        with self._lock:
            pending = sum(j["status"] in ("queued", "running") for j in self._jobs.values())
            if pending >= self.max_pending:
                raise QueueFull()
            now, job_id = time.time(), uuid.uuid4().hex
            job = dict(id=job_id, status="queued", stage="queued", created_at=now, updated_at=now,
                       started_at=None, finished_at=None, cancel_requested=False, result=None, error=None)
            self._jobs[job_id], self._requests[job_id] = job, request
            self._queue.put(job_id)
            return dict(job)

    def get(self, job_id: str) -> dict | None:
        with self._lock:
            job = self._jobs.get(job_id)
            return dict(job) if job else None

    def claim(self, timeout: float | None = None) -> tuple[str, dict] | None:
        """Block for the next queued job, mark it running, return (id, request)."""
        while True:
            try:
                job_id = self._queue.get(timeout=timeout)
            except queue.Empty:
                return None
            with self._lock:
                job = self._jobs.get(job_id)
                if job is None or job["status"] != "queued":  # cancelled while queued, or pruned
                    continue
                now = time.time()
                job.update(status="running", stage="starting", started_at=now, updated_at=now)
                return job_id, self._requests[job_id]

    def cancel(self, job_id: str) -> dict | None:
        with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                return None
            if job["status"] not in TERMINAL:
                job["cancel_requested"] = True
                if job["status"] == "queued":
                    job.update(status="cancelled", stage="finished", finished_at=time.time())
                job["updated_at"] = time.time()
            return dict(job)

    def cancel_requested(self, job_id: str) -> bool:
        with self._lock:
            return self._jobs[job_id]["cancel_requested"]

    def stage(self, job_id: str, name: str) -> None:
        with self._lock:
            job = self._jobs[job_id]
            if job["status"] == "running":
                job.update(stage=name, updated_at=time.time())

    def finish(self, job_id: str, status: str, *, result: dict | None = None,
               error: dict | None = None) -> str:
        """Record the outcome. A cancel that arrived mid-job wins; returns the final status."""
        if status not in TERMINAL:
            raise ValueError(f"not a terminal status: {status}")
        with self._lock:
            job = self._jobs[job_id]
            if job["cancel_requested"]:
                status, result, error = "cancelled", None, None
            now = time.time()
            job.update(status=status, stage="finished", finished_at=now, updated_at=now,
                       result=result, error=error)
            self._requests.pop(job_id, None)
            return status

    def prune(self, older_than_s: float) -> list[str]:
        """Forget finished jobs older than the cutoff; returns their ids."""
        cutoff = time.time() - older_than_s
        with self._lock:
            old = [i for i, j in self._jobs.items()
                   if j["status"] in TERMINAL and j["finished_at"] < cutoff]
            for job_id in old:
                del self._jobs[job_id]
            return old
