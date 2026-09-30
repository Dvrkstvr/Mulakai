"""Adapter over the official YuE2 pipeline (`yue2-infer`, installed into this
venv, never vendored). It is the only module that imports torch or yue2, so
the HTTP layer and worker are testable without a GPU.

Written against yue2-infer 0.1.6 (upstream commit 18a07bb). Two private
pipeline members are used, both only here:
- `_status`: the staged API reports ODE-step and decode-chunk progress only
  to its own stderr reporter, so a subclass taps it for `progress`.
- `_model` / `_vae`: parking after a cancelled or failed job, when the
  pipeline's own decode-time parking never ran.
Generation itself only uses the public staged API. Re-check both private
members whenever the yue2-infer pin moves.
"""
from __future__ import annotations

from contextlib import contextmanager

from settings import Settings

SAMPLE_RATE = 48000


class _StageTap:
    """Forwards to the pipeline's stage reporter and mirrors update() calls."""

    def __init__(self, stage, sink):
        self._stage, self._sink = stage, sink

    def update(self, completed, total=None):
        self._stage.update(completed, total=total)
        if self._sink is not None and total:
            self._sink(completed, total)

    def __getattr__(self, name):
        return getattr(self._stage, name)


def _tapped(base):
    class TappedPipeline(base):
        progress_sink = None

        @contextmanager
        def _status(self, label, *, total=None, unit=None):
            with super()._status(label, total=total, unit=unit) as stage:
                yield _StageTap(stage, self.progress_sink)

    return TappedPipeline


class YuePipeline:
    sample_rate = SAMPLE_RATE

    def __init__(self, settings: Settings):
        import torch
        from yue2 import YuE2Pipeline
        from yue2.protocol import SongRequest

        self._torch, self._request_type = torch, SongRequest
        # progress=True is required: the pipeline only reports synthesis and
        # decode steps when its reporter is on (it also logs to stderr).
        self.pipe = _tapped(YuE2Pipeline).from_pretrained(
            settings.model, vae=settings.vae, device="cuda", backend="torch",
            memory_budget_gib=settings.budget_gib, quantization=settings.quantization,
            offload_ar=settings.offload_ar, progress=True)

    def plan(self, request: dict, *, cancelled, on_token):
        song = self._request_type(**request)
        return self.pipe.plan(request=song, cancelled=cancelled, on_token=on_token)

    def semantic(self, plan, *, cancelled, on_token):
        return self.pipe.generate_semantic(plan, cancelled=cancelled, on_token=on_token)

    def synthesize(self, semantic, *, cancelled, on_progress):
        with self._sink(on_progress):
            return self.pipe.synthesize(semantic, cancelled=cancelled)

    def decode(self, latents, *, on_progress):
        with self._sink(on_progress):
            return self.pipe.decode(latents)

    def save_audio(self, audio, path) -> None:
        import soundfile as sf
        # Same format as yue2's own SongResult.save: 48 kHz stereo PCM_24 FLAC.
        sf.write(path, audio, SAMPLE_RATE, subtype="PCM_24")

    def park(self) -> None:
        """Move weights to system RAM and hand the cached VRAM back."""
        for name in ("_model", "_vae"):
            module = getattr(self.pipe, name, None)
            if module is not None:
                module.to("cpu")
        self._torch.cuda.empty_cache()

    @contextmanager
    def _sink(self, on_progress):
        self.pipe.progress_sink = on_progress
        try:
            yield
        finally:
            self.pipe.progress_sink = None
