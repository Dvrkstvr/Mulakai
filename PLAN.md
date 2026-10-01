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

- **Desktop-only** SPA with a flat, enumerable set of top-level views, each a
  full takeover reached from one nav entry point. Library, Create, and Editor
  are the three core views (the creative loop); the set is allowed to grow
  as the app grows — see `docs/design/DESIGN.md`'s "App model" section.
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
├── PLAN.md                    # spec log — grand goal + dated phase decisions
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
   local ACE-Step-1.5 instance. Set up test tooling (Vitest + Playwright).
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

Each phase = one dated section below (decisions + file-level plan) + PR,
following the workflow below.

## Repaint Editor UX Upgrade (planned 2026-07-02)

Six requested changes to the Editor's waveform + history, discussed and
decided 2026-07-02, implemented per the Spec-Driven Development rule (touches
6+ files) as this dated section.

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
phase so far and should be split across several PRs rather than landing as
one sweep; touches 10+ files across a
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

## Export & Remaster — Phase 9 Design (planned 2026-07-06)

Resolves the "Phase 9 Export is still an open question" note above. Two
distinct actions in the Editor's EXPORT rail (`ExportPanel.tsx`), discussed
and decided 2026-07-06:

1. **Stem export** (already built) — download each layer's active version
   as-is. No composite render, per the note already flagged under the Add
   Layer design.
2. **Remaster** (new) — a one-click ACE-Step `cover` pass over the current
   mix, aimed at the highest-quality single-file result ACE-Step can produce
   for the song. Ephemeral by design: never saved into any layer's version
   history, never added to the library — it exists only long enough to be
   downloaded once, then the server discards it.

### Decisions

1. **`cover`, not `lego`.** Re-verified against `docs/ace-step-1.5/API.md`
   2026-07-06: `cover` is exactly "regenerate this source audio, staying
   close to it," which is what a remaster is. Also confirmed API.md states
   the LM is **auto-skipped for `cover`** regardless of `thinking`/
   `lm_model_path` — so no LM model selector is exposed for this action; the
   original idea of pairing Remaster with the 4B LM model doesn't apply
   (`ensureModelLoaded` in `jobs.ts` already encodes this exact skip-list for
   `repaint`/`cover`/`extract`, so no server-side change is needed there).
2. **Fixed settings, no dial-turning.** Per "only exists as a finished
   product," Remaster is a single button, not a settings form:
   - `model`: gated to `cover`-capable models (same pattern as Add Layer's
     `lego` gate), defaulting to `xl-sft` when present — `modelInfo.ts`
     already describes it as "highest quality, tunable CFG."
   - `inference_steps`: 100 — `modelInfo.ts#stepsMax`'s own documented
     ceiling for non-Turbo models (Turbo isn't reachable here; it doesn't
     meaningfully support `cover`, and the model gate excludes it anyway).
   - `audio_cover_strength`: left at ACE-Step's default, `1.0` — API.md
     defines this as "cover strength," lower values trend toward style
     transfer, so `1.0` already means "closest to source."
   - `guidance_scale`: left unset (server default) — only steps and
     closeness-to-source were asked for; `guidanceEffective()` confirms CFG
     matters for `xl-sft`, so ACE-Step's own default applies rather than a
     guessed number.
   - `prompt`/`lyrics`/`bpm`/`key_scale`/`time_signature`: forwarded
     server-side from the song's own stored metadata (already columns on
     `songs`) — there is no prompt box for Remaster, so the server fills
     these itself.
3. **Mix source: the current audible mix.** Same `activeLayers()` selection
   Add Layer already uses (respects mute/solo) via the existing
   `mix/activeLayers.ts` + `mix/decodeLayers.ts` + `mix/bounceMix.ts` +
   `encodeWav` pipeline — no new client-side mixing code. Flagging one
   assumption worth confirming: if "all layers/stems" was meant literally
   (ignore mute/solo), swap `activeLayers(layers)` for `layers` at the one
   call site below.
4. **No persistence, no retention policy to design.** The rendered file goes
   to a scratch location, streams once via a download route, and is deleted
   right after (or on error) — no version row, no layer, no library entry,
   so (unlike the existing "Version storage growth" open question) there's
   nothing to defer a cleanup decision on.

### Feature gating

Same pattern as `AddLayerTrigger.tsx`'s `legoModels` check: fetch
`/api/generate/models`, filter to `m.supportedTaskTypes.includes('cover')`,
disable Remaster with an explanatory line if none are downloaded.
Default-select `xl-sft` from that filtered list if present, else the first
cover-capable model.

### Architecture

- `server/src/services/remasterJobs.ts` (new) — mirrors `addLayerJobs.ts`
  almost exactly: `startRemaster(songId, mixAudio)` reads the song's row for
  prompt/lyrics/bpm/key_scale/time_signature, builds
  `{ task_type: 'cover', inference_steps: 100, model, ...songMeta }`, calls
  `ensureModelLoaded` + `releaseTask` with the uploaded mix as `src_audio`,
  then on success writes the result to a scratch file (not
  `config.audioDir`) and records its path on the job. This is the one job
  type that never calls `persistVersion`/`persistSong`/`persistNewLayer`.
- `jobs.ts` — add one optional field to `Job`, `resultPath?: string`, set by
  `remasterJobs.ts`'s success callback and ignored by every other job type.
  Reuses the existing shared `jobs` Map / `getJob` / `registerJob` / `poll`
  primitives as-is — `GET /api/generate/:jobId` already works unmodified
  for polling a remaster job.
