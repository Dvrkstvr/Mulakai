"""
Thin HTTP wrapper around uvr-headless-runner
(https://github.com/chyinan/uvr-headless-runner), which runs Ultimate Vocal
Remover's separation code headless. A drop-in for demucs-server: same /split
contract, same port, reached through the same DEMUCS_API_URL. The difference
is a Roformer model for the vocals stem (see chain.py and PLAN.md "UVR
Separator: Roformer Vocals for SPLIT").

It needs its own venv: the runner installs top-level `demucs`, `separate`,
`cli`, ... modules that clash with the pip `demucs` in demucs-server's venv.
For the same reason no module here may share a name with one of the runner's.

Run: uvicorn main:app --port 8002
"""
import gc
import os
from pathlib import Path

from api import create_app
from uvr_models import demucs_model_path, mdx_config_json

VOCAL_MODEL = os.environ.get("UVR_VOCAL_MODEL", "Roformer Model: BS-Roformer-Viperx-1297")
DEMUCS_MODEL = os.environ.get("UVR_DEMUCS_MODEL", "htdemucs")
DATA_DIR = Path(os.environ.get("UVR_DATA_DIR", Path(__file__).parent / "data"))
# Seconds an unfetched split's files are kept (see job_files.py).
RESULT_TTL = float(os.environ.get("UVR_RESULT_TTL", "900"))
# Outside DATA_DIR, which is served as /audio.
CONFIG_DIR = Path(__file__).parent / "model-configs"


def _run_mdx(model_path, **kwargs):
    from mdx_headless_runner import get_model_hash, resolve_model_path, run_mdx_headless

    path = resolve_model_path(model_path, verbose=False)
    config = mdx_config_json(get_model_hash(path), CONFIG_DIR)
    return run_mdx_headless(
        model_path=path, model_json_path=str(config) if config else None, **kwargs
    )


def _run_demucs(model_path, **kwargs):
    # Unlike run_mdx_headless, the runner's Demucs entry point doesn't resolve
    # registry names or download models itself; its CLI does this first.
    from demucs_headless_runner import find_demucs_model_path, resolve_model_path, run_demucs_headless

    path = demucs_model_path(model_path, find_demucs_model_path, resolve_model_path)
    return run_demucs_headless(model_path=path, **kwargs)


def _free_gpu():
    # The models are loaded per call; hand their VRAM back to ACE-Step and
    # the engines between splits.
    import torch

    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()


app = create_app(_run_mdx, _run_demucs, _free_gpu, DATA_DIR, VOCAL_MODEL, DEMUCS_MODEL, RESULT_TTL)
