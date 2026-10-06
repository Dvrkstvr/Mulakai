# Playbook — Mulakai

<!-- Written at adopt (2026-10-03) from what the repo already does; completed at stage 6 (2026-10-03) for the score agent.
     Rationale goes to decisions.md; module map in architecture.md. -->

## Approach
- primary: spec-first — PLAN.md stays the spec log; every 3+ file feature gets a dated section before code (AGENTS.md); acceptance = Vitest tests.
- secondary: design-first for UI (DESIGN.md is a hard rule; new dock verbs get a mockup first); prototype-first for the score agent's planner/VRAM unknowns (stage 3 spikes).

## Stack
- client: React + TypeScript (strict) + Vite, Zustand, Web Audio playback (`client/src/mix/`), oxlint
- server: Express + SQLite (migrations in `server/src/db/`), tsx watch
- external processes (never modified): ACE-Step 1.5 (`ACESTEP_API_URL`), heartmula-server (`HEARTMULA_API_URL`, marked for removal, D-014), demucs/uvr (`DEMUCS_API_URL`)
- yue-server (ours, Python/FastAPI, runs in WSL2 Ubuntu-24.04 in `~/yue2/.venv`): `YUE_API_URL=http://127.0.0.1:8004`, default first-take engine (D-015); the score agent adds CPU-only score routes to it (D-019)
- score planner (M0): Ollama 0.32.15 on Windows (seen running 2026-10-03, `/api/version`), model `qwen3:14b` Q4_K_M (pulled; `gemma4:26b-a4b-it-q4_K_M` also pulled, untested profile, D-024); `LLM_API_URL` (empty = SCORE hidden), `LLM_MODEL` (default `qwen3:14b`)
- tests: Vitest 4 (client, server), pytest (yue-server, fake pipeline, no GPU), Playwright golden path against a fake ACE-Step (`e2e/`)
- stack card: `stacks/web.md` (client/server) + `stacks/generic.md` answers for yue-server and Ollama (below)
- docs: Ollama OpenAI compatibility https://docs.ollama.com/api/openai-compatibility (`response_format`, `reasoning_effort`; no `keep_alive`/`num_ctx`), https://docs.ollama.com/api/ps (`context_length`, `size_vram`), https://docs.ollama.com/faq (`keep_alive: 0` unloads; default context 4096; `OLLAMA_CONTEXT_LENGTH`), all read 2026-10-03; upstream `skills/yue2-music/` at YuE `72272f9` (risks.md sources)

## Check commands (all must pass before a commit)
No root package.json; run inside each folder.
```
cd client && npm run build      # tsc -b + vite build (typecheck)
cd client && npm run lint       # oxlint
cd client && npm test           # vitest
cd server && npx tsc --noEmit   # server typecheck (npm run build would write dist/)
cd server && npm test           # vitest
cd yue-server && python -m pytest   # Windows Python works: pip install -r requirements-test.txt once; no GPU/torch/yue2
cd e2e && npm run test:e2e      # golden path, fake ACE-Step on 8101, server 3101, vite 5183; needs ffmpeg
```
Run once at stage 6, 2026-10-03, on `docs/engine-lineup` (all exit 0): client build (chunk-size warning only), lint (1 existing
warning, `AudioPreview.tsx` only-export-components), client 82 files / 624 tests, server tsc clean, server 61 files / 518 tests,
yue-server 65 passed (Windows Python 3.14, fastapi 0.139, 1 Starlette deprecation warning), e2e 5 passed in 37 s (ports were free).
Before e2e, check 8101/3101/5183 with `Get-NetTCPConnection -LocalPort <port> -State Listen`; if another session holds them, skip
e2e and say so; never stop a process you did not start.
CI today runs only e2e (`.github/workflows/e2e.yml`); `checks.yml` for the rest is proposed for W0 (D-033).