- `server/src/routes/remaster.ts` (new) — `POST /api/songs/:id/remaster`
  (multipart, `mix_audio` field, same multer memory-storage setup as
  `songLayers.ts`) starts the job; `GET
  /api/songs/:id/remaster/:jobId/download` streams `job.resultPath` with
  `Content-Disposition: attachment`, then deletes the file (404s if the job
  isn't done yet, or was already downloaded).
- `server/src/index.ts` — mount the new router.
- `client/src/RemasterAction.tsx` (new, small) — gating check, the same
  bounce sequence `AddLayerTrigger.tsx` already runs, submit + poll loop
  (same shape as its `submit()`), and on `done` triggers the browser
  download instead of calling `onDone()`/refetching the song.
- `client/src/ExportPanel.tsx` — gains a Remaster section below the stem
  list, rendering `<RemasterAction songId={song.id} layers={song.layers} />`;
  states the consequence inline before commit per `AGENTS.md` (e.g. "renders
  a full remaster with XL-SFT at 100 steps — can take several minutes").
- `client/src/api.ts` — `remaster(songId, mixAudio)` (multipart POST,
  mirrors `addLayer()`), reuses the existing `jobStatus()` untouched.

### File-level plan

- `server/src/services/remasterJobs.ts` — new.
- `server/src/services/jobs.ts` — add `resultPath?: string` to `Job`.
- `server/src/routes/remaster.ts` — new.
- `server/src/index.ts` — mount `remasterRouter`.
- `client/src/RemasterAction.tsx` — new.
- `client/src/ExportPanel.tsx` — render `RemasterAction`.
- `client/src/api.ts` — `remaster()`.
- `client/src/index.css` — a few new rules for the Remaster section, reusing
  `.export-panel`/`.hint`/`button.acid` tokens — no new colors.

## Workflow (adapted from ACE-Step-DAW's AGENTS.md/CLAUDE.md + ACE-Step-1.5's AGENTS.md)

- **Spec before code**: non-trivial features (3+ files) get a dated section
  written into this file — decisions, file-level plan, open questions —
  before implementation, the same way every phase above is documented.
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
- **To-do: lyric-timestamp alignment for region selection** (raised
  2026-07-08) — use `stable-ts` (a Whisper wrapper with more reliable
  word-level timestamps than vanilla `openai-whisper`) to transcribe a
  song's vocal layer and get per-word/line timestamps, then surface them in
  the waveform/region-select UI so a lyric line can be clicked to snap the
  selection to its actual timing instead of manual dragging. Likely needs
  vocal isolation (e.g. Demucs, already referenced for `extract`) run first
  for accuracy on a full mix. Runs as a Python subprocess akin to the
  ACE-Step integration, not in the Node/Express server. Not yet scoped —
  needs a dated design section here before implementation. (Separate from —
  and not resolved by — the lyric *tag* vocabulary probe below, which is
  about `[Chorus]`/`[soft voice]`-style annotation tags, not word timing.)
- **To-do: expose `get_lyric_score` as a new REST endpoint** (raised
  2026-07-10, integration audit) — ACE-Step 1.5's quality-scoring mixin
  (LM/DiT/PMI/Reward scores) is Python-internal only today, no REST route.
  Same precedent as the already-added `/lyric_timestamp` and
  `/v1/analyze_audio` endpoints on this project's "mulakai" ACE-Step-1.5
  fork branch: wrap the scoring mixin in a new route there. Would enable
  real best-of-N auto-selection once combined with a batch-size feature
  (see the 2026-07-10 batch-size/progress/track-picker work). Deferred, not
  yet scoped.

## Settings Screen (planned + implemented 2026-07-06)

Added a 4th peer screen (see `docs/design/DESIGN.md`'s App model, "4. Settings")
per a scope discussion — `PLAN.md`'s locked "exactly three screens" line
predates this and is superseded by it, same as FORGE already was.

- **Models**: default DIT/LM model pickers (the same `gen.model`/`gen.lmModel`
  Create's settings panel persists), plus the model/LM inventory with
  per-model descriptions. Read/select only — ACE-Step's native API has no
  download/update-model endpoint (verified against `docs/ace-step-1.5/API.md`).
- **Playback & Export**: default volume-on-load; default Remaster export
  audio format (`flac`/`mp3`/`opus`/`aac`/`wav`/`wav32`, ACE-Step's real
  `audio_format` param) and diffusion steps (1–200, ACE-Step's documented
  Base-model ceiling — the requested 256 exceeds it and isn't supported).
  Sample rate (fixed 48kHz by the model) and bitrate aren't exposed by
  ACE-Step's API, so neither is modeled — would require local transcoding,
  explicitly deferred.
- **Voices**: voice-library upload/rename/delete relocated here from
  Create's `VoicePicker`, which is select-only now (its MANAGE VOICES
  button navigates to Settings via a new `NavigationContext` instead of
  expanding an inline form).
- **Library Maintenance**: storage-used/song-count/trash-count stats (new
  `GET /api/songs/stats`), the trashed-song list with RESTORE (reuses the
  existing `PATCH /:id/trash` restore flag), and EMPTY TRASH NOW (new
  `DELETE /api/songs/trash`, bypasses the 7-day sweep — `trashSweep.ts`'s
  `emptyTrashNow()`).
- **Forge (experimental)**: a toggle revealing FORGE's header icon per
  `FORGE_PLAN.md`'s existing "feature-gated, hidden by default" decision —
  the screen behind it is a stub (`ForgeStub.tsx`) until release 1.0.

## Output File Metadata (added 2026-07-06, revised same day)

Every generated audio file gets real embedded tags via
`server/src/services/fileTags.ts`, using `node-taglib-sharp` — the only
lightweight option that supports choosing the ID3v2 tag *version* (2.3 vs
2.4); `node-id3`/`browser-id3-writer` both hardcode v2.3 and were rejected
for that reason (verified empirically against their installed source, not
their docs). No loudness normalization — tags only, by explicit decision.

**Split between global defaults and per-song fields** (revised 2026-07-06):
Artist/Encoder + the ID3 version choice are global (Settings > Output File
Metadata). Title/BPM/key come from the song's own generation metadata.
Genre/Album/cover-art/Comment are **per-song** — they don't make sense as a
single global default — and live in `SongDetailRail.tsx` (Library's song
detail rail), grouped directly under the CREATE COVER FROM AUDIO button.

**A real constraint worth knowing**: `node-taglib-sharp` can only embed an
ID3v2 tag in a WAV/RIFF container using the v2.4 footer feature — asking for
v2.3 on a `.wav` throws (undocumented, found by testing against a real
generated file). Since most persisted files default to `.wav`
(`audio_format: 'wav'` almost everywhere except the base song and
user-selected Remaster formats), `tagOutputFile()` catches this specific
error and **falls back to v2.4 for that one file** rather than leaving it
untagged, logging a one-line note when it does. MP3 correctly honors
whichever version is configured.

- `server/src/db/schema.ts` — single-row `output_metadata` table (now just
  artist/encoder/id3_version); `songs.comment`/`genre`/`album`/
  `cover_art_file` added via `db/index.ts`'s `ensureColumn` migration helper.
- `server/src/services/outputMetadata.ts` — CRUD for the global settings row.
- `server/src/services/fileTags.ts` — `tagOutputFile()` (single file, genre/
  album/cover art passed in per-call from the song row) + `retagSong()`
  (re-stamps every layer's active version when a song-level field changes).
- Wired into every job that writes a persisted audio file: `jobs.ts`
  (`persistSong`), `repaintJobs.ts` (`persistVersion`), `addLayerJobs.ts`
  (`persistNewLayer`), and `remasterJobs.ts` (its scratch-file export) — each
  now also selects `genre`/`album`/`cover_art_file` off the song row.
- `server/src/routes/outputMetadata.ts` — `GET/PATCH /api/output-metadata`
  (artist/encoder/id3Version only). `songs.ts` gained `PATCH /:id/metadata`
  (genre/album/comment, partial) and `POST/DELETE /:id/cover-art` (per-song,
  stored as `${songId}-cover.<ext>` in `config.audioDir`).
- Client: `OutputMetadataSection.tsx` (Settings) trimmed to Artist/Encoder/
  ID3 version. `SongDetailRail.tsx` gained COMMENT (under METADATA) and a new
  "OUTPUT FILE TAGS" block (GENRE/ALBUM/COVER ART) placed directly under the
  REUSE PROMPT / CREATE COVER FROM AUDIO actions, per request.

## Create AUDIO/ARRANGE Flows — `cover` and `complete` (implemented 2026-07-07)

Two new Create tabs alongside the original text2music flow, both persisting a
brand-new library song (unlike Remaster's ephemeral scratch-only `cover`
pass) via the same `persistSong()` path and `generate` genLock kind as a
plain generation, so the rest of the app (library `GeneratingCard`,
cross-tab hydration) treats them identically to any other in-flight
generation.

- **AUDIO tab** (`client/src/CreateAudioTab.tsx`) — "create cover from
  audio": a `cover` generation conditioned on an uploaded file or a
  client-bounced mix of an existing library song. Same VARIANCE slider
  convention as Repaint (`audio_cover_strength = 1 - variance`). Gated to
  `cover`-capable models via `useModelsForTask('cover')`, defaulting to an
  `xl-sft` model when present.
- **ARRANGE tab** (`client/src/CreateArrangeTab.tsx`) — ACE-Step's `complete`
  task: build a whole accompaniment around a single bare track (e.g. a
  cappella vocals), as opposed to `cover` (regenerate a full mix, structure
  preserved) or `lego`/Add Layer (add one part onto an existing multi-layer
  mix). Base-model only; unlike `cover`/`repaint`/`extract`, the 5Hz LM is
  **not** skipped for `complete` (`docs/ace-step-1.5/API.md#4.2`), so
  thinking/AI-enhance are meaningful controls here, same as Add Layer.
  Resolves the "Complete (future)" row in the ACE-Step Integration table
  above — it's implemented, not future anymore.

### Architecture

- `server/src/services/coverGenJobs.ts` — `startCoverGeneration()`, mirrors
  `remasterJobs.ts`'s job shape but calls `persistSong()` instead of writing
  to a scratch path.
- `server/src/services/completeGenJobs.ts` — `startCompleteGeneration()`,
  same shape, `task_type: 'complete'`.
- `server/src/routes/generate.ts` — new multipart endpoints wiring both
  services in; `pickMultipartParams()` shared with the existing generate
  route.
- Client: `client/src/api.ts` gained the corresponding calls; both tabs live
  under `CreateView.tsx` alongside the original generate tab (see
  `CreateBar.tsx` for the tab switcher).

## Lyric Tag Vocabulary Probe (implemented 2026-07-08)

ACE-Step's LM emits free-form `[...]` annotation tags in generated lyrics
(structure tags like `[Verse 2]`, performance tags like `[soft voice]`) with
**no fixed schema anywhere** — the LM can emit any bracket text. Rather than
hardcoding a guessed tag list, `server/src/services/lyricTagProbe.ts`
discovers the real vocabulary empirically: it repeatedly samples ACE-Step
(seed queries from `lyricTagSeedQueries.ts`, varied temperature, one in
every 4 samples pulled from ACE-Step's own bundled examples instead of a
fresh LM call) and mines the returned lyrics for bracket tags via regex,
classifying each as `section` (its line is otherwise empty, e.g. `[Chorus]`
alone) or `inline` (e.g. `[soft voice]` mid-line).

- **Additive, crash-safe persistence**: results merge into
  `data/lyricTags.json` after every single sample (`recordSample()`) —
  counts only grow, tags are only added, nothing is ever overwritten or
  wiped by a later run. An indefinite probe run can be stopped or crash
  without losing prior progress.
- **Runs indefinitely until stopped**: `runProbe()` loops until
  `stopProbe()` is called or `MAX_CONSECUTIVE_FAILURES` (10) consecutive
  ACE-Step failures trip an auto-stop, so a probe left running doesn't
  hammer a downed ACE-Step server forever unattended.
- **Routes** (`server/src/routes/lyricTags.ts`): `GET /` (stored tags sorted
  by count), `GET /status` (probe running/completed/lastError), `POST
  /probe` (fire-and-forget start, 409 if already running — client polls
  `/status`), `POST /probe/stop`.
- **Client**: `client/src/LyricTagsSection.tsx`, mounted in
  `SettingsView.tsx`, polls `/status` every 3s while a probe is running and
  shows the discovered tag list sorted by frequency.
- This is a **separate concern** from the still-unscoped lyric-*timestamp*
  alignment to-do under "Open Questions" above — tag vocabulary discovery
  (what annotations exist) vs. word/line timing (when they occur in audio).
  Neither depends on the other.

## Add Layer Lyrics (implemented 2026-07-08)

Add Layer (`lego`) now accepts optional **lyrics** so a generated layer can
sing specific words, either the song's existing lyrics or newly typed ones.
The 5Hz LM is **not** skipped for `lego` (`docs/ace-step-1.5/API.md#4.2`), so
`lyrics` genuinely conditions the layer (same as text2music/complete), unlike
repaint/cover where it would be ignored.

### Decisions
- Lyrics are **per-invocation** UI state in `AddLayerTrigger`, not persisted
  `AddLayerSettings` — they belong to one generation, like `prompt`, not to a
  saved default.
- Optional: an empty lyrics box sends no `lyrics` field (instrumental layer,
  prior behaviour unchanged).
- Prefill: a "USE SONG LYRICS" affordance copies the current `song.lyrics`
  into the box when the song has any; the user can then edit or replace them.
  `song.lyrics` is threaded Editor → LayerStack → AddLayerTrigger.

### File-level plan
- `client/src/AddLayerTrigger.tsx` — `songLyrics?` prop, `lyrics` state,
  `AutoTextarea` field + prefill button, `lyrics` added to the params passed
  to `startAddLayer`; cleared on done alongside `prompt`.
- `client/src/LayerStack.tsx`, `client/src/Editor.tsx` — pass `songLyrics`.
- `server/src/routes/songLayers.ts` — parse `lyrics` from the multipart body
  and forward it in the `ReleaseTaskParams`.
- `server/src/services/addLayerJobs.ts` — no change: `lyrics` rides through
  the spread `...params` into `fullParams` (`ReleaseTaskParams.lyrics`).
- `client/src/api.ts` — no change: `addLayer` already forwards arbitrary
  params as form fields.

### Model restriction (confirmed, no code change)
`lego`/`extract`/`complete` model choice is already restricted to Base models
via `useModelsForTask(task)` → the backend's `supported_task_types`
(`AddLayerTrigger`'s `legoModels`, `split`'s extract check,
`CreateArrangeTab`'s `complete`). `text2music`/`repaint` intentionally list
all models. A client-side name-match guard was considered and rejected as
redundant/fragile — `supported_task_types` is authoritative.

## Universal Advanced Settings (Repaint + Add Layer) (implemented 2026-07-08)

Repaint and Add Layer now share ONE advanced-settings surface in the Editor
left-rail `SettingsPanel` (decision: shared live values, not per-action
copies). The Add Layer footer row reverts to compact (prompt + GENERATE);
its **lyrics** editor and all advanced knobs move into the rail panel, which
is a `ScrollArea` — this also fixes the bug where a grown lyrics box pushed
GENERATE below the non-scrolling `.app-body` and out of reach.

### Decisions
- **Shared values**: steps, guidance, seed, and the advanced DiT/LM knobs
  live on `RepaintSettings` and drive both actions. Add Layer keeps only its
  own `lyrics` (per-invocation) and `model` (must be Base) as action-specific.
- **LM controls show only when Add Layer is the active context**
  (`addingLayerExpanded`). Repaint skips the 5Hz LM
  (`docs/ace-step-1.5/API.md#4.2`), so its LM knobs are no-ops and stay
  hidden; `AdvancedGenSettings`' existing `hideLmControls` flag drives this.
- **Model gating** (`baseOnly`/`guidanceEffective`) uses the *active* action's
  model: Add Layer's Base model when it's active, else `repaint.model`. Passed
  to `AdvancedGenSettings` as an explicit `gatingModel` prop.

### File-level plan
- `client/src/settings.ts` — `AdvancedSettings` subset interface;
  `RepaintSettings` gains the 12 advanced fields + defaults;
  `ditAdvancedParams`/`lmAdvancedParams` helpers; `repaintParams` emits DiT
  advanced; `addLayerParams` emits DiT + LM and takes steps/guidance/seed from
  the shared repaint slice (model still from `addLayer`).
- `client/src/AdvancedGenSettings.tsx` — props generalised to
  `adv`/`setAdv`/`gatingModel` so both `gen` and `repaint` drive it.
- `client/src/SettingsPanel.tsx` — repaint branch renders the shared advanced
  panel; when `addLayerActive`, shows the Add Layer lyrics editor (draft store
  + "USE SONG LYRICS" prefill) and LM controls, hides repaint-only VARIANCE /
  DIT MODEL, relabels to ADD LAYER SETTINGS.
- `client/src/addLayerStore.ts` (new) — tiny `useAddLayerDraft` store holding
  the lyrics draft, so the footer's submit and the rail's editor share it.
- `client/src/AddLayerTrigger.tsx` — footer reverts to compact; reads lyrics
  from the draft store, resets it on done.
- `client/src/Editor.tsx` — passes `addLayerActive` + `songLyrics` to the
  repaint `SettingsPanel`; drops the footer lyrics prop threading.
- `server/src/routes/layers.ts` (repaint) + `server/src/routes/songLayers.ts`
  (add layer) — forward the advanced DiT (both) and LM (add layer) params.

## Reference Audio in Song Meta (planned + implemented 2026-07-09)

The Create sidebar's `ReferenceAudioPicker` already lets a generation be
conditioned on a saved voice profile or an ad-hoc uploaded clip, but which
reference (if any) was used is dropped once the song persists — the Library
detail rail can't show it. This records it on the song.

Decisions:
- Store three nullable flat columns on `songs` (consistent with the existing
  flat bpm/key_scale style, no JSON blob): `reference_audio_label` (voice name
  or uploaded clip filename), `reference_audio_influence`, `reference_style_influence`.
- Influences are only meaningful for text2music (PROMPT tab), which remaps them
  into `audio_cover_strength`/`guidance_scale`. Cover/complete treat a reference
  as raw bytes (VARIANCE drives cover; complete has no mapping — see
  referenceAudioResolve.ts), so those paths store the label only, influences null.
- No move of the picker itself — it stays in the Create settings sidebar.

File-level plan:
- `server/src/db/schema.ts` + `db/index.ts` — three additive columns.
- `server/src/services/voiceConditioning.ts` — `loadVoiceReference` returns the
  voice `name`; add `getVoiceName(id)` for the label-only cover/complete paths.
- `server/src/services/jobs.ts` — `ReferenceAudioMeta` type; `persistSong` gains
  an optional `referenceMeta` and writes the three columns; `startGeneration`
  builds it from the voice options.
- `server/src/services/coverGenJobs.ts` / `completeGenJobs.ts` — accept + forward
  a label-only `referenceMeta`.
- `server/src/routes/generate.ts` — compute the label for cover/complete.
- `client/src/api.ts` — three new `Song` fields.
- `client/src/SongDetailRail.tsx` — a REFERENCE AUDIO metadata row when present.

## TAKES (batch_size) Slider — PROMPT tab (planned + implemented 2026-07-10)

ACE-Step's `/release_task` accepts an optional `batch_size` (server defaults
to 2 when omitted); Mulakai never sent it. Adds a user-facing slider for it,
PROMPT tab only (AUDIO/ARRANGE are separate components, out of scope).

Decisions:
- Lives in `CreateView.tsx`'s existing `song-details-grid` (3-column, 5
  items today — a 6th fills the one empty cell, no CSS change needed).
- Label "TAKES", range 0-4 step 1. 0 = AUTO, readout `"AUTO (2)"` since the
  server default is known — surfaced rather than hidden behind a bare AUTO.
- `Slider`'s `info` tooltip discloses that job polling only keeps ONE of the
  N results today (no multi-candidate picker yet), so raising TAKES above
  AUTO costs render time without a way to see/pick the extras.
- Extracted the BPM/DURATION/KEY-SCALE trio out of `CreateView.tsx` into a
  new `SongDetailsFields.tsx` so a separate, already-scoped workstream can
  reuse them elsewhere without re-touching `CreateView.tsx`. TIME SIGNATURE/
  VOCAL LANGUAGE stay inline — they're PROMPT-tab-specific.

File-level plan:
- `client/src/settings.ts` — `GenSettings.batchSize` (0 = AUTO); `genParams()`
  emits `batch_size` only when > 0, following the existing AUTO-omission
  pattern (inferenceSteps/guidanceScale).
- `client/src/SongDetailsFields.tsx` (new) — BPM/DURATION/KEY-SCALE trio,
  props-driven, no owned state.
- `client/src/CreateView.tsx` — swaps the inline trio for
  `<SongDetailsFields>`; adds the TAKES `Slider` to the same grid.
- `server/src/routes/generate.ts` — `batch_size` added to `GEN_FIELDS` and
  `NUMERIC_FIELDS`. `ReleaseTaskParams.batch_size` already existed in
  `acestep.ts`, no change needed there.

## Repaint Boundary Crossfade (planned + implemented 2026-07-10)

ACE-Step's `/release_task` accepts `repaint_wav_crossfade_sec` on `repaint`
tasks — a waveform-level splice crossfade at the repaint region boundary
(0 = hard cut, the only behavior Mulakai has ever sent). This exposes it.
`repaint_latent_crossfade_frames` (ACE-Step's own default is fine) stays
out of scope.

Decisions:
- A small numeric stepper next to `RepaintBar.tsx`'s `scope-chip`, not a new
  drag handle on `Waveform.tsx` — that canvas already shares a tight
  pixel-tolerance hit-test zone across 4 drag modes at each region edge, and
  a 5th interactive handle there would compete for the same few pixels.
- Client-side clamp to `[0, min(5, regionSeconds) / 2]`; disabled with no
  valid selection. `RepaintBar` reads/writes `useSettings().repaint`
  directly (the `AddLayerTrigger.tsx` precedent for a leaf component owning
  one settings field) rather than threading another prop down from Editor.
- Default `0` matches ACE-Step's own default, so `repaintParams()` emits it
  unconditionally instead of the conditional-omit AUTO pattern used
  elsewhere in `settings.ts`.

File-level plan:
- `server/src/services/acestep.ts` — `repaint_wav_crossfade_sec?: number` on `ReleaseTaskParams`.
- `server/src/routes/layers.ts` — forward it in the repaint route's optional-field block.
- `client/src/settings.ts` — `RepaintSettings.crossfadeSec` (default `0`), emitted by `repaintParams()`.
- `client/src/RepaintBar.tsx` — CROSSFADE stepper beside the scope chip.
- `client/src/index.css` — `.crossfade-setting`/`.crossfade-input` (carbon/hairline, matches `.seed`).

## `/v1/analyze_audio` Wiring (planned + implemented 2026-07-10)

ACE-Step's `/v1/analyze_audio` ("describe this audio for me") was never called
from anywhere in Mulakai. Wires it into the AUDIO (cover) and ARRANGE
(complete) Create tabs: when a source is picked and the prompt is still
empty, it auto-fills caption→prompt, lyrics, bpm, key/scale, and duration.

Decisions:
- Multipart field name is `audio` (verified against `analyze_audio_route.py`
  — the route checks `form.get("audio") or form.get("src_audio")`). The
  route's `src_audio_path` shortcut (a filesystem path shared with the
  ACE-Step process) isn't usable across `ACESTEP_API_URL`, so Mulakai always
  uploads bytes.
- Real bug fixed along the way: some `/v1/analyze_audio` failure modes (DiT
  not initialized, LLM not initialized/failed) are raised as genuine FastAPI
  `HTTPException`s — a real non-2xx HTTP status with a bare `{"detail": ...}`
  body, not ACE-Step's usual `{data,code,error}` envelope. `acestep.ts`'s
  `call()` previously discarded that body on `!res.ok`, throwing a bare
  `HTTP {status}`. Now parses the body (best-effort) and uses
  `error ?? detail ?? "HTTP {status}"`. Verified live against a running
  ACE-Step instance with no model loaded — the fixed `call()` correctly
  surfaced `"DiT model not initialized"` instead of `"HTTP 503"`.
- New `useAnalyzeSourceAudio.ts` hook: fires once per distinct source
  selection (tracked by a ref key, not by effect dependency identity, since
  callers construct a fresh source-descriptor object each render) and only
  while `prompt.trim() === ''` at fire time — never overwrites a hand-typed
  prompt. A second export, `useAnalyzeAndApply`, wraps it with the "fill only
  still-empty/AUTO fields" application step both tabs need, so neither tab
  duplicates that logic.
- New `SongAnalysisFields.tsx` bundles the LYRICS textarea + `SongDetailsFields`
  SONG DETAILS grid + analyzing/error state — identical block needed by both
  tabs, so it's shared rather than duplicated (keeps both tab files under the
  150-200 LOC module cap after the analyze-audio state/wiring additions).
- Field scope: only caption/lyrics/bpm/key/duration get UI here — the
  endpoint also returns `time_signature`/`vocal_language`, deliberately left
  out to keep the footprint small (matches the audit's original scoping).

File-level plan:
- `server/src/services/acestep.ts` — `call()` error-body-parsing fix; new
  `analyzeAudio()` (multipart, reuses `FormatInputResult`).
- `server/src/routes/generate.ts` — `POST /analyze-audio`, same dual-source
  (`src_audio` upload or `scratch_job_id`/`scratch_stem_kind`) resolution
  `/complete` already does.
- `client/src/api.ts` — `analyzeSourceAudio()`, same dual-source param shape
  as `generateComplete()`; reuses `RefineResult` (identical shape to the
  route's response, no new type).
- `client/src/useAnalyzeSourceAudio.ts` (new) — trigger hook + apply-result
  hook, described above.
- `client/src/SongAnalysisFields.tsx` (new) — shared LYRICS + SONG DETAILS
  block, described above.
- `client/src/CreateAudioTab.tsx` / `CreateArrangeTab.tsx` — lyrics/bpm/
  keyScale/duration state, `SongAnalysisFields`, `useAnalyzeAndApply` wired
  to each tab's own source variants (upload+library / upload+scratch-stem),
  forwarded into `startFromAudio`/`startComplete`'s params.

## Add Layer: Forced batch_size 1 + Track-Type Picker (implemented 2026-07-10)

Add Layer always defaulted to ACE-Step's own `batch_size` of 2 (server-side,
whenever the field is omitted), but the client only ever kept one of the two
generated takes — every call was silently paying for a discarded generation.
Also wires up `lego`'s `track_name` field (fixed 12-item vocabulary), never
used before this.

Decisions:
- `addLayerJobs.ts`'s `fullParams` now sets `batch_size: 1` last, so nothing
  in `...params` can override it. No UI, no client change — Add Layer never
  emitted `batch_size` before, so there's nothing to guard against.
- New TRACK TYPE picker in `AddLayerTrigger.tsx`'s expanded form (ACE-Step's
  fixed vocabulary: woodwinds/brass/fx/synth/strings/percussion/keyboard/
  guitar/bass/drums/backing_vocals/vocals, + AUTO), sent as `track_name`
  alongside the existing free-text `prompt` — independent channels
  server-side (`track_name` only templates ACE-Step's own `instruction`
  string, verified in `job_generation_setup.py`'s `_resolve_instruction()`).
  Corrects the "ACE-Step Integration" table's `lego` row above and the
  "Add Layer (lego)" design's 2026-07-02 "no track name param" note — both
  accurate against the docs vendored at the time, stale against the current
  fork source.
- Local component state (`trackName`), not `addLayerStore.ts`'s shared
  draft — that store exists specifically because `lyrics` needs to be
  visible from both the compact footer and the rail's advanced panel; track
  type has no such dual-surface need.

File-level plan:
- `server/src/services/addLayerJobs.ts` — `batch_size: 1` in `fullParams`.
- `client/src/trackNames.ts` (new) — the 12-item vocabulary + AUTO, shaped
  for `CustomSelect`.
- `client/src/AddLayerTrigger.tsx` — `trackName` state, `CustomSelect`,
  `track_name` added to submit params, reset alongside `prompt` on done.
- `server/src/routes/songLayers.ts` — forwards `track_name` when present.
- `server/src/services/acestep.ts` — `ReleaseTaskParams.track_name?: string`.
- A layout bug found during manual verification: `.layer-add-row`'s
  hover-expand `overflow: hidden` (for the height-reveal animation) was
  clipping the new `CustomSelect`'s non-portal option list — fixed by
  switching that state to `overflow: visible`.

## Real Per-Job Progress (implemented 2026-07-10)

`/v1/stats` only returns server-wide aggregate stats (job counts, queue
size, avg job seconds) — no per-job progress, so it's the wrong endpoint for
a progress bar. But `/query_result`, which Mulakai's server already polls
every ~2s via the shared `poll()`, already returns real per-job data for a
running job: `progress` (0.0–1.0, fed from an actual diffusion-loop
callback, throttled to updates every ~0.5s or 1% change) and `stage`
(free-text, defaults `"running"`) inside its result array, plus a top-level
`progress_text` (last log line). Mulakai discarded all of it.

Decisions:
- New fields threaded end-to-end as `progress?: number`, `progressStage?:
  string`, `progressText?: string` — deliberately not named `stage`
  anywhere in Mulakai's own types, since `Job`/`EditorJob`/`GenerationJob`
  already use `stage: 'running'|'done'|'failed'` for Mulakai's own job
  lifecycle; reusing the name would collide two unrelated meanings.
  `acestep.ts`'s `TaskResult` (the raw wire-shape type) is the one place
  `stage?: string` is used as a direct ACE-Step pass-through.
- `AIGeneratingBackground` (a bare `ShaderCanvas` in an absolutely-
  positioned div) gains an optional `progress` prop: an absolutely-
  positioned carbon-tinted veil (~70% opacity) covers the unprogressed
  portion, reusing the existing "AI is working" visual language instead of
  a new shape/hue. `undefined` progress falls back to today's look
  unchanged, so every existing call site stays backward-compatible.
- Text-only sites gain a `NN%` readout plus ACE-Step's own `stage` text when
  it's more informative than a generic/empty value — new `fmtProgress`/
  `stageDetail` helpers in `genProgress.ts`.
- `stemSplit.ts`'s split-job polling is a separate code path from the
  shared `poll()` and is intentionally not touched — a clean follow-up.

File-level plan:
- `server/src/services/acestep.ts` — `TaskResult.progress?`/`.stage?`;
  `queryResult()`'s row type gains `progress_text?`.
- `server/src/services/jobs.ts` — `Job` gains the three fields; `poll()`'s
  `status === 0` branch reads them onto the job each tick instead of a bare
  `continue`.
- `server/src/routes/generate.ts` — `GET /:jobId` returns the three fields.
- `client/src/api.ts` — `jobStatus()`'s return type gains them.
- `client/src/generationStore.ts` / `editorJobStore.ts` — job types gain
  the fields; both polling loops' running branch now `set()`s them each
  tick (`editorJobStore.ts`'s previously just `continue`d while running).
- `client/src/genProgress.ts` — `fmtProgress`, `stageDetail`.
- `client/src/AIGeneratingBackground.tsx` — optional `progress` prop + veil.
- `client/src/GeneratingCard.tsx`, `LibraryJobBadge.tsx`, `VersionHistory.tsx`,
  `RemasterAction.tsx`, `RepaintBar.tsx`, `AddLayerTrigger.tsx` — pass
  `progress` where `AIGeneratingBackground` is already used; append `%`/
  stage to status text.

## Manual "Analyze Audio" Trigger (planned + implemented 2026-07-11)

`/v1/analyze_audio` Wiring (above) auto-fired on source selection while the
prompt was empty. In practice this cold-starts badly: unlike generation,
`/v1/analyze_audio` does not reliably lazy-load its own models — observed
503 "not initialized" on a fresh ACE-Step process with no loading logs at
all, immediate failure. Auto-fire-once-per-source plus a permanently-marked
"already fired" ref meant a cold-start failure had no recovery path short of
picking a different file or reloading the app (a `retry()` escape hatch was
added same-day as a stopgap, superseded here).

Decisions:
- Replace auto-fire with an explicit "ANALYZE AUDIO" button — no more
  prompt-empty gating or fired-source dedup logic; the user decides when to
  spend the analysis call.
- Before calling `/v1/analyze_audio`, explicitly load the currently-selected
  model via the existing `initModel()` (`/v1/init`, `initLlm: true`) — same
  primitive `ensureModelLoaded()` uses before generation jobs. Analysis needs
  both DiT (audio→codes) and the LM (codes→caption/metadata), so `initLlm`
  is unconditional here, unlike `ensureModelLoaded`'s conditional. Since both
  Create tabs already auto-select a default model into `model` state on
  mount, this is populated by the time the button is clickable — the button
  reads as one click that "just handles it" regardless of cold/warm model
  state, matching the user's ask.
- New shared `AnalyzeAudioButton.tsx`: renders `AIGeneratingBackground` (the
  same shader veil the main GENERATE button already uses) while analyzing,
  so a slow cold model load reads as "working" rather than a hung click.
  Kept as its own component (not inlined) to hold both `CreateAudioTab.tsx`/
  `CreateArrangeTab.tsx` under the 150-200 LOC module cap.
- `useAnalyzeSourceAudio` rewritten from an auto-firing effect keyed on
  source identity to a plain imperative `analyze(source, model)` callback
  with a request-token ref (guards against a stale in-flight response
  clobbering state if the source changes mid-request). `sourceKey`/
  `shouldAnalyze` and the `retry()` stopgap are gone — nothing left to dedupe
  once firing is a deliberate click. New `canAnalyze(source, model, busy)`
  pure helper (source present, model present, not mid-analysis/mid-generate)
  drives the button's `disabled` state; unit-tested in place of the removed
  `shouldAnalyze` tests.
- `useAnalyzeAndApply`'s "only fill still-empty fields" apply step is
  unchanged — still correct for a manual trigger (won't clobber a hand-typed
  prompt if the user analyzes after typing something).

File-level plan:
- `server/src/services/acestep.ts` — `analyzeAudio()` gains an optional
  `model` param; calls `initModel({ model, initLlm: true })` before hitting
  `/v1/analyze_audio` when a model is given.
- `server/src/routes/generate.ts` — `POST /analyze-audio` reads `model` from
  the multipart body, forwards to `analyzeAudio()`.
- `client/src/api.ts` — `analyzeSourceAudio()` gains a `model: string` param,
  appended to the form.
- `client/src/useAnalyzeSourceAudio.ts` — rewritten as described above.
- `client/src/useAnalyzeSourceAudio.test.ts` — `sourceKey`/`shouldAnalyze`
  tests replaced with `canAnalyze` tests.
- `client/src/AnalyzeAudioButton.tsx` (new) — shared button + progress veil.
- `client/src/CreateAudioTab.tsx` / `CreateArrangeTab.tsx` — drop the
  auto-fire effect wiring, render `AnalyzeAudioButton` above
  `SongAnalysisFields`, pass `model` into `analyze()`.

## Unified Audio Preview (planned 2026-07-29, implemented 2026-07-30)

Approved mockup: claude.ai/code/artifact/6dc62f30-d2e7-44b0-ae83-b90bdb85be05
(all four views rendered with the pattern applied; live popover demos).
All five rollout PRs below are built; the Library step was rescoped mid-
flight (see the Library exception).

One rule: **if the UI shows an audio file, you can hear it in place** —
play/pause, waveform, click-to-seek scrubber. An audit (2026-07-29) found 6
surfaces with playback UI (footer player, layer lanes, editor transport, the
two stem lists — the latter two as near-verbatim hand-rolled duplicates in
`SplitPanel.tsx` / `ScratchSplitPicker.tsx`) and ~10 surfaces with playable
audio and no preview at all: voice picker, reference-audio upload, COVER
tab's library song picker, filled dropzones, version history (today you must
SEL — a state change — to hear a take), export stems, and the remaster
result (auto-downloads without ever being auditioned).

Decisions:
- One shared `AudioPreview.tsx` component, extracted from the
  `.stem-play` + `PlayerWaveform` + shared-`<audio>` trio that `SplitPanel`
  and `ScratchSplitPicker` already duplicate — extract, don't invent. Two
  densities plus the existing full form:
  - **Inline** (any host row with ≥240px free width): 22px acid play/pause
    hexagon + `PlayerWaveform` (h22–30, per-surface) + mono `m:ss / m:ss`
    readout; waveform click = seek.
  - **Micro** (narrower rows): 18px acid hexagon only; click opens a fixed
    240px anchored popover (name · waveform h30 · time · ✕) and starts
    playback immediately. Closes on ✕ or outside click, which also stops it.
    One popover open at a time.
  - **Full** = the existing footer `Player` (volume, download) — unchanged;
    it is the parent form the smaller sizes derive from, not a special case.
- Color contract (unchanged semantics, now enforced everywhere): play is
  always an acid hexagon (commit: "start sound"); played portion + playhead
  are always sky; idle bars `wave-idle`. Lilac keeps marking versions; the
  play control inside a version row stays acid.
- **One preview at a time, app-wide**: a small preview singleton
  (`previewPlayback.ts`, one shared `Audio` element behind the existing
  `PlaybackApi` shape, keyed by "what's playing") — never one `Audio` per
  row. Starting any preview pauses the previous one and the main transport
  (footer / editor engine); starting the main transport stops the preview
  and closes any popover. Previews are auditions, not a second mixer.
- **Exception — Library keeps the footer player as its only song-playback
  surface** (revised 2026-07-30; the original plan gave every card an inline
  module bound to the footer engine, built and then rolled back same-day):
  cards keep the plain play glyph driving the footer — a second per-card
  waveform of the same song the footer already scrubs is duplication, not
  unification. The song detail rail likewise does **not** duplicate song
  playback; instead it previews the song's **reference audio** (the voice
  clip that conditioned the generation) through the shared preview slot,
  when the stored label still resolves to a saved voice — ad-hoc uploaded
  clips aren't persisted, so those stay label-only.
- **Peaks cache**: `waveformPeaks.ts` gains a URL-keyed cache and one shared
  `AudioContext` (today: fresh context + full re-fetch/re-decode per call —
  unacceptable once every library card renders a waveform). Object URLs
  (blob previews) are cacheable too; cache entries evicted when their
  object URL is revoked.
- **Pre-upload files preview via `URL.createObjectURL`** (revoked on
  replace/unmount): sidebar reference upload, filled COVER/ARRANGE
  dropzones, voice upload. `Dropzone.tsx` itself stays generic (it never
  touches file content); the filled-state preview renders in the callers.
- **Version history**: each row's micro preview plays that version's own
  `audio_file`, seeked to its region start — A/B two takes from the
  popovers with zero state change. SEL/REVERT semantics untouched.
- **Remaster stops auto-downloading**: the server streams the finished
  render exactly once then deletes it (routes/remaster.ts), so the client
  fetches it into a blob the moment the job settles and holds it as an
  object URL — shown as an inline preview with explicit DOWNLOAD (acid
  anchor to the same URL) and RUN AGAIN actions. Consequence line: "not
  saved to history — download it or run again to discard". The held URL
  (and its cached peaks) is revoked when the next run starts.
- `docs/design/DESIGN.md` addendum ships in the same PR as the component
  (per AGENTS.md): module anatomy, the three sizes, the ≥240px
  inline-vs-popover threshold, and the one-preview-at-a-time rule join the
  shape grammar section.
- Rollout is **one PR per problem**, in dependency order — each is
  independently shippable and visually inert until its surfaces adopt it:
  1. `feat/audio-preview-core` — `AudioPreview.tsx` + `previewPlayback.ts`
     + peaks cache; refactor `SplitPanel` / `ScratchSplitPicker` onto it
     (no visual change, deletes the duplication). DESIGN.md addendum here.
  2. `feat/audio-preview-library` — song detail rail: reference-audio
     preview (revised 2026-07-30 — cards and footer unchanged, see the
     Library exception above).
  3. `feat/audio-preview-create` — voice picker micro, reference-upload
     micro, COVER song-picker rows, filled-dropzone previews.
  4. `feat/audio-preview-editor-rail` — version history micro, export stem
     inline, remaster audition.
  5. `feat/audio-preview-settings` — voices list inline.

File-level plan:
- `client/src/AudioPreview.tsx` (new) — inline variant in PR 1; the micro
  variant + popover land with their first consumer (PR 3, per the
  no-unused-WIP-UI rule), split into `AudioPreviewPopover.tsx` if the
  module cap demands it.
- `client/src/previewPlayback.ts` (new) — shared preview engine singleton +
  "pause main transport" wiring; unit-tested (exclusivity, stop-on-close,
  main-transport handoff).
- `client/src/waveformPeaks.ts` — URL-keyed cache + shared `AudioContext`;
  unit test for cache hit/eviction.
- `client/src/SplitPanel.tsx`, `client/src/ScratchSplitPicker.tsx` — drop
  hand-rolled playback state; consume `AudioPreview`.
- `client/src/SongDetailRail.tsx` — reference-audio preview under the
  REFERENCE AUDIO metadata row (revised 2026-07-30).
- `client/src/VoicePicker.tsx`, `client/src/ReferenceAudioPicker.tsx` —
  micro variant beside the select / under the filled dropzone.
- `client/src/CreateAudioTab.tsx` — micro per song-picker row; inline in
  the filled dropzone.
- `client/src/CreateArrangeTab.tsx` — inline in the filled upload dropzone.
- `client/src/VersionHistory.tsx` — micro per version row.
- `client/src/ExportPanel.tsx` — inline per stem row (keeps DOWNLOAD).
- `client/src/RemasterAction.tsx` + `client/src/editorJobStore.ts` — hold
  result as object URL instead of firing the download; audition + explicit
  DOWNLOAD / RUN AGAIN.
- `client/src/VoiceUploadForm.tsx` — inline module per voice row.
- `docs/design/DESIGN.md` — AudioPreview addendum (PR 1).

Open questions:
- Version preview scope: seek-to-region-start of the full file (planned) vs
  a region-bounded clip that stops at the region end — decide in PR 4 after
  trying it; region-bounded needs a stop-at-time hook the engine doesn't
  have yet.
- Remaster renders can be multi-minute WAVs held in memory as a blob —
  acceptable for one held result at a time, but revisit if RUN AGAIN
  accumulates takes.

## Create Draft Persistence + Origin-Aware Reuse (planned 2026-07-30)

Three complaints, one root cause: Create models a draft as **three unrelated
forms** rather than one intent rendered three ways.

- `reusePromptDraft` (`createDraft.ts:31`) hardcodes `genType: 'prompt'`, so
  REUSE PROMPT on a cover- or arrange-origin song drops you into text2music
  carrying `song.caption` — which for a cover meant "describe *the change*
  from the source" and is close to meaningless standalone.
- `prompt`/`lyrics`/`bpm`/`keyScale`/`duration` exist as **three independent
  `useState` copies** (`CreateView.tsx:50`, `CreateAudioTab.tsx:38`,
  `CreateArrangeTab.tsx:39`), and the tabs are conditionally rendered — so
  switching tabs unmounts the old one and silently discards everything typed
  into it, including a picked upload.
- Retry loses the method the same way: `generationStore.ts`'s cross-refresh
  hydration rebuilds `draft: { prompt: active.caption }` with no `genType`,
  so retrying a failed cover after a page reload also lands in PROMPT.

Decisions:
- **The song records its origin task.** New `songs.gen_task` column, written
  by `persistSong()` from `params.task_type` (which every caller already
  sets — `coverGenJobs.ts:30`, `completeGenJobs.ts:36`, `jobs.ts:119`).
  Backfilled once for existing DBs from the base layer's first version via
  `json_extract(params_json, '$.task_type')` — the data is already there,
  and `repaintJobs.ts:78` reads `task_type` back out of `params_json` the
  same way today. A column rather than a correlated subquery in the list
  query because the library list is the hot path, and `songs` already
  denormalizes generation facts (`reference_audio_label` and friends) from
  exactly this call site. `routes/songs.ts`'s `SELECT s.*` (list at :25,
  detail at :66) picks it up with no query change.
- **REUSE PROMPT lands on the origin tab**: `text2music` → PROMPT,
  `cover` → COVER, `complete` → ARRANGE; NULL (pre-column songs whose
  backfill found nothing) → PROMPT, same as today.
  - The **source audio is not carried** — an upload is long gone and a
    library bounce was never stored — so cover/arrange origins open with the
    source slot empty and an inline consequence line saying so. It
    deliberately does *not* silently preselect the song as its own source;
    that is the sibling CREATE COVER FROM AUDIO action.
  - The detail rail gains an origin line under METADATA, and REUSE PROMPT's
    consequence text names the tab it will open, per DESIGN.md's
    state-the-consequence-before-commit rule.
- **One draft, three renderings.** Shared song intent moves into a single
  `createDraftStore.ts`: `genType`, `title`, `prompt`, `lyrics`, `bpm`,
  `keyScale`, `timeSignature`, `vocalLanguage`, `duration`, `formatted`,
  `folderId`/`folderName`, `pendingQuery`, plus `intentOrigin` (below).
  Method-specific state survives tab switches too, as per-method slices:
  `audio: { source, selectedSongId, uploadFile, model, variance }`,
  `arrange: { source, uploadFile, scratchSource, model }` — bouncing to
  PROMPT and back must not make you re-pick a 40MB upload. Kept small with
  one `patch(partial)` / `load(draft)` / `clear()` trio instead of a setter
  per field, per the module-size policy.
- **The store is the only source of truth.** `CreateView` loses its
  `initialDraft` prop entirely; `App.tsx` calls `load()` at each navigation
  site (`reusePrompt`, `createCover`, `CreateBar`'s `onCreate`,
  `retryGeneration`). An explicit new intent therefore always overwrites a
  resumed draft — no merge, no ambiguity about which prompt you're looking
  at. `pendingQuery` is cleared once the thinking reveal finishes so a
  remount can't re-run the expansion.
- **In-memory only — no `localStorage`.** The draft survives Create →
  Library → Create within a session (you clicked back to check a title);
  it does not survive a reload. `uploadFile` is a `File` and isn't
  serializable anyway, and a week-old draft resurrecting itself is worse
  than retyping.
- **No "move this field to that tab" affordance.** That control only needs
  to exist because the state is siloed; sharing the fields removes the
  need. If partial carry is ever wanted, reuse `RefineRail`'s existing
  per-field accept idiom rather than inventing a second one.
- **`intentOrigin` marks which tab last authored the shared intent**, and
  does double duty:
  - When `intentOrigin !== genType` and the prompt is non-empty, one `.hint`
    line under the prompt names the semantic shift ("carried over from
    PROMPT — in COVER this describes the change from the source"). Editing
    the prompt in the current tab sets `intentOrigin` to it and the hint
    goes away. Fields visibly keep their text, so nothing more than a hint
    is warranted — no modal, no badge.
  - `useAnalyzeAndApply` gates only `prompt`/`lyrics` on being empty
    (`useAnalyzeSourceAudio.ts:72`) — carried-over text would otherwise
    block ANALYZE AUDIO from filling them. Carried fields
    (`intentOrigin !== genType`) count as fillable. `bpm`/`keyScale`/
    `duration` already overwrite unconditionally and stay as they are.
- **CLEAR DRAFT, not "clear prompt"** — one control scoped to the whole
  draft, reusing FEELING LUCKY's two-step confirm (`CreateView.tsx:299`):
  label → `CLEAR ALL? CONFIRM` plus a hint line naming what goes. It clears
  the shared intent and every per-method slice, but **keeps the folder
  destination** — that's navigation context shown in the Save To chip, not
  something you typed — and re-triggers the folder-title prefill that
  `CreateView.tsx:83`'s effect otherwise skips once `title` is non-empty.
  Lives right-aligned on the GENERATION TYPE label row so all three tabs
  can reach it (COVER/ARRANGE have no lucky/generate row to host it);
  disabled when the draft is already empty or a generation is in flight.
  Outline button — **not** rust, which stays reserved for
  errors/warnings/trash.
- **Split the PROMPT tab out while the state is being moved.**
  `CreateView.tsx` is 355 LOC today, well over the 200 hard cap; lifting
  state out plus extracting `CreatePromptTab.tsx` (prompt/lyrics/refine/
  song-details/generate) leaves `CreateView` as the shell it claims to be —
  tabs, title, layout, rail. This is the natural moment, not a drive-by.

File-level plan:
- `server/src/db/schema.ts` — `songs.gen_task TEXT` (comment: which
  ACE-Step task created this song; NULL for pre-column rows).
- `server/src/db/index.ts` — `ensureColumn('songs', 'gen_task', ...)` plus a
  one-time backfill `UPDATE` reading the base layer's earliest version's
  `params_json`.
- `server/src/services/jobs.ts` — `persistSong()`'s songs `INSERT` gains
  `gen_task` from `params.task_type`.
- `client/src/api.ts` — `Song` gains `gen_task: string | null`.
- `client/src/createDraft.ts` — `taskToGenType()` mapping;
  `reusePromptDraft` uses it instead of the hardcoded `'prompt'`.
- `client/src/createDraftStore.ts` (new) — Zustand store described above.
- `client/src/CreateView.tsx` — drops the `initialDraft` prop and its
  `useState` block, reads the store, hosts GENERATION TYPE + CLEAR DRAFT.
- `client/src/CreatePromptTab.tsx` (new) — extracted PROMPT tab.
- `client/src/CreateAudioTab.tsx` / `CreateArrangeTab.tsx` — drop the
  duplicated shared fields, read/write their store slice.
- `client/src/App.tsx` — `load()` at the four navigation sites; `CreateView`
  loses `initialDraft`.
- `client/src/generationStore.ts` — hydrated retry draft carries the job's
  `genType` instead of prompt-only.
- `client/src/SongDetailRail.tsx` — origin line under METADATA; REUSE
  PROMPT consequence text names the target tab.
- `client/src/useAnalyzeSourceAudio.ts` — treat carried prompt/lyrics as
  fillable.
- `client/src/voiceStore.ts` — `missingReferenceLabel` +
  `restoreReference()`; `selectVoice`/`setUploadedRefFile` clear the warning.
- `client/src/ReferenceAudioPicker.tsx` — follow the store into voice/upload
  mode; render the missing-reference warning.
- `client/src/index.css` — `.warn-note` (rust hairline, no toast animation).
- `docs/design/DESIGN.md` — the rail's REUSE PROMPT description (currently
  prompt-only, `DESIGN.md:215`) in PR 1; the draft-persistence rule in
  PR 2; CLEAR DRAFT's anatomy and confirm copy in PR 3.
- Tests: `createDraftStore.test.ts` (shared fields and per-method slices
  survive a `genType` switch; `load()` overwrites; `clear()` keeps the
  folder; `intentOrigin` transitions), `createDraft.test.ts`
  (`gen_task` → `genType`, no source carried), a `persistSong` test
  asserting `gen_task`, a backfill test over a pre-column row, and one
  Playwright step covering type-in-PROMPT → switch to COVER → text is
  still there.

### Reference-audio carry (added 2026-07-30, ships with PR 1)

Reuse restored the words but not the *voice*: a song generated with voice
"Daniel" at audio 80% / style 30% came back with the reference control on
NONE, so the one thing hardest to re-guess — the conditioning — was silently
dropped. The song already records all of it (`reference_audio_label`,
`reference_audio_influence`, `reference_style_influence`, added in the
Reference Audio in Song Meta section above).

- The draft carries `referenceLabel` + the two influences; `voiceStore.ts`
  gains `restoreReference(label, audio, style)` which matches the label
  against the saved voices **by name** — the label is all a song records —
  selects it, then applies the song's influences. Order matters:
  `selectVoice()` resets influences to that voice's defaults, so the song's
  own values have to land after it, not before.
- Influences are null for cover/complete origins (they never persisted
  them, see the schema comment), in which case the matched voice keeps its
  own defaults rather than being forced to 0.
- **A label that matches nothing is stated, not swallowed**: the store keeps
  `missingReferenceLabel` and `ReferenceAudioPicker` renders a rust
  `.warn-note` naming it. The two causes are indistinguishable from what's
  stored — a deleted voice and an ad-hoc uploaded clip (never saved) both
  leave a bare label — so the copy covers both instead of guessing from the
  filename. Cleared the moment the user picks any reference themselves.
- `ReferenceAudioPicker`'s local `mode` now follows the store into
  `voice`/`upload` when something is selected. This is also a latent bug fix
  independent of reuse: the store is global and the picker is not, so
  selecting a voice, leaving Create and coming back showed NONE over a
  selection that `voiceParams()` would still have sent.
- CREATE COVER FROM AUDIO deliberately does **not** restore a voice — it
  means "make a cover of this audio", not "rebuild this song's recipe".

Rollout — one problem per PR, in dependency order:
1. `feat/reuse-origin-method` — server column + backfill, origin-aware
   reuse mapping, rail origin line, retry-draft `genType`, and the
   reference-audio carry above. Ships the actual complaint on its own, no
   refactor attached.
2. `feat/create-draft-store` — lift shared state into the store, per-method
   slices, `CreatePromptTab` extraction, carried-over hint, the analyze
   interaction.
3. `feat/clear-draft` — the CLEAR DRAFT control.

Open questions:
- Should a cover-origin song also offer "re-cover the *same* source with a
  tweaked prompt"? Only reproducible for the from-library case (uploads
  aren't kept), so it needs source identity stored on the song. Deferred
  until the plain origin-aware reuse has been lived with.
- ~~Does CLEAR DRAFT also reset the left settings panel?~~ **Decided
  2026-07-30 (PR 3)**: no for the sidebar's generation settings — they're
  persisted app preferences in `useSettings`, shared with the Editor's
  repaint/add-layer flows, so clearing a draft must not silently change how
  unrelated screens generate. **Yes** for the reference audio, which was not
  in the original question: it lives in `voiceStore` (session state, not a
  preference) and reuse now restores a voice into it, so leaving it selected
  would keep conditioning generations from a draft the user just emptied.
  Two consequences fell out while building it: `refMode` moved from
  ReferenceAudioPicker's local state into `voiceStore` (a cleared selection
  has to visibly reset the control, and the PR-1 follow-the-store effect goes
  away with it), and the store gained `titleSuggested` so the folder-name
  title CreateView offers after a clear doesn't count as a draft — otherwise
  CLEAR DRAFT stays lit with nothing left to clear.
- Draft survival across a full reload is out of scope above. Revisit only
  if accidental reloads actually cost work; it needs a re-pick affordance
  for the `File`, not just serialization.

## Import a Song (planned 2026-07-30)

You can bring an audio file *into a generation* today (Create › AUDIO ›
UPLOAD conditions a `cover` on it, `CreateAudioTab.tsx:137`), but there is no
way to bring one in **as a song** — to repaint its chorus or lay a new guitar
over it without ACE-Step first re-rendering the whole thing. The editing
model this project exists for (see "The Editing Model") applies just as well
to a track you already have as to one generated here.

Nothing in the editor blocks it: repaint reads the layer's *active version
file off disk* and uses the params the client sends (`repaintJobs.ts:22`);
Add Layer conditions on the same file. Neither consults generation history.
The only missing piece is a way for a `songs` row to be born without a task
result — today `persistSong()` (`jobs.ts:229`) is the sole creation path and
it starts from `downloadAudio(result.file)`.

### Decisions

- **Import is a Library action, not a Create action.** The library is the set
  of editable songs and the Editor is always scoped to one of them
  (`Editor songId=…`). An imported file becomes a normal song row and is then
  indistinguishable from a generated one — favorites, folders, trash, export
  and version history all work with no special cases.
- **No "empty song" state in the Editor.** Rejected: the Editor is song-id
  scoped end to end (layers/versions fetched by song id, `editorJobStore`
  keys jobs on `songId`, repaint/add-layer take layer ids), so a null song
  means threading a nullable id through all of it plus an implicit
  "save before you can do anything" mode — to defer a row insert that is
  instant and reversible via trash. Import-then-open is the same UX without
  the state machine.
- **No "TO EDITOR" for a library-picked song** in the AUDIO tab. Every
  library row already has EDIT, so it is a Library → Create → pick → Library
  round trip to reach a screen one click away. It is also ambiguous, because
  that tab does not use the library song as-is — it bounces the layer stack
  flat (`CreateAudioTab.tsx:59`) — so the button would either open the
  existing multi-layer song (making the bounce pointless) or silently create
  a flattened duplicate. The real feature hiding in there is *"flatten this
  song into a new single-layer song"*, which belongs in the song detail rail
  next to REUSE PROMPT / CREATE COVER, and is not part of this section.
- **Destination = whatever the button says.** Three entry points, one
  endpoint:
  | Entry point | Where | Lands in |
  | --- | --- | --- |
  | Drop audio on the library list | Library (primary; bulk-capable) | Library, new row(s) |
  | `IMPORT` button | Create bar, beside FEELING LUCKY / CREATE — that row is how songs come into being | Library, new row |
  | `MOVE TO EDITOR` | Create › AUDIO › UPLOAD, under the dropzone | Editor, directly |
- **The Create-tab path is the metadata-rich one.** ANALYZE AUDIO already
  fills prompt/lyrics/bpm/key/duration in that tab
  (`useAnalyzeSourceAudio.ts`), and repaint on a song with an empty prompt is
  measurably weaker — so MOVE TO EDITOR carries whatever the draft holds. A
  bare library drop has none of that, and analysis exists *only* in the
  Create tabs today, so the library drop renders a **pending import card in
  the list** (shaped like `GeneratingCard`, no modal — DESIGN.md forbids
  stacked modals): title field, ANALYZE toggle defaulting on, acid IMPORT,
  consequence line stating what will be created.
- **The file is stored as uploaded, not converted to WAV.** Client-side
  decode already handles any container the browser can read (`decodeLayers`
  → `decodeAudioData`, used for waveform and mix), export bounces through
  `encodeWav` regardless of source format, and the cover flow already hands
  ACE-Step arbitrary containers (`coverGenJobs.ts:34` labels an mp3 buffer
  `source.wav` and works). Converting a 4-minute mp3 into a ~40MB WAV in the
  browser buys uniformity we do not need yet. Revisit only if repaint on a
  non-WAV import misbehaves — see Open Questions.
- **Extension allowlist, not free-form.** `/audio` is `express.static`
  (`index.ts`), and the stored filename is `${versionId}${ext}` with `ext`
  taken from the upload — so an `.html`/`.svg` upload would be served from
  the app's own origin. Only `.wav .mp3 .flac .ogg .m4a .aac .opus` are
  accepted; anything else is a 400.
- **`gen_task: 'import'`**, and the base version's `params_json` is
  `{"task_type":"import"}` rather than `{}`. This is the honest value (the
  column records how the song came to exist) and it is what the existing
  machinery reads: `routes/songs.ts:83` already surfaces
  `params.task_type` per version, and `backfillGenTask` lifts the same key,
  so no new plumbing is needed to tell an import apart downstream.
- **ALT / SIMILAR must not offer to replay an import.** Both rebuild a
  request from the version's stored `params_json` (`repaintJobs.ts:71`,
  `:132`) and the buttons are currently unconditional
  (`VersionHistory.tsx:130`) — on an imported version that would submit an
  empty `text2music` and return unrelated audio. Guarded in two places:
  hidden client-side for `task_type === 'import'`, and refused server-side in
  `startRegenerate`/`startSimilarTake`, since a 400 is a better failure than
  minutes of GPU time spent on nonsense.
- **No genLock.** Import generates nothing, so it must not contend with (or
  be blocked by) a running generation.
- **Duration is client-supplied.** There is no server-side audio probing
  anywhere in this codebase (see `routes/voices.ts:17`); the client reads it
  from an `HTMLAudioElement` exactly as `VoiceUploadForm.tsx:8` does.

### File-level plan

PR 1 — endpoint (this PR):
- `server/src/routes/songImport.ts` (new) — `POST /api/songs/import`,
  multipart via multer memory storage at the 100MB limit `generate.ts:27`
  already uses for source audio. Its own module rather than an addition to
  `routes/songs.ts` (166 LOC, cap 200); mounted on `/api/songs` alongside
  `songLayersRouter`/`remasterRouter`, matching how that path is already
  composed from several routers.
- `server/src/routes/songImport.test.ts` (new) — round trip, extension
  rejection, title fallback from filename, optional-field handling.
- `server/src/services/repaintJobs.ts` — refuse `task_type: 'import'` in
  `startRegenerate` and `startSimilarTake`.
- `server/src/index.ts` — mount the router.

PR 2 — Create › AUDIO `MOVE TO EDITOR` (carries the draft; `openEditor`
added to the existing `NavigationContext`, which already carries
`goToSettings`), plus the `VersionHistory` ALT/SIMILAR guard.

PR 3 — Library drop target + `IMPORT` in the create bar + the pending import
card.

### Open questions

- Does ACE-Step's repaint accept a non-WAV `srcAudio` in practice? The cover
  path suggests it sniffs content rather than trusting the filename, but it
  has only ever been fed WAV *by us* for repaint. Verify by importing an mp3
  and repainting a region; if it fails, convert on import (a one-line
  `encodeWav` addition client-side, already imported in that tab).
- Should an imported song's base version be labelled with the original
  filename instead of a flat `imported`? Deferred until there is a second
  import path (re-import over an existing song) where the distinction earns
  its keep.

## Adapter Loading (LoRA/LoKr) at Inference (planned 2026-07-31)

Surveyed from `ace-step/awesome-ace-step` 2026-07-31. The ecosystem now trains
adapters outside this project — Side-Step (standalone LoRA/DoRA/LoKR/LoHA/OFT
trainer, 8GB VRAM floor), the sdbds Windows fork (LoKR), ACE-Step's own
`/v1/training/*` — and publishes them on HuggingFace. Mulakai can **load** one
today and never does: `lora` appears only in `ForgeSection.tsx`'s copy and a
`modelInfo.ts` comment.

This is not FORGE. `FORGE_PLAN.md` defers the *dataset + training studio* until
release 1.0 and its motivating case is "the base model can't produce good acid
tracks" — loading an externally-trained adapter fixes that case at a fraction
of the cost, and does not commit us to building the studio. It ships in
Settings › Models, not behind `forgeEnabled`.

### Verified against ACE-Step source, 2026-07-31

These routes are **not in `docs/ace-step-1.5/API.md`** — that file documents
only the training API (`/v1/training/start`, `/start_lokr`). The lifecycle
routes exist in source, confirming `FORGE_PLAN.md:63`'s list
(`S:\AI Gen\ACE-Step-1.5\acestep\api\http\lora_routes.py`):

| Route | Body | Notes |
| --- | --- | --- |
| `POST /v1/lora/load` | `{lora_path, adapter_name?}` | `adapter_name` selects multi-adapter mode (`:66-70`) |
| `POST /v1/lora/unload` | — | restores the base model |
| `POST /v1/lora/toggle` | `{use_lora}` | 400s if nothing is loaded (`controls.py:36`) |
| `POST /v1/lora/scale` | `{scale: 0.0-1.0, adapter_name?}` | |
| `GET /v1/lora/status` | — | `{lora_loaded, use_lora, lora_scale, adapter_type, scales, active_adapter, adapters, ...}` |

Adapter formats (`handler/lora/lifecycle.py:17-58`): a **LoRA** is a PEFT
directory containing `adapter_config.json`; a **LoKr** is a `.safetensors` file
(named `lokr_weights.safetensors`, or any safetensors carrying `lokr_config`
metadata), or a directory containing one.

Five constraints fall out of the source, and they drive every decision below:

1. **It is global server state, not a request parameter.** `/release_task` has
   no adapter field (grep of `API.md` §4.2 finds none). A loaded adapter
   therefore colours *every* subsequent job — generate, repaint, lego, cover,
   remaster — until changed.
