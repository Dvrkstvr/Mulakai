# Decisions

<!-- Append-only log. by: user = the user's call; by: assumed = a recorded default the
     user can overrule; by: spike = settled by evidence. Superseded entries stay, marked. -->

## D-001 · 2026-10-03 · stage 1 · by: assumed
The reconstructed brief stands as written until the user corrects it (Q-004).
- why: every guess is marked (inferred); cheap to edit.
- instead of: blocking adoption on a sign-off round.
- revisit if: the user corrects the core promise, user profile or constraints.

## D-002 · 2026-10-03 · stage 3 · by: assumed
Planner transport is an OpenAI-compatible chat endpoint at `LLM_API_URL` (Q-006), mirroring `YUE_API_URL` / `HEARTMULA_API_URL`.
- why: matches existing config pattern; Ollama and llama.cpp both serve it.
- instead of: a bespoke planner process.
- revisit if: Q-001 is answered B (nothing built) or the spike shows no local model is usable.

## D-003 · 2026-10-03 · stage 4 · by: assumed
S4 (job queue) is finished and merged before a score agent is specified (Q-005).
- why: the spec already orders S4 after S3; a new GPU job type should target genQueue, not genLock.
- instead of: building on genLock and rebasing.
- revisit if: the user wants the score agent sooner than the queue.

## D-004 · 2026-10-03 · stage 1 · by: assumed
Retire the "record the browser check" docs-only commit and the three-doc mirror (Q-010); PLAN.md remains the spec log for 3+ file features.
- why: 168 of 428 non-merge commits are doc-only and 163 have a `docs:` subject (audit.md).
- instead of: keeping every ritual.
- revisit if: the user values those records for a reason not visible in the repo.

## D-005 · 2026-10-03 · stage 1 · by: user
The score agent is in scope as the full agent: a local LLM plans the changes, WRITE PHRASE included (Q-001 A).
- why: the user chose the full agent over the no-LLM cut.
- instead of: deterministic ops only (Q-001 C), or keeping USE .ABC FILE as the only score edit (Q-001 B).
- consequence: before any code, a dated PLAN.md section must supersede "ABC score editing / agentic editing is out of scope" (Engine: YuE2, YuE2: Align With Upstream) and amend AGENTS.md's "every edit after the first take runs on ACE-Step" so YuE2 may re-render its own song from an edited score.
- revisit if: the stage 3 spike shows no local model produces valid ABC within the retry budget (R-002), or the VRAM hand-off fails (R-003); fall back to Q-001 C.

## D-006 · 2026-10-03 · stage 1 · by: user
Score edits are blocked once a song has ACE-Step edits: SCORE is available only while the song has one layer and no repaint versions; otherwise it offers "new song from this score" (Q-003 A).
- why: simplest; nothing is silently lost; keeps "edits after take 1 run on ACE-Step" true for edited songs.
- instead of: allow + warn with stale layers (B), or always branching to a new song (C).
- revisit if: users routinely want a score edit after a repaint.

## D-007 · 2026-10-03 · stage 5 · by: user
The score agent is a 5th Action Dock verb, SCORE, shown only for songs whose base came from YuE2; the change list, checks and bar map render in the dock body; the commit is APPLY & RENDER with a consequence line (Q-002 A).
- why: matches the redesign's "one place to act".
- instead of: a new top-level Score view (B), or the rail swapping to a review mode (C).
- consequence: the prior mockup (old prompt bar, left score panel, history rail) is superseded; stage 5 mocks the dock verb. Still open for stage 5: palette DO item pre-fill and whether the planner shows in the Activity drawer.

## D-008 · 2026-10-03 · stage 1 · by: user
The reconstructed brief is signed off as written (Q-004); supersedes D-001.

## D-009 · 2026-10-03 · stage 1 · by: assumed
Track standard; approach spec-first (primary), design-first for the dock verb, prototype-first for the planner/VRAM unknowns (audit.md Recommendation). Score agent continues at stage 2 feasibility, then a stage 3 spike (R-002, R-003, R-010/Q-007) before scope.
- why: the user accepted the audit's recommendations at each step.
- revisit if: the user wants spark (skip spikes) or deep.

