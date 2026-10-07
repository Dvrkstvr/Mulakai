"""SP-4: SheetSage2 (melody + chords + downbeats) on every wav in TMP/<dir> (default out), cached in ~/sp4/ss/<stem>.
WSL: ~/sheetsage2/.venv/bin/python transcribe_outs.py [dir] [stem-glob]"""
import fnmatch, os, subprocess, sys, time
HOME = os.path.expanduser("~"); SS = f"{HOME}/sp4/ss"; SSD = f"{HOME}/sheetsage2/SheetSage2"; PY = f"{HOME}/sheetsage2/.venv/bin/python"
d = "/mnt/e/ai/tmp/sp4/" + (sys.argv[1] if len(sys.argv) > 1 else "out"); pat = sys.argv[2] if len(sys.argv) > 2 else "*"
for f in sorted(os.listdir(d)):
    if not f.endswith(".wav") or not fnmatch.fnmatch(f[:-4], pat) or ".w0." in f:
        continue
    stem = f[:-4]; out = f"{SS}/{stem}"
    if os.path.exists(f"{out}/result.json"):
        continue
    os.makedirs(out, exist_ok=True); t0 = time.time()
    r = subprocess.run([PY, "infer.py", f"{d}/{f}", "--output", out, "--local-files-only"], cwd=SSD, capture_output=True, text=True)
    print(stem, "rc", r.returncode, f"{time.time() - t0:.1f}s", flush=True)
    if r.returncode:
        print((r.stdout + r.stderr)[-300:])
