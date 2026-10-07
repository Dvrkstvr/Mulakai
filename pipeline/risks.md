# Risks

feasibility: amber (confirmed by conductor at stage 3 gate, 2026-10-03) · H-open 0 (R-013 proven by the M0 listens 2026-10-05; R-002 measured, SP-2 phrase listen owed) · M-open 1 · spiked 4 (R-003, R-019 by SP-1; R-013, R-014, R-010 by SP-3; R-002, R-015, R-016 by SP-2, 2026-10-03; owed: user's SP-3 A/B listen and SP-2 phrase listen)

Scope of this file: the SCORE AGENT (D-005, D-006, D-007) plus the existing app's risks from the adopt audit. Existing app alone: amber (R-001, R-012). Score agent: red until spikes SP-1..SP-3 below run (stage 3).

Updated 2026-10-03 by stage 2 feasibility. Sources fetched today: upstream `skills/yue2-music/` at YuE commit `72272f9` (SKILL.md, references/abc-editing.md, references/editing-workflows.md, references/generation-and-covers.md, references/models-and-setup.md, scripts/abc_tools.py via `gh api repos/multimodal-art-projection/YuE/contents/...`); docs.ollama.com (openai-compatibility, capabilities/structured-outputs, faq, context-length); llama.cpp `tools/server/README.md` (master, via `gh api`).

## Core-promise path (M0: score agent)

Promise: "ask for a musical change in words → get a checked, reviewable plan → one click renders a new version that audibly reflects it".

1. Pick a library song whose only layer's base came from YuE2 with `cot` full, no repaint versions (D-006), and a `${versionId}.abc` sidecar.
2. Open the SCORE dock verb (D-007); type one request that needs a planner: "jazz chords in the chorus, 88 BPM, add a 4-bar sax phrase after it" (REHARMONIZE + SET TEMPO + EDIT STYLE + WRITE PHRASE).
3. Server takes the single GPU slot (genLock kind / genQueue entry), calls the planner at `LLM_API_URL` with a JSON-schema response format, and gets an op list; WRITE PHRASE retries ≤ 3 against the validator inside the same slot hold.
4. Before releasing the slot, the planner is unloaded and the release is confirmed (Ollama `GET /api/ps` empty, or llama.cpp router `/models/unload` ack; VRAM back to its parked baseline).
5. Code applies the ops to a copy of the score and validates with upstream semantics (bar sums, melody contract, native chord vocabulary, token count measured with chords kept ≤ 4,096, section tags in LYRICS matching `% section` comments).
6. Dock body shows the change list, checks and bar map, with the consequence line "saves base vN, re-renders the whole song on YuE2".
7. APPLY & RENDER re-checks D-006 eligibility, then submits to yue-server: edited `abc`, `cot` full (melody if the score has no chords), revised `style`, section-matched `lyrics`, the original seed.
8. The result lands as a new lilac base version with its own sidecar; the previous version stays revertible.
9. Audible check: tempo within 4% of the new `Q:`; the reharmonized bars and the sax phrase are heard (SheetSage2 re-read + an owed user A/B listen).

Exercises every H risk on the real machine: R-002 (steps 3, 5), R-003 (steps 3, 4, 7), R-013 (step 9).

## Core-promise path (existing app)
1. Start ACE-Step 1.5 + server + client.
2. Create > AN IDEA > GENERATE; row appears in Library.
3. Open song; select a range; REPAINT; new version.
4. ADD LAYER; second lane appears.
5. Revert base to first take.
6. EXPORT MIX downloads a WAV.
(Steps 2-6 are what e2e/tests/golden-path.spec.ts runs on a fake; step 1 on real ACE-Step is the unproven part.)

## Spikes to schedule (stage 3; all on this machine: RTX 4080 16 GB, Windows 11 + WSL2 Ubuntu-24.04, yue-server, ACE-Step with `ACESTEP_OFFLOAD_TO_CPU=true`)

### SP-1 · VRAM hand-off (R-003, R-019)
- setup: Ollama native on Windows (default per D-011/D-012) with one ~14B dense model at Q4 and `OLLAMA_CONTEXT_LENGTH=16384`; NVIDIA "Prefer No Sysmem Fallback" noted on/off per run; yue-server up (`YUE_API_URL=http://127.0.0.1:8004`); ACE-Step up with offload.
- run: log `nvidia-smi --query-gpu=memory.used --format=csv,noheader -lms 250` to a file throughout; also Task Manager "Shared GPU memory" before/after each step.
  1. Baseline: all idle (expect desktop ~1.2 GB + ACE-Step ~0.5 + yue-server context ~0.8).
  2. One planner call with a real library score in the prompt via `/v1/chat/completions`; then `POST /api/generate {"model":M,"keep_alive":0}`; poll `GET /api/ps` every 250 ms until empty. Record ack-to-empty and empty-to-VRAM-baseline times.
  3. Immediately `POST /v1/jobs` on yue-server with the same score as `abc`, `cot` full; record `result.json` timing and tokens/s.
  4. Negative control: repeat step 3 with the planner still loaded (`keep_alive` 5m), once per sysmem policy.
  5. CPU-only variant: same planner call with `options.num_gpu: 0` on `/api/chat`; record latency (feeds Q-012).
  6. Near-budget render: a score edited to ~4,000 YuE tokens (REPEAT chorus); record PyTorch/card peak and the `truncated` flags.
- pass: VRAM back within 0.3 GB of baseline ≤ 5 s after unload ack; YuE2 plan/semantic ≥ 85 tokens/s (spike baseline 94-95); no growth in shared GPU memory; near-budget peak ≤ 14 GiB and untruncated.
- result: `pipeline/spikes/SP-1-vram-handoff/RESULT.md` with the nvidia-smi log. Done 2026-10-03: hand-off proven (unload confirmed in ~0.1 s, YuE2 86-95 tok/s, no shared-memory growth); near-4,096-token render peaks at 11.4 GB but is truncated (9,000-semantic-token cap, ~2,900 tokens for dense songs).

### SP-2 · local planner quality (R-002)
- setup: a scratch Python harness (outside app source) importing the vendored `yue-server/upstream/abc_tools.py` (`parse_abc`, `compare`) for validation, and yue-server's tokenizer count (`/v1/jobs` 422 or a direct `count_tokens`; note `/v1/scores/measure` strips chords, R-019).
- inputs: 20 real YuE2 sidecars from the library (`${versionId}.abc` in the server's audio dir), each with its stored style and lyrics; 6 request templates: SET TEMPO, TRANSPOSE, REHARMONIZE 4 bars (jazz), REPEAT chorus, REWRITE LYRICS for one section, WRITE PHRASE 4 bars in `Ins` (sax).
- models: 2-3 current local candidates: one dense model that fits ~12 GB VRAM, and one larger MoE run with experts in system RAM (llama.cpp `--n-cpu-moe`, documented flag; speed unverified). Choose current releases at spike time.
- measure per model: JSON-schema-valid op list on first try; op application success; validator pass within ≤ 3 retries for REHARMONIZE and WRITE PHRASE; chord-vocabulary violations; p50/p95 plan latency; peak VRAM.
- pass (D-013 thresholds): deterministic op lists valid ≥ 90% first try; REHARMONIZE and WRITE PHRASE pass within 3 retries ≥ 70%; p50 plan ≤ 60 s. Owed: the user listens to 5 rendered WRITE PHRASE results from SP-3's pipeline and says if they are musical.
- result: `pipeline/spikes/SP-2-planner-quality/RESULT.md`. Done 2026-10-03: `proven`, qualified. qwen3:14b and gemma4:26b-a4b-it-q4_K_M (MoE, 18 GB, Apache 2.0) on 9 real scores x 7 templates x 2 reps (116 plans each): deterministic ops valid first try 97% / 94% (>= 90 pass), REHARMONIZE 100% / 100% within retries (pass), p50 plan 1.6 s warm (pass); WRITE PHRASE as ABC strings 44% / 89% (fails for the dense 14B), as `{pitch, beats}` notes with code writing the ABC 100% / 94% (pass, both). Musicality is owed to the user.

### SP-3 · cot=full audible adherence (R-013, R-014, residue of R-010)
- inputs: 3 library YuE2 songs planned with `cot` full; for each, hand-edited and validated scores (no LLM, isolates YuE2): (a) unchanged sidecar, (b) 4-8 reharmonized bars, (c) `Q:` +15% with matching style text, (d) chorus repeated, (e) a 4-bar `Ins` phrase over `Vocal` rests with "tenor saxophone" in style. Original seed for all.
- run: `POST /v1/jobs` with `abc` + `cot` full per score. Re-transcribe each result with SheetSage2 (melody, and the full task for chord labels) using the PLAN.md melody-survival harness in `~/yue2/`.
- measure: (a) vs original audio = re-render drift outside edits (R-014); (b) chord-label agreement on edited bars vs unedited bars; (c) tempo within 4%; (d) section count; (e) `Ins` notes present in the phrase window; melody F1 outside edits ≥ 0.9.
- pass: (b) edited-bar agreement clearly above chance and not below unedited-bar agreement; (c) within 4%; user hears the change in ≥ 4 of 5 owed A/B pairs.
- result: `pipeline/spikes/SP-3-cot-full-adherence/RESULT.md`.

## Risks

### R-001 · impact M · evidence platform
Existing app: CI and e2e use a fake ACE-Step (`e2e/fake-acestep/`). Real ACE-Step API drift (Gradio/HTTP, task types) would pass every automated check and break generate/repaint/layer. The user runs it by hand (inferred); no recorded real-run evidence in the repo.
- check: one owed manual run against real ACE-Step 1.5 per release, logged in a RESULT/evidence file.
- fallback: contract test capturing real request/response shapes once.
- source: CLAUDE.md "golden path against a fake ACE-Step"; seen in e2e/.

### R-002 · impact H · evidence proven, qualified (SP-2, 2026-10-03: seen running; [RESULT](spikes/SP-2-planner-quality/RESULT.md); musicality listen OWED)
Score agent: local-LLM plan and ABC quality. The planner must turn a sentence into ops and, for REHARMONIZE and WRITE PHRASE, emit native-dialect ABC that passes bar sums, the melody contract and the chord vocabulary within ≤ 3 retries. Upstream designed this workflow for a frontier model: SKILL.md "Recommended agent: GPT-6 Astra" (documented), and its editing guidance assumes per-note harmonic judgment (abc-editing.md "Reharmonization and selective melodic editing"). The native dialect is narrow and unusual: `L:1/32` units, duration multipliers only `1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48`, accidentals propagate by letter across octaves, ties must join equal pitches, and the helper rejects tuplets, repeat signs, `w:` lines and unsupported chord qualities (abc-editing.md, documented). JSON-schema output constrains the op list, not the ABC inside a string field (Ollama structured-outputs and llama.cpp `json_schema` docs, documented). Lever (inferred, unverified): ~200 GB system RAM allows a large MoE planner with experts on CPU (`--n-cpu-moe`, llama.cpp README, documented flag).
- outcome (2026-10-03, seen running, 9 usable library scores of the 10 sidecars that exist, 2 seeds each): with a strict JSON-schema op list through `/v1` (0 schema-invalid replies in 844 calls), upstream `parse_abc`/`compare` as validator and 3 retries with numeric feedback: SET TEMPO, TRANSPOSE, REPEAT, REWRITE LYRICS valid first try 97% (qwen3:14b) / 94% (gemma4 26B-A4B); REHARMONIZE (structured `root`+`quality` enums, code writes the ABC) 100% / 100%, first try; p50 plan 1.6 s warm for both (cold load 2.5 s / 12 s, 50 s first ever from disk). WRITE PHRASE with free ABC bar strings: 44% (qwen3) fails the 70% line, 89% (gemma, Wilson low 67%) barely passes; with notes as `{pitch, beats}` and code emitting ABC (fallback 2, simplified): 100% / 94%, compound request 86% / 100%. Chord vocabulary: free-text chord strings gave 0/132 and 4/121 violations (the enum makes it 0 by construction). Valid is not musical: passing phrases are plain; the user listen is owed (`phrases/index.html`, SP-3 `*_e` pairs). Wrong referent (which chorus) is the main intent failure, not syntax.
- check: SP-2 (done); owed: the user's phrase listen.
- fallback, in order: (1) express REHARMONIZE as structured ops (`{bar, beat, root, quality, bass}` with `quality` as a schema enum of the 15 native qualities), so vocabulary errors are impossible and code writes the ABC; (2) WRITE PHRASE constrained by a llama.cpp GBNF grammar for native bar tokens; (3) cut WRITE PHRASE and keep deterministic ops (D-005 revisit clause → Q-001 C). Fallbacks (1) and (2, as notes-with-beats rather than a GBNF grammar) are what the spike recommends building; (3) is not needed. A `pattern` on the ABC string (Ollama builds a grammar) removes syntax errors but not the bar-sum arithmetic.
- source: upstream SKILL.md, references/abc-editing.md (YuE `72272f9`); docs.ollama.com/capabilities/structured-outputs; llama.cpp tools/server/README.md (`json_schema`, `grammar`, `--n-cpu-moe`).

### R-003 · impact H · evidence proven (SP-1, 2026-10-03: [RESULT](spikes/SP-1-vram-handoff/RESULT.md))
Score agent: VRAM hand-off on one 16 GB card. Planner and YuE2 must never co-reside. What is known: yue-server parks the model in system RAM after every job, including failed and cancelled ones, before marking it terminal, and holds ~0.8 GB of CUDA context between jobs (seen in code: `yue-server/worker.py` `finally: pipe.park()`; documented in `yue-server/README.md`). A YuE2 job needs ~9 GiB free and caps PyTorch at card total − 2 GiB (README; `settings.py` `budget_gib`). ACE-Step idles at ~0.5 GB only with `ACESTEP_OFFLOAD_TO_CPU=true`, which Mulakai cannot set or check (`heartmula-server/README.md`, measured there). So ~13 GB is free for a planner while everything else is parked (inferred arithmetic: 16 − 1.2 desktop − 0.5 − 0.8 − ~0.25 HeartMuLa context). What is not known: how fast a planner releases VRAM. Ollama documents `keep_alive: 0` ("unload the model immediately after generating a response") and `ollama stop` on its native API; `keep_alive` is not in the `/v1/chat/completions` field list, so under D-002 the release is a second, Ollama-specific call (docs.ollama.com/faq, /api/openai-compatibility, documented). llama.cpp's single-model server has no unload endpoint; its router mode has `POST /models/unload` and `--sleep-idle-seconds` (README, documented). Failure mode is measured, not guessed: a YuE2 cover with ACE-Step resident stalled at 9 tokens/s and never finished (PLAN.md "YuE2 Melody Covers" generation notes); with the default Windows sysmem-fallback policy a spill is ~25x slower with no error (heartmula-server README).
- outcome (2026-10-03, seen running): `keep_alive: 0` acks in 1-20 ms, `/api/ps` is empty and VRAM is back at its pre-call baseline ~0.1 s later; YuE2 then runs at 92.8 tok/s (spike baseline 94-95; 86.7-87.1 on a slower day that also hit the no-planner control), shared GPU memory flat. Planner qwen3:14b Q4_K_M at ctx 16,384 takes 10.9 GiB (13.2-14.0 GiB on the card). Negative control (planner left loaded) did not stall: YuE2 finished ~10% slower with the card at 98% full; not a safe fallback. CPU-only planner: 98.7 s vs 8 s on GPU. Still owed: the Sysmem Fallback Policy toggle, ACE-Step after a real generation, the real queue.
- check: SP-1 (done).
- fallback: planner on CPU/system RAM only (`num_gpu: 0` or `-ngl 0`; slower, no hand-off; Q-012); or the user starts/stops the planner manually and Mulakai refuses to render while `GET /api/ps` lists a model.
- source: yue-server/README.md, worker.py, settings.py; PLAN.md "YuE2 spike results"; docs.ollama.com/faq; llama.cpp tools/server/README.md "Sleeping on Idle", "POST /models/unload".

### R-004 · impact H · evidence known
Score agent: scope conflict. PLAN.md ("Engine: YuE2": "ABC score editing ("agentic editing") is out of scope"; "YuE2: Align With Upstream": "Still out of scope: score editing, reharmonization, lyric adaptation") and AGENTS.md ("every edit after that first take still runs on ACE-Step"; also yue-server/README.md line 6) rule this out. The user decided in D-005; what remains is the written amendment before any code.
- check: a dated PLAN.md section superseding both lines, plus AGENTS.md and yue-server/README.md wording, merged before the first score-agent code PR.
- fallback: keep USE .ABC FILE as the only score-editing path.
- source: seen in PLAN.md/AGENTS.md; D-005.

### R-005 · impact M · evidence known
Score agent: a re-render from the YuE2 score does not carry ACE-Step repaints or lego layers. Settled by D-006: SCORE only while the song has one layer and no repaint versions; otherwise "new song from this score". Residue: with a job queue, a repaint queued after the plan may land before the render runs (see R-007), so eligibility is checked again at render run time.
- check: unit test of the eligibility predicate at plan time and at render run time.
- fallback: refuse the render with the reason, keep the plan for "new song from this score".
- source: D-006; S4 decision 5 (PLAN.md, settlement at run time).

### R-006 · impact M · evidence known
Placement: settled by D-007 (5th dock verb SCORE, review in the dock body). Residue: the change list + checks + bar map make the dock body tall, and the dock's idiom is a one-line consequence (ActionDock.tsx, seen in code); palette pre-fill and Activity visibility of the planner are open for stage 5.
- check: stage 5 mockup against DESIGN.md Editor section.
- fallback: collapse checks into one line with an expandable bar map.
- source: D-007; ActionDock.tsx.

### R-007 · impact M · evidence known
Redesign S4 (job queue) is unmerged; `feat/job-queue` is now 7 commits ahead of main (9d76767 ... 57e9f3c: queue, UP NEXT, e2e queue scenario, "ABORT holds the slot until the backend lets go"), seen in git. A planner job and a render job must enter the same single slot as ACE-Step jobs. Planner-specific needs: a new kind (e.g. `plan`) that holds the slot for all ≤ 3 retries and releases only after the unload is confirmed (same shape as the branch's "ABORT holds the slot until the backend lets go"); the user's review must not hold the slot; render re-checks eligibility at run time (R-005). If the planner runs CPU-only (Q-012), it needs no slot at all.
- check: decide merge order (Q-005, D-003 says S4 first); spec the `plan` kind against genQueue.
- fallback: build against genLock with a thin adapter.
- source: `git log main..feat/job-queue`; PLAN.md S4 decisions 1, 2, 5.

### R-008 · impact M · evidence known
Context bloat. CLAUDE.md @imports AGENTS.md (budget script: over budget, 1 violation) and PLAN.md is 8,329 lines. CLAUDE.md tells agents to read PLAN.md "first". Agents following that will burn context before work starts.
- check: `node scripts/context-budget.mjs` (ran; always-loaded ~2.5k tokens, so the real cost is PLAN.md on demand, not the imports).
- fallback: path-scoped rules + docs/decisions split (separate branch, not during adoption).
- source: audit.md.

### R-009 · impact M · evidence known
Out-of-repo reference dependencies. Mockups `ActionDock.dc.html`, `GuidedCreate.dc.html`, `CommandActivity.dc.html` named in the redesign spec are not in the repo (found no `*.dc.html`), and reference projects live in `S:\AI Gen\...`. A new session cannot reproduce the design review.
- check: copy mockups into `pipeline/design/` or `docs/design/`.
- fallback: DESIGN.md is the authority (it was rewritten per slice).
- source: seen (find .dc.html returned nothing).

### R-010 · impact M · evidence proven (SP-3, 2026-10-03: seen running, 21 of 21 `cot` full / melody jobs rendered with a supplied score, 0 abc tokens, none truncated; see [RESULT](spikes/SP-3-cot-full-adherence/RESULT.md))
Render path. Upstream documents the score-edit path as `cot` full with the edited ABC: generation-and-covers.md table row "Reharmonize or otherwise edit a score | `full` | Supply the edited melody-and-chord ABC", and "An external ABC input bypasses the symbolic planner; it does not call a second planner to repair the score". SKILL.md: to keep harmony, "use full transcription and `cot="full"`; call this score-conditioned regeneration with melody and harmony"; and "omitting both with `abc: null` generates a fresh plan and discards the edit". Lyrics are a separate request field; native ABC carries none (`w:` rejected, abc-editing.md). So with `cot` full a supplied score's chords and the request's lyrics both reach YuE2 unchanged, without re-planning (documented). yue-server already supports it: `prepare_score` strips chords only for `melody` (seen in code: scores.py), and `instrumental.py` already sends `abc` with `cot` full when the score has chords. Remaining gap: Mulakai's `buildYue2CoverRequest` hardcodes `cot: 'melody'` (yue2.ts:95-97); the score agent needs its own request builder (rule: D-010). Untested against the real model for edited scores.
- check: SP-3 (a)-(b) runs the path end to end.
- fallback: `cot` melody with chords stripped (melody kept, harmony free) and harmony requested in style text only.
- source: upstream references/generation-and-covers.md, SKILL.md, references/abc-editing.md (YuE `72272f9`); yue-server/scores.py, instrumental.py; server/src/services/engines/yue2.ts.

### R-011 · impact L · evidence known
Verification is thin per feature: one e2e test and ~1,078 unit tests; no e2e for COVER, SPLIT, YuE2, queue, SPLIT verb. Fine for a one-user local tool; risky for refactors like the dock (S1 deleted ~6 components in one merge).
- check: add e2e steps only for flows touched by the next milestone.
- fallback: owed manual checks.
- source: ran the suites.

### R-012 · impact M · evidence known
CI on main is red on the golden path: 2 of the last 12 main runs failed (37112819399 after #113, 37113963147 after #116; 2 cancelled, 8 success). Both fail on the same step: the Activity drawer shows a RUNNING row and a DONE row for the same generation at once (strict-mode violation, 2 `.activity-job` matches; the stale row reads "LOADING MODEL ... ABORT"). PR-branch runs of the same code passed, and it passed locally. Either `activityStore` double-records a settled job, or the test races the settle. AGENTS.md says never merge without tests passing; #113 and #116 reached main with a red push run (the PR run was green; the push run after merge was not).
- check: rerun the e2e 5-10 times locally and in CI; read `activityStore.ts` / `activitySettle.ts` for a settle-vs-running overlap window.
- fallback: make the spec wait for the RUNNING row to leave before asserting DONE (masks the symptom; fix the store if the overlap is real).
- source: gh run view 37112819399 / 37113963147 --log-failed (seen, logs).
- outcome (2026-10-03): root cause is a real overlap in the client, not a PR-vs-push environment difference. The stale row was `GENERATING · ABORT` (the `LOADING MODEL` row was the legit in-flight one: the spec's library-row check matches the generating card, so the drawer opens mid-generation). `apiStatusStore.active` (the Header's 2 s `/active` poll) still named the settled job, so `runningRows` gave it a phantom RUNNING row beside its DONE row until the next poll; a run fails only when that poll lands mid-job (push run 37113598356 on the same code passed). Fix: PR #118 (`fix/activity-stale-lock-row`): `activityTracking` calls `apiStatusStore.lockReleased(kind, jobId)` on every settle, dropping a snapshot that names the job and discarding in-flight polls. New Vitest `client/src/activityStaleLock.test.ts` (3 cases failed before the fix); client 591 / server 493 tests pass; e2e passed locally 1x + `--repeat-each=8`. Spec unchanged, fallback not needed. Still owed: #118's CI, then a green push run on main after merge, before closing R-012.

### R-013 · impact H · evidence proven, qualified (SP-3 2026-10-03; M0 listens 2026-10-05: tempo heard as asked, chords 2/4 before D-055, 5/5 after; see [RESULT](spikes/SP-3-cot-full-adherence/RESULT.md))
Score agent: the render may not audibly reflect the edit. The promise ends in "audibly reflects it", but upstream says its helper does not "force the generator to follow the score" (abc-editing.md), and "Do not claim exact note realization, instrument removal or sample-accurate preservation from an ABC check" (SKILL.md); a `[saxophone solo]` tag plus style text "are not a sample-accurate scheduling API" and "Describing an instrument omission does not prove that the generated audio omits it" (editing-workflows.md), all documented. Measured here, `cot` melody only: melody F1 0.93-0.98 when lyric tags match the score, tempo within 4% of the score (PLAN.md "YuE2 Melody Covers" generation results). Not measured anywhere in this repo: chord adherence under `cot` full, and whether an `Ins` phrase is rendered on the requested instrument.
- check: SP-3 (b), (c), (e), plus the owed A/B listen.
- outcome (2026-10-03, seen running, 3 songs): tempo within 0.1% of the new `Q:` (bar length; all 3); REPEAT chorus renders as a faithful copy (bar count exact, copy melody F1 0.95-0.99); `Ins` phrase present (pitch-folded F1 0.80-0.95 vs chance <= 0.2; instrument unverified); melody outside edits folded F1 >= 0.90. REHARMONIZE: roots follow on 8/8 bars in 2 songs, 3/8 in the 3rd (2/4 song); chord quality not recoverable by SheetSage2 (7ths read as triads); the `cot` melody control keeps the old harmony, so the effect is caused by `cot` full. Strict (b) "not below unedited" is met at root level for 2 of 3 songs only. Fallback stands for harmony and instrument: "a request to YuE2, not a guarantee"; SET TEMPO, REPEAT and melody-preserving edits can be stated as reliable. Owed: the user's 12-pair A/B (`spikes/SP-3-cot-full-adherence/listen/index.html`).
- fallback: offer only the ops SP-3 shows to be audible (likely SET TEMPO, REPEAT/CUT, melody-preserving edits); state harmony and instrument edits as "a request to YuE2, not a guarantee" in the consequence line; keep the pre-edit version one click away (and A/B compare, Q-008).
- source: upstream SKILL.md, references/abc-editing.md, references/editing-workflows.md; PLAN.md cover spike tables.

### R-014 · impact M · evidence measured (SP-3, 2026-10-03; see [RESULT](spikes/SP-3-cot-full-adherence/RESULT.md))
Whole-song re-render changes untouched bars. YuE2 "does not expose waveform inpainting or guarantee an identical performance outside the edited bars"; "A same-seed comparison is useful provenance, not a guarantee of controlled acoustic variation" (editing-workflows.md, documented). A user asking for "88 BPM" also gets a different vocal take everywhere. This is an expectation risk, not a failure.
- check: SP-3 (a) measures drift for an unchanged score at the same seed.
- outcome (2026-10-03, seen running): same request + same seed is deterministic (original render re-transcribes byte-identically); an unchanged score with only normalized lyric tags still moves 1.5-8% of notes (melody F1 0.92-0.985 vs original, chord roots 98-100% of score); outside an edit window the melody matches the unchanged re-render at folded F1 0.90-0.98. Small, non-zero; the consequence line ("re-renders the whole song") stays accurate.
- fallback: consequence line says "re-renders the whole song; every bar will sound different"; reuse the original seed; keep the prior base version.
- source: upstream references/editing-workflows.md.

### R-015 · impact M · evidence measured (SP-2, 2026-10-03: seen running; [RESULT](spikes/SP-2-planner-quality/RESULT.md))
Planner context silently too small. Ollama defaults to a 4k context below 24 GiB VRAM (docs.ollama.com/context-length, documented); a full score plus dialect rules, schema and lyrics is larger (a 3-minute plan was 1,673 YuE tokens, PLAN.md spike; the budget allows 4,096; general-purpose tokenizers split ABC finer, inferred). Ollama does not document what happens on overflow (unverified). The `/v1` endpoint cannot set context per request ("the API itself doesn't provide native context-size configuration through request parameters", openai-compatibility page); `OLLAMA_CONTEXT_LENGTH` or a Modelfile can. A truncated prompt yields a plan made against half the song.
- outcome (2026-10-03, seen running): a compact bar-map prompt is 2.0k-4.2k tokens (p50 2.7k) and the raw sidecar + rules + style + lyrics 2.2k-5.4k tokens (qwen3 and gemma tokenizers); both fit 16,384, 3 of 10 raw prompts exceed the 4,096 default. Overflow is silent: a 4,511-token prompt at `num_ctx` 2048/4096 returned HTTP 200 and a normal reply, the server log said `truncating input prompt` (first 5 tokens + tail kept, about half the context) and the only client-visible sign was `prompt_eval_count` 1,027 / 2,051. So the preflight needs a post-call check: `usage.prompt_tokens` below the counted prompt means truncation.
- check: preflight before each plan: read the loaded context (Ollama `ollama ps` CONTEXT column / `GET /api/ps`; llama.cpp `GET /props`) and compare with the counted prompt; refuse with "planner context is N, needs M; set OLLAMA_CONTEXT_LENGTH".
- fallback: call Ollama's native `/api/chat` with `options.num_ctx`, `format` and `keep_alive: 0` in one request (D-012 alternative).
- source: docs.ollama.com/context-length, /api/openai-compatibility.

### R-016 · impact M · evidence measured (SP-2, 2026-10-03: seen running; [RESULT](spikes/SP-2-planner-quality/RESULT.md), golden cases in `spikes/SP-2-planner-quality/golden.json`)
Validator semantics live in Python. The reference checker is upstream's `abc_tools.py` (337 lines, Apache-2.0, already vendored unmodified in `yue-server/upstream/`, seen in code). Upstream warns: "do not silently substitute a parser with different accidental semantics" (abc-editing.md). A TypeScript port in the Mulakai server would drift and exceeds the 200-LOC module cap unless split.
- outcome (2026-10-03): upstream's verdict recorded as 39 golden cases (10 library sidecars, 29 mutations); parse takes 2.3-9.4 ms in Python. Port-relevant behaviours: exact header and 30-name key table, 1-4 measures per group after `Z` expansion, duration set, tie/accidental rules, chord regex (17 names x 15 qualities x slash bass, rejected in Ins, ignored by `compare`), tied notes merged in `compare`, terse messages ("event after the measure end", Fractions). Real data hits: per-group meter changes (`3820c535`), `L:1/16`, a library sidecar that fails the validator (`0a7cff01`), and REPEAT creating an invalid tie at the seam (`f3e3bfdc`). The spike's applier + wrapper is 553 lines of Python; a TS port is well past the 200-LOC cap. Recommendation: the yue-server route.
- check: stage 4 decides: a CPU-only yue-server route (e.g. `/v1/scores/check` running `parse_abc` + `compare`, no GPU) versus a TS port with golden tests against the Python output on the 20 SP-2 scores.
- fallback: yue-server route (SCORE already depends on yue-server being up for the render).
- source: upstream references/abc-editing.md; yue-server/upstream/abc_tools.py.

### R-017 · impact M · evidence known
Not every YuE2 song has an editable score. `cot` off produces no score (`score_url` is null when `plan.abc` is empty, worker.py `_save`); the sidecar is "optional garnish" and a failed fetch still saves the song (engineGenJobs.ts:64-65); an instrumental's sidecar is the converted score with every Vocal note moved to `Ins` (instrumental.py); a cover's score is chord-free (`cot` melody, scores.py), so REHARMONIZE there means writing all chords. Seen in code.
- seen running (SP-2, 2026-10-03): the library's longest sidecar (`0a7cff01`, the planner's own output cut at 4,096 tokens) fails upstream `parse_abc` ("group 60, Ins: expected V: Ins"); eligibility must run the validator on the sidecar, not only check that it exists. Of the 10 sidecars, 2 are chord-free covers and 1 an instrumental.
- check: eligibility predicate tests: no sidecar → SCORE disabled with the reason; chord-free score → render with `melody` unless chords were added (D-010).
- fallback: hide SCORE for songs without a sidecar.
- source: yue-server/worker.py, instrumental.py, scores.py; server/src/services/engineGenJobs.ts.

### R-018 · impact M · evidence known
Lyrics and section tags must move with the score. REPEAT/CUT and REWRITE LYRICS change sections; matching tags matter: same words, same seed scored melody F1 0.93 with the score's section tags vs 0.66 with mismatched tags (PLAN.md cover spike, measured). The native helper rejects repeat signs, so REPEAT must expand bars literally (abc-editing.md). Upstream also wants style and `Q:` changed together for tempo (editing-workflows.md: "Put `Q:1/4=88` in the score too").
- seen running (SP-2, 2026-10-03): lyric blocks and score sections do not map one to one (`2c944049`: one chorus in the score, two `[Chorus]` blocks in the lyrics; `3820c535` has a `[Pre-Chorus]` block; the stored style can disagree with the score, "90 bpm, F minor" vs Q:87 in D minor). A block-addressed REWRITE LYRICS and a tag-matched REPEAT worked in the spike (which chorus the user means was the planner's main intent error), but "derive tags from the score" needs a stated rule for blocks with no matching section.
- check: unit tests: every section op rewrites LYRICS tags from the edited score's `% section` comments (same rule as `section_tags` in instrumental.py); SET TEMPO edits `Q:` and the style text together.
- fallback: derive tags from the score deterministically; the planner never writes tags.
- source: PLAN.md "YuE2 Melody Covers" answers; upstream references/abc-editing.md, editing-workflows.md.

### R-019 · impact M · evidence known (SP-1, 2026-10-03: measured; the 4,096-token budget claim disproven, see [RESULT](spikes/SP-1-vram-handoff/RESULT.md))
Budget, length and peak memory at 16 GB. Upstream's supported baseline is "a BF16-capable NVIDIA GPU with 24 GB VRAM", context 24576 (SKILL.md, generation-and-covers.md, documented). On this card the defaults fit: PyTorch peak 8.1 GiB for a ~3-minute song because the KV cache is preallocated for prefix + `max_tokens` 9000, and only the acoustic stage grows with length; the 14.08 GiB peak at maximum context was not reproduced (PLAN.md "YuE2 spike results", measured). So the 24 GB note means: fine for ~3-minute songs, unproven near the limits. REPEAT and WRITE PHRASE grow the score and the song: yue-server returns 422 over 4,096 tokens (main.py:97, seen in code); `max_tokens` 9000 ≈ 360 s at 25 Hz sets `truncated` (inferred in PLAN.md). Also `/v1/scores/measure` strips chords before counting (score_routes.py), so it under-counts a `cot` full score.
- outcome (2026-10-03, seen running): peak is not the problem (11.1 GiB card peak at 2,655 and 4,055 tokens, 14 GiB cap never approached). Length is: a 4,055-token and a 3,180-token score both hit the 9,000-semantic-token cap and came back `truncated` at 360.0 s; 2,655 tokens (327.5 s) was untruncated. Semantic tokens per score token ran 2.3-3.1 across library songs, so the safe limit is ~2,900 tokens dense / ~3,900 sparse, i.e. a duration limit. The library's longest sidecar (exactly 4,096 tokens) is the planner's own cut-off output and fails validation.
- check: unit test that the review counts tokens with chords kept (a `cot` field on the measure route) and estimates duration from bars x meter / `Q:`.
- fallback: the review refuses ops that push the estimated duration past ~330 s (hard 360 s) or tokens past 4,096, naming the section to cut; a `truncated` job result is shown as a warning, not DONE.
- source: upstream SKILL.md, references/generation-and-covers.md; PLAN.md "YuE2 spike results"; yue-server/main.py, score_routes.py.

### R-020 · impact L · evidence known
Planner reachability and output trust. `LLM_API_URL` down, model not pulled, or an op list that parses but names bars that do not exist. Ops are data applied by code, never executed; the risk is a confusing failure, not safety.
- check: health probe like the other engines (`/v1/models` or `/api/tags`); op application rejects unknown bars/sections with a per-op reason in the change list.
- fallback: SCORE verb disabled with "planner offline" when the probe fails.
- source: inferred from the existing engine pattern (config.ts `YUE_API_URL`, `HEARTMULA_API_URL`).

### R-021 · impact L · evidence inferred (stage 6, 2026-10-03)
yue-server's tokenizer is called from request threads (`/v1/scores/measure` today, `/v1/scores/read` and `/apply` in W1) while the job thread may encode; HF fast tokenizers can raise "Already borrowed" under concurrent use (unverified for this tokenizer).
- check: pytest with two threads counting at once; CP1 calls the routes during a render (F-017 #5).
- fallback: the lock (D-042).

### R-022 · impact L · evidence known (seen in code, 2026-10-03)
`server/src/services/genQueue.ts` is 188 of 200 LOC. The score agent adds two kinds only; any new queue behaviour must live in another module or the file splits first.
- check: LOC in review.

### R-023 · impact M · evidence known (seen in code, 2026-10-03)
CI runs only the Playwright golden path: no unit tests, typecheck, lint or yue-server pytest run on PRs, so the score agent's pure-module tests would gate nothing in CI.
- check: `checks.yml` in W0 (D-033).
- fallback: the playbook's local check commands before every commit.

### R-024 · impact H · evidence measured, machine half (SP-4, 2026-10-06; ear half owed)
An edit changes parts of the song nobody asked to change: every SCORE apply re-renders the whole song on YuE2 and the rest drifts (melody F1 0.92-0.98 on an unchanged score, SP-3; the M2 listen heard mood shift and an audible repeat seam, D-077). For the chat-first direction (D-079) each turn would re-roll the song, so iteration may not converge. YuE2 has no inpainting (upstream editing-workflows.md:3); ACE-Step repaint keeps the rest sample-exact but does not read the score.
- check: SP-4 (pipeline/spikes/SP-4-keep-unchanged/SPIKE.md): bar-aligned splice, splice + repaint healing, audio-only REPEAT/CUT, YuE2 forced-prefix continuation; pass bar there.
- fallback: the chat says every turn re-renders the whole song and offers an explicit "keep the old take for these bars" splice.
- SP-4 (machine half, RESULT.md): today a full re-render moves 21-87% of untouched bars by more than 1 dB. A3 = render, then splice the changed bars back with a groove-snapped 1-beat crossfade and a level-matched span: 0 differing samples outside the crossfades, seam excess over the base median 0.16 dB (96% within 1 dB); REHARMONIZE proven 4/4, WRITE PHRASE 3/4, REWRITE LYRICS inconclusive (Whisper). Plain splice disproven (seams up to 5.4 dB), ACE-Step seam healing disproven (worse adherence, quieter windows). REPEAT/CUT as audio-only edits: plumbing proven, acceptability is the listen. 15 of 36 cuts fall inside a sung word. Owed: the user's 20-pair listen (spikes/SP-4-keep-unchanged/listen).

### R-025 · impact M · evidence seen running (SP-4, 2026-10-06)
ACE-Step repaint with an uploaded source works against the `acestep-api` server, not the `acestep --enable-api` launcher CLAUDE.md names: the launcher's `/release_task` ignores `src_audio` and answers 500 on a string `batch_size` (seen in code and running in SP-4). Which one the user's :8001 runs is unverified; the chat's scalpel (C4) and REPAINT rely on it.
- check: confirm the :8001 launcher; fix CLAUDE.md's command or the client if they disagree.

### R-026 · impact M · evidence hypothesis (2026-10-06)
SHIFT/STRETCH (D-085): pitch-shifting a YuE2 take by up to ±2-3 semitones and time-stretching it by ±10-15% may sound processed (formants on the voice, transient smear on drums) next to a re-render.
- check: SP-6, a short spike on 4 library songs with 2-3 DSP options (e.g. rubberband formant-preserving, a phase vocoder), measured key/tempo accuracy and an A/B listen vs the YuE2 re-render.
- fallback: the card offers RE-RENDER only (D-085).

### R-027 · impact H · evidence measured (SP-5, 2026-10-06; owner's lyric read owed)
The chat turn (D-079, D-097) needs one local call of `qwen3:14b` (16k, reasoning off, strict schema) to pick the right action from the closed set, write recipes and lyrics in the request's language, ask only when stuck, and produce SCORE ops that pass the existing validators, in 15 s p50 / 30 s p95 and 6k tokens on the 206-bar song.
- SP-5 (`pipeline/spikes/SP-5-chat-planner/RESULT.md`): bars (a)..(g) all pass on the final prompt (action 97.2% on the 36 scripted single turns and 90.0% on 20 fresh hold-out turns, `ask` on 0 of 12 must-propose, recipes 100% valid with the right language on 32/32, edit plans valid within 3 attempts 31/32, p50 8 s / p95 27 s, unload and empty `/api/ps` every turn, prompt p95 5.3k and 5.4k on the 206-bar song). The first prompt missed three bars; the fixes are prompt, state-block and loop-guard changes (RESULT.md "What C0's turn job should copy"), not the ladder.
- still open: (1) the owner's read of 10 lyric sets (`lyrics.html`; below 8 usable, lyrics move to their own call, built and measured); (2) the tail: a REHARMONIZE of a 40-bar section takes 82-143 s (the root-change rule fails on the first try in 8 of 10 cases and the model cannot write fewer than a chord per bar); (3) unseen wording routes about 90%, not 97%; (4) the card must be built from the fields, not from the model's `message`; (5) the model's GPU residency depends on the owner's other stack staying under about 4 GB.
- fallback: the ladder (router + per-action call: prompt p95 3.8k, no accuracy gain; state-allowed actions; lyrics as their own call) and, last, form-first only (D-086).

### R-028 · impact M · evidence hypothesis (stage 6, chat C3, 2026-10-07)
A reading leaves models on the GPU (ACE-Step's DiT and LM after ANALYZE AUDIO, lyrics-server's speech model), so the follow-up turn's planner (11.7 GB, SP-5: 15.4 of 16.4 GB used with the owner's 3-4 GB) splits to the CPU and the turn slows from about 8-14 s to minutes. SheetSage2 runs as a subprocess and frees its memory on exit (seen in code).
- check: CP-C3 logs nvidia-smi before and during the follow-up turn and the planner's `size_vram` from `/api/ps`; stop line: follow-up p50 > 15 s or the planner not fully on the GPU.
- fallback: drop the caption step (D-135 reversed; instrumentation words come from the person); `ACESTEP_OFFLOAD_TO_CPU=true` (P3) must hold.

### R-029 · impact M · evidence hypothesis (stage 6, chat C3, 2026-10-07)
Transcription of arbitrary audio (SheetSage2) fails the score checker, overruns YuE2's plan budget, or yields a melody a cover does not make recognisable; then F-063 works only for YuE2 library songs. The COVER path it reuses works on library songs today (PLAN.md "YuE2 Melody Covers via SheetSage2"); real recordings are untested here.
- check: CP-C3 (score read ok on at least 2 of 3 audio files, coverable rate, vocal-note density, warnings) and the owner's 3-cover listen (D-133).
- fallback: covers only from YuE2 library songs (their own score) and Guided Create's USE .ABC FILE; an audio reference offers a new song in its style only.

### R-031 · impact M · evidence hypothesis (stage 6, chat C1, 2026-10-07)
The automatic analysis's WORDS step runs lyrics-server's faster-whisper large-v3 (seen in code: `lyrics-server/main.py`, no unload route), which stays resident after the read; the next turn's planner (11.7 GB; SP-5: 15.4 of 16.4 GB used) may split to the CPU and the turn slow from about 8-14 s to minutes. CP-C3 (D-159) measured ACE-Step's residency, not lyrics-server's. (R-030 is SP-6's id.)
- check: CP-C1 logs nvidia-smi and the planner's `size_vram` on the turn after an analysis; stop line: not fully on the GPU, or next-turn p50 over 15 s.
- fallback: drop WORDS from the automatic analysis (D-182; the Editor reads timings on demand), or an unload route on lyrics-server.

### R-032 · impact M · evidence hypothesis (stage 6, chat C1, 2026-10-07)
Every save queues 0-60 s of analysis ahead of the person's next message or APPLY (FIFO, Q-069): a quick "now the verse" after a version waits for its reading, and iteration feels slower than C0b.
- check: CP-C1 logs the queue wait of a turn sent right after a save, per version source (spliced YuE2, whole re-render, ACE-Step); stop line: an analysis of a version of 4 min or less over 90 s.
- fallback: a turn or commit queued behind a *queued* (not yet running) analysis goes ahead of it (a priority rule in its own module; `genQueue.ts` is at its cap), or WORDS leaves the automatic analysis.
