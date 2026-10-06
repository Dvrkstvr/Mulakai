# M1 verify — F-026, F-027, F-028

Verifier, 2026-10-05. Code under test: `1d73654` (branch `feat/score-w8-phrase` = origin/main `0c04ee1` + W8 / PR #134), worktree
`E:\repos\Mulakai\.claude\worktrees\agent-afa6c9ddb6db21a0a` (tracked files untouched; `git status` clean after the run).
Labels: *ran* = I ran it, *read* = seen in code, *reused* = earlier evidence spot-checked.

## Check commands (all ran by me at 1d73654, all exit 0)

| command | result |
|---|---|
| `client: npm run build` | exit 0 (chunk-size warning only) |
| `client: npm run lint` | exit 0 (1 existing warning, `AudioPreview.tsx` only-export-components) |
| `client: npm test` | 93 files / 740 tests passed |
| `server: npx tsc --noEmit` | exit 0 |
| `server: npm test` | 86 files / 734 tests passed |
| `yue-server: python -m pytest -q` | 220 passed, 1 Starlette deprecation warning |
| `e2e: npx playwright test` (TEMP on E:) | 9 passed in 55 s (golden path, 4 queue, 4 score); ports 8101/3101/5183/8102/8103/3102/5184 free before and after; log `verify-shots/e2e-1d73654.log` |

CI: PR #133 checks all pass; main push at 0c04ee1 `E2E` run 37338388328 success (log shows the 4 `[score]` tests and "9 passed"), `Checks` run 37338388437 success; PR #134 (1d73654) client, server, yue-server, golden-path all pass.

## F-026 WRITE PHRASE

1. **Schema (notes only, N per request, ABC refused): PASS** (read + ran).
   `server/src/services/score/phraseSchema.ts`: `bars` is `minItems = maxItems = N` arrays of 1-16 `{pitch, beats}` with `beats` enum 0.5/1/1.5/2/3/4 and a pitch pattern, `additionalProperties: false`; `phraseProblems` refuses any string bar with "ABC strings are not accepted". N from `phraseRequest.ts` (4 default, cap 8). Code owns the ABC: `yue-server/score_phrase.py` (`note_events` decompose to the score's L: units and ties, `_problems` bar sums against the meter, untie at the seam). yue-server's route also answers 422 for an ABC string (`raw/edges_apply.json`, reused). Tests: `phraseSchema.test.ts`, `phraseRequest.test.ts`, `test_score_phrase.py`, `test_score_phrase_routes.py` (all inside the green suites above).
2. **Ins only where the Vocal rests, style appended, consequence says request not guarantee: PASS.**
   read: `_problems` refuses any phrase bar where the Vocal has notes; `add_instrument` appends the instrument (once). Seen running (fake stack, real client+server): review row "WRITE PHRASE · tenor saxophone · bars 57–60 · 4 bars · style + tenor saxophone · a request"; consequence "Saves base v2 · re-renders the whole song on YuE2, about 3 min · every bar will sound different · the tenor saxophone phrase replaces the instrument part in bars 57–60 and is a request to YuE2, not a guarantee · v1 stays in VERSIONS" (D-060 wording; screenshot `verify-shots/f026-review-refused-line.jpg`).
3. **Live on 3 library songs, compound request valid within 3 attempts, attempts logged: PASS** (reused, spot-checked; I did not re-run Ollama/YuE2).
   `m1-summary.json` + `raw/report.txt`: s1_purple valid on attempt 2, s2_gertar attempt 1, s3_carinito attempt 3; every verdict list (SET_TEMPO, REHARMONIZE x n, WRITE_PHRASE) ok; retries were D-055 root-rule feedback, none about the phrase; each render succeeded with a v2. Spot-check: `raw/run-*.json` plan verdicts all ok; `raw/proxy-trace.jsonl` has 10 `/v1/chat/completions` = 2+1+3 (the three songs) + 2+2 (the two edge runs), consistent with the logged attempts; GPU hand-off 30-45 ms after unload ack. Caveat: this run was at W8 `27e0546` before the D-060 follow-up; that follow-up changed review copy and refusal reporting, not the plan/apply path, and the e2e/unit suites at 1d73654 cover it. s3 needed all 3 attempts (SP-2's 86% figure: the third attempt is the limit, not a margin).
4. **Sanity gates; beat-sum feedback: PASS** (read + ran tests).
   `score_phrase_gates.py` (MIN_NOTES 4, MIN_PITCHES 3, 70% in key, same bar > 3 times) with parametrised `test_each_sanity_gate_refuses_with_its_reason` (3 notes / 2 pitches / 38% in key / four identical bars, each with its reason), `test_a_bar_whose_beats_do_not_fill_the_meter_is_refused_with_the_numbers` ("sums to 3.5 beats, the meter needs 4 (too short by 0.5)"; contract `apply-write-phrase-beat-sum`). Retry: `planAttempts.ts` `applyReasons` feeds verdict reasons and check problems back; `planJob.phrase.test.ts` "feeds yue-server refusals back word for word, with the free bars and the beat sums" and "rejects a phrase the sanity gates refuse ... ends in 'check failed' after 3". D-057's reading ("four identical bars" = one bar written 4 or more times) is a recorded decision, accepted.
5. **Vocal-bars refusal names the free bars; refused attempt shown in the review (D-060): PASS** (seen running).
   Drove the real client + server on the e2e fakes (fake Ollama scripted: reply 1 = recorded `apply-write-phrase-vocal-sings` ops, reply 2 = `apply-write-phrase`), request "add a 4-bar sax phrase in bars 9-12". Review showed, in the rust checks area: `attempt 1 refused: the Vocal sings in bars 11-12; free: 1-10, 47-65` under "…chords valid · attempt 2 of 3", then the passing plan. Scripting all attempts to the same refusal ended in `CHECK FAILED · op 1 (WRITE_PHRASE): the Vocal sings in bars 11-12; free: 1-10, 47-65 · Change the request, then PLAN again. · Nothing was saved · APPLY & RENDER stays off`. Also unit: `scoreAttemptCopy.test.ts`, `planJob.phrase.test.ts` "refuses a phrase where the Vocal sings, naming the bars that are free (F-026 #5)", CP2 live e1/e2 (`m1-summary.json` "edges").
6. **OWED: SP-2 phrase listen** — left owed. `pipeline/verify/M1/listen/index.html` (3 A/B pairs). Facts for the listener: transcribed phrase notes match intended pitch classes (F1 0.83 / 0.97 / 0.68 vs 0.15 / 0.00 / 0.06 on the old render) but exact-octave F1 is 0.62 / 0.06 / 0.21, i.e. YuE2 played s2's phrase about an octave high. If "not musical", ship the op labelled EXPERIMENTAL (scope.md) and raise a Q.

Verdict F-026: criteria 1-5 pass; 6 is owed and does not block per scope.md. Recommend `passes: true` with the owed listen noted.

Extra (not in the criteria): the same refusal in the app with 3 identical refused attempts ends in CHECK FAILED with the free bars (above); an ACE-Step song in the same stack shows no SCORE tab (see F-027).

## F-027 first-edit warning

1. **Clause on REPAINT, ADD LAYER, extract-to-layer while SCORE is open: PASS** (seen running on the e2e fake stack, throwaway data on E:).
   YuE2 song, SCORE open: REPAINT line "Saves base v2 over the whole layer · v1 stays in VERSIONS · other layers untouched · score editing ends after this edit, SCORE will be off for this song" (`verify-shots/f027-repaint-clause.jpg`); ADD LAYER line "Adds a lane named from its description, conditioned on the current mix · nothing else changes · score editing ends after this edit, SCORE will be off for this song"; after SPLIT BASE (fake ACE-Step produced 4 stems) each stem row "replace will save as v2 · add will create a new layer · score editing ends after this edit, SCORE will be off for this song". SPLIT's own commit line has none (D-058: it saves nothing). REMASTERED MIX line "runs one ACE-Step pass over the mix first, about 90 s, and isn't kept" has no clause, as D-058/Q-039 decided (the Q-039 premise holds: the line says nothing is kept). Not driven: Demucs as the split model (the clause lives in the same `SplitStemRow`, covered by `splitStemCopy.test.ts`/`ScoreEndsClause.test.tsx`).
2. **Absent where SCORE is hidden or ineligible; absent on the next edit after the first repaint lands: PASS** (seen running).
   An ACE-Step song in the same stack: no SCORE tab, REPAINT and ADD LAYER lines have no clause. On the YuE2 song I ran REPAINT "brighter vocal" to completion: version v2 "repaint 0:00–end" landed, then REPAINT line read "Saves base v3 over the whole layer · v2 stays in VERSIONS · other layers untouched" with no clause (`verify-shots/f027-after-repaint-no-clause.jpg`), ADD LAYER line no clause, and the SCORE tab said "This song has a repaint version, so score editing ended when it was made."
3. **Vitest per verb, present and absent: PASS** (read; ran in the 740): `scoreEnds.test.ts` (scoreOpen per phase, editConsequence true/false), `dockTarget.test.ts` (repaintLine true/false and warn state no clause), `addLayerCopy.test.ts`, `splitStemCopy.test.ts`, `ScoreEndsClause.test.tsx` (DockCommit and SplitStemRow with and without).
Note (minor, not failing): `scoreOpen` is false until the SCORE state loads, so a REPAINT committed in that first moment would not show the clause; I saw the clause already present before I opened the SCORE tab, so the state loads on song open.

Verdict F-027: PASS.

## F-028 SCORE golden path in CI

1. **e2e spec: open fake-YuE2 song, SCORE, plan, review, APPLY & RENDER, new version appears; fakes beside fake-acestep: PASS** (ran). `e2e/tests/score.spec.ts` test 4 passed in my run (and 6.6 s in CI); fakes in `e2e/fake-score/` (ollama.ts, yue.ts replaying `yue-server/tests/data/contract`), next to `e2e/fake-acestep/`.
2. **Edge steps (planner offline, plan refused over 360 s, cancel while planning): PASS** (ran). Tests 1-3 of the score project passed locally and in the CI log of main's push run.
3. **CI runs it green on a PR; existing golden path unchanged and does not set LLM_API_URL: PASS** (CI + read). `e2e.yml` runs `npm run test:e2e` (both projects); PR #133 golden-path job pass, main push run 37338388328 success with the 4 score tests, PR #134 golden-path pass. `playwright.config.ts`: the `chromium` project's server (3101) env sets `YUE_API_URL: ''`, `HEARTMULA_API_URL`, `DEMUCS_API_URL`, `LYRICS_API_URL` blank and no `LLM_API_URL`; only the score project's server (3102) sets it. `golden-path.spec.ts` untouched by W9 in this range.
Nit (not failing): because the golden-path server env does not blank `LLM_API_URL` (it blanks the others), a developer shell that has `LLM_API_URL` set would leak it into the golden path's server; the comment on that block says the blanking is meant to keep shell env out. Cheap hardening: add `LLM_API_URL: ''`.

Verdict F-028: PASS.

## Failures

None. Owed: F-026 #6 listen (`pipeline/verify/M1/listen/index.html`).

## Cleanup

Started and stopped by me: fake ACE-Step (PID 38828), fake-score (47004), server 3102 (42340), Vite 5184 (41972); ports 8101/8102/8103/3102/5184/3101/5183 verified free afterwards. Throwaway data `E:\ai\tmp\m1v\` (data, logs). The Playwright run's own processes exited by themselves. Browser viewport reset to desktop.
