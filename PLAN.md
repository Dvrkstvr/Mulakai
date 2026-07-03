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
| Repaint region    | `repaint`    | src_audio, repainting_start/end, prompt, audio_cover_strength (= VARIANCE slider, inverted) — LM/thinking skipped      |
| Add layer         | `lego`       | src_audio (current mix), prompt (what to add — no structured "track type" param), repainting_start/end — LM/thinking *not* skipped, Base model only |
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
6. **Add-layer flow** — whole-song prompt describing an instrument/vocal part
   → generate new audio conditioned on the existing mix → new Layer created.
   Bundled with Phase 7 (below) since neither is useful alone. Detailed
   design: see "Add Layer (lego) — Phase 6+7 Design" below.
7. **Layer stack UI & mixing** — show all layers for the open song, each
   with waveform, volume/mute/solo, a "Repaint" action, and a version
   history dropdown to revert. Bundled with Phase 6 (see below) — a second
   layer is only meaningful once it can be mixed, muted, and heard together
   with the first.
8. **Version history** — per-layer version list with revert/compare
   (A/B listen) and the ability to delete an old version. Detailed design for
   this phase plus the region-editing/timeline work: see "Repaint Editor UX
   Upgrade" below.
9. **Export** — render the composite (all active, unmuted layer versions
   summed) to WAV/MP3.
10. **Testing & hardening** — Vitest for store/engine logic, Playwright e2e
    for the golden path (generate → repaint a region → add a layer → revert
    a version → export), manual browser verification per workflow rules.

Each phase = one OpenSpec change + PR, following the workflow below.

## Repaint Editor UX Upgrade (planned 2026-07-02)

Six requested changes to the Editor's waveform + history, discussed and
decided 2026-07-02. Not yet implemented — goes through `/opsx:propose` before
code per the Spec-Driven Development rule (touches 6+ files). Captured here
so the proposal can be written straight from this section.

**The underlying data already exists**: `versions.params_json` (schema.ts)
already stores the full generation request — prompt, region, model, seed —
for every version. None of this needs a schema change, only exposing what's
already stored and adding two new mutations (delete, regenerate).

### 1. History row: prompt instead of timestamp

