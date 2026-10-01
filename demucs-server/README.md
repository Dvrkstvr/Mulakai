# demucs-server

Thin HTTP wrapper around [Demucs](https://github.com/adefossez/demucs) so
Mulakai's Node server can reach stem separation the same way it reaches
ACE-Step: a separate process, reached only via a URL — never imported into
the Node/TS codebase.

## Setup

```bash
cd demucs-server
python3 -m venv venv
venv\Scripts\activate        # Windows; use `source venv/bin/activate` on macOS/Linux
pip install -r requirements.txt
```

FFmpeg is required on Windows for Demucs to decode audio — install it and
make sure it's on `PATH` if you don't already have it (e.g. via
`winget install ffmpeg` or the ACE-Step setup, which also needs it).

Stems are written with `soundfile` (bundled libsndfile), not torchaudio:
since torchaudio 2.9, `torchaudio.save` requires `torchcodec`, which in turn
needs FFmpeg *shared* libraries of a matching version — static Windows builds
(winget/gyan) don't ship them. You don't need `torchcodec` installed, and any
torch/torchaudio version works. If you're upgrading an existing venv, run
`pip install -r requirements.txt` again to pick up `soundfile`.

First run downloads the `htdemucs` model (~80MB) to the Demucs cache dir.

## Run

```bash
uvicorn main:app --port 8002
```

Then point Mulakai's server at it:

```bash
set DEMUCS_API_URL=http://127.0.0.1:8002   # Windows
export DEMUCS_API_URL=http://127.0.0.1:8002  # macOS/Linux
```

The DEMUCS option in the Editor's SPLIT panel enables automatically once
`server`'s `GET /api/split/health` can reach this service.

## Config (env vars)

- `DEMUCS_MODEL` — Demucs model name (default `htdemucs`, 4-stem: vocals/
  drums/bass/other).
- `DEMUCS_DATA_DIR` — where source uploads and separated stems are written
  (default `./data`, gitignored).

## Endpoints

- `GET /health` — `{"ok": true, "model": "htdemucs"}` once the model is
  loaded.
- `POST /split` — multipart `audio` file field → `{"stems": {"vocals": url,
  "drums": url, "bass": url, "other": url}}`, absolute URLs served from this
  same process's `/audio` route. A failed split returns 500 with the reason
  in `detail` and leaves nothing on disk.
- `GET /audio/...` � each stem can be downloaded **once**: the file is
  deleted after it is sent, and the job's folder goes with its last stem.
  Stems nobody downloads are swept after `DEMUCS_RESULT_TTL`, at startup
  and before each split. Mulakai downloads all four right after `/split`.

The split runs in FastAPI's threadpool, one at a time, so `/health` keeps
answering while a split is in progress.

## Tests

```bash
pip install -r requirements-dev.txt
python -m pytest
```

The tests use a fake separator and never load Demucs or touch the GPU.
