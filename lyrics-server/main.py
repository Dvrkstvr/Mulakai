"""
Reads the words sung in a song (PLAN.md "Cover Lyrics From the Recording"):
faster-whisper large-v3 on the unseparated mix, returning timed segments and
words. Mulakai reaches it only through a URL.

Run: uvicorn main:app --port 8005
"""
import importlib.util
import os
from pathlib import Path

from api import create_app
from asr import make_transcriber

MODEL = os.environ.get("LYRICS_MODEL", "large-v3")
DEVICE = os.environ.get("LYRICS_DEVICE", "cuda")
COMPUTE_TYPE = os.environ.get("LYRICS_COMPUTE_TYPE", "float16")
MODEL_DIR = Path(os.environ.get("LYRICS_MODEL_DIR", Path(__file__).parent / "models"))


def _add_cuda_dlls() -> None:
    # CTranslate2 loads cuBLAS and cuDNN by name. The nvidia-* wheels put them
    # in site-packages/nvidia/<lib>/bin, which Windows doesn't search.
    spec = os.name == "nt" and importlib.util.find_spec("nvidia")
    if not spec:
        return
    for root in spec.submodule_search_locations or []:
        for lib in ("cublas", "cudnn"):
            bin_dir = Path(root) / lib / "bin"
            if bin_dir.is_dir():
                os.add_dll_directory(str(bin_dir))
                os.environ["PATH"] = str(bin_dir) + os.pathsep + os.environ["PATH"]


def _load_model():
    from faster_whisper import WhisperModel

    return WhisperModel(MODEL, device=DEVICE, compute_type=COMPUTE_TYPE, download_root=str(MODEL_DIR))


_add_cuda_dlls()
app = create_app(make_transcriber(_load_model), MODEL)
