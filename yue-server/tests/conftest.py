"""A fake of the yue_pipeline.YuePipeline adapter, so tests run without torch,
yue2 or a GPU."""
from __future__ import annotations

import threading
import time
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from main import create_app
from settings import Settings

ABC = "X:1\nM:4/4\nQ:1/4=92\nK:Am\n|A2 c2|\n"


class FakePipeline:
    sample_rate = 48000

    def __init__(self, *, truncated=(False, False), error=None, gate=None, on_park=None,
                 score=ABC, fits=True):
        self.truncated, self.error, self.gate, self.on_park = truncated, error, gate, on_park
        self.score, self.fits = score, fits
        self.requests: list[dict] = []
        self.parked = 0

    def plan(self, request, *, cancelled, on_token):
        self.requests.append(request)
        for _ in range(3):
            on_token("abc", 1)
        # A supplied score skips planning, as in yue2: the plan is that score.
        abc = None if request.get("cot") == "off" else request.get("abc") or self.score
        return SimpleNamespace(abc=abc, truncated=self.truncated[0])

    def fits_plan_budget(self, abc):
        return self.fits

    def semantic(self, plan, *, cancelled, on_token):
        # Holds the job in the semantic stage until the test opens the gate.
        while self.gate is not None and not self.gate.wait(0.005):
            if cancelled():
                raise InterruptedError("Cancelled during semantic")
        for _ in range(5):
            on_token("semantic", 1)
        return SimpleNamespace(truncated=self.truncated[1])

    def synthesize(self, semantic, *, cancelled, on_progress):
        if self.error is not None:
            raise self.error
        on_progress(1, 4)
        on_progress(4, 4)
        return "latents"

    def decode(self, latents, *, on_progress):
        on_progress(1, 1)
        return [0.0] * (self.sample_rate * 2)

    def save_audio(self, audio, path):
        path.write_bytes(b"fLaC-fake")

    def park(self):
        self.parked += 1
        if self.on_park is not None:
            self.on_park()


def wait_for(fn, timeout=5.0):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        value = fn()
        if value:
            return value
        time.sleep(0.01)
    raise AssertionError("condition not met in time")


def wait_terminal(client, job_id, headers=None):
    return wait_for(lambda: (j := client.get(f"/v1/jobs/{job_id}", headers=headers).json())
                    ["status"] in {"succeeded", "truncated", "failed", "cancelled"} and j)


@pytest.fixture
def make_client(tmp_path):
    clients = []

    def make(pipe=None, factory=None, **settings):
        pipe = pipe or FakePipeline()
        app = create_app(Settings(data_dir=tmp_path / "data", **settings),
                         pipeline_factory=factory or (lambda: pipe))
        client = TestClient(app)
        client.__enter__()
        clients.append((client, pipe))
        if factory is None:
            wait_for(lambda: client.get("/health/ready").status_code == 200)
        return client

    yield make
    for client, pipe in clients:
        if pipe.gate is not None:
            pipe.gate.set()
        client.__exit__(None, None, None)


BODY = {"style": "indie pop, 92 bpm", "lyrics": "[Verse]\nla la", "seed": 7}
