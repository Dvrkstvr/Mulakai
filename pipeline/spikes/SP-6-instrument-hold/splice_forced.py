"""SP-6 throwaway: splice the forced-prefix renders (F, FB) into v1 with yue-server's OWN splice code, in process (no app code changed).
yue-server's HTTP routes only splice a render job it ran itself, so this registers F's audio as a finished fake render job in a
private JobStore and runs splice_job.run_splice on it, exactly as the worker would (same spec as the /v1/splices calls of the other arms).
Run in WSL, yue-server stopped:  ~/yue2/.venv/bin/python splice_forced.py Gertar Funky Acid"""
import json, shutil, sys, os
from pathlib import Path

YUE = "/mnt/e/repos/Mulakai/.claude/worktrees/docs-c3/yue-server"
HERE = "/mnt/e/repos/Mulakai/.claude/worktrees/docs-c3/pipeline/spikes/SP-6-instrument-hold"
OUT = "/mnt/e/ai/tmp/sp6/out"
sys.path.insert(0, YUE)
from jobs import JobStore                      # noqa: E402
from transcriber import Transcriber            # noqa: E402
from splice_job import run_splice, sheetsage_tracker  # noqa: E402
from splice_spec import check_spec             # noqa: E402

INP = json.load(open(f"{HERE}/inputs.json"))
for _v in INP.values():
    _v["v1_file"] = _v["v1_file"].replace("E:/", "/mnt/e/")   # inputs.json holds Windows paths
home = Path.home()
store = JobStore(home / "sp6-fp-data", 8, 86400 * 365)
tracker = sheetsage_tracker(Transcriber(str(home / "sheetsage2/.venv/bin/python"), str(home / "sheetsage2/SheetSage2")))

for key in [a for a in sys.argv[1:] if not a.startswith("--")]:
    s = INP[key]
    for arm in ("F", "FB", "P"):
        d = f"{OUT}/{key}/{arm}"
        if not os.path.exists(d + "/render.flac") or os.path.exists(d + "/spliced.wav"):
            continue
        job, _ = store.submit({"seed": s["seed"], "id": f"fp-{key}-{arm}"}, kind="song")
        store.claim(timeout=1)
        store.finish(job["id"], "succeeded", result={"audio_seconds": json.load(open(d + "/forced.json"))["seconds"]})
        folder = store.artifact_dir(job["id"])
        folder.mkdir(parents=True, exist_ok=True)
        shutil.copy(d + "/render.flac", folder / "audio.flac")
        (folder / "score.abc").write_text(s["edited_abc"], encoding="utf-8")
        spec = check_spec({"op": {"op": "REHARMONIZE", "from_bar": s["span"][0], "to_bar": s["span"][1]}, "base_abc": s["base_abc"],
                           "render_job": job["id"], "edited_abc": s["edited_abc"]}, store)
        sj, _ = store.submit({"source": s["v1_file"], "filename": os.path.basename(s["v1_file"]), "sha256": "x", "spec": spec}, kind="splice")
        store.claim(timeout=1)
        run_splice(tracker, store, sj["id"], {"source": s["v1_file"], "spec": spec})
        done = store.get(sj["id"])
        json.dump(done, open(d + "/splice_job.json", "w"), indent=1)
        res = done["result"] or {}
        print(key, arm, done["status"], res.get("verdict"), res.get("reason"), res.get("joins_s"), res.get("null_test"), res.get("length_diff_s"), done.get("error"), flush=True)
        sd = store.artifact_dir(sj["id"])
        for name in ("audio.wav", "out.grid.json", "base.grid.json", "render.grid.json"):
            if (sd / name).is_file():
                shutil.copy(sd / name, d + ("/spliced.wav" if name == "audio.wav" else "/grid_" + name.split(".")[0] + ".json"))
