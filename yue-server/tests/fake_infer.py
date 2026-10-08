"""Stands in for SheetSage2's infer.py. The uploaded audio's bytes pick what
it does: ok, render_fail, no_score, crash or hang. Like the real one (D-131), it
writes chord symbols only without --melody-only and a piano preview only with
--render-audio."""
import json
import sys
import time
from pathlib import Path

audio, out = Path(sys.argv[1]), Path(sys.argv[sys.argv.index("--output") + 1])
assert "--local-files-only" in sys.argv
melody_only, render = "--melody-only" in sys.argv, "--render-audio" in sys.argv
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
    chord = "" if melody_only else '"Am"'
    (out / "score.abc").write_text(f"X:1\nK:C\n% verse\nV: Vocal\n{chord}C8|\n",
                                   encoding="utf-8", newline="\n")  # fixtures stay byte-stable on Windows
    (out / "downbeat.lab").write_text("0.5\n2.5\n", encoding="utf-8")
    notation = out / "notation"  # what /notation hands out for a re-time (F-090)
    notation.mkdir(exist_ok=True)
    (notation / "song_beats.txt").write_text("0.500\t1\t4\t4\n1.000\t2\t4\t4\n", encoding="utf-8")
    for name in ("song_chords.txt", "song_keys.txt", "song_structures.txt"):
        (notation / name).write_text("0.5\t2.5\tx\n", encoding="utf-8")
    (notation / "song_melody.mid").write_bytes(b"MThd-fake")
if render and mode == "render_fail":
    report["render_error"] = "Could not start the renderer"
elif render and mode != "no_score":
    (out / "piano_mix.wav").write_bytes(b"RIFF-fake")
(out / "result.json").write_text(json.dumps(report), encoding="utf-8")
sys.exit(0 if mode == "ok" else 1)
