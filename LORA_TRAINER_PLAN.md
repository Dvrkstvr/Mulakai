# Teach a Style — a mainstream LoRA trainer (planning doc, 2026-10-08)

Supersedes the *scope and UX* of `FORGE_PLAN.md` (2026-07-04). FORGE was a
power-user studio — datasets, hyperparameters, a hidden header icon, a calm
separate look. This plan is the opposite brief: **anyone who can make a song in
Mulakai can teach it a style**, with no ML vocabulary. Not implemented. Nothing
here is a PLAN.md section yet — see "Before code" at the bottom.

## The product in one paragraph

Pick 5–30 songs (from your Library, or import), name the style ("acid"), press
**TEACH STYLE**. Walk away. Mulakai builds the dataset, trains, and registers the
result. From then on typing `acid` in a caption makes the model use it — no
adapter picker, no rank, no epochs. A before/after listen at the end says
whether it worked.

## What already exists (do not rebuild)

- **Adapter loading is built** (`PLAN.md` "Adapter Loading (LoRA/LoKr) at
  Inference"): `server/src/services/adapters.ts`, `routes/adapters.ts`,
  `reconcileAdapter()` inside `ensureModelLoaded`, Settings › Models card. A
  trained style is just a registry row that training fills in for you.
- **Style Tag Vocabulary** for the caption field — the natural home for a
  trained style's trigger word.
- **Library songs already carry caption, lyrics, BPM, key, duration**
  (analyze-audio), i.e. most of what an ACE-Step dataset sample needs. We can
  skip ACE-Step's `/v1/dataset/auto_label` (which needs the LM) for our own songs.
- **The GPU queue** (`genQueue.ts`, `jobRunner.ts`, the plan-job unload
  invariant in CLAUDE.md) and the job-queue UI.
- `ForgeSection.tsx` — a Settings toggle for a placeholder screen. To be
  replaced, not extended.

## What the fork actually does (read from source, 2026-10-08)

- Routes live in `acestep/api/train_api_*.py`: dataset scan/load/sample/
  preprocess/auto-label, `POST /v1/training/start` (LoRA), `/start_lokr`,
  `/status`, `/stop`, `/export`. **Unverified:** that `uv run acestep-api`
  mounts them — CLAUDE.md says the plain `--enable-api` server is text2music-only
  (R-025). First spike item.
- **Training runs inside the serving process**, on the already-loaded handler: it
  moves the decoder to GPU, offloads VAE/text encoder/model encoder to CPU and
  **unloads the LM** (`train_api_lora_start_route.py:46-52`), runs in a daemon
  thread, then `restore()`s. So training **excludes all generation** — one GPU,
  one process. It must be a queue job that holds the slot.
- All paths (`tensor_dir`, output dir, audio dirs) are **on the ACE-Step host**.
  With the Studio Network setup (server on home.lan, GPU PC separate) our audio
  is on the wrong machine. There is no upload route for training audio.
- LoKr is the mainstream default: ~5 min vs ~1 h for LoRA per the tutorial; API
  defaults `lr 0.03`, `500 epochs`, `dim 64`. `status` gives step, loss history,
  `steps_per_second`, `estimated_time_remaining`; checkpoints every
  `save_every_n_epochs`.
- **Hardware:** the tutorial says 16 GB minimum, ~17 GB typical on full songs.
  This machine is an RTX 4080 16 GB — **borderline**. Gradient checkpointing and
  fp8 exist as flags; the spike must measure, not assume.

## Decisions (recommendations — Calvin to confirm the starred ones)

1. **\* Not a hidden separate mode.** Reverses FORGE's "hidden, calm, header
   icon". A mainstream feature has to be where people already are:
   - Library: multi-select songs → **TEACH A STYLE**.
   - Settings › Styles: the list of taught styles (rename, delete, strength).
   - A guided takeover like Create, in the main design language (zero radius,
     acid for the one commit action). A trained style is an AI-made artifact, so
     lilac is its hue. Progress shows in the existing job queue, not a new
     dashboard. DESIGN.md gets a section in the same PR.
2. **One verb, three presets, zero knobs.** QUICK / BALANCED / THOROUGH → LoKr
   epochs and checkpoint cadence, scaled by sample count. Rank, alpha, lr, shift,
   seed are fixed defaults in code. An ADVANCED drawer is a later question.
3. **LoKr only for v1.** LoRA stays available through the existing import path.
4. **One job, four phases, one queue slot:** STAGE (build manifest, move audio to
   the ACE-Step host) → PREPARE (preprocess to tensors) → TRAIN → REGISTER
   (export, `adapters` row, reinit + reconcile). Cancel = `/v1/training/stop`,
   keep the latest checkpoint, offer "use what's trained so far".
5. **\* Per-job adapter resolution amends the adapter plan.** That plan said "one
   active adapter, app-wide, never per-flow" because the server model is global.
   Jobs run one at a time in `genQueue`, so resolving the adapter *at job start*
   from the caption's trigger word (falling back to the Settings selection) is
   honest: `reconcileAdapter()` already runs there. The inline consequence line
   states which adapter a job will use.
6. **Trust loop.** After training, auto-render the same prompt+seed at strength 0
   and at the chosen strength, shown as the existing A/B listen page. Strength
   slider defaults ~0.8; an "EARLIER VERSION" slider walks the saved checkpoints
   (the simple answer to "too strong / overfit").
7. **Consequence lines** before commit: "locks the GPU for ~N min — generation
   waits", "uses 14 songs", "you can cancel and keep progress".
8. **Own music only**, stated in the wizard (one line, not a lecture). No adapter
   sharing/export in v1 — no accounts, no social (PLAN.md red lines).

## Phases

**P0 — Spike (gates everything).** On the real 4080 with ~10 real songs:
(a) are the training routes mounted in `acestep-api`; (b) peak VRAM and wall time
for LoKr with/without gradient checkpointing and fp8, full-length vs clipped
audio; (c) does an activation/trigger tag exist in the fork's dataset format
(ace-step-ui used one; unverified here); (d) how to get audio onto the GPU host —
add a small upload/stage route to the fork (editable since D-203) vs a shared
path; (e) does the PC stay awake for a 30+ min job under Studio Network's
idle-shutdown; (f) does the trained adapter load on the model the user generates
with (the adapter plan's open cross-model question). Output: a RESULT note and a
go/no-go. If (b) says 16 GB can't do full songs, the product becomes "clips only"
or "needs 20 GB" — better to know now.

**P1 — Server job.** Fork: stage/manifest route. Mulakai: `styleTrain` job in
`genQueue` with the unload invariant, phase progress mapped from `/status`, cancel,
failure → "retry with lower memory" (checkpointing on, then fp8). New tables:
`styles` (name, trigger, adapter_id, source song ids, preset, status, created_at);
`adapters` is reused. Keep-awake held for the job's life.

**P2 — Library → wizard.** Multi-select, name + preset, consequence lines, the
job in the queue, a finished-style card. Module cap 150/200 LOC: wizard, picker,
progress, result as separate files.

**P3 — Trigger binding + trust loop.** Caption trigger → per-job adapter;
before/after A/B; strength + earlier-version sliders; Styles list in Settings.

**P4 — Polish.** Imported audio (needs the LM auto-label path, sequenced so the LM
is unloaded before training), resume after a crash, clipped-audio option, per-style
notes ("trained on 14 songs, 2026-10-08").

## Risks

- **VRAM** (above) — could shrink the feature to clips or a bigger GPU.
- **GPU lockout** — a 5–30 min job freezes generation. Mitigated by the queue and
  honest copy; not removable on one GPU.
- **Path/host split** — the reason P0(d) exists.
- **Quality** — a few songs may give a weak or overfit style; the trust loop and
  earlier-version slider are the answer, not more settings.
- **Scope** — PLAN.md's Grand Goal excludes training tooling; this must be a
  recorded scope decision, not drift.

## Open questions

- Timing: still post-1.0 (the 2026-07-04 call), or pulled forward now that it is
  mainstream rather than a studio?
- Should a style also be offered as an ACE-Step *cover* conditioner (style from
  one song), or stay training-only?
- Multiple styles in one caption ("acid, dub") — blocked by one-adapter-at-a-time;
  say so in the UI rather than design stacking now.

## Before code

Per CLAUDE.md a 3+ file feature gets a dated PLAN.md section first, and this is a
scope question first. Next steps once confirmed: run P0 as a spike (the pipeline
has a spike-runner for exactly this), then add the PLAN.md section and
`/pipeline:feature` it. FORGE_PLAN.md and `ForgeSection.tsx` get retired with P2.
