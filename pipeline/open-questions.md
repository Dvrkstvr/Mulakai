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

## Q-029 · deferred · stage 5 · open
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


## Q-034 · assumable · stage 7 (CP1) · assumed → D-051
F-025 #3 says "root agreement on the edited bars (reported next to the SP-3 chance level)". At CP1 (2026-10-03) qwen3:14b answered "jazz chords in the chorus" on 3 of 3 songs by keeping every root and adding 7ths plus a first-inversion bass (Dm → Dm7/F, C → Cm7/E), so root agreement vs the new chords equals agreement vs the old ones and measures nothing. The renders did change: the transcribed chord moved on 100% / 100% / 50% of edited bars against 0–2% of unedited bars (pipeline/cp1/CP1-LOG.md). Two of the plans also wrote `Cm7/E`, a bass outside the chord, which the validator accepts.
Default: F-025 reports root agreement as written, plus "audio chord changed vs the base render, edited vs unedited bars" and chord-tone Jaccard new vs old, and the owed A/B listen judges whether same-root jazz is audible enough. The planner prompt and validator stay unchanged in M0. Alternatives: (B) a planner rule that a reharmonization must change at least one root per 2 bars; (C) the validator refuses a slash bass that is not a chord tone. Reversal cost: B is a prompt line plus a golden case; C is a check in `score_ops.py` plus a pytest.
