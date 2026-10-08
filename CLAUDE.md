# Mulakai — Agent Instructions

> Automatically loaded by Claude Code for all sessions and subagents.
> Grand goal, scope, and phased plan are in `PLAN.md` — read it first.
> `AGENTS.md` holds the full rules (scope, design, git, testing); read it
> before a change outside the area rules. Area rules load with their files
> from `.claude/rules/*.md`; the long whys are in `docs/decisions/`.

## Costly rules (digest of AGENTS.md)

- Never push to `main`: PR-merge only, and only after CI is green on the PR
  and on the last push to `main`. Never merge with failing tests.
- Branches `feat/` `fix/` `test/`; commits `feat:` `fix:` `docs:`
  `refactor:` `test:` `chore:`; one problem per PR, no drive-by refactors.
- Modules: target ≤150 LOC, hard cap 200. Split by responsibility first.
- A Vitest test with every behaviour change; run the suites before every
  commit; browser-check UI changes on the dev server.
- UI follows `docs/design/DESIGN.md`: zero radius, one hue per job, a
  consequence line before every generative or destructive commit. A UI
  change that deviates updates DESIGN.md in the same PR, as its own commit.
- Scope: a feature not in `PLAN.md` is a scope question first. A 3+ file
  feature gets a dated `PLAN.md` section before code.
- Feature-gate unfinished flows; never show "coming soon" as usable.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts.
- If graphify-out/wiki/index.md exists, use it for broad navigation; read graphify-out/GRAPH_REPORT.md only for broad architecture review.
- After modifying code, and after every merge, run `graphify update .` (AST-only, no API cost). Merge-driver setup: `.claude/rules/graphify-out.md`.

## Tech Stack

React + TypeScript + Vite (client) · Express + SQLite (server) · Zustand ·
minimal Web Audio playback (layer versions summed to master — no
synthesis/plugin layers, no Tone.js) · ACE-Step 1.5 (external process,
Gradio API) for generation, repaint, and layer conditioning · optional
extra song-creation engines for a new song's first take (YuE2, then
HeartMuLa; each its own process and venv behind `YUE_API_URL` /
`HEARTMULA_API_URL`, speaking one shared job API, `engineClient.ts`); YuE2
may also re-render a song it made from an edited copy of that song's score
(the SCORE verb, PLAN.md "Score Agent"), and every audio edit (repaint, Add
Layer, extract, remaster) still runs on ACE-Step · optional score planner:
a local Ollama at `LLM_API_URL` (`LLM_MODEL`, default `qwen3:14b`); SCORE
is hidden when it is unset · optional Demucs microservice
(`demucs-server/`, FastAPI) for stem splits.

## Commands

There is no root package.json — run these inside `client/`, `server/`,
`yue-server/` or `e2e/`.

```bash
# Frontend (client/)
npm run dev          # Vite dev server
npm run build        # TypeScript check + Vite build
npm test             # Vitest unit tests
npm run lint         # oxlint

# Backend (server/)
npm run dev          # Express dev server (tsx watch)
npx tsc --noEmit     # typecheck
npm test             # Vitest unit tests

# yue-server/ — fake pipeline: no GPU, torch or yue2; runs on Windows too
pip install -r requirements-test.txt   # once
python -m pytest

# End-to-end (e2e/) — needs client/ and server/ installed, plus ffmpeg on PATH
npx playwright install chromium   # once
npm run test:e2e     # golden path against a fake ACE-Step

# ACE-Step 1.5 (separate process, our fork; see its own AGENTS.md). Not
# `acestep --enable-api`: that API is text2music-only (R-025).
uv run acestep-api --port 8001
```

`test:e2e` starts its own stack on 127.0.0.1 (fake ACE-Step 8101, server
3101 with a throwaway `DATA_DIR`, Vite 5183), so it runs beside a dev
stack; ports and orphans: `.claude/rules/e2e.md`. CI runs it on Ubuntu for
every PR into `main` (`.github/workflows/e2e.yml`), plus the unit suites,
typechecks, lint and pytest (`.github/workflows/checks.yml`).

## Invariants (score agent)

- The planner and YuE2 never share the GPU: a `plan` job unloads the model
  and sees `/api/ps` empty before it releases its queue slot; never shorten
  or skip that (`server/src/services/score/planJob.ts`).
- Only yue-server reads or writes ABC (apply, validate, count); no
  TypeScript port (`docs/decisions/0002-score-logic-on-yue-server.md`).

## Project Structure

- `client/src/` — flat: components, Zustand stores, `api/` (server client),
  playback in `mix/`.
- `server/src/` — `routes/` (Express routers), `services/` (jobs, the GPU
  queue, ACE-Step and engine clients, `engines/`), `db/` (SQLite schema +
  migrations: songs → layers → versions).
- `yue-server/`, `lyrics-server/`, `demucs-server/`, `uvr-server/`,
  `heartmula-server/` (marked for removal) — local Python services;
  `e2e/` — Playwright golden path + fake ACE-Step.

## ACE-Step fork

`S:\AI Gen\ACE-Step-1.5` is the AI backend, reached via `ACESTEP_API_URL`.
It is Mulakai's fork: branch `mulakai` = upstream `main` plus our commits
(`/lyric_timestamp`, `/v1/analyze_audio`). Edit it when Mulakai needs to;
rebase onto upstream when it moves (D-203).

## Reference Projects (do not modify)

- `S:\AI Gen\ace-step-ui-main` — base this project adapts from (generation
  UI, library, player, stems, audio editor).
- `S:\AI Gen\ACE-Step-DAW-main` — reference only, for arrangement/mixing
  engine patterns. Do not port its plugin/MIDI/synth/collaboration layers.
