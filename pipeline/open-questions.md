# Open questions

<!-- One entry per question. Tags: blocking | assumable | deferred (see gates.md).
     Status: open | answered → D-### | assumed → D-### | dropped (why). Never delete entries. -->

## Q-001 · blocking · stage 1 · answered → D-005
Is the SCORE AGENT (LLM-planned ABC edits on YuE2 songs) in scope at all? PLAN.md ("Engine: YuE2", "YuE2: Align With Upstream", ~lines 2887 and 4451) says ABC score editing / agentic editing is out of scope; PLAN.md 5598 relaxed this for whole-section picking only; AGENTS.md says every edit after the first take runs on ACE-Step and "raise it as a scope question rather than building it". Nothing is built.
- A) In scope: write a dated PLAN.md section that supersedes the out-of-scope lines and amends AGENTS.md's "edits run on ACE-Step" (extra engines may re-render their own song from an edited score) — consequence: two project rules change, user must say so (recommended if the feature is wanted; do it before any code).
- B) Out of scope: keep USE .ABC FILE as the only score-editing path; archive the mockup — consequence: no new work, no rule change.
- C) Narrower: deterministic ops only (SET TEMPO, TRANSPOSE, REPEAT/CUT, EDIT STYLE, REWRITE LYRICS), no LLM, no WRITE PHRASE — consequence: no local-LLM dependency or VRAM risk, still amends the YuE2 scope lines.

## Q-002 · blocking · stage 5 · answered → D-007 (palette + Activity sub-questions stay open for stage 5)
Where does the score agent live in the redesigned Editor? The mockup used the old prompt bar (SCORE · YUE2 mode), a left score panel and a history rail. On main those are gone: ActionDock has verbs REPAINT / ADD LAYER / SPLIT / EXPORT (ActionDock.tsx), the left column is deleted, the right rail is VERSIONS only, and the Ctrl K palette navigates and pre-fills but never commits. (seen in code; the conflict is inferred.)
- A) A 5th dock verb SCORE, shown only for a song whose base came from YuE2; the change list, checks and bar map render in the dock body, commit is APPLY & RENDER with the consequence line "saves base vN, re-renders the whole song on YuE2" (recommended: matches the "one place to act" rule, but the dock body grows tall; needs a mockup).
- B) A new top-level view "Score" (DESIGN.md allows new views) with its own review layout, reached from a dock link — roomier for the bar map, but leaves the Editor.
- C) Right rail swaps to a score review while a plan is pending — brings back the rail modes S1 removed.
- Also decide: do palette DO items get "Edit score · <request>" (pre-fill only)? and does the Activity drawer show the planner as a job (it is a GPU job)?

## Q-003 · blocking · stage 1 · answered → D-006
What happens to ACE-Step edits and layers when a score edit re-renders the song from the YuE2 score? Later repaints and lego layers are ACE-Step audio; a YuE2 re-render does not carry them, and layers were conditioned on the old mix.
- A) Block: the SCORE verb is available only while the song has one layer and no repaint versions; otherwise offer "make a new song from this score" (recommended: simplest and matches the stated "edits after take 1 run on ACE-Step" rule).
- B) Allow and warn: the new base version replaces audio; existing layers stay, flagged stale; repaint versions on the old base are not re-applied.
- C) Always branch to a new song (copy of the score as a fresh YuE2 take) — safest for the user's history, adds a song per edit.

## Q-004 · assumable · stage 1 · answered → D-008
Confirm the reconstructed brief (core promise, user, non-goals, constraints, and the inferred points: 16 GB VRAM single GPU, Windows host + WSL2 for YuE2, one real user). Marked (inferred) in brief.md.
- default if assumable: accept as written; edit brief.md if wrong (cheap to reverse).

## Q-005 · assumable · stage 4 · answered by the tree → D-022 (genQueue.ts present in the working tree; verify on main)
Merge order: redesign S4 (feat/job-queue, "part a" only, unmerged) versus a score agent. The planner and render jobs queue behind genLock today.
- A) Finish and merge S4 first, then specify the score agent against genQueue (default: the repo's spec says S4 follows S3, which is merged, and a GPU job type should not be wired to the module being deleted).
- B) Build the agent against genLock and rebase.
- default: A. Reversal cost < 1 day.

