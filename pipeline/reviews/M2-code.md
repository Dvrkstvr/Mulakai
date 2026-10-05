# M2 review, lens: code

Range: `git diff 0616a60...27b457a` (branch feat/score-w15-referent-revise = #137 W12, #138 W11, #139 W13, #140 W14, #141 W15 stacked).
Read: scope M2, F-029..F-033 acceptance, D-062..D-074, `pipeline/verify/M2/m2-verify.md`, ADR 0002, M1-code.md (Q-038/Q-041 not repeated),
`.claude/rules/{score-server,dock,client,yue-server}.md`, all new/changed `yue-server/score_*.py`, `server/src/services/score/*`,
`server/src/routes/score*.ts`, the client dock/score files. Code read from `git archive 27b457a` in the scratchpad (main checkout untouched).
Per the conductor's note, REVISE's reply shape (planRevise.ts / planJob.ts, D-073) is skipped; the rest of planRevise is in scope.
Evidence labels: *seen in code* unless stated. I ran two probes (below), not the suites.

No blocking finding. The invariants hold: the planner/YuE2 hand-off in `planJob.ts` is unchanged in shape (probe, status, referent and revise
checks run before the planner loads; `release()` is still in `finally`, once per press, REVISE included); TypeScript still never reads or
writes ABC (new TS reads yue-server's `sections` / `lyric_blocks` / `sections[].seconds` and writes op JSON only).

## Findings

### 1. should · F-030 #4 / F-033 · `server/src/services/score/planJob.ts:114` · the review's checks line shows the BASE's bar count under a plan that repeats or cuts sections
`checks: { bars: facts.header.bars, seconds: applied.seconds, tokens: applied.tokens, ... }`: `seconds` and `tokens` are the edited score's, `bars` is the
read's. Input/state: Gertar (77 bars), "repeat the first chorus" (+8 bars): the dock's one checks line (`scoreAttemptCopy.ts:16`) reads
"77 bars · est 340 s of 360 s · 4,010 of 4,096 tokens", three figures for two different scores. The user approving a structure change has no correct
bar count anywhere in the review (the verifier saw it, m2-verify "Other things tried", and called it a nit; it is the only bar-count readout and
F-030 #4 is about bar counts). Fix: yue-server's apply reply already has the edited `sections` (last `to_bar`) and parses the score; send
`bars` (`after.voices["Vocal"].bars` length or `Doc.nbars()`) and use `applied.bars`, falling back to `facts.header.bars` only when the edited score
did not parse.

### 2. should · F-032 · `client/src/useScoreVerb.ts:237-253` (`useScorePick`) + `server/src/routes/score.ts:47-62` · under the SCORE tab with no pickable data, a strip or lyric-line click does nothing at all
`useScorePick` returns non-null whenever `verb === 'score'`, so Editor routes the strip (`onSelect={scorePick?.onStrip ?? selectRegion}`) and the lyrics
lane (`onLine`) to the pick handlers. `sections` / `blocks` exist only in an `eligible` (or planner-`offline`) status (`reading()`), so in `ineligible`
and checker-`offline` states they are `undefined`, `sectionPick` / `linePick` return null, nothing is dispatched, and `pickRange` is not called
either. Input/state: open SCORE on a song that is ineligible (e.g. it has layers, the SCORE tab is shown with its reason, F-027) and click a strip
segment or lyric line: no pick, no REPAINT range, no message; before this range the same click selected a range and opened REPAINT (the same dead-end
Q-051 names for "no timings", reached here by a different door). Fix: `useScorePick` returns null unless the SCORE state can take a pick
(`score.status?.sections` known and phase not `ineligible`/`offline`), so the click falls through to `selectRegion`; add a test for the ineligible case.

### 3. nit · F-032 edge · `server/src/services/score/planReferent.ts:159-163` (`resolveReferent`, line branch) · a line pick survives a REWRITE LYRICS render with its old words
A line is "not stale" when block index, kind, occurrence and the line number still fit; the pick's `text` (and the client's `first_line` check, done
only when the pick is made, `scoreLinePick.ts:334`) is never compared again. Input/state: pick line 3 of [Chorus] #2, REWRITE LYRICS of that block,
render (same tags, same line count; `pick` outlives renders, `scoreVerb.ts` `renderDone`); the chip still quotes the old words, the next PLAN is told
`THIS: line 3 of lyric block 5 ([Chorus] #2): "<old words>"` and the server pins it. The sky echo (`lineIndexOf` uses `samePick`, no text) also stays. The
section pick has no such hole (bars change). Fix: when `picked.line === 1` compare `text` with the block's `first_line` (the only line the read has) and
call it stale; or clear a line pick on `renderDone` of a plan that had a REWRITE_LYRICS.

### 4. nit · mirrored limit, unpinned · `server/src/services/score/opSchema.ts:12` (`MAX_OPS = 6`) vs `yue-server/score_edit_routes.py:104` (`max_length=6`)
`sectionSchema.test.ts` pins the M2 op bounds by reading the Python source; the ops-per-plan limit, which M1 added, is not pinned. It matters for
D-073: a REVISE that merges new ops into a 6-op pending plan can send 7 ops, yue-server answers 422 (a whole-request error, not a verdict), `failure()`
throws, and the dock says PLANNER OFFLINE instead of a retryable refusal. Fix: cap or refuse the merged list in code at `MAX_OPS` with a reason, and
pin the constant against the Python source like the others.

### 5. nit · second implementation, no drift test · `client/src/scoreReferent.ts:264` (`kindOf`), `server/src/services/score/planReferent.ts:103` (`kindOf`, `linePin`), `yue-server/score_lyrics.py:32,62` (`tag_word`, `pairs`)
The "k-th section of a kind sings the k-th block of that kind" rule and the tag-kind function exist in Python (the owner), in the server (`linePin` pairs a
block with its section) and in the client (`sectionPick` pairs a strip section with a score section). Equivalent today (the three kind functions agree on
trim, case, first word, `[]:` stripping; I also compared the client's `keyAfter` tables with `score_transpose.new_key` over all 30 keys x -11..11:
0 differences, so D-069's feared drift has not happened). Nothing pins them to each other, unlike the TRANSPOSE tables' selftest. Fix: a server
test feeding `read-sections.json` to `linePin` and comparing its `section` with `pairs()`'s answer, a client test over the same fixture.

## Checked, no finding
- **Section ops numbering** (D-066 b): `apply_plan` runs bar ops, REWRITE_LYRICS (as-read blocks), section ops last-to-first, TRANSPOSE last. I fuzzed 540 plans
  (9 library scores, 1-4 random REPEAT/CUT, optional TRANSPOSE and SET_TEMPO, shuffled order, with lyrics): 0 exceptions, 0 unparsable scores, 0 failed
  `check_plan` where every verdict was ok (scratchpad `fuzz.py`). `layout`, `check_sections` and TS `readNumbers` agree on the read-to-edited map; the cut hint
  maps back by the read's numbers and is silent when labels do not line up.
- **Seam / meter / key** (`score_sections.py`): REPEAT un-ties before the copy so original and twin end un-tied; the twin restates `start` against `end`, a cut
  restates `end` against `start`, both skipped when the group has its own `M:`/`K:`; a CUT of S1 restates against the header; ops processed last-to-first do
  not disturb each other's `_state`. Stale `group["meter"]` after a restate is never read (the doc is re-parsed from text for the checks and `sections`).
- **TRANSPOSE** (`score_transpose.py`): accidental replay by letter across octaves, reset at the barline and at an inline `[K:]`, tied note keeps pitch and
  spelling, header / pre-line / inline keys all moved, `FULL_REST` bars skipped (their `pre` is still written, `text()` emits `pre` whatever `dirty`), range
  check raises `OpError` on the trial copy. The check compares against `shifted()` after the section stage, chords by pitch class, keys by name. Style key sync
  runs once, after the style edits. The ±11 bound and the 0 refusal are where D-064 says.
- **Lyrics into the render and the version** (`scoreRenderJob.ts:78`, `scoreVersion.ts`): the request carries `plan.lyrics ?? source.lyrics`; version params
  `request.lyrics` and `lyrics` hold what was sent; `songs.lyrics` follows only for a non-empty text, the same rule as `routes/versions.ts` activate, so a revert
  and a render agree. `changed.lyrics` makes a lyrics-only plan not a NO_CHANGE; an identical rewrite is NO_CHANGE.
- **Stale referent**: the route and the job both resolve the pick against the read (409 + `stale` before queueing; `PlanError('refused', ..., stale)` at the
  turn, planner never loaded); a stale PLAN drops the old plan, a stale or failed REVISE keeps it (D-063/D-070 e), client `reviseEnded` and `planStale` match.
  `locate` counts from the end when `of` is sent; `parseReferent` rejects `of < occurrence`.
- **Planner hand-off**: REVISE/referent checks sit before `deps.probe()` and the load; `planAttempts` is unchanged (3 attempts); one `release()` per press.
- **Project rules**: no code file over 200 lines (largest `api/score.ts` 158); DESIGN.md changes are their own `docs(design)` commits; unfinished flows gated
  (no strip without data). `planRevise.ts`'s refusal texts live outside `scoreLimits` (rule text says refusal texts live there), recorded in D-070 f.
- **F-029..F-033 acceptance**: all five read as met against the code and `m2-verify.md`; the two open items are Q-050 (REVISE semantics, skipped here) and Q-051.
