# Mulakai — Agent Instructions

> Automatically loaded by Claude Code for all sessions and subagents.
> Rules of the road are in `AGENTS.md` (read together with this file).
> Grand goal, scope, and phased plan are in `PLAN.md` — read it first.

@AGENTS.md

## Tech Stack

React + TypeScript + Vite (client) · Express + SQLite (server) · Zustand ·
minimal Tone.js/Web Audio playback (layer versions summed to master — no
synthesis/plugin layers) · ACE-Step 1.5 (external process, Gradio API) for
generation, repaint, and layer conditioning.

## Commands

```bash
# Frontend
npm run dev          # Vite dev server
npm run build         # TypeScript check + Vite build
npm test              # Vitest unit tests
npm run test:e2e       # Playwright e2e

# Backend (server/)
npm run dev            # Express dev server

# ACE-Step 1.5 (separate process, see its own AGENTS.md)
uv run acestep --port 8001 --enable-api --backend pt --server-name 127.0.0.1
```

## Design System

`docs/design/DESIGN.md` is mandatory reading before any UI work — color
tokens (one semantic job per hue), shape grammar (parallelograms/hexagons,
zero radius), typography, and the three-screen app model live there.

## Project Structure

- `client/components/` — React UI: Library (flat list, favorites, trash),
  Player, Create panel, SongEditor (waveform, region select, layer stack,
  version list)
- `client/store/` — Zustand: `libraryStore`, `songEditorStore` (layers,
  versions, region selection), `transportStore`
- `client/services/` — ACE-Step API client (generate, repaint, layer/
  audio2audio conditioning)
- `server/routes/`, `server/db/` — Express API + SQLite schema (songs,
  layers, versions — no users/profiles/playlists tables)
- `openspec/` — specs (`specs/`) and change proposals (`changes/`)

## OpenSpec Workflow

```bash
/opsx:propose "feature-name"
/opsx:explore
/opsx:apply
/opsx:archive
```

Use before implementing any feature touching 3+ files. See `AGENTS.md` for
the module-size and testing rules that apply to every change.

## Reference Projects (do not modify)

- `S:\AI Gen\ace-step-ui-main` — base this project adapts from (generation
  UI, library, player, stems, audio editor).
- `S:\AI Gen\ACE-Step-DAW-main` — reference only, for arrangement/mixing
  engine patterns. Do not port its plugin/MIDI/synth/collaboration layers.
- `S:\AI Gen\ACE-Step-1.5` — external AI backend, reached via
  `ACESTEP_API_URL`; never modified from this project.
