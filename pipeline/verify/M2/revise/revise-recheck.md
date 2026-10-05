# M2 F-033 REVISE live re-check after D-073 / D-076 (autopilot)

Verifier, 2026-10-05. Code under test: `0629e20` (`feat/score-w15-referent-revise`), worktree `E:\repos\Mulakai\.claude\worktrees\agent-a15895f05108fb2b4`
(`git status` clean before and after; no product code changed, nothing committed or pushed).
Labels: *ran* = I ran it, *seen* = seen in the real dock, *read* = read in the proxy trace / logs.

Setup (own ports, all stopped afterwards, verified by command line before each kill): Ollama 0.32.15 :11435 (`OLLAMA_CONTEXT_LENGTH=16384`, qwen3:14b) behind a recording proxy
:11436; yue-server (WSL) :8024 behind a proxy :8034; Mulakai server :3402 (`DATA_DIR=E:\ai\tmp\m2v\data`, the CP3 library copy, same songs); Vite :5190. The user's stack
(:3001, :11434) was not running. No render was started (plan/REVISE only; the card sat at 0.9 GB, `nvidia-smi` gated every press). Scripts here: `trials.mjs` (plan + REVISE through the
real routes), `services.mjs` (proxies + /api/ps poller, as CP3), `analyze.mjs` (joins each press with its Ollama calls), `pw/ui.mjs`, `pw/ui1op.mjs`. Raw: `raw/rr-t*.json`,
`raw/proxy-trace.jsonl`, `raw/analysis.json`, `raw/analysis.txt`, `raw/ui*.log`; shots in `shots/`.

## Check commands (ran on 0629e20, all exit 0)

| command | result |
|---|---|
| `server: npx tsc --noEmit` | exit 0 |
| `server: npm test` | 93 files / 812 tests passed |
| `client: npm run build` | exit 0 |
| `client: npm run lint` | exit 0 (the 1 existing `AudioPreview.tsx` warning) |
| `client: npm test` | 104 files / 839 tests passed |
| `e2e: npx playwright test score` | 6 passed (33.6 s), incl. "REVISE sees plan 1, merges what changes into it and marks what changed since (F-033, D-073)" |

Logs: `raw/check-*.log`, `raw/checks.summary`.

## Results (27 REVISE presses, 6 songs/plan families, qwen3:14b)

Every press: at most 3 attempts (max 3 calls), exactly one `keep_alive: 0` unload per press (27 of 27), `/api/ps` empty 0-3 ms after the job went done (poll),
plan time 3.7-4.5 s for a one-attempt REVISE, 7.9-16.9 s with retries (median 4.2 s), completions 9-21 tokens for additive/drop replies, 217-397 for a REHARMONIZE reply. All 3 failed
presses (7-op cap) kept the pending plan (`GET /score/plan` still returned it): PASS. 0 invalid JSON replies.

