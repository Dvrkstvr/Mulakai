# FORGE — LoRA/LoKr Training & Dataset Studio (planning doc, not yet implemented)

Deferred until Mulakai reaches "release 1.0" (explicit decision, 2026-07-04).
This document exists so the idea isn't lost between now and then — it is a
planning sketch, not an OpenSpec proposal. Run `/opsx:propose "forge"` when
work actually starts; treat everything below as a starting point to revise
during `/opsx:explore`, not a locked spec.

## Why this exists, and why it's separate

Mulakai's core promise (`PLAN.md`) is a **slim** single-song editor: generate,
repaint, layer, version. No accounts, no arrangement DAW, no training tooling
— that's the whole pitch. A LoRA/dataset studio is real, useful scope creep
against that promise (motivating case: the base ACE-Step model reportedly
can't produce good acid-genre tracks; training a small LoRA on a curated
acid dataset and loading it before generation is the fix). So it gets kept
**deliberately apart** from the creative core rather than woven into
Library/Create/Editor.

## Decisions locked in (from discussion, 2026-07-04)

- **Separation mechanism**: a 4th in-app mode, not a separate mini-app.
  Same repo/build, its own route/view, launched from a small icon in the
  header (next to the ACE-Step status pill) — not a peer of the Library/
  Create/Editor nav. Shares `api.ts`-style client code and the existing
  job-polling pattern (`server/src/services/jobs.ts`'s ~2s poll loop already
  used for generation) rather than inventing new plumbing.
- **Feature-gated, hidden by default** — per `AGENTS.md`'s "unfinished/WIP
  UI must not be exposed as usable by default" rule. A settings toggle or
  env flag reveals the header entry point; it does not show up for a casual
  user out of the box.
