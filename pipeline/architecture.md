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

---

# Chat (C1) — "this": always analyze, the strip, the mark

<!-- Stage 6, 2026-10-07. Scope: C1 = F-051..F-055 (scope.md "C1"); specs design/chat-song.html CS-3..CS-11 (D-091, player
     above the composer D-095), scope.md "Stale mark". Builds on main d964d0b (C0a, C3, C0b merged). Evidence labels: (code)
     seen in code on main, (run) seen running, (doc) documented, (inf) inferred. LOC are estimates; target 150, cap 200.
     Decisions D-171..D-182, questions Q-109..Q-113, risks R-031/R-032; docs/decisions/0009. Independent of SP-6
     (instrument hold, R-030): C1 touches no render request, no `engines/yue2Score.ts`, `score/scoreRenderRun.ts` or
     yue-server render code. -->

## Shape in one paragraph

No new process and no new queue kind. After a job that saved something on a song with a chat thread settles, the server
queues **one `transcribe`-kind job, label `chat analysis`**, for the song's playable version (the base layer's active take,
D-120): the C3 reading machinery reused (docs/decisions/0008 already names this), steps **WORDS > SCORE > SECTIONS**.
WORDS is lyrics-server and lands in the existing `versions.word_timings` (the Editor's column, code); SCORE is the
version's own sidecar for a YuE2 version or a SheetSage2 transcription with chords otherwise (`readingSteps.runStep`
as is); SECTIONS gets a downbeat grid (the `gridCache` sidecar if one exists, which every spliced version already has
(code: spliceRenderJob writes it), else the grid of the same transcription run, else one tracking run) and asks
yue-server for **bar start times** (`POST /v1/scores/bars`, a thin wrapper over the splice's `splice_grid.fit`; ABC stays
on yue-server, decisions/0002). The result is a versioned `VersionAnalysis` on the version row. A pure `analysisView`
turns it into the player's reading line, the bar ruler and the section strip, and says whether the shown reading is
current, dimmed (an older reading of bars that did not move) or hatched (bars moved, or failed: mark by time). The mark
is a **third `planReferent` kind, `range`** (one implementation of "this" for the dock and the chat; D-090 says it
extends F-032's referent): bars + seconds on a version id, resolved on the server at SEND and again when the turn starts;
a mark whose bars moved is stale and is **never sent** (409 at SEND; a failed line before the planner loads if it went
stale while queued). The whole thing never refuses a commit: the Q-038 #4 check is inverted to an allowlist of edit
kinds (D-173), and FIFO puts an APPLY, CREATE or turn behind a running analysis (Q-069).

## The flow, end to end

1. **Save** (any path: first take, spliced or whole re-render, repaint, retake, add layer, split, import). Every GPU path
   ends in `jobRunner.queueJob`'s settle; it emits `jobSettled({kind, status, songId, label})` (`jobEvents.ts`, new;
   `job.songId` is set by `poll()` and `startEngineGeneration` (code); score and splice jobs carry `songId` at queue time
   (code)). `analysisTrigger` decides (pure `shouldAnalyze`): status `done`, a kind that can change audio (generate,
   repaint, regenerate, retake, addLayer, split, scoreRender), the song has a chat thread, its playable version has no
   current analysis, no analysis pending for the song → `startAnalysis(songId)`. Imports and songs older than C1 are
   caught by **`ensureAnalysis(songId)` on `GET …/songs/:songId/thread`** (same rule).
2. **Queued** behind whatever runs (FIFO). One pending analysis per song (map by song id): a second save while it waits
   starts nothing; the job re-resolves its target when it starts, so it reads the newest playable version.
