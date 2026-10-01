# uvr-server

A drop-in replacement for `demucs-server` that gives SPLIT a much cleaner
**vocals** stem. It runs [uvr-headless-runner](https://github.com/chyinan/uvr-headless-runner)
(MIT, Ultimate Vocal Remover's separation code, headless) as a separate
process. Mulakai reaches it only through a URL. It speaks the same `/split`
contract on the same port and uses the same `DEMUCS_API_URL`, so nothing in
Mulakai changes. Run it **instead of** `demucs-server`, not next to it.

Each split takes two passes (see `chain.py` and `PLAN.md` → "UVR Separator:
Roformer Vocals for SPLIT"):

1. A Roformer model (default BS-Roformer-Viperx-1297) splits the mix into
   vocals and instrumental.
2. htdemucs splits that instrumental into drums, bass and other.

A 3½-minute song takes about 50 s on an RTX 4080.

## Setup (native Windows)

This service needs **its own Python 3.10 venv**. The runner installs
top-level `demucs`, `separate`, `cli`, … modules that clash with
`demucs-server`'s pip `demucs`, and it supports Python 3.9 and 3.10 only.

Install the runner from a pinned git checkout, **not PyPI**. The 1.1.0 wheel
leaves out the runner's `models/` data files (UVR's model tables), and without
them no MDX model loads by name.

```bat
cd /d E:\repos\Mulakai\uvr-server

:: 1. The runner, pinned to the commit this was tested against (1.1.0)
git clone https://github.com/chyinan/uvr-headless-runner.git runner
git -C runner checkout 0088e1e5b98c78183edd164a16b24915bc72325d

:: 2. Python 3.10 venv: CUDA torch first, then the runner, then this server
uv venv --python 3.10 venv
uv pip install --python venv\Scripts\python.exe torch==2.6.0 torchvision==0.21.0 torchaudio==2.6.0 --index-url https://download.pytorch.org/whl/cu126
uv pip install --python venv\Scripts\python.exe -e runner
uv pip install --python venv\Scripts\python.exe -r requirements.txt
```

FFmpeg must be on `PATH` to decode mp3 input (same as `demucs-server`).

The first split downloads the models into `runner\models\` (about 640 MB
for the Roformer checkpoint and 80 MB for htdemucs). It also caches the
Roformer config in `model-configs\`, a workaround for a runner bug described
in `uvr_models.py`.

## Run

```bat
cd /d E:\repos\Mulakai\uvr-server
venv\Scripts\python.exe -m uvicorn main:app --port 8002
```

`start-all.bat` does this automatically when `uvr-server\venv` exists, and
starts it in place of `demucs-server`. The SPLIT panel's DEMUCS option then
runs through this service.

## Config (env vars)

- `UVR_VOCAL_MODEL`: the pass-1 model, as a UVR registry name (default
  `Roformer Model: BS-Roformer-Viperx-1297`). List the names with
  `venv\Scripts\python.exe -m mdx_headless_runner --list`. It must be a
  Vocals/Instrumental model.
- `UVR_DEMUCS_MODEL`: the pass-2 model (default `htdemucs`). It must be a
  4-stem Demucs model. Only `htdemucs` has been tested.
- `UVR_DATA_DIR`: where uploads and stems go (default `./data`, gitignored).
- `UVR_RESULT_TTL`: seconds a split's stems wait to be downloaded before
  they are deleted anyway (default `900`).

## Endpoints

- `GET /health` returns `{"ok": true, "backend": "uvr", "model": ...,
  "demucs_model": ...}`. It does not load any models.
- `POST /split` takes a multipart `audio` file field and returns
  `{"stems": {"vocals": url, "drums": url, "bass": url, "other": url}}`.
  The URLs are float32 WAVs served from `/audio`. A failed split returns 500
  with the reason in `detail` and leaves nothing on disk.
- `GET /audio/...` serves each stem **once**: the file is deleted after it
  is sent, and the job's folder goes with its last stem. Stems nobody
  downloads are swept after `UVR_RESULT_TTL`, at startup and before each
  split. `job_files.py` does this, and is a copy of
  `demucs-server/job_files.py`.

## Tests

```bat
uv pip install --python venv\Scripts\python.exe -r requirements-dev.txt
venv\Scripts\python.exe -m pytest
```

The tests use fake runners and never touch the GPU.
