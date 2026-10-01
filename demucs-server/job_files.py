"""
The on-disk side of /split: each split gets a job dir under data_dir, and
its stems are served from /audio exactly once. Mulakai downloads every stem
URL once, right after /split returns (stemSplit.ts runDemucs), so a stem is
deleted as soon as its download has been sent, and the job dir goes with
the last one. Job dirs nobody fetches (a split cancelled mid-pass, a Node
restart, leftovers from a previous run of this process) are swept once
they are `ttl` seconds old, at startup and before each split.

uvr-server/job_files.py is a copy of this file: the two services run in
separate venvs that cannot import each other. Keep them in sync.
"""
import shutil
import threading
import time
import uuid
from pathlib import Path
from typing import Callable, Dict, Optional, Set

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask


class JobFiles:
    def __init__(self, data_dir: Path, ttl: float, clock: Callable[[], float] = time.time):
        self.data_dir = data_dir
        self.ttl = ttl
        self._clock = clock
        self._lock = threading.Lock()
        self._running: Set[str] = set()
        # job id -> stems not yet downloaded, as paths relative to the job dir
        self._pending: Dict[str, Set[str]] = {}
        self._published: Dict[str, float] = {}
        data_dir.mkdir(parents=True, exist_ok=True)

    def new_job(self) -> Path:
        job_dir = self.data_dir / uuid.uuid4().hex
        job_dir.mkdir()
        with self._lock:
            self._running.add(job_dir.name)
        return job_dir

    def publish(self, job_dir: Path, stems: Dict[str, Path]) -> Dict[str, str]:
        """Make the stems downloadable; returns kind -> path under /audio."""
        rel = {kind: path.relative_to(job_dir).as_posix() for kind, path in stems.items()}
        with self._lock:
            self._running.discard(job_dir.name)
            self._pending[job_dir.name] = set(rel.values())
            self._published[job_dir.name] = self._clock()
        return {kind: f"{job_dir.name}/{r}" for kind, r in rel.items()}

    def discard(self, job_dir: Path) -> None:
        with self._lock:
            self._forget(job_dir.name)
        _remove(job_dir)

    def resolve(self, job_id: str, rel: str) -> Optional[Path]:
        with self._lock:
            if rel not in self._pending.get(job_id, ()):
                return None
        return self.data_dir / job_id / rel

    def fetched(self, job_id: str, rel: str) -> None:
        with self._lock:
            left = self._pending.get(job_id)
            if left is None:
                return
            left.discard(rel)
            done = not left
            if done:
                self._forget(job_id)
        if done:
            _remove(self.data_dir / job_id)
        else:
            (self.data_dir / job_id / rel).unlink(missing_ok=True)

    def sweep(self) -> None:
        now = self._clock()
        for entry in list(self.data_dir.iterdir()):
            with self._lock:
                if entry.name in self._running:
                    continue
                born = self._published.get(entry.name)
                if born is None:
                    try:
                        born = entry.stat().st_mtime
                    except FileNotFoundError:
                        continue
                if now - born < self.ttl:
                    continue
                self._forget(entry.name)
            _remove(entry)

    def mount(self, app: FastAPI) -> None:
        @app.get("/audio/{job_id}/{rel:path}")
        def audio(job_id: str, rel: str):
            path = self.resolve(job_id, rel)
            if path is None or not path.is_file():
                raise HTTPException(status_code=404)
            # Runs once the body has been sent and the file closed.
            return FileResponse(path, media_type="audio/wav",
                                background=BackgroundTask(self.fetched, job_id, rel))

    def _forget(self, job_id: str) -> None:
        self._running.discard(job_id)
        self._pending.pop(job_id, None)
        self._published.pop(job_id, None)


def _remove(path: Path) -> None:
    # ignore_errors: on Windows a file still open elsewhere can't be deleted;
    # the next sweep retries it.
    if path.is_dir():
        shutil.rmtree(path, ignore_errors=True)
    else:
        try:
            path.unlink(missing_ok=True)
        except OSError:
            pass