2. **It requires an initialized handler.** `_require_initialized_handler`
   (`lora_routes.py:36`) 500s with "Model not initialized", so adapter calls
   must follow `ensureModelLoaded` (`jobs.ts:84`), never precede it.
3. **Re-initializing the model drops the adapter.** `/v1/init` calls
   `handler.initialize_service()` unconditionally
   (`model_init_service.py:112`) and the adapter is attached to
   `model.decoder` (`controls.py:39-60`). Since `ensureModelLoaded` fires
   `/v1/init` before every job that names a model, the adapter has to be
   re-applied after init **every time** — not once at selection.
4. **Slot 1 only.** The LoRA routes act on `app.state.handler`
   (`lora_routes.py:39`) = slot 1, while job routing can pick handler2/handler3
   by model name (`job_model_selection.py:29-48`). Mulakai only ever inits slot
   1 (`acestep.ts:328`, `{slot: 1}`), so the default single-slot deployment is
   correct — but against an ACE-Step started with `ACESTEP_CONFIG_PATH2/3`, a
   job whose model matches another slot runs *without* the adapter, silently.
   Stated, not solved (see Open questions).
5. **There is no discovery endpoint.** `lora_path` is a path on the ACE-Step
   host's filesystem and nothing lists what is available. Mulakai keeps its own
   registry.

### Decisions

1. **One active adapter, app-wide — not a per-flow setting.** The server's
   model is global (constraint 1), so exposing per-flow adapter pickers in
   Create/Repaint/Add Layer would be a lie the backend can't honour. A single
   selection lives in Settings › Models with a strength slider, and every
   commit surface *states* it rather than re-choosing it.
2. **Registration validates by loading, not by stat.** `ACESTEP_API_URL` may
   point at another host, so the Node server cannot assume it can see
   `lora_path` on disk. Registering an adapter therefore calls
   `/v1/lora/load` immediately: a 400 (bad path / not an adapter) rejects the
   entry with ACE-Step's own message; success stores it. This also means
   registration requires an initialized model — the form says so.
3. **Reconciliation lives inside `ensureModelLoaded`.** After init, read
   `GET /v1/lora/status` and drive the server to the desired state
   (load → scale → toggle, or unload when NONE is selected). Idempotent, and
   it is the only place that reliably runs after the init that would have
   dropped the adapter (constraint 3). Cost when nothing changed: one GET per
   job.
4. **Every commit action states the active adapter inline**, per `AGENTS.md` —
   e.g. "with ADAPTER acid-house @ 0.80" on GENERATE / REPAINT / ADD LAYER /
   REMASTER. One shared component, the same way `CarriedPromptNote.tsx`
   centralizes its one line. Neutral styling: an adapter is neither a commit,
   a selection, a version, nor an error, so it borrows no hue.
5. **The take records what made it.** `persistSong`/`persistVersion` stamp
   `{adapter, adapter_scale}` into the version's `params_json` so a result
   stays explicable — same precedent as `reference_audio_label` on `songs`.
   Stamped at persist time, **not** added to `fullParams`, which would send
   unknown fields to `/release_task`. No new column: nothing in the library
   list needs it.
6. **Single adapter at a time.** The API supports multi-adapter mode via
   `adapter_name`, but stacking adapters is a mixing problem (per-adapter
   scales, ordering) with no UI budget here. `load` is called without
   `adapter_name`, taking the `handler.load_lora` path (`lora_routes.py:70`).

### File-level plan

- `server/src/db/schema.ts` — `adapters` table: `id`, `name`, `path`,
  `kind` (`lora` | `lokr`, from ACE-Step's reported `adapter_type`), `scale`
  (default 1.0), `created_at`. Plus the single active selection — a
  `settings`-style single-row store or a nullable `active` flag; pick at
  implementation time, whichever matches `output_metadata`'s existing
  single-row precedent.
- `server/src/services/acestep.ts` — `loadLora` / `unloadLora` / `setLoraScale`
  / `toggleLora` / `loraStatus`. Note the two error shapes: `/load` and
  `/unload` raise real `HTTPException`s (`lora_routes.py:77,92`) while
  `/toggle` and `/scale` return a `code=400` envelope (`:107,128`) — `call()`
  already handles both (see its comment at `acestep.ts:285-292`), so no new
  error plumbing, but the tests should cover each shape.
- `server/src/services/adapters.ts` (new) — registry CRUD + `reconcileAdapter()`.
- `server/src/services/jobs.ts` — `ensureModelLoaded` calls `reconcileAdapter()`
  after `initModel`; `persistSong`/`persistVersion` stamp the adapter fields.
- `server/src/routes/adapters.ts` (new) — `GET/POST/DELETE /api/adapters`,
  `PATCH /api/adapters/active` (`{id | null, scale}`).
- `client/src/api.ts` — the four calls + the `Adapter` type.
- `client/src/AdaptersSection.tsx` (new) — Settings card: registered adapters,
  ADD (path + name), SELECT/NONE, strength slider, DELETE with the standard
  two-step confirm. Rendered by `SettingsView.tsx` under Models.
  `ModelsSection.tsx` (78 LOC) stays as-is — this is its own concern.
- `client/src/ActiveAdapterNote.tsx` (new, small) — the inline consequence
  line, rendered by `PromptGenerateRow.tsx`, `RepaintBar.tsx`,
  `AddLayerTrigger.tsx`, `RemasterAction.tsx`.
- `docs/design/DESIGN.md` — the settings card and the adapter note (no new
  tokens; ships in the same PR as the UI per `AGENTS.md`).
- `FORGE_PLAN.md` — a pointer noting adapter *loading* is covered here, so
  FORGE's scope narrows to dataset + training.
- Tests: `adapters.test.ts` (registration rejects on a 400 from load; delete
  clears the active selection), reconcile logic (no-op when status already
  matches; re-applies after an init; unloads on NONE), and a `jobs.test.ts`
  case asserting reconcile runs *after* `initModel`, not before.

### Rollout

1. `feat/adapter-registry` — schema, ACE-Step client calls, registry service,
   routes, reconcile-in-`ensureModelLoaded`.
2. `feat/adapter-settings-ui` — the Settings card.
3. `feat/adapter-consequence-note` — the inline note across the four commit
   surfaces + the `params_json` stamp.

### Open questions

- **Cross-model compatibility is unverified.** Nothing states whether an
  adapter trained against `base` loads cleanly onto `sft`/`turbo`/`xl-*`.
  ACE-Step reports failure through `/v1/lora/load`, so the failure mode is at
  least visible — but if it turns out to be per-model, the registry needs a
  `trained_for` field and the picker needs gating (same shape as
  `useModelsForTask`).
- **Multi-slot deployments** (constraint 4) — detectable via `/v1/models`
  reporting more than one initialized slot? Not investigated. Until then, the
  Settings card should say the adapter applies to the primary model slot.
- **LoKr scale 0 vs toggle off** are equivalent in the source (`_toggle_lokr`
  sets the multiplier to 0.0, `controls.py:26-31`); PEFT LoRA disables adapter
  layers instead. No user-visible difference expected — confirm once a LoKr
  adapter is actually on hand.
- Should a song's stamped adapter be *restorable* (REUSE PROMPT re-selecting
  it, the way reference audio now is)? Consistent, but it mutates global
  server state from a per-song action. Deferred until adapters are in daily use.

## Style Tag Vocabulary for the Caption Field (planned 2026-07-31)

The lyric side of the prompt got the full treatment — an empirical probe
(`lyricTagProbe.ts`), a distilled guide (`lyricTagGuide.ts`), and a popover
right on the LYRICS field (`CreatePromptTab.tsx:82`). The caption side, which
is the single strongest lever on what comes out, is a bare textarea
(`CreatePromptTab.tsx:63`) with a placeholder.

Surveyed 2026-07-31 from `ace-step/awesome-ace-step`: the sdbds Windows fork
ships 936 styles synced from Suno's explorer with search + random;
scromfyUI-AceStep splits prompt authoring into 8 category dropdowns (style,
mood, adjective, culture, genre, vocal, performer, instrument); the ambienceai
prompting guide gives an ordering rule (genre/era → instruments → mood →
tempo), a 3–7 tag target, known-bad pairings, and a ~2–3 words/second singing
budget. **Verified: ACE-Step itself ships no style vocabulary** — there is no
genre/style list anywhere under `acestep/`, only `examples/{simple_mode,
text2music}/*.json`.

### Decisions

1. **Mine it, don't hardcode it** — the same principle already stated for lyric
   tags above ("rather than hardcoding a guessed tag list, discover the real
   vocabulary empirically"). The captions are *already flowing through the
   exact calls the lyric probe makes*: `createSampleFromQuery` and
   `createRandomSample` return `caption` alongside `lyrics`. Mining style tags
   is a second miner over one sample stream, not a second probe run.
2. **One probe loop, two miners.** Refactor `lyricTagProbe.ts`'s sample loop
   into a shared iterator (seed queries, `RANDOM_SAMPLE_STRIDE`, the
   consecutive-failure auto-stop) so one run feeds both stores. This halves
   ACE-Step time versus two independent probes, and `lyricTagProbe.ts` is 187
   LOC — at the 200 cap, so it cannot absorb this inline anyway.
3. **Tokenization**: captions are comma-separated tag lists. Split on commas,
   trim, lowercase, collapse whitespace; route pure-numeric and `N BPM` tokens
   into their own bucket rather than the vocabulary. Counts merge additively
   after every sample, crash-safe, exactly as `recordSample()` does today.
4. **Categorization is a convenience, not a filter.** A small hand-written
   keyword taxonomy assigns each mined token to a category (genre, era, mood,
   instrument, vocal, production, culture); anything unmatched lands in an
   `other` bucket that is still displayed. Deliberately **no "performer"
   category** — scromfyUI has one and it invites prompting with real artists'
   names.
5. **Do not vendor the 936-tag list.** It is a scrape of a commercial
   competitor's explorer page, and it describes *Suno's* vocabulary, not what
   this model responds to. Useful at most as an offline coverage check against
   what we mine — not as shipped data.
6. **The picker inserts; the field stays free text.** Clicking a tag appends
   `, tag` at the caret (or end); no chips model, no re-parse of the textarea.
   The caption is prose the LM may rewrite — owning it as structured state
   would fight `REFINE INPUT` and the thinking reveal.
7. **PROMPT tab only for v1.** COVER's prompt means "describe the change from
   the source" and ARRANGE's describes an accompaniment — a style vocabulary is
   only partly right in both, and the shared `createDraftStore` prompt already
   carries a `CarriedPromptNote` about exactly that semantic shift. Revisit
   once the PROMPT-tab picker has been used.
8. **Static guidance is labelled as such.** The ordering rule, the 3–7 count,
   and the bad-pairings list are one blogger's rules of thumb, not measurements
   — they live in a written guide card with attribution, visually separate from
   the mined counts, the same way `LyricTagGuideContent` hedges its
   language-code inference.
9. **The lyric-density hint is the one active check**, and the highest-value
   item here: `words(lyrics) / duration` against the 2–3 words/sec band, shown
   inline under LYRICS when the lyrics can't fit the requested duration
   ("~180 words for 90s — expect rushed delivery"). Both fields are already in
   the draft store; it needs no probe, no model call, and no new data.

### File-level plan

- `server/src/services/probeSamples.ts` (new) — the shared sample loop lifted
  out of `lyricTagProbe.ts` (seed queries, stride, failure auto-stop, stop
  flag), yielding `{caption, lyrics}` per sample.
- `server/src/services/lyricTagProbe.ts` — consumes the shared loop; keeps its
  own store and mining regex. Should shrink, not grow.
- `server/src/services/styleTagProbe.ts` (new) — the caption miner + its own
  `data/styleTags.json` store, same additive-merge shape as `lyricTags.json`.
- `server/src/routes/styleTags.ts` (new) — mirrors `lyricTags.ts` exactly
  (`GET /`, `GET /status`, `POST /probe`, `POST /probe/stop`); one probe state
  now covers both miners, so `/status` is shared — decide at implementation
  whether the two routers read one state module or the style routes simply
  proxy the lyric probe's status.
- `server/src/index.ts` — mount the router.
- `client/src/styleTagGuide.ts` (new) — the category taxonomy + clustering,
  mirroring `lyricTagGuide.ts`'s shape.
- `client/src/StyleTagPicker.tsx` (new) — portal popover anchored on the PROMPT
  `field-label-row` (`CreatePromptTab.tsx:59-62`), reusing
  `LyricTagGuidePopover.tsx`'s open/click-outside/portal pattern verbatim:
  category tabs, search, click-to-append.
- `client/src/StyleTagGuideContent.tsx` (new) — the static guidance card, split
  out so both the popover and Settings render it (same split as
  `LyricTagGuideContent`).
- `client/src/StyleTagsSection.tsx` (new) — Settings list of mined tags by
  frequency, beside `LyricTagsSection.tsx`.
- `client/src/CreatePromptTab.tsx` — the picker trigger on the PROMPT label
  row; the lyric-density hint under LYRICS.
- `client/src/api.ts` — `listStyleTags()`.
- `docs/design/DESIGN.md` — note that the popover anatomy is reused as-is; no
  new shapes or tokens.
- Tests: tokenizer (comma splitting, BPM/number bucket, case + whitespace
  dedupe), additive merge across runs, categorization incl. the `other`
  fallback, and the density calculator's boundaries.

### Rollout

1. `feat/probe-sample-loop` — extract the shared loop, add the style miner and
   its store/routes, list mined tags in Settings. No Create-screen change.
2. `feat/style-tag-picker` — the PROMPT-field popover.
3. `feat/prompt-guidance` — the static guide card + the lyric-density hint.

### Open questions

- **Does a mined vocabulary reflect what the DiT responds to, or only what the
  LM likes to write?** The captions come from the LM, so this measures the LM's
  habits — a reasonable proxy (the LM writes the caption the DiT is
  conditioned on in the enhanced path) but not the same claim. Only a listening
  experiment settles it; the Settings copy should not overclaim.
- Should tag counts be weighted by anything — a kept-vs-trashed signal, or the
  `get_lyric_score` endpoint still listed as a to-do under Open Questions? Both
  are speculative; plain frequency first.
- Per-category display cap. The lyric guide clusters near-duplicates to stay
  readable; captions will have a long tail of near-synonyms ("dreamy" /
  "dreamlike"). Reuse `clusterByPrefix`, or cap at N per category and sort by
  count — decide once there is real mined data to look at.

## Output Format: Rate / Depth / Bitrate, Everywhere (planned + implemented 2026-07-31)

Settings has one output knob today — `DEFAULT EXPORT FORMAT`, six values
(`wav|wav32|flac|mp3|opus|aac`) mapped straight onto ACE-Step's `audio_format`
(`settings.ts:70`, `PlaybackExportSection.tsx:5`). It is threaded into
generation, repaint and Add Layer (`genParams`/`repaintParams`/
`addLayerParams`) and **nowhere else**. Stem splitting ignores it outright:
`stemSplit.ts:115` hardcodes `audio_format: 'mp3'`, `:148`/`:182` hardcode
`${jobId}-${kind}.mp3` filenames, `split.ts:64` hardcodes the download name,
and `demucs-server/main.py:56` passes `--mp3`. So the one path where fidelity
matters most — stems that get re-fed to ACE-Step as conditioning — is the one
path pinned to a lossy default.

Sample rate and bit depth are not modeled at all. The existing comment
(`PlaybackExportSection.tsx:15`) explains why: ACE-Step exposes neither, and
generates at a fixed 48 kHz. That reasoning holds for *what we can ask
ACE-Step for*; it does not hold for what we write to disk.

### Decisions

- **One lossless master, one transcode, at the boundary.** Every producer
  emits the highest-fidelity thing it can, and a single `transcode()` applies
  the user's settings once, where the file lands in `audioDir`. Never
  lossy→lossy, never two encodes.
  | Producer | Asked for | Then |
  | --- | --- | --- |
  | ACE-Step (generate/repaint/lego/extract) | always `audio_format: 'wav32'` | transcode after `downloadAudio` |
  | Demucs / UVR service | WAV float (drop `--mp3`, `wav_type_set='FLOAT'`) | transcode after fetch |
  The user's format therefore stops travelling on the ACE-Step wire —
  `genParams` et al. pin `wav32` and the settings value is applied by us.
- **Three formats, not six.** `AudioFormat` becomes `'wav' | 'flac' | 'mp3'`,
  default **`flac`**. `wav32` was never a format — it is `wav` at 32-bit, and
  becomes exactly that. `opus`/`aac` are dropped per this spec.
- **Bit depth is format-dependent; clamp, do not cross-product.**
  | Format | Depths offered | Default (= highest) |
  | --- | --- | --- |
  | `wav` | 16 / 24 / 32-float | **32** |
  | `flac` | 16 / 24 | **24** |
  | `mp3` | n/a — kbps instead | — |
  FLAC has no 32-bit float encoding, so offering it would silently write 24.
  Changing format re-clamps `bitDepth` to that format's maximum rather than
  leaving an impossible pair selected.
- **kbps applies to `mp3` only**, options 128/192/256/320, default **320**
  (the format ceiling — the size delta over 256 is negligible at track
  length, and stems get re-encoded downstream). The control is hidden for
  `wav`/`flac` rather than shown disabled.
- **48 kHz default, 44.1 kHz as a compatibility option — not a quality one.**
  Resampling adds no information. 48k is ACE-Step's native rate, so the
  default leaves generation output untouched; 44.1k exists for CD/distribution
  targets and costs a non-integer 147/160 resample (use soxr, not the default
  swresample). Note the inverse case: Demucs/htdemucs is **44.1 kHz-native**,
  so its stems get resampled *up* to sit at the song's rate. That is a
  container change, not new detail — but layers in one song must share a rate,
  and the song's rate is the global setting.
- **Applies to future runs only.** No retro-transcode of existing library
  audio; the existing hint copy (`PlaybackExportSection.tsx:24`) already sets
  this expectation and stays accurate.
- **ffmpeg becomes an explicit server dependency.** It is already a de-facto
  machine prerequisite (`demucs-server/README.md:17`; ACE-Step's setup
  installs it), but `server/` has never shelled out to it. Probe once at
  startup and fail loudly — silently writing the wrong format is worse than
  refusing to start.
- **Rejected: transcoding in the client.** `bounceMix.ts:26`'s hand-rolled
  `encodeWav` is 16-bit-only and would have to grow depth/rate/MP3 encoding
  (i.e. ship lamejs). The server already owns `audioDir` and every producer
  path converges there. `encodeWav` stays as-is — it feeds *conditioning
  uploads*, not user-facing output, and is out of scope here.

### File-level plan

- `client/src/settings.ts` — `AudioFormat` narrows to 3; `ExportSettings`
  gains `sampleRate: 48000|44100`, `bitDepth: 16|24|32`, `mp3Bitrate`.
  `genParams`/`repaintParams`/`addLayerParams` pin `audio_format: 'wav32'`.
  `mergeSettings` migrates persisted blobs: `wav32 → {wav,32}`,
  `opus|aac → flac`.
- `client/src/formatCaps.ts` — NEW, shared with the server: depths per format,
  `clampDepth(format, depth)`, extension per format. Small and pure.
- `client/src/PlaybackExportSection.tsx` — format / sample-rate / bit-depth
  selects, kbps select shown only for `mp3`. Re-clamps depth on format change.
- `server/src/services/transcode.ts` — NEW. `transcode(inPath, outPath, opts)`
  → ffmpeg args per format/rate/depth/bitrate + `probeFfmpeg()`.
- `server/src/services/stemSplit.ts` — dynamic extension, transcode after
  download, drop the `'mp3'` literal at `:115`.
- `server/src/services/scratchSplitJobs.ts`, `server/src/routes/split.ts` —
  dynamic extension in stem paths and download names.
- `server/src/services/jobs.ts` — transcode in the `persistSong`/`downloadAudio`
  path so generation output honours the setting too.
- `demucs-server/main.py` — write WAV float instead of `--mp3`; the wrapper no
  longer encodes.
- Tests: `settings.test.ts` (migration + clamping), new `transcode.test.ts`
  (arg construction — no ffmpeg needed), `stemSplit.test.ts` / `split.test.ts`
  (extension propagation).

### Open questions

- **Does the format setting belong to the song or to the app?** As specced it
  is global and applies at write time, so one song's layers can end up in
  mixed formats if the user changes it mid-edit. Playback decodes either way,
  and export re-bounces — but "stems at 44.1/FLAC under a 48k/WAV master" is
  reachable. A per-song locked rate (set at creation, layers inherit) is the
  stricter alternative; not worth the schema change until it bites.
- **Where does the ffmpeg probe surface?** `split.ts:21`'s `/health` already
  reports per-backend availability and the SPLIT UI disables tabs on it. A
  missing ffmpeg is broader than SPLIT, so it likely wants a Settings-level
  banner rather than a fourth health flag.
- ~~**Is `wav` at 32-bit float actually wanted as the WAV default**~~ —
  **decided: yes, 32-bit float.** WAV's depth options are 16/24/32 and the
  default is the format's ceiling, consistent with every other control here.
  Verified end to end: `pcm_f32le` on disk, FLAC's ceiling stays 24-bit
  (`s32` + `bits_per_raw_sample=24`, which is how ffmpeg expresses 24-bit
  FLAC), MP3 at 320 kbps.
- **`bounceMix.ts`'s `encodeWav` is still 16-bit int.** Out of scope by the
  decision above — it feeds *conditioning uploads*, not user-facing output, so
  it never reaches transcode.ts. Worth revisiting if a round-tripped layer ever
  sounds worse than the stem it came from.

## STEPS AUTO Resolves Per Model (planned 2026-07-31)

Our STEPS slider treats `0` as AUTO and *omits* `inference_steps` from the
request (`settings.ts:196`, `:253`, `:272`). ACE-Step then falls back to a flat
**8** — `release_task_request_builder.py:56` and `release_task_models.py:41`
both hardcode it, with no regard for which DiT is loaded.

Eight steps is right for Turbo, which is distilled for it. It is wrong for
everything else, and our own UI says so: `modelInfo.ts:15` tells the user SFT
wants 50 steps, `:16` says Base wants 32–100, and `stepsMax()` opens the slider
to 200 for both. So **picking XL-SFT and leaving STEPS on AUTO silently
generates at 8 steps** — undercooked, noisy output — while the panel copy
implies the model's own sensible default is in play. AUTO currently means
"whatever the API hardcodes", not "whatever this model wants".

Upstream noticed the same gap: PR #1223 (open, unmerged) makes the API's
`inference_steps` default model-aware, matching what the Gradio UI has always
done. Upstream `main` has been frozen at `6d467e4` since 2026-06-26 with 26 PRs
open and none merging, so waiting for it is not a plan — but we do not need to.
We control the parameter we send, so this is fixable entirely on our side of
`ACESTEP_API_URL`, with no fork patch.

### Decisions

- **Resolve on the server, not in `settings.ts`.** The client's param builders
  are pure sync functions and cannot see which model ACE-Step actually loaded —
  and under AUTO model (`model: ''`) the name is not known client-side at all.
  The server already knows: it calls `ensureModelLoaded()` and can read
  `listModels().defaultModel`. One resolver there also covers repaint, Add
  Layer, cover, complete and extract for free.
- **The mapping, keyed on model family** (matching PR #1223's table so we do
  not diverge from upstream if it ever lands):
  | Family | Steps | Why |
  | --- | --- | --- |
  | `turbo` | 8 | distilled for ~8; more burns time for nothing |
  | `sft` | 50 | `modelInfo.ts:15` already tells the user this |
  | any other explicit model | 32 | bottom of Base's 32–100 band |
  | unresolvable | 8 | legacy behaviour, unchanged |
  Precedence is turbo → sft → other, so a hypothetical `turbo-sft` reads as
  turbo. Every value sits inside the matching `stepsMax()` ceiling, so the
  slider and the resolver cannot disagree.
- **Match on delimited tokens, not substrings.** `(^|[\/._-])turbo($|[\/._-])`,
  per PR #1223 — a LoRA named `turbocharged-rock` must not read as Turbo and
  silently drop to 8 steps. `modelInfo.ts`'s existing `stepsMax()` and
  `guidanceEffective()` use bare `.includes('turbo')` and carry the same
  false-positive; they get the same treatment in this change.
- **Fill only when absent.** If the caller already sent `inference_steps`, it
  wins untouched. This is what keeps remaster correct — `remasterJobs.ts:66`
  always sets its own steps from `exportSettings.steps`.
- **AUTO model resolves via the inventory.** When `model` is unset we look up
  `listModels().defaultModel` and classify that name; a null/unreachable
  inventory falls back to 8. This is strictly better than PR #1223, which gives
  up and returns 8 whenever `model` is omitted — and it costs one GET to a
  local server on a path that is about to spend minutes in diffusion.
- **This deliberately makes AUTO/AUTO generations slower.** If ACE-Step's
  default checkpoint is Base, AUTO goes from 8 steps to 32 — roughly 4x the
  wall clock. That is the point: the current speed comes from producing
  under-sampled audio. Users who want 8 steps on a Base model can still set it
  explicitly.
- **Surface what AUTO means.** The STEPS readout becomes `AUTO (50)` once a
  model is explicitly picked, and stays bare `AUTO` under AUTO model where the
  client genuinely cannot know. No new colors, shapes or controls — this is
  readout copy inside the existing `Slider`, so `DESIGN.md` needs no update.
- **Out of scope: `lyricTimestamp`'s own `inference_steps ?? 8`**
  (`acestep.ts:379`). That is the alignment pass, a separate lightweight
  inference where 8 is appropriate; it is not the generation step count and
  should not be swept into this change.
- **Rejected: patching the fork instead.** Porting PR #1223 into
  `S:\AI Gen\ACE-Step-1.5` would fix it for every client of that server, but we
  are the only client, it adds a carry-forward patch to a fork already 5 commits
  ahead, and it cannot use `defaultModel` as cleanly as we can. Our side is
  smaller and better-informed.

### File-level plan

- `client/src/modelInfo.ts` — add `modelFamily(name): 'turbo' | 'sft' | 'other'
  | 'unknown'` with the delimited-token regex, and `autoSteps(name): number |
  null` (null = unknown, i.e. AUTO model). Rewrite `stepsMax()` and
  `guidanceEffective()` on top of `modelFamily()` so the three helpers cannot
  drift apart.
- `client/src/SettingsPanel.tsx` — STEPS readout at `:109` and `:149` becomes
  `AUTO (n)` when `autoSteps(model)` is non-null. Repaint's slider is gated on
  `gatingModel`, Add Layer's model lives in `addLayer.model` — feed each its own
  model name, not `gen.model`.
- `server/src/services/inferenceSteps.ts` — NEW, small and pure-ish:
  `resolveInferenceSteps(params: ReleaseTaskParams): Promise<void>`. No-ops if
  `params.inference_steps` is set; otherwise classifies `params.model`, falling
  back to `listModels().defaultModel`, and assigns. Its own family classifier
  (see open questions on sharing).
- The 9 `releaseTask()` call sites — each is already immediately preceded by
  `await ensureModelLoaded(...)` on the same params object, so this is one added
  line per site: `stemSplit.ts:120`, `jobs.ts:116`, `completeGenJobs.ts:37`,
  `addLayerJobs.ts:51`, `coverGenJobs.ts:31`, `remasterJobs.ts:76`,
  `repaintJobs.ts:56`/`:114`/`:181`.
  **Gotcha in `jobs.ts`:** it resolves against `params` at `:116` but builds
  `fullParams` at `:119` and persists *that* (`persistSong`, `:133`). The spread
  carries the mutation through, but the ordering must not be disturbed —
  resolving after `fullParams` is built would record AUTO in
  `versions.params_json` while the run used 50, and version history would lie.
- Tests: new `server/src/services/inferenceSteps.test.ts` — token matching
  (`turbocharged` is not turbo), family precedence, fill-only-when-absent,
  `defaultModel` fallback, unreachable-inventory → 8. Extend
  `client/src/modelInfo.test.ts` (new file) for `modelFamily`/`autoSteps` and
  the rebuilt `stepsMax`/`guidanceEffective`.

### Open questions

- **Should the family classifier be shared rather than duplicated?** It lands
  in both `modelInfo.ts` (for the readout) and `inferenceSteps.ts` (for the
  authoritative resolve) — ~10 lines twice, and they must not drift. The
  Output Format spec above proposes a client/server-shared `formatCaps.ts` for
  the same reason; if that pattern gets built, this should move into it. Until
  then the duplication is deliberate, and the server copy is authoritative.
- **Should `ensureModelLoaded` absorb this** and be renamed (`prepareRequest`)?
  Every one of the 9 sites pairs them, so two adjacent calls is a standing
  invitation to add the next one and forget. Against: model loading and step
  defaulting are unrelated responsibilities, and the rename churns 7 files.
  Kept separate for now; revisit if a third pre-flight step appears.
- **Is 32 right for Base, or should it be higher?** `modelInfo.ts:16` quotes
  32–100 and PR #1223 picks the floor. The floor is the safe default for an
  unattended AUTO, but Base at 32 is still visibly below what the model can do.
  Leaving it at 32 until there is a listening comparison worth acting on.
- **Does the `defaultModel` lookup want caching?** One GET per generation
  against a local server is noise next to diffusion, and `listModels()` already
  swallows errors. If the inventory ever moves off-box it wants a TTL cache.

## Multiple Song-Creation Engines (planned 2026-09-30)

**This amends a locked decision.** "Grand Goal" says a song is generated
*with ACE-Step 1.5*, and `AGENTS.md`'s Scope Discipline repeats that. The
project owner changed this scope on 2026-09-30: a song's **first take** may
come from another local model, called an *engine* here. Nothing else changes.

- Every edit after the first take still runs on ACE-Step: repaint, Add Layer
  (`lego`), complete, extract, remaster, and regenerate.
- ACE-Step accepts any `src_audio`, so it edits an engine-made song the same
  way it edits an imported one (see "Import a Song").
- The earlier lines stay as written. This section supersedes them, the same
  way "Settings Screen" superseded the three-screen line.

Engine order (**reordered 2026-09-30** at the project owner's request, after
both spikes came back "go"; HeartMuLa was first in the original plan):

1. **YuE2** first. It needs WSL2 on this machine. The spike measured RTF
   0.54 with no spill (see "YuE2 spike results"). Its weights are CC BY-NC
   4.0 with a creator permission, so the first engine to ship brings the
   Settings card's license note with it.
2. **HeartMuLa** next. Its code and weights are Apache-2.0, and it runs on
   native Windows.
3. **MiniMax Music 3** is skipped. The reasons are recorded below.

Nothing in design points 1–13 depends on the order. Engines are listed in
the order above wherever order is visible: config, `GET /api/engines`, the
ENGINE row, and the Engines card, with ACE-Step first.

The goal is a second model family for the step where model choice matters
most, the whole-song first take, without adding a second editing stack.

### General engine design (decided once, shared by every engine)

1. **Engines only create songs; ACE-Step does all editing.**
   - An engine choice exists only for new-song text-to-song on
     Create › PROMPT. The result becomes Base v1 of a new song.
   - ACE-Step-only: AUDIO (cover), ARRANGE (complete), the whole Editor, and
     the helpers (`format_input` / AI ENHANCE, `create_sample` / FEELING
     LUCKY and Quick Start, `/v1/analyze_audio`, `/lyric_timestamp`).
2. **Each extra engine is an optional, separate process.** This follows
   `demucs-server/` + `config.demucsUrl` and the health-gated disabled option
   in `SplitPanel.tsx` / `ScratchSplitPicker.tsx`.
   - Each engine has its own env URL (`YUE_API_URL`, `HEARTMULA_API_URL`).
     An empty URL disables that engine.
   - Each engine has its own optional bearer key (`YUE_API_KEY`,
     `HEARTMULA_API_KEY`).
   - Each engine has its own wrapper directory (`yue-server/`,
     `heartmula-server/`).
   - **Each engine has its own Python environment.** The pins conflict:
     HeartMuLa wants Python 3.10 with torchtune 0.4.0 and transformers
     4.57.0, while YuE2 wants Python 3.12 with torch 2.10.0. Engine code is
     installed into its own venv as a dependency and never vendored here.
3. **One wire contract for every wrapper.** The contract is the job API
   shape that YuE2-Turbo's `yue2-serve` already uses:
   - `POST /v1/jobs` → 202 `{id}`
   - `GET /v1/jobs/{id}` → `queued | running | succeeded | truncated | failed | cancelled`,
     with an optional `progress` / `stage`
   - `POST /v1/jobs/{id}/cancel`
   - `GET /v1/jobs/{id}/audio` (lossless FLAC)
   - an optional `GET /v1/jobs/{id}/score` (404 when the engine has none)
   - `GET /health/ready`

   Mulakai then needs one generic HTTP client (`engineClient.ts`, taking a
   base URL and key) instead of one per engine. Adopting a real engine's
   existing API also means YuE2-Turbo works with no wrapper at all.

   **Contract details** (added 2026-09-30 for `feat/engine-framework`, and
   checked against `yue2-serve`'s source, `src/yue2/service.py` and
   `service_store.py`). The list above left these open. Wrappers must follow
   them, and `engineClient.ts` reads exactly this:
   - *Auth*: `Authorization: Bearer <key>` on every call, sent only when a
     key is set. `yue2-serve` leaves `/health/*` unauthenticated; sending the
     header there anyway is harmless.
   - *Submit*: the body is the engine's `toRequest` output, as JSON. The
     reply is 202 with a job object carrying at least `id`. `yue2-serve`
     returns the whole job record, and 200 for an idempotent replay, so any
     2xx with a string `id` is accepted. 429 (queue full) and 503 (not
     ready) fail the Mulakai job with the wrapper's `detail`.
   - *Our job id travels as the `Idempotency-Key` header*, not in the body.
     `yue2-serve`'s request model is `extra="forbid"`, so the YuE2 mapping's
     `id` body field would be rejected with a 422 there. The header also makes
     a retried submit safe. **Wrappers should log it.** The `id` row in the
     YuE2 mapping table below is superseded by this.
   - *Status*: `{ id, status, stage?, progress?, error? }`.
     - `status` is one of the six values above. Anything else fails the
       job, so a wrapper bug can't hold the genLock forever. (`yue2-serve`'s
       `partial_failed` only exists for `n = 2` groups, which Mulakai never
       requests.)
     - `stage` is a free-text string. It becomes `Job.progressStage`, the
       same field ACE-Step's stage fills.
     - `progress` is an optional float from **0 to 1**, matching ACE-Step's
       and `fmtProgress`. `yue2-serve` sends none, only `stage` and token
       counts.
     - `error` is either a string or `{ code?, message }`; `yue2-serve`
       uses the object. Its message becomes the job's error.
   - *Audio and score*: available once the status is `succeeded` or
     `truncated` (`yue2-serve` answers 409 before that). The score's 404
     means "this engine has none", not a failure.
   - *Cancel*: fire-and-forget. A 404, or any other error, is ignored.
   - *Health*: 200 means ready. Anything else, including `yue2-serve`'s 503
     while loading, or no answer within 10 s, shows as not ready.
   - *Wrappers as built*: `heartmula-server/` follows this list. What it adds
     on top (the full job snapshot, error codes, the health body) is under
     "heartmula-server decisions" in the HeartMuLa section.

   **What `yue-server` pins down within that contract** (2026-09-30,
   `feat/yue-server`). These are its answers to the details above that
   leave room. Each matches `yue2-serve` unless it says otherwise, so a
   future wrapper can copy them:
   - *Submit*: 202 with the full job record and `Location:
     /v1/jobs/{id}`. The same `Idempotency-Key` with the same body returns
     the original job with 200; the same key with a different body is a
     409. The key is logged with the job. Other answers: 401 bad key, 422
     invalid body, 429 queue full, 503 not ready. 429 and 503 carry
     `Retry-After: 5`.
   - *Job record*: `{id, status, stage, progress, tokens: {abc, semantic},
     created_at, updated_at, started_at, finished_at, cancel_requested,
     result, error}`, timestamps in epoch seconds.
     - `stage` uses `yue2-serve`'s names: `queued`, `planning`, `semantic`,
       `synthesis`, `decode`, `saving`, `finished`. (Turbo also shows
       `claimed_waiting` briefly.) `GeneratingCard`'s `stageDetail` should
       learn these, not the method names `plan` / `synthesize`.
     - `progress` (wrapper-only) is the fraction of the **current stage**:
       ODE steps in `synthesis` and VAE chunks in `decode`. It is null in
       `planning` and `semantic`, whose length is unknown until they end;
       `tokens` counts there instead. It therefore restarts from 0 at each
       stage and is not an overall fraction.
     - `result` on `succeeded` / `truncated`: `{audio_url, score_url |
       null, audio_seconds, sample_rate, truncated: {abc, semantic},
       timing}`. The URLs are relative paths on the engine's base URL.
     - `error` on `failed`: `{code, message}`. The codes are
       `invalid_generation` and `inference_failed` (both servers), `timeout`
       (Turbo only), and `out_of_memory` (`yue-server` only).
   - *HTTP errors* use FastAPI's `{"detail": string}` (a list for 422), which
     is what `engineClient`'s `failure()` reads.
   - *Audio and score*: 404 also covers a job or artifact that has been
     cleaned up. `yue-server` keeps finished jobs for 24 h, and forgets them
     on restart.
   - *Health*: 200 `{"status": "ready"}`, or 503 with `{"status": "loading"
     | "failed"}`. `GET /health/live` is 200 while the process is up.
   - *Cancel* returns the job record. A queued job becomes `cancelled` at
     once. A running one stops at the next token, ODE step or stage
     boundary, and is reported `cancelled` only once the model is parked in
     RAM. A cancel that races completion wins. Cancelling a finished job
     changes nothing.
   - *Auth*: Turbo requires a key of at least 16 characters; the wrapper's
     is optional.
   - *Request body*: `yue-server` requires `seed`, and it also tolerates a
     body `id` and the `X-Admission-Id` header (both echoed back). Neither
     server takes blank `lyrics` safely: `yue2-serve` rejects them with a
     422, and on `yue-server` they still plan a vocal line. See
     "Instrumentals" in the YuE2 spike results.