## Q-006 · assumable · stage 3 · open
Planner transport. The mockup assumes an OpenAI-compatible endpoint (Ollama or llama.cpp) via a new `LLM_API_URL`, matching the existing pattern (`YUE_API_URL`, `HEARTMULA_API_URL`, `ACESTEP_API_URL`; seen in server/src/config.ts).
- default: OpenAI-compatible `/v1/chat/completions`, structured-output (JSON schema or tool call) for the op list, no key. Reversible: one client module.

## Q-007 · blocking · stage 3 · assumed → D-010 (settled by upstream docs 2026-10-03; audible adherence spiked as R-013 / SP-3)
Which render path does APPLY & RENDER use: `cot=full` (the mockup) or `cot=melody`? Today `buildYue2CoverRequest` always sends `cot: 'melody'` with `abc` (seen in yue2.ts:95-97). Whether YuE2 re-plans over a supplied ABC with `cot=full`, and whether lyrics and chords then survive, is unverified. A wrong guess means the feature does not do what the user sees in the review.
- A) Spike one real render each way before scope (recommended).
- B) Assume melody, document that chord/lyric edits may be re-planned.

## Q-008 · deferred · stage 5 · open
A/B compare of two versions (redesign open question 1, PLAN.md). Revisit after the dock has been used. Relevant to the score agent because comparing the pre-edit and re-rendered song is the natural review step.

## Q-009 · deferred · stage 6 · open
Queue behaviour while ACE-Step is unreachable (redesign open question 3); and MIX as FLAC/MP3 with tags (open question 2).

## Q-010 · assumable · stage 1 · open
Process: which legacy rituals to retire (audit.md "Rituals"): mirroring every change into PLAN.md + DESIGN.md + docs by hand, and the plan/fix/record-browser-check commit triple per micro-fix.
- default: keep PLAN.md as the spec log for 3+ file features (it matches pipeline spec-first), drop the "record the browser check" docs commits; fold into STATUS.md/features.json. Reversible.

## Q-011 · assumable · stage 1 · open
Does the redesign mockup set (`ActionDock.dc.html`, `GuidedCreate.dc.html`, `CommandActivity.dc.html`) exist anywhere the pipeline can read? The repo has none (find returned no `*.dc.html`).
- default: treat DESIGN.md (rewritten per slice) as the design source; copy the mockups into `pipeline/design/` if the user has them.

## Q-012 · assumable · stage 3 · assumed → D-011
Where does the score planner run: on the GPU with a forced unload after every plan, or on CPU/system RAM only? GPU is fast but needs the VRAM hand-off to work (R-003, SP-1); CPU (`num_gpu: 0` / `-ngl 0`, ~200 GB RAM available) needs no hand-off and no GPU slot, but a plan may take minutes (unmeasured).
- A) GPU, unload confirmed before the slot is released (default).
- B) CPU only.
- C) Setting, default A, B when SP-1 fails.
- default: A; SP-1 step 5 measures B's latency so the user can choose with numbers. Reversal cost: a config switch, < 1 day.

## Q-013 · assumable · stage 3 · assumed → D-012
Which planner server does Mulakai target first? D-002 keeps an OpenAI-compatible chat call, but unload and context checks are server-specific: Ollama has `keep_alive: 0` and `/api/ps` on its native API only (not in the `/v1` field list) and a 4k default context below 24 GiB VRAM; llama.cpp's single-model server cannot unload (router mode has `POST /models/unload`, or `--sleep-idle-seconds`).
- A) Ollama first: `/v1/chat/completions` with `response_format` JSON schema for the plan, plus a native `POST /api/generate {keep_alive: 0}` release and a `/api/ps` context preflight (default).
- B) Ollama native `/api/chat` only (`format`, `options.num_ctx`, `keep_alive: 0` in one request); drops OpenAI-compat portability.
- C) llama.cpp router mode first.
- default: A. Reversal cost: one client module.

## Q-014 · assumable · stage 3 · assumed → D-013
Pass thresholds for SP-2, which decide whether WRITE PHRASE ships (D-005's revisit clause).
- default: deterministic op lists schema-valid ≥ 90% first try; REHARMONIZE and WRITE PHRASE validator pass within 3 retries ≥ 70%; p50 plan ≤ 60 s on GPU; plus the user's own listen to 5 results. Below threshold → R-002 fallbacks in order (structured chord ops, grammar-constrained phrase, then cut WRITE PHRASE), shown to the user before scope. Reversal cost: re-read the spike numbers, none.

## Q-015 · assumable · stage 5 · open
With YuE2 the default (D-015), most songs start with SCORE available, and the first ACE-Step edit closes it (D-006). How does the dock warn before that edit?
- A) A consequence line on REPAINT / ADD LAYER / extract / remaster while SCORE is still open: "score editing ends after this edit — SCORE will offer a new song instead" (default; matches DESIGN.md's consequence-before-commit rule).
- B) A one-time confirm on the first ACE-Step edit.
- default: A. Recorded in PLAN.md "YuE2 Is the Default First-Take Engine" → "With the score agent". Scoped at stage 4 as F-027 (M1, before most users have SCORE open).

