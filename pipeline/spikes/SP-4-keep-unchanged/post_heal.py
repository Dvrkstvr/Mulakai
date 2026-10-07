"""SP-4: undo what ACE-Step does to the whole file and record what it did inside the windows. WSL venv python.
ACE-Step peak-normalises its output to -1 dBFS and trims it to a whole number of latent frames; both are undone here
(gain fitted on the samples outside the windows, tail restored from the input) so 'unchanged' can be tested sample by sample.
usage: post_heal.py <heal_jobs_bal.json> ; reads TMP/heal_raw/<id>.wav, writes TMP/heal/<id>.wav and results/healpost_<id>.json"""
import json, os, sys
import numpy as np
from sp4lib import *

jobs = json.load(open(f"{SPIKE}/{sys.argv[1]}", encoding="utf-8"))
w = lambda p: p.replace("E:\\", "/mnt/e/").replace("\\", "/")
os.makedirs(f"{TMP}/heal", exist_ok=True)
for j in jobs:
    raw = w(j["out"])
    if not os.path.exists(raw):
        continue
    src = load(w(j["src"])); out = load(raw)
    n = min(len(src), len(out))
    mask = np.ones(n, dtype=bool)
    for a, b in j["windows"]:
        mask[max(0, int((a - 1.0) * SR)):int((b + 1.0) * SR)] = False       # 1 s margin around each window
    fitm = mask & (np.abs(src[:n]).max(axis=1) <= 1.0)       # ACE-Step clips its input at full scale: do not fit on clipped samples
    x = src[:n][fitm].astype(np.float64).ravel(); y = out[:n][fitm].astype(np.float64).ravel()
    g = float(np.dot(x, y) / np.dot(x, x))
    fixed = (out / g).astype(np.float32)
    if len(fixed) < len(src):
        fixed = np.concatenate([fixed, src[len(fixed):]])       # the trimmed tail is outside every window
    fixed = fixed[:len(src)]
    dif = np.abs(fixed[:n] - src[:n]).max(axis=1) > 1e-6
    dif &= mask
    clipped = np.abs(src[:n]).max(axis=1) > 1.0
    resid = float(np.abs(fixed[:n][mask] - src[:n][mask]).max())
    n_diff = int(dif.sum()); n_diff_not_clipped = int((dif & ~clipped).sum())
    info = {"id": j["id"], "gain_applied_by_acestep": g, "gain_db": 20 * np.log10(g), "len_in": len(src), "len_out_raw": len(out), "tail_restored_samples": max(0, len(src) - len(out)),
            "max_abs_residual_outside": resid, "samples_different_outside": n_diff, "of_which_not_where_src_exceeds_full_scale": n_diff_not_clipped,
            "src_peak": float(np.abs(src).max()), "windows": []}
    for a, b in j["windows"]:
        i0, i1 = int(a * SR), int(b * SR)
        info["windows"].append({"window_s": [a, b], "lufs_in": lufs(src[i0:i1]), "lufs_out": lufs(fixed[i0:i1]), "lufs_delta": lufs(fixed[i0:i1]) - lufs(src[i0:i1])})
    save_wav(f"{TMP}/heal/{j['id']}.wav", fixed)
    json.dump(info, open(f"{SPIKE}/results/healpost_{j['id']}.json", "w"), indent=1)
    print(j["id"], "gain", round(g, 4), "resid", f"{resid:.2e}", "diff outside", n_diff, "not-clipped", n_diff_not_clipped, "window lufs delta", [round(x["lufs_delta"], 1) for x in info["windows"]], flush=True)
