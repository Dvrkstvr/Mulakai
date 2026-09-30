"""Stands in for SheetSage2's infer.py. The uploaded audio's bytes pick what
it does: ok, render_fail, no_score, crash or hang."""
import json
import sys
import time
from pathlib import Path

audio, out = Path(sys.argv[1]), Path(sys.argv[sys.argv.index("--output") + 1])
assert "--melody-only" in sys.argv and "--local-files-only" in sys.argv
mode = audio.read_bytes().decode()
out.mkdir(parents=True, exist_ok=True)
report = {"warnings": ["short clip"], "abc_measures": 3, "vocal_notes": 6, "instrumental_notes": 5,
          "duration_seconds": 8.2, "abc_error": None, "render_error": None}
print("Window 1/2", flush=True)
if mode == "hang":
    time.sleep(60)
if mode == "crash":
    print("SheetSage2: CUDA out of memory", flush=True)
    sys.exit(1)
print("Window 2/2", flush=True)
if mode == "no_score":
    report["abc_error"] = "no beats decoded"
else:
    (out / "score.abc").write_text("X:1\nK:C\n% verse\nV: Vocal\nC8|\n", encoding="utf-8")
if mode == "render_fail":
    report["render_error"] = "Could not start the renderer"
elif mode != "no_score":
    (out / "piano_mix.wav").write_bytes(b"RIFF-fake")
(out / "result.json").write_text(json.dumps(report), encoding="utf-8")
sys.exit(0 if mode == "ok" else 1)
