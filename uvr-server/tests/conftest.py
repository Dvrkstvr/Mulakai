from pathlib import Path

import numpy as np
import pytest
import soundfile as sf

from chain import output_path

SR = 44100


def write_tone(path: Path, level: float) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(path), np.full((SR // 10, 2), level, dtype="float32"), SR, subtype="FLOAT")


class FakeRunners:
    """Stands in for run_mdx_headless / run_demucs_headless: records each call
    and writes the files the real runner would, each a constant level so sums
    are checkable."""

    def __init__(self, skip=()):
        self.calls = []
        self.skip = set(skip)

    def _emit(self, kwargs, stems):
        out = Path(kwargs["export_path"])
        for stem, level in stems.items():
            if stem not in self.skip:
                write_tone(output_path(out, kwargs["audio_file_base"], stem), level)

    def mdx(self, **kwargs):
        self.calls.append(("mdx", kwargs))
        self._emit(kwargs, {"Vocals": 0.1, "Instrumental": 0.2})

    def demucs(self, **kwargs):
        self.calls.append(("demucs", kwargs))
        self._emit(kwargs, {"Drums": 0.01, "Bass": 0.02, "Other": 0.03, "Vocals": 0.04})


@pytest.fixture
def runners():
    return FakeRunners()
