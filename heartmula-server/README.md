# heartmula-server

Thin HTTP wrapper around [HeartMuLa](https://github.com/HeartMuLa/heartlib)
(heartlib) so Mulakai's Node server can use it as an optional **first-take
engine**: a separate process reached only through a URL, never imported into
the Node/TS codebase. Every later edit of the song (repaint, Add Layer, …)
still runs on ACE-Step. See `PLAN.md` → "Multiple Song-Creation Engines".

It speaks the job contract shared by every Mulakai engine wrapper (the shapes
follow YuE2-Turbo's `yue2-serve`), handles one job at a time, and writes a
48 kHz stereo FLAC.

HeartMuLa's code and weights are Apache-2.0.

## Setup (native Windows)

HeartMuLa does not support Windows officially, but it ran on native Windows
11 in the spike (RTX 4080 16 GB, about real time). It gets **its own Python
3.10 environment**; its pins (torchtune 0.4.0, transformers 4.57.0) conflict
with the other engines'.

Requirements: [uv](https://docs.astral.sh/uv/), an NVIDIA GPU with ≥16 GB,
~22 GB of disk for the weights, and ~16 GB of free system RAM (the weights
are kept there between jobs).

```bat
:: 1. heartlib, next to (not inside) Mulakai. Tested at commit a18c8cb.
git clone https://github.com/HeartMuLa/heartlib.git "S:\AI Gen\heartlib"
cd /d "S:\AI Gen\heartlib"
git checkout a18c8cb54a55b4c24d48a2842542f81da7dedcd2

:: 2. Weights (~22 GB): tokenizer/config, the 3B LM (~15.75 GB), the codec (~6.64 GB)
uvx --from huggingface_hub hf download --local-dir ./ckpt HeartMuLa/HeartMuLaGen
uvx --from huggingface_hub hf download --local-dir ./ckpt/HeartMuLa-oss-3B HeartMuLa/HeartMuLa-oss-3B-happy-new-year
uvx --from huggingface_hub hf download --local-dir ./ckpt/HeartCodec-oss HeartMuLa/HeartCodec-oss-20260123

:: 3. Python 3.10 venv: CUDA torch first (torchao 0.9.0 is built for torch 2.6), then heartlib
uv venv --python 3.10 .venv
uv pip install --python .venv\Scripts\python.exe torch==2.6.0 torchvision==0.21.0 torchaudio==2.6.0 --index-url https://download.pytorch.org/whl/cu126
uv pip install --python .venv\Scripts\python.exe -e .
uv pip install --python .venv\Scripts\python.exe "triton-windows<3.3"

:: 4. This server's HTTP layer, into the same venv
uv pip install --python .venv\Scripts\python.exe -r E:\repos\Mulakai\heartmula-server\requirements.txt
```

Notes:
- PyPI marks transformers 4.57.0 as yanked. It installs and works.
- `triton-windows` only silences heartlib's `No module named 'triton'`
  message.
- No ffmpeg is needed. The server writes FLAC through soundfile.

## Run

```bat
cd /d E:\repos\Mulakai\heartmula-server
set HEARTMULA_MODEL_PATH=S:\AI Gen\heartlib\ckpt
"S:\AI Gen\heartlib\.venv\Scripts\python.exe" main.py
```

It listens on `http://127.0.0.1:8003`. The weights load into RAM in ~20 s,
and `GET /health/ready` answers 503 `loading` until they are in.

Then point Mulakai's server at it:

```bat
set HEARTMULA_API_URL=http://127.0.0.1:8003
set HEARTMULA_API_KEY=            :: optional, must match the server's key
```

An empty `HEARTMULA_API_URL` disables the engine. The Node side reads these
from `feat/engine-framework` onward.

## GPU: one model at a time (read this)

The target card has 16 GB of VRAM, and no two models fit on it together.

- **ACE-Step must run with `ACESTEP_OFFLOAD_TO_CPU=true`** whenever this
  engine is configured. That is ACE-Step's own setting ("Offload models to
  CPU when idle"). Mulakai cannot set it or check it. With it, idle ACE-Step
  holds ~0.5 GB. Without it, idle ACE-Step holds ~15 GB, and HeartMuLa spills.
- **This server parks its models in system RAM.** Both load once to the CPU.
  A job moves the LM to the GPU for the token loop and parks it again. Then
  it moves the codec up for the decode and parks that too. Each move takes
  ~1 s. Between jobs the process holds only its ~0.25 GB CUDA context.
- **Recommended driver setting: NVIDIA Control Panel → Manage 3D settings →
  CUDA – Sysmem Fallback Policy → Prefer No Sysmem Fallback.** With the
  default policy, an over-budget allocation on Windows spills silently into
  shared system memory. The spike measured that as ~25x slower, with no error.
  With "Prefer No Sysmem Fallback", the same mistake is a failed job that
  says `out_of_memory`. This is a system setting. Mulakai only documents it;
  nothing changes it for you.
- The server also caps its own PyTorch memory at the card's total minus
  2 GiB (`HEARTMULA_VRAM_BUDGET_GB`). Past the cap, PyTorch raises
  out-of-memory before the driver can spill. HeartMuLa's measured peak is
  12.85 GiB.
- Mulakai runs one generation at a time across all engines, so this server
  and ACE-Step never generate at the same moment.

## WSL2 fallback

Use this only if native Windows fails, for example on a different
driver/torch combination.

- Inside a WSL2 distro, follow the same steps with Linux paths:
  - Use the Linux cu126 torch wheels.
  - Leave out `triton-windows`, since Linux torch ships triton.
- Keep the weights on the Linux filesystem (for example `~/heartlib/ckpt`),
  not under `/mnt/<drive>`, which loads far slower.
- WSL2 shares the same GPU and the same 16 GB. Everything in the GPU section
  still applies.
- Run with `HEARTMULA_HOST=0.0.0.0` or `127.0.0.1`. Windows reaches it at
  `http://127.0.0.1:8003`. Use that address, not `[::1]`: NAT-mode forwarding
  is IPv4-only.
- WSL does not start on its own. Launch the server through `wsl.exe`.

## Config (env vars)

| Variable | Default | Meaning |
| --- | --- | --- |
| `HEARTMULA_MODEL_PATH` | *(required)* | heartlib's `ckpt` folder |
| `HEARTMULA_API_KEY` | empty | If set, `/v1/*` requires `Authorization: Bearer <key>`. Health routes stay open. |
| `HEARTMULA_HOST` / `HEARTMULA_PORT` | `127.0.0.1` / `8003` | bind address |
| `HEARTMULA_DEVICE` | `cuda` | torch device for the active model |
| `HEARTMULA_VRAM_BUDGET_GB` | card total − 2 | PyTorch memory cap for this process |
| `HEARTMULA_VERSION` | `3B` | the `HeartMuLa-oss-<version>` folder to load |
| `HEARTMULA_DATA_DIR` | `./data` | where finished FLACs are kept |
| `HEARTMULA_MAX_PENDING` | `4` | queued + running jobs before `429` |
| `HEARTMULA_RETENTION_HOURS` | `24` | finished jobs and their audio are forgotten after this |

## API

Errors are FastAPI's `{"detail": ...}` with these statuses:

- `401`: bad or missing key
- `404`: unknown job
- `409`: audio requested for a job without audio, or an `Idempotency-Key`
  reused with a different body
- `422`: invalid body
- `429`: queue full
- `503`: model still loading

| Route | Result |
| --- | --- |
| `GET /health/ready` | `200 {"status":"ready"}`, or `503 {"status":"loading"}` / `503 {"status":"failed","error":…}` |
| `GET /health/live` | `200 {"status":"alive"}` |
| `POST /v1/jobs` | `202` job snapshot, `Location: /v1/jobs/{id}`. An optional `Idempotency-Key` header (Mulakai sends its own job id) is logged. Repeating it with the same body returns the original job with `200`. |
| `GET /v1/jobs/{id}` | job snapshot |
| `POST /v1/jobs/{id}/cancel` | job snapshot. A queued job is cancelled at once. A running job stops within one 80 ms LM frame, or at the next stage boundary. |
| `GET /v1/jobs/{id}/audio` | `audio/flac`, 48 kHz stereo, 24-bit, only when `succeeded` or `truncated` |

There is no `/score` route (HeartMuLa has no score), so it 404s.

**Request body** (unknown fields are a 422):

```json
{
  "tags": "piano,happy,wedding",
  "lyrics": "[Verse]\n...\n[Chorus]\n...",
  "max_audio_length_ms": 240000,
  "cfg_scale": null,
  "temperature": null,
  "topk": null
}
```

- `tags`: comma-separated with no spaces. It may be empty.
- `lyrics`: required and non-blank. HeartMuLa has no instrumental mode.
  Section tags: `[Intro] [Verse] [Prechorus] [Chorus] [Bridge] [Outro]`.
- `max_audio_length_ms`: a **cap, not a target**, from 10000 to 360000.
  Default 240000.
- `cfg_scale` (1–10), `temperature` (0–2) and `topk` (1–1000): `null` uses
  heartlib's defaults of 1.5, 1.0 and 50.
- There is no seed. Every take is different, and none can be reproduced.

**Job snapshot**:

```json
{
  "id": "…32 hex…", "status": "queued|running|succeeded|truncated|failed|cancelled",
  "stage": "queued|starting|generating|decoding|saving|finished",
  "created_at": 0.0, "updated_at": 0.0, "started_at": null, "finished_at": null,
  "cancel_requested": false,
  "result": {"audio_url": "/v1/jobs/{id}/audio", "score_url": null, "audio_seconds": 184.9,
             "sample_rate": 48000, "gain_db": -2.4, "truncated": false, "timing": {"seconds": 193.0}},
  "error": {"code": "invalid_generation|inference_failed|out_of_memory", "message": "…"}
}
```

- `result` is set only on `succeeded` and `truncated`. `error` is set only
  on `failed`.
- `truncated` means the song hit `max_audio_length_ms` before HeartMuLa
  ended it. The audio is kept, but the end is cut off.
- `gain_db` is set when the audio was turned down. HeartMuLa's float output
  peaks above full scale (up to +2.5 dB in the spike), and FLAC stores
  integers only. Over-scale audio therefore gets one static gain down to
  −0.1 dBFS instead of being clipped. `gain_db` is `0.0` when nothing
  changed.
- There is no `progress` fraction, only `stage`.
- Jobs live in memory. A restart forgets them, and the next poll returns 404.

## Tests

The tests need no GPU or weights. A fake engine stands in for HeartMuLa, and
the engine tests use a fake heartlib pipeline built from tiny torch modules.
They skip if torch isn't installed.

```bat
"S:\AI Gen\heartlib\.venv\Scripts\python.exe" -m pip install -r requirements-dev.txt
"S:\AI Gen\heartlib\.venv\Scripts\python.exe" -m pytest tests -q
```

With uv, run `uv pip install --python <venv python> -r requirements-dev.txt`.