4. **Server-side engine interface.** Each extra engine is a small module in
   `server/src/services/engines/` exporting:
   ```ts
   interface SongEngine {
     id: EngineId;                          // 'yue2' | 'heartmula'
     label: string;                         // 'YUE2'
     url: string; apiKey: string;           // from config; '' = disabled
     capabilities: EngineCapabilities;      // static — see 6
     toRequest(fields: CreateFields): Record<string, unknown>; // pure mapper; the job id rides as Idempotency-Key (3)
     readMeta(result: { score?: string }): SongMeta; // bpm/key/timesig, if the engine returns any
   }
   ```
   Health, submit, status, fetch-audio and cancel live in `engineClient.ts`,
   the same for every engine.
   - **ACE-Step is the built-in engine.** It contributes a capabilities
     descriptor and its existing health check to the registry, so the client
     sees one list. Its job flow stays in `jobs.ts`'s `startGeneration`.
   - *Rejected*: routing ACE-Step through the shared interface. Its
     generation path has several steps with no counterpart elsewhere: voice
     conditioning, the adapter reconcile, `resolveInferenceSteps`, TAKES,
     and lyric alignment. The interface would either lose those or grow to
     fit one engine, and this section should not churn a working, tested
     path.
5. **One job module for all extra engines, not a branch inside `jobs.ts`.**
   `jobs.ts` is already 300 LOC (the hard cap is 200), and its `poll()` is
   wired to ACE-Step's `queryResult`. The new `engineGenJobs.ts` exports
   `startEngineGeneration(engine, fields, title, folderId)`:
   - It reuses `Job`, `registerJob`, `run`, `wasAborted` and the `generate`
     genLock kind.
   - It runs its own poll loop against `engineClient`, with the same 3-strike
     rule for failed status requests.
   - `abortJob` stays generic. The loop sees the aborted status on its next
     tick and sends a best-effort `cancel`.
6. **A capabilities descriptor per engine drives the UI.** It is static per
   engine because it describes the model, not the deployment. It is served
   with live health from `GET /api/engines`:
   ```ts
   interface EngineCapabilities {
     duration: 'exact' | 'max' | 'none';    // ACE-Step exact; HeartMuLa a cap; YuE2 none
     musicalMeta: 'params' | 'style-text' | 'none'; // how BPM/KEY/TIME SIGNATURE reach it
     referenceAudio: boolean;               // voice / reference-audio picker
     adapters: boolean;                     // LoRA/LoKr (ACE-Step only)
     seed: boolean;                         // false = results are not reproducible
     languages: string[] | 'any';
     sectionTags: string[] | null;          // the engine's lyric section vocabulary, if it has a fixed one
     lmTools: boolean;                      // LM MODEL / THINKING / AI ENHANCE apply to *this generation*
     advanced: boolean;                     // ACE-Step's DiT knobs (STEPS, ADVANCED)
     takes: boolean;                        // TAKES / batch_size
     extraControls: ('cfg' | 'temperature' | 'topK' | 'cot')[];
     consequence: string;                   // the DESIGN.md inline consequence line
   }
   ```
   - The client disables each unsupported control **in place**, with an
     `n/a` readout and a one-line reason taken from the descriptor. It does
     not hide it. This is the same idiom as LM MODEL on the AUDIO tab.
   - `consequence` is shown under GENERATE (see each engine below). This is
     `AGENTS.md`'s "state the consequence before commit" rule, with the
     wording owned by whoever knows the engine.
7. **Split `persistSong` at the download.** Today `persistSong` does three
   things: it downloads through ACE-Step's `downloadAudio`, calls
   `fetchLyricTimestampsJson`, and then transcodes, tags and inserts rows.
   - The third part moves into `insertGeneratedSong(audio, meta, params, lyricTimestamps, title, folderId, referenceMeta)`
     in a new `songPersist.ts`.
   - ACE-Step's `persistSong` becomes download → timestamps →
     `insertGeneratedSong`.
   - The engine path becomes `engineClient` audio → `engine.readMeta` →
     `insertGeneratedSong`, with `lyricTimestamps = null`.
   - This moves ~50 LOC out of `jobs.ts`.
   - `transcodeBuffer` goes through ffmpeg, so it takes an engine's 48 kHz
     FLAC as-is. The "lossless master → the user's format, once" rule still
     holds.
   - `songs.duration` normally comes from ACE-Step's `metas`, which engines
     don't return. When no duration is supplied, it is read from the
     transcoded file with `node-taglib-sharp`, which `fileTags.ts` already
     depends on. There is still no separate server-side probing step.
   - Null timestamps mean **an engine-made song has no section strip**.
     Drag-to-select still works. Every non-ACE-Step consequence line says so.
8. **Recording the engine.**
   - `versions.params_json` holds the request actually sent, plus
     `engine: '<id>'`, `task_type: 'text2music'`, and the Create fields that
     didn't map. That keeps REUSE PROMPT and `backfillGenTask` working.
   - `songs.gen_task` stays `'text2music'`. It answers "which Create tab", so
     `taskToGenType`, `backfillGenTask` and `GenTask` in `genLock.ts` work
     unchanged.
   - **Recommended: a `songs.engine TEXT` column** (null means ACE-Step),
     added with `ensureColumn` in `server/src/db/`. It needs no backfill,
     since every existing song is ACE-Step. It is a column for the same
     reason `gen_task` was lifted out of params_json: the Library detail rail
     (GENERATED WITH → `PROMPT · YUE2`) and REUSE PROMPT read song
     rows, not versions. See Open questions for the case against.
   - `GenLockInfo` gets an optional `engine` (absent means ACE-Step, like
     `songs.engine`), so a rehydrated GeneratingCard and a retry reopen with
     the right engine.
   - *Rejected*: new `GenTask` values per engine. That would mix up "which
     tab" with "which model", and every `taskToGenType` consumer would need
     to learn each engine.
9. **ALT / SIMILAR on an engine-made base version are refused, as they are
   for an import.** `startRegenerate` and `startSimilarTake` rebuild an
   ACE-Step request from `params_json`. Replaying a HeartMuLa or YuE2 base
   version would quietly produce an ACE-Step song from a request shaped for
   another model.
   - `assertReplayable` refuses any `engine` other than ACE-Step.
   - `VersionHistory` hides ALT and SIMILAR on that version.
   - Versions that repaint (or any other Editor action) add to such a song
     are ACE-Step versions and replay normally.
