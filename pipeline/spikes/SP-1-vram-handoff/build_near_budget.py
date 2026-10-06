"""Run in WSL (yue2 venv). Repeat the first chorus of a real score until it is
just under 4096 tokens (chords kept). Writes near_budget.abc."""
import glob, re, sys
import yue2.pipeline as p
tok = p.YuE2TextTokenizer(glob.glob("/home/calvin/.cache/huggingface/hub/models--m-a-p--YuE2-3B/snapshots/*/qwen.tiktoken")[0])
src = open(sys.argv[1], encoding="utf-8").read().split("\n")
idx = [i for i, l in enumerate(src) if l.startswith("% ")]
names = [src[i] for i in idx]
first_chorus = next(k for k, n in enumerate(names) if n == "% chorus")
a, b = idx[first_chorus], (idx[first_chorus + 1] if first_chorus + 1 < len(idx) else len(src))
chorus = src[a:b]
n = lambda lines: len(tok.encode("\n".join(lines)))
target = int(sys.argv[3]) if len(sys.argv) > 3 else 4050
out = src[:b]; copies = 0
rest = src[b:]
while True:
    cand = out + chorus + rest
    if n(cand) > target: break
    out = out + chorus; copies += 1
final = out + rest
open(sys.argv[2], "w", encoding="utf-8", newline="\n").write("\n".join(final))
print(f"chorus={n(chorus)} tokens; extra copies={copies}; total={n(final)} tokens")
