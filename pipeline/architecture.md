# Architecture — Mulakai score agent (M0 on top of the existing app); the chat (C0) follows below

<!-- Stage 6, 2026-10-03. Scope: M0 = F-016..F-025 (scope.md, signed off D-026; dock spec design/score-verb.html, D-032).
     Evidence labels: (code) seen in code today, (run) seen running today, (doc) documented, (inf) inferred.
     LOC figures are estimates for new modules; target 150, cap 200 (AGENTS.md), Python included. -->

## Shape in one paragraph

Three processes, unchanged in kind: the Mulakai server (Express, owns jobs, the GPU queue, plans, versions), yue-server in
WSL2 (owns everything that reads or writes ABC: apply, validate, bar map, duration, token count, render; D-019), and Ollama
(the planner, D-012). The client gets one dock verb (D-007, D-032). Deciding logic is pure on both sides: the op schema,
retry loop, context guard, limits, eligibility, request builder and the dock state machine take values and return answers;
the I/O modules around them are thin and each has a fake. Two GPU-queue kinds are added: `plan` (holds the slot across all
attempts and the confirmed unload, D-011) and `scoreRender` (its own slot; the user's review holds nothing).

## Modules

New files are **bold**. "Pure" = values in, answers out, no I/O, no clock, no DB.

### yue-server (Python, W1 / F-017) — next to the vendored `upstream/abc_tools.py`, never a TS port (D-019)

| Module | Its one job | Pure? | ~LOC | Tested by |
|---|---|---|---|---|
| **yue-server/score_model.py** | parse a native score into header, groups, bars per voice (units, notes, chords by beat, `% section` marks) and write it back byte for byte | yes | 150 | pytest round-trip on the 9 parseable library sidecars (copied fixtures) |
| **yue-server/score_ops.py** | apply SET_TEMPO (`Q:` + style bpm together, R-018), REHARMONIZE (`root`+`quality` enums, split a note/rest with ties at a beat), EDIT_STYLE; return edited ABC, style, one verdict per op | yes | 150 | pytest per op + golden; M1 adds `score_phrase.py`, M2 `score_sections.py`/`score_transpose.py` |
| **yue-server/score_check.py** | upstream `parse_abc` + `compare` with the op's allowed changes, per-bar unit-sum messages with numbers, chords-present flag, chord diff outside the edit window | yes | 120 | pytest: SP-2's 39 golden cases give the same ok/error as upstream (F-017 #1, #2) |
| **yue-server/score_facts.py** | the planner's facts: HEADER, KEY NOTES, SECTIONS, LYRIC BLOCKS, BAR MAP lines (SP-2 format), duration = bars × meter / `Q:` | yes | 120 | pytest on fixtures incl. meter change (`3820c535`), `L:1/16` (`83921775`) |
| **yue-server/score_edit_routes.py** | `POST /v1/scores/read {abc, lyrics}` → verdict + facts + seconds + tokens; `POST /v1/scores/apply {abc, style, ops}` → edited abc/style, verdicts, checks. CPU only; tokens counted **with chords kept** via `worker.count_tokens` (null while the worker loads); never touches the pipeline's GPU path | no (HTTP) | 90 | pytest with the existing `FakePipeline` (asserts `plan()` never called); live GPU-free check at CP1 (F-017 #5) |
| yue-server/worker.py (changed) | `count_tokens` under a lock: the HF tokenizer may be called from a request thread while the job thread encodes (R-021) | no | +5 | pytest: two threads count at once |
| yue-server/main.py (changed) | mount `add_score_edit_routes` | no | +2 | test_api |
| **yue-server/tests/test_score_golden.py**, **test_score_ops.py**, **test_score_edit_routes.py**, **tests/data/score_golden.json** (copy of SP-2 `golden.json`), **tests/data/contract/*.json** (route replies recorded by pytest for the TS fake, D-039) | — | — | — | `python -m pytest` |

`/v1/scores/measure` is left as is (cover section picker; strips chords by design).

### Mulakai server — `server/src/services/score/` (new subfolder, like `services/engines/`; D-034)

| Module | Its one job | Pure? | ~LOC | Tested by |
|---|---|---|---|---|
| **score/scoreTypes.ts** | types only: `Op` (M0: `SET_TEMPO`, `REHARMONIZE`, `EDIT_STYLE`), `Plan`, `OpVerdict`, `ScoreFacts`, `ScoreChecks`, `Eligibility` | yes | 70 | tsc |
| **score/opSchema.ts** | build the strict JSON schema per request (bars 1..N from the song, 17 roots × 15 qualities enums, beat 1..beats-per-bar, bpm 40-240, 1-6 ops) and check a reply's shape | yes | 130 | Vitest: bounds per song, reply shape errors (F-019 #1) |
| **score/plannerRules.ts** | the rules + op reference prose sent as the system message (SP-2 v2 prompt), a constant | yes | 70 | snapshot |
| **score/plannerPrompt.ts** | messages from `ScoreFacts` + stored style + lyric blocks + request; the retry message from errors ("bar 5 had 31/32 units") | yes | 110 | Vitest |
| **score/planAttempts.ts** | the ≤ 3-attempt loop over injected `ask(messages)` and `apply(ops)`: feed errors back, stop on a valid plan, return verdict + attempts + per-op reasons | yes (deps injected) | 100 | Vitest with a stub planner: bar 999 rejected → fed back → 3 fails → `check failed` with reasons (F-019 #3) |
| **score/contextGuard.ts** | preflight (`context_length` ≥ expected prompt + 2,500) and postflight (`usage.prompt_tokens` ≥ char-based lower bound; the SP-2 half-context signature) → ok or the refusal text | yes | 50 | Vitest: 2048 ctx case, 1,027-of-4,511 case (F-020 #3) |
| **score/scoreLimits.ts** | checks + refusals from `{seconds, bpm, tokens, changed}`: warn > 330 s, refuse ≥ 360 s with "at least N BPM fits", tokens ≤ 4,096, "did not change the score or the style" | yes | 70 | Vitest: 145 BPM cover at 88 → 458 s, min BPM (F-022) |
| **score/scoreEligibility.ts** | `hidden` / `ineligible(reason)` / `eligible` from facts: planner configured, `songs.engine = 'yue2'`, `gen_task = 'text2music'`, one layer, every base version made by yue2 (first take or score edit), sidecar present and valid, chords present (D-006, D-021, D-043) | yes | 70 | Vitest table (F-018 #1, #2) |
| **score/planStore.ts** | in-memory pending plans, one per song, replaced by a new PLAN, dropped on render, trash, restart (D-020, D-035) | no (state) | 40 | Vitest |
| **score/plannerClient.ts** | one OpenAI-compatible call: `POST {LLM_API_URL}/v1/chat/completions`, `response_format: {type: json_schema, strict: true}`, `reasoning_effort: "none"`, model `LLM_MODEL`, abort signal + timeout → `{content, promptTokens}` | no (HTTP) | 70 | Vitest against fake Ollama: request body (F-019 #1) |
| **score/ollamaControl.ts** | Ollama-only calls (D-012): probe (`/api/tags` lists the model; `/api/ps` 404 ⇒ "not an Ollama server"), `ps`, unload (`POST /api/generate {model, keep_alive: 0}`), `waitUnloaded` (poll `/api/ps` 250 ms until `models` empty, 10 s bound) | no (HTTP) | 90 | Vitest: model listed for 3 polls, never empties, non-Ollama (F-020 #1, #4, #5) |
| **score/yueScoreClient.ts** | `/v1/scores/read`, `/v1/scores/apply` through `engineClient.request/failure` | no (HTTP) | 60 | Vitest against fake yue (contract fixtures) |
| **score/scoreSource.ts** | **the one resolver** for "what is this song's score": song row, base layer, versions, active version's `params_json` (style, lyrics, seed, `score_v`) and `${versionId}.abc` → `ScoreSource`. Plan, status and render all read through it (lesson: one resolver) | no (DB + file) | 80 | Vitest on a temp DATA_DIR |
| **score/scoreStatus.ts** | status for the route and the render re-check: `scoreSource` + yue `read` + Ollama probe → `scoreEligibility` + reading line facts | no | 70 | Vitest with fakes |
| **score/planJob.ts** | queue kind `plan`: preflight → `planAttempts` (`plannerClient` + `yueScoreClient.apply`) → postflight → **always** unload + `waitUnloaded` in `finally` → plan into `planStore` or `job.error`; `progressText` "attempt n of 3 · reason". The slot is released only when this body settles (D-011) | no | 130 | Vitest: a repaint queued meanwhile does not start between attempts or before the unload confirms (F-019 #4); cancel mid-plan still unloads (F-024 #2) |
| **score/scoreRenderJob.ts** | queue kind `scoreRender`: re-check at run time (eligibility, base version unchanged, plan alive, `/api/ps` empty; each refusal named, no engine job) → submit → `enginePoll` → `scoreVersion` | no | 110 | Vitest with fake yue + fake Ollama (F-018 #3, F-023 #3, #5, #6) |
| **score/scoreVersion.ts** | persist a render: fetch audio + score, transcode like `insertGeneratedSong`, write the sidecar **first** (load-bearing, D-038), insert an active base version (`params_json` with `score_v: 1`, D-037), update song bpm/key/meter from `Q:/K:/M:`; label `score edit · SET TEMPO 88 · REHARMONIZE 17–24` (+ `(truncated)`) | no | 90 | Vitest on temp DATA_DIR (F-023 #2, #4) |
| **engines/yue2Score.ts** | the render request: `{abc: edited, cot: 'full', style, lyrics: as stored, seed: base's}` (D-010, D-023). `buildYue2CoverRequest` stays unchanged | yes | 30 | Vitest (F-023 #1) |
| **services/enginePoll.ts** | `pollEngine` + `stopEngineJob` moved out of `engineGenJobs.ts` so first takes and score renders share one poll loop (D-036) | no | 60 | existing engineGenJobs tests + new |
| **routes/score.ts** | `GET /api/songs/:id/score[?recheck=1]` (state + reading), `POST /api/songs/:id/score/plan {request}` → 202 jobId, `POST /api/songs/:id/score/render {planId}` → 202 jobId or 409 with the stale reason, `POST /api/score/jobs/:jobId/cancel` (queued: `cancelQueued`; running: `abortJob`) | no | 120 | Vitest (supertest pattern as other routes) |
| services/genQueue.ts (changed) | `GenKind` gains `'plan' | 'scoreRender'`; nothing else (file is 188/200, R-022) | — | +2 | queueKinds.test |
| services/jobRunner.ts (changed) | `queueJob` takes an optional extra `onAbort` so a plan can abort its in-flight HTTP call (D-041) | — | +3 | Vitest |
| services/jobRegistry.ts (changed) | `Job.planId?: string` | — | +2 | tsc |
| routes/generateStatus.ts (changed) | `GET /:jobId` returns `planId` (plan body comes from the score route) | — | +2 | Vitest |
| routes/versions.ts (changed) | activate also restores song bpm/key/meter from `params.meta` for a score version (revert restores lyrics, style and sidecar already: they are per version) | — | +6 | Vitest (F-023 #2) |
| config.ts (changed) | `LLM_API_URL` (empty = SCORE hidden), `LLM_MODEL` (default `qwen3:14b`, D-024), `LLM_TIMEOUT_MS`, `PLANNER_UNLOAD_BOUND_MS` (10 s) | — | +6 | — |
| engineGenJobs.ts, index.ts (changed) | import `enginePoll`; mount `scoreRouter` | — | −40 / +2 | existing tests |
| **server/test-fakes/fakeOllama.ts**, **server/test-fakes/fakeYue.ts** | scriptable fakes (see Seams) | no | 120 / 130 | used by Vitest; wrapped by e2e in M1 |
| **server/scripts/scoreCp1.ts** | CP1: drives the HTTP API end to end on a throwaway DATA_DIR and logs the F-025 numbers (see Test strategy) | no | 150 | it is the check |

### Client (`client/src/`, flat as today)

| Module | Its one job | Pure? | ~LOC | Tested by |
|---|---|---|---|---|
| **scoreVerbTypes.ts** | `ScoreVerbState` (the 12 spec states, plus dimmed previous plan) and `ScoreEvent` | yes | 60 | tsc |
| **scoreVerb.ts** | the reducer: every transition in scope.md's table (hidden ⇄ ineligible/offline/asking; asking → queued/planning → plan ready / check failed / offline / asking; plan ready → stale / render queued → rendering → done / truncated / render failed; re-plan dims the old plan; failed re-plan drops it, D-028) | yes | 150 | Vitest: one test per transition + cancel paths (F-021, F-024) |
| **scoreCopy.ts** | all SCORE text: consequence line composed from the ops (follows / a request; EDIT STYLE always a request, D-031; "starts after n jobs"), row text and tag, checks line, refusal and limit lines, job lines | yes | 130 | Vitest: tempo-only plan has no "request" clause; REHARMONIZE plan has it (F-021 #3) |
| **dockVerbs.ts** | the verb list and keys for a song: SCORE appended last with key C only when the server says it is not `hidden` (D-027, D-032) | yes | 30 | Vitest (F-021 #1) |
| **scoreStore.ts** | zustand, per song: calls `api/score`, polls plan/render jobs with the existing `POLL_MS`, feeds events to `scoreVerb`, rehydrates from job ids when SCORE reopens | no | 140 | Vitest with mocked api |
| **api/score.ts** | HTTP: status, plan, render, cancel | no | 50 | — |
| **DockScore.tsx** | the body: reading line (`text-low`), request field, PLAN (acid outline sibling), `DockCommit` with APPLY & RENDER | no | 120 | browser pane (F-021 manual) |
| **ScorePlanList.tsx** | change list rows, checks line, dimmed previous plan | no | 80 | browser pane |
| **ScoreStateLine.tsx** | ineligible / offline / check failed / stale / render failed / TRUNCATED / done lines with RECHECK, PLAN AGAIN, RETRY RENDER | no | 90 | browser pane |
| ActionDock.tsx (changed) | verbs from `dockVerbs`, body `score` → `DockScore` | — | +8 | — |
| useDockKeys.ts (changed) | `verbForKey` takes the verbs on show, so C does nothing on a four-verb song | — | +4 | useDockKeys.test |
| dockTarget.ts (changed) | `DockVerb` gains `'score'`, chip `BASE · WHOLE SCORE`, hint | — | +3 | dockTarget.test |
| api/types.ts, activityRunning.ts (changed) | kind union gains `plan`, `scoreRender`; `RUNNING_LABEL` gets `PLANNING` / `RENDERING SCORE` (tsc forces it; F-019 #5) | — | +3 | activityRunning.test |
| index.css (changed) | SCORE body classes from tokens only | — | — | browser pane |
| docs/design/DESIGN.md (changed, own commit in the F-021 PR) | tab + key, chip, SCORE body, consequence grammar, "planning" in the shader list (D-029) | — | — | review |

### Feature → modules

| Feature | Modules |
|---|---|
| F-016 amendment | docs only: PLAN.md "Score Agent", AGENTS.md Scope Discipline, CLAUDE.md sentence, yue-server/README.md line 6, start-all.bat + PLAN.md env notes (`LLM_API_URL`, `LLM_MODEL`, `OLLAMA_CONTEXT_LENGTH=16384`, `ACESTEP_OFFLOAD_TO_CPU=true`) |
| F-017 yue-server routes | score_model, score_ops, score_check, score_facts, score_edit_routes, worker (lock), tests + contract fixtures |
| F-018 eligibility | scoreEligibility, scoreSource, scoreStatus, routes/score (GET), scoreRenderJob (re-check), client dockVerbs + ScoreStateLine |
| F-019 plan job | opSchema, plannerRules, plannerPrompt, planAttempts, plannerClient, yueScoreClient, planStore, planJob, genQueue/jobRunner/jobRegistry changes, routes/score (plan), client kind labels |
| F-020 hand-off + context | ollamaControl, contextGuard, planJob (finally-unload), scoreRenderJob (`/api/ps` empty at commit) |
| F-021 dock verb | dockVerbs, dockTarget, useDockKeys, ActionDock, DockScore, ScorePlanList, scoreVerb(+Types), scoreCopy, scoreStore, api/score, DESIGN.md |
| F-022 limits | yue `score_facts` (seconds) + `score_edit_routes` (tokens with chords), scoreLimits, scoreCopy (limit lines) |
| F-023 APPLY & RENDER | routes/score (render), scoreRenderJob, yue2Score, enginePoll, scoreVersion, versions.ts activate, ScoreStateLine (done / truncated / failed) |
| F-024 errors and cancel | routes/score (cancel), jobRunner `onAbort`, planJob, ollamaControl, scoreVerb (offline/stale/cancel transitions), scoreCopy |
| F-025 M0 exit | scoreCp1.ts (CP1), the live run in the app (playbook "Score agent: run & verify"), evidence under `pipeline/evidence/` |

## Data

- **Pending plans: server memory only** (`planStore`, D-020, D-035). `Plan = {id, songId, baseVersionId, request, ops, verdicts, abc (edited), style (edited), checks {bars, seconds, tokens, chordsValid}, attempts, createdAt}`. One per song; a new PLAN replaces it; rendered, trashed song or restart drops it. A render naming an unknown plan id is refused "plan expired, plan again" (F-024 #4). No version key: never persisted.
- **Score sidecar: `${versionId}.abc` per version** in `audioDir` (`versionFiles.ts`, unchanged; deleted with the version). For a score version it is load-bearing: written before the version row; a failed write fails the render and leaves no version (D-038). First takes keep their best-effort write.
- **Score versions: existing `versions` rows, no schema change.** `params_json` = `{score_v: 1, engine: 'yue2', task_type: 'score', request: {style, lyrics, seed, cot: 'full'}, lyrics, ops, planRequest, meta: {bpm, keyScale, timeSignature}, basedOn: <versionId>}`; `request.abc` is not duplicated (the sidecar is the score). `scoreSource` reads style/lyrics/seed from the **active** base version's `params_json` (`request.style` for first takes too), so a revert restores style, lyrics and score with no extra code; `versions.ts` restores song meta from `meta`.
- **Version key and migration rule:** `score_v` on score-version params. Additive fields: no bump, readers treat a missing field as absent. A shape change: bump `score_v`, `scoreSource` reads both shapes, and a Vitest named for the trap (e.g. "v1 params without meta keep the song's bpm"). First-take params have no `score_v` and are read by the same resolver (they are shape "0"). DB columns: additive `ensureColumn` only, as `db/index.ts` does today.
- **Never leaves the machine:** everything. `LLM_API_URL` is a local server (scope "Not doing": cloud planners); requests and scores go only to 127.0.0.1 services.

## Seams

| Seam | Real | Fake (tests / local) |
|---|---|---|
| Planner (OpenAI-compatible chat) | Ollama 0.32.15 `/v1/chat/completions` at `LLM_API_URL` (run: 2026-10-03, `/api/version`) | `server/test-fakes/fakeOllama.ts`: node http on an ephemeral port; scripted replies (JSON content, `usage.prompt_tokens`), HTTP errors, a hang, model missing from `/api/tags` |
| Planner control (Ollama-only) | `/api/tags`, `/api/ps` (`models[].context_length`, `size_vram`; doc: docs.ollama.com/api/ps), `POST /api/generate keep_alive 0` (doc: docs.ollama.com/faq) | same fake: `ps` sequence ("listed for 3 polls", "never empties"), `context_length`, a 404 `/api/ps` for "not Ollama", process killed mid-plan |
| yue-server score routes | `/v1/scores/read`, `/v1/scores/apply` (W1) | `server/test-fakes/fakeYue.ts` serving **recorded pytest replies** (`yue-server/tests/data/contract/`), so the fake cannot drift from the real route (D-039); pytest itself uses the existing `FakePipeline` |
| yue-server job API | `/v1/jobs`, status, audio, score, cancel (`engineClient.ts`) | `fakeYue.ts`: canned WAV (reuse `e2e/fake-acestep/wav.ts`), `succeeded` / `truncated` / `failed` / hold |
| GPU queue | `genQueue.ts` (in-memory, already test-friendly: `resetQueue`) | the real module with a held job (a `run` promise resolved by the test) to stand for a busy GPU; `vi.useFakeTimers` for the 250 ms / 10 s polls |
| Clock | `Date.now`, `setTimeout` | Vitest fake timers |
| Storage | SQLite + `audioDir` | temp `DATA_DIR` per test file (existing server test pattern) |
| Client ↔ server | `api/score.ts` | `vi.mock` in store tests; reducer and copy need none |
| In CI (M1, F-028) | — | `e2e/fake-ollama/server.ts` and `e2e/fake-yue/server.ts` wrap the two server fakes; ports beside 8101 (e.g. 8102, 8103); the existing golden path keeps `LLM_API_URL: ''` (add it to `playwright.config.ts` env in W2) |

Every seam named in risks.md: R-003 hand-off → fakeOllama `ps` sequences + CP1 live; R-015 context → fakeOllama context/usage scripts; R-016 validator → pytest golden; R-019 limits → scoreLimits + fakeYue `truncated`; R-005/R-017 eligibility → temp DATA_DIR fixtures; R-020 reachability → fakeOllama offline/missing model; R-010/R-013 render path → yue2Score unit + CP1 live; R-007 queue → real genQueue with a held job; R-001 real ACE-Step drift is outside the score path (unchanged).

## Core-promise path through the code

| Step | Modules |
|---|---|
| Open a YuE2 song; SCORE appears or says why not | client `scoreStore` → `GET /api/songs/:id/score` → `scoreStatus` (`scoreSource` + yue `/v1/scores/read` + `ollamaControl.probe`) → `scoreEligibility` → client `dockVerbs`, `scoreVerb` |
| Type "jazz chords in the chorus, 88 BPM", PLAN | `POST …/score/plan` → `planJob` enqueued as `plan` (queued ⇒ `QUEUED · STARTS AFTER n`) |
| Plan inside one slot hold | `contextGuard` preflight (`ps`) → `plannerPrompt` + `opSchema` → `planAttempts` (`plannerClient` ↔ `yueScoreClient.apply`, ≤ 3) → `contextGuard` postflight → `ollamaControl.unload` + `waitUnloaded` → `planStore` → slot released |
| Review | client polls job → `GET …/score` returns the plan → `scoreVerb` plan ready → `ScorePlanList`, `scoreCopy` consequence, `scoreLimits` verdicts gate APPLY & RENDER |
| APPLY & RENDER | `POST …/score/render {planId}` → re-check (`scoreStatus`, base version, plan alive, `ps` empty) → `scoreRenderJob` as `scoreRender` → `yue2Score` → `engineClient.submit` → `enginePoll` |
| New lilac version | `scoreVersion` (sidecar, version row, song meta) → client reloads song → VERSIONS shows v3 active, v2 below |
| Audible check | CP1 / F-025 analysis (SP-3 `analyze.py` method, run by hand in WSL) + the user's A/B listen |

## Test strategy (by risk)

Spec-first: each pure module arrives with its tests in the same PR (test first); each pure module's tests are checked once by
breaking the code on purpose (e.g. off-by-one in the unit sum, drop the `finally` unload) and seeing them fail.

1. **yue-server `score_ops` / `score_check` (R-016, R-002)** — silent and costly: an applier that writes a score the validator accepts but with the melody moved or chords in the wrong bar costs a 3-minute render and the user's trust. SP-2's 39 golden cases, the 9-sidecar round trip, `compare` per op, the per-bar message format the retries depend on.
2. **Hand-off: `planJob` + `ollamaControl` + `contextGuard` (R-003, R-015)** — silent and costly: YuE2 beside a resident planner runs ~10% slower with the card 98% full and can spill silently; a truncated prompt gives a plan for half a song with HTTP 200. Fake Ollama scripts: listed for 3 polls → release only after; never empties → error naming `ollama stop <model>`; ctx 2048 → refused; `prompt_tokens` at half → refused; cancel mid-plan → unload still confirmed before release; process killed → offline, slot freed.
3. **Queue order (R-007 residue)** — a repaint queued during a plan waits through every attempt and the unload; a render is its own slot; cancel while queued keeps text. Real `genQueue` with a held job.
4. **Eligibility + render re-check (R-005, R-017)** — silent and costly: a re-render that drops a repaint. Table tests; the "repaint lands between plan and APPLY" case refuses with no yue job (fakeYue records zero submits).
5. **Render request + version write (R-010, R-018, D-023)** — `cot: 'full'`, lyrics byte-identical to stored, base seed; sidecar written, revert restores score/style/lyrics/meta, failed render leaves no version, truncated is saved with its label.
6. **`opSchema`, `scoreLimits`, `plannerPrompt`** — bounds per song; the 458 s case and its BPM answer; the no-change refusal.
7. **Client `scoreVerb`, `scoreCopy`, `dockVerbs`, `useDockKeys`** — one test per transition of the spec table; consequence clauses present/absent; C inert on four-verb songs.
8. **The core promise end to end, on the real machine:**
   - **CP1 (after W2, before any UI):** `server/scripts/scoreCp1.ts` against a Mulakai server started on port 3201 with `DATA_DIR` = a copy of `server/data` (never the live library, D-040), real Ollama (`OLLAMA_CONTEXT_LENGTH=16384`), real yue-server in WSL2. It picks or takes `--song`, runs request → plan → render → new version through the HTTP API, samples `nvidia-smi --query-gpu=memory.used --format=csv,noheader -lms 250` and `/api/ps` throughout, and writes `pipeline/evidence/CP1-<date>/log.json` + `nvidia-smi.csv`: plan latency cold/warm, attempts, unload-to-empty, VRAM vs the pre-plan baseline, YuE2 tok/s (from the yue job's `result.json` timing), estimate vs actual duration, `truncated`. Stop lines (scope.md): hand-off > 5 s, YuE2 < 80 tok/s, plan p50 > 60 s → stop and raise before W3. The tempo/root analysis is SP-3's `analyze.py` run in WSL on the two renders (printed command).
   - **F-025 (W5):** the same request in the real app through the dock, driven in the browser pane, plus the two SP-1 owed repeats (ACE-Step idle, ACE-Step after a generation), then the user's A/B listen.
   - **M1 (F-028):** the SCORE golden path in CI against the two fakes.
9. **Regression net now:** the existing client/server Vitest, yue-server pytest and the Playwright golden path stay green on every PR (run 2026-10-03, see playbook).

## Context map (current) and the CI gap

- CLAUDE.md (109 lines) + `@AGENTS.md` (94 lines) always loaded: the budget script exits 1 on the import (run 2026-10-03). Proposal below.
- `.claude/rules/`: none today. `docs/decisions/`: none today.
- CI runs only the Playwright golden path (`.github/workflows/e2e.yml`, code); no unit tests, typecheck, lint or pytest in CI (R-023). Proposed `checks.yml` below (D-033).

## Context skeleton (to land in W0)

Proposed only: CLAUDE.md, AGENTS.md, `.claude/` and `.github/` are shared files and the tree is on another session's branch. Land it as
its own commit in the W0 docs PR (F-016), after the user agrees (Q-030).

### CLAUDE.md (target ≤ 120 lines including what it imports; today 109 + 94 imported)

Trim:
- Replace `@AGENTS.md` (line 7) with one plain pointer: "AGENTS.md holds the full rules (scope, design, git, testing); read it before a
  change outside the area rules." and a 10-line **Costly rules** digest of what loses data or breaks main: never push to main; PR-merge only
  after CI is green on the PR and on main (R-012); module cap 200 LOC; Vitest with every behaviour change; never modify ACE-Step-1.5;
  UI follows DESIGN.md (zero radius, one hue per job, consequence line before every generative commit); scope questions before features
  outside PLAN.md. AGENTS.md itself is unchanged (other tools read it). Saves ~84 always-loaded lines (Q-030).
- "Project Structure" (≈ 20 lines) → 6 lines (folder → one-line job); the per-store list moves into `.claude/rules/client.md`.
- graphify's merge-driver paragraph (≈ 9 lines) → `.claude/rules/graphify-out.md`; keep the 4 query/update lines.
- "Design System" section (3 lines) → covered by the digest + `.claude/rules/ui.md`.

Add (≈ 10 lines):
- Tech stack: "optional score planner: a local Ollama at `LLM_API_URL` (`LLM_MODEL`, default qwen3:14b); SCORE is hidden when unset".
- Commands: `cd yue-server && python -m pytest` (runs on Windows with `requirements-test.txt`; no GPU, torch or yue2).
- Invariant: "The planner and YuE2 never share the GPU: a `plan` job unloads the model and sees `/api/ps` empty before it releases its
  queue slot; never shorten or skip that (`score/planJob.ts`)."
- Invariant: "Only yue-server reads or writes ABC (apply, validate, count); no TS port (docs/decisions/0002)."
- Index line: "Area rules load with their files: `.claude/rules/*.md`; long whys: `docs/decisions/`."
Result ≈ 105 lines, no import. Checked by simulation (2026-10-03, scratch copy: today's CLAUDE.md with the import swapped for an
11-line digest and no trims, plus 9 path-scoped rule stubs): `context-budget.mjs` exit 0, "CLAUDE.md 120/120 lines · rules 0
unscoped, 9 scoped · OK", always-loaded 6.3 KB (from 10.6 KB). The trims above give the headroom; on the real repo it still exits 1
until W0 lands (run 2026-10-03).

### `.claude/rules/` (one per area in the module table; each ≤ 80 lines, `paths:` front matter)

| File | `paths:` | Seed content |
|---|---|---|
| `score-server.md` | `server/src/services/score/**`, `server/src/routes/score.ts`, `server/src/services/engines/yue2Score.ts`, `server/scripts/scoreCp1.ts` | deciding logic in the pure modules (list); I/O modules stay thin; `planJob` unload-in-finally; prompts never show the raw score (bar map); `reasoning_effort: "none"`; refusal texts live in scoreLimits/contextGuard; decisions 0001, 0003 |
| `yue-server.md` | `yue-server/**` | Python modules ≤ 200 LOC; `upstream/` is vendored and unmodified; score routes are CPU-only, never call the pipeline's GPU path; tokenizer calls take the lock; golden + contract fixtures regenerate with `python -m pytest --record-contract` (W1 adds the flag); decision 0002 |
| `job-queue.md` | `server/src/services/genQueue.ts`, `server/src/services/jobRunner.ts`, `server/src/services/jobRegistry.ts`, `server/src/services/*Jobs.ts`, `server/src/services/enginePoll.ts`, `server/src/services/engineClient.ts` | a slot is released only when the backend has let go (drain / unload); genQueue.ts is at its LOC cap: new kinds only, logic elsewhere; run-time re-checks for queued jobs (queueGuards) |
| `versions-data.md` | `server/src/db/**`, `server/src/services/versionFiles.ts`, `server/src/services/songPersist.ts`, `server/src/services/score/scoreVersion.ts`, `server/src/services/score/scoreSource.ts`, `server/src/routes/versions.ts` | additive columns via `ensureColumn`; `params_json` `score_v` rule (additive = no bump; shape change = bump + both shapes read + named test); sidecar per version, deleted with it; score sidecar is load-bearing |
| `dock.md` | `client/src/ActionDock.tsx`, `client/src/Dock*.tsx`, `client/src/dock*.ts`, `client/src/useDockKeys.ts`, `client/src/*Score*.tsx`, `client/src/score*.ts` | verbs from `dockVerbs`; one filled acid commit per dock; consequence line before commit; SCORE copy only in `scoreCopy.ts`; state only through the `scoreVerb` reducer; spec = `pipeline/design/score-verb.html` + DESIGN.md |
| `ui.md` | `client/src/**/*.tsx`, `client/src/**/*.css` | DESIGN.md is mandatory; tokens only; DESIGN.md changes in the same PR, own commit; browser-check UI changes |
| `client.md` | `client/src/**/*.ts` | flat folder; store list (from CLAUDE.md); kinds union forces Activity labels |
| `e2e.md` | `e2e/**`, `server/test-fakes/**` | ports 8101/3101/5183 (+ fakes 8102/8103 in M1); never kill a port you didn't start; fakes serve recorded contract replies; golden path keeps `LLM_API_URL: ''` |
| `graphify-out.md` | `graphify-out/**` | the merge-driver paragraph moved from CLAUDE.md |

### `docs/decisions/` (standard track: choices with real alternatives)

| Record | Decision | Alternatives it beat |
|---|---|---|
| `0001-planner-transport.md` | OpenAI-compatible `/v1/chat/completions` with a strict JSON-schema `response_format` for the plan, plus Ollama-native `keep_alive: 0` and `/api/ps` for release and context (D-002, D-012) | Ollama native `/api/chat` only; llama.cpp router first; a bespoke planner process |
| `0002-score-logic-on-yue-server.md` | apply, validate, bar map, duration and token count run as CPU routes in yue-server next to upstream `abc_tools.py` (D-019, R-016) | a TypeScript port with golden tests (553 lines of spike Python, accidental-semantics drift, LOC cap) |
| `0003-write-phrase-as-notes.md` | WRITE PHRASE (M1) takes `{pitch, beats}` notes and code writes the ABC; REHARMONIZE takes `root`/`quality` enums (SP-2: 100%/94% vs 44% for ABC strings) | free ABC bar strings; a GBNF grammar |
| `0004-plans-in-memory.md` | pending plans in server memory, one per song (D-020, D-035) | a plans table; plans on the Job record (1-hour idle eviction) |

### CI (gate item 5) — proposed `.github/workflows/checks.yml` (D-033)

On PRs into main and pushes to main: `client: npm ci && npm run build && npm run lint && npm test`; `server: npm ci && npx tsc --noEmit &&
npm test`; `yue-server: pip install -r requirements-test.txt && python -m pytest` (Ubuntu). Today CI runs only e2e.

---

# Chat (C0) — talk a song into being, thin

<!-- Stage 6, 2026-10-06. Scope: chat C0 = F-041..F-050 (scope.md "Scope — Chat", signed off D-103), shipped in two halves (D-104):
     C0a create-first (F-041..F-045, F-049 turn half), C0b edit + splice + versions (F-046..F-048, F-049 commit half), F-050 over both.
     Specs: design/chat-create.html, chat-song.html, chat-lyrics.html (frame 3 final, D-095); SP-4 RESULT (A3 splice); SP-5 runs in
     parallel (pipeline/spikes/SP-5-chat-planner/schemas.py and prompt.py are the turn shape copied here).
     Evidence labels as above: (code) (run) (doc) (inf). New-module LOC are estimates; target 150, cap 200. -->

## Shape in one paragraph

No new process and no new GPU-queue kind. A chat turn is one `plan`-kind job (D-106, decisions/0006): one load, the turn's
≤ 3 strict-JSON attempts, one confirmed unload (D-011), whatever the action. An `edit` reply carries SCORE ops inline (SP-5's
shape) and is checked by the score agent's own machinery (`opsArraySchema`, `checkOps`, yue-server `/v1/scores/apply`,
`withLimits`) inside that same slot, so an edit turn is one hand-off (D-100). CREATE SONG is today's YuE2 first take
(`startEngineGeneration`); APPLY is today's score render (`scoreRender` kind) plus, for a single REHARMONIZE on a 4/4 song, a
splice job on yue-server (D-107, decisions/0005). The thread, its messages and the draft live in SQLite (D-108,
decisions/0007); live proposals stay in memory like plans (decisions/0004). Deciding logic is pure: reply schema, reply
checks, draft merge, song-state block, prompt, dispatch, splice eligibility, message states, and on yue-server the DSP, grid
fit and splice plan. **`chat/turnCall.ts` is the one module the SP-5 fallback ladder changes** (router + per-action call;
state-allowed actions only; lyrics as their own call): it returns a checked reply whatever number of calls it made.

## Modules — server, `server/src/services/chat/` (new folder beside `score/`)

### C0a

| Module | Its one job | Pure? | ~LOC | Tested by |
|---|---|---|---|---|
| **db/chatSchema.ts** | `CREATE TABLE IF NOT EXISTS chat_threads, chat_messages` + index (Data below); exec'd from `db/index.ts` after `SCHEMA` | — | 40 | Vitest: a copy of a pre-chat DB opens, tables appear, songs untouched; cascade on permanent delete |
| **chat/chatTypes.ts** | types only: `Draft` (v1), `DraftFields`, `Recipe`, `TurnReply` (ask, recipe, edit, say, scalpel, analyze), `Proposal`, `MessageKind`, `MessageView`, `ThreadView` | yes | 100 | tsc |
| **chat/threadStore.ts** | threads: the draft thread (get or create; NEW CHAT drops it and its messages), a song's thread (get or create), `attach(threadId, songId)`, draft read/write with a `rev` check | no (DB) | 110 | Vitest on temp DATA_DIR |
| **chat/messageStore.ts** | messages: append with the next `seq` (idempotent on `client_key`), list, `lastTurns(n)`, set `job_id` / `version_id` / outcome | no (DB) | 100 | Vitest: double SEND = one row (F-042 edge) |
| **chat/draftModel.ts** | the one draft (D-086): `readDraft(raw)` (version key, raw blob in), `handEdit(draft, patch)` (bumps `rev`, records touched fields), `applyRecipe(draft, recipe, sentRev)` → `{draft, changed, skipped}` (a field touched after `sentRev` is skipped, CH-6) | yes | 110 | Vitest: "skipped TITLE, you changed it"; v0 / unknown blob |
| **chat/recipeRules.ts** | the recipe and CREATE SONG rules in one place: 30 keys (yue-server upstream `KEYS`), section tags (`YUE2_CAPABILITIES.sectionTags`), meters, bpm 40-240, style ≤ 2,000 (yue `request_model.py`), 4-8 lines per section, no tags inside lines, Guided Create's lyrics rule (moved here if it is client-only today); `recipeProblems(recipe)` (retry reasons) and `createBlockers(draft)` (why CREATE SONG is disabled) | yes | 110 | Vitest per rule; a test reads `request_model.py`'s limit (as `phraseSchema` does) |
| **chat/draftFields.ts** | draft → `CreateFields` + title for `buildYue2Request`: style → `prompt`, `Am` → `A minor`, meter, language, lyrics text built in `structure` order (instrumental sections as bare tags) | yes | 70 | Vitest |
| **chat/chatRules.ts** | the system prompt: SP-5's `CHAT_RULES` + the planner's op reference (`plannerRules`), a constant | yes | 60 | snapshot |
| **chat/songState.ts** | the song-state block (SP-5 `song_block`): draft thread → library titles (≤ 50) + "SONG: none yet" + the draft's filled fields; song thread → title, versions with labels, header, key notes, sections, lyric blocks, bar map, style, or the eligibility reason when the score cannot be read | yes | 120 | Vitest: the 206-bar fixture stays ≤ 6k tokens at 3 chars/token (F-042 #2) |
| **chat/songStateSource.ts** | gathers what `songState` needs: thread + draft, library titles, `scoreStatus(songId)` (`scoreSource` + `/v1/scores/read`), the version list | no | 70 | Vitest with fakeYue |
| **chat/turnPrompt.ts** | messages: system rules; user = state block + phrase lines (`phraseLines`, `phraseBarsOf`, reused) + pending proposal + last 4 turns + REQUEST | yes | 80 | Vitest |
| **chat/turnActions.ts** | which actions a turn may answer with, from the state (C0 default: SP-5's whole set; ladder rung 2: only what the state allows) | yes | 40 | Vitest table |
| **chat/actionSchema.ts** | the strict JSON schema of one reply: `anyOf` the allowed actions; recipe enums from `recipeRules`; `edit.ops` = `opsArraySchema(facts, phraseBars)` (reused; dummy 300-bar bounds without a song, as SP-5) | yes | 100 | Vitest: bounds per song, no ABC field anywhere |
| **chat/replyCheck.ts** | one parsed reply → checked reply or reasons: shape per action, `recipeProblems`, and for `edit` `checkOps` → injected `apply` (yue `/v1/scores/apply`) → `withLimits` → `applyReasons` (all reused from `score/`) | yes (deps injected) | 100 | Vitest: out-of-set action, bar 999, a 458 s plan, a bad key |
| **chat/turnAttempts.ts** | ≤ 3 attempts over an injected `ask`: parse, `replyCheck`, feed the reasons back with the reused `retryMessages`; progress "attempt n of 3 · reason" | yes (deps injected) | 70 | Vitest with a stub planner |
| **chat/turnCall.ts** | **the ladder seam**: `decideReply(ctx, deps)` → `{reply, attempts, promptTokens[], calls}`. Rung 0 (default): one call with the full schema. Rung 1: a router call (one enum), then the per-action call; rung 3: a recipe's lyrics as their own call. `CHAT_LADDER` (env, default 0) picks; nothing outside this file knows | yes (deps injected) | 120 | Vitest per rung with a stub `ask` |
| **chat/turnDispatch.ts** | checked reply → outcome: `say` / `ask` → assistant message; `recipe` → proposal + `applyRecipe`; `scalpel` / `analyze` → a `say` naming where it can be done (Editor / Guided Create); `edit` → C0a: a `say` pointing to SCORE in the Editor (D-110); C0b: plan + edit card | yes | 100 | Vitest per action |
| **chat/proposalStore.ts** | live proposals in memory, one recipe proposal per thread (a newer one supersedes), `alive(id)`, dropped on restart (decisions/0004). Edit proposals are `planStore` plans, referenced by `planId` | no (state) | 60 | Vitest |
| **chat/turnJob.ts** | `startChatTurn`: `queueJob({kind: 'plan', label: 'chat turn'})`; body: state → probe → `contextPreflight` → `decideReply` (each call `contextPostflight`) → **`finally` `releasePlanner`** (keep_alive 0 + `/api/ps` empty) → `turnDispatch` → write the assistant message and draft. CANCEL: queued `cancelQueued`; thinking: `onAbort` aborts the call and the `finally` still unloads (D-041). Failure → a `failed` message with the reason, draft untouched | no | 140 | Vitest with fakeOllama: unload on success, check-failed, offline, cancel; a repaint queued meanwhile waits for the unload (F-042 #1, F-049 #1) |
| **chat/messageView.ts** | message row + live job + `proposalStore` / `planStore` → the state the client shows (`queued`, `thinking`, `pending`, `superseded`, `expired`, `committing`, `done`, `failed`, `cancelled`, `interrupted` after a restart) | yes | 90 | Vitest table (F-041 #2, F-049 #3) |
| **chat/createFromDraft.ts** | CREATE SONG: proposal alive, `createBlockers` empty → `draftFields` → `startEngineGeneration(yue2Engine, …, onSaved)`; `onSaved(songId)` attaches the thread and appends the song card (v1's version id) | no | 70 | Vitest with fakeYue jobs |
| **chat/chatStatus.ts** | `{configured: LLM_API_URL and YUE_API_URL set, assistant: 'ok' or 'off', cause}` (`probePlanner`, yue `/health/ready`) | no | 40 | Vitest |
| **routes/chat.ts** | `GET /api/chat/status`; `GET /api/chat/draft`; `POST /api/chat/draft/reset`; `GET /api/chat/threads/:id`; `GET /api/chat/songs/:songId/thread`; `PUT /api/chat/threads/:id/draft {fields, rev}` → `{draft, blockers}` or 409 with the current draft | no | 110 | supertest pattern |
| **routes/chatTurns.ts** | `POST /api/chat/threads/:id/turns {text, clientKey}` → 202 `{jobId, messageId, position}` (200 on a replayed key); `POST /api/chat/jobs/:jobId/cancel`; `POST /api/chat/threads/:id/create {proposalId}` → 202 `{jobId}` or 409 `{reason}`; C0b adds `POST …/apply {proposalId}` | no | 120 | supertest pattern |
| engineGenJobs.ts (changed) | `startEngineGeneration(…, onSaved?)`, called right after `persistEngineSong` | — | +4 | engineGenJobs.test |
| db/index.ts, index.ts (changed) | exec `CHAT_SCHEMA`; mount `chatRouter`, `chatTurnsRouter` | — | +4 | — |
| **server/test-fakes/chatScripts.ts** | reply builders for fakeOllama (`recipe(...)`, `ask`, `say`, `edit(fixture)`, `scalpel`, invalid JSON, out-of-set) + SP-5's recorded replies as data (`test-fakes/data/sp5-replies.json`, copied from SP-5's fixture when it lands) | no | 90 | used by Vitest; e2e in C1 (F-051) |
| **server/scripts/chatCp0.ts** | CP-C0a / CP-C0 driver over the HTTP API (reuses `scoreCp1Lib`: Ollama proxy, GPU sampler) | no | 150 | it is the check |

Job status needs no new route: the client polls `GET /api/generate/:jobId` (existing; it carries `progressText`).
`genQueue.ts` (190/200) is not touched: chat uses the `plan` and `scoreRender` kinds, so the client kind union and
`RUNNING_LABEL` do not move (Activity entries for chat turns are F-080, C8).

### C0b (server)

| Module | Its one job | Pure? | ~LOC | Tested by |
|---|---|---|---|---|
| **score/planBuild.ts** | applied result + attempts + source + request → `Plan` (moved out of `planJob.ts`, which then calls it). The chat's edit turn calls the same function, so a chat plan *is* a SCORE plan (dock and chat agree) | yes | 50 | existing planJob tests + Vitest |
| **chat/spliceEligibility.ts** | `Plan` + facts → `{splice: true, from_bar, to_bar}` or `{splice: false, reason}`: exactly one op, REHARMONIZE, meter 4/4 with no `M:` change in the bar map (SP-4 tested 4/4 only), span inside the song | yes | 50 | Vitest (F-047 edge: 3/4 → whole song, with the reason) |
| chat/turnDispatch.ts (changed) | `edit` → `planBuild` → `setPlan` → edit card snapshot `{planId, ops, verdicts, checks, splice}`; a pending edit card is superseded by the next plan (D-028) | — | +30 | Vitest |
| **score/scoreRenderRun.ts** | the YuE2 leg of a score render, moved out of `scoreRenderJob.ts`: request → submit → poll → `{taskId, truncated}` or null on abort; the caller fetches audio when it needs it | no | 60 | existing scoreRenderJob tests |
| **chat/yueSpliceClient.ts** | `/v1/splices` on yue-server through the `engineClient` helpers: submit (multipart: base audio + spec JSON, `Idempotency-Key` = job id), status, audio, cancel | no (HTTP) | 90 | Vitest against fakeYue's recorded splice replies |
| **chat/gridCache.ts** | `${versionId}.grid.json` sidecar (`grid_v: 1`, tracker downbeats + chord rows, `source: tracked` or `mapped`): read, write; `versionFiles.versionFileNames` gains it, so it goes with the version | no (file) | 40 | Vitest on temp DATA_DIR |
| **chat/spliceRenderJob.ts** | kind `scoreRender`, label `chat edit`: `checkRender` (reused) → `scoreRenderRun` → splice submit (base audio file, base sidecar, plan ABC, render job id, span, cached base grid) → poll (`progressText` `splicing`) → `ok`: fetch the spliced audio, save via `persistScoreVersion` with `splice`; `not_aligned` / no grid / truncated before the span: fetch the whole render and save it labelled (D-101). Grids to `gridCache`. Every exit cancels the yue splice job (its temp files go with it) and logs temp bytes | no | 140 | Vitest with fakeYue: ok, not aligned, truncated, cancel while rendering / splicing → no version |
| **chat/editCommit.ts** | APPLY at the click: proposal alive, `checkRender` (stale → 409 "this song changed since the proposal"), `spliceEligibility` → `startSpliceRender` or the existing `startScoreRender` | no | 60 | Vitest |
| **chat/versionCard.ts** | version row (+ `params.splice`) → card data: label, pill vN, seconds, "bars 25-32 changed", the previous version for A/B (none if deleted) | yes | 50 | Vitest (F-048 edge) |
| score/scoreVersion.ts (changed) | optional `splice` record in `params_json` and a label suffix (`· bars 25–32 spliced`, `· whole song re-rendered: the join could not be aligned`) | — | +12 | scoreVersion.test |
| score/scoreRenderJob.ts, score/planJob.ts (changed) | call `scoreRenderRun` / `planBuild` | — | −40 | existing tests unchanged |
| versionFiles.ts (changed) | the grid sidecar's name in `versionFileNames` | — | +3 | versionFiles.test |
| server/test-fakes/fakeYue.ts (changed) | `/v1/splices` replaying `yue-server/tests/data/contract/splice-*.json` (ok, not aligned, failed, hold) | — | +40 | — |

### C0b (yue-server) — the splice, next to the score code (D-107, decisions/0005)

| Module | Its one job | Pure? | ~LOC | Tested by |
|---|---|---|---|---|
| **yue-server/splice_dsp.py** | numpy/scipy only (from SP-4 `sp4lib.py`): BS.1770 K-weighted short-term LUFS, 40-5000 Hz onset envelope, `pattern_lag` (normalised cross-correlation, ±150 ms, parabolic peak), equal-power fades, `assemble(parts, w)` → audio, joins, map | yes | 130 | pytest on synthetic audio: equal power, a known lag found, the assemble map |
| **yue-server/splice_grid.py** | tracker rows (downbeats, chord rows) + the score's per-bar chords (`score_model`) → bar → seconds: offset −4..4 fitted on bars **outside** the span, half-bar thinning (SP-4 `thin_if_double`), end of song | yes | 120 | pytest on SP-4's recorded `downbeat.lab` / `chord.lab` + scores (copied to `tests/data/splice/`): offsets equal SP-4's |
| **yue-server/splice_plan.py** | grids + span + audio → the cut (first / last downbeat of the span; one join at bar 1 or the last bar), snap (corr ≥ 0.15, cap 80 ms), 3 s gain ramp at both ends, verdict `ok` or `not_aligned(reason)` (D-109), the output grid by mapping, the null test | yes | 140 | pytest: SP-4's snap deltas and gains on the recorded cases; one-join edges; both joins without groove → not aligned |
| **yue-server/splice_job.py** | the `splice` job body on the worker thread: ffmpeg decode to 48 kHz float32 stereo (as SP-4), grids via `Transcriber` (the base only when no cached grid came with the request), plan, assemble, write WAV float32, decode it again and null-test the file; cancellable between steps; result JSON | no | 130 | pytest with a `FakeTracker` (recorded lab rows) |
| **yue-server/splice_routes.py** | `POST /v1/splices` (multipart `audio` = base, `spec` JSON: base ABC, edited ABC, `render_job`, span, cached grid), `GET /v1/splices/{id}`, `/audio`, `/grid`, `POST …/cancel`; auth, queue, Idempotency-Key and upload sweep as `/v1/transcriptions` | no | 110 | pytest + contract fixtures recorded for the TS fake (D-039) |
| **yue-server/splice_check.py** | CLI for CP-C0: `python splice_check.py <base> <saved> <result.json>` → null test outside the crossfades and LUFS step excess at each join over the base's own step, on the *saved library file* | no | 70 | run by hand in WSL at CP-C0 |
| worker.py, transcriber.py, main.py (changed) | dispatch kind `splice`; `Transcriber.run(…, flags)` so the grid run uses SP-4's flags (`--local-files-only`, chords kept, no render); mount the routes | — | +12 | existing pytest |
| requirements.txt / requirements-test.txt (changed) | `scipy==1.18.0` (needs numpy ≥ 2.0 and Python ≥ 3.12; cp312 manylinux and cp314 win_amd64 wheels exist: PyPI JSON, read 2026-10-06; the yue2 venv has numpy 2.2.6 and no scipy, seen running 2026-10-06); tests also pin `numpy==2.4.4` | — | +2 | CI on 3.12, local 3.14 |

### Client (`client/src/`, flat)

C0a:

| Module | Its one job | Pure? | ~LOC | Tested by |
|---|---|---|---|---|
| **api/chat.ts** | HTTP for the routes above; the wire types in one place | no | 100 | — |
| **chatEntry.ts** | the start screen from `/api/chat/status`: `chat` when configured, else `library` (D-099; config, not reachability: an unreachable planner is ASSISTANT OFF inside the chat) | yes | 25 | Vitest |
| **chatTurn.ts** | the reducer for one message's life (scope "A turn, end to end": composing, queued "STARTS AFTER n", thinking "attempt n of 3", outcome, failed, offline, cancelled, interrupted) from the server's `MessageView` + job polls | yes | 130 | Vitest: one test per transition |
| **chatCopy.ts** | all chat copy: consequence lines (recipe: "renders a new song on YuE2, about N min, nothing else changes"), the queue line, ASSISTANT OFF, CHANGED / skipped fields, NEW CHAT's "drops this draft and its N messages", the scalpel / analyze redirects | yes | 120 | Vitest |
| **chatStore.ts** | zustand: the open thread, messages, send (a `clientKey` per message), cancel, CREATE SONG, job polling with the existing `POLL_MS`, rehydrate from job ids after a reload | no | 150 | Vitest with a mocked api |
| **chatDraftStore.ts** | zustand: **the one draft store** (D-086; C6 adds Guided Create as a second reader): fields, `rev`, touched, debounced PUT, `blockers` from the server (rules are never re-implemented on the client) | no | 100 | Vitest |
| **ChatView.tsx** | layout: thread column, player above the composer (D-095), 360 px sidebar / 38 px rail | no | 100 | browser pane at 1366×768 |
| **ChatThread.tsx**, **ChatTurnLine.tsx** | the message list; the running / failed / offline line under a message | no | 90 / 70 | browser pane |
| **ChatComposer.tsx** | textarea + the outline text button `SEND ↵` (never a play glyph) + CANCEL | no | 70 | browser pane |
| **ChatRecipeCard.tsx** | the recipe card (title, style, tempo, key, structure, lyrics collapsed with the line count, engine YuE2), consequence line, CREATE SONG (acid, the card's only commit), superseded / expired states | no | 110 | browser pane |
| **ChatSongCard.tsx** | the song card (title, v1 pill, length) | no | 50 | browser pane |
| **ChatSidebar.tsx**, **ChatDraftFields.tsx** | sidebar frame + rail (filled-field count); the fields, editable while a turn runs | no | 80 / 120 | browser pane |
| **ChatPlayer.tsx** | `Player` + `useSingleAudioPlayback` (reused) on the active version's audio, the version pill; Space via `useSpaceTransport` | no | 60 | browser pane |
| App.tsx, Header.tsx, SongDetailRail.tsx (changed) | view `chat` (start view from `chatEntry`); CHAT ⇄ LIBRARY in the header; OPEN CHAT on a song | — | +20 | browser pane; golden-path e2e unchanged |
| index.css, docs/design/DESIGN.md (own commit) | chat classes from tokens; DESIGN.md clauses for the chat screen, SEND ↵ and the recipe card (DT-C2's first part) | — | — | review |

C0b: **ChatEditCard.tsx** (reuses `ScorePlanList` rows and `scoreCopy`'s consequence plus the splice clause, 100),
**ChatVersionCard.tsx** (label, pill, length, "bars 25-32 changed", BACK TO vN / USE vN, 80), **chatAb.ts** (pure: the
previous version, the A/B position clamp, the NOW PLAYING line's lifetime, 60, Vitest), **useChatPlayback.ts** (a source swap
keeps position and play state, 70, Vitest), and additions to `chatTurn.ts` (commit phases: render queued, rendering, splicing,
saved, commit failed, stale, WAITING FOR v2) and `chatCopy.ts`. USE vN calls the existing version activate route.

### Feature → modules

| Feature | Half | Modules |
|---|---|---|
| F-041 thread kept | C0a | chatSchema, threadStore, messageStore, draftModel, messageView, routes/chat, createFromDraft (attach), chatStore, chatDraftStore |
| F-042 one checked turn | C0a | chatRules, songState, songStateSource, turnPrompt, turnActions, actionSchema, replyCheck, turnAttempts, turnCall, turnDispatch, turnJob, routes/chatTurns, chatScripts |
| F-043 CHAT screen + sidebar | C0a | chatStatus, chatEntry, ChatView, ChatThread, ChatComposer, ChatSidebar, ChatDraftFields, App / Header / SongDetailRail, chatDraftStore, draftModel (skip rule) |
| F-044 recipe card → CREATE SONG | C0a | recipeRules, draftFields, proposalStore, createFromDraft, engineGenJobs `onSaved`, ChatRecipeCard, chatCopy |
| F-045 song card + player | C0a | createFromDraft (song card), ChatSongCard, ChatPlayer |
| F-046 edit card | C0b | replyCheck (edit), planBuild, turnDispatch (edit), spliceEligibility, ChatEditCard, chatCopy |
| F-047 render, then splice | C0b | splice_dsp, splice_grid, splice_plan, splice_job, splice_routes, splice_check, yueSpliceClient, gridCache, spliceRenderJob, editCommit, scoreRenderRun, scoreVersion (splice record) |
| F-048 version card + A/B | C0b | versionCard, ChatVersionCard, chatAb, useChatPlayback, ChatPlayer (BACK TO) |
| F-049 cancel / fail / reload | C0a turn half; C0b commit half | turnJob, messageView, routes/chatTurns (cancel), chatTurn, ChatTurnLine; spliceRenderJob, editCommit (stale), chatTurn commit phases |
| F-050 the whole path | both | chatCp0.ts (CP-C0a, CP-C0), splice_check.py, the live run, the owner's listen |

## Data (chat)

```sql
CREATE TABLE IF NOT EXISTS chat_threads (
  id         TEXT PRIMARY KEY,
  song_id    TEXT UNIQUE REFERENCES songs(id) ON DELETE CASCADE, -- NULL = the draft thread (no song yet)
  draft_json TEXT NOT NULL DEFAULT '{}',                         -- Draft, versioned by draft_v
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS chat_messages (
  id          TEXT PRIMARY KEY,
  thread_id   TEXT NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  seq         INTEGER NOT NULL,                                  -- order in the thread
  role        TEXT NOT NULL,                                     -- user | assistant
  kind        TEXT NOT NULL,                                     -- text | say | ask | recipe | edit | failed | song | version
  text        TEXT NOT NULL DEFAULT '',
  body_json   TEXT,                                              -- card snapshot / turn facts, versioned by chat_v
  proposal_id TEXT,                                              -- live only while proposalStore / planStore holds it
  job_id      TEXT,                                              -- the turn or commit job, for rehydration
  version_id  TEXT REFERENCES versions(id) ON DELETE SET NULL,   -- the version a card shows / a commit made
  client_key  TEXT,                                              -- a user message's idempotency key
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (thread_id, seq), UNIQUE (thread_id, client_key)
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_thread ON chat_messages(thread_id, seq);
```

- **Migration:** additive only. `CREATE TABLE IF NOT EXISTS` runs on every start, so an existing library gets the tables
  with no rewrite; later columns via `ensureColumn`. Songs, layers and versions are untouched (F-041 #1).
- **Lifecycle (D-102):** trash keeps the thread (no row changes); permanent delete removes the song row and the FK cascade
  removes the thread and its messages (`foreign_keys = ON`, code). A deleted version leaves its card with `version_id` NULL
  (no A/B, F-048 edge). Exactly one draft thread: NEW CHAT deletes it (messages cascade) and creates an empty one.
- **Draft (SQLite, the sidebar's source of truth):** `{draft_v: 1, rev, fields: {title, style, bpm, key, timeSignature,
  language, structure[], lyrics, engine: 'yue2'}, touched: {field: rev}}`. The user message stores `sentRev` in its
  `body_json`; `applyRecipe` skips a field touched after it.
- **Message bodies:** `body_json = {chat_v: 1, …}` per kind: recipe card `{recipe, assumptions, changed, skipped}`; edit card
  `{planId, ops, verdicts, checks, splice: {from_bar, to_bar} or {reason}}`; song / version card `{seconds, label, number}`;
  failed `{reasons, cause}`; user `{sentRev}`.
- **Version keys and the migration rule:** `draft_v` and `chat_v` follow the `score_v` rule (versions-data.md): an additive
  field needs no bump and readers treat it as absent; a shape change bumps, the reader handles both shapes from the **raw**
  stored blob, and a Vitest named for the trap proves it. An unknown `draft_v` reads as an empty draft and says so (never a
  crash at start). `grid_v: 1` on grid sidecars, same rule. Version rows: `params_json.splice = {splice_v: 1, bars: [25, 32],
  joins_s, gain_db, snap_ms, length_diff_s, null_test: {samples, different}}` or `{splice_v: 1, fallback: '<reason>'}`,
  additive to `score_v: 1`.
- **Memory, not SQLite (decisions/0004, D-081, D-102):** live proposals (`proposalStore`; edit proposals are `planStore`
  plans), jobs and their progress. A restart shows every proposal card `expired` and every message whose job vanished
  `interrupted`; the thread, draft and versions are intact.
- **Files:** grid sidecars `${versionId}.grid.json` in `audioDir`, deleted with the version. yue-server keeps the uploaded
  base audio and the splice temps in its own job store, removed by cancel and its retention sweep; nothing new on the
  server's disk except the version itself. Nothing leaves the machine.

## The turn job (C0a; C0b adds the edit branch)

1. `POST …/turns {text, clientKey}`: the user message is inserted (a replayed key returns the first one's job), then
   `startChatTurn` queues kind `plan`, label `chat turn`, with `songId` when the thread has one (so trash cancels it).
2. At its turn: `songStateSource` → `probePlanner` (offline → `failed` with ASSISTANT OFF's cause) → `contextPreflight`.
3. `turnCall.decideReply`: `turnPrompt` + `actionSchema` → `turnAttempts` (≤ 3; each reply `contextPostflight`-checked; for
   `edit`, `replyCheck` applies the ops on yue-server and runs `withLimits`, so the retry hears "bar 5 had 31/32 units").
4. **`finally`: `releasePlanner`** — `keep_alive: 0`, then `/api/ps` polled until empty (10 s bound; past it the turn fails
   naming `ollama stop <model>`). The slot is released only when the body settles: one hand-off per turn, whatever the action
   or the number of calls (D-011, D-100).
5. `turnDispatch` → assistant message + proposal + draft merge, written in one transaction. A failed turn writes a `failed`
   message and changes nothing else (atomic).

A message sent while a commit runs is queued behind it (FIFO), so it reads the new version (F-049 #4); the composer shows
WAITING FOR v2 from the queue position.

## The commit paths

- **CREATE SONG (C0a):** `createFromDraft` → `startEngineGeneration(yue2Engine, draftFields(draft))`, kind `generate`, UP NEXT
  and CANCEL as today; truncated takes keep `TRUNCATED_LABEL` (D-025); `onSaved` attaches the thread and appends the song card.
- **APPLY (C0b):** `editCommit` → not splice-eligible: the existing `startScoreRender` (whole song; the card already said so);
  eligible: `spliceRenderJob` in one `scoreRender` slot: YuE2 render (44-92 s), SheetSage2 grid of the new render (~17 s; the
  base grid from cache, else ~17 s more once), splice (~0.2 s CPU; SP-4's numbers), save. Wall-time budget 4 min (CP-C0).

## Splice placement — decided (D-107, decisions/0005)

The splice runs **on yue-server as a `splice` job kind**, not in the Mulakai server. Its grid fit reads the score (per-bar
chords and bar count of the base and the edited ABC) and decisions/0002 keeps all ABC reading there; the SheetSage2 tracker
that writes `downbeat.lab` / `chord.lab` already runs there as a subprocess (`transcriber.py`); and SP-4's DSP is numpy/scipy
code that ports as is, where a TypeScript port would re-implement K-weighting, STFT onset envelopes and cross-correlation.
Inputs: the base version's audio (uploaded, cached by sha256 like transcriptions), the base sidecar ABC, the plan's edited
ABC, the YuE2 render job id (its audio stays on yue-server, no round trip), the span, and the base grid from the server's
sidecar cache when present. Outputs: the spliced float32 WAV, joins, gains, snaps, both grids, the null test, and `ok` or
`not_aligned` with a reason. The server transcodes it to the library format like any render, so the null test holds on the
saved file for WAV and FLAC outputs; MP3 is lossy (the splice is exact before encoding; CP-C0 reports it per format).

## Seams and fakes (chat)

| Seam | Real | Fake |
|---|---|---|
| Chat model (OpenAI-compatible) | Ollama `/v1/chat/completions`, strict schema (decisions/0001) | `fakeOllama.ts` (existing) + `chatScripts.ts`: scripted replies per turn, SP-5's recorded replies as data; hang, HTTP error, model missing |
| Planner control | `/api/ps`, `keep_alive: 0` (existing) | fakeOllama `ps` sequences (existing) |
| yue score read / apply | `/v1/scores/read`, `/v1/scores/apply` | `fakeYue.ts` contract fixtures (existing) |
| yue first take | `/v1/jobs` | `fakeYue.ts` jobs (existing) |
| yue splice (C0b) | `/v1/splices` | `fakeYue.ts` replays `tests/data/contract/splice-*.json` recorded by pytest (ok, not aligned, failed, hold) |
| SheetSage2 tracker | `infer.py` subprocess | pytest `FakeTracker` returning SP-4's recorded lab rows |
| GPU queue | `genQueue.ts` | the real module with a held job |
| Storage / clock | SQLite + audioDir; timers | temp `DATA_DIR`; Vitest fake timers |
| Client ↔ server | `api/chat.ts` | `vi.mock` in store tests; reducers and copy need none |
| CI | — | C0 adds no e2e spec (the chat spec is F-051, C1); the golden path keeps `LLM_API_URL: ''`, so it still opens on the Library (D-099) |

Chat seams in risks.md: R-003 / R-015 (hand-off, context) → fakeOllama sequences + CP-C0a live; R-024 (the rest of the song
moves) → splice pytest goldens + CP-C0's null test and LUFS + the owner's listen; R-025 and R-026 are not on the C0 path.

## Test strategy (chat, by risk)

1. **Turn hand-off and atomicity** (R-003): `turnJob` unloads and sees `/api/ps` empty on success, check-failed, offline and
   cancel; a repaint queued during a turn starts only after the unload; a failed turn leaves draft and proposals untouched.
2. **Model output is outside input**: `actionSchema` / `replyCheck` / `recipeRules` reject an out-of-set action, a bad key, a
   tag inside a line, bar 999 and a 458 s plan with the reasons the retry sends; scalpel / analyze become a `say`.
3. **Stored data**: `chatSchema` on a copy of a pre-chat DB; cascade on permanent delete, nothing on trash; `readDraft` from
   the raw blob (v0, v1, unknown); `client_key` makes a double SEND one turn.
4. **Splice (C0b, silent and costly)**: pytest on synthetic audio (equal-power sum, a known lag recovered within 1 ms, the gain
   ramp's ends matched, the null test exact) and on SP-4's recorded tracker rows (grid offsets and snaps equal SP-4's results);
   `spliceRenderJob`'s fallbacks save the whole render labelled, never a silent splice; every cancel leaves no version.
5. **Draft merge**: the hand-edit skip rule; CREATE SONG sends the live draft, not the proposal.
6. **Client reducers and copy**: one test per `chatTurn` transition; `chatEntry`; `chatAb`'s clamp.
7. Each pure module is broken once on purpose (spec-first, as the score agent).
8. **On the real machine, headless, before any UI:**
   - **CP-C0a** (after the C0a server packages, before the chat UI): `chatCp0.ts --server http://127.0.0.1:3201 --leg create`
     against a server on :3201 with `DATA_DIR` = a copy of `server/data` (D-040), the real Ollama (16k) and the real
     yue-server: 10 scripted descriptions (EN / DE / ES, 3 vague) as turns, then CREATE SONG on one. Log to
     `pipeline/cp-c0/<date>/`: turn latency cold / warm, attempts, prompt tokens, unload-to-empty, recipe validity, YuE2 wall
     time and tok/s, thread attached. Stop lines: turn p50 > 15 s, hand-off > 5 s, a recipe invalid after 3 attempts more
     than once → stop and raise.
   - **CP-C0** (after the C0b server packages, before the edit UI): `--leg edit` on 3 library songs (4/4): edit turn → APPLY →
     splice → version; then `splice_check.py` in WSL on each saved file. Stop lines (scope): edit wall time > 4 min, a null
     test failing, join LUFS excess > 1 dB on 3 of 3 songs.
9. **Regression net**: every existing suite green on every PR; the golden path unchanged (run 2026-10-06, playbook).

---

# Chat (C3) — reference songs

<!-- Stage 6, 2026-10-07. Scope: C3 = F-061..F-065 (scope.md "C3"), moved ahead of C0b/C1/C2 by the owner (D-125).
     Builds on C0a as merged (#147-#157, main 12f0b89); C0b's modules above are not built yet and C3 does not need them.
     Evidence labels: (code) seen in code on main, (run) seen running, (doc) documented, (inf) inferred. LOC are estimates;
     target 150, cap 200. Decisions D-126..D-138, questions Q-091..Q-096, risks R-028/R-029. -->

## Shape in one paragraph

Nothing new runs anywhere: every service C3 calls already serves Guided Create's COVER (code). The person attaches a file or
a library song in the **draft thread**; a turn answers `analyze` (SP-5's action, today redirected) with a READ card; READ
queues **one `transcribe`-kind job, label `chat reading`**, that runs the reading plan WORDS > SCORE > CAPTION inside one
queue slot (lyrics-server, yue-server SheetSage2, ACE-Step ANALYZE AUDIO; a YuE2 library song reads its own score and words
with no GPU at all) and saves a versioned `Reading` (D-126, docs/decisions/0008). The server then queues the **follow-up
turn** itself (D-129): the original request again, with a REFERENCE block in the state, allowed actions ask / recipe / say.
The model answers one `recipe` with `reference_use: cover | borrow | none` (D-128); **code** fills the borrowed fields from
the reading and marks them, the model writes title, style and words. CREATE COVER is CREATE SONG's own path with the
reading's score as `cover` (today's USE .ABC FILE request, cot `melody`); CREATE SONG with borrowed fields is unchanged.
The reference is a copy on disk in a `chat_references` row of the thread, so it follows the thread to the song (D-084,
D-127). F-065 is the score agent's eligibility and render mode (D-132): covers, instrumentals and chord-free scores become
SCORE-editable on the dock now; chat edit turns on them come with C0b's CB-2.

## The flow, end to end

1. **Attach** (draft thread only, D-130): drop a file on the thread or ATTACH ▾ FILE… / FROM LIBRARY…. A file uploads at
   once (`POST …/references`, multipart, `config.coverMaxUploadMb`): probed with `readAudioDuration` (code); unreadable →
   400 with a rust reason (F-061 edge), nothing stored. A library pick (`POST …/references/library {songId}`) copies the
   base layer's active take (D-137) and snapshots the song's own score sidecar, lyrics, caption, bpm, key and meter. Either
   way the composer shows a chip (name, length, ✕); SEND carries `attach: {referenceId}` on the user message.
2. **Turn**: the prompt gains `ATTACHED: "<name>" (3:12, not read yet)` (SP-5's prompt already names an ATTACHED file,
   code: chatRules.ts). A title named in words resolves against LIBRARY too (`referenceResolve`). Reply `analyze` →
   an **analyze card** (proposal kind `analyze`): what will be read, "uses the GPU about N s, changes nothing", the rights
   line, READ. Unresolvable reference → `say` naming what is attached and the ATTACH control. On a song thread → `say`
   pointing to NEW CHAT (D-130).
3. **READ** (`POST …/read {proposalId}`): proposal alive, a library target materialised (copy), `gpuGuard` (no planner
   model loaded unless a `plan` job holds the slot, the check CREATE SONG makes today, extracted), then `startReading`.
   The analyze card becomes `done`; a **reading card** is appended with the job id (queued "STARTS AFTER n", reading
   "WORDS > SCORE > CAPTION" with the current step, CANCEL).
4. **Reading job** (one slot): trim to the first 360 s into a temp file when longer (D-138) → WORDS (lyrics-server
   `transcribeLyrics`, else the library song's own lyrics; `LYRICS_API_URL` unset → `not read: LYRICS_API_URL is not set`)
   → SCORE (the YuE2 library song's own ABC, else yue-server transcription with `chords: true` (D-131), then
   `/v1/scores/read` for facts and `/v1/scores/measure` for the cover budget) → CAPTION (ACE-Step `analyze_audio` when its
   health answers (D-135), else the library song's own caption/bpm/key, else `not read: ACE-Step is not running`). A part
   that fails is `not read: <why>`, never empty; the job fails only when the file cannot be read at all. CANCEL between
   steps; a running transcription is cancelled through the existing `stopTranscription` drain. Temp files removed on
   every exit. The `Reading` is written to the reference row and snapshotted into the reading card's body.
5. **Follow-up turn** (D-129): `startChatTurn(thread, originUser, null, deps, {followUp: referenceId})`; the reading
   card's `job_id` moves to the turn's job so a reload shows "PROPOSING…" under it. SEND stays off (409 `TURN_OPEN`) from
   READ until this turn settles. The state block carries REFERENCE (≤ 1,800 chars): name, length read, tempo / key /
   meter with their source, sections with bars and line counts, first sung line per section, caption, words' language,
   instrumental or not, and `cover: possible` or `cover: not possible (<reason>)`.
6. **Proposal**: `recipe` + `reference_use`. `referenceRecipe` (pure) applies it: **cover** → bpm, key, meter and
   structure from the score (locked, "FROM THE SCORE"), lyrics one entry per score section, card CREATE COVER with
   "keeps the melody, new words and style; renders on YuE2 from the transcribed score, about N min · the new words are
   fitted by YuE2, not guaranteed" (F-063); **borrow** → bpm, key, meter, structure from `readingFacts` (marked
   REFERENCE), a missing value left blank with "no key found in the reference" (F-064 edge), CREATE SONG as today;
   `cover` on a non-coverable reading → `borrow` with the reason said (F-063 edge).
7. **CREATE COVER**: `createFromDraft`'s cover branch: reference and reading alive, `coverVerdict` ok, `gpuGuard`, then
   `startEngineGeneration(yue2Engine, fields, title, undefined, {abc: reading.score.abc, source: reference.name}, onSaved)`
   (code: the `cover` argument exists and records `task_type: 'cover'` and `source`). `onSaved` attaches the thread as
   today, so the reference rows follow it to the song.
8. **Song thread afterwards** (F-062): the sidebar's song panel lists the reference (name, length, read date) with
   RE-ANALYZE (its own consequence line, `POST /api/chat/references/:id/read`, no proposal) and A/B in the player
   (REFERENCE ⇄ SONG at the same seconds, clamped). The REFERENCE block stays in the song thread's state for context.

## Modules — server

| Module | Its one job | Pure? | ~LOC | Tested by |
|---|---|---|---|---|
| **db/chatSchema.ts** (changed) | `chat_references` table + index (Data below) | — | +20 | Vitest: a C0a DB opens, the table appears; cascade from the thread |
| **chat/chatTypes.ts** (changed; CR-1 owns all C3 type additions) | `MessageKind` + `analyze`, `reading`; `AnalyzeBody`, `ReadingBody`, `UserBody.attach`, `RecipeBody.reference`; `Proposal` kind `analyze`; `Recipe.reference_use?`; `Draft.reference?`, `Draft.borrowed?`, `Draft.missing?` (additive, `draft_v` stays 1) | yes | +30 | tsc |
| **chat/reading.ts** | the `Reading` type (`reading_v: 1`), `readReading(raw)` (raw blob in; unknown version → null and "read again"), `readingFacts(reading)` → `{bpm, key, meter, structure, instrumentation, instrumental, sources, missing[]}` (rule: ACE-Step's tempo/key, else the score header; structure from the score's sections), `coverVerdict(reading)` → ok or reason (score read ok, every section inside the measure budget) | yes | 130 | Vitest: v0/unknown blob, every missing part, the cover verdicts |
| **chat/referenceRules.ts** | what an upload must be (size, probed length > 0), `readSpan(seconds)` → `{to: min(s, 360), cut}`, `readingEstimate(plan, seconds)` → GPU seconds per step (constants calibrated in CP-C3) | yes | 60 | Vitest |
| **chat/referenceStore.ts** | rows + files: `fromUpload`, `fromLibrary(songId)` (copy the base active take, snapshot `own_json`), `list(threadId)`, `get`, `setReading`, `sweepFiles()` (delete files in `references/` with no row) | no (DB, files) | 140 | Vitest on temp DATA_DIR |
| **chat/readingPlan.ts** | source → the steps and where each runs: YuE2 library song: own words, own score, own caption (no GPU); other library song: own words/caption, transcribed score; upload: lyrics-server, transcription, ACE-Step; a service unset → that step `skip: <why>` | yes | 60 | Vitest table |
| **chat/readingSteps.ts** | the three step runners over injected clients (`transcribeLyrics`, `runTranscription` + `readScore` + `measureScore`, `analyzeAudio`), each → its part or `{notRead}`; progress text per step | no (deps injected) | 120 | Vitest with stubs: each part failing alone |
| **chat/readingJob.ts** | `startReading(referenceId, {threadId, onRead})`: `queueJob({kind: 'transcribe', label: 'chat reading'})`; trim temp (ffmpeg) → plan → steps → `setReading` + reading-card body → `onRead`; cancel between steps; temps removed in `finally` | no | 120 | Vitest with fakeYue transcriptions: done, partial, cancelled, unreadable file |
| **chat/gpuGuard.ts** | the "no planner model loaded unless a `plan` job holds the slot" check, moved out of `createFromDraft` (one implementation for CREATE SONG, CREATE COVER, READ) | no | 30 | Vitest |
| **chat/referenceResolve.ts** | `analyze.reference` + the user message's `attach` + library rows → `{referenceId}` / `{songId}` / `{reason}` (attach first; then exact, then case-insensitive title; two matches → reason) | yes | 50 | Vitest |
| **chat/referenceTurn.ts** | prompt lines: `ATTACHED:` for an unread attach, the REFERENCE block from `readingFacts` + the reading (≤ 1,800 chars, cut per section) | yes | 90 | Vitest: the block of a 200-bar transcription stays ≤ 1,800 chars |
| **chat/referenceRecipe.ts** | `recipe` + reading + `reference_use` → `{recipe, reference, borrowed, missing, note}`: overrides the borrowed fields, maps score sections to the closed tag list (`% label` → tag, unknown → Verse), cover lyrics one per section; `coverBlockers(draft, reading)` | yes | 120 | Vitest: the model's key never survives a missing key; cover on a non-coverable reading → borrow + reason |
| chat/turnActions.ts (changed) | `TurnState` + `attached`, `referenceRead`, `followUp`; a follow-up allows ask / recipe / say only | yes | +12 | Vitest table |
| chat/actionSchema.ts (changed) | `recipe.reference_use` enum, present only when a reading exists | yes | +10 | Vitest |
| chat/chatRules.ts (changed) | the REFERENCE rule text: cover = the same song with new words or style ("like this, but in German", "sing it about…"); borrow = a new song in its style ("a song like this", "with this vibe"); unsure and a cover is possible → cover, said in assumptions (D-128) | yes | +8 | snapshot |
| chat/turnPrompt.ts, chat/songStateSource.ts (changed) | ATTACHED / REFERENCE lines in the user message; `gatherTurnState(thread, deps, {attach, followUp})` reads the thread's references | — | +15 / +20 | Vitest |
| chat/turnDispatch.ts (changed) | `analyze` → resolved: analyze card + proposal; else `say`; `recipe` with a reading → `referenceRecipe` then `applyRecipe` | yes | +30 | Vitest per branch |
| chat/draftModel.ts (changed) | keeps `reference`, `borrowed`, `missing`; a hand edit of a borrowed field clears its mark (it becomes YOURS); a locked cover field refuses a hand edit with the reason | yes | +20 | Vitest |
| chat/turnJob.ts (changed) | option `followUp` (no user message written; request = the origin's text); an `analyze` dispatch registers its proposal | no | +10 (→ ~182, under the cap) | Vitest with fakeOllama: the follow-up unloads like any turn |
| chat/proposalStore.ts (changed) | proposal kind `analyze` (its own slot per thread, superseded by the next analyze) | no | +8 | Vitest |
| **chat/readCommit.ts** | READ at the click (alive, resolve/materialise, `gpuGuard`, `startReading` with `onRead` = the follow-up turn) and RE-ANALYZE (`gpuGuard`, `startReading`, a new reading card, no follow-up turn) | no | 80 | Vitest |
| chat/createFromDraft.ts (changed) | the cover branch (`coverBlockers`, `cover` argument), `gpuGuard` | no | +15 | Vitest with fakeYue jobs |
| chat/messageView.ts (changed) | states for the analyze card (pending, superseded, expired, done) and the reading card (queued, reading, done, failed, cancelled, interrupted, then the follow-up's thinking) | yes | +20 | Vitest table |
| **routes/chatReferences.ts** | `POST /api/chat/threads/:id/references` (multipart `audio`), `POST …/references/library {songId}`, `GET …/references`, `POST /api/chat/threads/:id/read {proposalId}` → 202 `{jobId}` or 409 `{reason}`, `POST /api/chat/references/:id/read` → 202 | no | 120 | supertest pattern |
| routes/chat.ts, routes/chatTurns.ts (changed) | `ThreadView.references`; NEW CHAT sweeps files · the turn body's `attach` | — | +8 / +6 | existing route tests + cases |
| services/transcribeJobs.ts (changed) | the poll loop exported as `runTranscription(job, engine, source, opts)` so the reading reuses it; `startTranscription` unchanged | — | ±0 | existing tests |
| services/engineTranscribeClient.ts (changed) | `transcribe(…, {chords})` form field | — | +3 | existing tests + case |
| services/transcode.ts (changed) | `trimAudio(src, dst, seconds)` (ffmpeg `-t`) if absent | — | +15 | Vitest on argv |
| services/trashSweep.ts, index.ts (changed) | `sweepFiles()` after a permanent delete and at start; mount `chatReferencesRouter` | — | +3 / +3 | trashSweep test |
| server/test-fakes/fakeYue.ts, chatScripts.ts (changed) | `/v1/transcriptions` replay from `yue-server/tests/data/contract/transcription-*.json` (done with chords, failed, hold); scripted analyze / cover / borrow replies | — | +40 / +30 | — |
| **server/scripts/chatCp3.ts** | CP-C3 driver over the HTTP API (reuses `chatCp0Run.ts` / `scoreCp1Lib.ts`: Ollama proxy, GPU sampler) | no | 150 | it is the check |

**F-065, score half (D-132)** — `score/`, `engines/`, the dock:

| Module | Its one job | Pure? | ~LOC | Tested by |
|---|---|---|---|---|
| score/scoreEligibility.ts (changed) | admits `genTask: 'cover'`, instrumental lyrics and a chord-free read; keeps layers, repaint, no saved score | yes | −6 | Vitest: the three cases flip to eligible |
| **score/renderMode.ts** | `{chordsPresent, ops}` → `{cot, reason}`: chords present or any REHARMONIZE → `full`, else `melody` | yes | 30 | Vitest table |
| engines/yue2Score.ts, score/scoreRenderJob.ts, score/planTypes.ts, score/planJob.ts (changed) | the plan carries `renderMode` (computed where the plan is built); the render request uses its `cot` (was always `full`) | — | +12 | existing tests + cases |
| score/scoreLimits.ts (changed) | REWRITE LYRICS on a song with no lyric blocks → refusal "this song is instrumental: there are no words to rewrite" | yes | +6 | Vitest |
| client/src/scoreCopy.ts, client/src/YueScoreReview.tsx (changed) | the review names the render mode ("renders the melody only, no chords" / "adds chords: renders with chords") | — | +10 | Vitest on copy; browser check |
| yue-server/score_ops.py (only if its new pytest fails) | REHARMONIZE writes chords into a chord-free score | yes | ? | pytest: apply on a chord-free fixture |

**yue-server (D-131)**: `transcriber.py` `run(…, chords=False)` drops `--melody-only` when asked (and `--render-audio`: a
reading needs no piano preview); `transcribe_routes.py` takes a `chords` form field (default false, so Guided Create's
COVER is unchanged); pytest + recorded contract fixtures for the TS fake. CB-1's grid run reuses the same flag. That
SheetSage2 writes chord symbols without `--melody-only` is read from the transcriber's docstring (inf); if the real run
shows none, the reading says "chords: not read" and nothing else changes.

## Modules — client (`client/src/`, flat)

| Module | Its one job | Pure? | ~LOC | Tested by |
|---|---|---|---|---|
| **api/chatReferences.ts** | upload (FormData, progress), library pick, list, read, re-read; wire types `ReferenceView`, `ReadingView` | no | 80 | — |
| api/chat.ts (changed) | `MessageKind` + analyze / reading, the new bodies, `ThreadView.references`, the turn body's `attach` | — | +15 | tsc |
| **chatPoll.ts** | job polling and rehydration moved out of `chatStore.ts` (200/200 LOC today, D-136), first, as its own refactor commit | no | 70 | the existing chatStore tests, moved |
| chatStore.ts (changed) | `send(text, attach?)` | no | −60 +5 | Vitest |
| **chatAttachStore.ts** | the composer's pending attachment per thread: uploading (progress) → attached / failed with the reason; cleared on SEND or ✕ | no | 90 | Vitest with a mocked api |
| **chatReading.ts** | the reducer for the analyze and reading cards (pending, superseded, expired, queued "STARTS AFTER n", reading step k "WORDS > SCORE > CAPTION", done, partial, failed, cancelled, interrupted, then "PROPOSING…") from `MessageView` + job polls | yes | 110 | Vitest: one test per transition |
| **chatReferenceCopy.ts** | all C3 copy: READ's consequence, the rights line (D-134), not-read lines, the 360 s note, instrumental, CREATE COVER's consequence, REFERENCE / FROM THE SCORE marks, missing-field notes, RE-ANALYZE's consequence | yes | 110 | Vitest |
| **chatAb.ts** | the A/B position clamp and which source plays (C0b's CB-5 adds versions to it) | yes | 40 | Vitest |
| **useChatPlayback.ts** | a source swap that keeps position and play state (C0b reuses it for versions) | no | 70 | Vitest |
| **ChatAttach.tsx** | ATTACH ▾ (FILE… / FROM LIBRARY… with the library list), the drop zone over the thread column, the chip | no | 120 | browser pane |
| **ChatAnalyzeCard.tsx**, **ChatReadingCard.tsx** | the READ proposal card; the reading card (steps line; WORDS, SCORE with sections and chords, CAPTION; not-read lines; cover possible or why) | no | 80 / 130 | browser pane |
| **ChatReferencePanel.tsx** | the sidebar's references: name, length, read date, RE-ANALYZE with its consequence line, A/B | no | 90 | browser pane |
| ChatThread, ChatComposer, ChatRecipeCard, ChatDraftFields, ChatSidebar, ChatPlayer (changed) | render the new kinds; the chip slot and drop; the cover variant (CREATE COVER) and the borrowed marks; REFERENCE / FROM THE SCORE field marks and locked cover fields; the panel; the REFERENCE ⇄ SONG pill | — | +10..+25 each | browser pane |
| chatReference.css, chatReferenceSong.css | styles from DESIGN.md tokens, imported by ChatAttach / ChatReferencePanel, so the two UI packages never share a stylesheet | — | — | review |

### Feature → modules

| Feature | Modules |
|---|---|
| F-061 read a file or a library song | chatSchema, referenceRules, referenceStore, routes/chatReferences, readingPlan, readingSteps, readingJob, reading, gpuGuard, referenceResolve, turnDispatch (analyze), readCommit, messageView, transcriber `chords`; api/chatReferences, chatAttachStore, chatReading, chatReferenceCopy, ChatAttach, ChatAnalyzeCard, ChatReadingCard |
| F-062 kept as the song's source, RE-ANALYZE, A/B | chat_references (thread cascade), sweepFiles, readCommit (re-read), routes/chat (`references`); ChatReferencePanel, chatAb, useChatPlayback, ChatPlayer |
| F-063 cover proposal | reading (`coverVerdict`), referenceTurn, chatRules, actionSchema, referenceRecipe, draftModel, turnJob (follow-up), createFromDraft (cover); ChatRecipeCard (cover), ChatDraftFields |
| F-064 fresh song borrowing | reading (`readingFacts`), referenceRecipe (borrowed / missing), draftModel; ChatRecipeCard, ChatDraftFields |
| F-065 cover / instrumental / chord-free scores | scoreEligibility, renderMode, yue2Score, scoreRenderJob, planTypes, scoreLimits, scoreCopy, YueScoreReview (dock, now); the chat edit turn with CB-2 |

## Data (C3)

```sql
CREATE TABLE IF NOT EXISTS chat_references (
  id             TEXT PRIMARY KEY,
  thread_id      TEXT NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  origin         TEXT NOT NULL,                                  -- upload | library
  name           TEXT NOT NULL,                                  -- the file's name or the library title
  source_song_id TEXT REFERENCES songs(id) ON DELETE SET NULL,   -- a library pick; the copy stays when that song goes
  file           TEXT NOT NULL,                                  -- 'references/<id>.<ext>' under audioDir, a copy
  bytes          INTEGER NOT NULL,
  sha256         TEXT NOT NULL,
  seconds        REAL,                                           -- probed length of the whole file
  own_json       TEXT,                                           -- library pick: {own_v: 1, abc, lyrics, caption, bpm, key, meter, engine}
  reading_json   TEXT,                                           -- the latest Reading, reading_v
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_chat_references_thread ON chat_references(thread_id);
```

- **Migration:** additive (`CREATE TABLE IF NOT EXISTS` on every start, as `chat_threads`); songs, layers, versions,
  threads and messages untouched. New message kinds, bodies and draft fields are additive under `chat_v: 1` / `draft_v: 1`
  (the `score_v` rule, versions-data.md): readers treat an absent field as absent.
- **Reading (`reading_v: 1`):** `{reading_v, readAt, seconds, readTo, cut, plan: {words, score, caption: own | service |
  skip}, words: {language, lines[], instrumental} or {notRead}, score: {abc, source: own | transcribed, chords, facts
  (header, sections, lyric_blocks, bars), warnings[], measure} or {notRead}, caption: {caption, bpm, key, meter} or
  {notRead}}`. A shape change bumps `reading_v`; `readReading` handles both from the raw blob, and an unknown version
  reads as "not read: read again" (never a crash). `own_v: 1` on `own_json`, same rule.
- **Lifecycle:** rows cascade from the thread, the thread from the song (D-102): trash keeps them; permanent delete and
  NEW CHAT remove the rows; `sweepFiles()` (at start, after `sweepTrash` / `emptyTrashNow`, after NEW CHAT) deletes every
  file in `audioDir/references/` without a row. A reference attached but never sent stays in the draft thread until NEW
  CHAT. The cover's version row records `source` and `request.abc` as today (code); nothing else changes on songs.
- **Files:** `audioDir/references/<id>.<ext>`, served by the existing `/audio` static route (code: index.ts), so the
  player's A/B needs no new route. Temp trims and yue-server's uploads are removed on every exit (yue-server's own
  retention sweep covers a crash). Nothing leaves the machine: every service is local (D-084).

## GPU and the queue

No new queue kind: the reading is `transcribe` (SheetSage2's kind today, so Activity and the client's kind union already
know it) and holds one slot through its steps, as C0b's splice render holds render + grid + splice. Before it starts,
`gpuGuard` refuses while the planner is loaded (D-053's rule, today inline in `createFromDraft`). The turn before it
released the planner with `/api/ps` empty (D-011) and the follow-up turn queues after it (FIFO), so the planner and the
reading never overlap. SheetSage2 is a subprocess and frees its VRAM on exit (code); lyrics-server and ACE-Step keep their
own models as they do for COVER today: whether that leaves room for the planner's 11.7 GB is **R-028**, measured in CP-C3
(nvidia-smi before the follow-up turn, and its latency).

## Seams and fakes (C3)

| Seam | Real | Fake |
|---|---|---|
| yue transcription | `/v1/transcriptions` (+ `chords`) | `fakeYue.ts` replays contract fixtures recorded by CR-0's pytest (done with chords, failed, hold) |
| yue score read / measure | `/v1/scores/read`, `/v1/scores/measure` | `fakeYue.ts` (existing fixtures) |
| lyrics-server | `transcribeLyrics` | injected stub in `readingSteps` tests (as lyricsJobs.test) |
| ACE-Step ANALYZE AUDIO | `analyzeAudio` | injected stub; health false → skip |
| SheetSage2 | `infer.py` subprocess | the existing transcriber test doubles in pytest |
| reference files | `audioDir/references` | temp `DATA_DIR` |
| chat model | Ollama strict schema | `fakeOllama` + `chatScripts` (analyze, cover, borrow, a cover on a non-coverable reading) |
| CI | — | no new e2e (the chat spec is F-051, C1); the golden path keeps `LLM_API_URL: ''` |

## Test strategy (C3, by risk)

1. **Outside input** (uploads, transcriptions, model output): `referenceRules` and the upload route reject non-audio and
   oversize with the reason and store nothing; `readReading` from raw blobs (v1, unknown); `coverVerdict` on a failed
   read and an over-budget score; `referenceRecipe` never lets the model's tempo or key stand in for a missing reading.
2. **Atomicity and hand-off**: a reading part failing alone leaves the others; a cancel at every step leaves no reading
   and no temp file; `gpuGuard` refuses READ / CREATE COVER while a model is loaded; the follow-up turn unloads like any
   turn (fakeOllama `ps` sequences).
3. **Stored data**: `chat_references` on a copy of a C0a DB; cascade on NEW CHAT and permanent delete; `sweepFiles`
   removes only orphans; trash keeps everything.
4. **F-065**: the eligibility table flips; the `renderMode` table; the render request's `cot`; the instrumental refusal.
5. Client reducers and copy (one test per `chatReading` transition), `chatAb`'s clamp. Each pure module broken once.
6. **On the real machine, headless (CP-C3, after CR-4)**. The named risk, transcription quality on arbitrary audio, is
   measured here, not in a separate spike (D-133): `chatCp3.ts --server http://127.0.0.1:3201` against a `DATA_DIR` copy,
   the real Ollama (16k), yue-server with SheetSage2, lyrics-server and ACE-Step when present. 8 references: 2 YuE2
   library songs, 3 audio files (stand-ins: ACE-Step library songs' audio uploaded as files, one instrumental; the owner's
   own recordings when he gives them, Q-095), 1 longer than 360 s, 1 non-audio file, 1 library song named in words; 10
   scripted requests (5 cover-worded, 5 borrow-worded; EN / DE / ES). Logged to `pipeline/cp-c3/<date>/`: reading wall
   time per step, transcription measures / vocal notes / warnings, read-ok and coverable per reference, prompt tokens
   with REFERENCE, the follow-up turn's latency and the planner's GPU residency (nvidia-smi) after a reading,
   `reference_use` right, recipe validity; then CREATE COVER on 2 and CREATE SONG (borrow) on 1 (YuE2 wall time).
   **Stop lines:** a reading of a file of 4 min or less takes over 4 min; the follow-up turn p50 over 15 s or the planner
   not fully on the GPU; the score read ok on fewer than 2 of the 3 audio files; `reference_use` right on fewer than 8 of
   10; hand-off over 5 s → stop and raise before CR-9.
7. **Owed to the owner** (not blocking `passes`, like SP-4's listen): 3 covers from audio references, "the melody is
   recognisable" on 2 of 3.
8. Regression net: every existing suite green on every PR; the golden path unchanged.
