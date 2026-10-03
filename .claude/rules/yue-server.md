---
paths:
  - "yue-server/**"
---

# yue-server

- Python modules follow the same cap as TypeScript: target 150, hard 200
  LOC.
- `upstream/` is vendored from YuE and stays unmodified; wrap it instead.
- The score routes (`/v1/scores/*`) are CPU-only: they never call the
  pipeline's GPU path (pytest asserts `FakePipeline.plan()` is not called).
- Tokenizer calls (`worker.count_tokens`) take the lock: request threads
  and the job thread may count at once (D-042).
- All ABC reading and writing for the score agent happens here, next to
  upstream's `abc_tools.py`; no TypeScript port (docs/decisions/0002).
- Golden cases and the contract fixtures the server's fake replays live in
  `tests/data/`; regenerate fixtures from pytest, never by hand (D-039).
- Tests use the fake pipeline: `pip install -r requirements-test.txt`,
  then `python -m pytest` (no GPU, torch or yue2; runs on Windows too).
- The real service runs in WSL2 (`~/yue2/.venv`, README section 4); use
  `127.0.0.1`, not `localhost`, in `YUE_API_URL`.
