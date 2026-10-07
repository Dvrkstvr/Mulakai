"""SP-4: build listen/index.html (+ mp3s) from results/splice_*.json and the healed audio. WSL venv python (needs ffmpeg).
python build_listen.py   -> listen/index.html, listen/*.mp3 (git-ignored), listen/pairs.json (the key: which take is the edited one)
The page is blind (A/B order shuffled per pair); the shaded bars are the bars the edit touches; seams show only after 'reveal'."""
import json, os, random, subprocess, sys
import numpy as np
from sp4lib import *

SPANS = json.load(open(f"{SPIKE}/spans.json"))
LDIR = f"{SPIKE}/listen"; os.makedirs(LDIR, exist_ok=True)
random.seed(4)
NEWL = {}
for c in "ABCD":
    jb = json.load(open(f"{SPIKE}/jobs/{c}_L.json", encoding="utf-8"))
    NEWL[c] = next(b for b in jb["lyrics"].split("\n\n") if b.startswith("[Chorus]")).split("\n")[1:]
TITLE = {"A": "Purple Shinings (4/4, 87 BPM)", "B": "Romantica (Latin pop, 93 BPM)", "C": "Gertar (German, 85 BPM)", "D": "Carinito (Latin pop, 95 BPM)"}
QEDIT = {
    "reharm": "Do the chords in the shaded bars sound different (jazzier, new harmony) in the edited one?",
    "phrase": "Do you hear a new instrumental line (a tenor sax) in the shaded bars of the edited one?",
    "lyrics": "Do you hear the NEW words in the shaded chorus of the edited one?",
    "repeat": "Does the chorus now play twice in a row, the second time like the first?",
    "cut": "Is the verse gone, and does the song carry on naturally from where it was cut?",
}
# (song, edit, variant, extra?) ; variant 'A3'/'C1' = plain splice, 'A3_bal' / 'A3_con' / 'C1_bal' / 'C1_con' = healed
PAIRS = [(c, e, "A3" if e in ("reharm", "phrase", "lyrics") else "C1", False) for e in ("reharm", "lyrics", "phrase", "repeat", "cut") for c in "ABCD"]
EXTRAS = json.load(open(f"{SPIKE}/listen_extras.json")) if os.path.exists(f"{SPIKE}/listen_extras.json") else []
PAIRS += [tuple(x) + (True,) for x in EXTRAS]


def dur_of(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path], capture_output=True, text=True, check=True)
    return float(r.stdout.strip())


def mp3(src, dst):
    if not os.path.exists(dst):
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-ac", "2", "-filter:a", "volume=-3dB", "-c:a", "libmp3lame", "-q:a", "1", dst], check=True)


def make(n, code, ename, vname, extra):
    sp = SPANS[code]; ed = sp["edits"][ename]; s, e = ed["span"]; kind = ed["kind"]; nn = e - s
    sj = json.load(open(f"{SPIKE}/results/splice_{code}.json"))
    if vname == "control":
        return make_control(n, code, ename, extra)
    base_v = vname.split("_")[0]
    v = sj["variants"][f"{ename}_{base_v}"]
    gb = Grid(sp["base_ss"], sp["base_score"])
    tb = [gb.t(i) for i in range(gb.n + 1)]
    base_wav = LIB + sp["vid"] + ".wav"
    var_wav = v["path"] if "_" not in vname else f"{TMP}/heal/{code}_{ename}_{vname}.wav"
    if not os.path.exists(var_wav):
        print("missing", var_wav); return None
    bmp3 = f"{LDIR}/{code}_orig.mp3"; mp3(base_wav, bmp3)
    vmp3 = f"{LDIR}/{code}_{ename}_{vname}.mp3"; mp3(var_wav, vmp3)
    dur_o = len(load(base_wav)) / SR if False else gb.dur
    dur_e = v["out_seconds"]
    tb[-1] = dur_of(base_wav)
    parts = list(zip(v["map"], v["src"]))
    ticks = []   # (out_time, base_bar_index)
    fwd, bwd = [], []
    new_rng = None; copy_rng = None
    tbs, tbe = v["base_span_s"]
    for (o0, o1, k, s0), srcn in parts:
        if srcn == "new":
            fwd.append([tbs, tbe, o0, o1]); bwd.append([o0, o1, tbs, tbe]); new_rng = (o0, o1)
            for i in range(gb.n):
                if tbs - 1e-3 <= tb[i] < tbe - 1e-3:
                    ticks.append((o0 + (tb[i] - tbs) / (tbe - tbs) * (o1 - o0), i, "new"))
        else:
            L = o1 - o0
            if srcn == "base":
                fwd.append([s0, s0 + L, o0, o1])
            bwd.append([o0, o1, s0, s0 + L])
            if srcn == "copy":
                copy_rng = (o0, o1)
            for i in range(gb.n):
                if s0 - 1e-3 <= tb[i] < s0 + L - 1e-3:
                    ticks.append((o0 + (tb[i] - s0), i, srcn))
    if kind == "cut":
        j = v["join_out_s"][0]; fwd.append([tbs, tbe, j, j]); fwd.sort()
    ticks.sort(key=lambda x: x[0])
    bar_t = [t for t, _, _ in ticks] + [dur_e]
    # shaded bars (1-based inclusive) in each take
    def idx_in(rng):
        ids = [k for k, (t, _, w) in enumerate(ticks) if rng[0] - 1e-3 <= t < rng[1] - 1e-3]
        return (ids[0] + 1, ids[-1] + 1) if ids else None
    if kind == "local":
        a, b = idx_in(new_rng); shadeE = [[a, b, "edited bars"]]; shadeO = [[s + 1, e, "edited bars"]]
        revealText = f"Shaded = the bars the edit changed. The old audio is kept everywhere else; the red marks are the two joins (bar {a} and the end of bar {b})."
        jumps = [[f"bars {s + 1}-{e} (starts one bar early)", tb[max(s - 1, 0)], bar_t[max(a - 2, 0)]], ["end of the edited bars (starts one bar early)", tb[e - 1], bar_t[max(b - 1, 0)]]]
    elif kind == "repeat":
        a, b = idx_in(copy_rng); shadeE = [[s + 1, e, "chorus"], [a, b, "copy"]]; shadeO = [[s + 1, e, "chorus"]]
        revealText = f"The first chorus (bars {s + 1}-{e}) now plays twice: the copy is bars {a}-{b}. The red mark is where the chorus runs into its copy (the second join is only where the copy hands back to the music that followed anyway)."
        jumps = [["end of chorus 1", tb[e - 1], bar_t[e - 1]], ["the copy", tb[max(e - 1, 0)], bar_t[a - 2] if a >= 2 else 0.0], ["end of the copy", tb[e - 1], bar_t[b - 1]]]
    else:
        shadeE = []; shadeO = [[s + 1, e, "bars removed in the edited one"]]
        sb = int(round(np.searchsorted(np.array(bar_t[:-1]), v["join_out_s"][0] - 0.05))) + 1
        revealText = f"Bars {s + 1}-{e} of the original (shaded in the original) are gone in the edited one; the red mark is where the music before and after them was joined (bar {sb} of the edited one)."
        jumps = [["the cut spot", tb[max(s - 1, 0)], bar_t[max(sb - 2, 0)]]]
    edit_is_A = random.random() < 0.5
    title = f"{TITLE[code]} · {ed['label']}" + (" (optional extra)" if extra else "")
    hint = {"reharm": "A new chord progression for the first chorus's bars.", "phrase": "A 4-bar tenor-sax line written over the shaded bars.",
            "lyrics": "New words for the first chorus: " + " / ".join(NEWL[code][:2]) + " ...", "repeat": "The first chorus is repeated right after itself.",
            "cut": "The verse is removed."}[ename]
    return {"id": f"p{n}", "n": n, "title": title, "hint": hint, "candidate": f"{ename}/{vname}", "edited": "A" if edit_is_A else "B", "orig": f"{code}_orig.mp3",
            "edit": f"{code}_{ename}_{vname}.mp3", "barsOrig": tb, "barsEdit": bar_t, "shadeOrig": shadeO, "shadeEdit": shadeE, "fwd": fwd, "bwd": bwd, "jumps": jumps,
            "seams": v["join_out_s"], "qEdit": QEDIT[ename], "revealText": revealText}


