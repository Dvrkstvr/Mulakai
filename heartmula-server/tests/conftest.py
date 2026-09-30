import os
import sys
import threading
from pathlib import Path

import numpy as np
import pytest

# Tests must never touch the GPU, even in the heartlib venv where CUDA torch is installed.
os.environ["CUDA_VISIBLE_DEVICES"] = ""
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from engine_api import Generated  # noqa: E402


class FakeEngine:
    """Stands in for HeartMulaEngine: no torch, no GPU. `gate` lets a test hold
    a job inside generate() to observe the running state or cancel it."""

    def __init__(self, *, fail_load=None, error=None, peak=1.25, truncated=False, gated=False):
        self.fail_load, self.error, self.peak, self.truncated = fail_load, error, peak, truncated
        self.gate = threading.Event()
        self.entered = threading.Event()
        if not gated:
            self.gate.set()
        self.requests, self.cleanups = [], 0

    def load(self):
        if self.fail_load:
            raise self.fail_load

    def generate(self, request, on_stage, cancelled):
        self.requests.append(request)
        on_stage("generating")
        self.entered.set()
        self.gate.wait(5)
        if cancelled():
            from engine_api import JobCancelled
            raise JobCancelled("cancelled during generation")
        if self.error:
            raise self.error
        on_stage("decoding")
        t = np.linspace(0, 1, 4800, dtype=np.float32)
        wave = (self.peak * np.sin(2 * np.pi * 440 * t)).astype(np.float32)
        return Generated(audio=np.stack([wave, wave], axis=1), sample_rate=48_000, truncated=self.truncated)

    def cleanup(self):
        self.cleanups += 1


@pytest.fixture
def lyrics():
    return "[Verse]\nhello there\n[Chorus]\nla la la"