## Q-016 · assumable · stage 4 · assumed → D-018
Does WRITE PHRASE belong in M0? Default: no, M1's first feature; M0 = SET TEMPO + REHARMONIZE + EDIT STYLE. Reversal cost: reorder two milestones, under a day. (The user may want the compound sentence as the demo.)

## Q-017 · assumable · stage 4 · assumed → D-019
Where does the applier run? Default: yue-server CPU-only routes with the validator (not only the validator). Reversal cost: a port, 2-3 days, with SP-2's golden cases as the contract.

## Q-018 · assumable · stage 4 · assumed → D-020
Pending plans are in server memory and die with a restart. Reversal cost: one table, under a day.

## Q-019 · assumable · stage 4 · assumed → D-021
M0 eligibility needs chords in the score; covers, instrumentals and chord-free scores wait for M3. Reversal cost: about a day (render mode switch exists in yue-server).

## Q-020 · assumable · stage 4 · assumed → D-025
A `truncated` render is saved and active, shown as a rust warning. Reversal cost: stage 5 copy and a flag.

## Q-021 · deferred · stage 7 (M0 live run) · open
SP-1's owed measurements: the NVIDIA Sysmem Fallback Policy on vs off (does the negative control then fail loudly?), the card with ACE-Step after a real generation (parked ~0.5 GB), and the real queue in the loop. F-025 runs the last two; the policy toggle is a system setting only the user can flip. Re-check at M0's live run; not blocking M0 build.

## Q-022 · blocking · stage 5 · answered → D-032
SCORE dock body height (DT-1, R-006; pipeline/design/score-verb.html). Pick one:
- A) GROW (recommended): change list and checks line always fully visible; dock ≈ 330 px with 3 ops, ≈ 390 px with 5, vs ≈ 250 px for REPAINT (inferred from the CSS, not measured). Costs a ≈ +80 px jump on plan-ready. Fits at 1080p because D-006 makes a SCORE song one layer.
- B) CAP + SCROLL: list capped at 3 rows, fixed ≈ 330 px; a rejected or 4th op sits below the fold.
- C) FOLD: one-line summary rows and collapsed checks, ≈ 270 px; one more click to read what is committed, gates hidden until they fail.

## Q-023 · blocking · stage 5 · answered → D-032
The SCORE verb's key (DT-2; R, L, S, E taken; Space and Ctrl K also bound). Pick one:
- A) C (recommended): S-C-ORE and chords; free. Risk: a later COMPARE verb would want it.
- B) O: free, no meaning.
- C) P: PLAN, the first button inside; label and key disagree.

## Q-024 · assumable · stage 5 · assumed → D-027
SCORE tab appended last (the four existing tabs never move); TARGET chip `BASE · WHOLE SCORE`; PLAN is an acid-outline sibling beside the single filled APPLY & RENDER, which is disabled while its own render runs. Reversal cost: copy and one class.

## Q-025 · assumable · stage 5 · assumed → D-028
After a failed re-plan the dimmed old plan is dropped and "check failed" shows (the edited request no longer matches it). Alternative: keep it with USE PREVIOUS PLAN. Reversal cost: one extra state.

## Q-026 · assumable · stage 5 · assumed → D-029
The planning job line wears the AI shader once the planner holds the slot (queued stays dashed); the F-021 PR adds "planning" to DESIGN.md's shader list. Fallback: a plain dashed line. Reversal cost: under an hour.

