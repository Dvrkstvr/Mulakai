"""SP-6 arm P (throwaway, WSL, yue-server stopped): the edited score rendered by the plain pipeline call, WITHOUT yue-server's
instrumental conversion (instrumental.arrange), with v1's own lyrics ('[instrumental]').  Isolates what the server's re-render path
changes for an instrumental song.  usage: python plain_arm.py Acid  -> out/<song>/P/render.flac"""
import json, os, sys
import numpy as np, soundfile as sf
from yue2 import YuE2Pipeline
from yue2.protocol import SongRequest
HERE = "/mnt/e/repos/Mulakai/.claude/worktrees/docs-c3/pipeline/spikes/SP-6-instrument-hold"
OUT = "/mnt/e/ai/tmp/sp6/out"
INP = json.load(open(f"{HERE}/inputs.json"))
pipe = YuE2Pipeline.from_pretrained("m-a-p/YuE2-3B", vae="m-a-p/YuE2-Vae", device="cuda", backend="torch", memory_budget_gib=24.0, progress=False)
for key in sys.argv[1:]:
    s = INP[key]
    song = pipe(**SongRequest(style=s["style"]["A"], lyrics=s["lyrics"], cot=s["cot"], seed=s["seed"], abc=s["edited_abc"]).to_dict())
    d = f"{OUT}/{key}/P"; os.makedirs(d, exist_ok=True)
    sf.write(f"{d}/render.flac", np.asarray(song.audio, dtype=np.float32), 48000, subtype="PCM_24")
    json.dump(dict(seconds=len(song.audio) / 48000, seed=s["seed"]), open(f"{d}/forced.json", "w"))
    print(key, "P", len(song.audio) / 48000, flush=True)
