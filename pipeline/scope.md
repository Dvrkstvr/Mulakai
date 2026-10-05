# Scope — MVP (the score agent)

<!-- Stage 4 draft, 2026-10-03. NOT signed off: the user's sign-off in chat is the one open gate item (D-### goes here once given).
     Features and pass flags live in features.json (F-016 onward are the score agent; F-001..F-015 are the existing app and keep their evidence).
     Spike evidence: spikes/SP-1-vram-handoff, SP-2-planner-quality, SP-3-cot-full-adherence RESULT.md. Owed to the user, not blockers:
     SP-3 A/B listen (12 pairs), SP-2 WRITE PHRASE listen. Where they inform the cut it says so. -->

What "MVP" means here: the existing app is past its MVP. This scope is the score agent only, ordered so that the first milestone is the
whole promise on the real machine, as thin as it can be, and everything else is judged against what M0 teaches.

## Preconditions (before any M0 code)

1. **P1 = F-016, the amendment (D-005, R-004).** A dated PLAN.md section "Score Agent" that supersedes "ABC score editing / agentic editing
   is out of scope" ("Engine: YuE2", "YuE2: Align With Upstream") and carries this file's decisions and interaction specs; AGENTS.md "Scope
   Discipline" amended so YuE2 may re-render its own song from an edited score (the "every edit after the first take runs on ACE-Step"
   line); the same wording fix in `yue-server/README.md` line 6. Docs-only PR, merged before the first code PR. D-015's PR already
   changed the first-take default and left this amendment to the score agent (PLAN.md "With the score agent", point 3).
2. **P2 = job queue (D-003, Q-005): satisfied in the working tree.** `server/src/services/genQueue.ts` exists on the checked-out branch
   (`docs/engine-lineup`), `genLock` survives only as a word in one test (seen in code, 2026-10-03), and DESIGN.md already describes S4
   part b. So the brief's "S4 NOT merged" row and R-007 are stale: M0 targets `genQueue` with two new kinds (`plan`, `scoreRender`).
   Verify on `main` with `git log main -- server/src/services/genQueue.ts` before starting; if S4 is not on `main`, M0 waits for it
   (D-003), it does not fall back to `genLock` (D-022).
3. **P3 = environment, documented in the PLAN.md section:** `LLM_API_URL` (Ollama), `LLM_MODEL` (default `qwen3:14b`),
   `OLLAMA_CONTEXT_LENGTH=16384` on the Ollama server, `ACESTEP_OFFLOAD_TO_CPU=true` (SP-1 measured with the three start-all.bat offload
   flags, 0.5 GB idle; the Gradio launcher held 4.8 GB and would not fit). The planner and a loaded ACE-Step must not co-reside.

## M0 — The core-promise path, headless first, then in the dock

What the user can do when M0 is done: open a library song that YuE2 made (one layer, no repaints, score with chords), pick the SCORE verb,
type "jazz chords in the chorus, 88 BPM", read a checked change list with a consequence line, press APPLY & RENDER, and get a new lilac
base version rendered by YuE2 with `cot` full at about 88 BPM, with the previous version one click away.

The cut, and why it is this thin:
- **Op set: SET TEMPO, REHARMONIZE, EDIT STYLE** (D-018). It is the smallest set that exercises every H risk: R-002 (planner + validator +
  retry loop: REHARMONIZE as `root`+`quality` enums, SP-2 100%), R-003 (hand-off), R-013 (tempo is reliable, harmony is the hard-to-hear
  case: roots followed 8/8 bars in 2 of 3 SP-3 songs). **WRITE PHRASE moves to M1**: it needs a second schema shape, a beat-sum retry loop,
  an `Ins` overlay applier, sanity gates and an unverified instrument; SP-2 shows it is where qwen3 fails (44% as ABC strings) and its
  musicality listen is still owed. It is the next-riskiest thing, so it is M1's whole job, not a rider on M0. The ≤ 3-retry loop with numeric
  feedback is in M0 anyway (a plan can fail the validator on 360 s or a bar number), so M1 adds an op, not a mechanism.
- No UI beyond one dock verb: a change list (one row per op with its verdict), one checks line, the consequence line. No bar map, no
  per-op drop, no Settings card, no Activity entry, no palette pre-fill (all M4). The plan job is visible in the dock's own state line only;
  an unknown queue kind must not break the Activity drawer (F-019 criterion).