## Q-027 · assumable · stage 5 · assumed → D-030
Q-015's REPAINT / ADD LAYER / extract / remaster clause is rust-body text inside the consequence line, shown only while SCORE is open, and reads "score editing ends after this edit, SCORE will be off for this song" until M3's NEW SONG FROM THIS SCORE exists (Q-015's own wording promises a button that is not built before M3). Reversal cost: copy.

## Q-028 · assumable · stage 5 · assumed → D-031
EDIT STYLE always states "a request to YuE2, not a guarantee" (the conductor's brief); scope.md line 158 says only when an instrument is named. Reversal cost: one condition.

## Q-029 · deferred · stage 5 · M2 half assumed → D-065 (Q-044); M4 half open
M2 referent (a selected section or lyric line as a sky suffix on the SCORE chip, no waveform wash) and where M4's bar map sits (collapsed `BARS ▸` under the checks line). Judge when M2 / M4 start.


## Q-030 · assumable · stage 6 · answered → D-046
The context-budget script exits 1 because CLAUDE.md `@import`s AGENTS.md (~1.1k tokens every session). Change CLAUDE.md to a pointer plus a ~10-line digest of the costly rules, keeping AGENTS.md unchanged for other tools, and add path-scoped `.claude/rules/` per area (architecture.md "Context skeleton")?
- default: yes, in the W0 PR as its own commit. Alternative: keep the import and accept the over-budget flag. Reversal cost: one line.

## Q-031 · assumable · stage 6 · answered → D-046
Which Ollama does the score agent use on this machine? The user's server on :11434 is up (0.32.15) but its `OLLAMA_CONTEXT_LENGTH` is unknown; the planner needs 16,384 or the context guard refuses.
- A) Agents start a second `ollama serve` on :11435 with the setting, as the spikes did (default; touches nothing of the user's).
- B) The user restarts their :11434 server with `OLLAMA_CONTEXT_LENGTH=16384` (system env) and `LLM_API_URL` points there.
- Reversal cost: an env var.

## Q-032 · assumable · stage 7 · assumed → D-048
F-017 #1 says "the 39 golden cases ... (10 library sidecars, 29 mutations)", but `pipeline/spikes/SP-2-planner-quality/golden.json` holds 37 (10 + 27; golden.py has 27 `mutate` calls, golden.out.txt lists 37). Default: the bar is all 37, all matching upstream; fix the criterion text to 37. Alternative: add two mutations to reach 39 (no source says which). Reversal cost: two test cases.


## Q-033 · assumable · stage 7 · assumed → D-050
F-019 #3 says "an op naming bar 999 or a section that does not exist is rejected with a per-op reason". No M0 op (SET_TEMPO, REHARMONIZE, EDIT_STYLE; yue-server's strict apply route) has a section field, so only the bar case is testable; sections bound REHARMONIZE's bars. Default: the bar case (schema bound + per-op reason + yue-server verdict) meets the criterion; the section case lands with the first section op (M2 REPEAT/CUT). Alternative: add an optional `section` to REHARMONIZE in both yue-server and the schema. Reversal cost: one field on each side.


## Q-034 · assumable · stage 7 (CP1) · assumed → D-051, reversed → D-055
F-025 #3 says "root agreement on the edited bars (reported next to the SP-3 chance level)". At CP1 (2026-10-03) qwen3:14b answered "jazz chords in the chorus" on 3 of 3 songs by keeping every root and adding 7ths plus a first-inversion bass (Dm → Dm7/F, C → Cm7/E), so root agreement vs the new chords equals agreement vs the old ones and measures nothing. The renders did change: the transcribed chord moved on 100% / 100% / 50% of edited bars against 0–2% of unedited bars (pipeline/cp1/CP1-LOG.md). Two of the plans also wrote `Cm7/E`, a bass outside the chord, which the validator accepts.
Default: F-025 reports root agreement as written, plus "audio chord changed vs the base render, edited vs unedited bars" and chord-tone Jaccard new vs old, and the owed A/B listen judges whether same-root jazz is audible enough. The planner prompt and validator stay unchanged in M0. Alternatives: (B) a planner rule that a reharmonization must change at least one root per 2 bars; (C) the validator refuses a slash bass that is not a chord tone. Reversal cost: B is a prompt line plus a golden case; C is a check in `score_ops.py` plus a pytest.

## Q-035 · assumable · stage 7 (W3) · assumed → D-052
The consequence line's "re-renders the whole song on YuE2, about 3 min" (scope.md, the mockup) does not say whether "3 min" is the song's new length or how long the render takes. Default: the estimated length of the re-rendered song (the plan's seconds, rounded to minutes), since render time is not known before a render and CP1 measured it per song. Alternative: a render-time estimate from YuE2 tokens/s (CP1's ~100 tok/s) and the plan's tokens. Reversal cost: one clause in `client/src/scoreCopy.ts` and its test.


## Q-036 · deferred · stage 7 (verify M0) · closed → D-060
When the planner answers the 360 s feedback by changing the asked tempo, the dock shows only the result. Live 2026-10-04 on the 147-bar 2/4 song: request "set it to 40 BPM" (441 s) became SET TEMPO 70 -> 50 BPM (353 s) on attempt 2, and the review says "attempt 2 of 3" but not that 40 was refused. F-022 #1 wants the number and the answer ("estimated 441 s: over the 360 s limit; at least 49 BPM fits") when it cannot render whole. Decide: keep silent retry, or add one line "asked 40 BPM; 50 is the slowest that fits" to the review. Not blocking M0 (the change list is explicit). Evidence: pipeline/verify/M0/m0-summary.json.

## Q-037 · deferred · stage 7 (verify M0) · open
Two Mulakai servers can share one yue-server and one GPU (seen live: the user stack on :3001 ran two YuE2 jobs through the yue-server a verifier started for :3301, one of them overlapping a plan and slowing it from ~14 s to 24 s, VRAM peak 15.6 GB of 16.4). The plan to render hand-off is per Mulakai server, so it cannot see another server job. Also seen: after a real ACE-Step generation the ACE-Step process held about 22 GB of RAM and C: ran to 0 bytes free; Ollama llama-server crashed once (0xc0000409) and one render failed ENOSPC; killing ACE-Step freed about 12 GB on C:. Decide whether the M0 docs should say "one Mulakai server per GPU" and whether M1 should add a free-disk check before APPLY & RENDER. Evidence: pipeline/verify/M0/m0-summary.json, F-025 evidence.

## Q-038 · deferred · stage 8 (M0 code review) · open
Four nits from pipeline/reviews/M0-code.md are left out of M0 (D-054): #4 a queued word-timings job refuses the render (exclude `timings` from pendingEdit in scoreRenderJob.ts:45); #5 an untagged LLM_MODEL (`qwen3`) never matches Ollama's `:latest` name (ollamaControl.ts:37, planJob.ts:72); #6 a double POST can queue two plan or render jobs, because the in-flight guard runs before an await (routes/scorePlan.ts:33, routes/scoreRender.ts:28); #7 restoreScoreMeta (scoreVersion.ts:113) is a second reader of the sidecar, against the rule that scoreSource is the only reader. Also from the fix: a GPU refusal when a queued render reaches its turn still fails the job with `cause: 'refused'`, which the dock shows as a stale plan (D-054 covered only the click-time 409); and deleting the active version restores meta but, unlike activate, not `songs.lyrics`. Decide in M1: a small fix PR, or reject each with a reason. Each is a few lines plus a test.

## Q-039 · assumable · stage 7 (M1/W6) · assumed → D-058
F-027 #1 lists REMASTER MIX among the verbs whose consequence line says score editing ends. remasterJobs.ts never writes a DB row and its line already says the result "isn't kept", so SCORE stays open after a remaster and the clause would be false. Default: no clause on REMASTER MIX. Alternative: add it if a kept remaster ever lands. Reversal cost: one prop.

## Q-040 · assumable · stage 7 (M1/CP2) · assumed → D-060
CP2 live (pipeline/verify/M1/m1-summary.json): "a phrase in bars 20-23" (where the Vocal sings) was refused on attempt 1 with "the Vocal sings in bars 20-23; free: 1-10, 47-65", then the planner moved the phrase to bar 47 (and once to 60 against "do not move it") and the review showed an ok plan with no word of the refusal. Same shape as Q-036 (asked 40 BPM, got 50). Default: the review shows one line per earlier refused attempt, in plain words ("attempt 1 refused: the Vocal sings in bars 20-23; free: 1-10, 47-65"), so a moved phrase or tempo is never silent; this also closes Q-036. Also: the consequence line says the phrase replaces the instrument part in its bars (CP2 saw the old Ins notes replaced). Alternative: refuse the plan when the request names bars the plan does not use. Reversal cost: one review line and its copy test.

## Q-041 · deferred · stage 8 (M1 code review) · open
Three nits from pipeline/reviews/M1-code.md are left out of M1 (D-061): #2 the instrument is appended only when the style does not already contain it as a substring, so "organ" is not added to "organic folk" (score_phrase.py:112, and the same rule in client scoreCopy.ts `names`); #3 PITCH, BEATS, 8 bars, 16 notes and 40 chars live in both phraseSchema.ts and score_phrase.py and only the TS side is pinned by a test (drift = a 422 on the whole apply; a contract test could pin both); #4 the golden-path server in e2e/playwright.config.ts does not blank LLM_API_URL like its sibling URLs, so a developer shell with it set leaks into the golden path. Decide with Q-038 in W10: a small fix PR, or reject each with a reason.

## Q-042 · assumable · stage 5 (M2) · assumed → D-065
REVISE shape (design/score-m2.html frames 5-9). Default A: a second outline button REVISE beside PLAN, shown while a plan is ready. Alternatives B/C drawn in the mockup. Reversal cost: client only.

## Q-043 · assumable · stage 5 (M2) · assumed → D-065
A stale selection (the section count changed since the pick) becomes a rejected row with a `USE BARS 37–44` button, never a silent remap. Needs one server reply field (the shifted bars). Alternative: drop the referent and plan the whole song. Reversal cost: one field + one row.

## Q-044..Q-049 · assumable · stage 5 (M2) · assumed → D-065
Q-044 the referent is a sky suffix on the SCORE chip (`THIS: CHORUS 2 · BARS 29–36`, ✕ clears) and picks under SCORE stay on SCORE (closes Q-029's M2 half; its M4 bar-map half stays deferred); Q-045 a picked lyric line means its block; Q-046 REWRITE LYRICS is tagged "a request", new words saved with the new version; Q-047 the no-matching-block rule is W12's, the mockup fixes only its display; Q-048 the duration hint has a typing-only FILL button; Q-049 the lyric diff stays open, with a fold fallback if frame 10 fails the 1366×768 check.


## Q-050 · deferred · stage 7 (verify M2/CP3) · D-073 fixed 2+ op plans; open for 1-op additive, fewer chords, 6-op growth (D-078)
REVISE (F-033) drops the pending ops on additive requests (D-068's own "revisit if"). Live on qwen3:14b, pipeline/verify/M2/raw/run-t5_r4.json, run-t6_r1.json, f033_ui.log: "also slow it down to 80 BPM" and "keep the jazz chords and also slow it down to 80 BPM" came back with only SET_TEMPO (17 completion tokens), the REHARMONIZE / TRANSPOSE + REPEAT + REWRITE LYRICS listed under REMOVED SINCE PLAN 1 (4 of 4 trials that touch one op of several). "not so many chords" and "one chord every two bars" returned the identical plan twice (SAME): the halved chord list is refused by the D-055 root rule and the retry falls back to plan 1. The mechanism works (marks, replace, failed REVISE keeps plan 1); the planner does not copy unchanged ops. Options: (a) ship as is, the REMOVED line shows the loss; (b) the planner returns only what changes and code merges it into the pending plan; (c) a prompt change with the pending ops restated. Reversal cost: (b) is a server change in planRevise.ts plus tests.

## Q-051 · deferred · stage 7 (verify M2/CP3) · half assumed → D-074; score-section strip open (M4)
F-032's section strip exists on a YuE2 song only after the lyrics read has produced timings (D-072). Live: with LYRICS_API_URL unset the SCORE chip says "click a section or a lyric line: it becomes "this" in your request" and the editor shows an empty LYRICS lane and no strip (pipeline/verify/M2/shots/probe-Gertar.png); with lyrics-server running the Editor auto-reads timings in ~15 s and the strip appears (shots/timing-Gertar.png). The strip is cut from lyric tags (Gertar: 8 segments) not score sections (10), so a section with no lyric block (the third chorus) cannot be picked. Options: hide the hint when there is nothing to pick; build the strip from the score's sections for YuE2 songs. Reversal cost: client only.

## Q-052 · deferred · stage 8 (M2 code review) · open
Two nits from pipeline/reviews/M2-code.md (D-075): #1 a line pick survives a REWRITE LYRICS render with its old words in the chip and the planner prompt (planReferent.ts:159-163, `text` never re-checked); #3 the section-to-block pairing rule and `kindOf` exist in yue-server, server and client with no cross-test (no drift today). Decide with Q-038/Q-041 in W10.

## Q-053 · deferred · stage 7 (M2 listen) · open
The user heard REPEAT's second seam (the copy into the next section) as audible on Gertar (D-077; seam 1 smooth). One pair only; p2 unjudged. Options: leave it (YuE2 re-renders the whole song, seams are its call); try un-tying only into the copy (D-066 c alternative) and A/B; a REPEAT note in the review that the seam after the copy may be audible. Revisit with more listens.