def make_control(n, code, ename, extra):
    sp = SPANS[code]; ed = sp["edits"][ename]; s, e = ed["span"]
    gb = Grid(sp["base_ss"], sp["base_score"]); N = len(A.Sc(ed["score"]).bars)
    gc = Grid(ed["render"], ed["score"], fit_idx=[i for i in range(N) if not (s <= i < e)])
    base_wav = LIB + sp["vid"] + ".wav"; ctl = f"{REN}/{ed['render']}/audio.flac"
    do, de = dur_of(base_wav), dur_of(ctl)
    tb = [gb.t(i) for i in range(gb.n)] + [do]; bt = [gc.t(i) for i in range(N)] + [de]
    mp3(base_wav, f"{LDIR}/{code}_orig.mp3"); mp3(ctl, f"{LDIR}/{code}_{ename}_control.mp3")
    fwd = [[tb[i], tb[i + 1], bt[i], bt[i + 1]] for i in range(N)]; bwd = [[bt[i], bt[i + 1], tb[i], tb[i + 1]] for i in range(N)]
    title = f"{TITLE[code]} · {ed['label']} · whole song re-rendered (what happens today)"
    return {"id": f"p{n}", "n": n, "title": title + " (optional extra)", "hint": "Calibration pair: the edited one is simply the whole song re-rendered from the edited score, no splicing.", "candidate": f"{ename}/control",
            "edited": "A" if random.random() < 0.5 else "B", "orig": f"{code}_orig.mp3", "edit": f"{code}_{ename}_control.mp3", "barsOrig": tb, "barsEdit": bt,
            "shadeOrig": [[s + 1, e, "edited bars"]], "shadeEdit": [[s + 1, e, "edited bars"]], "fwd": fwd, "bwd": bwd,
            "jumps": [[f"bars {s + 1}-{e} (starts one bar early)", tb[max(s - 1, 0)], bt[max(s - 1, 0)]]], "seams": [], "qEdit": QEDIT[ename],
            "revealText": "No joins here: this is the full re-render. Compare how much of the rest of the song moved."}


def main():
    out = []
    for n, (code, ename, vname, extra) in enumerate(PAIRS, 1):
        p = make(n, code, ename, vname, extra)
        if p:
            out.append(p)
    html = open(f"{SPIKE}/listen_template.html", encoding="utf-8").read().replace("/*PAIRS*/[]", json.dumps(out))
    open(f"{LDIR}/index.html", "w", encoding="utf-8").write(html)
    json.dump([{k: p[k] for k in ("id", "n", "title", "candidate", "edited")} for p in out], open(f"{LDIR}/pairs.json", "w"), indent=1)
    print(len(out), "pairs ->", f"{LDIR}/index.html")


if __name__ == "__main__":
    main()
