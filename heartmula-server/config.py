"""Settings, read once from the environment."""
import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    model_path: str = ""  # heartlib's ckpt dir: HeartMuLa-oss-3B/, HeartCodec-oss/, tokenizer.json, gen_config.json
    version: str = "3B"
    device: str = "cuda"
    vram_budget_gb: float = 0.0  # PyTorch cap for this process; 0 = the card's total minus 2 GiB
    api_key: str = ""  # '' = no auth; bind to 127.0.0.1 in that case
    data_dir: Path = Path(__file__).parent / "data"
    max_pending: int = 4  # queued + running; Mulakai's genLock sends one at a time anyway
    retention_hours: float = 24.0


def from_env() -> Settings:
    env = os.environ.get
    return Settings(
        model_path=env("HEARTMULA_MODEL_PATH", ""),
        version=env("HEARTMULA_VERSION", "3B"),
        device=env("HEARTMULA_DEVICE", "cuda"),
        vram_budget_gb=float(env("HEARTMULA_VRAM_BUDGET_GB", "0")),
        api_key=env("HEARTMULA_API_KEY", ""),
        data_dir=Path(env("HEARTMULA_DATA_DIR", str(Settings.data_dir))),
        max_pending=int(env("HEARTMULA_MAX_PENDING", "4")),
        retention_hours=float(env("HEARTMULA_RETENTION_HOURS", "24")),
    )
