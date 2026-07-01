# Mulakai — Project Plan

## Grand Goal

Build a **slim, single-user, web-based AI music editor**: generate a song with
ACE-Step 1.5, then work on it directly — select a section and **repaint** it,
select a section and **layer** a new instrument or vocal part over it, keep
every iteration as a **version** you can revert to or compare. No accounts, no
social features, no video generator, and no general-purpose multitrack
arrangement DAW. One song open at a time.

Think: "open a generated song, click-drag a region on its waveform, tell the
model what to change there" — not a DAW, not a social music platform.

## Why not just use the existing DAW or ace-step-ui as-is?

- `ACE-Step-DAW` is a full Tauri desktop DAW built around arranging many
  tracks/clips over time (VST3/WAM, MPE, MIDI editing, Strudel, synthesis
  engines, collaboration, an agent dashboard). None of that matches "edit one
  AI-generated song in place" — it's a different tool for a different job.
- `ace-step-ui` is close in spirit (generate → library → player) but carries
  a social/account layer (usernames, profiles, sharing) and a video
  generator that aren't part of this project's job either.

Building fresh, reusing only what's directly relevant (the generation API
client, the library/player UI patterns, waveform display ideas), keeps the
codebase small and focused on the actual workflow: **generate, repaint,
layer, version, export.**

## Decisions Locked In

- **Platform**: web app only. React + TypeScript + Vite frontend, Express +
  SQLite backend. No Rust/Tauri/WASM toolchain, no desktop packaging.
- **No accounts/social**: no usernames, profiles, sharing, following, or
  playlists. Single implicit local user — the app just has *a* library, not
  *your* library among others.
- **Library**: a flat, searchable list of generated songs.
  - Favorites are pinned/shown at the top.
  - Disliking a song hides it into a Trash section; trashed songs are
    permanently deleted after 7 days (background sweep, undo-able before
    that).
- **No video generator/editor** — cut entirely.
- **No dedicated multitrack DAW/timeline** — replaced by a **per-song layer
  editor** (see below). Only one song is open/editable at a time; there is no
  arranging of multiple distinct songs together.
- **Repo**: fresh project in `E:\repos\Mulakai`, new git history. The three
  source projects stay untouched as reference — `ace-step-ui-main` for
  generation-API-client and library/player UI patterns, `ACE-Step-DAW-main`
  for waveform-rendering ideas only, `ACE-Step-1.5` as the unmodified backend
  dependency.

## The Editing Model (core of this project)

Each song is a **stack of layers**, not a multitrack arrangement:

```
Song: "Summer Nights"
│
├─ Layer: Base            [==========waveform==========]  vol/mute/solo
├─ Layer: Vocals          [        ==region==           ]  vol/mute/solo  [Repaint] [Versions ▾]
├─ Layer: Bass            [   ====region====            ]  vol/mute/solo  [Repaint] [Versions ▾]
└─ + Add Layer  (pick a region → describe an instrument/vocal → generate)
```

- **Base layer**: the original generation (or an uploaded/imported track).
- **Repaint**: select a time region on any layer's waveform → describe what
  should change there → the model regenerates just that region → the result
  becomes a new **version** of that layer, with the prior version kept in
  that layer's version list (revert/compare any time).
- **Add layer**: select a time region (or the whole song) → describe a new
  instrument or vocal part → the model generates new audio conditioned on the
  existing mix in that region → it becomes a new layer, confined to that
  region, independently mutable (volume/mute/solo) and independently
  repaintable/versioned going forward.
- **Composite playback**: what you hear/export is all active (non-muted)
  layer versions summed together.
- **Versions**: every repaint or layer-add produces a version entry
  (timestamp, prompt/params used, region). Version history is per-layer, so
  reverting a vocal repaint doesn't touch the bass layer's history.

This maps directly onto ACE-Step 1.5's existing repaint/audio2audio/
reference-audio capabilities — no new model behavior needed, just an editor
UI + orchestration around the existing API surface.

## UI Design (locked 2026-07-02)

