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

FFmpeg is required on Windows for Demucs to decode/encode audio — install it
and make sure it's on `PATH` if you don't already have it (e.g. via
`winget install ffmpeg` or the ACE-Step setup, which also needs it).

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
  same process's `/audio` static mount.
