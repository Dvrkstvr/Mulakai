# lyrics-server

Reads the words sung in a song, with timings, for READ LYRICS on COVER ·
YUE2 (`PLAN.md` → "Cover Lyrics From the Recording"). It runs
[faster-whisper](https://github.com/SYSTRAN/faster-whisper) large-v3 (MIT)
as a separate process. Mulakai reaches it only through a URL.

It reads the **unseparated mix**. No vocal split is needed: in the spike,
the mix scored better than the separated vocals (mean WER 0.14 vs 0.25; see
"Cover lyrics spike results").
- The settings are fixed to the spike's winner: fp16, beam 5,
  `condition_on_previous_text=False`, word timestamps, no VAD.
- With no language given, it detects the language of every 30 s window
  (`multilingual=True`). With the first window's guess alone, Whisper
  translated a German song's verses into English.
- The model loads for each job and is freed afterwards. That is about 3 s,
  plus 3–15 s for a 2–6 minute song on an RTX 4080.
- It needs 4–6 GB of VRAM while a job runs.

## Setup (native Windows)

The service needs its own venv. Python 3.11 is tested.

```bat
cd /d E:\repos\Mulakai\lyrics-server
uv venv --python 3.11 venv
uv pip install --python venv\Scripts\python.exe -r requirements.txt
```

The first job downloads the model into `models\` (about 3 GB, gitignored).

CTranslate2 needs cuBLAS 12 and cuDNN 9. They come from the
`nvidia-cublas-cu12` and `nvidia-cudnn-cu12` wheels in `requirements.txt`,
and `main.py` adds their DLL folders to the search path. No CUDA toolkit
install is needed.

## Run

```bat
cd /d E:\repos\Mulakai\lyrics-server
venv\Scripts\python.exe -m uvicorn main:app --port 8005
```

`start-all.bat` does this automatically when `lyrics-server\venv` exists.
It also sets `LYRICS_API_URL=http://127.0.0.1:8005` for the Mulakai server,
whose `POST /api/lyrics/transcribe` runs READ LYRICS through this service.
`GET /api/lyrics/health` reports whether it is configured and answering.

## Config (env vars)

- `LYRICS_MODEL` (default `large-v3`): any faster-whisper model name or
  local path. Only large-v3 was measured.
- `LYRICS_DEVICE` (default `cuda`) and `LYRICS_COMPUTE_TYPE` (default
  `float16`): for example `cpu` with `int8` on a machine without a usable
  card. That is much slower.
- `LYRICS_MODEL_DIR` (default `./models`): where the model is downloaded.

## Endpoints

- `GET /health` returns `{"ok": true, "backend": "faster-whisper",
  "model": ...}`. It does not load the model.
- `POST /transcribe` takes a multipart `audio` file field and an optional
  `language` form field (`en`, `de`, …). An empty `language` means
  auto-detect.
  - It returns `{"language": "en", "segments": [{"text", "start", "end",
    "words": [{"text", "start", "end"}]}]}`, with times in seconds.
  - On auto-detect, `language` is the language most sung words are in: a
    vote of the windows that hold words, each weighed by its word count.
  - Whisper's stock subtitle lines ("Thanks for watching!", "Untertitelung
    des ZDF", "… Musik …") are dropped before returning; see
    `hallucinations.py`.
  - A failed job returns 500 with the reason in `detail`.
  - One job runs at a time.

## Tests

```bat
uv pip install --python venv\Scripts\python.exe -r requirements-dev.txt
venv\Scripts\python.exe -m pytest
```

The tests use a fake model and never touch the GPU.
