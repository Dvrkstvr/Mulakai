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

## Unified Audio Preview (planned 2026-07-29)

Approved mockup: claude.ai/code/artifact/6dc62f30-d2e7-44b0-ae83-b90bdb85be05
(all four views rendered with the pattern applied; live popover demos).

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