Full spec in `docs/design/DESIGN.md` — read it before any UI work. Summary:

- **Desktop-only** SPA with exactly three screens: Library, Create, Editor.
- **Interaction rhythm**: target (select region/section — sky blue) → commit
  (generate/repaint — acid). Quick path via a scope-aware prompt bar; control
  path via a side sheet with full generation parameters.
- **Visual language**: carbon `#1C1D21` canvas, zero border radius,
  parallelograms for choices, hexagons for transport, 1px hairlines, bold
  uppercase structural type.
- **Color semantics** (one job per hue): acid `#D4FF00` = commit actions,
  sky `#30BCED` = selection/scope, lilac `#7B4B94` = versions/history/AI
  markers, rust `#CC3F0C` = errors/warnings/trash.

## Architecture

```
Mulakai/
├── AGENTS.md / CLAUDE.md      # workflow rules (see below)
├── openspec/                  # specs + change proposals (OpenSpec-driven)
├── client/                    # React + TS + Vite frontend
│   ├── components/            # Library (flat list, favorites, trash),
│   │                          #   Player, Create panel, SongEditor
│   │                          #   (waveform, region select, layer stack,
│   │                          #    version list)
│   ├── store/                 # Zustand: libraryStore, songEditorStore
│   │                          #   (layers/versions/selection), transportStore
│   ├── services/              # api.ts (ACE-Step proxy calls: generate,
│   │                          #   repaint, layer/audio2audio)
│   └── types/
└── server/                    # Express + SQLite
    ├── routes/                # songs, layers, versions, generation proxy
    └── db/                    # schema: songs, layers, versions
                                #   (no users/profiles/playlists tables)
```

**Data model**:
- **Song**: id, title, metadata (style/lyrics/etc.), `favorite`, `trashedAt`
  (null unless disliked, drives the 7-day sweep).
- **Layer**: belongs to a Song; ordered; has type (base/vocal/instrument/
  repaint-target), region (start/end or full-length), volume/mute/solo.
- **Version**: belongs to a Layer; the actual audio file + generation params
  (prompt, seed, region) + timestamp; one version is "active" per layer.

**Playback engine**: minimal Tone.js (or plain Web Audio) graph — one player
node per active layer version, summed to a master output. No synths, no
plugins, no MIDI, no automation lanes.

**Backend**: Express + SQLite, scoped to songs/layers/versions and the
ACE-Step generation proxy. No auth routes, no sharing routes, no video
routes.

## ACE-Step Integration (verified against docs/en/API.md + INFERENCE.md, 2026-07-02)

Use the **native FastAPI server** (`python -m acestep.api_server`, port 8001)
— NOT the Gradio `/generation_wrapper` API that ace-step-ui uses.

**Job flow**: `POST /release_task` (JSON, or multipart with `src_audio`
upload) → returns `task_id` → poll `POST /query_result` (status 0=running,
1=done, 2=failed) → download via `GET /v1/audio?path=...`. Also:
`POST /format_input` (LLM caption/lyrics enhancement = the AI ENHANCE
button), `GET /v1/models`, `GET /health`.

**Task-type mapping** (the editing model maps 1:1 onto the API):

| Feature           | task_type    | Key params                                                                                                             |
| ----------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Generate          | `text2music` | prompt, lyrics, bpm/key/duration, thinking                                                                             |
| Repaint region    | `repaint`    | src_audio, repainting_start/end, repaint_mode, repaint_strength (= VARIANCE slider), crossfade params                  |
| Add layer         | `lego`       | src_audio (current mix), track name (vocals/drums/bass/guitar/keyboard/strings/synth/…), caption, repainting_start/end |
| Stem separation   | `extract`    | src_audio + track to isolate — native, use Demucs as alternative option                                                |
| Complete (future) | `complete`   | partial track + instruments to add                                                                                     |

**Model constraint**: turbo model supports only text2music/repaint/cover;
`lego`/`extract`/`complete` require the base model (32–64 steps, slower).
The `model` field is per-request. UI must: show per-action time estimates,
and feature-gate + LAYER / stems behind base-model availability.

