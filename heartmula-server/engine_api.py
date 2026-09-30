"""What the job worker needs from an engine. Torch-free, so the API, the queue
and their tests run without heartlib or a GPU (tests pass a fake engine)."""
from dataclasses import dataclass
from typing import Callable, Protocol

import numpy as np


class JobCancelled(InterruptedError):
    """Raised inside a job when its cancel flag is seen."""


@dataclass
class Generated:
    audio: np.ndarray  # float32, shape (samples, channels); peaks may exceed 1.0
    sample_rate: int
    truncated: bool  # the LM hit max_audio_length_ms instead of ending the song itself


class Engine(Protocol):
    def load(self) -> None: ...

    def generate(self, request: dict, on_stage: Callable[[str], None],
                 cancelled: Callable[[], bool]) -> Generated: ...

    def cleanup(self) -> None: ...
