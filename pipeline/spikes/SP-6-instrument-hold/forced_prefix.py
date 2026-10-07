"""SP-6 arm E2 (throwaway, run in WSL with ~/yue2/.venv/bin/python, yue-server STOPPED so the GPU is free).
Question: YuE2 takes no audio reference (see RESULT.md), but its AR stage is a token LM: can the *semantic tokens* of the
base take-over, as an in-context prefix, keep the instruments when the score changes?  F = base's semantic tokens up to the
span's first bar are appended to the prompt (teacher-forced), then the AR continues under the EDITED score; FB = same with
the instruments-first style.  The base here is Z (the unedited score rendered with v1's seed), because the product's v1
tokens are not kept anywhere (that is the point: the real build would have to save them).
usage: python forced_prefix.py Acid Gertar Funky   (reads inputs.json, A's splice parts for the render-time span start)
Writes E:/ai/tmp/sp6/out/<song>/{F,FB,Zcheck}/render.flac and tokens."""
import json, sys, time
from dataclasses import replace
import numpy as np
import soundfile as sf
from yue2 import YuE2Pipeline
from yue2.protocol import SongRequest, CODEC_OFFSET
from yue2.pipeline import SemanticResult

HERE = "/mnt/e/repos/Mulakai/.claude/worktrees/docs-c3/pipeline/spikes/SP-6-instrument-hold"
OUT = "/mnt/e/ai/tmp/sp6/out"
INP = json.load(open(f"{HERE}/inputs.json"))
pipe = YuE2Pipeline.from_pretrained("m-a-p/YuE2-3B", vae="m-a-p/YuE2-Vae", device="cuda", backend="torch",
                                    memory_budget_gib=24.0, progress=False)


def req(s, abc, style):
    return SongRequest(style=style, lyrics=s["lyrics"], cot=s["cot"], seed=s["seed"], abc=abc)


def render(sem):
    audio = pipe.decode(pipe.synthesize(sem))
    return np.asarray(audio, dtype=np.float32)


for key in [a for a in sys.argv[1:] if not a.startswith("--")]:
    s = INP[key]
    t0 = time.time()
    a_splice = json.load(open(f"{OUT}/{key}/A/splice_job.json"))["result"]
    part = [p for p in a_splice["parts"] if p["source"] == "render"][0]
    cut_s = part["src_s"][0]  # render-time second where the span starts (A's render)
    # 1) the base's tokens: the unedited score
    plan_z = pipe.plan(request=req(s, s["base_abc"], s["style"]["A"]))
    sem_z = pipe.generate_semantic(plan_z)
    zr = json.load(open(f"{OUT}/{key}/Z/render_job.json"))["result"]["audio_seconds"]
    rate = len(sem_z.tokens) / zr
    ncut = int(round(rate * cut_s))
    print(f"{key}: Z tokens {len(sem_z.tokens)} for {zr:.2f}s -> {rate:.2f}/s; span starts at render {cut_s:.2f}s -> force {ncut} tokens", flush=True)
    np.save(f"{OUT}/{key}/Z_tokens.npy", np.asarray(sem_z.tokens, dtype=np.int32))
    forced = [int(t) + CODEC_OFFSET for t in sem_z.tokens[:ncut]]
    for arm, style in (("F", s["style"]["A"]), ("FB", s["style"]["B"])):
        plan_e = pipe.plan(request=req(s, s["edited_abc"], style))
        prefix = plan_e.prefix + forced
        sampling = replace(pipe.generation_config.semantic, max_tokens=pipe.generation_config.semantic.max_tokens - ncut)
        ids, timing, trunc = pipe._generate(prefix, sampling, plan_e.request.seed, "semantic", negative=None, cfg_scale=1.0, legacy_off=False)
        tokens = sem_z.tokens[:ncut] + [int(t) - CODEC_OFFSET for t in ids]
        sem = SemanticResult(plan_e, tokens, timing, trunc)
        audio = render(sem)
        import os
        d = f"{OUT}/{key}/{arm}"
        os.makedirs(d, exist_ok=True)
        sf.write(f"{d}/render.flac", audio, 48000, subtype="PCM_24")
        json.dump(dict(cut_s=cut_s, ncut=ncut, rate=rate, n_tokens=len(tokens), truncated=bool(trunc), seconds=len(audio) / 48000), open(f"{d}/forced.json", "w"))
        print(f"{key}:{arm} {len(tokens)} tokens, {len(audio)/48000:.2f}s, truncated={trunc}, {time.time()-t0:.0f}s", flush=True)
    # sanity: the base tokens decode to the same render as yue-server's Z
    if "--check" in sys.argv:
        import os
        d = f"{OUT}/{key}/Zcheck"
        os.makedirs(d, exist_ok=True)
        sf.write(f"{d}/render.flac", render(sem_z), 48000, subtype="PCM_24")
