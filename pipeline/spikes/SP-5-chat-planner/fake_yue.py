"""SP-5 side yue-server: the real create_app (score read/apply routes, CPU only) with a fake pipeline, on a side port.
Usage: python fake_yue.py 8095   (cwd-independent). Serves /v1/scores/read and /v1/scores/apply from E:/repos/Mulakai/yue-server."""
import sys, os, tempfile
from types import SimpleNamespace
YUE = r"E:\repos\Mulakai\yue-server"
sys.path.insert(0, YUE)
os.chdir(YUE)
from pathlib import Path
from settings import Settings
from main import create_app

class FakePipeline:
    sample_rate = 48000
    def count_tokens(self, abc): return int(len(abc) * 0.8)   # same 0.8 x chars estimate SP-2 used
    def fits_plan_budget(self, abc): return True
    def plan(self, *a, **k): raise RuntimeError("no rendering in SP-5")
    def render(self, *a, **k): raise RuntimeError("no rendering in SP-5")
    def close(self): pass

if __name__ == "__main__":
    import uvicorn
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8095
    s = Settings(host="127.0.0.1", port=port, data_dir=Path(r"E:\ai\tmp\sp5\yue-data"))
    uvicorn.run(create_app(s, pipeline_factory=lambda: FakePipeline()), host="127.0.0.1", port=port, workers=1, log_level="warning")
