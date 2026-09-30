"""Environment configuration for yue-server. Every knob is optional; the
defaults are the ones the 2026-09-30 WSL2 spike settled on (bf16, torch
backend, default budget, no fp8, no --offload-ar). See README.md."""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


def _flag(value: str) -> bool:
    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    api_key: str = ""
    host: str = "127.0.0.1"
    port: int = 8004
    data_dir: Path = Path(__file__).parent / "data"
    model: str = "m-a-p/YuE2-3B"
    vae: str = "m-a-p/YuE2-Vae"
    # yue2's own CLI default. The pipeline caps PyTorch at
    # min(budget, card total) - 2 GiB, so on a 16 GB card this means ~14 GiB.
    budget_gib: float = 24.0
    quantization: str = "none"
    offload_ar: bool = False
    max_pending: int = 4
    retention_hours: float = 24.0
    # SheetSage2 transcription (PLAN.md, "yue-server transcription decisions"): its own
    # venv's python and the downloaded snapshot holding infer.py. Unset = no covers.
    sheetsage_python: str = ""
    sheetsage_dir: str = ""
    max_upload_mb: float = 100.0

    @classmethod
    def from_env(cls, env: dict[str, str] | None = None) -> "Settings":
        env = os.environ if env is None else env
        default = cls()
        quantization = env.get("YUE_QUANTIZATION", default.quantization)
        if quantization not in {"none", "fp8"}:
            raise ValueError("YUE_QUANTIZATION must be none or fp8")
        return cls(
            api_key=env.get("YUE_API_KEY", ""),
            host=env.get("YUE_HOST", default.host),
            port=int(env.get("YUE_PORT", default.port)),
            data_dir=Path(env.get("YUE_DATA_DIR", default.data_dir)),
            model=env.get("YUE_MODEL", default.model),
            vae=env.get("YUE_VAE", default.vae),
            budget_gib=float(env.get("YUE_BUDGET_GIB", default.budget_gib)),
            quantization=quantization,
            offload_ar=_flag(env.get("YUE_OFFLOAD_AR", "")),
            max_pending=int(env.get("YUE_MAX_PENDING", default.max_pending)),
            retention_hours=float(env.get("YUE_RETENTION_HOURS", default.retention_hours)),
            sheetsage_python=os.path.expanduser(env.get("YUE_SHEETSAGE_PYTHON", "")),
            sheetsage_dir=os.path.expanduser(env.get("YUE_SHEETSAGE_DIR", "")),
            max_upload_mb=float(env.get("YUE_MAX_UPLOAD_MB", default.max_upload_mb)),
        )