3. **At its turn**: target = the playable version now; already current → done, nothing read. `gpuGuard` (no planner
   loaded, D-053; refusal → failed with the reason, RETRY). `analysisPlan` (pure) picks each step's source:
   WORDS `stored` (word_timings already present) / `service` / `skip: LYRICS_API_URL is not set` (not a failure,
   F-052 #4); SCORE `own` (scoreSource reads a YuE2 sidecar) / `service` (transcription, chords) / `skip`; SECTIONS
   `cached` grid / `from the score step` (the transcription's grid) / `track` (a chords transcription for the grid only)
   / `skip`. Steps run with a cancel check between them; progress text `WORDS`, `SCORE · transcribing 41%`, `SECTIONS`.
4. **Save**: `analysis_json` on the version (`analysis_v: 1`), word timings to `word_timings`, a new grid to
   `gridCache`. A step that fails is `{notRead}`; the job fails only when the audio cannot be read or the guard refuses,
   and the failure is stored too (`{analysis_v, versionId, failed, at}`) so the reading line survives a reload.
5. **Player**: `GET /api/chat/songs/:songId/analysis` → `AnalysisView`: the playable version id, its state (none,
   queued n, running step, done, failed reason), the reading shown (the current one, or the latest older one with
   `dim` or `hatched`), bar starts, strip sections (label, occurrence, bars, seconds, line count, partial lyric lines),
   `transcribed` (→ "TRANSCRIBED SCORE · CONTEXT AND MARKING ONLY"). The client polls the job through the existing
   `GET /api/generate/:jobId` and refetches the view when it settles or the version swaps.
6. **Mark** (client only until SEND): click a strip section, drag an edge or the body, drag on empty waveform; snap to
   bar starts (Alt frees); clamp to the song's ends. With a hatched strip the mark is seconds only and snaps when a
   reading lands. The chip label is computed on the client from the view (pure, display only).
7. **SEND** `POST …/turns {text, clientKey, attach?, mark?}`: `mark = {kind: 'range', versionId, bars?: [from, to],
   seconds: [a, b]}`. `planReferent.parseReferent` checks the shape; `resolveRange` against the playable version and its
   lineage (D-175): pinned → stored in the user message body (the frozen echo); stale → **409 `MARK_STALE`** with the
   old place, the shift if known, and nothing written.
8. **The turn starts** (possibly after an APPLY it queued behind): `songStateSource` resolves the mark again. Stale now
   → the turn writes a `failed` message ("your mark was on v3; v4 moved those bars · nothing changed · mark again") and
   ends **before the planner loads**. Pinned → `markBlock` adds the MARK lines to the prompt (bars, seconds, the
   sections it covers with partial flags, the lyric lines, key and tempo there) and `actionSchema` bounds every
   bar-valued op field to the mark; a section op outside it is a retry reason (`markFit`); a whole-song op (tempo, key,
   style) is allowed and the edit card says "changes the whole song, not only the marked bars" (D-176).
9. **A version arrives**: the client's `markStale(mark, view)` compares the mark's version id with the view's lineage:
   same → valid; parent and `moved: false` → carried (seconds re-timed from the new reading when it lands); else
   stale: rust chip, the old place outlined, USE BARS only when the lineage carries a shift, CLEAR MARK; SEND held.

## Modules — server

| Module | Its one job | Pure? | ~LOC | Tested by |
|---|---|---|---|---|
| **services/jobEvents.ts** | `onJobSettled(listener)` / `emitJobSettled(info)`; a listener that throws is logged, never fails the job | no (state) | 30 | Vitest |
| jobRunner.ts (changed) | `queueJob` emits `jobSettled` after `run(job, body)` settles (and on a queued cancel) | — | +4 (→ 121) | jobRunner tests + case |
| score/scoreRenderJob.ts (changed) | `pendingEdit` lists only `EDIT_KINDS` (repaint, regenerate, retake, addLayer, split); read-only kinds never stale a plan (Q-038 #4, D-173) | — | ±3 | Vitest: a queued `chat analysis`, `timings`, `transcribe` and `lyrics` job each leave APPLY's re-check clean; a queued repaint still refuses |
| **chat/analysisTypes.ts** | `VersionAnalysis` (`analysis_v: 1`), `BarTimes`, `StripSection`, `AnalysisView`, `RangeMark`; `readAnalysis(raw)` (raw blob in; unknown version or bad shape → null, "read again") | yes | 120 | Vitest: v1, failed record, unknown version, garbage |
| **chat/analysisStore.ts** | `versions.analysis_json` read/write; `playableVersion(songId)` (base layer's active take, the query the chat player uses); `lineage(versionId)` → `{fromVersionId, params}` from `params_json.basedOn` (code: scoreVersion writes it) and the splice record | no (DB) | 90 | Vitest on temp DATA_DIR |
| **chat/analysisPlan.ts** | version facts (own sidecar?, word timings stored?, cached grid?) + `Services` (reused from `readingPlan`) → `{words, score, sections}` step sources with the skip reasons | yes | 60 | Vitest table |
| **chat/barShift.ts** | a version's params + engine / gen task → `{moved: false}` or `{moved: true, shift: {atBar, delta} or null}` relative to its base: REHARMONIZE / SET TEMPO / TRANSPOSE / EDIT STYLE / REWRITE LYRICS / WRITE PHRASE plans keep bars; a spliced or score CUT / REPEAT moves them with a known shift; a repaint keeps them (same timeline); a retake, regenerate, new take, ACE-Step or unknown version moves them with none. The one rule behind dim vs hatched and stale marks (D-180) | yes | 70 | Vitest table |
| **chat/analysisSteps.ts** | WORDS and SCORE through `readingSteps.runStep` (reused; WORDS captures lyrics-server's raw reading for `word_timings`); SECTIONS: grid (cache / transcription grid / track) → `yueScoreBars` → `BarTimes`; each step `{notRead}` on failure, never throws | no (deps injected) | 120 | Vitest with stubs: each step failing alone; a spliced version runs no GPU step but WORDS |
| **chat/analysisJob.ts** | `startAnalysis(songId)`: one pending per song; `queueJob({kind: 'transcribe', label: 'chat analysis', songId, title})`; at its turn re-resolve the target, `gpuGuard`, plan, steps with cancel checks, save (or the failed record); temps removed in `finally`; cancelled only through Activity (CANCEL / ABORT), no route of its own | no | 150 | Vitest with fakeYue: done, partial, failed, cancelled, newer version saved while queued, trash cancels it |
| **chat/analysisTrigger.ts** | subscribes to `jobSettled` at start; pure `shouldAnalyze(event, facts)`; `ensureAnalysis(songId)` for the thread GET | partly | 70 | Vitest table + one subscription test |
| **chat/analysisView.ts** | version analysis + previous analysis + `barShift` + live job → `AnalysisView` (state, current / dim / hatched, bar starts, strip sections with line counts from the score's lyric blocks (YuE2) or from the word timings inside each section (transcribed), the reading line's numbers) | yes | 140 | Vitest table (F-053 #1-3): a third chorus with no lyric block is on the strip |
| score/planReferent.ts (changed) | referent kind `range {versionId, bars?, seconds}`; `resolveRange(mark, playable, lineage, analysis)` → pinned (bars, seconds re-timed) or stale `{was, shift}` | yes | +45 (→ ~150) | Vitest: same version, carried, moved with and without shift, seconds-only mark |
| **chat/markBlock.ts** | pinned range + analysis + facts → the MARK prompt lines and the WHAT IT SEES rows + AS SENT JSON (one function, so the chip shows what is sent) | yes | 90 | Vitest: a mark across two sections; seconds-only "bars not read" |
| **chat/markFit.ts** | ops + mark → retry reasons (a section op outside the mark) and card notes (a whole-song op; a mark longer than an op's limit, clamped) | yes | 50 | Vitest |
| score/opSchema.ts (changed) | `opsArraySchema(facts, phraseBars, minItems, barRange?)`: bar-valued fields bounded to the range | yes | +6 | existing tests + case |
| chat/actionSchema.ts, turnPrompt.ts, replyCheck.ts (changed) | pass the mark's range; the MARK block after the song state; `markFit` reasons into the existing retry feedback | yes | +6 / +10 / +8 | existing tests + cases |
| chat/songStateSource.ts (changed) | reads the playable version's analysis (the state block names the version it read; a transcribed score gives context, never SCORE ops, Q-062 b); resolves the mark at the turn's start | no | +25 | Vitest |
| chat/turnDispatch.ts, messageView.ts (changed) | `markFit` notes on the edit card; the user message's mark echo in its view | yes | +10 / +8 | Vitest |
| chat/turnJob.ts (199/200, split first) | the turn-start mark refusal needs a failed message without loading the planner: **`turnOutcome.ts`** takes the message writing out of `turnJob` as its own refactor commit, then +6 | no | −40 / +6 | existing turnJob tests unchanged |
| **routes/chatAnalysis.ts** | `GET /api/chat/songs/:songId/analysis` → `AnalysisView`; `POST …/analysis/retry` → 202 `{jobId}` or 409 `{reason}`; `POST /api/chat/threads/:id/mark/preview {mark}` → `{rows, sent}` or 409 `MARK_STALE` | no | 90 | supertest pattern |
| routes/chat.ts, routes/chatTurns.ts (changed) | `ensureAnalysis` on the song-thread GET; `mark` in the turn body (409 `MARK_STALE`) | — | +4 / +12 | route tests + cases |
| chat/chatTypes.ts (192/200) | only `UserBody.mark?: RangeMark` (+2); every other C1 type lives in `analysisTypes.ts` | — | +2 | tsc |
| services/engineTranscribeClient.ts, transcribeJobs.ts (changed) | `transcriptionGrid(engine, yueJobId)`; `TranscriptionOutcome.yueJobId` (additive) | — | +12 / +2 | existing tests + case |
| **score/yueScoreBars.ts** | `POST /v1/scores/bars` client → `BarTimes` or a reason | no (HTTP) | 40 | Vitest against fakeYue fixtures |
| db/index.ts, index.ts (changed) | `ensureColumn('versions', 'analysis_json', …)`; subscribe the trigger, mount `chatAnalysisRouter` | — | +1 / +3 | a test on a C0b DB copy |
| server/test-fakes/fakeYue.ts (181/200, split first) | the transcription replay moves to `fakeYueTranscribe.ts` (as `fakeYueSplice.ts` was), which gains `/grid`; `/v1/scores/bars` replays from contract fixtures | — | +25 | — |
| **server/scripts/chatCp1.ts** | CP-C1 driver over the HTTP API (reuses `chatCp0Run.ts` / `scoreCp1Lib.ts`: Ollama proxy, GPU sampler) | no | 150 | it is the check |

**yue-server (D-174)**, CPU only, next to the code that already owns grids and ABC: `transcribe_routes.py` gains
`GET /v1/transcriptions/{id}/grid` (a chords run only: `splice_grid.read_grid` on the job's artifact folder; 404
`no_grid` for a melody-only run); `score_edit_routes.py` gains `POST /v1/scores/bars {abc, grid}` → `{offset, starts[],
end, agreement, bars}` from `splice_grid.validate_grid` + `fit` (the fit the splice uses, so the strip's bars and the
splice's bars cannot disagree). pytest + contract fixtures `transcription-grid-*.json`, `scores-bars-*.json`, recorded
for both TS fakes (D-039). No new dependency, so no version to pin.

## Modules — client (`client/src/`, flat)

| Module | Its one job | Pure? | ~LOC | Tested by |
|---|---|---|---|---|
| **api/chatAnalysis.ts** | analysis view, retry, mark preview; wire types `AnalysisView`, `StripSection`, `RangeMark` (`api/chat.ts` is at 196/200: only the turn body's `mark?` goes there) | no | 60 | — |
| **chatAnalysis.ts** | the reading line's reducer: view + job poll → `READ v4 · 9 SECTIONS · 22 LINES`, `QUEUED · STARTS AFTER n`, `READING v5 · SCORE`, `FAILED · <reason>` + RETRY, `TRANSCRIBED SCORE · CONTEXT AND MARKING ONLY`; strip mode live / dim / hatched | yes | 110 | Vitest: one test per state |
| **chatMark.ts** | mark geometry: section click, edge drag, body move, new drag; snap to bar starts (Alt frees); clamp to the song; seconds-only on a hatched strip, snapped when bars land; `markStale(mark, view)` → valid / carried / stale `{useBars?}` | yes | 140 | Vitest: snaps, clamps, ends, each stale case |
| **chatMarkLabel.ts** | the chip text (`THIS: CHORUS 1 + 2 BARS · BARS 25-34 · 0:58-1:22`, `VERSE 3 - CHORUS 2`, bars only), the echo text, the stale lines (C1's copy lives here: `chatCopy.ts` is at 183/200) | yes | 90 | Vitest per label rule (CS-7) |
| **chatMarkStore.ts** | zustand: the mark per thread; set / clear / USE BARS; the frozen echo copied into the sent message; SEND held while stale | no | 80 | Vitest |
| **ChatStrip.tsx** | waveform (`PlayerWaveform` + `waveformPeaks`, reused), bar ruler, section strip from `StripSection[]`, dim / hatched modes; an `overlay` slot for the mark layer | no | 130 | browser pane at 1366×768 |
| **ChatReadingLine.tsx** | the reading line under the strip with RETRY | no | 50 | browser pane |
| **ChatMarkLayer.tsx** | the sky mark: wash, edge lines with 7 px grips, the snap pointer line and tag, pointer handlers → `chatMark`; Esc / empty click clears | no | 140 | browser pane |
| **ChatMarkChip.tsx** | the composer chip with ✕ and WHAT IT SEES ▾ (rows, AS SENT ▸ JSON from the preview route); the rust stale variant with USE BARS / CLEAR MARK | no | 120 | browser pane |
| **ChatMarkEcho.tsx** | the frozen `MARKED · … on v4` echo on a sent message; click re-marks while valid | no | 50 | browser pane |
| ChatPlayer.tsx, ChatComposer.tsx, ChatThread.tsx, chatStore.ts (changed) | strip + reading line in the player; chip slot, SEND held, "read after v5's reading" while an analysis runs (Q-069); the echo; `send(text, attach?, mark?)` | — | +15..+25 each | browser pane; existing tests |
| chatStrip.css, chatMark.css | from DESIGN.md tokens; one sky (CS-6) | — | — | review |

### Feature → modules

| Feature | Modules |
|---|---|
| F-051 chat e2e | `e2e/tests/chat.spec.ts`, `e2e/fake-score/{ollama,yue,chatReplies}.ts`, `e2e/playwright.config.ts` |
| F-052 analyze after every save | jobEvents, jobRunner, scoreRenderJob (`EDIT_KINDS`), analysisTypes, analysisStore, analysisPlan, analysisSteps, analysisJob, analysisTrigger, routes/chatAnalysis (retry), yueScoreBars, engineTranscribeClient, transcribe_routes `/grid`, score_edit_routes `/bars`; chatAnalysis, ChatReadingLine |
| F-053 waveform, ruler, strip | analysisView, barShift, routes/chatAnalysis (view); api/chatAnalysis, chatAnalysis, ChatStrip, ChatPlayer |
| F-054 marking | chatMark, chatMarkLabel, chatMarkStore, ChatMarkLayer, ChatMarkChip, ChatComposer |
| F-055 the mark with the turn, stale | planReferent (`range`), markBlock, markFit, opSchema (`barRange`), actionSchema, turnPrompt, replyCheck, songStateSource, turnOutcome / turnJob, turnDispatch, messageView, routes/chatTurns (`MARK_STALE`), mark preview; chatMark (`markStale`), ChatMarkEcho, the stale chip |

## Data (C1)

- **`versions.analysis_json`** (new column through `ensureColumn`, additive; old rows read as "not analyzed"):
  `{analysis_v: 1, versionId, readAt, plan: {words, score, sections}, words: WordsPart | {notRead}, score: ScorePart |
  {notRead}, bars: {source: 'cached' | 'tracked' | 'mapped', offset, starts[], end, agreement} | {notRead}}`, or the
  failure record `{analysis_v: 1, versionId, failed: '<reason>', at}`. `WordsPart` / `ScorePart` are C3's types
  (`reading.ts`), reused. A transcribed score's ABC is kept in `score.abc` for context and marking only: `scoreSource`
  never reads it, so SCORE stays off for that version (Q-062 b). A shape change bumps `analysis_v`; `readAnalysis` reads
  both from the raw blob; an unknown version reads as "not analyzed" (versions-data.md's rule).
- **`versions.word_timings`** (existing, code): WORDS writes lyrics-server's reading there, so the Editor's
  click-a-lyric-line finds it ready; a version that already has one skips WORDS.
- **`${versionId}.grid.json`** (existing `gridCache`, `grid_v: 1`): SECTIONS writes a tracked grid there, so the next
  splice on that version sends it instead of tracking (F-052 #2); a spliced version's `mapped` grid is already there.
- **The mark** is not stored on its own: the client store holds it per thread (memory); a sent mark is frozen in the
  user message's `body_json.mark` (additive under `chat_v: 1`): `{kind: 'range', versionId, bars, seconds, label}`.
- **Lifecycle:** all three go with the version (the row and `versionFileNames`, code). Trash cancels a queued or running
  analysis like any song job (`cancelQueuedForSong`, code). Nothing leaves the machine.

## GPU and the queue (C1)

- One slot, FIFO, no new kind (`transcribe`, label `chat analysis`; Activity and the client's kind union know it, code).
  Analysis never overlaps the planner or YuE2: the slot is single, the turn before it released the planner with
  `/api/ps` empty (D-011), and `gpuGuard` re-checks at its start.
- **It never refuses a commit.** APPLY's click-time re-check refuses on any non-SCORE job queued for the song (code:
  `scoreRenderJob.pendingEdit`), so a queued analysis would read as "a chat analysis was queued after this plan" and
  stale every edit card (Q-038 #4). D-173 inverts it to an allowlist of edit kinds. CREATE SONG / COVER pass `gpuGuard`
  only (planner off the GPU; code), which an analysis does not trip. The thread's BUSY rule (D-149 b) stays with turns,
  readings and CREATE: a version analysis is not in the `readings` map and never holds SEND.
- **Cost, honestly (inf, to be measured in CP-C1):** WORDS ~10-30 s (lyrics-server, large-v3); SCORE 0 s for a YuE2
  version (own sidecar) or ~20 s (SheetSage2; CP-C3's ACE-Step references); SECTIONS 0 s with a cached grid (every
  spliced version), 0 s extra when the score step's transcription gave it, else ~17 s tracking (SP-4). So a spliced YuE2
  edit costs only WORDS; a whole re-render ~30-50 s; an ACE-Step take ~40-60 s. A turn or APPLY sent at once waits that
  long (R-032), and lyrics-server's large-v3 may stay resident and push the planner (11.7 GB) partly off the GPU (R-031).

## Seams and fakes (C1)

| Seam | Real | Fake |
|---|---|---|
| yue grid of a transcription | `GET /v1/transcriptions/{id}/grid` | server `fakeYueTranscribe` + `e2e/fake-score/yue.ts` replay `transcription-grid-*.json` recorded by pytest |
| yue bar times | `POST /v1/scores/bars` | the same, `scores-bars-*.json` (exact-body match, as the score fixtures) |
| lyrics-server | `transcribeLyrics` | injected stub in `analysisSteps` tests; unset in e2e (WORDS skipped, not a failure) |
| job settle events | `jobEvents` | the real module; Vitest drives `emitJobSettled` |
| GPU queue | `genQueue.ts` | the real module with a held job (an APPLY queued behind a running analysis) |
| chat model | Ollama strict schema | `fakeOllama` + `chatScripts` (server); `e2e/fake-score/ollama.ts` + `chatReplies.ts` (SP-5's recorded replies as data; hold and offline switches) |
| client ↔ server | `api/chatAnalysis.ts` | `vi.mock` in store tests; reducers need none |
| CI | — | `chat.spec.ts` on the `score` project's stack (fake Ollama 8102, fake yue 8103, server 3102, Vite 5184; D-178); the golden path keeps `LLM_API_URL: ''` |

Risk seams: R-031 / R-032 → CP-C1 on the real machine (nvidia-smi, `/api/ps` `size_vram`, queue waits); "stale marks sent
as fact" → `resolveRange` + `barShift` tables and the chat e2e's stale steps; R-024 / R-030 stay with SP-6.

## Test strategy (C1, by risk)

1. **GPU scheduling never refuses a commit** (the milestone's named risk): `checkRender` with a queued and with a
   running `chat analysis` (and `timings`, `transcribe`, `lyrics`) → no refusal; a queued repaint still refuses;
   APPLY, CREATE SONG and a turn queued behind a running analysis start after it, in order; an analysis queued while a
   turn holds the slot starts only after the unload (fakeOllama `ps` sequence); a `gpuGuard` refusal fails the analysis
   with the reason, never the next commit; one pending analysis per song; a newer version saved while it waits is the
   one read; trash cancels it.
2. **Stale marks sent as fact**: the `barShift` table (every op kind, splice kinds, repaint, retake, ACE-Step,
   unknown); `resolveRange` pinned / carried / stale with and without shift; SEND with a stale mark → 409 and nothing
   written; a mark that went stale while the turn queued behind an APPLY → failed line, and fakeOllama saw no call;
   the client's `markStale` table; a test per path asserts the bars sent equal the mark's, or the turn refused.
3. **Outside input**: `readAnalysis` from raw blobs (v1, failed, unknown, garbage); grid and bars replies validated
   (yue `validate_grid` + a TS shape check); a mark body past the song's end or reversed → 400.
4. **Stored data**: `analysis_json` on a copy of a C0b DB; deleting a version removes analysis, timings and grid; trash
   keeps them.
5. **The plan stays in the mark**: the schema's bar bounds; `markFit` reasons and notes; with no mark the whole song is
   the scope and every existing turn test passes unchanged.
6. **yue-server**: pytest for `/grid` (a chords run ok, melody-only → 404) and `/bars` (SP-4's recorded rows give
   SP-4's offsets; a bad grid → 422), contract fixtures recorded for both fakes.
7. Client reducers and copy: one test per `chatAnalysis` state, every `chatMark` gesture, snap, clamp and label rule.
   Each pure module broken once on purpose.
8. **E2E (F-051, first)**: `chat.spec.ts` recipe → CREATE SONG → edit turn → APPLY → v2 card; edges: ASSISTANT OFF,
   CANCEL while thinking (fake hold), a stale card (USE v1, then APPLY the card planned on v2 → STALE). CL-8a adds the
   strip and the reading line; CL-8b a mark sent with a turn (the fake Ollama's recorded prompt carries MARK) and a
   stale chip.
9. **On the real machine, headless (CP-C1, after CL-4 and CL-5, before the client strip)**: `chatCp1.ts --server
   http://127.0.0.1:3201` on a `DATA_DIR` copy, the real Ollama (16k), yue-server and lyrics-server. 3 YuE2 songs and 3
   non-YuE2 songs (ACE-Step, a cover): analysis wall time per step and per source; section names on the 3 transcribed
   songs (Q-070, recorded); an APPLY and a CREATE clicked while an analysis runs and while one is queued (never refused,
   start order logged); a turn sent right after a save (its queue wait); nvidia-smi and the planner's `size_vram` on the
   turn after an analysis (R-031); 10 marked edit turns (5 one-section, 3 cross-section, 2 seconds-only) → ops inside
   the mark, prompt tokens with MARK. **Stop lines:** any commit refused because of an analysis; an analysis of a
   version of 4 min or less over 90 s; the planner not fully on the GPU after an analysis, or the next turn p50 over
   15 s; an op outside the mark on more than 1 of 10; prompt p95 over 6k tokens → stop and raise before CL-8a.
10. Regression net: every suite green on every PR; the golden path and the score spec unchanged.

# Chat (C2) — converging turns: lyrics panel, REVISE, UNDO TURN, the bar map

<!-- Stage 6, 2026-10-08. Scope: C2 = F-056..F-060 (scope.md "C2"); specs design/chat-lyrics.html LY-1..LY-6,
     chat-create.html CH-4/CH-5, chat-edit.html EC-2 (the strip the bar map replaces), score-m2.html M2-6/M2-8 (the
     dock's REVISE marks and OLD | NEW, reused); DT-C2 draws what none of them drew. Builds on main 72e18a2 (C1 merged;
     its live re-check and curate run elsewhere). Evidence labels: (code) seen in code on main, (run) seen running,
     (doc) documented, (inf) inferred. LOC are estimates; target 150, cap 200. Decisions D-213..D-226, questions
     Q-133..Q-135, risks R-040/R-041; docs/decisions/0010. Owns no yue-server transcription file (the "Re-time a
     transcription" session works there, D-190). -->

## Shape in one paragraph

No new process, no new queue kind, no new table. C2 is mostly the score agent's own machinery behind chat cards.
**REVISE** is not a button: when a turn starts on a song thread whose live edit card still holds the song's
pending plan and the song is unchanged since (`planStore` plan id + `fingerprint`, code), the turn's edit action
becomes the dock's revise contract: the planner sees the PENDING PLAN block (`planRevise.pendingLines`, code),
answers `{action: 'edit', drop, ops}`, and `reviseReply.readRevise` / `mergeRevise` (D-073, D-076, code) merge it
into the pending plan, which is applied to the base as read, checked by `withLimits` and stored as plan n+1 with
`since` (NEW / CHANGED / SAME, REMOVED). A new card supersedes the old one; `ScorePlanList` already draws the marks
(code). The **bar map** replaces C0b's span strip in the edit card: built on the server (`barMap.ts`, pure) from the
facts the planner saw (sections, bar count) and each op's bars, stored on the card body; hovering a change-list row
lights its bars. The **lyrics panel** rides in the analysis view C1 already polls: the shown reading gains
`lyrics` (pure `lyricsPanel.ts`): a YuE2 version's stored words split into tagged blocks and paired with the strip's
sections by the one pairing rule (`score/lyricPairing.ts`, which replaces four copies of `kindOf`), or a transcribed
version's heard lines with their seconds. Line times on YuE2 lines come from the client's existing `alignLyrics`
(the Editor's) over the version's word timings, so marking a line is C1's mark with snapped bars. A pending
REWRITE LYRICS shows its diff on the card (exists, M2-8) and inline in the panel. **UNDO TURN**: a recipe turn's
body stores what it replaced (`undo: {rev, before}`), written in the same transaction as the merge; a route restores
exactly the fields that turn filled that nobody touched since. The just-filled marks are derived from that record,
so they survive a reload.

## The flow, end to end

1. **Lyrics panel (F-056).** The song sidebar on a song thread shows VERSIONS, STYLE, TEMPO · KEY and the panel
   (LY-1; the locked draft fields leave the song thread, D-219). `GET /api/chat/songs/:songId/analysis` (C1) now
   carries `shown.lyrics`. The client's pure `chatLyricsPanel` turns it, the mark and the version's word timings
   (`alignLyrics`, reused) into rows: no mark → the section list (name, bars, line count, first line; click marks
   it); a mark → only the marked part, a section partly inside lists its marked lines and "n more lines not marked",
   two sections under their headers with a dashed break (LY-3). The panel never follows playback (LY-2) and never
   edits words (Q-075). States come from the analysis view as they are: running → the old panel dimmed; failed →
   the reason + RETRY (the C1 retry route); no words → how to get them (LY-6).
2. **Marking from the panel.** Click a line → its seconds (aligned or heard) snapped to bars by `chatMark` (C1) →
   the C1 mark store; shift-click extends to the line clicked; a header marks its section; double-click plays from
   the line (or the section start). A line with no time marks its section (D-218). The chip, WHAT IT SEES, stale
   handling and SEND are C1's, unchanged.
3. **A pending lyric rewrite (F-057).** The edit card's REWRITE LYRICS row already shows OLD | NEW (code:
   `ScorePlanList` → `ScoreLyricDiff` from the verdict's `diff`), and the consequence line already says the whole
   song re-renders (code: `editConsequence`). The panel finds the live edit card's diffs by block index: the
   marked section shows its old lines struck above the new; a rewritten section outside the mark is appended in
   song order tagged PROPOSED, and the mark is untouched (Q-074). Both last while the card is `pending` (D-222).
4. **REVISE (F-058).** SEND on a song thread with a live edit card. At the turn's start `turnRevise.pendingFor`
   finds the card's plan; if it is still the song's plan and the fingerprint matches, the turn revises: PENDING
   PLAN lines in the prompt (after the state and the MARK block, where the draft thread puts its draft lines), the
   edit schema gains `drop` (pending op numbers) and its `ops` may be empty, `replyCheck` reads the edit through
   `readRevise` (shape, numbers, NOTHING_REVISED, MAX_OPS 6 as a named refusal), bounds only the returned ops to
   the mark (`markFit`, D-214), then applies the merged plan once (`applyOps` + `withLimits`, as today) with the
   merge legend in any retry. The card is plan n+1 with `revision`, `since` and a fresh bar map; `setPlan` replaces
   the song's plan (D-028) and the old card reads superseded ("revised below"). A failed, cancelled or offline turn
   writes its failed line and leaves the card and plan alive (code: a failed turn writes nothing else). A `say` or
   `ask` reply leaves the card pending too. A song changed since the card → no revise, a fresh plan, as today.
   Dropping every pending op and returning new ones is a replacement (all REMOVED + NEW), never silent (D-213).
5. **The bar map (F-060).** `barMap(facts, ops)` at dispatch → `body.map = {bars, sections, ops: [{spans, whole}]}`:
   REHARMONIZE its bars, WRITE_PHRASE start + length, REPEAT / CUT its section, REWRITE LYRICS the section its block
   pairs with (`lyricPairing`), SET TEMPO / TRANSPOSE / EDIT STYLE the whole song (`whole`, hatched). The card draws
   the map (sections as bands, edited bars sky, whole-song ops hatched), `ScorePlanList` reports the hovered row,
   the map lights that op's spans. Cards from before C2 have no `map` and keep the C0b strip from `splice` (D-215).
   Legibility at 200 bars in the card's width is DT-C2's (F-060 edge).
6. **UNDO TURN (F-059).** A recipe reply's merge (`draftModel.applyRecipe`) also returns `before` (each changed
   field's previous value, absent = was empty); `turnDispatch` stores `undo: {rev, before, fields}` in the recipe
   body. `POST /api/chat/threads/:id/messages/:messageId/undo` (pure `draftUndo` inside one transaction): refused 409
   when the thread has a song, a turn is open, the message has no record or was undone; else each field the turn
   filled is restored when it still holds the turn's value and `touched[field]` is not after `rev`, else kept and
   named ("kept STYLE: you changed it"); the draft gets a new rev; the message body gets `undone`. The recipe card
   stays live and mirrors the draft (TU-7, D-220). `messageView` exposes `undo: 'offer' | 'done' | null`. The
   marks: the latest recipe message with no later user message gives the ASSISTANT fields and their struck old
   values (from `before`, D-221); a hand edit turns that field YOURS (code: `fieldMark`).

## Modules — server

| Module | Its one job | Pure? | ~LOC | Tested by |
|---|---|---|---|---|
| **chat/convergeTypes.ts** | all C2 server types: `BarMap`, `LyricsPanel`, `PanelSection`, `PanelLine`, `RecipeUndo`, `UndoResult`, `RevisePending` (CV-1..CV-3 and CV-4's wire types build on one contract) | types | 70 | tsc |
| **score/lyricPairing.ts** | `kindOf(tag)` and `pairBlocks(sections, blocks)` (the k-th section of a kind sings the k-th block, D-066 d), the one server rule; `analysisView`, `markBlock`, `markFit`, `planReferent` switch to it (own refactor commit, D-216) | yes | 40 | Vitest + a cross-test against yue-server's `read-sections.json` |
| **chat/barMap.ts** | facts + ops → `BarMap` (sections, bars, each op's spans or whole) | yes | 70 | Vitest table: every op kind, a REWRITE LYRICS of the 2nd chorus, a 200-bar song |
| chat/draftModel.ts (changed, 148) | `applyRecipe` also returns `before` for the changed fields | yes | +6 | existing tests + case |
| chat/editTypes.ts, chatTypes.ts (changed, 34 / 194) | `EditBody.revision?`, `since?`, `map?` (+3); `RecipeBody.undo?: RecipeUndo`, `undone?` (+2) | types | +5 | tsc |
| chat/turnDispatch.ts (changed, 119) | the recipe body's `undo`; the edit card's `map` (CV-0), and with a revise its `revision` / `since` (CV-1; `buildPlan` takes both, code) | yes | +10 | Vitest |
| **chat/turnRevise.ts** | `pendingFor(threadId, songId, fingerprint)` → `RevisePending {plan, lines, count}` or null (liveEdit + getPlan + fingerprint); the PENDING lines are `planRevise.pendingLines` | no (stores) | 50 | Vitest: live card, superseded, plan replaced by the dock, song changed |
| score/reviseReply.ts (changed, 76) | exports the `drop` schema part for the chat's edit action | yes | +4 | existing |
| chat/actionSchema.ts, turnCall.ts, turnPrompt.ts (changed) | edit gains `drop` and `ops` minItems 0 with a pending plan; the pending block in the prompt; the check context carries it | yes | +8 / +8 / +4 | existing tests + cases |
| chat/replyCheck.ts (changed, 105) | an edit with a pending plan: `readRevise` → markFit on the returned ops → apply the merged ops → `withLimits` | yes | +15 | Vitest: additive, drop, replace, over 6, nothing revised, under a mark |
| chat/turnJob.ts (changed, 165) | resolves `pendingFor` at the start; passes it to `decideReply` and the merge result to dispatch | no | +8 | existing + a revise case with fakeOllama |
| **chat/lyricsSplit.ts** | stored lyrics text → tagged blocks with each line's index in the text; `checkBlocks(blocks, facts.lyric_blocks)` (tag, line count, first line, as D-072) | yes | 60 | Vitest: the contract song, a mismatch, an untagged lead-in |
| **chat/lyricsPanel.ts** | shown reading + lyrics text → `LyricsPanel` (source `blocks` / `heard` / `none` with the reason; per strip section its block, its lines with a text-line index or seconds; header bpm, key, meter, style) | yes | 120 | Vitest table: YuE2 blocks, transcribed heard lines, a third chorus with no block, mismatch, no words |
| chat/analysisView.ts, analysisTypes.ts, analysisStore.ts, routes/chatAnalysis.ts (changed) | `shown.lyrics` from `lyricsPanel`; `versionLyrics(versionId)` (`params_json.request.lyrics`, code); the route passes it | — | +4 / +2 / +10 / +3 | existing + cases |
| **chat/draftUndo.ts** | draft + recipe message → `{draft, restored, kept}` or a refusal reason | yes | 70 | Vitest: untouched, hand-edited, later turn overwrote, cleared field, already undone, song thread |
| routes/chat.ts (changed, 113), chat/messageView.ts (141) | the undo route (one transaction: draft write + body `undone` through `updateMessage`, code); the `undo` offer in the view | — | +20 / +6 | route tests |
| server/test-fakes/chatScripts.ts | revise replies (additive, drop, replace, over 6) | — | +15 | — |
| **server/scripts/chatCp2.ts** | CP-C2 driver over the HTTP API (reuses `chatCp1`'s helpers) | no | 150 | it is the check |

## Modules — client (`client/src/`, flat)

| Module | Its one job | Pure? | ~LOC | Tested by |
|---|---|---|---|---|
| **api/chatConverge.ts** | the undo call; wire types `LyricsPanel`, `PanelSection`, `PanelLine`, `BarMap`, `RecipeUndo` | no | 50 | — |
| api/chatEdit.ts, api/chatAnalysis.ts (changed) | `ChatEditBody.revision?`, `since?`, `map?`; `shown.lyrics?` | — | +4 / +2 | tsc |
| **chatLyricsPanel.ts** | panel view + mark + word timings (`alignLyrics`, reused) + live edit diffs → rows: section list, marked part, dashed breaks, "n more lines not marked", PROPOSED, struck old / new, dim / failed / none | yes | 140 | Vitest per LY-3/LY-4/LY-6 case |
| **chatLyricsMark.ts** | line click / shift-click / header click → a C1 `RangeMark` through `chatMark`'s snap and clamp | yes | 60 | Vitest |
| **chatBarMap.ts** | `BarMap` + width → bands, cells, labels thinned to fit, ruler ticks, an op's lit spans | yes | 90 | Vitest: 32, 120, 200 bars |
| **chatUndo.ts** | which recipe message offers UNDO TURN; the just-filled marks from its `undo` record (ASSISTANT, old value) | yes | 60 | Vitest |
| **chatConvergeCopy.ts** | C2's copy (`chatCopy.ts` is at 183) | yes | 70 | Vitest |
| **ChatSongPanel.tsx**, **ChatLyricsPanel.tsx**, chatLyrics.css | the song sidebar rows and the panel | no | 70 / 140 | browser pane at 1366×768 |
| **ChatBarMap.tsx**, ChatEditCard.tsx (changed, 112), ScorePlanList.tsx (changed, 61: `onHoverRow?`, additive for the dock) | the map in the card, the REVISED header, hover | no | 80 / +15 / +4 | browser pane |
| **ChatUndoLine.tsx**, ChatRecipeCard.tsx (136), ChatDraftFields.tsx (118), chatDraftStore.ts (128) | CHANGED · … UNDO TURN under the reply; marks hydrated from the record; the store's `undo` action | no | 40 / +4 / +6 / +12 | browser pane; store tests |
| ChatView.tsx (changed, 127) | the song panel replaces the locked draft fields on a song thread | — | +6 | browser pane |

`ChatThread.tsx` (197) and `api/chat.ts` (197) are at the cap: C2 changes neither.

### Feature → modules

| Feature | Modules |
|---|---|
| F-056 lyrics panel | lyricPairing, lyricsSplit, lyricsPanel, analysisView / analysisStore / routes/chatAnalysis; chatLyricsPanel, chatLyricsMark, ChatSongPanel, ChatLyricsPanel, ChatView |
| F-057 OLD / NEW twice | ScorePlanList + ScoreLyricDiff (exist); chatLyricsPanel (struck / new, PROPOSED), ChatLyricsPanel |
| F-058 REVISE | turnRevise, reviseReply (`drop`), actionSchema, turnCall, turnPrompt, replyCheck, turnJob, turnDispatch, editTypes; planRevise / mergeRevise / planBuild (reused); ChatEditCard (`since`, REVISED), chatScripts |
| F-059 UNDO TURN, just filled | draftModel (`before`), turnDispatch (`undo`), draftUndo, routes/chat (undo), messageView; chatUndo, ChatUndoLine, ChatRecipeCard, ChatDraftFields, chatDraftStore |
| F-060 bar map | barMap, lyricPairing, turnDispatch; chatBarMap, ChatBarMap, ChatEditCard, ScorePlanList (`onHoverRow`) |

## Data (C2)

- **No new column, no migration.** Every addition is additive JSON under the existing version keys (versions-data.md):
  - edit message body (`chat_v: 1`): `revision?: number`, `since?: {planId, marks: [{mark, was}], removed: Op[]}`
    (the score agent's `Since`, code), `map?: {bars, sections: [{label, occurrence, from, to}], ops: [{spans:
    [[from, to]], whole}]}`. A card without `map` draws C0b's strip.
  - recipe message body: `undo?: {rev, before: Partial<DraftFields>, fields: DraftField[]}`, `undone?: {at,
    restored: DraftField[], kept: Array<{field, reason}>}`. Messages from before C2 have no record: no UNDO TURN,
    and their marks stay session-only as today.
  - `versions.analysis_json` unchanged: `shown.lyrics` is computed at read time from the stored analysis and the
    version's `params_json.request.lyrics`, never stored, so nothing needs re-reading.
- **Plans stay in memory** (`planStore`, decisions/0004): a revised plan replaces the song's plan; a restart expires
  the card as today (EXPIRED, ASK AGAIN).
- Lifecycle: all with the message and the thread (D-102). Nothing leaves the machine.

## Wire contract (client ↔ server)

- `GET /api/chat/songs/:songId/analysis` → `AnalysisView` (C1) with `shown.lyrics: LyricsPanel | null`:
  `{source: 'blocks' | 'heard' | 'none', note: string | null, text: string | null, facts: {bpm, key, meter, style}
  | null, sections: [{strip: number, label, occurrence, bars: [a, b], seconds: [a, b] | null, block: number | null,
  lines: [{n, text, at: {textLine: number} | {seconds: [a, b]} | null}]}]}`. `text` is the stored lyrics the
  `textLine` indexes point into (null for `heard`); `note` says why words are missing or unmatched.
- `GET /api/chat/threads/:id` (unchanged route): edit bodies carry `revision`, `since`, `map`; recipe bodies `undo`,
  `undone`; each recipe message view gains `undo: 'offer' | 'done' | null`.
- `POST /api/chat/threads/:id/messages/:messageId/undo` → 200 `{draft, blockers, restored: DraftField[], kept:
  [{field, reason}]}` or 409 `{error: 'UNDO_REFUSED' | 'TURN_OPEN', reason}`; 404 for an unknown thread or message.
- `POST …/turns` unchanged: the revise is decided on the server; the client sends no flag.

## Seams and fakes (C2)

| Seam | Real | Fake |
|---|---|---|
| chat model, revise replies | Ollama strict schema with `drop` | `fakeOllama` + `chatScripts` (server); `e2e/fake-score/ollama.ts` scripted per test (`scriptChat`) |
| yue apply of a merged plan | `/v1/scores/apply` | recorded contract fixtures: plan 1 `apply-set-tempo` (SET_TEMPO 88); a revise adding REHARMONIZE 47-50 merges to exactly `apply-compound`'s ops in order (kept first, added after); `apply-rewrite-lyrics` (block 5, chorus 2) for the panel's diff. A new merge needs a fixture recorded by `yue-server/tests/test_score_edit_routes.py` (score code, not transcription) |
| word timings | lyrics-server via C1's WORDS | unset in e2e: YuE2 lines have no time (a line click marks its section, D-218); `alignLyrics` has its own tests |
| plan / proposal stores | `planStore`, `proposalStore` | the real modules, reset between tests |
| client ↔ server | `api/chatConverge.ts`, `api/chatAnalysis.ts` | `vi.mock` in store tests; pure modules need none |
| CI | — | three specs named `*.chat.spec.ts`, so the `score` project's pattern `(score|chat)\.spec\.ts$` picks them up with no config change (D-224) |

Risk seams: R-040 (revise prompt size, Q-050's losses in the chat's prompt) → CP-C2 on the real machine; R-041 (YuE2
line times from Whisper alignment) → CV-9 live on real songs; UNDO losing a hand edit → `draftUndo` tables.

## Test strategy (C2, by risk)

1. **A revise never loses an op silently** (the named risk, Q-050): `replyCheck` + `mergeRevise` tables through the
   chat path: additive (`drop: []`, one NEW), changed target (CHANGED), drop (REMOVED), drop all + new
   (replacement), an echo (all SAME, not refused, D-076 e), empty (NOTHING_REVISED retry), 7 merged (named refusal),
   a bad drop number; every case asserts card ops = merged ops applied, and pending ops = kept ∪ REMOVED; a failed,
   offline and cancelled revise leave the card live and `getPlan(songId)` unchanged; a song changed since the card →
   a fresh plan; a dock PLAN that replaced the chat plan → no revise.
2. **UNDO never touches a hand edit** (data the person typed): `draftUndo` table (untouched → restored; touched after
   `rev` → kept and named; overwritten by a later turn → kept; was empty → cleared; a song thread, an open turn, no
   record, already undone → refused); the route writes draft and body in one transaction (a failed draft write
   leaves the body without `undone`).
3. **Outside input**: stored lyrics that do not match the score's blocks → `note`, no lines (never mispaired); a
   revise reply's shape (`drop` duplicates, out of range, missing ops); old bodies without `map` / `undo` / `since`.
4. **One pairing**: `lyricPairing` cross-tested against yue-server's `read-sections.json`; the four switched users'
   existing tests pass unchanged; the bar map of a REWRITE LYRICS and the panel's block agree on one fixture.
5. **Client reducers**: one test per panel state (LY-3, LY-4, LY-6), each line-mark gesture, the bar map at 32 /
   120 / 200 bars (no label overlap, every edited bar at least 2 px), the undo offer rules. Each pure module broken
   once on purpose.
6. **E2E** (one spec per user-visible package, each green in CI on its PR): `lyricsPanel.chat.spec.ts` (section
   list → click marks → only that part; a pending REWRITE LYRICS struck / new, and PROPOSED outside the mark);
   `revise.chat.spec.ts` (plan SET_TEMPO → "and jazz chords in bars 47-50" → plan 2 SAME + NEW, the old card
   superseded, the bar map lights 47-50 on hover, APPLY saves v2); `undoTurn.chat.spec.ts` (recipe fills fields →
   ASSISTANT marks → a hand edit of one → UNDO TURN restores the others and keeps the hand edit → reload keeps it).
7. **On the real machine, headless (CP-C2, after CV-1, before CV-7)**: `chatCp2.ts --server http://127.0.0.1:3201`
   on a `DATA_DIR` copy with the real Ollama (16k) and yue-server; 3 YuE2 songs; per song a first plan and at least
   4 revisions: additive ("and also slow it down to 80 BPM"), subtractive ("fewer chords"), replacing ("forget that,
   transpose it down a tone"), under a mark ("do the same here" on chorus 2), plus one lyric rewrite revised; 12+
   revise turns in all. Logged per turn: the merged ops vs the card, REMOVED, attempts, prompt tokens, context
   length, wall time. **Stop lines:** any context refusal or prompt p95 over 8,000 tokens; any pending op missing
   from both the merged plan and REMOVED (0 tolerance); an additive revision dropping a pending op in more than 3 of
   10; more than 2 of 12 revise turns failing → stop and raise before CV-7.
8. Regression net: every suite green on every PR; the golden path, the score spec and C1's `chat.spec.ts` unchanged.
