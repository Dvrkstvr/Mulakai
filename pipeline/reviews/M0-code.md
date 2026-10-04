# M0 review, lens: code

Range: `git diff 6426d5c...HEAD` (HEAD 3f1541a, branch feat/score-w4-render = W3 #127 + W4 #128 on top of merged W0-W2).
Read: scope M0, F-016..F-025 acceptance, D-046..D-053, `.claude/rules/{score-server,versions-data,job-queue}.md`, all of
`server/src/services/score/*`, `routes/score*.ts`, `enginePoll.ts`, `jobRunner.ts`/`genQueue.ts` diffs, `routes/versions.ts`,
yue-server `score_*.py`, and the client SCORE store/reducer/copy/dock. Evidence label: *seen in code* unless stated; the suites were not re-run.

No blocking finding. The GPU hand-off invariant holds in code: `planJob.ts` unloads and confirms in `finally` on success, failure
and cancel; `abortRunning` holds the slot (10 min drain bound) and a second ABORT cannot reach it because the cancel routes 404 once
the job is `failed`. The ABC invariant holds (TypeScript only parses the pre-existing Q/K/M header via `readAbcMeta`).

## Findings

### 1. should · W4 (#128) · `server/src/routes/versions.ts:60` · deleting the active score version leaves the song's bpm/key/meter/length on the deleted render
`DELETE /versions/:id` on the active version re-activates the newest remaining version (`ORDER BY created_at DESC`) but never calls
`restoreScoreMeta`. Input/state: layer has v1 (first take, 120 BPM) and v2 (score render, 88 BPM, 3:04); user deletes v2 in VERSIONS. v1
is active, plays 120 BPM audio, but `songs.bpm` stays 88 and `songs.duration` stays v2's length (Editor/Library/Create show the wrong
tempo and length; the next export tags it wrong). `versions-data.md` ("Activating a score version restores the song's bpm, key and
meter") and F-023 #2 ("reverting ... restores") describe activation; auto-revert on delete is the same event by another route.
Fix: after the auto-activate, call `restoreScoreMeta` for `next` (needs `audio_file`, `params_json`, `layer_id`, `song_id` in that SELECT);
add a test named for the trap.

### 2. should · W4 (#128) · `server/src/services/score/scoreRenderCheck.ts:33` + `client/src/scoreVerb.ts` (`renderRefused` -> `stale`) · a planner that is simply stopped makes APPLY & RENDER refuse as "PLAN OUT OF DATE", and PLAN AGAIN cannot fix it
Any `/api/ps` error refuses (`plannerUnconfirmed`, D-053 b) and the route answers it as `stale: true`. Scenario: user plans, then quits
Ollama (a normal way to free the GPU). Nothing is on the GPU, yet APPLY & RENDER answers "PLAN OUT OF DATE · can't confirm the planner let
go of the GPU. Nothing was started." with the plan dimmed and a PLAN AGAIN button; PLAN AGAIN then ends in PLANNER OFFLINE. Result: a valid
plan cannot be rendered until Ollama is restarted, and the screen blames the plan. The refusal is a recorded decision (D-053), so this is
about the label and the dead end, not the safety rule. Fix (pick one, conductor's call): answer this refusal without `stale: true` so the
dock keeps the plan and shows a rust line + RETRY (a down server is not a stale plan), or treat connection refused (not HTTP error/timeout) as
"nothing loaded". F-024 #3 ("the next song action is not blocked") is only met for non-SCORE actions today.

### 3. should · W3 (#127) · `client/src/api/types.ts:174`, `client/src/activityRunning.ts:46` · queue kind `plan` is not in the client kind union or `RUNNING_LABEL`
`job-queue.md`: "A new kind extends the kind unions on both sides, so the client's `RUNNING_LABEL` must name it." W2 added `plan` on the
server, W3 added only `scoreRender` on the client (the test `activityPlanKind.test.ts` even casts `as unknown as ActiveGeneration`). Result:
a running plan shows in Activity with an empty stage label (`row.label` is `undefined`; only the title and ABORT render), and `KIND_NAME`/
`DONE_LABEL` have no entry for it. Fix: add `'plan'` to `ActiveGeneration.kind` and to `RUNNING_LABEL` (e.g. `PLANNING SCORE`), `VERB`,
`KIND_NAME`, `DONE_LABEL`; drop the cast in the test.

### 4. nit · W4 (#128) · `server/src/services/score/scoreRenderJob.ts:45` · a queued word-timings job on the song blocks the render and stales the plan
`pendingEdit` refuses on any queued/running job with the song's id except `plan`/`scoreRender`. `timings` (auto-read per version in the
Editor, `songId` set, label "word timings") is not an edit. Scenario: Editor auto-queues timings for the freshly opened version; user
presses APPLY & RENDER on a restored plan before it finishes: "a word timings was queued after this plan" and a stale plan (re-plan costs
GPU time). Fix: also exclude `timings` (and any non-audio kind) from `pendingEdit`.

### 5. nit · W2 (merged #126) · `server/src/services/score/ollamaControl.ts:37` and `planJob.ts:72` · an untagged `LLM_MODEL` never matches Ollama's names
`names.includes(t.model)` and `m.name === deps.planner.model` compare literally. `LLM_MODEL=qwen3` (Ollama resolves it to `qwen3:latest`)
gives "model qwen3 is not on the planner: run 'ollama pull qwen3'" forever (SCORE = PLANNER OFFLINE), and a loaded model's context is
never found, so the preflight and the `tight` postflight are silently skipped. Fix: normalise a tagless name to `:latest` on both sides.

### 6. nit · W2/W4 · `server/src/routes/scorePlan.ts:33`, `scoreRenderRouter` (`routes/scoreRender.ts:28`) · two concurrent POSTs both pass the "already queued" guard
The in-flight check runs before `await d.status()` / `await checkRender()`; the run is only noted inside `startPlan`/`startScoreRender`.
Double submit (Enter then click before the 202 lands; the client only changes phase after the response) queues two plans for one song:
two planner runs, the second replaces the first's run record and plan. Renders are protected at their turn (plan dropped after save /
fingerprint changed) but a failed first render lets the second run. Fix: set a per-song "starting" flag synchronously before the first
await, or re-check `lastRun`/`lastRender` after the awaits.

### 7. nit · W4 · `server/src/services/score/scoreVersion.ts:113` · a second reader of the sidecar
`.claude/rules/score-server.md`: "`scoreSource` is the one reader of a song's score". `restoreScoreMeta` re-implements the sidecar path +
`readFile` (`scoreSource.readSidecar` is private). Behaviour is correct today; export `readSidecar` from `scoreSource` and use it.

## Checked, no finding
- F-020 unload/ps poll, 10 s bound, "still loaded" text, non-Ollama probe, context guard (SP-2 cut case), plan cancel while planning:
  all present and consistent with D-050/D-052 (*seen in code*; live numbers are the CP1 log's).
- F-022 limits: `minBpmThatFits(458 s, 88) = 112` matches the criterion; `NO_CHANGE` ends in `check failed`, never an empty render.
- F-023 request builder (`abc` + `cot: 'full'` + stored style/lyrics/seed, no `cfg_scale`, D-053 c); the cover builder is untouched;
  sidecar-first write and cleanup on a failed transcode; abort after save keeps the version and says so; failed render keeps the plan.
- `enginePoll.ts` extraction is behaviour-preserving for first takes (same 3-strike and drain logic, imports from `jobRunner`).
- Module sizes: every new code file is under 200 lines (largest `scoreStore.ts` 157).
