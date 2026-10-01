# yue-server

Thin HTTP wrapper around the official [YuE2](https://github.com/multimodal-art-projection/YuE)
pipeline, so Mulakai can use YuE2 as an optional **first-take engine** on
Create › PROMPT (see `PLAN.md`, "Multiple Song-Creation Engines"). Every edit
after the first take still runs on ACE-Step.

It runs **inside WSL2**, not on native Windows: on Windows YuE2's acoustic
stage falls back to the MATH attention kernel (~6x slower, ~7 GB more VRAM;
upstream issue #209). In WSL2 it gets FlashAttention and CUDA graphs.

Measured on an RTX 4080 16 GB (2026-09-30): a ~3-minute song takes ~95 s
(RTF 0.54), peaks at ~8.1 GiB in PyTorch (~10.2 GB on the card including the
desktop) and does not spill. Numbers and logs: `PLAN.md`, "YuE2 spike results".

## 1. WSL2 + Ubuntu 24.04

In an **admin** PowerShell:

```powershell
wsl --install --no-distribution   # enables WSL + Virtual Machine Platform
```

**Reboot now.** A distro installed before this reboot never registers. Then:

```powershell
wsl --install -d Ubuntu-24.04
```

No Linux NVIDIA driver is needed; the Windows driver provides CUDA inside
WSL. Check with `wsl -d Ubuntu-24.04 -- nvidia-smi`.

### If Ubuntu's first-run user setup hangs

On the spike machine the "create a default UNIX user" prompt hung and locked
up all of WSL, including `wsl --shutdown`. The fix is to stop the WSL service
and create the user as root instead:

```powershell
# admin PowerShell
Stop-Service WSLService -Force
wsl -d Ubuntu-24.04 -u root
```

Then, inside that root shell (replace `you` with your user name):

```bash
adduser you
usermod -aG sudo you
printf '[boot]\nsystemd=true\n\n[user]\ndefault=you\n' > /etc/wsl.conf
exit
```

and `wsl --terminate Ubuntu-24.04` from PowerShell. The next `wsl -d
Ubuntu-24.04` logs in as that user.

## 2. The venv (inside WSL)

YuE2 pins Python 3.12 and torch 2.10.0, which conflict with ACE-Step's and
HeartMuLa's stacks, so it gets its own venv. Keep it on the Linux filesystem
(`~`), not under `/mnt/`.

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh     # then open a new shell
mkdir -p ~/yue2 && cd ~/yue2
uv venv --python 3.12 .venv
source .venv/bin/activate
uv pip install -r /mnt/e/repos/Mulakai/yue-server/requirements.txt
```

`requirements.txt` installs `yue2-infer` from upstream at the pinned commit
(0.1.6), plus FastAPI and uvicorn. YuE code is never copied into this repo.

## 3. `yue2 doctor` and the weights

```bash
yue2 doctor                   # dependencies + GPU (expects BF16, CC >= 8.0)
yue2 doctor --verify-hashes   # downloads and hash-checks the weights (~7.8 GB)
```

The weights land in the Hugging Face cache (`~/.cache/huggingface/hub`).

## 4. Start the server

`start-all.bat` does this for you: when it finds `~/yue2/.venv` in the
`Ubuntu-24.04` distro (override with `YUE_VENV` / `YUE_DISTRO`), it starts
the server as below and sets `YUE_API_URL` for Mulakai's server.

To run it yourself: WSL does not start on its own, so launch the server from Windows through
`wsl.exe` (a terminal, a shortcut, or a Task Scheduler startup task). The
server process keeps the distro running; closing it lets WSL shut down.

```bat
wsl.exe -d Ubuntu-24.04 --exec bash -lc "cd /mnt/e/repos/Mulakai/yue-server && YUE_DATA_DIR=~/yue-data ~/yue2/.venv/bin/python main.py"
```

(Works from cmd and PowerShell; adjust the `/mnt/e/...` path to your
checkout.) Add `YUE_API_KEY=<secret>` before `~/yue2/...` to require a bearer
key.
Startup verifies the weight hashes (~6 s) and then reports ready; the model
itself is read from disk on the first job (~3 s) and parked in system RAM
after every job, including cancelled and failed ones. Between jobs the
server holds only its CUDA context (~0.8 GB on the card).

Point Mulakai's server at it (Windows side):

```bat
set YUE_API_URL=http://127.0.0.1:8004
set YUE_API_KEY=<secret>          & REM only if you set one above
```

Use `127.0.0.1`, not `localhost`: WSL's NAT-mode forwarding is IPv4-only, so
`[::1]` does not answer, and `localhost` may resolve to it.

**ACE-Step must run with `ACESTEP_OFFLOAD_TO_CPU=true`** whenever an engine
is configured. A YuE2 job needs ~9 GiB free; ACE-Step idles at ~0.5 GB with
offload on and holds far more with it off.

### Recommended: NVIDIA "Prefer No Sysmem Fallback"

On Windows, when a CUDA allocation goes over the card's memory, the driver
spills into shared system RAM instead of failing, which shows up as a silent,
severe slowdown. Setting **NVIDIA Control Panel → Manage 3D settings → CUDA –
Sysmem Fallback Policy → Prefer No Sysmem Fallback** makes a real overrun
fail loudly as an `out_of_memory` job instead. YuE2 already caps its own
PyTorch allocations at the card total minus 2 GiB; the setting guards the
case where something else holds VRAM at the same time. It is a system
setting: Mulakai and this server document it and never change it.

## 5. Covers: SheetSage2 (optional)

YuE2 covers a song by its melody: [SheetSage2](https://huggingface.co/m-a-p/SheetSage2)
transcribes the source into a score, and YuE2 sings that score in a new
style (`PLAN.md`, "YuE2 Melody Covers via SheetSage2"). SheetSage2 pins
Python 3.11, torch 2.8 and NumPy 1.24, which clash with YuE2's venv, so it
gets its own. yue-server runs it as a subprocess, one job at a time on the
same worker, so it never shares the GPU with a song.

Inside WSL (FFmpeg 6.1 comes with Ubuntu 24.04: `sudo apt install ffmpeg`):

```bash
mkdir -p ~/sheetsage2 && cd ~/sheetsage2
uv venv --python 3.11 .venv
uv pip install --python .venv/bin/python huggingface-hub==0.36.0
.venv/bin/huggingface-cli download m-a-p/SheetSage2   --revision cafc0df1021e14f49e928c4b345f5959d414ef64 --local-dir SheetSage2
uv pip install --python .venv/bin/python torch==2.8.0 torchaudio==2.8.0   --index-url https://download.pytorch.org/whl/cu126
uv pip install --python .venv/bin/python -r SheetSage2/requirements.txt
.venv/bin/python SheetSage2/setup_render.py   # the piano preview's renderer
```

- **No Hugging Face login is needed.** The first transcription fetches
  SheetSage2's MERT-v2-FullSong parent (`d8ba1c74…`) into the HF cache.
- **The revision is pinned** because SheetSage2 loads with
  `trust_remote_code`: the pin is what makes that code the reviewed code.
  `cafc0df1` is what the cover spike ran.
- **The piano preview renderer:** without `setup_render.py`, a
  transcription still returns its score, with a warning and no preview.
  On a minimal Ubuntu, use `setup_render.py --with-deps`.

Then start yue-server with the two paths (`start-all.bat` does this when
`~/sheetsage2/.venv` exists; override with `YUE_SHEETSAGE_HOME`):

```bash
YUE_SHEETSAGE_PYTHON=~/sheetsage2/.venv/bin/python YUE_SHEETSAGE_DIR=~/sheetsage2/SheetSage2   YUE_DATA_DIR=~/yue-data ~/yue2/.venv/bin/python main.py
```

`GET /v1/transcriptions/health` answers 200 once both are found. Measured
on the 4080: 6–12 s per song, about 3.7 GB on the card.

## Config (env vars, all optional)

| Variable | Default | Meaning |
| --- | --- | --- |
| `YUE_API_KEY` | empty | Bearer key for `/v1/*`. Empty = no auth. Health routes are always open. |
| `YUE_HOST` / `YUE_PORT` | `127.0.0.1` / `8004` | Bind address. `127.0.0.1` inside WSL is reachable from Windows. |
| `YUE_DATA_DIR` | `./data` | Job artifacts. Prefer a Linux path such as `~/yue-data`. |
| `YUE_RETENTION_HOURS` | `24` | Finished jobs and their files are deleted after this. |
| `YUE_MAX_PENDING` | `4` | Queued + running jobs before `POST /v1/jobs` returns 429. |
| `YUE_MODEL` / `YUE_VAE` | `m-a-p/YuE2-3B` / `m-a-p/YuE2-Vae` | HF repo ids or local paths. |
| `YUE_BUDGET_GIB` | `24` | yue2's `--budget`. PyTorch is capped at min(budget, card) − 2 GiB. |
| `YUE_QUANTIZATION` | `none` | `fp8` exists but is **not recommended**: it disables CUDA graphs, runs 4.6x slower on the 4080, saves ~0.2 GiB and changes the song for a given seed. |
| `YUE_OFFLOAD_AR` | off | yue2's `--offload-ar`. Measured to change nothing at 16 GB (the peak is in the semantic stage). |
| `YUE_SHEETSAGE_PYTHON` / `YUE_SHEETSAGE_DIR` | empty | SheetSage2's venv Python and its snapshot folder (holding `infer.py`). Either empty = no transcription (section 5). |
| `YUE_MAX_UPLOAD_MB` | `100` | Largest audio `POST /v1/transcriptions` accepts. |

## API

The shared engine contract (`PLAN.md`, design point 3): YuE2-Turbo's
`yue2-serve` job API, so Mulakai's one engine client talks to either.

- `POST /v1/jobs` — body `{style, lyrics, seed, cot?, cfg_scale?, id?, abc?}`.
  `seed` is **required** (YuE's own default is a fixed 831001). `cot` is
  `full` (default) / `melody` / `off`; `cfg_scale` 0–20. Unknown fields →
  422. Mulakai sends its own job id as the **`Idempotency-Key`** header: it
  is logged and echoed as `idempotency_key`, and resubmitting the same key
  with the same body returns the original job (200) instead of starting a
  second song; the same key with a different body is a 409. For
  compatibility, a filename-safe body `id` (echoed as `request_id`) and an
  `X-Admission-Id` header (echoed as `admission_id`) are also accepted.
  → **202** with the job record and `Location: /v1/jobs/{id}`; 503 while the
  pipeline is loading or failed to load; 429 when the queue is full.
  - `abc` is a supplied score, for a cover. It is at most 64 KB, and `cot`
    must be `melody` or `full`.
  - It must be in YuE2's native two-voice ABC (the `Vocal` / `Ins` voices
    SheetSage2 and YuE2 write) and within the 4096-token planning budget.
    Otherwise it is a 422.
  - With `cot=melody`, its chord symbols are stripped first, since YuE2
    doesn't strip them itself.
  - Tags-only lyrics with a score make an instrumental cover: the score's
    `Vocal` notes move to `Ins` (see Instrumentals).
- `GET /v1/jobs/{id}` — the job record (below).
- `POST /v1/jobs/{id}/cancel` — returns the job record. A queued job is
  cancelled at once; a running one at the next token, ODE step or stage
  boundary. Cancelling a finished job changes nothing.
- `GET /v1/jobs/{id}/audio` — `audio/flac`, 48 kHz stereo, 24-bit. 409 unless
  the job is `succeeded` or `truncated`.
- `GET /v1/jobs/{id}/score` — the ABC score plan (`text/plain`). 404 when
  there is none (`cot=off`).
- **Transcriptions** (section 5): SheetSage2 reads a song's melody into a
  score. They use the same auth, queue, retention and `Idempotency-Key`
  replay as `/v1/jobs`. A record has `kind: "transcription"`, where a
  song's has `kind: "song"`, and has no `seed`, `tokens` or `request_id`.
  Each route family 404s the other kind's ids.
  - `POST /v1/transcriptions` takes a multipart `audio` field. It returns
    **202** with the record and `Location`. 400 for empty audio, 413 over
    `YUE_MAX_UPLOAD_MB`, 503 when transcription isn't available.
  - `GET /v1/transcriptions/{id}`: the record. `stage` is `transcribing`,
    and `progress` is the fraction of SheetSage2's windows.
  - `POST /v1/transcriptions/{id}/cancel` kills the SheetSage2 process.
  - `GET /v1/transcriptions/{id}/score`: the melody-only score, in both
    voices with no chords, as `text/plain`.
  - `GET /v1/transcriptions/{id}/preview`: SheetSage2's piano rendering of
    it, as `audio/wav`. 404 when the render failed.
  - `result` on success has `score_url`, `preview_url` (or null),
    `warnings` (SheetSage2's own, plus a render failure), `measures`,
    `vocal_notes`, `instrumental_notes`, `duration_seconds` and `timing`.
  - `error` codes: `no_score` (SheetSage2 ran but built no score) and
    `transcription_failed`, each with the last lines of its output.
- `GET /v1/transcriptions/health` needs no auth. It returns 200
  `{"status": "ready"}`, else 503 with `status` `not_configured`,
  `missing_files` (with `detail`), or the worker's `loading` / `failed`.
- `POST /v1/scores/measure` — body `{abc}` → `{budget, header, sections:
  [{name, tokens}]}`: a cover score's size in the planner's tokens, against
  the 4096-token budget a supplied score must fit. The score is prepared as
  `POST /v1/jobs` prepares it (a bad one is the same 422). `header` is
  everything before the first `% name` line, and each section is its block.
  The counts add up to the whole score's, so a client can sum any cut of
  whole sections. 503 until the worker is ready.
- `GET /health/ready` — 200 `{"status": "ready"}`, else 503 with
  `"loading"` or `"failed"`. `GET /health/live` — 200 `{"status": "alive"}`.

HTTP errors use FastAPI's `{"detail": ...}` body (a string, or a list for 422).

Job record:

```json
{
  "id": "…32 hex…", "kind": "song", "idempotency_key": "<mulakai job id>", "admission_id": null,
  "request_id": null, "seed": 20260930,
  "status": "running", "stage": "synthesis", "progress": 0.41,
  "tokens": {"abc": 1673, "semantic": 4442},
  "created_at": 0.0, "updated_at": 0.0, "started_at": 0.0, "finished_at": null,
  "cancel_requested": false, "result": null, "error": null
}
```

- `status`: `queued | running | succeeded | truncated | failed | cancelled`.
  `truncated` means the score or the semantic tokens hit their generation
  limit; the audio is kept and downloadable.
- `stage`: `queued → planning → semantic → synthesis → decode → saving →
  finished` (the same names as `yue2-serve`).
- `progress`: the fraction of the **current stage**, when its total is known:
  ODE steps in `synthesis`, VAE chunks in `decode`. `null` in `planning` and
  `semantic`, which have no known length (the token limit is a cap, not a
  target); watch `tokens` there instead. Most of `decode` is the pipeline
  moving the model to system RAM (~1–5 s) before the chunks start, so its
  fraction jumps late.
- `result` (on success): `audio_url`, `score_url` (or null), `audio_seconds`,
  `sample_rate`, `truncated: {abc, semantic}`, `timing` (seconds per stage).
- `error` (on failure): `{code, message}` with code `invalid_generation`
  (the request could not be generated), `out_of_memory`, or
  `inference_failed`. Details are in the server log.

Jobs live in memory: restarting the server forgets them and deletes their
leftover files.

### Instrumentals

YuE2 has no instrumental flag. Empty `lyrics` are accepted, but the score
planner still writes a vocal melody for them, so expect wordless singing.

For an instrumental, send **only section tags** as lyrics (`[Intro]`,
`[Verse]`, `[Chorus]`, `[Outro]`, one per line) and a `cot` other than
`off`. With an `abc` (an instrumental cover), the supplied score is
converted instead of a planned one. Start `style` with "Instrumental" and end it with "no vocals, no
singing, no choir, no spoken words". The server then runs upstream's
instrumental workflow (`skills/yue2-music/instrumental` in the YuE repo):

1. YuE2 plans a score as usual.
2. Every `Vocal` note moves to the `Ins` voice (`upstream/instrumentalize.py`,
   vendored unmodified). Chords, meter, key, tempo and sections stay.
3. The song is generated from that score, with its own section tags as
   lyrics: `cot` is `full` if the score has chords, else `melody`.

`score.abc` is the converted score and `planned.abc` the one YuE2 planned.
`result.json` gains `instrumental` (`vocal_notes_moved`, `ins_notes_trimmed`)
and its `request` is the final one, with the converted score. If the plan
can't be converted (truncated, outside the native dialect, or over 4096 ABC
tokens), the job uses the unconverted plan and `instrumental.reason` says
why. A `yue2-serve` backend has no such step: it plans once.

## Tests

The tests use a fake pipeline and need no GPU, torch or yue2:

```bash
pip install -r requirements-test.txt
python -m pytest
```

## License

The wrapper is part of Mulakai. `yue2-infer` code is Apache-2.0. **The YuE2
weights are CC BY-NC 4.0 plus a creator permission**: individuals may use them
and monetize the outputs; companies need a license from the authors. Check
the current terms in the upstream `MODEL_LICENSE` before any commercial use.
SheetSage2's weights are CC BY-NC 4.0 as well. Its renderer's FluidR3 piano
samples are CC BY 3.0 US. Whether you may cover a given song is up to you, as
with ACE-Step's COVER.