- **Name**: **FORGE**.
- **Visual direction**: calm, rectangular, table-oriented — *not* the core
  app's bold parallelogram/hexagon/five-hue language. Shares the bones
  (carbon canvas, zero border radius, 1px hairlines) but drops the skewed
  shape grammar entirely. Keeps **one** accent color reused with its
  existing meaning — acid, for "start training / commit" — rather than
  going fully monochrome or introducing a new hue (staying inside
  `DESIGN.md`'s "one hue, one job" rule rather than breaking it). Restrained
  motion: a plain progress bar, not the AI-shimmer gradient sweep reserved
  for the creative screens.
- **Design doc**: a short sibling doc, `docs/design/FORGE_DESIGN.md`, written
  when implementation starts — with a one-line pointer added to the main
  `DESIGN.md` noting FORGE is an intentional, scoped exception. Satisfies
  `AGENTS.md`'s "UI PRs that deviate from DESIGN.md must update DESIGN.md in
  the same PR" rule without diluting the main doc with an unrelated visual
  system.

## What ACE-Step 1.5 already gives us (verified 2026-07-04, native REST — no Gradio)

FORGE is a UI + thin proxy layer, not a reimplementation. ACE-Step's FastAPI
server (`acestep/api_server.py`, reached the same way Mulakai already reaches
`/release_task` etc.) already exposes:

- **Dataset**: `/v1/dataset/scan`, `/load`, `/save`, `/samples`,
  `/sample/{idx}` (GET/PUT), `/preprocess` (+ `_async`/`preprocess_status`),
  `/auto_label` (+ `_async`/`auto_label_status`).
- **Training**: `/v1/training/start`, `/start_lokr`, `/status`, `/stop`,
  `/export`, `/load_tensor_info`.
- **Adapters**: `/v1/lora/load`, `/unload`, `/toggle`, `/scale`, `/status`.
- **Model lifecycle**: `/v1/init` (already used by Mulakai's
  `server/src/services/acestep.ts#initModel` for DiT/LM slot loading — same
  mechanism, no new integration needed).

None of this requires the ACE-Step fork work the lyric-timestamp/audio-
analysis features needed — it's all already reachable over plain HTTP.

## What ace-step-ui-main's training UI is worth borrowing (checked 2026-07-04)

Per the user: this reference UI has never been run/tested — treat as a
sketch, not proof it works. It was reviewed and found to be a **Gradio
proof-of-concept**: most real operations (auto-label, model-init, training
start, export) go through `@gradio/client` lambda calls, and per the review,
**auto-labeling and model-init already return 501s in that repo** — dead
ends without a live Gradio session. So the backend layer is not reusable.
What *is* worth borrowing:

- **UI shape**: a 6-step pipeline tracker (Upload → Edit → Save → Preprocess
  → Train → Export) with a visual progress indicator per step
  (`TrainingPanel.tsx:37-44`, `:648-662`) — good scaffold for FORGE's own
  flow, adapted to native REST calls instead of Gradio.
- **Dataset editing UX**: table preview of samples with click-to-navigate
  rows (`:825-849`), per-sample metadata editor (caption, genre, lyrics,
  bpm, key, time signature, language, instrumental flag — `:911-990`),
  auto-label options (skip-metadata / format-lyrics / only-unlabeled —
  `:884-909`), drag-drop + directory-scan + load-existing-JSON as three
  dataset entry paths (`:301-382`).
- **Hyperparameter ranges/defaults** (`TrainingParams`, `:143-157`) — a
  reasonable starting point, but re-verify against ACE-Step 1.5's own
  training docs before shipping defaults, since ace-step-ui may target a
  different version:
  - `rank` 4–256 (default 64), `alpha` 4–512 (default 128)
  - `learningRate` default 0.0003, `dropout` 0–0.5 (default 0.1)
  - `epochs` 1–4000 (default 1000), `batchSize` 1–8,
    `gradientAccumulation` 1–16
  - `saveEvery` 50–1000 epochs, `shift` 1.0–5.0, `seed`
  - Notably **missing** a LoRA-vs-LoKr selector (it only ever calls the LoRA
    path) — FORGE should expose both, since ACE-Step 1.5 supports
    `/v1/training/start` (LoRA) and `/start_lokr` (LoKr) as distinct
    endpoints.
- **Component patterns**: a `ParamSlider` component and a small SVG loss
  chart (`:1160-1175`, `:593-623`) — fine to reference for shape, but
  rebuild in FORGE's own calm/rectangular visual language, not ported
  as-is (the source uses the bold ace-step-ui style).
- **Explicit anti-pattern to avoid**: the source component is ~1176 lines
  with 160+ `useState` calls in one file — exactly what `AGENTS.md`'s
  module-size policy (`<=150` LOC target, `200` hard cap) exists to prevent.
  Split FORGE's dataset/training/adapter concerns into separate small
  modules from the start.

## Data model

Mostly **stateless/proxied** — ACE-Step already owns dataset JSON and
training-job state server-side; Mulakai doesn't need to duplicate that.
The one thing worth a local table is bookkeeping FORGE doesn't get for
free from ACE-Step's stateless endpoints:

- `training_runs` (new SQLite table, own migration): `id`, `name`,
  `dataset_ref`, `adapter_type` (`lora`/`lokr`), `base_model`, `status`,
  `adapter_path`, `style_tag` (nullable — see the Create-screen bridge
  below), `created_at`. Gives FORGE a persisted history of past runs and
  is the join point for the style-tag → adapter bridge. No `users`/
  `profiles` shape — this app has no accounts, per `AGENTS.md` red lines.

## Phased plan

1. **Dataset browser** — scan/upload audio, table view + per-sample editor,
   auto-label via ACE-Step's real `/v1/dataset/auto_label(_async)`, save.
   Lowest risk, mostly read/edit, no long-running jobs yet.
2. **Training launch + monitor** — pick a saved dataset, choose LoRA or
   LoKr, hyperparameter form (defaults above, re-verified against current
   ACE-Step docs), start via `/v1/training/start(_lokr)`, poll
   `/v1/training/status` on the same cadence as existing generation jobs,
   stop via `/v1/training/stop`, simple loss/progress display.
3. **Adapter management** — list past `training_runs` + whatever
   `/v1/lora/status` reports live-loaded, load/unload/toggle/scale, a
   quick test-generate action to preview the adapter before committing to
   it anywhere else.
4. **Bridge back to Create** — tag a `training_runs` row with a
   `style_tag` (e.g. "acid"); when Create's prompt/style field contains
   that tag, auto-call `/v1/lora/load` + `/v1/lora/scale` before
   generating, so the fix for "the model can't do acid" becomes "type
   acid in the prompt" from the user's point of view, without a manual
   trip to FORGE each time. This is the actual payoff of the whole feature
   — don't let it slip to "someday."

## Open questions for `/opsx:explore` when this starts

- Exact hyperparameter defaults/ranges — re-verify against ACE-Step 1.5's
  own training documentation directly (not just ace-step-ui's numbers).
- Whether `/v1/dataset/preprocess` (blocking) vs `/preprocess_async` should
  be the default — likely async + poll, matching the rest of Mulakai's job
  pattern, but confirm preprocessing time is actually long enough to
  warrant it.
- Whether FORGE needs its own audio storage/upload path or can reuse
  whatever `server/src/services/*` already handles for song/layer audio.
- How multiple `style_tag`s resolve if a prompt matches more than one
  trained adapter — out of scope until adapter count > 1 is a real
  situation, don't design for it prematurely.
