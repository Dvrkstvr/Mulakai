"""SP-6: build the owner listen pack in E:/ai/tmp/sp6-listen/ (excerpts as 16-bit FLAC, index.html, serve.mjs).
Per song: v1 (the reference, always visible) and 5-6 blind candidates (the spliced outputs) in a fixed random order; the same-position
switch is trivial because every splice keeps v1's time axis. Bars are even (span length / bar count): approximate.
usage: python build_listen.py"""
import json, os, random, subprocess
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = "E:/ai/tmp/sp6/out"
PACK = "E:/ai/tmp/sp6-listen"
INP = json.load(open(HERE + "/inputs.json"))
ARM_TEXT = {
    "A": "today's request (control)",
    "B": "instruments first and explicit in the style",
    "C": "B plus 'same instrumentation as the original'",
    "D": "today's style, triads instead of 7ths (same roots)",
    "F": "v1's token prefix forced up to the edit (today's style)",
    "FB": "v1's token prefix forced + instruments-first style",
}
# splices that shortened the song by seconds (the verdict still said ok): their tail no longer lines up with v1, so they stay out of the pack
SKIP = {("Acid", "F"), ("Funky", "B")}
BEFORE, AFTER = {"Acid": 6, "Gertar": 4, "Funky": 6}, {"Acid": 4, "Gertar": 3, "Funky": 3}
os.makedirs(PACK, exist_ok=True)
sets = []
for n, (key, s) in enumerate(INP.items(), 1):
    a, b = s["span"]
    j0, j1 = json.load(open(f"{OUT}/{key}/A/splice_job.json"))["result"]["joins_s"]
    L = (j1 - j0) / (b - a + 1)
    t0 = max(0.0, j0 - BEFORE[key] * L)
    t1 = j1 + AFTER[key] * L
    arms = [x for x in ("A", "B", "C", "D", "F", "FB") if (key, x) not in SKIP and os.path.exists(f"{OUT}/{key}/{x}/spliced.wav")]
    random.Random(1000 + n).shuffle(arms)
    files = {"v1": s["v1_file"], **{x: f"{OUT}/{key}/{x}/spliced.wav" for x in arms}}
    names = {}
    for k, src in files.items():
        name = f"{key}-{'v1' if k == 'v1' else 'c' + str(arms.index(k) + 1)}.flac"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{t0:.3f}", "-t", f"{t1 - t0:.3f}", "-i", src, "-c:a", "flac", "-sample_fmt", "s16", f"{PACK}/{name}"], check=True)
        names[k] = name
    # even bars on the excerpt's clock
    bars, k = [], -int((j0 - t0) / L + 1e-6)  # whole bars before the edit that fit in the excerpt
    start_t = j0 + k * L
    while start_t <= t1 + L:
        bars.append(round(start_t - t0, 3))
        start_t += L
    first_bar = a + k
    sets.append(dict(key=key, n=n, title=f"{s['title']}: reharmonize bars {a}-{b} (the first chorus)", dur=round(t1 - t0, 2),
                     bars=bars, first_bar=first_bar, edit=[a, b], v1=names["v1"], cands=[dict(arm=x, file=names[x], text=ARM_TEXT[x]) for x in arms],
                     jumps=[[f"bar {a} (the edit starts)", round(j0 - t0, 3)], [f"bar {a + (b - a + 1) // 2} (middle of the edit)", round(j0 - t0 + (b - a + 1) // 2 * L, 3)],
                            [f"bar {b + 1} (just after the edit)", round(j1 - t0, 3)]],
                     seams=[round(j0 - t0, 3), round(j1 - t0, 3)]))
    print(key, "excerpt", round(t0, 1), "-", round(t1, 1), "s,", len(arms), "candidates:", arms)
json.dump(sets, open(f"{PACK}/sets.json", "w"), indent=1)
page = open(HERE + "/listen_template.html", encoding="utf-8").read().replace("/*SETS*/", "const SETS=" + json.dumps(sets) + ";")
open(f"{PACK}/index.html", "w", encoding="utf-8").write(page)
open(f"{PACK}/serve.mjs", "w", encoding="utf-8").write(open("E:/ai/tmp/c0b-live/listen/serve.mjs", encoding="utf-8").read().replace("8078", "8079"))
print("pack written to", PACK)
