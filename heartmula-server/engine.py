"""HeartMuLa behind the worker's Engine interface, with RAM parking.

Both models load once into system RAM. Each job moves only the LM (bf16,
7.3 GB) onto the GPU for the token loop, parks it, then moves only the codec
(fp32, 6.2 GB) up for the decode, and parks that too. With both resident the
LM's KV cache pushes a 16 GB card over budget, and the Windows driver spills
silently at ~25x slower (PLAN.md, "HeartMuLa spike results").

heartlib's own lazy_load is not used: it frees models with `del`, which any
lingering reference defeats (seen in the spike), and it reloads from disk on
every job. Parking with `.to()` moves the tensors in place, so no reference
held anywhere can pin them to the GPU. The pipeline is built with
lazy_load=True only so construction loads nothing, and switched off so its
_unload() never deletes the parked models.

Uses heartlib's preprocess() and _forward() as-is (commit a18c8cb); only the
decode and the write are done here, to get the float audio back instead of a
file.
"""
import gc
from typing import Callable

import torch

from engine_api import Generated, JobCancelled

FRAME_MS = 80
SAMPLE_RATE = 48_000
PARK = torch.device("cpu")
GIB = 1024**3
# heartlib's pipeline defaults, applied when a request leaves a knob on AUTO.
DEFAULT_CFG, DEFAULT_TEMPERATURE, DEFAULT_TOPK = 1.5, 1.0, 50


class HeartMulaEngine:
    def __init__(self, model_path: str, version: str = "3B", device: str = "cuda",
                 vram_budget_gb: float = 0.0):
        self.model_path, self.version = model_path, version
        self.device = torch.device(device)
        self.vram_budget_gb = vram_budget_gb
        self.pipe = None

    def _cap_vram(self) -> None:
        # Past this cap PyTorch raises OutOfMemoryError instead of letting the
        # Windows driver spill into shared memory. The spike's reserved peak is
        # 12.85 GiB whatever the song length (the KV cache is preallocated).
        if self.device.type != "cuda":
            return
        index = self.device.index if self.device.index is not None else torch.cuda.current_device()
        total = torch.cuda.get_device_properties(index).total_memory / GIB
        budget = self.vram_budget_gb or total - 2
        torch.cuda.set_per_process_memory_fraction(min(1.0, budget / total), index)

    def load(self) -> None:
        from heartlib import HeartMuLaGenPipeline
        from heartlib.heartcodec.modeling_heartcodec import HeartCodec
        from heartlib.heartmula.modeling_heartmula import HeartMuLa

        if not self.model_path:
            raise ValueError("HEARTMULA_MODEL_PATH is not set (heartlib's ckpt folder)")
        self._cap_vram()
        pipe =HeartMuLaGenPipeline.from_pretrained(
            self.model_path, device=self.device, version=self.version, lazy_load=True,
            dtype={"mula": torch.bfloat16, "codec": torch.float32})
        pipe._mula = HeartMuLa.from_pretrained(pipe.mula_path, device_map="cpu", dtype=torch.bfloat16)
        pipe._codec = HeartCodec.from_pretrained(pipe.codec_path, device_map="cpu", dtype=torch.float32)
        pipe.lazy_load = False
        self.pipe = pipe

    def generate(self, request: dict, on_stage: Callable[[str], None],
                 cancelled: Callable[[], bool]) -> Generated:
        cfg = request.get("cfg_scale") or DEFAULT_CFG
        max_frames = request["max_audio_length_ms"] // FRAME_MS
        inputs = self.pipe.preprocess({"lyrics": request["lyrics"], "tags": request["tags"]}, cfg_scale=cfg)
        context = self.pipe._mula.backbone.max_seq_len
        if inputs["tokens"].shape[-2] + max_frames > context:
            raise ValueError(f"tags + lyrics + max_audio_length_ms exceed HeartMuLa's {context}-position "
                             "context; shorten the lyrics or the max length")
        on_stage("generating")
        frames = self._run_lm(inputs, request, cfg, max_frames, cancelled)
        on_stage("decoding")
        wav = self._run_codec(frames)  # (channels, samples)
        # heartlib's loop appends one frame per step and stops early on EOS, so
        # more than max_frames frames means the cap cut the song off.
        return Generated(audio=wav.T.contiguous().numpy(), sample_rate=SAMPLE_RATE,
                         truncated=frames.shape[-1] > max_frames)

    def _run_lm(self, inputs, request, cfg, max_frames, cancelled) -> torch.Tensor:
        mula = self.pipe._mula
        mula.to(self.device)
        hook = mula.backbone.register_forward_pre_hook(_raise_if(cancelled))
        try:
            with torch.no_grad():
                out = self.pipe._forward(
                    inputs, max_audio_length_ms=max_frames * FRAME_MS, cfg_scale=cfg,
                    temperature=request.get("temperature") or DEFAULT_TEMPERATURE,
                    topk=request.get("topk") or DEFAULT_TOPK)
            return out["frames"].cpu()
        finally:
            hook.remove()
            drop_kv_caches(mula)
            park(mula)

    def _run_codec(self, frames: torch.Tensor) -> torch.Tensor:
        codec = self.pipe._codec
        codec.to(self.device)
        try:
            with torch.no_grad():
                return codec.detokenize(frames.to(self.device)).to(torch.float32).cpu()
        finally:
            park(codec)

    def cleanup(self) -> None:
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()


def _raise_if(cancelled: Callable[[], bool]):
    # The backbone runs once per 80 ms frame, so a cancel lands within one frame.
    # The hook closes over the job's flag only, never over the model.
    def hook(_module, _args):
        if cancelled():
            raise JobCancelled("cancelled during generation")
    return hook


def drop_kv_caches(model: torch.nn.Module) -> None:
    """torchtune 0.4's setup_cache skips any layer whose cache already exists,
    so a long-lived model would reuse job 1's cache (and its CFG batch size)
    forever and park ~5 GB of it in RAM. Back to the fresh-model state instead;
    setup_caches() rebuilds them at the start of the next job."""
    for module in list(model.modules()):
        if getattr(module, "kv_cache", None) is not None:
            module.kv_cache = None
            module.cache_enabled = False


def park(model: torch.nn.Module) -> None:
    model.to(PARK)
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
