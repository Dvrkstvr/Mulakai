# Playbook — Mulakai

<!-- Written at adopt (2026-10-03) from what the repo already does; completed at stage 6 (2026-10-03) for the score agent, extended for the chat C0 (2026-10-06).
     Rationale goes to decisions.md; module map in architecture.md. -->

## Approach
- primary: spec-first — PLAN.md stays the spec log; every 3+ file feature gets a dated section before code (AGENTS.md); acceptance = Vitest tests.
- secondary: design-first for UI (DESIGN.md is a hard rule; new dock verbs get a mockup first); prototype-first for the score agent's planner/VRAM unknowns (stage 3 spikes).

## Stack
- client: React + TypeScript (strict) + Vite, Zustand, Web Audio playback (`client/src/mix/`), oxlint
- server: Express + SQLite (migrations in `server/src/db/`), tsx watch
- external processes: ACE-Step 1.5 (`ACESTEP_API_URL`; Mulakai's fork, branch `mulakai`, D-203), heartmula-server (`HEARTMULA_API_URL`, marked for removal, D-014), demucs/uvr (`DEMUCS_API_URL`)
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
Run again at stage 6 (chat C0), 2026-10-06, on `docs/chat-c0` (code = `origin/main` ff69f2e; all exit 0): client build (chunk-size
warning only), lint (the same 1 warning), client 104 files / 839 tests, server tsc clean, server 93 files / 812 tests, yue-server
422 passed (Windows Python 3.14, 1 warning), e2e 11 passed in 1.1 min (golden path + queue + score projects; ports were free).
Run again at stage 6 (chat C3), 2026-10-07, on `docs/chat-c3` (code = `origin/main` 98b9179; all exit 0): client build (chunk-size
warning only), lint (the same 1 warning), client 117 files / 974 tests, server tsc clean, server 118 files / 1017 tests, yue-server
422 passed (1 warning), e2e 12 passed in 1.1 min (ports were free).
Run again at stage 6 (chat C1), 2026-10-07, on `docs/chat-c1` (code = `origin/main` d964d0b; all exit 0, fresh `npm ci` in a worktree):
client build (chunk-size warning only), lint (the same 1 warning), client 140 files / 1150 tests, server tsc clean, server 152 files /
1282 tests. yue-server pytest and e2e were not run (task scope: client and server checks; no code changed).
From CB-1 on, yue-server's pytest needs numpy and scipy: `pip install -r requirements-test.txt` again once.
CI runs e2e (`.github/workflows/e2e.yml`) and the unit suites, typechecks, lint and pytest (`.github/workflows/checks.yml`, Python 3.12).

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

### Chat: run & verify (C0)
- **Environment:** as the score agent (Ollama with `OLLAMA_CONTEXT_LENGTH=16384`, yue-server in WSL2); the chat adds no variable in
  C0 except `CHAT_LADDER` (default 0; the SP-5 ladder rung, read only by `chat/turnCall.ts`). CHAT is the start screen only when
  `LLM_API_URL` and `YUE_API_URL` are both set (D-099).
- **yue-server for C0b:** once, `wsl.exe -d Ubuntu-24.04 --exec bash -lc "~/yue2/.venv/bin/pip install scipy==1.18.0"`; check
  `~/yue2/.venv/bin/python -c "import scipy"`. The splice's grid run uses SheetSage2 through the existing `YUE_SHEETSAGE_PYTHON` /
  `YUE_SHEETSAGE_DIR` (`GET /v1/transcriptions/health` 200 = ready).
- **CP-C0a (after CA-3, before CA-6, headless):** copy `server/data` to a throwaway folder; start the server with `PORT=3201`,
  `DATA_DIR=<copy>`, `YUE_API_URL`, `LLM_API_URL`; then `cd server && npx tsx scripts/chatCp0.ts --server http://127.0.0.1:3201
  --leg create`. Evidence in `pipeline/cp-c0/<date>/` (log.json, nvidia-smi.csv). Stop lines: turn p50 > 15 s, hand-off > 5 s,
  a recipe invalid after 3 attempts more than once.
- **CP-C0 (after CB-3, before CB-5):** the same server, `--leg edit --song <id>` on 3 library songs (4/4); then in WSL
  `~/yue2/.venv/bin/python /mnt/e/repos/Mulakai/yue-server/splice_check.py <base> <saved> <result.json>` per song (the script
  prints the paths). Stop lines: edit wall time > 4 min, a null test failing, join LUFS excess > 1 dB on 3 of 3 songs.
- **Agent eyes on the chat:** a `server-chat` launch entry with `YUE_API_URL` and `LLM_API_URL` (CA-6 adds it to
  `.claude/launch.json`) and the client; the app opens on CHAT. Read the screen with `read_page` / `find` (composer `SEND ↵`,
  the recipe card's CREATE SONG, the player) before screenshots; check 1366×768 (F-043) and 1920×1080.
- **Fakes:** `fakeOllama.ts` + `server/test-fakes/chatScripts.ts` (scripted turns), `fakeYue.ts` (+ splice replay in CB-3); pytest
  `FakeTracker` for SheetSage2. The chat e2e spec is F-051 (C1); C0 keeps the golden path unchanged.

### Chat: run & verify (C3, reference songs)
- **Environment:** as C0, plus SheetSage2 on yue-server (`GET /v1/transcriptions/health` 200), `LYRICS_API_URL` (lyrics-server;
  unset = WORDS "not read") and ACE-Step on `ACESTEP_API_URL` with `ACESTEP_OFFLOAD_TO_CPU=true` (down = CAPTION "not read").
  No new variable. Reference copies land in `<DATA_DIR>/audio/references/`.
- **CP-C3 (after CR-4, beside CR-7a/b, headless):** copy `server/data` to a throwaway folder on E:; start the server with
  `PORT=3201`, `DATA_DIR=<copy>`, `YUE_API_URL`, `LLM_API_URL`, `LYRICS_API_URL`; then `cd server && npx tsx scripts/chatCp3.ts
  --server http://127.0.0.1:3201 [--refs <folder of the owner's recordings>]`. Without `--refs` it uploads ACE-Step library songs'
  audio as stand-ins (Q-095). Evidence in `pipeline/cp-c3/<date>/` (log.json, nvidia-smi.csv). Stop lines: architecture.md
  "Test strategy (C3)" item 6.
- **Agent eyes:** the `server-chat` launch entry (+ `LYRICS_API_URL`) and the client; drop a file with the browser pane's file
  input (read the ATTACH control with `find`), then READ, the reading card, the cover card; 1366×768 and 1920×1080.

## Quality bar (track: standard)
- Vitest test for every behavior change (AGENTS.md); one Playwright golden path per phase
- module target 150 LOC, hard cap 200
- every generative/destructive commit states its consequence inline; one hue per job (DESIGN.md)
- a UI change that deviates from DESIGN.md updates DESIGN.md in the same PR, as its own commit
- CI (`.github/workflows/e2e.yml`) green on the PR **and** on the push to main before the next merge (R-012)
- score agent: every pure module (architecture.md) lands with its tests in the same PR, and each is broken on purpose once to see a test fail (spec-first)
- the GPU hand-off is never weakened: a `plan` job releases its slot only after `/api/ps` is empty (F-020); CP1 numbers are logged before W3
- stored data: score versions carry `score_v`, chat drafts `draft_v`, card bodies `chat_v`, grid sidecars `grid_v`, splices `splice_v`, readings `reading_v`, library snapshots `own_v`; shape changes bump it with a migration-named test (architecture.md "Data", "Data (chat)", "Data (C3)")
- chat: a turn holds one `plan` slot and unloads before release on every path; an edit splice never saves silently on a failed join (D-101)

## Voice & conventions
- branches `feat/`, `fix/`, `test/`; commits `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`; never push to main; one problem per PR
- UI copy: uppercase 1–3 word verbs for buttons; errors say what happened + what to do
- no "record the browser check" docs-only commits (D-004)