| # | case | expected | got | result |
|---|---|---|---|---|
| 1a | pending plan of 2-4 ops (4-op: TRANSPOSE + REPEAT + REHARMONIZE + REWRITE LYRICS on 5c8e6586; 2-op TRANSPOSE + REPEAT on Rastafari; 3-op on Gertar), "also slow it down to 80/60 BPM" or "keep the jazz chords / the transpose and the repeat and also slow it down ..." | all pending SAME + SET_TEMPO NEW | 7 of 7 exactly that: 4 SAME + NEW (x3), 2 SAME + NEW (x2), 3 SAME + NEW (x2), 0 REMOVED, reply `{"drop":[],"ops":[SET_TEMPO]}` (20 tokens, 1 attempt) | **PASS** |
| 1b | pending plan of exactly 1 op (REHARMONIZE 16/8 chords "jazz chords in the chorus" on Purple Shinings and Cariñito; SET_TEMPO 100 on Cariñito), the same additive requests (also "slow it down to 80 BPM too", "also move it down a tone") | pending SAME + new op NEW | **0 of 8**: the planner replied `drop:[1]` + the new op every time; plan = the new op only, NEW, the pending op under "REMOVED SINCE PLAN 1" (seen in the dock, `shots/ui-revise-1op-drops.png`, `raw/ui1op.log`). These are CP3's own failing cases (Purple Shinings "also slow it down to 80 BPM", "keep the jazz chords and also ..."): the D-073 fix did not fix them | **FAIL** |
| 1c | Purple Shinings, 3 presses on a 6-op pending plan (the planner had split "down a tone, repeat the chorus, ..." / "jazz chords in the chorus and down a tone" into 4-6 two-chord REHARMONIZEs), then "also slow it down to 80 BPM" | 6 SAME + NEW would be 7 ops | named refusal x3 on the 3 attempts ("the revised plan has 7 ops; at most 6: drop pending ops or return fewer"), plan kept, APPLY still on; the planner never dropped one to fit (3 of 3 presses) | refusal as designed; additive impossible here |
| 2 | "not so many chords" / "one chord every two bars" after a jazz-chords plan (4 trials: 9-chord REHARMONIZE in a 4-op plan, 16-chord and 8-chord 1-op plans) | REHARMONIZE CHANGED, or a named refusal | 0 of 4 CHANGED, 0 of 4 reduced the chord count. Each reply was `drop:[n]` + a REHARMONIZE on the same bars with the **same number of chords**: 2 echoed the pending op byte for byte, 1 changed the chord set (still 9 chords), 1 changed it on the 3rd attempt after a root-rule refusal. The merge marks the result NEW with the same range REMOVED (D-076 c), not CHANGED. In the 1-op plans attempt 1 was `drop:[1], ops:[]`, refused by the code ("the revision drops every op: keep a pending op or return one") and the retry re-returned the op. D-055's root rule still fires as retry feedback (5c8e6586: "keeps the old root in 7 of 9 bars", then "2 of 9" before a 9-chord set passed; Cariñito: "8 of 8 bars" on a rewrite that kept the roots) and the planner never tried a shorter chord list | **FAIL against the expectation** (no CHANGED, no reduction); no loss of the other ops (3 SAME kept in the 4-op plan) |
| 3 | "forget the transpose" / "forget the repeat" | TRANSPOSE (REPEAT) REMOVED, rest SAME | 4 of 4: reply `drop:[1]`, `ops:[]` (9 tokens), merged = rest SAME (3, 5, 2, 1 SAME), the dropped op under REMOVED (5c8e6586, Purple Shinings 6-op, Gertar, Rastafari) | **PASS** |
| 4 | echo (D-076 e): qwen returns the pending ops unchanged in `ops` | count | 4 of 38 attempts returned only pending ops unchanged: all 4 on the "fewer chords" requests, all 4 with that op also in `drop` (net: identical op marked NEW + the same op REMOVED); 0 echoes with an empty `drop`, so the all-SAME echo path of D-076 e never triggered; 0 of the 27 final plans were all-SAME | observed |
| 5 | press hygiene | <=3 attempts, planner unloaded, failed REVISE keeps plan | see above: 27 of 27 | **PASS** |
| 6 | UI pass (`pw/ui.mjs`, Playwright on :5190, 4-op plan on 5c8e6586) | marks NEW/CHANGED/SAME/REMOVED shown, APPLY on | after "also slow it down to 80 BPM": "PLAN 2 · REVISED FROM PLAN 1 · 5 CHANGES", "SINCE PLAN 1 · 1 NEW · 4 SAME", rows TRANSPOSE/REPEAT/REHARMONIZE/REWRITE LYRICS each SAME, SET TEMPO NEW, APPLY & RENDER enabled; then "forget the transpose": "PLAN 3 · REVISED FROM PLAN 2 · 4 CHANGES", "SINCE PLAN 2 · 4 SAME · 1 REMOVED", "REMOVED SINCE PLAN 2 · TRANSPOSE down 2 semitones · Em → Dm", APPLY enabled; "REVISING… attempt 1 of 3 · plan 1 is kept if it fails" while waiting; the check line reads "86 bars" under the REPEAT plan (D-075 fix) while the header keeps the base's 77. CHANGED was not produced by qwen in any press (the CHANGED mark is covered by `planRevise.test.ts` and was seen at CP3: "make it 100 BPM instead"). `shots/ui-plan1.png`, `shots/ui-revise-additive.png`, `shots/ui-revise-drop.png`, `raw/ui.log` | **PASS** |

## Verdict

* **F-033 #1 (second plan sees the first, replaces it, change list marks what changed): still PASS**, as at CP3, and the D-073 merge now delivers the intended additive result
  whenever the pending plan has 2 or more ops (7 of 7) and the drop case (4 of 4).
* **Edge, additive revision of a one-op plan: FAIL, 0 of 8.** This is CP3's Q-050 case verbatim and D-073 does not cover it: with one pending op qwen3:14b treats the request as a replacement and puts
  the only op in `drop`. The loss is visible (REMOVED line) and one click away from the user retyping the request, so it is not silent, but "jazz chords, then also slow it down" is the most natural REVISE
  there is. Read in the trace: the REVISE prompt says "the request changes this pending plan ... list a pending op's number in drop to remove it"; with one op the model drops it (`raw/analysis.txt`, rr-t4/t5/t6).
* **"Fewer chords": not solved, no loss.** The planner never reduces the count and under the root rule returns a same-size set or an echo; the result is a no-op plan labelled NEW + REMOVED of the
  same range (an identical op shows as both). D-073's "REHARMONIZE CHANGED or a named refusal" did not occur; the nearest outcome is the model's own drop+re-return plus a retry.
* Marks wrinkle (nit): a `drop:[n]` plus an identical or same-target op is shown as REMOVED + NEW, and the re-added op moves to the end of the list (4-op plan: REHARMONIZE moved after REWRITE LYRICS). Telling the user "REHARMONIZE 36-44 removed" and "REHARMONIZE 36-44 new" side by side is confusing; CHANGED (or SAME for the echo) would read right. D-076 (c) chose this on purpose.

## What blocks merging #141

Nothing in the code under test is broken: all checks pass, REVISE keeps its guarantees (3 attempts, unload, plan kept, named refusals), and the multi-op additive case now works. What I would not claim
is that Q-050 is closed: the one-op additive case and "fewer chords" still do not do what the user asks. Options for the conductor (each a conductor/builder call, not made here): merge #141 and keep Q-050 open
with the one-op case as the known remaining gap; or, before merging, a small prompt/code change so that a `drop` that empties the plan while the reply adds ops on other targets for an additive-sounding request
is retried with a "keep the pending op unless the request says to remove it" line (the same feedback path as the existing "drops every op" refusal, which already fires for `ops: []`). I did not try that.

## Not done / limits

* qwen3:14b only; no render, so no audio claim. The base plans for 4-op requests failed the D-055 root rule on their own about half the time (up to 3 retries each, as at CP3); that is planning, not REVISE.
* The 1-op/echo numbers rest on 8 and 4 presses; the pattern was identical in every one.
* "Keep the jazz chords" was also sent on Gertar, whose plan had no jazz chords (it kept all ops and added the tempo); it is counted in 1a as an additive request only.