## Run & verify
- run: `cd server && npm run dev` and `cd client && npm run dev`; ACE-Step: `uv run acestep --port 8001 --enable-api --backend pt --server-name 127.0.0.1`
- agent eyes: the in-app browser pane on the Vite dev server; golden-path e2e for regressions
- orphaned e2e ports: `Get-NetTCPConnection -LocalPort <port>`, stop the PID
- after code changes: `graphify update .`

### Score agent: run & verify (M0)
- **Ollama:** the user's server answers on `127.0.0.1:11434` (seen 2026-10-03, `/api/ps` empty) but its context length is not known.
  The planner needs `OLLAMA_CONTEXT_LENGTH=16384` on the Ollama *server*. Default for agents (Q-031): start a second one,
  `$env:OLLAMA_HOST='127.0.0.1:11435'; $env:OLLAMA_CONTEXT_LENGTH='16384'; ollama serve` (same model store, as SP-1/SP-2 did), and set
  `LLM_API_URL=http://127.0.0.1:11435`; stop it when done. Check: `curl http://127.0.0.1:11435/api/tags` lists `qwen3:14b`; after a
  plan, `curl .../api/ps` shows `"models":[]`.
- **yue-server:** `wsl.exe -d Ubuntu-24.04 --exec bash -lc "cd /mnt/e/repos/Mulakai/yue-server && YUE_DATA_DIR=~/yue-data ~/yue2/.venv/bin/python main.py"`
  (yue-server/README.md §4; `start-all.bat` does it); `YUE_API_URL=http://127.0.0.1:8004` (use 127.0.0.1, WSL NAT is IPv4-only);
  ready when `GET /health/ready` is 200. ACE-Step, if running, must have `ACESTEP_OFFLOAD_TO_CPU=true` (P3).
- **CP1 (after W2, headless):** copy `server/data` to a throwaway folder; start the server with `PORT=3201`, `DATA_DIR=<copy>`,
  `YUE_API_URL`, `LLM_API_URL`; then `cd server && npx tsx scripts/scoreCp1.ts --server http://127.0.0.1:3201 --song <id>
  --request "jazz chords in the chorus, 88 BPM"`. Evidence lands in `pipeline/evidence/CP1-<date>/` (log.json, nvidia-smi.csv). Stop
  lines: unload-to-empty > 5 s, YuE2 < 80 tok/s, plan p50 > 60 s → stop and raise before W3. The live library is never written.
- **Agent eyes on the dock:** start `server` and `client` from `.claude/launch.json` with the in-app browser pane (preview_start), the
  server process carrying `YUE_API_URL` and `LLM_API_URL` (W0 proposes a `server-score` launch entry with those env vars); open a YuE2
  song in the Editor, read the dock with `read_page` / `find` (tab list, `role=tabpanel` "SCORE") before screenshots; desktop sizes only
  (1920×1080 and 1366×768 for the owed dock-height check, D-032).
- **Fakes for unit tests:** `server/test-fakes/fakeOllama.ts`, `server/test-fakes/fakeYue.ts` (W2); e2e wrappers in M1 (F-028).

## Quality bar (track: standard)
- Vitest test for every behavior change (AGENTS.md); one Playwright golden path per phase
- module target 150 LOC, hard cap 200
- every generative/destructive commit states its consequence inline; one hue per job (DESIGN.md)
- a UI change that deviates from DESIGN.md updates DESIGN.md in the same PR, as its own commit
- CI (`.github/workflows/e2e.yml`) green on the PR **and** on the push to main before the next merge (R-012)
- score agent: every pure module (architecture.md) lands with its tests in the same PR, and each is broken on purpose once to see a test fail (spec-first)
- the GPU hand-off is never weakened: a `plan` job releases its slot only after `/api/ps` is empty (F-020); CP1 numbers are logged before W3
- stored data: score versions carry `score_v`; shape changes bump it with a migration-named test (architecture.md "Data")

## Voice & conventions
- branches `feat/`, `fix/`, `test/`; commits `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`; never push to main; one problem per PR
- UI copy: uppercase 1–3 word verbs for buttons; errors say what happened + what to do
- no "record the browser check" docs-only commits (D-004)