## D-010 · 2026-10-03 · stage 2 · by: assumed
APPLY & RENDER sends the edited score as `abc` with `cot` full when the score has chord symbols, else `melody`; lyrics are the request's own field with section tags derived from the score (Q-007).
- why: upstream documents `cot` full + edited ABC as the edit path and says an external ABC bypasses the planner (generation-and-covers.md, SKILL.md, YuE 72272f9); yue-server's instrumental.py already uses the same rule.
- instead of: the cover builder's hardcoded `cot: 'melody'` (yue2.ts:95-97).
- revisit if: SP-3 shows `cot` full renders ignore chords no better than `melody`.

## D-011 · 2026-10-03 · stage 2 · by: assumed
The planner runs on the GPU and is unloaded, with the release confirmed, before its GPU slot is released (Q-012 A).
- why: fastest plan; SP-1 measures the hand-off and the CPU-only latency.
- instead of: CPU-only planning.
- revisit if: SP-1 fails its pass line, or CPU-only plans are fast enough.

## D-012 · 2026-10-03 · stage 2 · by: assumed
Planner server: Ollama first, through `/v1/chat/completions` with a JSON-schema `response_format`, plus Ollama-native release (`keep_alive: 0`) and context preflight (`/api/ps`) (Q-013 A). Refines D-002, does not replace it.
- why: `keep_alive` and context size are not settable through Ollama's `/v1` endpoint (docs.ollama.com/api/openai-compatibility, /context-length).
- instead of: Ollama native only, or llama.cpp router first.
- revisit if: the user runs llama.cpp, or SP-2 picks a model Ollama cannot serve.

## D-013 · 2026-10-03 · stage 2 · by: assumed
SP-2 pass thresholds as in Q-014's default.
- why: they make the D-005 revisit clause testable.
- revisit if: the user sets other thresholds after seeing the spike numbers.

## D-014 · 2026-10-03 · stage 1 · by: user
HeartMuLa is marked for removal: it only adds another first-take generator (no covers, no score, fewer controls). PLAN.md "Remove the HeartMuLa Engine"; removal PR `feat/remove-heartmula`.
- why: no capability the score agent or editing needs; lyrics-server's HeartTranscriptor is independent and stays.
- instead of: keeping three first-take engines.
- consequence: D-002's `HEARTMULA_API_URL` reference is only a pattern example now; R-003's ~0.25 GB HeartMuLa context leaves the VRAM arithmetic.

## D-015 · 2026-10-03 · stage 1 · by: user
YuE2 is the default first-take engine for AN IDEA; ACE-Step for new songs is an opt-in Settings toggle (ACE-STEP FOR NEW SONGS, off). Falls back to ACE-Step when `YUE_API_URL` is unset. COVER unchanged (open). PLAN.md "YuE2 Is the Default First-Take Engine".
- why: the user's call.
- consequence for the score agent: SCORE (D-007) is available on every default new song, so it is the primary edit path, not a niche; D-006 makes the first ACE-Step edit the point where score editing ends (Q-015). AGENTS.md amendments stay separate: D-015's PR changes the first-take default only, D-005's PR amends "edits run on ACE-Step".
- revisit if: YuE2 output quality or WSL2 reliability makes it a poor default.


## D-016 · 2026-10-03 · stage 3 · by: user
SP-3 is finished by a fresh spike agent reusing the saved renders; SP-2 tests qwen3:14b (already downloaded) plus ONE current MoE planner of roughly 15–20 GB, run partly on CPU. The agent names the exact model file and size in its result.
- why: the user's call during autopilot setup.
- instead of: analysis-only SP-3, or SP-2 with qwen3:14b alone.