**Orchestration (our server)**: job record → release_task → poll ~2s →
download audio → store file → create Version row (with full request params +
returned seed, so every version is reproducible) → notify client.
Repaint sends the layer's current version as src_audio; add-layer bounces
the composite mix client-side and uploads it as src_audio.

## Phased Plan

1. **Scaffold** — new client/server skeleton; write a clean typed client for
   the native FastAPI endpoints (release_task / query_result / v1/audio /
   format_input / health) plus the polling job orchestrator. Get a bare
   "generate → play → save to library" loop working end-to-end against a
   local ACE-Step-1.5 instance. Set up OpenSpec, test tooling (Vitest +
   Playwright).
2. **Library** — flat list, search, favorites-pinned-to-top, dislike →
   trash, 7-day trash sweep (scheduled job).
3. **Song data model** — songs/layers/versions tables + API routes; a fresh
   generation creates a Song with one Base layer with one Version.
4. **Waveform + region selection UI** — render the composite waveform and
   per-layer lanes, click-drag region selection plus click-to-select section
   strip (sky selection semantics per `docs/design/DESIGN.md`).
5. **Repaint flow** — selected region + prompt → call ACE-Step's repaint
   endpoint → new Version appended to that layer → playback updates.
6. **Add-layer flow** — selected region (or full song) + prompt describing
   an instrument/vocal → generate new audio conditioned on the existing mix
   → new Layer created, confined to that region.
7. **Layer stack UI & mixing** — show all layers for the open song, each
   with waveform, volume/mute/solo, a "Repaint" action, and a version
   history dropdown to revert.
8. **Version history** — per-layer version list with revert/compare
   (A/B listen) and the ability to delete an old version.
9. **Export** — render the composite (all active, unmuted layer versions
   summed) to WAV/MP3.
10. **Testing & hardening** — Vitest for store/engine logic, Playwright e2e
    for the golden path (generate → repaint a region → add a layer → revert
    a version → export), manual browser verification per workflow rules.

Each phase = one OpenSpec change + PR, following the workflow below.

## Workflow (adapted from ACE-Step-DAW's AGENTS.md/CLAUDE.md + ACE-Step-1.5's AGENTS.md)

- **Spec before code**: non-trivial features get an OpenSpec proposal
  (`openspec/changes/`) with Given/When/Then scenarios before implementation;
  archived into `openspec/specs/` on completion.
- **Module size discipline** (hard-learned from the DAW's 10K-line
  `projectStore.ts`): target `<=150` LOC per module, hard cap `200`. Split by
  responsibility before merging; if a module must exceed the cap, justify it
  in the PR and file a concrete follow-up split.
- **One problem per PR**: minimal, reviewable diffs. No drive-by refactors.
- **Tests required**: Vitest for store/engine logic, Playwright for one
  golden-path e2e per phase. Run `@tester`-equivalent before every commit —
  don't self-assess.
- **Docstrings/comments**: only where intent is non-obvious (hidden
  constraint, workaround, surprising behavior) — not restating what code
  does.
- **Feature gating**: unfinished/WIP UI must not be exposed as usable by
  default.
- **Git**: `main` stable, feature branches `feat/xxx`/`fix/xxx`, PR-driven, no
  direct pushes to main.
- **Browser-test UI changes** before calling them done — start the dev
  server, exercise the golden path and edge cases, don't rely on type-checks
  alone.

## Open Questions For Later Phases

- ~~Add-layer conditioning~~ — resolved: the API's `lego` task type is
  purpose-built for this (see ACE-Step Integration above).
- **Waveform rendering**: build a small canvas renderer for v1; only reach
  for a mipmap-cache approach if performance actually requires it at typical
  song lengths (up to ~4 min).
- **Version storage growth**: each repaint/layer-add stores a new audio file;
  decide a retention/cleanup policy once real usage patterns are visible —
  don't over-engineer this before Phase 8.