10. **GPU: only one model in VRAM at a time. This is a requirement, not a
    tuning option.**
    - *Hardware*: the target machine is an RTX 4080 (Ada, compute capability
      8.9) with **16 GB** VRAM on Windows 11. About 1.3 GB is in use at idle,
      so roughly 14.5 GB is usable.
    - *Why it's a requirement*: no engine fits next to a resident ACE-Step
      in that space.
    - *What already holds*: `genLock` allows one generation at a time across
      all kinds, and an engine job holds it under `generate`. The lock does
      nothing about *resident* weights, though, so both sides have to move
      them out of VRAM:
    - **ACE-Step runs with CPU offload whenever any extra engine is
      configured.** Set `ACESTEP_OFFLOAD_TO_CPU=true`, documented as "Offload
      models to CPU when idle" at `docs/ace-step-1.5/API.md:751`. The finer
      `ACESTEP_OFFLOAD_DIT_TO_CPU` / `ACESTEP_LM_OFFLOAD_TO_CPU` flags
      (`:752`, `:762`) are there if the umbrella flag isn't enough.
      - This is ACE-Step *configuration*, not a modification, and Mulakai
        cannot set it at runtime.
      - `start-all.bat` launches ACE-Step itself, so it does set it
        (2026-09-30, `feat/start-heartmula`). Whenever `HEARTMULA_API_URL`
        or `YUE_API_URL` is set, or heartlib is found and HeartMuLa gets
        launched, it sets all three flags true in ACE-Step's process env.
        - All three, because the finer two default to false on their own,
          and the spike's ~0.53 GB idle figure was measured with all three
          on.
        - ACE-Step loads its `.env` with `override=False`, so the process
          env wins.
      - The README says so, and the Engines card shows a `.warn-note` while
        an extra engine is configured. Mulakai cannot read ACE-Step's
        startup env, so the note is a standing reminder, not a check.
      - Idle offload does hand the memory back. The spike measured ~0.53 GB
        held by an idle ACE-Step after a generation with the 4B LM, against
        15 GB plus 2 GB spilled with offload off (see "HeartMuLa spike
        results").
    - **Engine servers park their model in system RAM, not on disk.**
      System RAM is large (Windows reports 102 GB of shared GPU memory, which
      is half of RAM).
      - Each wrapper loads its weights once, to CPU.
      - For a job, it moves them onto the GPU.
      - After the job it moves them back to CPU and calls
        `torch.cuda.empty_cache()`.
      - Switching engines then costs a host → device copy, not a ~8–22 GB
        read from disk. Measured for HeartMuLa: ~1 s per model each way.
        Measured for YuE2: ~1.2–1.5 s to park, ~0.8 s to bring back.
      - *Rejected*: unloading to disk after each job. It is slower on every
        switch, for RAM this machine does not need to save.
    - **Windows driver trap.** When an allocation goes over budget, the
      NVIDIA driver on Windows spills into shared system memory instead of
      raising out-of-memory. Breaking this rule therefore shows up as a
      silent, severe slowdown, not an error. The READMEs recommend the user
      set **NVIDIA Control Panel → CUDA – Sysmem Fallback Policy → Prefer No
      Sysmem Fallback**, so a real OOM surfaces as a failed job. It is a
      system setting, so Mulakai documents it and never automates it.
11. **Client: the engine picker lives on the PROMPT tab only.**
    - *Not on the Library create bar*: the bar only captures an idea, and
      Quick Start's expansion runs on ACE-Step's LM whichever engine
      generates.
    - *The picker*: an ENGINE row at the top of the PROMPT tab, with one
      parallelogram per engine. The selected engine is **sky**, because it
      targets where the request goes. Acid stays with GENERATE.
    - The row **only renders when at least one extra engine is
      configured**, so a default install looks exactly as it does today.
      An engine that is configured but unreachable shows as disabled, with
      the reason inline.
    - *Where the choice lives*: on the Create draft (`createDraftStore`),
      defaulting to ACE-STEP. It survives a tab switch, CLEAR DRAFT resets
      it, and REUSE PROMPT sets it from `songs.engine`.
    - *Not a persisted app setting*: a sticky engine preference would
      quietly send the next Quick Start to an engine with fewer controls.
    - REFINE INPUT and FEELING LUCKY stay live for every engine. They are
      draft tooling that runs on ACE-Step, and they need ACE-Step up either
      way.
    - Engine-only settings (`cot`, `temperature`, `topK`, and a `cfg` whose
      range differs from ACE-Step's GUIDANCE) live in a small persisted
      `engineSettings.ts`, keyed by engine. They do not go in `settings.ts`,
      which is already 329 LOC.
12. **Settings: a read-only Engines card.** It has one row per engine, each
    READY, NOT CONFIGURED or UNREACHABLE. Each engine's license caveat is
    stated here once, where one exists. The header status pill stays
    ACE-Step-only.
13. **Routes.** A new `routes/engines.ts` is added because `generate.ts` is
    already 285 LOC.
    - `GET /api/engines` returns `[{ id, label, capabilities, configured, ready }]`,
      with ACE-Step included.
    - `POST /api/engines/:id/generate` takes the same Create field names the
      ACE-Step route takes, so the client builds the body from the same
      draft. Each engine's `toRequest` does the renaming server-side.
    - Polling reuses `GET /api/generate/:jobId`, because `registerJob` puts
      engine jobs in the shared map.

### Engine: HeartMuLa (ships second)

Sources: `github.com/HeartMuLa/heartlib`, arXiv 2601.10547, and the
HuggingFace org `HeartMuLa`. Researched 2026-09-30, then run on this
machine the same day; see "HeartMuLa spike results" below.

- **Model**: a 3B Llama-3.2-style LM with a 300M local decoder, plus
  **HeartCodec** (12.5 Hz, 8 RVQ codebooks, flow-matching decoder), producing
  48 kHz stereo. The org also publishes **HeartTranscriptor**, a
  Whisper-based lyrics ASR that outputs text only.
- **Pipeline inputs** (`src/heartlib/pipelines/music_generation.py`):
  | Input | Meaning |
  | --- | --- |
  | `lyrics` | section tags `[Intro] [Verse] [Prechorus] [Chorus] [Bridge] [Outro]` (the pipeline lowercases them) |
  | `tags` | comma-separated, **no spaces**, e.g. `piano,happy,wedding`. Categories: genre, timbre, gender, mood, instrument, scene, region, topic |
  | `max_audio_length_ms` | a **cap, not a target**: pipeline default 120000, CLI default 240000; the paper claims up to 6 minutes |
  | temperature, top-k, cfg | sampling (per the HF Space's `app.py`) |
- **Not supported**: no seed parameter; no bpm, key or time signature;
  reference audio raises `NotImplementedError`; no stems, repaint or
  continuation.
- **Languages**: zh, en, ja, ko, es.
- **Output**: one mixed 48 kHz stereo file, in whatever format the output
  file extension names. The float peaks run above full scale (1.12–1.33 in
  the spike), so the wrapper's FLAC should be float, or the audio limited
  before any lossy encode.
- **Runtime**:
  - Recommended: Python 3.10, torch 2.4–2.10, torchtune 0.4.0,
    transformers 4.57.0, ffmpeg.
  - The LM runs in bf16 and the codec in fp32 (bf16 degrades the codec's
    quality).
  - VRAM is not officially stated. Community reports: ~20 GB on a 3090 at
    about real time (issue #14), and a 12 GB 3060 working on Windows
    (issue #66). `--lazy_load` helps, as does splitting the LM and codec
    across GPUs.
  - RTF ≈ 1.0 per the README; the spike measured 1.04–1.09 on the 4080.
  - *At 16 GB* (see design point 10): it **needs** `--lazy_load` or an
    equivalent swap. With both models resident it silently spills and runs
    ~25x slower. With one model on the GPU at a time it peaks at ~14 GB
    total and runs at about real time.
- **Windows support is unofficial**, with open issues #7, #66 and #93
  (triton missing, `lazy_load` falling back to CPU). Native Windows worked
  in the spike, so WSL2 is not needed. `triton-windows` silences the triton
  message, and #66's CPU fallback did not reproduce.
- **Weights**: `HeartMuLa/HeartMuLa-oss-3B-happy-new-year` (~15.75 GB,
  recommended) + `HeartCodec-oss-20260123` (~6.64 GB) + `HeartMuLaGen`
  (tokenizer and config). That is ~22 GB on disk.
- **Serving**: there is **no HTTP server**, only a Gradio Space demo.
  → `heartmula-server/`, a thin FastAPI wrapper in the style of
  `demucs-server/main.py` that speaks the shared contract (design point 3).
  It runs one job at a time. The pipeline is a single call, so v1 reports
  `running` with no progress fraction; DESIGN.md already allows the plain
  shader without a progress veil. It has no `/score` route.
- **License**: Apache-2.0 for both code and weights, so commercial use is
  fine and the Settings card needs no caveat.
- **Out of scope: MuLaCover**, the cover model. Its weights are CC BY-NC and
  its outputs are non-commercial, and covers are ACE-Step's job here anyway
  (design point 1).

**Mapping** (`engines/heartmula.ts`):

| Create field | HeartMuLa | Notes |
| --- | --- | --- |
| PROMPT (caption) | `tags` | v1: split on `,` / `;`, trim, lowercase, and join the words inside a tag with `-`, so `dreamy synth pop` → `dreamy-synth-pop`. Newlines also split, and empty and repeated tags are dropped. The resulting tag string is shown read-only under PROMPT, so the user sees what is sent. A better caption → tag strategy is an open question. |
| LYRICS | `lyrics` | as-is. The descriptor's `sectionTags` lists HeartMuLa's six section tags. |
| DURATION | `max_audio_length_ms` | **a cap.** AUTO sends 240000 (the CLI default) so AUTO doesn't cut songs at the pipeline's 2 minutes. A set value is clamped to the wrapper's 10–360 s. The readout says MAX. |
| GUIDANCE | — | **not mapped** (changed 2026-09-30 in `feat/heartmula-engine`). The slider is ACE-Step's (0.5–15) and persists across engines, so a value tuned for ACE-Step would reach HeartMuLa far outside its range (default 1.5). HeartMuLa's own CFG engine control is used instead, as design point 11 describes. |
| CFG / TEMPERATURE / TOP-K (engine controls: `extraControls` `cfg`, `temperature`, `topK`) | `cfg_scale`, `temperature`, `topk` | AUTO (absent, or 0) omits them. A set value is clamped to the wrapper's ranges (1–10, 0.05–2, 1–1000), so it can't 422 the job. |
| RANDOM SEED / SEED | — | **no seed.** RANDOM SEED is shown locked on with "not reproducible", and `params_json` records `seed: null`. |
| BPM / KEY-SCALE / TIME SIGNATURE | — | disabled. HeartMuLa's tag vocabulary has no tempo or key category, so these are not smuggled into `tags` either. |
| VOCAL LANGUAGE | — | disabled; the lyrics' language decides. The descriptor lists zh / en / ja / ko / es. |
| reference audio / voice, adapter, TAKES, model / LM / STEPS / ADVANCED | — | disabled |

`readMeta` returns nothing, so `songs.bpm` / `key_scale` / `time_signature`
stay empty (see Open questions on filling them with `analyze_audio`).

**Consequence line**: "HeartMuLa · max length only, no seed, no reference
voice, no bpm/key control, no section strip · ~real time on an RTX 4080 · later
edits use ACE-Step".

#### HeartMuLa spike results (2026-09-30)

**Verdict: go, with caveats.** HeartMuLa runs on native Windows at about
real time without spilling, as long as its two models are never on the GPU
together. The raw logs, harness scripts, exact commands and audio are in
`S:\AI Gen\heartlib\spike\` (`RESULTS.md`, `COMMANDS.md`).

- **Setup**: `S:\AI Gen\heartlib`, heartlib commit `a18c8cb`, native
  Windows 11. Python 3.10.19 (uv venv), torch 2.6.0+cu126 (torchao 0.9.0
  was built for 2.6), torchtune 0.4.0, transformers 4.57.0, and
  `triton-windows` 3.2. The weights were 21 GB.
- **Install blockers**: none.
  - PyPI flags transformers 4.57.0 as yanked; it installs and works.
  - MP3 output works through soundfile (libsndfile 1.2.2), so no ffmpeg
    DLLs are needed.
- **Driver policy**: the spike ran with the default Sysmem Fallback Policy.
  It was not switched to "Prefer No Sysmem Fallback" as step 0 planned, and
  that is how the silent spill below showed up.

| Run | Audio | Wall time incl. load | RTF | Peak VRAM (nvidia-smi) | Spill (WDDM shared) |
| --- | --- | --- | --- | --- | --- |
| en, default (no lazy_load) | 120 s | ~57 min (estimated; stopped during decode) | ~28 | 16.0 GB, full; PyTorch peak 18.9 GB | **+4.1–4.4 GB, no error** |
| en, lazy_load | 120 s (hit the cap) | 128 s | 1.07 | 13.96 GB | none |
| es, lazy_load | 117 s (ended on its own) | 128 s | 1.09 | 13.95 GB | none |
| en with performance tags, lazy_load | 185 s (ended on its own) | 193 s | 1.04 | 13.98 GB | none |

- **Why the default spills**:
  - Both models resident take 13.5 GB.
  - On top of that, the LM's KV cache is preallocated for 8192 positions ×
    batch 2 (the CFG pair), about 5 GB, whatever the song length.
  - The LM slowed from 3.4 to 2.4 frames/s (real time is 12.5), and the
    codec ran at 51–56 s per flow step instead of about 2 s.
- **Stages under lazy_load**:
  - LM load 3.6 s, with a warm OS file cache.
  - LM ~70 ms per 80 ms frame, flat across the song. Peak 12.8 GB
    allocated.
  - Codec load ~3 s, then decode 16 s for 2 minutes or 24 s for 3 minutes.
    Peak 9.95 GB allocated.
  - `cfg_scale = 1.0` would halve the batch and the KV cache. It was not
    measured.
- **RAM parking** (`.to()` plus `empty_cache()`, 3 reps each):

  | Model | Size | GPU → CPU | CPU → GPU |
  | --- | --- | --- | --- |
  | LM (bf16) | 7.34 GB | 1.1–1.3 s | 1.0–1.3 s |
  | Codec (fp32) | 6.17 GB | 0.75–1.4 s | 0.6–0.8 s (2.6 s the first time) |

  - Swapping LM for codec takes 1.7–2.0 s, against ~7 s for lazy_load's
    reload from a warm disk cache.
  - Parked, PyTorch holds 0 GB, but the process keeps a ~0.2–0.25 GB CUDA
    context.
  - Pinned memory gave no gain.
- **Idle ACE-Step** (one 30 s text2music job with `thinking` on and the 4B
  LM, then idle):

  | ACE-Step setting | Idle VRAM held | Peak while generating | Spill |
  | --- | --- | --- | --- |
  | `ACESTEP_OFFLOAD_TO_CPU` / `_DIT_` / `_LM_` = true | ~0.53 GB | 9.2 GB total | none |
  | all offload = false | 15.0 GB, plus 2.07 GB spilled while idle | 15.8 GB total | +8.2 GB; DiT 5x slower per step |

  - Idle ACE-Step (0.53 GB) plus HeartMuLa's peak (~14 GB, desktop
    included) is about 14.5 GB, so switching engines under `genLock` fits.
    The two were not run side by side.
  - Offload costs ACE-Step ~7.5 s per job.
  - Note: the local ACE-Step `.env` sets `MAX_CUDA_VRAM=24`, so ACE-Step
    treats this 16 GB card as 24 GB (tier6b).
- **Requirements for `heartmula-server/`** that follow from these numbers:
  1. Never keep both models on the GPU. Keep both in RAM and move one at a
     time to the GPU: LM for the token loop, then codec for the decode.
  2. Hold no lingering Python reference to the LM. In the spike, a wrapped
     bound method kept the LM alive, so lazy_load's unload freed nothing and
     the codec spilled. The same thing would break parking.
  3. Park after every job (see Open questions).
  4. AUTO's 240000 ms cap is right: the 120 s cap cut the first English
     song short.
- **Not yet checked by ear**: whether the Spanish vocals are Spanish, and
  whether the ACE-Step performance tags (`[soft voice]`, `[guitar solo]`, …)
  are sung aloud or ignored. They did not cause any error.

#### heartmula-server decisions (2026-09-30)

Made while building `feat/heartmula-server`, which was written in parallel
with `feat/engine-framework`. Both filled design point 3's gaps from
`yue2-serve`'s source, and they agree. `heartmula-server/README.md` has the
full reference.

**Against design point 3's contract details:**

- **Job snapshot**: the whole `yue2-serve` record except its engine-specific
  extras (`tokens`, `admission_id`):
  `{id, status, stage, created_at, updated_at, started_at, finished_at, cancel_requested, result, error}`.
  - The times are Unix seconds.
  - `result` is
    `{audio_url, score_url: null, audio_seconds, sample_rate, gain_db, truncated, timing}`.
- **`Idempotency-Key`**: logged next to the wrapper's job id. The same key
  with the same body replays the original job (200). With a different body
  it is a 409, as in `yue2-serve`.
- **Failed jobs**: `error: {code, message}`. The codes are `yue2-serve`'s
  `invalid_generation` and `inference_failed`, plus `out_of_memory`, whose
  message points at ACE-Step's offload.
- **Cancelled jobs** have `error: null`. A cancel that arrives after the
  audio is written still ends the job `cancelled`.
- **Health**: `/health/ready`'s 503 body is `{"status":"loading"}`, or
  `{"status":"failed","error":…}` when the weights failed to load.
  `/health/live` exists too.
- **Auth**: the key is checked only when `HEARTMULA_API_KEY` is set, unlike
  `yue2-serve`, which always requires one. The server binds to 127.0.0.1
  by default.
- **Stages**: `queued`, `starting`, `generating`, `decoding`, `saving`,
  `finished`. There is no `progress`.
- **Jobs are in memory.** A restart forgets them, and the next poll is a
  404, which the 3-strike rule turns into a failed job.

**HeartMuLa specifics:**

- **Request fields keep heartlib's names**: `tags`, `lyrics`,
  `max_audio_length_ms` (default 240000, range 10000–360000), `cfg_scale`,
  `temperature`, `topk`.
  - `null` means heartlib's default, so AUTO omits the field.
  - The mapping table's "GUIDANCE → `cfg`" is `cfg_scale` on the wire, and
    "top-k" is `topk`.
- **Blank lyrics → 422.** heartlib indexes the first lyric token, so an
  empty lyric crashes it. HeartMuLa has no instrumental mode, and the
  engine-picker UI needs a guard like the one planned for YuE2.
- **A `tags` or `lyrics` value that is an existing file path → 422.**
  heartlib's `preprocess` would read that file and sing it.
- **`truncated`** means the LM hit `max_audio_length_ms` without emitting
  its end token, so the song is cut off. The spike's first English song hit
  this. It maps to Mulakai's done state, and the YuE2 `(truncated)` label
  idea can reuse it.
- **FLAC is 24-bit integer, not float.** FLAC has no float format:
  libsndfile rejects `FLAC` + `FLOAT`, which rules out the spec's "float
  FLAC" option.
  - Over-scale audio instead gets one static gain down to −0.1 dBFS. That
    means no clipping and no limiter coloring. `gain_db` reports the change.
  - The spike's 1.12–1.33 peaks become about −1 to −2.5 dB.
- **No progress fraction** (this answers the open question below). The
  per-frame hook exists, but the fraction would be an upper bound. `stage`
  is reported instead.
- **Cancel reaches into the LM loop.** A forward pre-hook on the backbone
  checks the flag once per 80 ms frame, and it is removed after every job.
  heartlib's code is not modified.
- **KV caches are dropped after every job.**
  - The finding: torchtune 0.4's `setup_cache` *skips* any layer whose
    cache already exists.
  - Without the drop, a long-lived server would reuse job 1's cache for
    every later job. That includes job 1's CFG batch size, which breaks a
    later `cfg_scale = 1.0` request.
  - It would also park ~5 GB of stale cache in RAM with the LM.
  - The one-job-per-process spike could not have seen this.
- **Parking uses `.to()` instead of heartlib's `lazy_load`**, which frees
  models with `del` and reloads them from disk.
  - `.to()` moves the tensors in place, so no lingering reference can pin
    them on the GPU (spike requirement 2).
  - heartlib's `preprocess` / `_forward` are used as-is. The wrapper decodes
    with `codec.detokenize` itself to get float audio back.
- **VRAM cap.** `set_per_process_memory_fraction` caps the process at the
  card's total minus 2 GiB (`HEARTMULA_VRAM_BUDGET_GB`), the same approach
  YuE2 takes.
  - HeartMuLa's reserved peak is 12.85 GiB whatever the song length.
  - Going over the cap is an `out_of_memory` failure, not a silent spill.
- **Default port 8003**, next to ACE-Step's 8001 and Demucs' 8002.
- **Verified end to end on the RTX 4080 (2026-09-30)**. The run went over
  HTTP against the real server, with ACE-Step idle (offloaded).
  - The weights load to RAM in 10.7 s, with a warm file cache.
  - A 30 s cap took 41.8 s. The next job, a 20 s cap at `cfg_scale 1.0`,
    took 25.8 s, which confirms the KV-cache rebuild.
  - A cancel sent 6 s into a job ended it at 9.8 s.
  - The card peaked at 15.2 GB total, from a 1.7 GB baseline (desktop plus
    idle ACE-Step). Nothing spilled, judging by the timings.
  - The server idles at ~0.3 GB between jobs.
  - A CPU-only run against the real model also passed the cancel and
    context-guard paths.

### Engine: YuE2 (ships first)

Sources: `github.com/multimodal-art-projection/YuE` (main),
HuggingFace `m-a-p/YuE2-3B`, and `github.com/NoizAI/YuE2-Turbo`. Researched
2026-09-30, then run in WSL2 on this machine the same day; see "YuE2 spike
results" below.

- **Model**: one AR–NAR model of ~3.58B params. It works in three steps: an
  ABC score plan → MERT2 semantic tokens at 25 Hz → flow-matched acoustic
  latents. An Oobleck VAE decodes those to 48 kHz stereo. The staged Python
  API is `plan()` → `generate_semantic()` → `synthesize()` → `decode()`.
- **Request** (`src/yue2/protocol.py`, `SongRequest`):
  | Field | Meaning |
  | --- | --- |
  | `style` (alias `tags`) | free-text style description |
  | `lyrics` | section-tagged (`[Verse]`, `[Chorus]`); languages en, zh |
  | `cot` | `'full'` \| `'melody'` \| `'off'` |
  | `seed` | default **831001**, a fixed value |
  | `abc` | a caller-supplied score (the "agentic editing" path) |
  | `cfg_scale` | 0–20 |
  | `id` | request id |
- **Not in the request**: reference audio, bpm, key, time signature,
  duration, negative prompt, edit interval. Tempo, key and meter can only be
  set through the ABC or the style text. Length follows the plan. The
  semantic `max_tokens` default is 9000, which is ~360 s at 25 Hz. That
  figure is inferred, not documented.
- **Output**: `audio.flac` (48 kHz, PCM_24, one stereo mix), plus
  `score.abc`, `plan.json`, and `result.json` (a `truncated` flag and
  timings). No stems. No lyric timestamps are documented.
- **Runtime**: Linux only. Python 3.12, torch 2.10.0, an NVIDIA BF16 GPU.
  - VRAM: 24 GB is the official figure; the measured peak is ~11–14 GiB.
  - Speed: an RTX 4090 renders a 215 s song in 71 s. The spike measured
    178 s of audio in 96 s on the 4080 (RTF 0.54).
  - Weights: 7.26 GB plus a 0.53 GB VAE.
  - `--quantization fp8` (compute capability ≥ 8.9) and `--offload-ar` exist
    but are experimental.
  - *At 16 GB*: it fits with the defaults. The spike's PyTorch peak was
    8.1 GiB (8.8 GiB with `cot=off`), or 10.2–10.9 GB on the card with the
    desktop included. Neither fp8 nor `--offload-ar` is needed, and fp8 is
    4.6x slower (see "YuE2 spike results"). The card's 14.08 GiB at maximum
    context was not reproduced; the longest song tried was ~3 minutes.
- **Windows is unsupported.** Open issue #209: on Windows the acoustic stage
  falls back to the MATH attention kernel, which is ~6x slower and uses
  ~7 GB more VRAM. On this machine that means **WSL2**, where the spike
  confirmed the fast path (FlashAttention with CUDA graphs).
- **Serving**: the official repo has **no HTTP server**, only a CLI
  (`yue2 doctor|generate|batch`). YuE2-Turbo (Apache-2.0) ships `yue2-serve`
  (FastAPI, bearer `YUE2_API_KEY`). Its job API is the one design point 3
  adopts as the shared contract. Turbo requires Linux x86_64 and CUDA 12.8,
  and is tuned for 32 GB cards.
- **License**: the code is Apache-2.0. The weights are CC BY-NC 4.0 plus a
  creator permission: individuals may use them and monetize the outputs, but
  companies need a license.

**Decisions specific to YuE2:**

- **Serving (recommended): a thin `yue-server/` wrapper around the *official*
  pipeline**, running in WSL2 and handling one job at a time. The staged API
  gives real stage progress (plan / semantic / synthesize / decode) for the
  progress veil. Cancel is a flag the wrapper checks between stages, since no
  stage can be interrupted mid-run.
  - *Alternative*: point `YUE_API_URL` straight at a `yue2-serve` instance.
    Because the wrapper speaks the same contract, this is a deployment choice
    and needs no code.
  - *Why not Turbo first*: it forks the model code (a third-party
    maintainer), it is tuned for 32 GB cards, and its CUDA 12.8 pin is one
    more thing to get working inside WSL2.
- **ABC score editing ("agentic editing") is out of scope.** It is
  score-level editing, which this plan excludes along with MIDI editing. The
  returned ABC is read once, for metadata. `abc` is never sent.
- **Covers via SheetSage2 transcription are deferred.** They are an open
  question and are not built. *Planned 2026-09-30*: see "YuE2 Melody
  Covers via SheetSage2".
- **ABC → song metadata** (`readMeta`). It reads the first `Q:`, `K:` and
  `M:` header lines of `score.abc`, stopping at the first body line, into
  `songs.bpm` / `key_scale` / `time_signature`. The same values go into the
  file tags.
  - `Q:1/4=120`, `Q:120` and `Q:"Allegro" 1/4=132` all yield the trailing
    number.
  - `K:Am` → `A minor` and `K:F#min` → `F# minor`. `K:C` and `K:Cmaj` →
    `C major`. Modal keys (`K:D dor`) are stored as written.
  - `M:` maps onto `songMeta.ts`'s numerator encoding: `4/4` → `'4'`,
    `M:C` → `'4'`, `M:C|` → `'2'`. An unknown meter is left empty rather
    than invented.
  - A missing or unparseable field is stored as null or empty.

**Mapping** (`engines/yue2.ts`):

| Create field | YuE2 | Notes |
| --- | --- | --- |
| PROMPT (caption) | `style` | |
| BPM / KEY-SCALE / TIME SIGNATURE | appended to `style` | e.g. `…, 92 bpm, A minor, 6/8 time`, only for fields not left on AUTO. This is a text hint, not a guarantee; what gets stored comes from the ABC. |
| LYRICS | `lyrics` | as-is. Empty LYRICS (instrumental) need a tags-only skeleton; see "Instrumentals" in the YuE2 spike results |
| GUIDANCE | `cfg_scale` | clamped to 0–20; AUTO omits it |
| RANDOM SEED / SEED | `seed` | **always sent.** YuE's default is the fixed 831001, so omitting it would return the same song for the same prompt every time. With RANDOM SEED on, the server picks a seed and records it. |
| COT (engine control) | `cot` | AUTO / FULL / MELODY / OFF; AUTO omits it |
| DURATION, VOCAL LANGUAGE, reference audio / voice, adapter, TAKES, model / LM / STEPS / ADVANCED | — | disabled |
| — | ~~`id`~~ | our job id, so both sides' logs can be matched. **Superseded 2026-09-30**: it is sent as the `Idempotency-Key` header instead, because `yue2-serve` rejects unknown body fields (see design point 3's contract details) |

**Consequence line**: "YuE2 · no duration control, no reference voice, no
section strip · ~95 s per 3-minute song on an RTX 4080 · later edits use
ACE-Step".
**Settings card license note**: "YuE2 weights: CC BY-NC 4.0 — individuals
may use and monetize outputs; companies need a license from the authors."

#### YuE2 spike results (2026-09-30)

**Verdict: go, with caveats.** The official pipeline runs in WSL2 on the
4080 at about half real time, with the default settings, without spilling.
The logs, harness scripts, exact commands and audio are in WSL at
`~/yue2/` (`RESULTS.md`, `COMMANDS.md`), reachable from Windows at
`\\wsl.localhost\Ubuntu-24.04\home\calvin\yue2\`.

- **Setup**: WSL2 (NAT networking, no `.wslconfig`), Ubuntu 24.04.5 with
  62 GB of RAM visible. YuE commit `18a07bb` (`yue2-infer` 0.1.6). Python
  3.12.3 (uv venv), torch 2.10.0+cu128, transformers 4.57.6. The Windows
  driver (596.21) provides CUDA inside WSL, and no Linux driver was
  installed. `yue2 doctor` reported the dependencies ready and saw the 4080
  as 15.99 GiB, compute capability 8.9. `--verify-hashes` downloaded the
  weights in 221 s.
- **Install blockers**: none in YuE2 itself. Getting WSL working took three
  tries:
  - Enabling Virtual Machine Platform needed a reboot.
  - A distro installed before that reboot never registered.
  - Ubuntu's first-run user setup then hung and locked up all of WSL,
    including `wsl --shutdown`. The fix was stopping the WSL service and
    creating the user as root (`wsl -u root`, `adduser`, `[user] default=`
    in `/etc/wsl.conf`). `yue-server/README.md` should carry this.
- **Driver policy**: the spike ran with the default Sysmem Fallback Policy,
  and nothing spilled. YuE2 caps its own PyTorch allocations at the card's
  total minus 2 GiB (`set_per_process_memory_fraction`, from `--budget`), so
  on its own it would hit out-of-memory before spilling.

One ~3-minute English request (`[Verse]` / `[Pre-Chorus]` / `[Chorus]` /
`[Bridge]` / `[Outro]`, seed 20260930) was generated in every run. The card
column includes ~1.17 GB for the Windows desktop.

| Run | Audio | Wall time | RTF | PyTorch peak (alloc / reserved) | Card peak (nvidia-smi) | Spill (WDDM shared) | Truncated | AR path |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| default (bf16, `cot=full`) | 177.6 s | 95.7 s | 0.54 | 8.09 / 8.69 GiB | 10.2 GB | none | no | CUDA graphs, flash |
| `--quantization fp8` | 189.8 s | 443.7 s | 2.34 | 7.89 / 9.75 GiB | 11.5 GB | none | no | eager, sdpa |
| `--offload-ar` | 177.6 s | 94.5 s | 0.53 | 8.09 / 8.69 GiB | 10.2 GB | none | no | CUDA graphs, flash |
| `cot=off` (two CFG branches) | 183.8 s | 82.5 s | 0.45 | 8.79 / 9.17 GiB | 10.9 GB | none | no | CUDA graphs, flash |

- **Stages (default run)**:
  - Pipeline start 3.9 s, of which 3.4 s is weight hashing, plus 2.8 s to
    load the model.
  - Score plan 17.9 s (1,673 tokens at 94 tokens/s).
  - Semantic tokens 46.8 s (4,442 tokens at 95 tokens/s).
  - Acoustic synthesis 20.9 s, VAE decode 7.2 s.
- **fp8 is not worth it here.** It turns CUDA graphs off
  (`graph_fallback_reason: fp8_not_graph_validated`), so the AR stages drop
  from ~95 to ~16 tokens/s. It saves only 0.2 GiB at peak, and synthesis
  reserves more, because the bf16 weights are restored for it. It also
  changes the sampling, so the same seed gives a different song.
- **`--offload-ar` changes nothing at this length.** The peak is in the
  semantic AR stage, which offload-ar does not touch. Its output was
  bit-identical to the default run's, so seeded runs are reproducible.
- **Why the peak is flat**: the AR KV cache is preallocated for the prefix
  plus `max_tokens` (9000), ~1.2 GiB for one branch and ~2.4 GiB for
  `cot=off`'s two, whatever the song length. Only the acoustic stage grows
  with length; see "Long songs" below.
- **RAM parking** (`.to()` plus `empty_cache()`, 3 reps):

  | Model | Size | GPU → CPU | CPU → GPU |
  | --- | --- | --- | --- |
  | AR/NAR model + VAE decoder (bf16) | 6.67 + 0.25 GiB | 1.2–1.5 s (4.9 s the first time) | 0.78 s (0.30 s from pinned memory) |

  - Parked, the card drops back to its idle baseline.
  - The pipeline already moves the model to CPU before the VAE decode and
    moves the VAE back after it, so after a job only the CUDA context
    (~0.6 GB) stays on the card. The next job brings the model back in
    ~0.8 s.
- **Windows → WSL**: a server bound to `0.0.0.0` or `127.0.0.1` inside WSL
  answers on Windows at `localhost` and `127.0.0.1`, and Node 22's `fetch`
  works. `[::1]` does not, because NAT-mode forwarding is IPv4-only, so the
  URL should be `http://127.0.0.1:<port>`. WSL does not start on its own,
  so the wrapper has to be launched through `wsl.exe`, by the user or a
  startup task.
- **Requirements for `yue-server/`** that follow from these numbers:
  1. Default flags: bf16, `torch` backend, default `--budget`, no fp8, no
     `--offload-ar`.
  2. Keep one pipeline alive between jobs, so hashing and loading happen
     once, and call `torch.cuda.empty_cache()` after each job.
  3. A job needs ~9 GiB of free VRAM, so ACE-Step must be idle and
     offloaded (~0.5 GB) while it runs. That holds under `genLock`.
- **Not yet checked**: listening to the songs and YuE2-Turbo. The plain
  pipeline leaves ~5 GiB free, but Turbo is a vLLM setup tuned for 32 GB
  cards.

**Follow-up checks (2026-09-30, same setup, default flags, seed 20260930;
rollout step 5's two open items).** The logs and requests are in
`~/yue2/logs/run_{instrumental_empty,instrumental_tags,long,long_cap}.log`
and `~/yue2/scripts/song_*.json`. The spill column of these runs is blank:
the Windows sampler's WDDM counter ID had changed since the spike. The
card peaks stayed ≤ 11.6 GB of 16, so there was nothing to spill.

| Run | Lyrics | Audio | Wall time | RTF | Plan / semantic tokens | PyTorch peak (alloc / reserved) | Card peak | Truncated |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| instrumental, empty | `""` | 170.0 s | 89.5 s | 0.53 | 1,307 / 4,250 | 7.96 / 8.62 GiB | 10.6 GB | no |
| instrumental, tags only | `[Intro]` `[Verse]` `[Chorus]` `[Verse]` `[Chorus]` `[Outro]` | 92.2 s | 50.0 s | 0.54 | 741 / 2,305 | 7.92 / 8.12 GiB | 10.4 GB | no |
| long (404 words, 92 BPM) | 12 sections | 294.9 s | 165.1 s | 0.56 | 2,491 / 7,374 | 8.47 / 8.93 GiB | 11.2 GB | no |
| near the cap (563 words, 80 BPM) | 18 sections | 346.0 s | 221.2 s | 0.64 | 3,890 / 8,650 | 8.93 / 9.36 GiB | 11.6 GB | no |

- **Instrumentals.** The pipeline accepts empty lyrics, but they do **not**
  give an instrumental. The ABC score plan still wrote a vocal melody in
  40 of 61 `V: Vocal` bars, so expect wordless singing. With **only the
  section tags** as lyrics, the vocal voice was rests in all 33 bars, and
  the instrumental voice had notes in 32. Upstream's own instrumental
  workflow (`skills/yue2-music/instrumental`) also uses "empty or exactly
  the score's section tags". This is read from the score, not from the
  audio; nobody has listened yet.
  - *Consequence for `feat/yue-engine`*: when LYRICS is empty, `toRequest`
    should send a tags-only skeleton (for example `[Intro]` / `[Verse]` /
    `[Chorus]` / `[Verse]` / `[Chorus]` / `[Outro]`, one per line). It
    should also add "instrumental, no vocals" to `style`. That also avoids
    `yue2-serve`, which rejects blank lyrics. No GENERATE guard is needed.
  - The tags-only take came out short (92 s). The tag count sets the
    length, so a longer skeleton gives a longer piece.
- **Long songs.** Neither long request was truncated. Songs end on their
  own near, but under, the caps: the near-cap run used 8,650 of 9,000
  semantic tokens (346 s of the ~360 s) and 3,890 of the planner's 4,096
  score tokens. So `truncated` needs lyrics longer than ~6 minutes of song,
  and the planner's 4,096-token score limit is about as close as the
  semantic one.
  - *Peak VRAM grows only in synthesis*, from 8.09 GiB at 178 s to
    8.93 GiB at 346 s allocated (9.36 GiB reserved), and 11.6 GB on the
    card. That is still ~4.4 GB under the 16 GB card, so the whole length
    range fits with the defaults.
  - *Speed*: RTF climbs from 0.54 to 0.64 at the cap. The longer prefix
    slows the AR stages (81 vs 95 tokens/s), and synthesis takes 58 s. A
    6-minute song takes ~3.7 minutes.

### Skipped: MiniMax Music 3

Considered 2026-09-30 and not planned:

- The download is ~57 GB.
- It needs ~22 GB of VRAM even with CPU offload, which would not fit this
  16 GB card at all.
- It needs Linux, CUDA 13 and torch 2.11, a third incompatible stack.
- No generation speed is documented.
- The local weights have no reference-audio input.
- The hosted API is closed to new users.
- Its license requires showing the "MiniMax-Music3" name in any commercial
  UI.

Revisit only if two or more of these change.

### Framework decisions (2026-09-30, `feat/engine-framework`)

The project owner confirmed these before PR 1. Each one also closes an open
question below.

- **`songs.engine` is a column**, as design point 8 recommends. Null means
  ACE-Step, and there is no backfill.
- **A `truncated` result is kept.** It is stored like `succeeded`, under the
  version label `first generation (truncated)`. The rail's `.warn-note`
  ships with the picker UI.
- **The score is persisted now.** When `/score` returns one, it is written
  next to the audio as `${versionId}.abc`, after `readMeta` has read it. A
  failed or missing score never fails the song. The sidecar is not served
  and nothing reads it yet. Every path that deletes a version's audio (a
  version, a non-base layer, a trashed song) goes through `versionFiles.ts`,
  so the sidecar is deleted along with it.
- **What an engine version records in `params_json`**: the Create fields
  under their Create names at the top level, then `engine`,
  `task_type: 'text2music'`, and `request`, the exact body sent to the
  wrapper. The top level has to keep Create names, because the Editor's
  history row reads `params.prompt`. Nesting the wire body keeps "what was
  sent" exact, without every engine declaring which fields it left unmapped.
  `versions.seed` is `request.seed` when the engine sent one, and `''`
  otherwise.
- **`CreateFields`** uses the ACE-Step route's names: `prompt`, `lyrics`,
  `bpm`, `key_scale`, `time_signature`, `vocal_language`, `audio_duration`,
  `guidance_scale`, `use_random_seed`, `seed` and `output`. The engine-only
  controls are named after `extraControls`: `cfg`, `temperature`, `top_k`
  and `cot`. A field that is absent means AUTO. The route takes JSON only,
  since no extra engine accepts reference audio.
- **Route errors**: an unknown engine id is a 404. `acestep` or an engine
  with an empty URL is a 400. A held genLock is a 409, as on
  `/api/generate`. A wrapper that is unreachable or refuses the job fails
  the job, not the request. This matches ACE-Step, whose submit also runs
  after the 202.
- `GET /api/generate/active` also returns the lock's `engine`, so a
  rehydrated GeneratingCard can say which engine is running.

### YuE2 engine decisions (2026-09-30, `feat/yue-engine`)

`engines/yue2.ts` (descriptor, `toRequest`), `engines/abcMeta.ts` (the ABC
`readMeta`) and the registry entry. Where these differ from the YuE2
mapping table above, they supersede it:

- **CFG is an engine-only control, not ACE-Step's GUIDANCE** (project owner,
  2026-09-30). The descriptor lists `extraControls: ['cfg', 'cot']`, and
  `cfg_scale` comes from `CreateFields.cfg`, clamped to 0–20, with AUTO
  omitting it. `guidance_scale` is never sent to YuE2. The two scales mean
  different things: YuE2's neutral value is 1.0 and it runs without CFG by
  default, while GUIDANCE is typically ~5–7. Since GUIDANCE is a persisted
  app setting, a value set for ACE-Step would otherwise silently apply heavy
  CFG to every YuE2 song. This supersedes the table's GUIDANCE row, and
  `engineSettings.ts` (picker UI) owns the CFG value.
- **Empty LYRICS become a tags-only skeleton**:
  `[Intro] [Verse] [Chorus] [Verse] [Chorus] [Outro]`, one tag per line.
  `instrumental, no vocals` is also added to `style`. Blank lyrics still
  plan a sung line, and `yue2-serve` rejects them outright. The end-to-end
  check (below) planned 0 of 49 vocal bars on a new seed, and ran 136 s.
- **Seed**: RANDOM SEED on, or absent, gives a fresh `crypto.randomInt(0,
  2^32)`. With it off, SEED is sent as a non-negative integer, and a negative
  or missing SEED is still random. The sent seed lands in `versions.seed`.
- **Style**: `PROMPT, [instrumental, no vocals,] <bpm> bpm, <key>, <meter>
  time`, each hint only when not AUTO. A meter is written out from
  Create's numerator (`'6'` → `6/8`). An empty result fails the job with
  "YUE2 needs a PROMPT", instead of the wrapper's bare 422.
- **Descriptor**:
  - `duration: 'none'`, `musicalMeta: 'style-text'`, `languages: ['en',
    'zh']`.
  - No reference audio, adapters, LM tools, ADVANCED or TAKES.
  - `sectionTags` lists the tags upstream documents plus those the spike
    sang: Intro, Verse, Pre-Chorus, Chorus, Bridge, Outro. It is not a
    closed vocabulary.
  - The consequence line is the one above.
- **The registry ships YuE2.** With `YUE_API_URL` unset it is listed as not
  configured and is never probed, so the picker UI's "render only if one is
  configured" rule still keeps a default install unchanged.
- **Stored metadata comes from the score, not the hints.** In the
  end-to-end run the style asked for "84 bpm, D minor". The plan chose
  `Q:1/4=85` and `K:D#m`, and the song stored 85 / `D# minor`, as the
  `readMeta` rules intend.
- The root `README.md` gets the two `YUE_*` rows, the ACE-Step offload
  requirement, the Sysmem Fallback recommendation and the license note. The
  HeartMuLa variables are documented with its engine, since until then they
  do nothing.
- **Verified end to end (2026-09-30)**: a Mulakai server with
  `YUE_API_URL` set drove `yue-server` in WSL through `engineClient`.
  `GET /api/engines` reported YuE2 as ready. The job's stage and
  per-stage progress reached `GET /api/generate/:jobId`. The song was
  persisted with `engine = 'yue2'`, a duration read from the file, and the
  `.abc` sidecar.

### Engine picker UI decisions (2026-09-30, `feat/engine-picker-ui`)

Design points 6, 11 and 12, made concrete. They are written against both
descriptors: YuE2's (#39) and HeartMuLa's (#38, open).

- **The engine is a draft field, used on the PROMPT tab only.** It lives in
  `createDraftStore` as `engine` (`'acestep'` by default). `load` sets it
  (REUSE PROMPT reads `songs.engine`, RETRY reads the draft), and CLEAR
  DRAFT resets it. It does not make a draft non-empty on its own: like a
  tab's model, it is a pick, not something typed. COVER and ARRANGE always
  generate on ACE-Step, whatever the draft says.
- **The engine list** comes from `GET /api/engines`. A small `engineStore`
  fetches it when Create or Settings mounts; it is not polled. The ENGINE
  row renders only when at least one extra engine is `configured`.
- **The picker** is a row of sky parallelograms: ACE-STEP first, then
  each configured engine. They are the `.tab` shape with a sky active
  state, because the pick targets where the request goes; acid stays
  with GENERATE. An engine that is configured but not ready is disabled,
  with the reason inline. If the *selected* engine is not ready, a
  `.warn-note` says so and GENERATE is disabled.
- **Gating** (`engineCaps.ts`, pure). Each unsupported control stays in
  place with an `N/A` readout and a one-line reason built from the
  descriptor:

  | Control | Rule |
  | --- | --- |
  | DURATION | `none` → N/A. `max` → readout `MAX Ns` (AUTO stays AUTO), with a "cap, not a target" note. |
  | BPM, KEY / SCALE, TIME SIGNATURE | `params` → live. `style-text` → live, with a note that they go in as style text, a hint and not a guarantee. `none` → N/A. |
  | VOCAL LANGUAGE | Live only for `languages: 'any'` (ACE-Step's `vocal_language` param). Otherwise N/A: "sings <langs>, following the lyrics". |
  | TAKES | N/A unless `takes`. |
  | AI ENHANCE badge and the lilac LM note | Shown only with `lmTools`. Otherwise the note says prompt and lyrics are sent as typed. |
  | REFINE INPUT, FEELING LUCKY | Stay live (draft tooling on ACE-Step, design point 11). |

- **The settings panel** (generate mode, PROMPT tab, extra engine) renders
  `EngineGenSettings` instead of the model / LM / STEPS / GUIDANCE /
  ADVANCED / REFERENCE AUDIO block:
  - One control per `extraControls` entry. CFG, TEMPERATURE and TOP-K are
    sliders where 0 means AUTO; COT is AUTO / FULL / MELODY / OFF.
  - The ranges are a client table per engine, because the descriptor has
    none. YuE2 CFG runs 0–20; HeartMuLa CFG 1–10, TEMPERATURE 0.05–2 and
    TOP-K 1–1000. The server clamps either way.
  - With `seed` on, the panel shows the same RANDOM SEED / SEED pair as
    ACE-Step, sharing its persisted values. A seed means the same thing
    everywhere, unlike GUIDANCE. With `seed` off, it shows a locked "not
    reproducible" note.
  - One line names the ACE-Step settings that don't apply.
- **`engineSettings.ts`** is a persisted zustand store keyed by engine
  (`cfg`, `temperature`, `topK`, `cot`, each null = AUTO). Its `engineFields`
  maps it to `CreateFields`.
- **GENERATE** on an extra engine posts `/api/engines/:id/generate` with
  the Create field names. It sends the song details, the seed pair, the
  output settings and the engine's own controls, but never GUIDANCE, the
  LM knobs or a reference voice.
  - The descriptor's `consequence` line sits under the button.
  - The adapter note becomes "adapter not applied — <ENGINE>".
- **The job card** maps the shared contract's stage names (`queued`,
  `planning`, `semantic`, `synthesis`, `decode`, `saving`) to labels. Its
  percentage is labelled as the stage's, because YuE2's `progress` restarts
  at every stage.
- **The Library rail** shows GENERATED WITH `PROMPT · YUE2`, and REUSE
  PROMPT's consequence line names the engine. **VersionHistory** hides
  ALT / SIMILAR on a version whose `engine` is set.
- **The Settings › Engines card** is read-only. It has one row per extra
  engine with READY / NOT CONFIGURED / UNREACHABLE and its env variable.
  The license note appears once per engine that has one, from a client
  table (YuE2's CC BY-NC 4.0). While any engine is configured, a
  `.warn-note` reminds you to run ACE-Step with `ACESTEP_OFFLOAD_TO_CPU=true`.
- **Not in this PR**: filtering the lyric-tag guide by `sectionTags` (still
  an open question), and HeartMuLa's tag preview (`feat/heartmula-engine`).
- **`generationStore.ts`** was already 217 LOC, over the cap. Its three
  near-identical `start*` actions fold into one helper first, in a separate
  `refactor:` commit, before engine routing is added.

### File-level plan

Shared (engine framework):
- `server/src/config.ts` — add `yueUrl` / `yueApiKey` and
  `heartmulaUrl` / `heartmulaApiKey`, next to `demucsUrl`.
- `server/src/services/engines/types.ts` — new. `SongEngine`,
  `EngineCapabilities`, `EngineId`, `CreateFields`, `SongMeta`.
- `server/src/services/engines/registry.ts` — new. Lists the configured
  engines, including ACE-Step's descriptor and health.
- `server/src/services/engineClient.ts` — new, ≤150 LOC. `health`,
  `submit`, `status`, `fetchAudio`, `fetchScore`, `cancel` against the shared
  contract. Sends the bearer header only when a key is set, and uses
  `acestep.ts`'s timeout pattern (the per-request ceiling, 5x for downloads).
- `server/src/services/engineGenJobs.ts` — new.
  `startEngineGeneration(engine, fields, title, folderId)`.
- `server/src/services/versionFiles.ts` — new. A version's files on disk
  (its audio plus an optional `${versionId}.abc` score sidecar), so every
  delete path removes both.
- `server/src/routes/versions.ts`, `server/src/routes/layers.ts`,
  `server/src/services/trashSweep.ts` — delete through `versionFiles.ts`.
- `server/src/services/songPersist.ts` — new. `insertGeneratedSong`,
  extracted from `persistSong`.
- `server/src/services/jobs.ts` — `persistSong` delegates to
  `insertGeneratedSong`, so the file gets smaller.
- `server/src/services/genLock.ts` — add `engine?: EngineId` to
  `GenLockInfo` (absent = ACE-Step).
- `server/src/services/replayGuard.ts` — new. `assertReplayable` moves out of
  `repaintJobs.ts`, which was already over the 200 LOC cap, and refuses any
  version whose `params_json` records an `engine`.
- `server/src/services/fileTags.ts` — `readAudioDuration`, the taglib read
  behind the duration fallback in design point 7.
- `server/src/routes/engines.ts` — new. `GET /api/engines` and
  `POST /api/engines/:id/generate`.
- `server/src/index.ts` — mount the router.
- `server/src/db/schema.ts`, `server/src/db/index.ts` — add `songs.engine`
  and its `ensureColumn`. `routes/songs.ts` already selects `s.*`, so the
  field reaches the client with no route change.
- `server/src/routes/songs.ts` — each version in the editor payload also
  carries `engine` (from `params_json`, null for ACE-Step), so
  `VersionHistory` can hide ALT / SIMILAR without parsing params itself.
- `client/src/api/generation.ts` — `engines()`, `generateWithEngine()`.
- `client/src/api/types.ts` — `Song.engine`, the lock's `engine`,
  `EngineInfo`.
- `client/src/createDraft.ts`, `createDraftStore.ts` — an `engine` draft
  field; `reusePromptDraft` carries it.
- `client/src/generationStore.ts` — `start()` routes to
  `generateWithEngine()` for any engine other than ACE-Step.
- `client/src/EngineChoice.tsx` — new. The ENGINE row: health gating, the
  reason line, and render-only-if-configured.
- `client/src/useEngineCaps.ts` — new. The selected engine's descriptor,
  plus an `unsupported(field)` → reason helper that every gated control
  reads.
- `client/src/CreatePromptTab.tsx` — renders `EngineChoice`; gates DURATION
  (MAX readout for `'max'`), BPM / KEY / TIME SIGNATURE, VOCAL LANGUAGE and
  TAKES on the descriptor; shows HeartMuLa's tag preview.
- `client/src/PromptGenerateRow.tsx` — shows the descriptor's consequence
  line.
- `client/src/EngineGenSettings.tsx` — new. Renders the descriptor's
  `extraControls` (CFG / TEMPERATURE / TOP-K / COT), SEED or the locked
  "not reproducible" note, and the `n/a` note.
- `client/src/SettingsPanel.tsx` — in generate mode with a non-ACE-Step
  engine, renders `EngineGenSettings` in place of the model / LM / steps /
  advanced / reference block.
- `client/src/engineSettings.ts` — new. A persisted zustand store keyed by
  engine.
- `client/src/ActiveAdapterNote.tsx` — "adapter not applied — <ENGINE>"
  when `adapters` is false.
- `client/src/VersionHistory.tsx` — the existing `replayable` check also
  excludes non-ACE-Step base versions.
- `client/src/SongDetailRail.tsx` — GENERATED WITH shows
  `PROMPT · <ENGINE>`.
- `client/src/GeneratingCard.tsx` — `stageDetail` learns YuE2's four stage
  names.
- `client/src/EnginesSection.tsx` — new, the Settings card.
  `SettingsView.tsx` renders it.
- `docs/design/DESIGN.md` — the ENGINE choice, the descriptor-driven `n/a`
  gating, the Engines card, and the consequence lines, committed in the same
  PR as the UI.
- `README.md` (in `feat/yue-engine`, not the framework PR: until an engine
  module exists, setting these variables does nothing) — env table rows for
  the four new variables, the "run
  ACE-Step with `ACESTEP_OFFLOAD_TO_CPU=true` when any engine is configured"
  requirement, the Sysmem Fallback Policy recommendation, and pointers to
  each wrapper's README.
- `AGENTS.md` (Scope Discipline) and `CLAUDE.md` (Tech Stack) — amend
  "generate with ACE-Step 1.5" to name the optional first-take engines, in
  the framework PR.

HeartMuLa:
- `heartmula-server/main.py`, `requirements.txt`, `README.md` — new.
  Covers the native-Windows setup (Python 3.10 venv, the pins above,
  ~22 GB of weights), the WSL2 fallback, the Sysmem Fallback Policy
  recommendation, and the ACE-Step offload requirement. The server parks
  each model on the CPU between stages and jobs (design point 10), in place
  of heartlib's `lazy_load`, and writes FLAC. Built 2026-09-30; see
  "heartmula-server decisions".
- `server/src/services/engines/heartmula.ts` — new. Descriptor,
  `toRequest` (caption → tags, duration → cap), and a no-op `readMeta`.

YuE2:
- `yue-server/main.py`, `requirements.txt`, `README.md` — new. Covers the
  WSL2 setup (Python 3.12 venv, torch 2.10.0, `yue2 doctor`), the
  staged-progress reporting, the cancel-between-stages flag, CPU parking
  between jobs, the fp8 / `--offload-ar` flags (off by default; the spike
  found fp8 4.6x slower), reaching the server from Windows at
  `http://127.0.0.1:<port>`, starting it through `wsl.exe`, and the WSL
  first-run hang workaround.
  - *As built (2026-09-30)*: split by responsibility to stay under 150 LOC
    each. `main.py` (FastAPI routes, auth), `request_model.py` (the submit
    body), `jobs.py` (the in-memory job table, FIFO queue, Idempotency-Key
    replay and artifact retention; 161 LOC, over the target), `worker.py`
    (the single inference thread and the staged run with its cancel
    checks), `yue_pipeline.py` (the only module importing torch / yue2),
    and `settings.py` (`YUE_*` env vars; default port 8004). The tests
    (`yue-server/tests/`, pytest) use a fake pipeline and need no GPU;
    `requirements-test.txt` installs just enough to run them.
  - `requirements.txt` pins `yue2-infer` to upstream commit `18a07bb` by git
    URL rather than vendoring it. `yue_pipeline.py` uses two private
    pipeline members (`_status` for step progress, `_model` / `_vae` to park
    after a cancelled or failed job), so they must be re-checked whenever
    that pin moves.
  - The model is parked **before** a job turns terminal, so Mulakai never
    releases `genLock` while YuE2 still holds VRAM.
- `server/src/services/engines/yue2.ts` — new. Descriptor, `toRequest`, and
  the ABC `readMeta`.

Tests (Vitest):
- `engineClient.test.ts` — mocked fetch.
  - The bearer header is sent only when a key is set, and our job id goes
    out as the `Idempotency-Key`.
  - Status mapping: queued / running → running; succeeded / truncated →
    done (see Open questions); failed / cancelled → failed.
  - Timeouts, and health is false when the server is unreachable or
    returns non-200.
- `engineGenJobs.test.ts` — uses a fake engine module.
  - The happy path persists `engine`, `gen_task = 'text2music'`, null lyric
    timestamps, and `readMeta`'s values.
  - The duration falls back to the file.
  - The genLock is held during the job and released after it.
  - The 3-strike poll rule applies, and an abort sends cancel.
  - `truncated` keeps the song under the `first generation (truncated)`
    label, and a returned score lands as the `${versionId}.abc` sidecar.
- `versionFiles.test.ts` — deleting a version, a layer, or a trashed song
  also removes a score sidecar, and a missing sidecar is not an error.
- `engines/heartmula.test.ts` — caption → tags normalisation (commas,
  semicolons, inner spaces, case, empties), AUTO duration → 240000, and
  dropped fields.
- `engines/yue2.test.ts`:
  - The style suffix is built only from fields not left on AUTO.
  - `seed` is always present and random when RANDOM SEED is on.
  - `cfg_scale` is clamped.
  - ABC cases: the three `Q:` forms, `K:` major / minor / sharp / modal,
    `M:6/8` / `C` / `C|` / an unknown meter, missing headers, and a header
    line after the body is ignored.
- The existing `jobs.test.ts` persist cases pass unchanged. They are the
  safety net for the `songPersist.ts` extraction.
- `repaintJobs.test.ts` — ALT / SIMILAR are refused on an engine-made base
  version.
- `createDraft.test.ts` — `reusePromptDraft` carries `engine`.
- Playwright (not set up yet; see `docs/AUDIT.md`): the golden path PROMPT +
  YUE2 → library → open in Editor → repaint a region on ACE-Step → a
  new version. It runs against a fake wrapper fixture that implements the
  shared contract, so CI needs no GPU.

### Rollout

0. **HeartMuLa spike (manual, before any PR)** on the RTX 4080 16 GB,
   with the Sysmem Fallback Policy set to "Prefer No Sysmem Fallback" so
   an overrun fails loudly.
   - Install heartlib on **native Windows** and try it both with and without
     `--lazy_load`.
   - Time one ~3-minute song and record its peak VRAM.
   - Measure how much VRAM an idle ACE-Step still holds with
     `ACESTEP_OFFLOAD_TO_CPU=true`.
   - Time the CPU ↔ GPU weight swap in both directions.
   - Try lyrics that use ACE-Step-style performance tags.
   - If native Windows fails, repeat in WSL2.

   Write the numbers into this section. If HeartMuLa doesn't fit, stop here;
   nothing else has been built.

   **Done 2026-09-30: go, with caveats.** See "HeartMuLa spike results". All
   items were covered on native Windows. The exception is the Sysmem Fallback
   Policy, which stayed at the driver default.
0b. YuE2: a WSL2 spike like step 0 (also try empty lyrics, and note whether
   `truncated` shows up at the default `max_tokens`).

   **Spike done 2026-09-30: go, with caveats.** See "YuE2 spike results".
   `truncated` did not show up at the default `max_tokens` for ~3-minute
   songs. Empty lyrics were not tried.

   **Both open checks done 2026-09-30** (see the follow-up checks under
   "YuE2 spike results"). Empty lyrics run but still plan a vocal line;
   tags-only lyrics give an instrumental score. A 346 s song, 96% of the
   cap, was not truncated, and it peaked at 11.6 GB on the card.

**Reordered 2026-09-30: YuE2 ships first** (see "Engine order"). The PRs
below replace the original order, which was framework → HeartMuLa server →
HeartMuLa engine → picker UI → YuE2 server and engine. The server-side
pieces are server-only and ship dark; the client files in the file-level
plan all belong to step 4.

1. `feat/engine-framework` — the `songPersist` split as its own first
   `refactor:` commit, then the interface, registry, `engineClient`,
   `engineGenJobs`, routes, `songs.engine`, the ALT guard, the score
   sidecar (`versionFiles.ts`), and the `AGENTS.md` / `CLAUDE.md`
   amendment. No engine module exists yet, so `GET /api/engines` lists only
   ACE-Step and nothing changes for the user.
2. `feat/yue-server` — the WSL2 wrapper and its README. It is built in
   parallel with step 1, against design point 3's contract details.
3. `feat/yue-engine` — `engines/yue2.ts` (descriptor, `toRequest`, ABC
   `readMeta`), its registry entry, and tests. Once this lands a configured
   `YUE_API_URL` generates through the API, but there is still no UI for it.
4. `feat/engine-picker-ui` — the Create picker, descriptor gating, the
   Engines card (with YuE2's license note), `GeneratingCard`'s YuE2 stage
   names, `VersionHistory`'s ALT / SIMILAR hiding, and `DESIGN.md` (its own
   commit). It is exercised against YuE2, so the `'max'` duration readout
   and the `seed: false` lock are built from the descriptor but only
   unit-tested until HeartMuLa lands.
5. `feat/heartmula-server` — the wrapper and its README.
6. `feat/heartmula-engine` — the engine module, mapping, and tests, plus its
   one piece of engine-specific UI: the read-only tag preview under PROMPT
   (`CreatePromptTab.tsx`, and a `DESIGN.md` note if it needs one).
   Everything else is already driven by the descriptor.

### Open questions

General:
- **Does ACE-Step's idle offload actually free the VRAM?**
  `ACESTEP_OFFLOAD_TO_CPU` moves the models, but PyTorch's caching allocator
  may keep the blocks reserved, and ACE-Step isn't ours to patch with an
  `empty_cache()`. Step 0 measures this. If the memory is not freed, the
  fallback is running only one of the two processes at a time, which would
  have to be documented and is clumsy.
  - **Answered (2026-09-30): yes.** An idle ACE-Step holds ~0.53 GB with
    offload on. Both processes can stay up, so the fallback is not needed.
- **Engine-side swap policy.** Is moving to CPU after every job right, or
  should a model stay on the GPU for a short idle window (for example 2
  minutes) when several takes are generated in a row on the same engine?
  That is only safe if ACE-Step's offload is proven to free its memory.
  Every speed figure above comes from other GPUs; the spikes give the 4080
  numbers.
  - **Answered for HeartMuLa (2026-09-30): park after every job.** An idle
    window would save only 1–2 s per take, since a swap takes ~1 s per
    model. It would also leave the 7.3 GB LM resident, and that plus
    ACE-Step's 9.2 GB generation peak does not fit in 16 GB. Revisit for
    YuE2 after its spike.
  - **Answered for YuE2 (2026-09-30): park after every job too.** Bringing
    the model back takes ~0.8 s, and the pipeline already parks it during
    the decode. A resident 6.9 GiB model plus ACE-Step's 9.2 GB peak would
    not fit either.
- **Engine column vs params_json only.** The column is recommended (design
  point 8). The case against: params_json already records `engine`, and a
  column is one more migration for a value that only two readers use.
  Confirm before PR 1.
  - **Answered (2026-09-30): the column.** See "Framework decisions".
- **Compare engines (future idea, not planned).** Generate one prompt on
  several engines and keep each result as a Base-layer version of the same
  song. It fits the version model, but it is a batch across engines, and
  genLock would run the parts one after another.
- **Section strip for engine-made songs.** There are no lyric timestamps.
  The fork's `/lyric_timestamp` reads audio from ACE-Step's own filesystem.
  Could it take an upload instead? If not, the stable-ts to-do under "Open
  Questions For Later Phases" would cover it.
- **Fill missing bpm / key with `/v1/analyze_audio`** after an engine
  generation? It would populate the song's metadata (HeartMuLa returns
  none), but it adds an ACE-Step call to every engine job and would state
  guesses as facts.
- **Lyric tag vocabulary per engine.** HeartMuLa has six section tags,
  YuE2 uses `[Verse]` / `[Chorus]`, and Mulakai's tag guide and probe use
  ACE-Step's vocabulary, including performance tags like `[soft voice]`.
  Does each engine ignore unknown tags, sing them, or fail? Should the tag
  guide popover filter by the descriptor's `sectionTags`?
  - *HeartMuLa, partly answered (2026-09-30)*: performance tags do not fail
    (`en_perftags_lazy.mp3` in the spike folder). Whether they are sung or
    ignored still needs a listen.

HeartMuLa:
- **Caption → tags strategy.** The v1 normalisation is mechanical. Options:
  a tag picker built on the "Style Tag Vocabulary for the Caption Field"
  work, or an ACE-Step LM rewrite into HeartMuLa's eight categories.
  Decide after hearing how v1 tags perform.
- **HeartTranscriptor** as an extra lyrics-from-audio helper, for example
  for imports with no lyrics? It would be a second ASR path next to the
  stable-ts to-do. Not planned.
- **Progress fraction after all?** The spike found the LM stage loops one
  80 ms frame at a time, so the wrapper *could* report `frames / (cap / 80)`
  plus a codec step. That is an upper-bound fraction, because the song can
  end before the cap. v1 keeps "no progress fraction" unless this is picked
  up in `feat/heartmula-server`.
  - **Answered (2026-09-30): not picked up.** The wrapper reports `stage`
    only. A fraction that jumps from ~60% to done whenever a song ends
    early would mislead more than it helps.

YuE2:
- **Is WSL2 viable, and how fast is it?** Answered by its spike.
  - **Answered (2026-09-30): yes.** RTF 0.54 (~95 s for a 3-minute song),
    10.2 GB peak on the card, no spill, and the fast attention path. See
    "YuE2 spike results".
- **Wrapper vs Turbo.** Revisit after the spike. Switching is a deployment
  change and needs no code.
  - *Leaning wrapper (2026-09-30)*: the official pipeline already runs the
    AR stages with CUDA graphs and FlashAttention at ~95 tokens/s on the
    4080. Turbo was not tried.
- **Persist `score.abc`?** Leaning yes: store it as a `${versionId}.abc`
  sidecar. It is tiny, it cannot be recovered later, and anything
  score-aware in the future needs it. Against: nothing reads it yet, and
  ABC editing is out of scope.
  - **Answered (2026-09-30): yes, from PR 1.** See "Framework decisions".
- **Covers via SheetSage2**: this needs its own dated section if it is ever
  wanted.
  - **Answered (2026-09-30):** it has one, "YuE2 Melody Covers via
    SheetSage2", starting with a spike.
- **`truncated` results.** A plan longer than the semantic `max_tokens` gets
  cut off. The v1 leaning is to keep the song, label its version
  `first generation (truncated)`, and show a `.warn-note` in the rail.
  The alternative is to fail the job.
  - *Not seen in the spike (2026-09-30)*: none of the four ~3-minute runs
    was truncated. A ~3-minute song used ~4,500 of the 9,000 semantic
    tokens.
  - *Near the cap (2026-09-30)*: a 346 s song used 8,650 semantic tokens
    and 3,890 of the 4,096 score tokens, and was not truncated either.
    Truncation is rare in practice: it needs lyrics for more than ~6
    minutes. That fits the keep-and-label decision below. `yue-server`
    serves the audio for `truncated` jobs, as `yue2-serve` does.
  - **Answered (2026-09-30): keep it, with the label.** See "Framework
    decisions".
- **Should ALT on a YuE2 base version resubmit to YuE2** instead of being
  refused (design point 9)? The same question applies to HeartMuLa, but
  HeartMuLa has no seed, so a resubmit would only produce a new take.
- **Instrumental (empty lyrics)**: is it supported? If not, GENERATE needs
  a guard for YuE2.
  - *Partly answered (2026-09-30), from source*: `yue2-serve` rejects blank
    `lyrics` (and blank `style`) with a 422, so on Turbo the answer is no.
    The official pipeline behind `yue-server/` was not tried.
  - **Answered for the official pipeline (2026-09-30): yes, through
    tags-only lyrics, not empty ones.** Empty lyrics run, but the planner
    still writes a vocal line. Tags-only lyrics plan no vocal notes, and
    they are not blank, so Turbo accepts them too. `toRequest` should map
    empty LYRICS to a tags-only skeleton, so no guard is needed. See the
    follow-up checks under "YuE2 spike results". Still to confirm by ear.
- **Languages other than en / zh**: hard-block them or only warn? VOCAL
  LANGUAGE is disabled either way, but nothing stops the lyrics themselves
  from being in another language.

## Text2music Reference Audio: Style Influence Only (planned + implemented 2026-09-30)

Upstream `c86889f` (#1305) resets `audio_cover_strength`/`cover_noise_strength`
to neutral (1.0/0.0) whenever the resolved task is `text2music`
(`generate_music_request.py`, `_neutralize_cover_only_params`), to stop stale
Remix state producing noise (#1271). Our PROMPT tab maps the reference-audio
AUDIO INFLUENCE slider straight onto `audio_cover_strength`
(`voiceConditioning.ts`), so for text2music that slider is now a guaranteed
no-op. It was close to one before, too: in text2music the parameter only
switches between two near-identical text conditionings partway through
diffusion (`conditioning_text.py`), never touching the reference timbre.

### Decisions

- **Hide AUDIO INFLUENCE on PROMPT (text2music); keep STYLE.** Style still
  scales an explicit `guidance_scale`. The picker's hint shows style only.
- **Stop sending and recording it for text2music.** `startGeneration` applies
  style only and persists `reference_audio_influence = null`; the Library rail
  prints whichever influences were recorded, so older songs still show both.
- **Add Layer (`lego`) is unchanged.** Upstream explicitly leaves the param
  live for every non-text2music task.
- **Out of scope: ARRANGE (`complete`).** Its picker still shows both sliders
  and percentages although `referenceAudioResolve.ts` never remaps them — a
  pre-existing gap, not caused by this upstream change; separate fix.

### File-level plan

- `server/src/services/voiceConditioning.ts` — extract `applyStyleInfluence`;
  `applyVoiceInfluence` composes it.
- `server/src/services/jobs.ts` — `startGeneration` uses style only, null audio
  influence in the reference meta.
- `server/src/services/{jobs,voiceConditioning}.test.ts` — updated/new cases.
- `client/src/ReferenceAudioPicker.tsx` — hide AUDIO slider for text2music.
- `client/src/SongDetailRail.tsx` — render recorded influences independently.

## COVER and ARRANGE Reference Audio: No Influence Sliders (planned + implemented 2026-09-30)

Follow-up to the text2music section above, which left ARRANGE (`complete`)
out of scope. The Create view's REFERENCE AUDIO picker still showed AUDIO and
STYLE INFLUENCE on ARRANGE, with a hint promising "audio X% / style Y%", but
neither value is ever applied there: `CreateArrangeTab.tsx` doesn't send them,
`generate.ts` records label-only reference meta (`labelOnlyReferenceMeta`),
and `referenceAudioResolve.ts` treats a saved voice as raw bytes for
cover/complete. Two dead controls. COVER had the same pair, shown with a
"the sliders above don't apply here" disclaimer — dead controls with an
apology attached.

### Decisions

- **Hide both sliders on ARRANGE.** Complete has no established mapping from
  either influence to an ACE-Step param, so there's nothing to show; the hint
  reads "— used as-is; ARRANGE has no influence controls" instead of
  percentages.
- **Hide both sliders on COVER too.** Cover's closeness to the source is
  VARIANCE's job (its own `audio_cover_strength`); the hint now reads
  "— used as-is; VARIANCE controls closeness to the source track".
- **AUDIO INFLUENCE leaves the Create picker entirely.** With text2music
  already style-only, no Create task shows it; the slider stays in Add
  Layer's `VoicePicker`, where `lego` still applies it.
- **No server change.** The server already ignores and nulls both influences
  for cover/complete — the bug was the UI promising otherwise.
- **Per-task rules move to a pure module** (`referenceInfluence.ts`) so
  they're unit-testable without a DOM test harness, which the client
  doesn't have.

### File-level plan

- `client/src/referenceInfluence.ts` — new: `showsStyleInfluence(taskType)`,
  `influenceHint(taskType, style)`.
- `client/src/referenceInfluence.test.ts` — new: per-task cases.
- `client/src/ReferenceAudioPicker.tsx` — renders from the helpers; the
  AUDIO INFLUENCE slider is removed.

## Upstream Sync: `complete`/`lego` Skip the LM (planned + implemented 2026-09-30)

Upstream `main` moved again (15 commits, 2026-08-16 → 08-29). The one that
changes Mulakai's behaviour is `14c0211` (#1287): `complete` and `lego` join
`cover`/`repaint`/`extract` in `DIRECT_CONDITIONING_TASKS`
(`acestep/inference.py:36`), so the in-generation LM stage — THINKING's audio
codes and the `use_cot_*` rewrites — is now skipped for them. Before, THINKING
on a `complete` made the LM write codes from text alone, which then pre-empted
the source audio entirely ("Audio codes provided, ignoring src_audio"), so the
change is a fix, but it leaves three of our controls and one comment stale.

### Decisions

- **`use_format` (AI ENHANCE) is unaffected.** It runs in the API layer
  (`llm_generation_inputs.py:149`, `format_sample()`) before `generate_music`,
  so it still rewrites caption/lyrics for `complete`. ARRANGE keeps AI ENHANCE
  and the LM MODEL picker; only THINKING MODE is hidden there.
- **Add Layer hides its ADVANCED LM sliders.** It never sent `thinking` or
  `use_format`, so the LM only ever ran for `lego` via the API's
  default-true CoT flags — which are now skipped. Every LM slider there is
  inert; the Editor's advanced block now hides them for both repaint and Add
  Layer.
- **`ensureModelLoaded` stops counting `thinking` for `lego`/`complete`.** It
  still honours `use_format` and an explicit LM pick (format needs a loaded LM),
  so this only saves an LM init for THINKING-on/AUTO-LM runs. `thinking` is left
  in the recorded params — it is what was requested, and dropping it would make
  old/new takes' params diverge for no user-visible gain.

### File-level plan

- `server/src/services/jobs.ts` — `thinkingIgnored` alongside `lmIgnored`.
- `server/src/services/jobs.test.ts` — LM-init cases for `lego`/`complete`.
- `server/src/services/completeGenJobs.ts` — header comment.
- `client/src/SettingsPanel.tsx` — `hideThinking` prop; Editor mode always
  passes `hideLmControls` to `AdvancedGenSettings`.
- `client/src/CreateView.tsx` — pass `hideThinking` for ARRANGE.
- `client/src/CreateArrangeTab.tsx` — header comment.

### Open questions

- Upstream calls this an interim workaround; the root fix is feeding
  `src_audio` to the LM before it writes codes. If that lands, THINKING on
  ARRANGE becomes meaningful again — revisit then.

## YuE2 Melody Covers via SheetSage2 (planned 2026-09-30)

Picks up the deferred item under "Engine: YuE2" ("Covers via SheetSage2
transcription are deferred"). The user asked whether YuE2 can make a cover
or use a reference voice. What upstream offers, checked 2026-09-30:

- **YuE2 has no audio prompt.** `yue2 generate` takes `--style`, `--lyrics`,
  `--seed`, `--cfg-scale`, `--cot` and `--abc-file`, and nothing else that
  conditions the song. `yue2-infer` 0.1.6 has no reference-audio or voice
  path.
- **YuE2's cover path is a score, not audio.** Upstream's `docs/covers.md`:
  transcribe the source with [SheetSage2](https://huggingface.co/m-a-p/SheetSage2)
  (`infer.py source.wav --output cover-score --melody-only`), review the
  ABC it writes, then generate with that ABC, `cot="melody"`, new lyrics
  and a target style.
  - `yue2.protocol.SongRequest` has an `abc` field. An external ABC skips
    the planning stage, and needs `cot` `melody` or `full`
    (`protocol.py:99`).
  - With `melody`, the score has no chord symbols, so the accompaniment is
    free to follow the new style.
- **A cover keeps the melody only.** The source singer's voice, the
  arrangement and the sound are not carried over. This is a different
  thing from ACE-Step's COVER, which regenerates the audio itself.
- **YuE v1's in-context learning is not this plan.** The `YuE-v1` branch
  has `--use_audio_prompt` / dual-track prompts: a ~30 s clip steers the
  style of a new song. It needs the 7B `-icl` stage-1 checkpoint plus the
  1B stage 2, upstream quotes ~360 s per 30 s of audio on an RTX 4090, and
  it carries style rather than a cloned voice. That would be a third
  engine with its own venv and ~10+ GB of weights, for a song that takes
  30+ minutes. Not planned; raise it separately if wanted.
- **MuLaCover stays out of scope** (see "Engine: HeartMuLa").

### What SheetSage2 is

- 57.2M parameters, weights **CC BY-NC 4.0**, the same terms class as the
  YuE2 weights. The model card says access needs a Hugging Face login.
- Python 3.10/3.11, torch 2.8.0 / torchaudio 2.8.0, FFmpeg 6.1 with shared
  libraries. That conflicts with YuE2's venv (Python 3.12, torch 2.10), so
  it gets its own. Ubuntu 24.04's packaged FFmpeg is 6.1, so it goes in
  WSL next to YuE2.
- Input: any FFmpeg-readable audio, mono or stereo, whole songs (windowed).
- Output in `--output`: `score.abc` (melody, and chords unless
  `--melody-only`), `transcription.mid`, `melody_vocal.mid`,
  `melody_instrumental.mid`, `chords.mid`, `events.json`, `*.lab`.
  `--render-audio` adds a piano preview.
- The model card does not say whether the ABC carries section markers or
  lyric slots. The spike answers that.

### Decisions

1. **Only COVER gets it, as an engine choice.** Create › COVER gains the
   same sky ENGINE row as PROMPT, offering ACE-STEP and YUE2. It extends
   "Engine picker UI decisions", where COVER always ran on ACE-Step.
   - The row appears only when YuE2 is `ready` *and* its transcriber is
     available (point 8). HeartMuLa never appears here: it has no score
     input.
   - The engine pick is per tab: `draft.audio.engine`, separate from the
     PROMPT tab's `engine`, so choosing YUE2 on COVER never changes what
     PROMPT generates on.
   - ARRANGE stays ACE-Step-only.
2. **Two steps, transcription first.** On YUE2 the tab reads SOURCE →
   TRANSCRIBE → review → GENERATE.
   - TRANSCRIBE runs SheetSage2 on the source (the upload as-is, or the
     library song's bounced mix, the same `resolveSrcAudio` as today).
   - Upstream says transcription errors carry into the cover, so there is
     a review point before the ~95 s generation, not one chained click.
   - One transcription serves any number of covers: changing the style,
     lyrics or seed does not re-transcribe.
3. **Review is listen-and-read, not edit.** ABC score editing stays out
   of scope ("Engine: YuE2").
   - The review panel shows the header facts (tempo, key, meter), the bar
     count and the length, and plays SheetSage2's `--render-audio` piano
     preview through `AudioPreview`.
   - The ABC text is in a collapsed, read-only block.
   - **USE .ABC FILE** replaces the transcription with a file you fixed in
     an outside editor. That is the one way to correct a score, and it
     keeps an editor out of Mulakai. The file goes through the same
     server-side checks (point 6).
   - Changing the source clears the score.
4. **Lyrics are the user's job, seeded where possible.**
   - A library source seeds LYRICS from that song (same words, new style),
     and says so in a hint.
   - An upload leaves LYRICS as typed. The hint says the words should
     match the melody's phrasing and syllable counts (upstream's rule).
   - Empty LYRICS makes an instrumental cover through the existing
     tags-only skeleton and "instrumental, no vocals" style, *if* the
     spike shows YuE2 still follows the score's melody that way. If not,
     GENERATE requires lyrics.
   - Lyric transcription (words from the source) is out of scope.
5. **What the request carries.** `buildYue2CoverRequest(fields, abc)`
   extends `buildYue2Request`: the same `style`, `lyrics`, `seed` and
   `cfg_scale` mapping, plus `abc`, and `cot` forced to `melody`.
   - The COT control is hidden on COVER: `off` is invalid with a score,
     and `full` keeps chord symbols the `--melody-only` score doesn't have.
   - BPM / KEY / TIME SIGNATURE are N/A with the reason "follows the
     source score". The score fixes them, and style-text hints would argue
     with it.
   - DURATION stays N/A: length follows the score.
6. **yue-server accepts `abc`, with limits.** `GenerateRequest` gains
   `abc: str | None` (max 64 KB, must be non-blank, `cot` must not be
   `off`, so a bad pair is a 422 here, not a failed job).
   - That walks back the docstring's "minus `abc`", and only for this
     flow. Mulakai sends `abc` only from COVER, and only text that came
     out of a transcription or a user's `.abc` file.
   - The spike records how long a score YuE2 accepts. If a long song's ABC
     overruns the semantic cap, the result already comes back as
     `truncated` and is kept (see "YuE2 engine decisions").
7. **SheetSage2 runs inside yue-server, as a second job kind.**
   - It is a subprocess of yue-server, run from its own venv:
     `YUE_SHEETSAGE_PYTHON` (e.g. `~/sheetsage2/.venv/bin/python`) and
     `YUE_SHEETSAGE_DIR` (the downloaded `m-a-p/SheetSage2`, holding
     `infer.py`). Both unset = no transcription.
   - New routes, same auth: `POST /v1/transcriptions` (multipart audio →
     202 + record), `GET /v1/transcriptions/{id}`,
     `GET /v1/transcriptions/{id}/score` (ABC),
     `GET /v1/transcriptions/{id}/preview` (the rendered piano audio),
     `POST /v1/transcriptions/{id}/cancel`.
   - Transcriptions go through the existing single worker and job store,
     so a transcription and a YuE2 song never share the GPU. Same
     retention, same `Idempotency-Key` handling.
   - *Why not its own microservice* (like `demucs-server/`): it only ever
     feeds YuE2, it needs WSL for the same FFmpeg reasons, and a separate
     process would need its own launcher step and port for a 57M model.
   - *Cost*: a `yue2-serve` (Turbo) deployment behind `YUE_API_URL` has no
     transcription routes, so it can't do covers. The point-8 probe makes
     that visible instead of a failure.
8. **Availability is probed, not declared.** `EngineCapabilities` stays
   static (it describes the model). `listEngines` also calls
   `GET /v1/transcriptions/health` for YuE2, which returns 200 when the
   SheetSage2 venv and weights are found, else 503. The result lands as a
   new `EngineInfo.coverReady: boolean`. Settings › Engines shows
   COVERS: READY / NOT SET UP under the YuE2 row.
9. **Mulakai side: a transcription is a short job, under the genLock.**
   - `POST /api/engines/yue2/transcribe` takes the source (multipart, as
     COVER does today) and returns a job id. It polls through the existing
     `GET /api/generate/:jobId`.
   - It holds the genLock under a new `transcribe` kind. SheetSage2 is
     small, but the lock is what stops it running next to an ACE-Step job
     on a 16 GB card. The spike's VRAM figure can relax this later.
   - When it finishes, the job carries the ABC and a preview URL. Nothing
     is written to the library.
   - The ABC lives in the COVER draft (`draft.audio.yueScore`: ABC text,
     source label, header facts), so it survives a reload. The preview
     audio does not; after a reload the panel says to re-transcribe for
     a preview.
10. **The cover is a new song, like every Create task.**
    `POST /api/engines/yue2/cover` takes the Create fields plus `abc` and
    runs `engineGenJobs` unchanged except for the request builder.
    - The song is stored with `engine = 'yue2'`, `gen_task = 'cover'`, the
      ABC as its `score` sidecar (the same one text2music takes store),
      and `params.source` = the source label.
    - The Library rail reads GENERATED WITH `COVER · YUE2`. REUSE PROMPT
      on it reopens COVER on YUE2 with the stored ABC, so another cover of
      the same melody needs no new transcription.
    - Every edit afterwards is ACE-Step's, as for any YuE2 song.
11. **Consequence line** (DESIGN.md: stated before commit):
    - TRANSCRIBE: "reads the source's melody into a score · nothing is
      saved to your library".
    - GENERATE: "YuE2 melody cover · keeps the source's melody, not its
      voice or sound · length follows the score · ~95 s per 3-minute
      song on an RTX 4080 · result will be saved as a new song · later
      edits use ACE-Step".
12. **Licence note.** The Settings › Engines YuE2 note gains:
    "SheetSage2 weights: CC BY-NC 4.0." Mulakai says nothing about the
    rights to the source song. A melody cover of someone else's song is a
    derivative work, which is the user's call, as with ACE-Step's COVER.

### Upstream skill-doc review (2026-09-30)

Checked against upstream's `skills/yue2-music` references (see "YuE2:
Align With Upstream's `yue2-music` Skill"). Where these differ from the
decisions above, they supersede them:

- **The score keeps both melodies.** SheetSage2's native ABC has two
  monophonic voices: `Vocal` (the sung line, plus the chord symbols) and
  `Ins` (instrumental themes, fills and solos). `--melody-only` drops only
  the chords, not `Ins`; upstream says not to discard `Ins` just because
  the task is a cover. Transcribe with `melody_full` (upstream's helper:
  `--task melody-full`), never `melody_vocal`, and send both voices.
- **`cot="melody"` does not strip chords** (point 5 assumed it). A
  transcription made with `--melody-only` has none, but a USE .ABC FILE
  score may. `yue-server` strips them with the vendored
  `abc_tools.strip_chords` (it checks that every note, onset, meter and
  tempo survive), rather than rejecting the file.
- **A supplied score has a size limit**: upstream refuses one over 4096
  ABC tokens ("the normal planning budget"). That is a 422 from
  `yue-server`, reported in Create's terms, not a job that fails later.
- **USE .ABC FILE makes the piano preview stale** (point 3). The preview is
  rendered from the transcription's MIDI, not from the ABC, and editing
  the ABC does not update that MIDI. A replaced score drops the preview and
  says "no preview for a replaced score"; `render.py --abc` renders sheet
  music only, not audio.
- **Sections: answered.** The score marks them with `% verse`,
  `% chorus`, `% bridge`, `% interlude` comments, and has no lyric slots
  or `w:` lines (upstream: never add them). So the open question's answer
  is yes: Mulakai can write the section outline (`% pre-chorus` →
  `[Pre-Chorus]`, as `yue-server/instrumental.py`'s `section_tags` does)
  and seed an upload's LYRICS with it, for the user to fill in.
- **An instrumental cover is upstream's instrumental workflow** (point 4):
  the score's `Vocal` notes move to `Ins`, the chords are stripped, and it
  is generated with `cot="melody"` and the score's section tags as lyrics.
  `yue-server`'s converter (`upstream/instrumentalize.py`) already does
  the move, so empty LYRICS on COVER no longer waits on the spike: it
  sends the tags-only skeleton, and `yue-server` converts the supplied
  score too. `is_instrumental` gains that case in PR 1.
- **Setup details** for PR 1's README:
  - Pin the snapshots. Upstream's `cover-release.json` uses SheetSage2
    `eab522a8168e8b8b8c4856bf8609cd86198f01fe` and MERT-v2-FullSong
    `d8ba1c745e733b3908ce6ad16ebeb17ac7600a42`. SheetSage2 loads with
    `trust_remote_code`, so a pinned revision is what makes that code
    reviewed.
  - Use Python 3.10 or 3.11, `torch==2.8.0` / `torchaudio==2.8.0` from the
    cu126 index, then the snapshot's `requirements.txt` (Transformers
    4.45.2, NumPy 1.24.3).
  - `--render-audio` needs `setup_render.py` (`--with-deps` on minimal
    Ubuntu) first. It installs Playwright/Chromium and FluidR3 piano
    samples (CC BY 3.0 US).
- **The review panel shows SheetSage2's `warnings`.** Upstream: inspect
  `warnings`, `diagnostics` and `abc_error` before generating, and a
  melody-only request that can't build ABC is an error, not a result with
  annotations alone.

### File-level plan

**PR 0 — spike (`docs/yue2-cover-spike`, PLAN.md only).** Manual, in WSL,
with the numbers written back here. *Done 2026-09-30: see "Cover spike
results" below.*

- Install SheetSage2 per `docs/covers.md` in `~/sheetsage2`, including
  the Hugging Face login.
- Transcribe three sources: an ACE-Step song from the library, a
  commercial-style song with vocals, and an instrumental. Record time,
  peak VRAM, and whether the ABC has section markers or lyric slots.
- Generate from each with `yue2 generate --abc-file … --cot melody`:
  with lyrics seeded from the source, with lyrics that don't fit the
  melody, and with the tags-only instrumental skeleton. Record time,
  truncation, and whether the melody survives in each case.
- Answer: does YuE2 need the lyrics' section tags to line up with the
  score's sections, and what happens when they don't?
- **ACE-Step side check (added 2026-09-30).** ACE-Step 1.5 takes no score
  or MIDI (`docs/ace-step-1.5/API.md` has no symbolic input), so the ABC
  itself is useless to it. SheetSage2's `--render-audio` piano rendering
  of the melody is ordinary audio, though, and could be the *source* of
  an ACE-Step job: a melody-only cover that keeps none of the original's
  sound or voice.
  - Run the piano rendering of each source through ACE-Step `cover` (at a
    few VARIANCE settings) and `complete` (ARRANGE), with a style prompt.
  - Record whether the result is a full song that keeps the melody, or
    just a restyled piano track.
  - If it works: a follow-up section lets COVER and ARRANGE on ACE-Step
    use a transcription's piano rendering as their source. It reuses the
    same TRANSCRIBE step, and needs no ACE-Step change. If it doesn't,
    note the result here and drop it. Either way, this check does not
    gate the YuE2 plan.

**PR 1 — yue-server (`feat/yue-transcribe`).**

- `yue-server/request_model.py` — `abc` field + validator (point 6).
- `yue-server/settings.py` — `YUE_SHEETSAGE_PYTHON`, `YUE_SHEETSAGE_DIR`.
- `yue-server/transcriber.py` — new: builds and runs the `infer.py`
  subprocess (`--melody-only --render-audio`), cancel by killing it, and
  collects `score.abc` + the preview.
- `yue-server/jobs.py`, `worker.py` — a `kind` on job records, so one
  worker runs both. Watch the size of both; `worker.py` is at 130 LOC.
- `yue-server/main.py` — the transcription routes and health (points 7–8).
  It is at 134 LOC, so the new routes go in `transcribe_routes.py`.
- `yue-server/tests/` — a fake transcriber, as the pipeline has; `abc`
  validation cases; transcription lifecycle, cancel, retention.
- `yue-server/README.md` — SheetSage2 setup section.
- `start-all.bat` — pass `YUE_SHEETSAGE_PYTHON` / `YUE_SHEETSAGE_DIR`
  into the `wsl.exe` command when `~/sheetsage2` exists.

**PR 2 — Mulakai server (`feat/yue-cover-server`).**

- `server/src/services/engines/yue2.ts` — `buildYue2CoverRequest`
  (point 5).
- `server/src/services/engineClient.ts` — `transcribe`,
  `transcriptionStatus`, `fetchTranscriptionScore`,
  `fetchTranscriptionPreview`, `transcriptionHealth`. It is at 130 LOC, so
  these go in a new `engineTranscribeClient.ts`.
- `server/src/services/transcribeJobs.ts` — new: submit → poll → keep
  ABC + preview on the job; genLock `transcribe`.
- `server/src/services/genLock.ts` — `transcribe` kind.
- `server/src/services/engineGenJobs.ts` — accept a prebuilt request and a
  `genTask`, so the cover path reuses it; persist `gen_task = 'cover'`.
- `server/src/services/engines/registry.ts` — `coverReady` probe.
- `server/src/routes/engines.ts` — `POST /:id/transcribe` (multipart),
  `GET /:id/transcribe/:jobId/preview`, `POST /:id/cover`; 400 for any
  engine but `yue2` or when `coverReady` is false.
- Tests alongside each: `yue2.test.ts`, `transcribeJobs.test.ts`,
  `engines.test.ts`, `registry.test.ts`.

**PR 3 — client (`feat/yue-cover-ui`).**

- `client/src/CreateAudioTab.tsx` is at 197 LOC, at the cap. First, in a
  `refactor:` commit: move source picking (`resolveSrcAudio` and the
  upload/library choice) into `CoverSourcePicker.tsx`.
- `client/src/CoverEngineRow.tsx` — new: the ENGINE row for COVER
  (reuses the PROMPT row's component if it takes a value/onChange pair).
- `client/src/YueCoverPanel.tsx` — new: TRANSCRIBE button, transcription
  progress, the review panel (facts, piano preview, collapsed ABC,
  USE .ABC FILE) and the consequence lines.
- `client/src/abcFacts.ts` — new, pure: tempo / key / meter / bars /
  length from an ABC header, for the review panel. It mirrors the server's
  `abcMeta.ts` and is unit-tested separately.
- `client/src/createDraft.ts`, `createDraftStore.ts` — `audio.engine`,
  `audio.yueScore`; `load` handles REUSE PROMPT on a `cover · yue2` song.
- `client/src/generationStore.ts` — a `startYueCover` action through the
  shared start helper; transcription job state.
- `client/src/api/*` — the three routes and `EngineInfo.coverReady`.
- `client/src/EnginesSection.tsx` — the COVERS row and the licence line.
- `client/src/engineCaps.ts` — COVER-on-YUE2 gating (point 5).
- Tests: `abcFacts.test.ts`, `createDraft*.test.ts`,
  `generationStore.test.ts`, `engineCaps.test.ts`.
- Browser check of the golden path: library song → TRANSCRIBE → preview
  → GENERATE → the new song opens with `COVER · YUE2`. Also one Playwright
  step, once e2e exists (docs/AUDIT.md).

### Rollout

PR 0 decides whether this goes ahead at all. If the spike shows the melody
doesn't survive, or the lyrics have to be hand-aligned so tightly that
nobody will do it, this section gets a "not pursued" note with the numbers
and the work stops there. PRs 1–3 then land in order, each usable on its
own terms (PR 1 is testable through curl; PR 2 through the API).

### Cover spike results (2026-09-30)

**Verdict: go ahead.** A supplied score steers YuE2's melody strongly: a
sung cover kept 0.93–0.98 of the source melody, against 0.10 for an
unrelated melody. The lyrics don't have to be hand-aligned. They do have
to use the score's sections; the source's own section tags cost a third
of the melody. Run in WSL (Ubuntu 24.04, RTX 4080 16 GB); every file is in
`~/sheetsage-spike`.

**Sources.** Three ACE-Step songs from the library: *Ellies City 2*
(trip-hop, female vocal, 140 s), *Purple Shinings* (dream pop, female
vocal, 177 s) and *eventide* (instrumental guitar and cello, 147 s). No
commercial recording was used; none was on hand, and the question is
whether YuE2 follows a transcription, which a library song answers.

**Setup.**
- `~/sheetsage2/.venv`: Python 3.11.16, torch 2.8.0+cu126, Transformers
  4.45.2, NumPy 1.24.3. FFmpeg 6.1.1 comes from Ubuntu.
- **No Hugging Face login was needed**: the snapshot and its MERT parent
  downloaded anonymously. That answers the open question: document no login.
- The snapshot came down unpinned, as `ce18e5ba…`. Upstream's
  `cover-release.json` pins `eab522a8…`; MERT-v2-FullSong matched its pin
  (`d8ba1c74…`). PR 1's README pins SheetSage2 to a revision.
- `--render-audio` failed ("Could not start the renderer") until
  `setup_render.py` was run.

**Transcription** (`infer.py --melody-only --render-audio`).
- Model time was 6–12 s per song, 11–22 s wall including the model load.
  PyTorch peaked at 3.4 GiB, 3.7 GB on the card. `warnings` was empty and
  `abc_error` null for all three.
- **Section markers: yes. Lyric slots: no.** Each score has `% intro`,
  `% verse`, `% chorus`, `% bridge`, `% interlude` and `% outro` comments,
  and no `w:` lines.
- The section labels are approximate. *Purple*'s verse/chorus layout came
  out as intro, verse, bridge, interlude.
- Header facts are mostly right. *Ellies* came out as 75 BPM, F minor,
  matching the song, and *Purple* as 87 BPM, D minor, also matching.
  *eventide* came out as 65 BPM in 2/4 (the song is 130 BPM in 4/4, so
  half time) and B♭ minor, where its stored key is F♯ major. The review
  panel's header facts are how a user spots this.
- Both voices are used: *Ellies* has 167 `Vocal` and 16 `Ins` notes,
  *Purple* 122 and 171, *eventide* 0 and 160.

**Generation** (`yue2 generate --abc-file … --cot melody`, seed 42; for
instrumentals, upstream's conversion first, see "YuE2: Align With
Upstream's `yue2-music` Skill").
- **Speed:** 59–76 s for a 136–140 s song, and 95 s for *eventide*'s
  157 s. *Purple* took 124 s for 176 s, but ran while ACE-Step was loaded
  on the card.
- **Contention:** an earlier *eventide* attempt, made with ACE-Step
  resident, stalled at 9 tokens/s and never finished. Alone it ran at
  63 tokens/s. This confirms point 9's genLock and the ACE-Step offload
  requirement.
- **Truncation:** none, in either flag, on any run.
- **Tempo:** the result's tempo landed within 4% of the score's.

**Melody survival.** Each result was transcribed again by SheetSage2 and
compared with the source's transcription, note by note (`mir_eval`: onset
within 0.25 s, pitch within 50 cents, offsets ignored). The comparison
takes the best time shift within ±15 s and the best tempo scale between
0.94 and 1.06. A source against its own piano rendering scores 1.00, which
is the ceiling.

| Run | Lyrics | F1 | Octave-folded |
| --- | --- | --- | --- |
| Purple, synth-pop | its own | **0.98** | 0.98 |
| Ellies, folk | don't fit the melody (long lines, 3 sections) | **0.96** | 0.96 |
| Ellies, folk | its words, re-tagged to the score's 6 sections | **0.93** | 0.93 |
| Ellies, folk | its own (`[Verse 1]`, `[Bridge]`, `[Humming]` ×5) | 0.66 | 0.66 |
| Ellies, cello instrumental | score tags only, `Vocal` moved to `Ins` | 0.52 | 0.67 |
| eventide, lo-fi instrumental | score tags only | 0.55 | 0.55 |
| Ellies control: no score, `cot=full` | re-tagged | 0.11 | 0.13 |
| Chance: Ellies vs the Purple cover | — | 0.10 | 0.10 |

In every sung run the melody was sung: 166–169 vocal notes, like the
source's 167. Lyrics that don't fit did not push it onto an instrument.
Without the tempo search, runs that drifted 1–4% scored far lower (0.41
for the re-tagged run), so a fixed-tempo comparison is misleading here.

**Answers.**
- **Do the lyrics' section tags need to match the score's?** They should.
  Same words, same seed: 0.93 with the score's tags, 0.66 with the
  source's own tags. The source's tags have an extra `[Bridge]` and a run
  of `[Humming]` tags. Mulakai writes the score's section outline into
  LYRICS, and a library source's words are re-tagged to it; the user can
  still edit it. This replaces point 4's "seeds LYRICS from that song"
  as-is.
- **Do the syllables need to fit?** Not for the melody: the misfit lyrics
  scored 0.96. Whether all their words were sung, and clearly, was not
  measured. There was no ASR or listening pass, so point 4's hint about
  phrasing stays.
- **Instrumental covers work, less faithfully.** Around 0.5–0.67, far above
  chance, with the melody moved partly an octave away. Empty LYRICS on COVER
  is allowed, and its consequence line says the melody is followed more
  loosely.

**ACE-Step side check: dropped for sung covers.** SheetSage2's piano
rendering was used as the *source* of a Mulakai COVER (`acestep-v15-sft`)
and ARRANGE (`acestep-v15-base`) job, with the folk style and the re-tagged
lyrics. The results were scored the same way and saved to the library's
"SheetSage spike" folder.

| Run | F1 | Octave-folded | Sung notes |
| --- | --- | --- | --- |
| Ellies → COVER | 0.29 | 0.30 | 0 of 413 melody notes |
| Ellies → ARRANGE | 0.10 | 0.12 | 114 |
| eventide → COVER, lo-fi instrumental | 0.02 | 0.68 | 0 |

- **COVER gives a restyled instrumental, not a song.** Nothing was sung,
  despite the lyrics and "warm female vocal". About half of the melody
  is in there, among many added notes.
- **ARRANGE sings, but a new melody**, at chance level (0.10).
- **COVER on an instrumental** keeps the melody's pitch classes about as
  well as YuE2 did (0.68 octave-folded), though an octave away.

So a transcription's piano rendering does not make ACE-Step sing the
source's melody. The follow-up section is not written. Two caveats:
- COVER ran at ACE-Step's default strength. VARIANCE never reaches
  ACE-Step, because `/from-audio` drops `audio_cover_strength`. That bug
  was found here and filed separately. An instrumental-only variant could
  be retried once it is fixed.
- The XL models spilled out of 16 GB at 55 s per step, about 47 minutes a
  job, so the standard models were used. They took 4.5–6 minutes a job.

**Not done.**
- A listening pass. The files are in
  `\\wsl$\Ubuntu-24.04\home\calvin\sheetsage-spike\gen\*\song\audio.flac`,
  and the ACE-Step results are in the library.
- ASR on the misfit lyrics.

### yue-server transcription decisions (2026-09-30, `feat/yue-transcribe`)

PR 1. Where these differ from points 6–8 or the file-level plan, they
supersede them:

- **Job kinds.** Every record gains `kind`: `song` or `transcription`.
  - Only song records carry `seed`, `tokens` and `request_id`.
  - Both kinds share the queue, the `max_pending` limit, retention and
    `Idempotency-Key` replay. The idempotency digest includes the kind.
  - Each route family returns 404 for the other kind's ids, so
    `/v1/jobs/{id}` never serves a transcription.
- **Upload.** `POST /v1/transcriptions` takes a multipart `audio` field,
  up to `YUE_MAX_UPLOAD_MB` (default 100, the same as Mulakai's multer
  limit). Over that is a 413, and an empty file a 400.
  - The file is stored as `uploads/<sha256><ext>`, so a replayed
    `Idempotency-Key` with the same audio matches its digest.
  - Uploads older than the retention window are swept on each submit, and
    all of them on startup.
  - This adds `python-multipart` to `requirements.txt`.
- **The subprocess** runs `infer.py <audio> --output <job dir> --melody-only
  --render-audio --local-files-only`, from `YUE_SHEETSAGE_DIR`, so the
  pinned local snapshot is what runs and nothing is fetched.
  - `--melody-only` keeps the default tasks, so both melody voices are
    kept (see "Upstream skill-doc review").
  - Progress comes from its `Window i/n` lines.
  - Cancel kills the process group.
- **Success is decided by the score, not the exit code.** A failed piano
  render exits 1 but still writes `score.abc`; the spike hit exactly this.
  - A job succeeds when `score.abc` is non-empty and `result.json` has no
    `abc_error`.
  - The preview is `piano_mix.wav` when it exists. Otherwise
    `preview_url` is null, and the `render_error` joins `warnings`.
  - Failure codes: `no_score` (SheetSage2 ran but built no score) and
    `transcription_failed`. Both carry the last lines of its output.
- **The record's `result`**: `score_url`, `preview_url`, `warnings`
  (SheetSage2's own, plus any render error), `measures`, `vocal_notes`,
  `instrumental_notes`, `duration_seconds`, and `timing.total_seconds`.
- **Health.** `GET /v1/transcriptions/health` needs no auth, like
  `/health/*`.
  - 200 `{"status": "ready"}` when the worker is ready and the venv's
    Python, `infer.py` and `model.safetensors` all exist.
  - Otherwise 503 with `status` `not_configured`, `missing_files` (and
    `detail`), or the worker's state.
  - A submit when not ready is also a 503.
- **A supplied score (`abc`) is checked before it is queued.** Each check
  fails as a 422:
  1. It must be non-blank and at most 64 KB, and `cot` must not be `off`.
  2. It must parse in the native two-voice dialect (the vendored
     `abc_tools.parse_abc`).
  3. With `cot="melody"`, its chord symbols are stripped
     (`strip_chords`, which checks every note survives).
  4. It must fit the pipeline's 4096-token plan budget. This is checked
     once the pipeline is loaded; a submit before then is already a 503.
- **An instrumental cover converts the supplied score too.**
  `is_instrumental` no longer excludes `abc`: tags-only lyrics with a score
  move its `Vocal` notes to `Ins`, as upstream's instrumental cover does.
- **The SheetSage2 pin is HF `main` at `cafc0df1…` (2026-09-29).** That is
  what the spike ran. Upstream's `eab522a8…` is older.
- **Transcription never touches the YuE2 pipeline.** YuE2 is parked in
  system RAM between jobs, which leaves about 0.8 GB of CUDA context, and
  SheetSage2 needs about 3.7 GB. If the YuE2 pipeline failed to load,
  transcription is unavailable too: one worker runs both.
- **Verified end to end (2026-10-01)**, in WSL on the RTX 4080, against the
  real SheetSage2 and YuE2 installs:
  - **Transcription:** *Ellies* transcribed in 18 s. It gave the same score
    as the spike (44 measures, 167 `Vocal` and 16 `Ins` notes) and a 24 MB
    piano preview.
  - **Sung cover:** from that score, with `cot=melody`, 62 s for 135 s of
    audio.
  - **Instrumental cover:** 61 s. All 167 vocal notes moved to `Ins`, and
    the generated score had 0 `Vocal` notes. This is the first GPU run of
    `plan()` with a supplied score and the real 4096-token check, the
    parts "YuE2: Align With Upstream's `yue2-music` Skill" had left
    unverified.
  - No truncation in either cover.
  - **Melody kept:** measured in note order (longest common subsequence,
    octave-folded, timing ignored), 0.98 for the sung cover (the spike's
    identical request also scored 0.98) and 0.96 for the instrumental.
    The no-score control scored 0.43 and chance 0.38.
  - **Timed comparison:** the spike's note-F1 put this sung run at only
    0.55. It had shifted locally, which one global tempo-and-offset
    alignment can't follow. So note order is the better measure of
    melody survival.
  - **A lesson:** a game on the GPU (10 GB, 85%) slowed transcription to
    5½ minutes, and stalled a cover at 1.8 tokens/s. A stalled job cannot
    be cancelled, because cancel is only checked per token. The earlier
    spike's stalled instrumental run was most likely the same kind of
    contention.

### Mulakai server cover decisions (2026-10-01, `feat/yue-cover-server`)

PR 2. Where these differ from points 5, 9 and 10 or the file-level plan,
they supersede them:

- **Covers are an optional engine ability.** `SongEngine` gains an
  optional `toCoverRequest(fields, abc)`. Only YuE2 has one, and HeartMuLa
  doesn't. The cover routes answer 400 for an engine without it, or one
  that isn't configured.
- **`EngineInfo.coverReady`** is true when the engine can cover, is
  configured, and answers `GET /v1/transcriptions/health` with 200. It is
  probed in parallel with the other health checks. A `yue2-serve` backend,
  which has no such route, reads as false.
- **`POST /api/engines/:id/transcribe`** takes multipart `src_audio`, as
  COVER does today, plus an optional `source_label`. It returns 202
  `{jobId}`, and is polled through `GET /api/generate/:jobId`.
  - It holds the genLock as `{kind: 'transcribe', title: <source label>,
    engine}`. The client already shows an unknown kind as another job
    holding the lock, and PR 3 names it.
  - The coverReady check runs at request time: false is a 400, "covers
    are not set up".
- **The finished job carries `transcription`**: `score` (the ABC),
  `sourceLabel`, `warnings`, `measures`, `vocalNotes`, `instrumentalNotes`,
  `durationSeconds` and `hasPreview`. Nothing is written to the library.
- **The preview is proxied, not copied.**
  `GET /api/engines/:id/transcribe/:jobId/preview` streams yue-server's
  preview and forwards `Range`, so the player can seek.
  - yue-server keeps it for its retention window (24 h) or until it
    restarts. After that it is a 404, which matches point 9's "after a
    reload, re-transcribe for a preview".
  - Mulakai keeps no scratch file to clean up.
- **`buildYue2CoverRequest(fields, abc)`**:
  - `style`: the language and PROMPT only, as text2music writes them. No
    BPM / KEY / TIME SIGNATURE hints, because the score fixes those
    (point 5).
  - Instrumental: upstream's wording, as in text2music.
  - `lyrics`: as typed. Empty lyrics become the tags-only skeleton, which
    yue-server replaces with the score's own section tags.
  - `cot: 'melody'`, `abc`, `seed` and `cfg_scale` are mapped as usual.
- **`POST /api/engines/:id/cover`** takes JSON with the Create fields plus
  `abc` (non-blank, at most 64 KB) and `source` (the source label).
  - It runs `startEngineGeneration` with a cover option. That option picks
    the request builder and the lock's and the song's `gen_task: 'cover'`.
  - The version's `params.request` keeps `abc`: the *supplied* score,
    which REUSE PROMPT needs. The `.abc` sidecar is the score yue-server
    generated from, which for an instrumental cover is the converted one.
    `params.source` is the source label.
- **`GET /api/engines/:id/covers/:songId/score`** returns that supplied
  score (`text/plain`) from the song's first base version. It is a 404
  for a song that isn't a YuE2 cover. PR 3's REUSE PROMPT uses it, so
  another cover of the same melody needs no new transcription.
- **Verified end to end (2026-10-01).** This branch's server ran on a
  scratch database against the real yue-server in WSL, through the same
  API the client will call:
  - `GET /api/engines` showed YuE2 `coverReady: true`.
  - **Transcribe:** *Ellies City 2* from the library, under a `transcribe`
    lock titled with the source. Done in 21 s, with the spike's facts (44
    measures, 167/16 notes).
  - **Preview:** a Range request returned 206, and a full one 200 with
    24.7 MB.
  - **Cover:** held the lock as `generate · cover`, and polled through
    semantic → synthesis → decode. It saved a new song in 65 s:
    `engine: yue2`, `gen_task: cover`, 137 s.
  - **Metadata from the score:** the song's 75 BPM / F minor / 4/4 came
    from the score. The `bpm: 140` in the request was dropped, as
    intended.
  - **Stored score:** `covers/:songId/score` returned exactly the
    transcribed score.

### Client cover decisions (2026-10-01, `feat/yue-cover-ui`)

PR 3. Where these differ from points 1–4, 9–12 or the file-level plan,
they supersede them:

- **ENGINE on COVER.** `EngineChoice` takes its choices, value and
  handler as props, so PROMPT and COVER share it.
  - COVER offers ACE-STEP plus every extra engine whose `coverReady` is
    true. The row renders only when one exists, or when the draft already
    names one.
  - The pick is `draft.audio.engine`, so PROMPT's engine is untouched.
    ARRANGE stays ACE-Step-only.
- **The score lives in the draft**: `draft.audio.yueScore`, which holds
  the ABC, its source label, SheetSage2's facts (null for a file or a
  reused score), and the transcription job id for the preview.
  - The draft is in memory only, as it always has been, so this
    supersedes point 9's "survives a reload". The score survives tab
    switches and leaving Create, like the rest of the draft.
  - Changing the source (the tab, the picked song or the upload) clears
    it. CLEAR DRAFT clears it and resets the engine.
- **The settings panel follows COVER's engine.** `useEngineCaps` resolves
  COVER to `audio.engine`, so on YUE2 the panel shows YuE2's CFG and SEED.
  COT is hidden there, with a hint, because a cover always uses `melody`
  (point 5).
- **TRANSCRIBE** is an acid-outline button: GENERATE COVER stays the one
  filled CTA.
  - While it runs it reads `TRANSCRIBING… n%`, from SheetSage2's windows.
  - No shader: DESIGN.md keeps the AI shimmer to GENERATE / REPAINT.
  - It is off while any job holds the lock, and needs a source.
  - A new `transcribeStore.ts` runs it, because `generationStore.ts` is at
    the cap. The result is applied only if the draft's source is still
    the one that was transcribed.
- **The review panel** (`YueScoreReview.tsx`):
  - Tempo, key, meter, bars and length, from `abcFacts.ts`. Its header
    parsing mirrors the server's `abcMeta.ts`.
  - SheetSage2's vocal and instrument note counts.
  - Its warnings, as a `.warn-note`.
  - The piano preview through `AudioPreview`, from the proxy route.
    Without one, a hint says why: a replaced or reused score has none,
    and an expired one needs re-transcribing.
  - The ABC in a collapsed, read-only block.
  - **USE .ABC FILE** replaces the score and drops the preview. The server
    checks the file at GENERATE, and its 422 message is shown.
- **Lyrics fit the score's sections** (spike: 0.93 against 0.66 with the
  source's own tags).
  - When a score arrives and LYRICS is empty, it is filled: with the
    score's section outline, or for a library source with that song's
    words re-tagged in order onto the score's sung sections
    (`coverLyrics.ts`).
  - **FIT TO SCORE** re-tags whatever LYRICS holds now.
  - Empty LYRICS makes an instrumental cover, and the consequence line
    says the melody is then followed more loosely.
- **Song details on COVER · YUE2.** There are no BPM, KEY, TIME SIGNATURE
  or DURATION inputs: the score fixes them (point 5), and the review
  facts stand in for them. VOCAL LANGUAGE stays, English or Chinese.
- **GENERATE COVER** calls `startYueCover`, through the shared `launch`.
  - The request carries title, prompt, lyrics, language, the seed pair,
    CFG (no COT), output, folder, `abc` and `source`.
  - Consequence lines follow point 11, with an instrumental variant.
- **REUSE PROMPT on a `COVER · YUE2` song** opens COVER on YUE2.
  - The draft carries `reuseScore` (the engine and song), and the panel
    fetches the song's source score into `yueScore`.
  - So it is ready to GENERATE with no source. TRANSCRIBE is still there
    if a source is picked.
  - The rail's consequence line says so.
  - A retry of a failed cover, or a job adopted from the lock, reopens
    COVER on its engine.
- **Settings › Engines:**
  - The YuE2 row gains `COVERS: READY / NOT SET UP` and "SheetSage2
    weights: CC BY-NC 4.0."
  - The card's hint names COVER too.
  - The header pill shows the new lock kind as `TRANSCRIBE · RUNNING`.
- **DESIGN.md is updated in its own commit.** It says COVER is always
  ACE-Step, which is no longer true.
- **Browser-checked end to end (2026-10-01).** This branch's client and
  server ran on a scratch library against the real yue-server in WSL:
  - **Engine row:** COVER showed ENGINE (ACE-STEP / YUE2), and picking
    YUE2 swapped the settings panel to CFG / SEED with the COT hint.
  - **Transcribe an upload:** *Ellies* reviewed as 75 BPM, F minor, 4/4,
    44 bars, 2:21, 167 sung / 16 played, with a playable 2:20 piano
    preview. LYRICS were seeded with the score's outline.
  - **FIT TO SCORE** turned untagged words into exactly the spike's
    hand-aligned lyrics.
  - **Generate:** GENERATE COVER handed off to the Library card and
    saved `COVER · YUE2` (75 BPM / F minor / 2:21).
  - **REUSE PROMPT** reopened COVER on YUE2 with the fetched score, ready
    to GENERATE with no source.
  - **Library source:** transcribing the new cover as a FROM LIBRARY
    source (a client-side bounce) gave 46 bars and 168 sung / 14 played
    notes, close to the original's 167 / 16.
  - **Settings:** Settings › Engines showed `COVERS: READY` and the
    SheetSage2 licence line.
  - **A bug found and fixed along the way:** tags-only lyrics were not
    read as an instrumental. The consequence line now uses yue-server's
    rule (`hasWords`).

### Open questions

- **Section alignment.** If YuE2 needs lyric section tags that match the
  score's sections, can Mulakai write the skeleton (`[Verse]` / `[Chorus]`
  with the right line counts) from the ABC? That depends on what SheetSage2
  puts in the score; the spike decides. *Partly answered 2026-09-30*: the
  section tags, yes (see "Upstream skill-doc review"). The line counts are
  still open: the score has no lyric slots, so they would have to come from
  the `Vocal` phrases' rests. The spike shows whether YuE2 needs them.
- **Transcribing a stem.** A library song with a vocals layer could
  transcribe that layer alone rather than the full mix, which may be
  cleaner. It's cheap to add (the rail already has the layers). Is it
  worth it in v1, or after the spike shows how SheetSage2 copes with a
  full mix?
- **Hugging Face login.** If SheetSage2 is gated, setup needs a token in
  WSL. Document only, or should `yue-server`'s health say "weights not
  found" specifically enough to point at the login step? *Answered
  2026-09-30: it isn't gated; the spike downloaded it without a login.*
- **Copying the melody of a copyrighted song.** Point 12 leaves this to
  the user, the same as ACE-Step's COVER. Should COVER on YUE2 say so
  inline, given it is a much more literal copy of the melody?

## YuE2: Align With Upstream's `yue2-music` Skill (planned 2026-09-30)

Upstream published an agent skill, `skills/yue2-music` in
`github.com/multimodal-art-projection/YuE` (commit `72272f9`), with five
reference docs: `abc-editing.md`, `editing-workflows.md`,
`generation-and-covers.md`, `listening-and-evaluation.md` and
`models-and-setup.md`, plus an `instrumental/` sub-skill. This section
checks the YuE2 integration against them.

**Already matching upstream**: the three `cot` modes; a seed on every
request (upstream's default is a fixed 831001); CFG omitted on AUTO
(upstream's default is 1.0 for `full`/`melody`, 1.01 for `off`); tempo, key
and meter only as style text, since the request has no `bpm` field; both
truncation flags checked; `YuE2-Vae` as the listening decoder; no fp8 by
default ("do not lower inference settings to hide an OOM"). Upstream's
native score header (`X T M L Q V V K`, then `% verse` section comments)
parses as `abcMeta.ts` expects; five real scores from the library were
checked.

**Still out of scope**: score editing, reharmonization, lyric adaptation and
"agentic editing" (`editing-workflows.md`, `abc-editing.md`). Upstream's
edit is a full regeneration from a revised score, with no inpainting, so it
is not a repaint either. The benchmark tooling (`YuE2-Vae-legacy`,
SongBench, PER) is for reproducing papers, not for an app.

### Decisions

1. **Instrumentals follow upstream's workflow** (`instrumental/SKILL.md`).
   Upstream does not rely on the planner writing no vocal notes, which the
   tags-only skeleton did (the spike's 0 of 49 vocal bars was one seed).
   Instead:
   1. YuE2 plans a score as usual (`cot` `full`, or `melody` if chosen).
   2. Every `Vocal` note moves to the `Ins` voice. On overlap the vocal note
      wins and the `Ins` note keeps only its free part. Chords, meter, key,
      tempo and section comments are kept, and the result is checked
      note-for-note.
   3. The song is generated from that score: `abc` = the converted score,
      `cot` = `full` if it has chords, else `melody`, and `lyrics` = the
      score's own section tags (`% verse` → `[Verse]`), with no words.
   - An external score skips the planner, so the second pass costs one
     short `plan()` call, not a second planning run.
   - **Where it runs: inside `yue-server`, with no contract change.** A
     request whose lyrics are only section tags, with no `abc` and `cot`
     not `off`, is an instrumental; that is upstream's own rule
     ("lyrics must be empty or exactly the score section tags"). Mulakai
     already sends exactly that for empty LYRICS. A `yue2-serve` backend
     keeps today's single-pass behaviour.
   - **The converter is upstream's, vendored unmodified**:
     `instrumentalize.py`, `abc_tools.py`, `compile_score.py` and
     `common.py` from `instrumental/scripts/` (MIT, standard library only)
     go in `yue-server/upstream/` with their licence and the source commit.
     They are over the 200-LOC cap; they are third-party files kept
     byte-identical so they can be re-synced, not Mulakai modules.
   - **If conversion fails** (a truncated or unparseable plan, or no notes
     at all), the job falls back to the unconverted plan (today's
     behaviour), logs a warning and records why in `result.json`. A song
     that mostly works beats a failed job; the record keeps it visible.
   - `score.abc` is the converted score, the one the audio was made from.
     `result.json` gains an `instrumental` record (vocal notes moved,
     `Ins` notes trimmed, or the fallback reason) and the final request.
   - The style follows upstream's too: `Instrumental, <PROMPT>, <hints>,
     no vocals, no singing, no choir, no spoken words`. It replaces
     `…, instrumental, no vocals`, and helps a `yue2-serve` backend too.
2. **VOCAL LANGUAGE reaches YuE2 as style text.** Upstream puts the
   language first in `style` ("English, warm female vocal, …"). The control
   was N/A for YuE2; it now offers only the languages the engine lists
   (English, Chinese), and the style starts with the language name. AUTO
   omits it. An instrumental skips it.
   - Rule: VOCAL LANGUAGE is live when an engine takes any language, or
     takes BPM/KEY as style text (`musicalMeta: 'style-text'`, which now
     covers language too). HeartMuLa (`'none'`) stays N/A.
   - A language left over from ACE-Step that YuE2 doesn't list is not
     sent; the server ignores unknown codes as well.
3. **YuE2's CFG slider runs 0–3, step 0.05**, not 0–20. Upstream's default
   is 1.0, and it calls 1.2 "an explicit experiment". The server still
   clamps to the protocol's 0–20.
4. **Covers plan corrections** go into "YuE2 Melody Covers via SheetSage2"
   (see its "Upstream skill-doc review" block).

### File-level plan

- `yue-server/upstream/` — vendored converter + `LICENSE` + `README.md`
  (source commit, what each file is, "do not edit").
- `yue-server/instrumental.py` — new: `is_instrumental(request)`,
  `section_tags(abc)`, `arrange(pipe, request, plan, …)` → the plan,
  request and record to generate from.
- `yue-server/worker.py` — call `arrange` after planning; save the final
  request and the `instrumental` record.
- `yue-server/tests/test_instrumental.py` — detection, tag extraction,
  conversion of a native score, fallback, and the worker path through the
  fake pipeline.
- `yue-server/README.md` — the Instrumentals section.
- `server/src/services/engines/yue2.ts` (+ test) — language prefix,
  upstream's instrumental style.
- `client/src/engineCaps.ts` (+ test) — the VOCAL LANGUAGE rule and
  `languageOptions`; `CreatePromptTab.tsx` uses them;
  `engineRequest.ts` (+ test) drops unlisted languages.
- `client/src/engineSettings.ts` — the YuE2 CFG range.

## UVR Separator: Roformer Vocals for SPLIT (planned + implemented 2026-09-30)

SPLIT's DEMUCS option runs `htdemucs` through `demucs-server/`. Its vocal
stem is the weakest of the four, and it is also the one people claim most
(a clean vocal layer to repaint around, and the input for the lyric-timestamp
to-do under "Open Questions For Later Phases"). The Roformer vocal models
from the Ultimate Vocal Remover (UVR) community separate vocals much more
cleanly. BS-Roformer-Viperx-1297's published vocal SDR is about 12.9 dB,
against about 9 dB for htdemucs on MUSDB. The test sets differ, but the gap
is well established. [uvr-headless-runner](https://github.com/chyinan/uvr-headless-runner)
(MIT) runs UVR's own separation code headless, with UVR's model registry
and auto-download.

This is a backend swap behind the existing `/split` contract, not a new
feature. `stemSplit.ts`, the routes and the SPLIT UI do not change.

### Decisions

- **A sibling service, `uvr-server/`, not a mode inside `demucs-server/`.**
  The runner installs top-level modules named `demucs`, `separate`, `cli`,
  `UVR`, `progress`, `models`, … Its vendored `demucs` collides with the pip
  `demucs` that `demucs-server` imports. It also pins Python `>=3.9,<3.11`
  and old numpy/librosa. So it gets its own Python 3.10 venv, like
  HeartMuLa. None of the service's own modules may reuse one of the
  runner's module names.
- **Same contract, same port, same env var.** `uvr-server` answers
  `GET /health` and `POST /split` → `{"stems": {vocals, drums, bass, other}}`
  of float32 WAV URLs on port 8002. Mulakai reaches it through the existing
  `DEMUCS_API_URL`. Only one of the two services runs at a time.
  `start-all.bat` prefers `uvr-server` when its venv exists and falls back
  to `demucs-server`.
- **Two passes, because Roformer vocal models have only two stems.**
  1. The vocal model (`UVR_VOCAL_MODEL`, default `Roformer Model:
     BS-Roformer-Viperx-1297`) splits the mix into Vocals and Instrumental.
     Its Vocals is the `vocals` stem. The Instrumental is exactly the mix
     minus the vocals (-153 dB residual when measured).
  2. The runner's own Demucs (`UVR_DEMUCS_MODEL`, default `htdemucs`)
     splits that Instrumental into drums/bass/other. Because it's the
     runner's copy, the venv needs no pip `demucs`.
- **Pass 2's "Vocals" is folded into `other`, not dropped.** The plan was
  to discard it as bleed, but on a real mix it measured -12 dB against the
  instrumental. That is far too loud for leftover vocals. It is mostly
  vocal-like instruments (leads, pads). Dropping it left the four stems
  -14 dB off the mix; folding it in brings them to -29 dB, which is about
  htdemucs' own reconstruction error.
- **Float32 WAV out** (`wav_type_set='FLOAT'`), the same lossless-master
  rule as every other producer. `transcode.ts` applies the user's format.
  UVR works at 44.1 kHz like htdemucs, so the resample-up note in "Output
  Format" applies unchanged. The Node path was verified end to end: a scratch
  split through `/api/split/scratch` came back as 48 kHz FLAC.
- **One split at a time, GPU memory freed after each.** The endpoint is a
  plain `def` behind a lock, so it runs in FastAPI's threadpool and `/health`
  stays responsive during a split. After each split, including a failed one,
  the service frees CUDA's cache so it doesn't hold VRAM that ACE-Step or an
  engine needs.
- **The runner comes from a pinned git checkout, not PyPI.** The 1.1.0 wheel
  leaves out the runner's `models/` data files, and without them no MDX model
  loads by name. `uvr-server/runner/` (gitignored) is cloned at commit
  `0088e1e` and installed editable, so it finds its data files and downloads
  models next to them (about 640 MB for Roformer and 80 MB for htdemucs).
- **Two runner bugs are worked around in `uvr_models.py`.** Both were found
  in real runs, and the runner's own CLI fails the same way.
  - *Roformer by registry name fails* with KeyError `'hyper_parameters'`. UVR's
    GUI merges UVR's online hash → config table (`model_data_new.json`),
    which marks Roformer checkpoints `is_roformer` with their YAML. The runner
    defines that URL but never fetches it. The service looks the
    checkpoint's hash up there and passes the entry as `model_json_path`.
    The entry is cached in `uvr-server/model-configs/`.
  - *Demucs v4's first download* resolves to the `.th` weights instead of the
    `{name}.yaml` bag Demucs loads by. After the download the service looks
    the name up again, and that finds the yaml.
- **Measured:** a 3½-minute song takes about 50 s warm on an RTX 4080 for
  both passes. That includes loading both models, which happens on every
  call, the same as `demucs-server`.

### File-level plan (as built)

- `uvr-server/chain.py` — the two-pass split, with the runners injected so
  tests can pass fakes. It maps `{base}_({Stem}).wav` to `StemKind`s and
  folds pass 2's Vocals into `other`.
- `uvr-server/uvr_models.py` — the two runner workarounds above.
- `uvr-server/api.py` — `create_app`: `/health`, `/split`, the `/audio`
  static mount, the lock, freeing GPU memory, and pruning intermediate files.
- `uvr-server/main.py` — wires the real runners and env vars into `api.py`.
  Run it with `uvicorn main:app --port 8002`.
- `uvr-server/tests/` — pytest with fake runners, no GPU: pass order and
  arguments, stem mapping, the fold, missing outputs, the workarounds, and
  the `/split` response, pruning and 500 path.
- `uvr-server/requirements*.txt`, `pytest.ini`, `README.md` — setup (uv,
  Python 3.10, CUDA torch, then the editable runner), env vars, run and test
  commands. It pins `setuptools<81` because librosa 0.9.2 imports
  `pkg_resources`.
- `start-all.bat` — start `uvr-server` on 8002 when `uvr-server\venv`
  exists, otherwise `demucs-server` as before.
- `.gitignore` — `uvr-server/{data,venv,runner,model-configs}/`.

### Open questions

- **The SPLIT button still says DEMUCS.** With `uvr-server` behind it, that
  label is inaccurate. `/health` already returns `backend: "uvr"`. Passing
  it through `GET /api/split/health` to the button touches the server route
  and both split pickers, so it's a separate small PR if wanted.
- **6-stem output (`htdemucs_6s`: guitar, piano)** would need new
  `StemKind`s and layer kinds. That is a scope question, not part of this
  change.
- **Upstreaming the two runner fixes** to chyinan/uvr-headless-runner would
  let `uvr_models.py` go away, along with the switch from PyPI to a git
  checkout.

## Cover Lyrics From the Recording (planned 2026-10-01)

On COVER · YUE2 an **uploaded** source fills LYRICS only with the score's
section outline (`[Intro]`, `[Verse]`, …). SheetSage2 reads the melody,
never the words, and a library source's stored lyrics are the only words
Mulakai can seed ("Client cover decisions"). The user asked for the words
sung in an upload to be read back into LYRICS. That is lyric
transcription, which the covers plan left out of scope ("Lyric
transcription … is out of scope", point 4). This section plans it.

### What is available (checked 2026-10-01)

- **HeartTranscriptor-oss** (`HeartMuLa/HeartTranscriptor-oss`, revision
  `918f8891`): a Whisper fine-tuned for *lyrics*, not speech.
  - Apache-2.0. That is looser than every music model in the stack, which
    are all CC BY-NC.
  - It has Whisper-medium's shape: 24 + 24 layers, `d_model` 1024, 80 mel
    bins. The weights are 3.06 GB in fp32, about 1.5 GB in fp16.
  - Languages: zh, en, ja, ko, es.
  - It was trained on **separated vocal tracks**. Upstream recommends
    separating the vocals first.
  - heartlib already ships it as `HeartTranscriptorPipeline`: a
    Transformers ASR pipeline, in 30 s chunks, used in fp16 with beam 2.
    It is in the venv `heartmula-server` already uses
    (`S:\AI Gen\heartlib`). The weights are **not** downloaded yet
    (`ckpt/HeartTranscriptor-oss` is missing).
- **Generic Whisper** (faster-whisper large-v3, or `stable-ts` around it):
  word-level timestamps, which is what the 2026-07-08 lyric-timestamp to-do
  (under "Open Questions For Later Phases") wants. It is trained on speech,
  so sung words are its weak point. It is not installed anywhere.
- **ACE-Step's `/v1/analyze_audio`** (the mulakai fork): its LM
  "describes" a track, lyrics included. The ACE-Step COVER tab already
  uses it (ANALYZE AUDIO). How its lyrics compare with an ASR is
  unmeasured; an LM describing audio may paraphrase rather than transcribe.
- **Vocal isolation is already there.** `uvr-server` (Roformer vocals,
  merged in #53) sits behind `DEMUCS_API_URL`, with `demucs-server` as the
  fallback. `POST /split` returns vocals / drums / bass / other.

### Decisions (proposed; the spike confirms or changes them)

1. **A spike picks the model before any code.** Three candidates, all run
   on the same songs:
   - HeartTranscriptor on the separated vocals;
   - faster-whisper large-v3 on the separated vocals;
   - ACE-Step's `analyze_audio` on the mix.
   The measure is **word error rate against known lyrics**. Library songs
   made by ACE-Step carry the lyrics they were sung from, so the reference
   is free (tags stripped; case and punctuation normalised). Each model is
   also run on the unseparated mix, to price the separation step. Time and
   peak VRAM are recorded.
2. **Words are placed by time, not order.** An ASR returns segments with
   start times.
   - The score's section comments sit at known bars, and its tempo and
     meter turn bars into seconds.
   - Each segment goes under the section its midpoint falls in. That fixes
     the one thing order-based `fitLyricsToSections` can't: a verse the
     ASR missed would otherwise shift every later block up one section.
   - Order-based fitting stays as the fallback when there are no
     timestamps (e.g. `analyze_audio`).
   - It needs the time of the score's bar 1 in the source (see open
     questions).
3. **An explicit action, not automatic: READ LYRICS.** It sits next to
   TRANSCRIBE on COVER · YUE2, and is live once a source is picked.
   - It costs a vocal split (about 50 s warm for a 3½-minute song on
     `uvr-server`) plus the ASR. That is too much to add silently to every
     transcription, and a library source already has its words.
   - The result replaces LYRICS only when LYRICS is empty or still just the
     section outline. Otherwise it asks first, with the consequence stated
     inline, like FEELING LUCKY's confirm.
   - Consequence line: "reads the words sung in the source into LYRICS ·
     separates the vocals first, about a minute · nothing is saved to your
     library".
4. **Mulakai orchestrates; the services stay single-purpose.**
   - `POST /api/lyrics/transcribe` takes a multipart source and runs one
     job under the genLock (a new `lyrics` kind), polled through
     `GET /api/generate/:jobId`:
     1. It asks the split service for vocals.
     2. It hands them to the ASR service.
     3. The finished job carries `{language, segments: [{text, start,
        end}]}`.
   - It holds the lock across both steps, so nothing else loads a model
     in between.
5. **Where the ASR runs depends on the winner.**
   - *HeartTranscriptor*: `heartmula-server` gains a lyrics job
     (`POST /v1/lyrics`), because heartlib's venv already has the pipeline.
     It loads per job and is freed afterwards, like its generation model.
     Its availability is probed like `coverReady`.
   - *Generic Whisper*: a small `lyrics-server/` of its own. That also
     serves the lyric-timestamp to-do later (word timings for the Editor's
     region select).
6. **VOCAL LANGUAGE is passed as the ASR language when set**, and
   auto-detect is used otherwise. HeartTranscriptor covers en/zh/ja/ko/es;
   YuE2 sings en/zh.
7. **Scope.** v1 only fills LYRICS on COVER · YUE2. It stores no words or
   timings, and it doesn't touch the Editor. A split service that could
   return only the vocals would halve the separation time. That would be
   an optional `stems=vocals` on `uvr-server`'s `/split`, and pass 1 alone
   is enough there. It is left for after the spike shows the time matters.

### File-level plan

**PR 0 — spike (`docs/cover-lyrics-asr-spike`, PLAN.md only).** In a
scratch venv or the heartlib venv, with the numbers written back here:

- Download HeartTranscriptor-oss into `S:\AI Gen\heartlib\ckpt`. Install
  faster-whisper in a scratch venv.
- Take three library songs with stored lyrics: *Ellies City 2*, *Purple
  Shinings*, and a third with denser words. Split each through
  `uvr-server`.
- Run the three candidates (point 1), on the vocals and on the mix. Record
  WER, run time and peak VRAM.
- Check whether segment timestamps land lyric lines in the right score
  section (point 2), using the spike scores from "Cover spike results".
- Answer the open questions below that the data can answer.

**PR 1 — the ASR service**, `heartmula-server` or `lyrics-server/`
depending on point 5:
- the lyrics job route and its model loading and freeing;
- availability health;
- tests with a fake model;
- README setup (the weights download).

**PR 2 — Mulakai server** (`feat/cover-lyrics-server`):
- `services/lyricsJobs.ts`: split vocals → ASR → segments, under the
  `lyrics` genLock kind;
- the client for the ASR route;
- `POST /api/lyrics/transcribe`;
- an `EngineInfo`-style `lyricsReady` probe;
- tests alongside each.

**PR 3 — client** (`feat/cover-lyrics-ui`):
- READ LYRICS on the YuE2 cover panel, with its progress and consequence
  line;
- `coverLyrics.ts` gains `placeSegmentsInSections(segments, abc,
  offsetSeconds)`, pure and tested;
- the replace-or-confirm rule (point 3);
- DESIGN.md in its own commit;
- a browser check: upload → TRANSCRIBE → READ LYRICS → the words land
  under the right sections → GENERATE COVER.

### Rollout

PR 0 decides the model, and whether this is worth building at all. If no
candidate gets sung words close enough to save typing (a WER the spike
records against a quick "would I fix this or retype it" read), the section
gets a "not pursued" note and the upload hint stays as it is. PRs 1–3 then
land in order.

### Open questions

- **Where bar 1 sits in the source.** Placing words by time needs the
  offset of the score's first downbeat. SheetSage2 writes `downbeat.lab`;
  `yue-server` could return its first entry with the transcription. Or
  does the score's start already match the audio closely enough? The
  spike measures it.
- **Automatic for uploads after all?** If the spike's split + ASR comes
  in well under a minute, running READ LYRICS with TRANSCRIBE for an
  upload (only when LYRICS is empty) might be the better default.
- **Beyond YuE2 covers.** The same action would serve ACE-Step's COVER
  (whose ANALYZE AUDIO is LM-described lyrics) and imports without
  lyrics. Worth widening once v1 has shown its accuracy?
- **Word timestamps for the Editor.** If generic Whisper wins, the same
  service is most of the 2026-07-08 lyric-timestamp to-do. Plan that
  separately, or fold it in?

### Cover lyrics spike results (2026-10-01)

**Verdict: go ahead, with faster-whisper large-v3 on the unseparated mix.**
- It reads sung words well enough to fix rather than retype: mean WER
  0.14 on the mix.
- It places lines in the right score section 0.90–0.97 of the time.
- It needs no vocal split. That drops the split's 43–88 s per song, leaving
  3–15 s of ASR.
- HeartTranscriptor did worse (0.29 on separated vocals, unusable on one
  mix), emits no segment timestamps, and its word timings only run at
  beam 1. ACE-Step's `analyze_audio` does not transcribe at all.

Run on Windows (RTX 4080 16 GB) against the running app's services. The
card was checked idle before each GPU run, and one model ran at a time.

**Sources.** Four ACE-Step songs from the library, with their stored lyrics
as the reference:
- *Ellies City 2*: trip-hop, female, en, 140 s, 94 words.
- *Purple Shinings*: dream pop, female, en, 177 s, 93 words.
- *Tanz im Loop*: techno, processed male vocal, de, 384 s, 462 words. It is
  the densest lyrics in the library, and German, which HeartTranscriptor
  doesn't list.
- *Unmoving*: ambient, whispery female, en, 213 s, 79 words. Its first
  take is used, not the later repaint.

Each was split through `uvr-server` (BS-Roformer). That took 50, 43, 88 and
51 s, warm.

**Setup.**
- **HeartTranscriptor-oss** (rev `918f8891`, now in
  `S:\AI Gen\heartlib\ckpt\HeartTranscriptor-oss`, 3.06 GB) ran in
  heartlib's venv: torch 2.6.0+cu126, Transformers 4.57.0. It used
  `HeartTranscriptorPipeline` with the example's settings: fp16, beam 2,
  temperature fallback, 30 s chunks, batch 16.
- **faster-whisper** 1.2.1 (CTranslate2 4.8.2) ran in a scratch Python 3.11
  venv: `Systran/faster-whisper-large-v3`, rev `edaa852e`, fp16.
  - On Windows, CTranslate2 needs the cuBLAS and cuDNN 9 DLLs from the
    `nvidia-cublas-cu12` and `nvidia-cudnn-cu12` wheels on `PATH`.
- **`analyze_audio`** ran on the running ACE-Step (xl-sft + 4B LM).
- **WER** is jiwer 4.0. Both sides are normalised the same way: `[tags]`
  and balanced `(…)`/`（…）` removed, lowercase, apostrophes dropped, other
  punctuation turned into spaces.

**WER** (mix · separated vocals; lower is better):

| Candidate, settings | Ellies | Purple | Tanz (de) | Unmoving | Mean |
| --- | --- | --- | --- | --- | --- |
| HeartTranscriptor, heartlib settings, language auto | 0.17 · 0.27 | 0.33 · 0.33 | 0.31 · 0.25 | 1.78 · 0.43 | 0.65 · 0.32 |
| HeartTranscriptor, language given | 0.17 · 0.26 | 0.37 · 0.24 | 0.24 · 0.27 | 1.95 · 0.38 | 0.68 · 0.29 |
| HeartTranscriptor, word timings (beam 1, temp 0, batch 1) | 0.21 · 0.60 | 0.35 · 0.31 | 0.56 · 0.34 | 2.28 · 0.35 | 0.85 · 0.40 |
| faster-whisper, library defaults, language auto | 0.19 · 0.18 | 1.14 · 0.73 | 0.48 · 0.46 | 0.82 · 1.00 | 0.66 · 0.59 |
| faster-whisper, library defaults, language given | 0.13 · 0.14 | 0.14 · 0.70 | 0.41 · 0.75 | 0.16 · 1.00 | 0.21 · 0.65 |
| **faster-whisper, `condition_on_previous_text=False`** | 0.14 · 0.15 | 0.14 · 0.37 | 0.23 · 0.30 | 0.06 · 0.16 | **0.14** · 0.25 |
| … plus `word_timestamps=True` | 0.14 · 0.23 | 0.16 · 0.33 | 0.22 · 0.30 | 0.05 · 0.18 | **0.14** · 0.26 |
| … plus Silero VAD | 0.69 · 0.18 | 1.00 · 0.35 | 0.37 · 0.24 | 1.00 · 0.70 | 0.76 · 0.37 |
| ACE-Step `analyze_audio` | 1.01 · 1.24 | 1.09 · 0.97 | 1.05 · 1.18 | 0.95 · 1.05 | 1.02 · 1.11 |

- **The bold rows are deterministic.** A repeat run, and a run with the
  language auto-detected instead of given, matched them to the third
  decimal. Auto-detect was right on all 8 inputs (en ×6, de ×2).
- **The library defaults are not stable.** Giving the language it had
  already detected correctly moved Purple's mix from 1.14 to 0.14. The
  repetition loops' temperature fallback is random, so that is not the
  language's effect.
- **The reference is a little noisy.** Substitutions that faster-whisper
  and HeartTranscriptor make identically are only 1–4% of reference words.
  Those are where ACE-Step sang something else.
  - *Ellies*: "Crashing signs", "Under the shadows", "Anonymous never
    sleeps". ACE-Step's own stored `lyric_timestamps` for that take read
    "Crash and signs … Under the shadows".
  - *Tanz*: the reference has typos ("einoid", "meinrt", "getrafft"), and
    the song sings one more chorus than it lists.
  - So the true WER is a few points lower than the table's.
- **Would I fix or retype?** Fix. The winner's *Ellies* mix comes back as
  the right lines in the right order:
  - "Midnight city streets are wet / Crashing signs and silhouettes /
    Crashing walking through the urban maze / …".
  - The edits are single words, plus deleting a hallucinated last line.
  - *Tanz* at 0.22 reads the same way, in German: "Leg die Kai in die Tüte
    und das Hirn ins System / Verlasse meinen Körper, ich will
    durchgehen / …".

**Failures and quirks found.**
- **HeartTranscriptor emits no timestamps.** Every result is one chunk with
  `start`/`end` of `None` ("Whisper did not predict an ending timestamp").
  The fine-tune dropped timestamp tokens.
- **Its word timings are fragile.** They come from the inherited
  cross-attention `alignment_heads`.
  - In Transformers 4.57 they crash (`_extract_token_timestamps`,
    IndexError) with beam 2 or with temperature fallback. They only run at
    beam 1, temperature 0.
  - At heartlib's batch 16, they filled the 16 GB card and stalled; that
    run was stopped. Batch 1 works.
  - Its first word absorbs the intro ("Midnight" 0.0–12.0 s).
- **HeartTranscriptor hallucinates.**
  - Chinese translation lines are interleaved on *Ellies*' vocals and on
    *Tanz*. Passing the language through the pipeline brought the same
    Chinese passages back on all three inputs.
  - YouTube outros: "Thank you for listening! Please, like, Share, and
    Subscribe!".
  - Repetition loops: "be still" ×40 on *Unmoving*'s mix, hence WER 1.8–2.3.
- **faster-whisper's defaults loop on separated vocals.** Insertions were
  0.53–0.58 on *Purple* and *Tanz*, and it wrote "Thank you for watching!"
  ×8 over *Unmoving*'s whispered vocal stem. Turning
  `condition_on_previous_text` off fixes this.
- **VAD drops whispered singing and most of a mix.** Not for v1.
- **Every Whisper run invents 1–3 lines over the instrumental tail.**
  Examples: "Thanks for watching!", "Untertitelung des ZDF, 2020", "Bis zum
  nächsten Mal." They are counted in the WER above.
  - Dropping whole-window (≥ 25 s) segments removes most of them. It also
    drops real lines (a first segment that absorbs the intro), so
    `lyrics-server` needs a known-phrase list plus `no_speech_prob`.
- **`analyze_audio` makes up new lyrics.** For *Ellies*' mix it wrote
  French lyrics ("Dieu, mort, vie, c'est le même chemin"). WER is about
  1.0 on all 8 inputs.

**Speed and VRAM** (warm; model load from a warm file cache; VRAM is the
card's peak over idle):

| | Load | ASR per song (140 / 177 / 384 / 213 s) | VRAM |
| --- | --- | --- | --- |
| faster-whisper, winner settings, mix | 2.8 s | 3.0 / 2.7 / 12.4 / 3.1 s | 4.3–5.6 GB across the logged faster-whisper runs (the winner's own run wasn't logged) |
| HeartTranscriptor, heartlib settings, vocals | 1.4 s | 6.6 / 4.2 / 14.9 / 4.1 s | up to 12.5 GB (allocated 3.8–7.8 GB, grows with length) |
| HeartTranscriptor, word timings, batch 1 | 1.2 s | 10–52 s | 4.0–4.6 GB |
| `analyze_audio` | resident | 27–83 s | 10.3–11.3 GB |
| `uvr-server` split (not needed by the winner) | resident | 50 / 43 / 88 / 51 s | — |

A cold load (about 3 GB from disk) was not measured.

**Section placement** (point 2). The scores are the SheetSage2 ones from
"Cover spike results" for *Ellies* and *Purple*. *Tanz* was transcribed the
same way (`--melody-only`, 43 s wall).

- **The score's bar grid vs the audio.** Each section's start was computed
  as first downbeat + bars × (60 / Q × beats per bar), then compared with
  that bar's time in `downbeat.lab`.
  - Score bar *i* is downbeat *i* in all three scores. *Ellies* has 44
    bars and 44 downbeats, *Purple* 65 and 65. *Tanz* has 240 bars for 221
    downbeats; its last 19 bars are the closing interlude.
  - *Ellies*: within 0.04 s on every section.
  - *Tanz*: 0.00 s on all 14.
  - *Purple*: 2.52–2.58 s late on every section after the intro.
    SheetSage's first downbeat interval is a 0.35 s fragment (0.01 → 0.36
    s), and the score counts it as a full bar.
- **Where lines land.** The truth is ACE-Step's stored per-line
  `lyric_timestamps`, mapped to each ASR segment through the text
  alignment. *Purple* has no stored timings.
  - Some segments aligned to a different repeat of a chorus line, more than
    20 s away. They were skipped as ambiguous: 12–14 on *Tanz*, 1 on
    *Ellies*.
  - Results for faster-whisper, winner settings plus word timestamps, mix
    and vocals:

    | Placement | Ellies | Tanz |
    | --- | --- | --- |
    | segment midpoint | 0.90 · 0.95 | 0.95 · 0.94 |
    | **median of the segment's word midpoints** | 0.90 · 0.95 | **0.97 · 0.97** |
    | segment cut at section starts, by word | 0.83 · 0.86 | 0.89 · 0.90 |

  - **Lines start before the downbeat.** Cutting at section starts is worse
    because sung lines start on a pickup: "Die Stadt liegt still" is sung
    at 62.8–64.1 s, and its verse starts at 64.0 s. So a line stays whole.
  - **The median fixes the first line.** Placing by the median word fixes a
    first segment whose start absorbs the intro (*Tanz*'s "Leg die KI …",
    0.0–15.3 s).
  - The remaining misses are long merged segments at a boundary.
  - *Purple* (no truth timings) was compared with exact-downbeat placement
    instead. It matched 0.89–0.95, entirely because of the 2.5 s grid
    error.
- **Order-based fitting can't serve ASR output.** An ASR returns no tags,
  so `fitLyricsToSections` sees one block and puts every word under the
  first sung section. Time placement is required for ASR text, not just
  better.
- **The score's labels match the song's own tags only 0.36–0.75 of the
  time.** *Purple*'s choruses came out as "verse". This is SheetSage's
  labelling, the same under any placement, and the cover follows the
  score's tags anyway ("Cover spike results").

**What changes in the decisions above.**
- **1 · Model:** faster-whisper large-v3, fp16, beam 5,
  `condition_on_previous_text=False`, `word_timestamps=True`.
  HeartTranscriptor is not used.
- **2 · Placement:**
  - Each segment is kept whole and placed by the median of its words'
    midpoints.
  - Section start times come from `downbeat.lab`, not Q × bars.
    `yue-server` returns each section's start in seconds with the
    transcription. That is `downbeats[bar0]`; score bar *i* is downbeat
    *i*.
  - `placeSegmentsInSections(segments, sectionStarts)` replaces
    `(segments, abc, offsetSeconds)`.
- **3 · Consequence line:** there is no separation step any more, so it
  becomes "reads the words sung in the source into LYRICS · about 10
  seconds · nothing is saved to your library" (exact wording in PR 3).
- **4 · The job:**
  - It sends the source mix straight to the ASR, with no split call.
  - It still holds the genLock: the same model peaked at 4.3–5.6 GB.
  - `lyrics-server` drops Whisper's known outro hallucinations before
    returning segments.
- **5 · Where it runs:** a `lyrics-server/` of its own (faster-whisper).
  - `heartmula-server` is not touched.
  - The model is MIT-licensed and about 3 GB.
  - The README covers the cuBLAS/cuDNN wheels on Windows.
- **6 · Language:** holds. VOCAL LANGUAGE is passed when set, and
  auto-detect otherwise.
- **7 · Scope:** `stems=vocals` on `uvr-server` is not needed.

**Answers to the open questions.**
- **Where bar 1 sits:** at the first downbeat, which was 0.00–0.01 s in all
  three scores.
  - The tempo grid holds to 0.04 s when the first bar is whole.
  - It is a bar off (2.5 s) when SheetSage starts on a fragment (*Purple*).
  - Neither "score start = audio start" nor a single offset is safe.
    `yue-server` returns per-section start seconds from `downbeat.lab`
    (point 2 above).
- **Automatic for uploads:** the cost objection is gone.
  - ASR on the mix is 3–15 s per song after a 3 s load, with no split. That
    is well under a minute.
  - Running it with TRANSCRIBE when LYRICS is empty is now a reasonable
    default, with READ LYRICS kept to re-read. This is a product call for
    PR 3's review.
  - It would also add about 5.5 GB of load after SheetSage, one after the
    other under the lock.
- **Beyond YuE2 covers:** worth widening after v1. ACE-Step COVER's ANALYZE
  AUDIO lyrics are not the song's words (WER about 1.0, once in another
  language), so READ LYRICS would give that tab real words for the first
  time.
- **Word timestamps for the Editor:**
  - The winner already produces word timings, at no extra time (21 s vs
    26 s over all four mixes).
  - `lyrics-server` should return words from day one.
  - The Editor's lyric-timestamp to-do still gets its own plan, since it
    touches the Editor, but it needs no new service.

**Caveats.**
- Four songs, all ACE-Step-made: clean, centred, synthetic vocals. A dense
  commercial mix is unmeasured, and the vocals stem might win there. PR 3's
  browser check uses one real upload, and the vocals path stays a fallback
  to measure, not a v1 feature.
- Single runs. The winner was shown to be deterministic; the other rows may
  move between runs.

**Cleanup.**
- The scratch venv, the faster-whisper model cache, the audio copies and
  the four `uvr-server` job folders were removed, along with the WSL temp
  transcription.
- HeartTranscriptor's weights (3.06 GB) are still in
  `S:\AI Gen\heartlib\ckpt\HeartTranscriptor-oss`. Nothing uses them now,
  and they can be deleted.

### lyrics-server contract (PR 1, 2026-10-01)

- **Process.** `lyrics-server/` is a FastAPI service on port 8005, in its
  own venv, built like `uvr-server`. The HTTP layer takes an injected
  transcriber, so the tests need no model.
- **`GET /health`** returns `{"ok": true, "backend": "faster-whisper",
  "model": …}` and loads nothing. PR 2's `lyricsReady` probe calls it.
- **`POST /transcribe`** takes a multipart `audio` field and an optional
  `language` form field. An empty `language` means auto-detect.
  - It returns `{"language": "en", "segments": [{"text", "start", "end",
    "words": [{"text", "start", "end"}]}]}`, with times in seconds rounded
    to 0.01.
  - A failure returns 500 with the reason in `detail`.
  - One job runs at a time, under a lock, like `uvr-server`'s.
- **The model loads per job and is freed afterwards.** That costs a 3 s
  load against a 3–15 s job, and the 4–6 GB goes back to ACE-Step and the
  engines in between.
- **Settings are fixed to the spike's winner:** large-v3, fp16, beam 5,
  `condition_on_previous_text=False`, `word_timestamps=True`, no VAD.
  `LYRICS_MODEL`, `LYRICS_DEVICE` and `LYRICS_COMPUTE_TYPE` override the
  model and where it runs, for a smaller card.
- **Hallucinations** are dropped per segment before returning:
  - Anywhere: segments with no letters (e.g. "🎵"), and stock phrases that
    are never lyrics ("thanks/thank you for watching", "… for listening",
    "subscribe", "Untertitel…", "subtitles by").
  - When it is the whole segment: a subtitle cue ("… Musik …", "[Music]",
    "Applaus"). The first live run produced one over *Tanz*'s outro.
  - Only in the trailing run after the last real line: phrases a song could
    sing ("thank you", "vielen Dank", "bis zum nächsten Mal").
  - `no_speech_prob` thresholds are left out. The spike didn't measure
    them, and PR 3's browser check is where an unfiltered one would show
    up.
- **Not in PR 1:** `start-all.bat` and `LYRICS_API_URL` arrive with PR 2,
  the first consumer.

## ANALYZE AUDIO on COVER · YUE2 (planned 2026-10-01)

A YuE2 cover needs a style PROMPT: `buildYue2Request` throws "YUE2 needs a
PROMPT" for a sung request with no style. For an upload there is no quick
way to get one on the YUE2 panel. Today the workaround is to switch COVER's
ENGINE to ACE-STEP, press ANALYZE AUDIO and switch back. That leaves
ACE-Step's prose caption in PROMPT, plus BPM / KEY / DURATION the score
already fixes. This section puts ANALYZE AUDIO on the YUE2 panel and
rewrites the caption into YuE2-style tags.

### Decisions

1. **ANALYZE AUDIO on the YUE2 panel reuses ACE-Step's analysis.** It is
   the same `AnalyzeAudioButton` and `useAnalyzeSourceAudio` call, with
   COVER's ACE-Step model (`draft.audio.model`). `CreateAudioTab` already
   auto-picks that model on mount, whichever engine is selected.
   - It sits under PROMPT, above LYRICS, as it does on ACE-STEP: between
     the two fields it fills.
   - It needs a picked source. A reused score with no source can't be
     analyzed; there is no audio.
   - It is off while TRANSCRIBE runs, while any job holds the lock, and
     when no ACE-Step model supports cover. A line says so. The analysis
     loads a DiT and the LM onto the card, and must not run next to a
     YuE2 job.
   - It does **not** use `useAnalyzeAndApply`. That hook also writes BPM,
     KEY-SCALE and DURATION, which the score fixes on YUE2 (covers point
     5). They would also carry into the other tabs' shared SONG DETAILS.
2. **The prose → tags rewrite is a pure extractor, not the LM.**
   - ACE-Step's LM has fixed tasks: describe audio, format input, make a
     sample. None of them writes a comma-separated tag list. `/format`
     rewrites a caption into more prose. A second LM call would also cost
     GPU time and a model load for text that a vocabulary match handles.
   - `styleTags.ts` (new, pure) finds phrases from four vocabularies in
     the caption: **genre**, **vocal character**, **mood** and
     **instruments**.
     - A phrase is a head word ("guitar", "vocal", "trap") plus up to two
       modifiers from its category's list, to its left: "rhythmic electric
       guitar", "warm female vocal", "latin trap".
     - Genre also takes any `-pop`, `-rock`, `-hop`, `-wave`, `-core` or
       `-step` compound ("samba-pop", "j-rock").
     - A negated phrase ("no drums", "without vocals") is skipped.
   - Output order follows upstream's example: voice, genre, mood,
     instruments, then vocal traits (falsetto, auto-tune). Upstream's
     example is "English, warm female vocal, contemporary pop, 96 BPM,
     piano, rounded electric bass, restrained drums, clear diction".
     - At most 2 voice, 2 genre, 2 mood and 4 instrument tags, in the
       order the caption mentions them.
     - A tag contained in a more specific one is dropped ("guitar" under
       "electric guitar").
   - **No tempo, key, meter or language.** The score fixes the first
     three. VOCAL LANGUAGE is prefixed server-side.
   - A caption that is already a tag list (short comma-separated parts)
     keeps its own tags, minus the tempo / key / meter / language ones.
   - **Nothing recognised → the caption as written.** YuE2's `style` is
     free text, so prose still works, and an empty PROMPT would block
     GENERATE. A hint says it wasn't rewritten.
   - **The vocabulary is ACE-Step's own guide.** "Style Tag Vocabulary for
     the Caption Field" was planned but never built, so there is no mined
     vocabulary to reuse. The lists start from `docs/ace-step-1.5/GUIDE.md`'s
     "Common Dimensions for Caption Writing" and that section's planned
     categories (genre, mood, instrument, vocal). They are extended with
     the words ACE-Step's captions use (its `examples/text2music`). The
     lists live in their own module, `styleTagVocab.ts`, so a later tag
     picker can share them.
3. **PROMPT is filled only when fillable.** `fillable(prompt, carried)`:
   PROMPT is empty, or it holds text carried from another tab. A prompt
   typed on COVER is never overwritten. The tags land in PROMPT as plain,
   editable text.
   - The full description stays readable under the button, in a collapsed
     SHOW DESCRIPTION block, so a dropped phrase can be put back by hand.
4. **LYRICS are filled too, when they have no words.** That is empty,
   carried from another tab, or only section tags (TRANSCRIBE's outline).
   Words typed here are kept.
   - With a score, the words are fitted onto its sections
     (`fitLyricsToSections`). The spike showed the source's own tags cost
     a third of the melody.
   - Without a score yet, they go in as ACE-Step wrote them.
     `transcribeStore` remembers the lyrics analysis wrote. When the score
     lands and LYRICS still holds exactly those lyrics, it fits them to
     the sections. Once edited, they are the user's and are left alone.
   - **They are described, not transcribed.** ACE-Step's LM describes the
     audio and may paraphrase. The consequence line says so. "Cover Lyrics
     From the Recording" plans real lyric transcription (READ LYRICS). If
     it ships, it replaces this lyrics fill.
5. **VOCAL LANGUAGE is filled when AUTO** and the analysis names a
   language YuE2 lists (en, zh). Upstream puts the language first in
   `style`, and the server prefixes it from this control.
   - When the lyrics it filled are in a language YuE2 doesn't list, a
     `.warn-note` names it. The browser check's source was sung in Turkish;
     YuE2 would have been handed Turkish words with nothing saying so.
6. **Consequence line** (DESIGN.md copy rule), under the button:
   "ACE-Step describes the source · fills an empty PROMPT with its style as
   tags (voice, genre, mood, instruments) and wordless LYRICS with the
   words it hears, described rather than transcribed · nothing is saved to
   your library".

### File-level plan

- `client/src/styleTagVocab.ts` (new): the four vocabularies, data only.
- `client/src/styleTags.ts` (new) + test: `captionToStyleTags(caption)`.
- `client/src/yueCoverAnalysis.ts` (new) + test: `yueAnalysisPatch`, which
  turns an analysis result and the draft into the fields to write (points
  3–5). Pure.
- `client/src/YueCoverAnalyze.tsx` (new): the button, its consequence
  line, the error and SHOW DESCRIPTION block. It applies the patch.
- `client/src/YueCoverGenerate.tsx`: renders it between PROMPT and LYRICS.
- `client/src/transcribeStore.ts` (+ test): `analyzedLyrics`, fitted to
  the score when it lands (point 4).
- `client/src/index.css`: the SHOW DESCRIPTION block reuses
  `.score-abc`'s look.
- `docs/design/DESIGN.md`: ANALYZE AUDIO on COVER · YUE2, in its own commit.
- `server/src/services/acestep.ts` (+ test): `analyzeAudio` reads the
  route's own field names (found in the browser check, below).

### Browser check (2026-10-01)

- **Browser-checked end to end.** This branch's client and server ran on a scratch library against real ACE-Step and yue-server
  (SheetSage2) processes on spare ports, with the GPU otherwise idle:
  - **ANALYZE AUDIO** on an uploaded 3½-minute piano ballad: ACE-Step's
    prose ("A delicate and melancholic piano ballad … arpeggiated piano …
    A clear, emotive female vocal …") became `emotive female vocal,
    cinematic, electronic, melancholic, nostalgic, arpeggiated piano, deep
    synth bass, spoken word`. A first run gave `breathy female vocal,
    ballad, melancholic, emotional, grand piano`; the LM samples. LYRICS
    filled, the outcome line and SHOW DESCRIPTION showed, and VOCAL
    LANGUAGE stayed AUTO.
  - **The source was sung in Turkish**, and nothing said YuE2 can't sing
    it. That added point 5's warn-note: "ACE-Step heard the words in TR —
    YUE2 sings EN, ZH".
  - **A server bug found along the way:** `analyzeAudio` read `keyscale` /
    `timesignature` / `language`, but `analyze_audio_route.py` answers
    with `key_scale` / `time_signature` / `vocal_language`. So ANALYZE
    AUDIO never filled KEY-SCALE or reported a language, on either engine.
    It now reads both spellings; the fixed run reported `tr` and F major,
    the key SheetSage2 found.
  - **TRANSCRIBE** gave 77 BPM, F major, 4/4, 68 bars, 3:32. The analyzed
    lyrics were re-tagged onto the score's sections as it landed
    (`[Intro] [Verse] [Chorus] [Verse] [Chorus] [Outro]`).
  - **GENERATE COVER** saved `COVER · YUE2` (77 BPM / F major / 3:07)
    with the tags as its caption, in about 90 s (48 s of tokens, 19 s of
    synthesis). An earlier attempt, while another process took part of
    the GPU, stalled at 0 synthesis steps for over five minutes and was
    aborted.

### Open questions

- **ANALYZE AUDIO holds no genLock.** `POST /api/generate/analyze-audio`
  never did, on either engine. The client disables it while a job holds
  the lock, but a job started in another tab can still overlap it. Should
  analysis take the lock under a new `analyze` kind?
- **Is the vocabulary wide enough?** It is hand-written. Once the style
  tag probe exists, its mined counts could show which common caption
  words the extractor misses.