- Each history row currently shows a wall-clock timestamp. Replace it with
  the version's `prompt` (parsed from `params_json`), truncated to one line.
  Fall back to the existing `label` for entries with no prompt (e.g. "first
  generation" if generated without one).
- **Double-click the time-frame text** (e.g. "0:12–0:32", parsed from
  `params_json.repainting_start/end`) → sets that region as the current
  waveform selection. Selection only — does **not** seek/move the playhead
  (decided 2026-07-02). Entries with no region (e.g. a whole-song base
  generation) aren't double-click targets for this.
- **Double-click the prompt text** → loads it into the prompt input box so
  it can be reused or tweaked, independent of the time-frame double-click.

### 2. Draggable/resizable waveform selection

`Waveform.tsx`'s mouse handling currently only supports "drag from empty
space to create a new region." Extend it to hit-test the existing selection
on mousedown (small pixel-space tolerance, e.g. ~6–8px, around each edge)
and branch into one of four drag modes:
- **Inside the selection** → move the whole region (both edges shift
  together, width preserved, clamped to `[0, duration]`).
- **Near the left edge** → drag the start point only (clamped so width
  never drops below the 3s repaint minimum, and never crosses the end).
- **Near the right edge** → drag the end point only (same clamps, 90s max
  from `REPAINT_MAX_SECONDS`).
- **Outside the selection** (empty waveform) → existing create-new-region
  behavior.
Cursor should hint the mode on hover (`ew-resize` near edges, `move` inside,
`crosshair` elsewhere). Lift `REPAINT_MIN_SECONDS`/`REPAINT_MAX_SECONDS` out
of `Editor.tsx` into a small shared constants module so `Waveform.tsx` can
clamp against the same numbers without duplicating them.

### 3. Standalone playhead timeline

Add a thin scrub strip (diamond marker per `docs/design/DESIGN.md`'s slider-
thumb shape grammar) directly below the waveform canvas, in its own DOM
element so it never shares mouse events with the selection-drag surface
described above. Click or drag on it seeks `audioRef.current.currentTime`
directly; the waveform canvas keeps doing selection only. This replaces the
current implicit reliance on the native `<audio>` element's own scrubber for
positioning while editing a region.

### 4. Delete a history entry

- Any version can be deleted, **including the active one** (decided
  2026-07-02) — but every delete requires an inline two-step confirm (arm →
  confirm, rust-colored, consistent with the app's other destructive-action
  pattern) before it fires, per `AGENTS.md`'s "state the consequence inline
  before commit" rule.
- Deleting the active version **auto-reverts** to the layer's next most
  recently created remaining version.
- A layer must always keep at least one version — deleting the last
  remaining version for a layer is rejected.
- New route: `DELETE /api/layers/versions/:versionId` (removes the DB row +
  its audio file on disk).

### 5. Regenerate a history entry as an alternate

- New action per history row: replay that version's stored prompt + region
  + model (text2music for the base entry, repaint for region entries) with
  a **fresh random seed** (decided 2026-07-02 — "alternate" implies
  variation, not exact reproduction).
- The result is **appended to history but does not become active**
  (decided 2026-07-02) — it sits alongside the original so a few alternates
  can be compared before manually reverting/activating one.
- Source audio for a repaint-regenerate is the layer's *current* active
  version (same as a normal repaint), not a reconstructed historical prior
  state — simplest option, consistent with how repaint already works. Worth
  revisiting if it proves confusing once real usage shows whether "current"
  vs. "original-at-the-time" diverges often in practice.
- New route: `POST /api/layers/versions/:versionId/regenerate`.
- `jobs.ts`'s `persistVersion` needs an `activate: boolean` param so this
  path can insert `active = 0` without touching the layer's current version.

### File-level plan

- `server/src/db/schema.ts` — no changes (data already captured).
- `server/src/routes/songs.ts` — expose parsed `prompt`/`regionStart`/
  `regionEnd`/`taskType` per version alongside the existing fields.
- `server/src/routes/layers.ts` — add the delete and regenerate routes.
- `server/src/services/jobs.ts` — `activate` flag on `persistVersion`;
  regenerate path resolves task type + rebuilds params from stored JSON.
- `client/src/api.ts` — `deleteVersion`, `regenerateVersion`, extend the
  version type.
- `client/src/Waveform.tsx` — move/resize drag modes; new `Timeline.tsx`
  scrub strip (or a second canvas in the same file, TBD at implementation
  time — keep each under the 150-200 LOC module cap either way).
- `client/src/Editor.tsx` — history row redesign (prompt + time-frame
  double-click targets, delete confirm, regenerate action); lift the
  min/max region constants out to a shared module.

## Add Layer (lego) — Phase 6+7 Design (planned 2026-07-02)

Discussed and decided 2026-07-02. Not yet implemented — this is the largest
phase so far and should get an `/opsx:propose` proposal (or be split across
several PRs) rather than landing as one sweep; touches 10+ files across a
new client-side audio mixing engine, a new server orchestration path, and a
layer-stack UI that doesn't exist yet.

**Correction to the table under "ACE-Step Integration" above**: `lego` has
**no dedicated "track name" parameter** in the real API (re-verified against
`docs/ace-step-1.5/API.md` + `GUIDE.md` 2026-07-02) — that row was an
unverified assumption, same mistake as the earlier `repaint_mode`/
`repaint_strength` one. `lego` actually takes exactly the same shape as
`repaint` — `src_audio`, `task_type: 'lego'`, `prompt`/`caption` (what to
add), `repainting_start/end` (interval; `lego` uses the full range for
whole-song layers per the decision below) — plus one real difference:
**`lego` is a Base-model-only task and, unlike `repaint`/`cover`/`extract`,
it does NOT skip the 5Hz LM** (`API.md` §4.2's LM note explicitly lists
`text2music`, `lego`, `complete` as the task types where the LM runs) — so
THINKING MODE / LM MODEL are meaningful controls for Add Layer, unlike the
repaint panel where they were correctly removed.

### Decisions

1. **Full multi-layer playback engine, built now.** A second layer is
   useless if you can't hear it mixed with the first — build a real Web
   Audio graph (decode each active/non-muted layer's current version,
   one `AudioBufferSourceNode` + `GainNode` per layer reflecting
   volume/mute/solo, summed to a master `GainNode` → destination, one
   shared transport for play/pause/seek) rather than deferring to a later
   phase. This replaces the current single `<audio>` tag once a song has
   more than one layer.
2. **Whole-song layers only for v1** — no region-scoped Add Layer yet. A
   region-scoped layer needs silence padding outside its window when
   mixed; skip that complexity for now. New layers get `region_start: 0`,
   `region_end: null` (matches the existing "null = full length" schema
   convention). Region-scoped Add Layer is a clean follow-up once whole-
   song mixing is proven out.
3. **Single prompt field, auto-derived layer name.** No separate "track
   type" input — ACE-Step doesn't have one anyway (see correction above).
   The layer's short label (shown in the stack UI) is derived from the
   prompt client-side (e.g. first few words, title-cased) and editable
   afterward via an inline rename, not asked for up front.

### Feature gating (per the existing ACE-Step Integration table, now enforced)

`lego` requires a Base model (32–64 steps recommended, no turbo support).
The model inventory already returned per-model `supported_task_types`
(`acestep.ts`'s `ModelInfo.supportedTaskTypes`, wired through since the
model-selection work) — Add Layer must check this and disable/explain
itself when no downloaded model supports `lego`, rather than attempting the
call and surfacing ACE-Step's rejection after the fact. Because Base-model
generation is much slower than Turbo repaint, the commit action states this
inline before firing (`AGENTS.md`'s "state the consequence inline" rule) —
something like "uses the BASE model (slower, ~32+ steps)".

### Architecture: client-side mixing

Two related but distinct capabilities, split into small modules under
`client/src/mix/` (module-size cap applies per-file, not per-folder):

- `mix/decodeLayers.ts` — fetch + `AudioContext.decodeAudioData` each active
  layer version into an `AudioBuffer`. Shared by both capabilities below.
- `mix/bounceMix.ts` — renders a given set of decoded layers through an
  `OfflineAudioContext` (respecting current volume/mute/solo) down to one
  buffer, PCM/WAV-encodes it to a `Blob`. Takes an explicit layer list
  rather than assuming "all layers" — `lego` defaults to bouncing all
  currently active (non-muted) layers ("the existing mix" a new track
  should fit into); a later `complete` implementation would default to
  just the focused layer (per ACE-Step docs, `complete` expects a single
  track, e.g. a cappella vocals, not a pre-mixed group). This is a one-shot
  batch render for model conditioning, not part of the live playback graph
  below — confirmed 2026-07-02 there's no native ACE-Step task for
  "merge already-separate stems into one file" (`extract`/`lego`/`complete`
  don't cover it because it isn't a generative operation, it's just
  mixing), so this bounce step is the actual substitute.
- `mix/playbackEngine.ts` — the live transport: one source+gain node pair
  per active layer, a shared master gain, play/pause/seek across all of
  them in sync, playhead reporting for the existing `Timeline`/`Waveform`
  playhead prop. Editor.tsx swaps its bare `<audio>` element for this once
  `song.layers.length > 1`; single-layer songs can likely keep the simple
  `<audio>` path since there's nothing to mix yet (avoids paying the Web
  Audio complexity cost when it isn't needed). This is **in-app preview
  only** — final mixing/mastering happens outside Mulakai (Cubase), so
  Phase 9's Export likely becomes "download each layer's active version as
  a separate stem" rather than a composited master render; not deciding
  that now, just flagging it so Phase 9 doesn't default back to the old
  composite-master assumption in the Architecture section above without
  re-checking this thread first.

### Architecture: layer stack UI

Per `docs/design/DESIGN.md`'s already-sketched (marked "future work") Editor
layout — "Layer lanes: one thin waveform lane per layer, right-aligned
uppercase name, volume + solo icons; muted lane's icon in rust-text" — this
phase is what turns that sketch into real UI:

**Layout, to avoid the Editor becoming a wall of stacked UI** (raised and
resolved 2026-07-02): unfocused layers render as a **single compact row
only** — name, a small volume slider, mute/solo icon toggles, a focus
affordance. No waveform, no repaint bar, no version history for a layer
you're not working on. Only the **focused** layer expands into the full
editing surface (waveform, timeline, repaint bar, version history) — the
same footprint the Editor already has today, just re-targetable instead of
duplicated per layer. Version history is shown **per selected (focused)
layer only**, and should be capped/collapsible (e.g. 3–4 rows + "show more")
rather than always rendering every version — worth fixing for the base
layer too regardless of Add Layer, since a single layer already reached 5
versions in testing.

- `client/src/LayerStack.tsx` — the compact-row list described above:
  name (inline-editable), volume slider + mute/solo toggles (wired to the
  existing `PATCH /api/layers/:id` mix-state route, already built but
  unused by any UI today), and a "focus" affordance per row.
- `client/src/AddLayer.tsx` — the "+ ADD LAYER" action: prompt input,
  feature-gated per the section above, states the Base-model consequence
  inline, submits, polls, reloads.
- `Editor.tsx` moves to a **focused-layer model**: one layer is "focused"
  at a time (default: base) and drives the waveform/selection/repaint panel
  and `VersionHistory` exactly as today, just re-pointed at whichever layer
  is focused instead of hardcoded to `baseLayer`; the compact layer stack
  sits alongside/above it.

### Architecture: server

- `server/src/services/addLayerJobs.ts` — mirrors `repaintJobs.ts`'s shape:
  `startAddLayer(songId, prompt, layerName, mixAudio, params)` →
  `ensureModelLoaded` (task_type `lego`, LM **not** skipped) → `releaseTask`
  with the uploaded mix blob as `src_audio` → poll → insert a new `layers`
  row + its first `versions` row (active).
- New route, `POST /api/songs/:id/layers` (multipart: mix audio blob +
  prompt + settings) — creates the job. Framed as a song-scoped route since
  it creates a layer, unlike `layers.ts`'s existing routes which all
  mutate an existing layer.
- No DB schema changes — `layers`/`versions` already have every column this
  needs (`name`, `kind`, `region_start`, `region_end`, `volume`, `muted`,
  `solo`; `versions.params_json` already generic).

### Settings

New `SettingsPanel` mode (`'addLayer'`, alongside today's `'generate'` /
`'repaint'`): DIT MODEL (filtered to `lego`-capable models only), LM MODEL +
THINKING MODE (meaningful here, unlike repaint), STEPS + GUIDANCE (Base-
model defaults, not Turbo's), RANDOM SEED. Reuses most of the existing
`'generate'` mode JSX — mainly a model-list filter and a settings-store
slice (`AddLayerSettings` + `addLayerParams()` in `settings.ts`, same shape
as the existing `GenSettings`/`RepaintSettings` split).

### File-level plan

- `client/src/mix/decodeLayers.ts`, `mix/bounceMix.ts`, `mix/playbackEngine.ts` — new.
- `client/src/LayerStack.tsx`, `client/src/AddLayer.tsx` — new.
- `client/src/Editor.tsx` — focused-layer restructure; swap `<audio>` for
  the playback engine when `layers.length > 1`.
- `client/src/VersionHistory.tsx` — cap/collapse the version list (3–4 rows
  + "show more"); applies to the base layer today too, not just new layers.
- `client/src/SettingsPanel.tsx`, `client/src/settings.ts` — `'addLayer'`
  mode + `AddLayerSettings` + params mapper + model-list filtering.
- `client/src/api.ts` — `addLayer()` (multipart), layer-list types as needed.
- `server/src/services/addLayerJobs.ts` — new.
- `server/src/routes/songLayers.ts` (or similar) — new `POST /:id/layers`.
- `server/src/index.ts` — mount the new route.
- `docs/design/DESIGN.md` — turn the "future work" layer-lanes note into a
  real spec once the UI shape is settled during implementation (per
  `AGENTS.md`'s "UI PRs that deviate from DESIGN.md must update DESIGN.md
  in the same PR" rule).

## Custom Player Controls (planned 2026-07-02, then implemented)

Native `<audio controls>` (library footer, editor canvas) doesn't match
`docs/design/DESIGN.md`'s shape/color grammar — replaced with a shared
`client/src/Player.tsx` used in both the library footer and the editor
canvas. Mockups approved 2026-07-02.

**Styling** (all shapes/colors already defined in `docs/design/DESIGN.md`,
no new tokens):
- **Play/pause**: acid-filled hexagon (`clip-path` per the transport-shape
  rule) — the one control allowed to use the hexagon, since it's the only
  play/commit-adjacent action here.
- **Stop (playhead to start)**: plain square icon button, `line-hi` border,
  `text-mid` icon — deliberately not a hexagon, that shape stays reserved
  for play.
- **Progress/scrub**: sky diamond-thumb slider, reusing `Timeline.tsx`'s
  pattern — sky is already the spec'd color for "playhead," so this is the
  correct token, not a new one.
- **Volume**: same diamond-thumb slider mechanics, but neutral gray
  (`text-mid`/`text-hi`) — volume isn't a commit/selection/version, so it
  doesn't borrow acid or sky.
- **Download**: neutral skewed parallelogram button (same recipe as the
  header's EXPORT button), not filled — doesn't compete with acid CTAs.

**Cross-screen playback lifecycle** (decided 2026-07-02): the library and
editor each have their own independent playing audio, and only one should
ever be audible/visible at a time.
- **Library → Editor**: stop (not pause) any library-playing song and hide
  the library footer player before the editor mounts — it should not just
  be `z-index`ed behind the editor, its audio must actually stop.
- **Editor → Library**: stop the editor's playback the same way; the
  library footer player reappears (still stopped, not resumed) if a song
  was previously selected there.
- Implementation: lives in `App.tsx`'s screen-switch handlers (`setOpenSongId`
  in both directions) since that's the single place both transitions funnel
  through — stop-and-clear the relevant player state before flipping
  `openSongId`, rather than relying on unmount ordering or CSS visibility
  alone.

## Layer Stack Polish + Live Multi-Layer Playback (planned 2026-07-02)

Five issues raised against the lane-based layer stack (built earlier the
same day), discussed and decided 2026-07-02:

1. **Lane controls move above the waveform** (slim horizontal bar: name,
   volume, mute, solo) instead of a left column — the left column ate too
   much horizontal space from the waveform itself.
2. **Double-click-to-seek was broken** — the lane redesign moved `Waveform`
   into `LayerLane.tsx` but dropped its `onSeek` prop. Straightforward fix,
   just needs re-threading from `Editor.tsx`'s existing `seek()`.
3. **Focus-switching animation was jarring** (root cause: focusing a
   different layer swaps between two different components — `Waveform` and
   `PlayerWaveform` — for both the old and new focused lane, and each
   mount re-triggers the left-to-right bar-reveal animation meant for
   *newly loaded audio*, not a focus change). Fix: merge `PlayerWaveform`
   into `Waveform` as one component with an `interactive` toggle. Focusing
   a layer then never changes that layer's `audioUrl`, so the reveal
   animation naturally doesn't re-fire — and it naturally *does* still fire
   on a version revert (a genuine `audioUrl` change), which is exactly the
   split that was asked for, with no extra flags needed. A CSS transition
   on the focused/unfocused highlight itself provides the "fade" feel for
   the focus change.
4. **A timeline bar moves to the top** of the lane stack — time readout +
   seekable scrub bar (decided: scrub bar only; play/pause/volume/download
   stay below the lanes, not moved up too).
5. **Live multi-layer playback** — the piece originally scoped as
   `mix/playbackEngine.ts` in the Add Layer design above, deliberately
   deferred at the time. Building it now: one `AudioBufferSourceNode` +
   `GainNode` per currently-audible layer (reusing `mix/activeLayers.ts`'s
   solo/mute selection and `mix/decodeLayers.ts` from the bounce work),
   summed to a master gain, one shared transport (play/pause/seek) driving
   all sources in sync. This replaces the current single-`<audio>`-per-
   focused-layer playback — `Player.tsx`'s existing UI (buttons, volume,
   download) stays as the visual chrome, rewired to the new engine instead
   of a lone native `<audio>` element. The download button keeps
   downloading the focused layer's individual stem (unchanged) — the new
   engine is for in-app preview, not a rendered composite file (Phase 9
   Export is still an open question, see the Add Layer design above).

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