- Eligibility is strict: YuE2 first take, one layer, no repaint versions, sidecar that passes `parse_abc`, score has chords (so `cot` full is
  right, D-010). Cover, instrumental and chord-free songs show the reason and wait for M3 (D-021).
- Lyrics and style are sent **as stored**, changed only by what an op says: SP-3 measured that normalizing `[Verse 1]` to `[Verse]` alone moves
  2-8% of the notes, so no op in M0 may re-derive tags (D-023). Tag derivation arrives with the first section op (M2).
- The plan lives in server memory with the job registry; a server restart loses it (D-020).
- Planner: dense qwen3:14b Q4_K_M at 16k context (10.9 GiB, 2 GiB of card left, 2.5 s cold load). The model name is an env setting; the 26B
  MoE (gemma4:26b-a4b, 16.98 GiB, card 96% full, 12-50 s cold load) is a supported *value*, not a tested configuration (D-024).
- Validator and applier run on the yue-server (R-016): CPU-only routes next to upstream `abc_tools.py`, not a TypeScript port (D-019).

Work packages, each one PR, in this order (risk first; the headless checkpoint burns down the real-platform risk before any UI):
1. W0 F-016 amendment (docs).
2. W1 F-017 yue-server score routes (apply / check / bar map / token+duration), golden tests from SP-2's 39 cases.
3. W2 F-018 eligibility, F-019 plan job, F-020 hand-off + context guard. **Checkpoint CP1:** a script (not the UI) runs request →
   plan → apply → render → new version against real Ollama + real yue-server on this machine; log kept. If CP1 fails a spike number
   (hand-off > 5 s, YuE2 < 80 tok/s, plan p50 > 60 s), stop and raise it before W3.
4. W3 F-021 dock verb, F-022 review limits, F-024 error and cancel states.
5. W4 F-023 APPLY & RENDER + version.
6. W5 F-025 the live run in the real app (the M0 exit).
Honest size: this is more than one focused week (W1 and W2 are each 2-3 days, W3-W5 about 4). It cannot be cut further without removing a step
of the promise; the CP1 checkpoint is where to re-plan if W1-W2 run long. Features: F-016 .. F-025.

