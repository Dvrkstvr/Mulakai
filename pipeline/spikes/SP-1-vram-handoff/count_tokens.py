"""Count YuE2 planner tokens for ABC files WITH chords kept (R-019: /v1/scores/measure strips them).
Run inside WSL in the yue2 venv; tokenizer only, no GPU."""
import sys, glob
import yue2.pipeline as p
tok = p.YuE2TextTokenizer(glob.glob("/home/calvin/.cache/huggingface/hub/models--m-a-p--YuE2-3B/snapshots/*/qwen.tiktoken")[0])
for path in sys.argv[1:]:
    t = open(path, encoding="utf-8").read()
    print(f"{len(tok.encode(t)):6d} tokens  {len(t):6d} chars  {path}")