## D-017 · 2026-10-03 · stage 3 · by: assumed
SP-2 defaults used where its definition was silent: (a) "valid" means schema-valid + every op applies + upstream `parse_abc`/`compare` pass + the 360 s / 4,096-token limits hold, and WRITE PHRASE also passes three sanity gates (>= 4 notes, >= 3 distinct pitches, >= 70% in key, bars not all identical); (b) WRITE PHRASE overlays the Ins bars where the Vocal rests (as SP-3's `*_e` renders), it does not insert new bars; (c) the 9 usable library scores stand in for "~20" (the library has only 10 sidecars, 9 parse); (d) intent (right bars/section/nothing extra) is reported next to validity but D-013's lines are read on validity.
- why: they make D-013 testable without a human; each is stated at the top of SP-2's RESULT.md.
- instead of: counting a plan valid on JSON-schema alone, or inserting new sections for a phrase (needs lyric tags, not tested).
- revisit if: the user wants "valid" to include musicality (owed listen) or wants WRITE PHRASE to insert a new section.

## D-018 · 2026-10-03 · stage 4 · by: assumed
M0's op set is SET TEMPO, REHARMONIZE and EDIT STYLE; WRITE PHRASE (notes + beats) is M1's first feature (Q-016).
- why: smallest set that exercises R-002, R-003 and R-013; WRITE PHRASE is a separate schema, applier and retry shape and the one place qwen3 failed (SP-2).
- instead of: the full sentence "jazz chords, 88 BPM, add a sax phrase" in M0.
- revisit if: the user wants the compound sentence to be the M0 demo, or the owed A/B listen says harmony is inaudible (then M0 ships tempo + style only and REHARMONIZE moves behind WRITE PHRASE).

## D-019 · 2026-10-03 · stage 4 · by: assumed
The op applier, validator, token count, duration estimate and bar map all run in yue-server as CPU-only routes (extends R-016's validator recommendation to the applier); Mulakai's server holds the planner client, prompt, jobs and routes (Q-017).
- why: the spike's applier is 553 lines of Python on top of upstream's parser; a TS port exceeds the 200-LOC cap and risks the accidental-semantics drift upstream warns about.
- instead of: a TypeScript port with golden tests.
- revisit if: the yue-server route proves awkward (yue-server down means no plan even though the planner is up), then port with SP-2's golden.json as the contract.

## D-020 · 2026-10-03 · stage 4 · by: assumed
A pending plan lives in server memory with the job registry and is lost on a server restart; the commit then says "plan expired" (Q-018).
- why: same lifetime as every other job; avoids a new table for a minutes-long review.
- revisit if: users lose plans to restarts.

## D-021 · 2026-10-03 · stage 4 · by: assumed
M0 eligibility requires chords in the score (the `cot` full path); chord-free, instrumental and cover scores wait for M3 (Q-019).
- why: keeps M0 on one render mode (D-010) and the path SP-3 measured.
- instead of: supporting `melody` renders in M0.
- revisit if: the user's own library is mostly covers.

## D-022 · 2026-10-03 · stage 4 · by: assumed
M0 targets `genQueue` (S4), not `genLock`: genQueue.ts is in the working tree and genLock is gone (seen in code, 2026-10-03). Supersedes Q-005's open state; D-003 holds. If `main` lacks it, M0 waits.
- why: the working tree shows S4 merged since the audit; the brief's S4 row and R-007 are stale.
- instead of: a genLock adapter.
- revisit if: `git log main -- server/src/services/genQueue.ts` is empty.

## D-023 · 2026-10-03 · stage 4 · by: spike (SP-3)
In M0 no op rewrites lyric section tags; stored lyrics and style are sent as stored except what an op changes. Tag derivation from `% section` comments arrives with the first section op (M2).
- why: SP-3 measured that normalizing only `[Verse 1]` to `[Verse]` moved 2-8% of the notes at the same seed.
- revisit if: M2's section ops need tags earlier.

## D-024 · 2026-10-03 · stage 4 · by: assumed
Default planner is the dense qwen3:14b Q4_K_M at 16k context via `LLM_MODEL`; the 26B MoE (gemma4:26b-a4b) is an env value that is documented but not a tested configuration.
- why: SP-2 recommendation: meets every line at 10.9 GiB with 2 GiB free; the MoE leaves the card 96% full, 12-50 s cold loads and an 18 GB model.
- revisit if: the user's phrase listen or the live run favour the MoE.

## D-025 · 2026-10-03 · stage 4 · by: assumed
A `truncated` render is saved as a new version and becomes active like any other, but the dock shows it as a rust TRUNCATED warning, never DONE (Q-020).
- why: the audio is real and revertible; hiding it would lose the user's wait; the 330/360 s estimate should make it rare.
- instead of: discarding it, or saving it inactive.
- revisit if: stage 5 prefers a USE ANYWAY step.

## D-026 · 2026-10-03 · stage 4 · by: user
The MVP cut in scope.md is signed off as written: M0 = F-016..F-025 (SET TEMPO, REHARMONIZE, EDIT STYLE; headless CP1 before UI), WRITE PHRASE in M1, then M2–M4 as listed.
- instead of: WRITE PHRASE in M0, or a further cut.
- also: D-003's precondition is met: genQueue.ts is on origin/main (6426d5c) and genLock is gone, so R-007's "S4 unmerged" is stale.

## D-027 · 2026-10-03 · stage 5 · by: assumed
SCORE tab appended last; chip `BASE · WHOLE SCORE`; PLAN an acid-outline sibling beside the one filled APPLY & RENDER, which is off while its own render runs (Q-024; design/score-verb.html DT-3, DT-4).
- instead of: SCORE earlier in the strip, `WHOLE SONG` / `BASE v2 · WHOLE SCORE` chips, PLAN filled until a plan exists.
- revisit if: the user disagrees on seeing the mockup.

## D-028 · 2026-10-03 · stage 5 · by: assumed
A failed re-plan drops the dimmed old plan (Q-025; DT-5).
- instead of: keeping it with USE PREVIOUS PLAN. revisit if: users lose plans they wanted.

## D-029 · 2026-10-03 · stage 5 · by: assumed
Planning (not queued) wears the AI shader; DESIGN.md's shader list gets "planning" in the F-021 PR (Q-026). Rendering follows DESIGN's YuE2 rule: stage and share, no progress veil.
- instead of: a plain line while planning. revisit if: the shader reads as noise on a 3-10 s job.

## D-030 · 2026-10-03 · stage 5 · by: assumed
Q-015's clause is rust-body inside the consequence line, only while SCORE is open, worded "SCORE will be off for this song" until M3 (Q-027).
- instead of: Q-015's "will offer a new song instead" before that button exists. revisit if: M3 ships.

## D-031 · 2026-10-03 · stage 5 · by: assumed
EDIT STYLE always states "a request, not a guarantee" in the consequence line (Q-028).
- instead of: only when an instrument is named (scope.md line 158). revisit if: style-only plans read as over-hedged.

## D-032 · 2026-10-03 · stage 5 · by: user
The SCORE verb mockup (pipeline/design/score-verb.html) is signed off and is the spec for F-021..F-024. Picks: Q-022 / DT-1 A, the dock body grows with the plan (about 330 px for 3 ops, 390 px for 5); Q-023 / DT-2 C, SCORE's key is C. D-027..D-031 stand as recorded.
- instead of: cap and scroll, or folded checks; keys O or P.
- owed: measure the plan-ready dock height at 1366×768 and 1080p in the real app (R-006, inferred heights).

## D-033 · 2026-10-03 · stage 6 · by: assumed
CI gains a `checks.yml` (client build/lint/test, server tsc + test, yue-server pytest) in the W0 PR; proposed in architecture.md, not applied (shared file, another session's branch).
- why: stage 6 gate item 5; CI runs only e2e today (R-023).
- instead of: relying on local runs. revisit if: the user prefers a pre-commit hook.

## D-034 · 2026-10-03 · stage 6 · by: assumed
Server score code lives in `server/src/services/score/` (as `services/engines/` and `services/acestep/` do); the client stays flat.
- why: 15 modules of one area; CLAUDE.md's "flat" rule is about the client.

## D-035 · 2026-10-03 · stage 6 · by: assumed
Pending plans live in a `planStore` map, one per song, not on the Job record; a new PLAN replaces the song's plan; render, trash or restart drop it (refines D-020).
- why: the job registry evicts after 1 hour unread, which would expire a plan under review; "PLAN again replaces the plan" is per song.
- instead of: `job.scorePlan`. revisit if: users want several pending plans per song (M2 REVISE may).

## D-036 · 2026-10-03 · stage 6 · by: assumed
`pollEngine` / `stopEngineJob` move from engineGenJobs.ts to a shared `enginePoll.ts`; score renders and first takes use the same poll loop (one implementation).
- instead of: a second poll loop in scoreRenderJob.

## D-037 · 2026-10-03 · stage 6 · by: assumed
A score version is an ordinary `versions` row (no schema change); its `params_json` carries `score_v: 1`, the render request (style, lyrics, seed, cot), ops and song meta; `scoreSource.ts` is the one reader of a song's score/style/lyrics/seed, always from the active base version; versions.ts activate restores song bpm/key/meter from `meta`. Migration rule: additive = no bump; shape change = bump + both shapes read + a named test.
- instead of: a new score table or columns. revisit if: M2's section ops need lyric-tag history the params can't hold.

## D-038 · 2026-10-03 · stage 6 · by: assumed
For a score version the `.abc` sidecar is written before the version row, and a failed write fails the render (no version). First takes keep the best-effort write.
- why: a score version without its score breaks the next plan silently.

## D-039 · 2026-10-03 · stage 6 · by: assumed
Two scriptable fakes, `server/test-fakes/fakeOllama.ts` and `fakeYue.ts`, serve Vitest in M0 and are wrapped by e2e in M1; fakeYue's score-route replies are recorded by yue-server pytest (contract fixtures) so the fake cannot drift.
- instead of: hand-written canned replies (R-001's lesson: a fake that drifts passes CI and breaks on the real backend).

## D-040 · 2026-10-03 · stage 6 · by: assumed
CP1 runs through the Mulakai HTTP API on port 3201 with `DATA_DIR` = a throwaway copy of `server/data`; it never writes the user's live library. Evidence under `pipeline/evidence/CP1-<date>/`.

## D-041 · 2026-10-03 · stage 6 · by: assumed
`queueJob` gets an optional extra `onAbort`, so CANCEL on a running plan aborts the planner HTTP call at once; the plan body still unloads and confirms in `finally` before the slot is released.
- instead of: letting the call run out its timeout.

## D-042 · 2026-10-03 · stage 6 · by: assumed
yue-server serializes `count_tokens` with a lock (R-021).
- why: score routes count from request threads while the job thread may encode; HF fast tokenizers are not documented as safe for concurrent use (unverified).

## D-043 · 2026-10-03 · stage 6 · by: assumed
"No ACE-Step edits" (D-006) is computed as: every base-layer version's `params_json.engine` is `yue2`, plus one layer, `gen_task = 'text2music'`, a sidecar that passes `/v1/scores/read`, and chords present. A cover (`gen_task = 'cover'`) is ineligible with its reason (D-021).
- why: repaint/ACE-Step versions carry no `engine` (persistVersion, seen in code).

## D-044 · 2026-10-03 · stage 6 · by: assumed
Context skeleton (Q-030): CLAUDE.md drops `@AGENTS.md` for a pointer plus a ~10-line costly-rules digest; AGENTS.md is unchanged; area rules go to `.claude/rules/*.md` with `paths:`; four `docs/decisions/` records. Proposed in architecture.md, applied in W0 only after the user agrees.

## D-045 · 2026-10-03 · stage 6 · by: assumed
For CP1 and agent runs, the planner is a second `ollama serve` on 127.0.0.1:11435 with `OLLAMA_CONTEXT_LENGTH=16384` (Q-031), leaving the user's :11434 server untouched.

## D-046 · 2026-10-03 · stage 6 · by: user
D-044 and D-045 confirmed by the user: the context skeleton (CLAUDE.md keeps a pointer + costly-rules digest instead of `@AGENTS.md`, path-scoped `.claude/rules/`, docs/decisions records) lands as its own commit in the W0 docs PR; the score agent uses a second Ollama on :11435 with OLLAMA_CONTEXT_LENGTH=16384.
- consequence: stage 6's context-budget must-item is met when W0 merges; it is re-checked at the M0 verify.

## D-047 · 2026-10-03 · stage 7 · by: assumed
W1 (F-017) defaults in the yue-server score routes: (a) the style's `NNN bpm` follows the score's `Q:` after the ops: SET_TEMPO rewrites it or appends `, NNN bpm`; an EDIT_STYLE that names a bpm gets the score's bpm, one that names none is left alone (R-018); (b) REHARMONIZE keeps SP-2's limit of 16 bars per op; (c) `/v1/scores/read` answers 200 with `ok: false`, upstream's error and the per-bar unit sums for a score upstream refuses (eligibility needs the verdict, not an HTTP error), with `facts`, `seconds` and `tokens` null; `/v1/scores/apply` refuses an invalid base score with 422; (d) each op is tried on a copy, so a failed op leaves no trace and the other ops still apply; `ok` is true only when every op applied and the checks pass; (e) a plain `python -m pytest` fails when a contract fixture no longer matches the live route, so the fixtures cannot go stale silently.
- instead of: appending a bpm to every edited style (changes the style text YuE2 is conditioned on); a 422 from read; first-error-stops apply.

## D-048 · 2026-10-03 · stage 7 · by: assumed
F-017 #1 is checked against all 37 cases in SP-2's golden.json (10 library sidecars + 27 mutations); the criterion's "39 (10 + 29)" does not match the file golden.py wrote (Q-032).