M0 exit evidence (what "done" means; `passes` for F-025 stays false until the user's listen is in):
- one real run, on the real card, logged: plan latency (cold and warm), attempt count, unload-to-empty time, VRAM vs the pre-plan baseline,
  YuE2 tokens/s, duration estimate vs actual, `truncated` flag, tempo from median bar length within 4% of the new `Q:` (SP-3 `analyze.py`
  method), root agreement on the reharmonized bars (reported next to the SP-3 chance level, not pass/fail);
- owed to the user, numbered when F-025 is verified: A/B the two versions (base vN-1 vs vN) for tempo (expect "clearly") and chords
  ("clearly / slightly / no"). If the user hears the chord change in fewer than the 4 of 5 SP-3 pairs, REHARMONIZE ships with the "a
  request, not a guarantee" wording only and Q-001 C's fallback is raised before M1.

## M1 — The riskiest remaining op, the warning, the regression net

Highest remaining risk first: WRITE PHRASE as a phrase of `{pitch, beats}` notes, code writing the ABC (SP-2: 100% / 94% valid; free ABC strings
are Not doing). Then the first-ACE-Step-edit warning (Q-015 default A), because with YuE2 the default (D-015) every new song starts with SCORE
open and the first ACE-Step edit closes it (D-006), and the warning must exist before users have SCORE. Then the e2e: SCORE touches
the golden path, and CI has no Ollama or yue-server, so it needs two fakes. Features: F-026, F-027, F-028.
- If the user's SP-2 phrase listen (owed) says the phrases are not musical, F-026 ships with an "EXPERIMENTAL" label and a Q is raised
  (D-005's revisit clause is about validity, not taste); it is not a reason to delay M1.

Work packages (2026-10-05, autopilot), each one PR from `origin/main`, files named so batches stay disjoint:
1. W6 F-027 first-ACE-Step-edit warning: client consequence builders of REPAINT, ADD LAYER, extract-to-layer, REMASTER MIX
   (+ Vitests present/absent). Copy per D-030: "score editing ends after this edit, SCORE will be off for this song". Branch
   `feat/score-w6-warning`. Batch 1.
2. W7 F-026 yue-server half: phrase `{pitch, beats}` -> ABC writer (units, ties, bar sums), `Ins` overlay only where the Vocal rests,
   refusal naming the free bars, sanity gates (>= 4 notes, >= 3 pitches, >= 70% in key, not 4 identical bars), beat-sum errors with
   numbers; ported from SP-2 `score.py` `op_write_phrase`; pytest. Branch `feat/score-w7-phrase-yue`. Batch 1.
3. W9 F-028 e2e: fake Ollama + fake yue-server score routes in `e2e/` beside fake-acestep, a SCORE spec (happy path, planner offline,
   360 s refusal, cancel while planning), CI. The existing golden path unchanged, no LLM_API_URL. Branch `feat/score-w9-e2e`. Batch 1.
4. W8 F-026 server + client half (after W7's route contract): op schema (N bars per request), planner prompt + retry feedback, style
   append, change-list row, consequence clause "the instrument is a request, not a guarantee". Branch `feat/score-w8-phrase`. Batch 2.
5. CP2 live: the compound request on 3 library songs (copies), attempts logged; then the verifier for F-026..F-028.
6. W10 (if the round budget allows) Q-038 review nits, D-056. Branch `fix/score-m0-nits`. After W8 (shares server score files).

## M2 — Deterministic section ops, referents, revise

TRANSPOSE, REPEAT / CUT, REWRITE LYRICS, and the lyric-tag rule they force (R-018: tags rewritten from the edited score's `% section`
comments, the planner never writes tags; REPEAT un-ties the seam, the finding from `f3e3bfdc`). The dock's selection (section, lyric
line) goes with the request as the referent, since "which chorus" was the only intent failure in SP-2. REVISE: a follow-up request
that sees the pending plan. The duration guard learns to name the section to cut. Features: F-029 .. F-033.

## M3 — More songs

"New song from this score" for songs D-006 makes ineligible (the other half of D-006), and chord-free, instrumental and cover scores (the
`melody` render path, REHARMONIZE writing all chords makes it `full`). Features: F-034, F-035.

## M4 — Seeing and reaching it

Bar map in the review (the dock-body-height question R-006 is judged at stage 5 and may pull a collapsed bar map into M0's review if the layout wants
it), Settings planner card, Activity drawer entry for the plan, palette pre-fill. Features: F-036 .. F-039.

## Interaction specs

### SCORE verb (F-021, F-022, F-023, F-024) — states, transitions, error, cancel

States (the dock keeps the verb's body mounted; the verb is per-session state, as for the other four):
1. `hidden` — the song's base is not from YuE2 (ACE-Step songs, imports, HeartMuLa), or `LLM_API_URL` unset (feature-gated, AGENTS.md).
   No tab. (An unset `LLM_API_URL` is "not set up", not "offline".)
2. `ineligible` — a YuE2 song that fails D-006/R-017: more than one layer, a repaint version exists, sidecar missing or failing the validator,
   score has no chords (until M3). Body = one rust-free reason line naming the cause ("this song has a repaint version, score editing ended
   when it was made"); M3 adds NEW SONG FROM THIS SCORE.
3. `offline` — probe of `LLM_API_URL` (Ollama `GET /api/tags`, model present) failed: "PLANNER OFFLINE — start Ollama · model qwen3:14b
   not pulled: `ollama pull qwen3:14b`" in rust, with RECHECK. A non-Ollama server reads "LLM_API_URL is not an Ollama server: the GPU
   hand-off can't be confirmed" (D-012).
4. `asking` — request text field, empty example text, the one-line consequence "asks the planner · uses the GPU for ~10 s · changes nothing
   yet", and PLAN. The score reading (bars, duration, tempo, key) is shown as `text-low`.
5. `queued` — PLAN pressed while the GPU is busy: `PLANNING · QUEUED · STARTS AFTER 2 JOBS`; CANCEL.
6. `planning` — slot held; `PLANNING… attempt 1 of 3`; a retry shows the reason in `text-low` ("bar 5 had 31/32 units"); CANCEL. The slot is held
   across every attempt and the unload; the user's review never holds it.
7. `plan ready` — change list (SET TEMPO 87 → 88 BPM · REHARMONIZE bars 17-24 · EDIT STYLE …), each row with a verdict tick; checks line
   (`65 bars · est 183 s of 360 s · 1,520 of 4,096 tokens · chords valid`); consequence line (below); APPLY & RENDER (acid) enabled. The
   request field stays editable; editing it and pressing PLAN again replaces the plan (M2: REVISE sees it).
8. `check failed` — three attempts spent, or a hard limit, or a refused op, or context truncated, or the plan changes nothing:
   rust lines, one per cause with the number ("estimated 458 s: over the 360 s limit; at least 112 BPM fits"), APPLY & RENDER disabled,
   the request editable. An op the validator rejected is listed with its reason, never silently dropped.
9. `render queued` / `rendering` — APPLY & RENDER stays the commit (label never becomes progress), a job line under it:
   `RENDERING… 1:12 · 38%` (AI shader like repaint) or `RENDERING · QUEUED · STARTS AFTER 1 JOB`; CANCEL.
10. `done` — "Saved base v3 · 88.1 BPM, 3:04"; lilac version badge; the VERSIONS rail shows v3 active, v2 below it. A `truncated` result
   instead reads in rust "TRUNCATED at 6:00, the song is cut short — v3 is saved; revert in VERSIONS or shorten and re-render" (never DONE).
11. `render failed` — rust error from the engine job with RETRY RENDER; no new version; base unchanged; the plan is kept and reviewable.
12. `stale` — at APPLY & RENDER the server re-checks: eligibility lost (a repaint was queued after the plan), the base version is no longer the
   one planned against, or the plan expired (server restart): the refusal names the reason, no engine job starts; PLAN AGAIN.

Transitions:
- `hidden` ⇄ `ineligible` / `offline` / `asking`: song opened, song changed (a version added), probe result; the verb re-evaluates on song load.
- `asking` → PLAN → `queued` (slot busy) or `planning` (slot free); `queued` → `planning` when the slot is free.
- `planning` → `plan ready` (valid within 3 attempts) | `check failed` (invalid after 3, limits, truncation) | `offline` (planner unreachable
  mid-plan) | `asking` (CANCEL).
- `plan ready` → APPLY & RENDER → `stale` (re-check fails) | `render queued` → `rendering` → `done` | `render failed` | `plan ready` (CANCEL: plan kept).
- `plan ready` / `check failed` → edit request + PLAN → `planning` (the old plan stays visible, dimmed, until the new one is ready).
- `done` → request field cleared, `asking`; the new version's own sidecar is what the next plan reads.

Cancel:
- while `queued`: removed from the queue (existing `cancelQueued`), back to `asking` with the text kept.
- while `planning`: abort the HTTP call, then **still** `keep_alive 0` and poll `/api/ps` until empty before the slot is released (the same
  "slot waits for the backend to let go" shape as ABORT on a running job); back to `asking`, text kept, no plan.
- while `rendering`: the existing ABORT: the slot is held while YuE2 drains; no new version; base stays active; the plan stays on screen.
- closing the tab or reloading: server-side jobs continue; reopening SCORE rehydrates from the job (like generation jobs do).

Error:
- planner HTTP error / timeout / 404 model not found: after trying the unload anyway, → `offline` (names the cause and the fix).
- unload not confirmed (`/api/ps` still lists a model after 10 s): the plan job ends in an error naming the model and `ollama stop <model>`; the
  slot is released after the bound; **APPLY & RENDER refuses while `/api/ps` lists a model** (R-003 fallback, enforced at commit).
- context: after the call, `/api/ps` `context_length` below `prompt_tokens + 2,500`, or `usage.prompt_tokens` below the character-based
  lower bound for the prompt (the spike's silent-truncation signature: ~half the context), → `check failed`: "planner context is N, needs
  ~M: set OLLAMA_CONTEXT_LENGTH=16384". Never a plan from a truncated prompt.
- engine job errors use the existing rust error line + RETRY.

Consequence line (composed from the ops actually in the plan; D-007, R-013, R-014):
`Saves base v3 · re-renders the whole song on YuE2, about 3 min · every bar will sound different · tempo follows 88 BPM · harmony in bars 17-24 is a
request to YuE2, not a guarantee · v2 stays in VERSIONS`. SET TEMPO and REPEAT/CUT/TRANSPOSE state "follows" (reliable); REHARMONIZE and
WRITE PHRASE (and an instrument named in EDIT STYLE) state "a request, not a guarantee"; a plan of only reliable ops omits that clause.

Design tasks for stage 5 (layout decides these, not this file): DT-1 the SCORE dock body: the dock's idiom is one consequence line,
the change list + checks make it taller (R-006): row height, whether the checks collapse to one line, whether the dock grows or the body scrolls;
DT-2 the SCORE key (R, L, S, E are taken) and tab order; DT-3 the TARGET chip text for SCORE (`SONG · WHOLE SCORE`?) and whether the lyrics-lane selection
shows as a referent (M2); DT-4 hues: errors and `truncated` rust, version badge lilac, scope chip sky, APPLY & RENDER the only acid fill,
PLAN's outline weight; DT-5 the dimmed-old-plan treatment. DESIGN.md is updated in the same PR as its own commit (AGENTS.md).

### The plan → render hand-off (F-019, F-020, F-023) — the part with no UI

`enqueue(plan)`: slot taken → build the prompt (BAR MAP, from the yue-server) → planner call(s) ≤ 3 with the numeric feedback → unload →
poll `/api/ps` (250 ms) until empty → verdict stored on the job → slot released. `APPLY & RENDER` → re-check (D-006, base version, plan alive,
`/api/ps` empty) → `enqueue(scoreRender)` with its own slot → yue-server `POST /v1/jobs` (edited `abc`, `cot` full, stored style, stored lyrics
(or the op's edit), the base's seed) → result → new base version + `${versionId}.abc` sidecar → release. Two slots, not one: the user's review
must not hold the GPU.

## Later

- **A/B listen of two versions (Q-008, deferred; re-checked: stays deferred).** The version rail already activates v2 or v3 for ordinary playback, so
  the comparison exists without new UI; an A/B control needs its own design and the redesign's open question 1 is unanswered. Revisit after M0's
  listen shows whether people reach for it. R-013's fallback text names it as the trust tool, so it is the first Later item.
- **Post-render "did it take?" report** (SheetSage2 re-read of tempo and edited-bar roots, as SP-3 did) — a second GPU job of 1-3 min per render;
  M0's consequence line and the owed listen carry the honesty instead. Do it if users distrust the harmony results.
- **Drop one op from a plan** — REVISE (M2) covers the need; a per-op checkbox needs the validator to re-run per subset.
- **Plans surviving a server restart** (D-020), **keeping the planner warm for a session of revisions** (cold load is 2.5 s for the 14B; the 14B
  leaves 2 GiB of card free, which is not enough margin to co-reside), **NVML VRAM baseline check** before render (`/api/ps` empty was enough in SP-1;
  needs a baseline taken just before the plan, not a constant), **CPU-only planner** (Q-012 C: 98.7 s vs 8 s, over D-013's p50 line),
  **llama.cpp router support** (D-012 Ollama first), **a tested MoE planner profile** (gemma4 26B-A4B: 16.98 GiB, card 96% full, 12-50 s cold
  load; works as an env value only), **multi-turn conversation memory**, **selecting bars by dragging on the bar map**.
- **Queue pause while a backend is down (Q-009, deferred; unchanged).**
- **Score edits after an ACE-Step edit** (Q-003 B/C): D-006 blocks them; revisit if users routinely want them (D-006's clause).

## Not doing

- **Free-form ABC bar strings for WRITE PHRASE** (the mockup's design) — SP-2: 44% within 3 retries on qwen3:14b, 89% (Wilson low 67%) on the
  26B MoE, versus 100% / 94% as `{pitch, beats}` notes with code writing the ABC. The model does the music, code does the arithmetic (R-002).
- **A TypeScript port of the validator or applier** — upstream warns against substituting a parser with different accidental semantics; the spike's
  applier is 553 lines, past the 200-LOC cap (R-016 → D-019).
- **The planner writing lyric section tags** — derived by code from `% section` comments (R-018). A silent tag change is itself a drift source (SP-3).
- **The mockup's old surfaces**: a SCORE · YUE2 mode in the prompt bar, a left score panel, a history rail (all deleted by S1; superseded by D-007), a
  new top-level Score view (D-007 B) and a rail that swaps to review (D-007 C).
- **User-facing melody-contract modes (EXACT / PITCHES / FREE)** — the contract stays inside the validator, as `compare`'s allowed changes per op
  (SP-2); nothing for the user to set.
- **Region-level YuE2 re-render, "keep the rest identical"** — YuE2 has no waveform inpainting and re-renders everything (R-014); the consequence line
  says so. Repaint on ACE-Step remains the local-edit tool.
- **Cloud / frontier-model planners** — local-only (brief); `LLM_API_URL` is a local server.
- **Thinking-mode planners** — `reasoning_effort: "none"` is part of the contract (SP-1: 1,500 tokens of reasoning, empty content, 71 s otherwise).
- **Per-note / piano-roll editing, tuplets, repeat signs, `w:` lyric lines in the score** — the native dialect rejects them; AGENTS.md rules out a MIDI editor.
- **SCORE on HeartMuLa, ACE-Step, import or other-engine songs** — no score exists (D-014, D-015, R-017).
