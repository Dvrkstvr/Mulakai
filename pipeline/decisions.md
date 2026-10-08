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


## D-049 · 2026-10-03 · stage 7 · by: assumed
W2a (F-018) eligibility defaults: (a) instrumental YuE2 takes (every lyric line a `[Tag]` or blank) are ineligible "This song is instrumental; not supported yet." (scope M0 line on instrumental, D-021); a cover reads "This song is a cover of another score; not supported yet."; (b) any base version without `engine: 'yue2'` (repaint, remaster, regenerate) gives the mockup's repaint line; (c) one reason per song, in the order layers, ACE-Step version, cover, instrumental, no sidecar, checker, chords; (d) YUE_API_URL unset is `hidden` like LLM_API_URL unset, and a failed `/v1/scores/read` is a fourth state `offline` ("Score checker unreachable: ... Start yue-server, then RECHECK."), never eligible; (e) yue-server is asked only when the DB alone cannot decide; (f) the commit re-check compares a fingerprint (layer ids | base version ids | active version id) taken at plan time, from the DB only, and refuses with "this song changed since the plan" (also for a trashed song).
- instead of: listing every reason at once; treating a yue-server outage as ineligible; comparing only the base version id (misses an added layer or a non-activated version).

## D-050 · 2026-10-03 · stage 7 · by: assumed
W2b (F-019, F-020) defaults: (a) M0's ops carry no section field, so "a section that does not exist" cannot be named: sections reach the planner as bar ranges and the schema bounds every bar to 1..N, which is the per-op bound the criterion tests (Q-033); (b) context guard: a prompt is cut when `usage.prompt_tokens` < chars/6, "needs about N" uses max(chars/3, prompt_tokens) + 2,500 rounded to 100, the context must hold prompt + 2,500, and a reply with no `usage.prompt_tokens` is refused (cannot rule out a cut); the preflight runs only when `/api/ps` already lists the model; (c) the probe (`/api/ps` 404 = not Ollama, model missing from `/api/tags`, server gone) runs before any planner call and a failed probe skips both the call and the unload; every other path unloads in `finally`, and an unload that is not confirmed in 10 s replaces the result (no plan is stored); (d) plan state is served by its own router `routes/scorePlan.ts` (`POST/GET /api/songs/:id/score/plan`), with the song's latest run kept in planStore, instead of `Job.planId` + `generateStatus` (fewer shared files while W2a builds `routes/score`); (e) one plan run per song at a time (409), and eligibility is re-read when the queued plan starts; (f) the queue row carries `label: 'score plan'` so the client's UP NEXT line has text before the client kind union learns `plan` (W3); (g) `LLM_TIMEOUT_MS` 180 s, temperature 0.3, `max_tokens` 2,000 (SP-2); `LLM_API_URL` may end in `/v1` (stripped); (h) `jobRunner` `onAbort` (D-041) is left to F-024: ABORT on a running plan stops it before its next attempt, then unloads.
- instead of: a section op field yue-server's strict route would reject; trusting HTTP 200; reusing `/api/generate/:jobId` for plan results.

## D-051 · 2026-10-03 · stage 7 (CP1) · by: assumed
CP1 run choices: (a) the log goes to `pipeline/cp1/` (CP1-LOG.md, `cp1-summary.json`, `nvidia-smi.csv`; raw logs that hold library style text under the gitignored `pipeline/cp1/raw/`), as the conductor's task said, not `pipeline/evidence/CP1-<date>/` (D-040's wording); (b) the songs are the three eligible 4/4 YuE2 songs, because the median-bar tempo check is 4/4 only; (c) per song: plan tempo → render → plan jazz on the new version → render, so every render follows a hand-off and the jazz render's base is the tempo render; (d) the render's edited ABC comes from re-applying the plan's ops through `/v1/scores/apply`, because the plan route does not serve the ABC (checked equal to the stored plan's style, seconds and tokens); (e) Q-034's default: chord adherence is reported three ways (root, chord tones, audio change vs the base render), and root agreement alone is not read as adherence.
- instead of: the D-040 folder name; all five songs; planning both requests on the original version.

## D-052 · 2026-10-03 · stage 7 (W3) · by: assumed
W3 (F-021, F-022, F-024) defaults: (a) `GET /api/songs/:id/score` lives in `routes/score.ts` and answers `{state, reason?, offline?: 'checker'|'planner', reading?, baseVersion?, versions?, style?}`; the Ollama probe runs only for an eligible song, and a failed probe is `offline: 'planner'` with the probe's text; (b) CANCEL is `POST /api/songs/:id/score/plan/cancel` on the plan router (queued: leaves the line; running: `abortJob`, whose new `queueJob` `onAbort` aborts the planner call, D-041), instead of architecture.md's `POST /api/score/jobs/:jobId/cancel`; (c) the review limits (`scoreLimits.ts`: ≥ 360 s with "at least N BPM fits", > 4,096 tokens, no change) are folded into every applied plan inside the retry loop (`withLimits`), so the planner hears the number and a plan that never fits ends in `check failed` with that line; 330–360 s is a rust checks segment on a plan that still renders; (d) a failed run carries `cause` (`check` | `offline` | `refused` | `cancelled`, from planJob's `PlanError`); an aborted plan's cause stays null while the unload holds the slot, so the dock reads `CANCELLING…` until the slot is free; (e) CHECK FAILED shows no "3 OF 3 ATTEMPTS" count (the run does not carry attempts); (f) "about N min" is the re-rendered song's estimated length (Q-035); (g) EDIT STYLE's row shows the tag diff (`+ jazz · − dark`), or the new style clipped to 80 characters when the style is prose or most tags change; (h) in W3, APPLY & RENDER only re-reads the server's plan and, if it is gone or replaced, refuses as stale "plan expired: the server restarted" (F-024 #4, starts nothing); W4 starts the render; a plan run that vanishes while polled ends as `check failed` with the same line; (i) a stale plan's line carries PLAN AGAIN, so the commit row drops the PLAN sibling there (mockup frame 14); ineligible and offline show only their line (frames 2, 3).
- instead of: a separate cancel router keyed by job id; enforcing the limits only at review time (the planner would never hear them); a client-side error-text classifier.

## D-053 · 2026-10-03 · stage 7 (W4) · by: assumed
W4 (F-023) defaults: (a) the render route is architecture.md's `POST /api/songs/:id/score/render {planId}` on its own router `routes/scoreRender.ts` (with `GET …/score/render` for the dock's poll and `POST …/score/render/cancel`), not `…/plan/apply`; a click-time refusal is 409 `{error, stale: true}`; a second render while one is in flight or a full queue is a plain 409; (b) re-check order: eligibility (full `scoreStatus`), plan alive (the fingerprint lives on the plan, so this precedes it), base version unchanged (`recheckAtCommit`, as `recheckForRender`), an edit queued or running on the song (click time only: "a repaint 1:32–2:07 was queued after this plan"), stored seed and lyrics present, `/api/ps` empty; any `/api/ps` error also refuses ("can't confirm the planner let go of the GPU"); the same check runs again when the queued render's turn comes, and a refusal then fails the job with `cause: 'refused'` and no engine call; (c) style = the plan's style (yue-server's apply already rewrote its bpm, D-047), lyrics and seed from the active base version, no `cfg_scale`; (d) the sidecar is the score the engine returned, else the plan's edited score; `params_json` adds `output` (copied from the planned-against version), `meta.duration` and `truncated: true` (additive, score_v stays 1); the song's `duration` follows the render too; (e) revert: a score version restores bpm/key/meter/duration from `meta`; a YuE2 first take restores them from its own sidecar header and audio, but only on a layer that has a score version, so a song never score-edited keeps the user's own meta; (f) render runs live in `planStore` (`noteRender`/`lastRender`), the plan is dropped only on a saved render; (g) refusal texts sit in `scoreLimits.ts` beside the plan limits (score-server rule); (h) the queue kind `scoreRender` is added to the client's kind union with Activity labels (`RENDERING SCORE`, `SCORE RENDER`, `RE-RENDERED THE SCORE`), plain row (no shader in Activity, DESIGN.md lists none for it); (i) after done the Editor reloads the song through `useScoreVerb`'s `onSaved`; the done line is the lilac `Saved base v3 · 88 BPM, 3:04` without a separate badge.
- instead of: one combined plan/render router; trusting a down Ollama as "nothing loaded"; restoring first-take meta on every activate.

## D-054 · 2026-10-05 · stage 8 (M0 code review) · by: assumed
M0 code review triage (pipeline/reviews/M0-code.md): fix 1–3 before merging #127/#128. (1) deleting the active version restores song meta through the activate path's helper (D-053(e) rules); (2) D-053(b) holds (an `/api/ps` error or a loaded model still refuses the render), but those two GPU refusals answer 409 without `stale: true`, so the dock shows a render error with retry instead of "PLAN OUT OF DATE" for a valid plan; (3) queue kind `plan` joins the client's kind union and Activity labels (fix on W3, cherry-picked to W4). Findings 4–7 are deferred as Q-038.
- instead of: trusting a down Ollama as "nothing loaded" (rejected, GPU invariant); fixing the nits in M0 (scope creep before the listen).

## D-055 · 2026-10-05 · stage 7 (M0 exit) · by: user
The M0 A/B listen (pipeline/verify/M0/ab-answers.json) heard tempo as expected 4/4 but the chord edit only 2/4, under R-013's bar of 4 of 5. Every plan kept the old roots (Q-034). The user chose to fix it in M0 and reverse D-051 to Q-034 option B. (1) The planner rule says a reharmonization changes the harmony: at least one chord root per 2 bars of the op differs from the old chord there, not only added 7ths or inversions. (2) yue-server checks the same thing (it is the only ABC reader) and sends numeric retry feedback, e.g. "REHARMONIZE 14-21 keeps the old root in 8 of 8 bars". (3) Then re-plan and re-render 5 pairs (chords only, no tempo change) and the user does a chords-only listen; F-025 passes on ≥ 4 of 5 heard.
- assumed with it: a request like "add sevenths, keep the chords" is not a REHARMONIZE and may fail after 3 attempts; the refusal says why.
- instead of: passing M0 and fixing in M1; narrowing the promise to "chords are a request, not a guarantee"; option C (refusing a slash bass outside the chord), which stays open.

## D-056 · 2026-10-05 · stage 7 (M1 start) · by: assumed (autopilot)
M1 runs as W6 (F-027), W7 + W8 (F-026 split at the yue-server route contract), W9 (F-028), then CP2 live and the verifier (scope.md M1 work packages). Q-038's nits are decided as a small fix PR W10 after W8, if the round budget allows; otherwise they stay deferred to M2. Batch 1 (W6, W7, W9) runs in parallel worktrees branched from origin/main; the pipeline/ state stays on `docs/m0-done`.
- instead of: one M1 branch (M0 shipped one PR per work package, which reviewed and merged cleanly); rejecting the nits now.

## D-057 · 2026-10-05 · stage 7 (M1/W7) · by: assumed (W7 builder, recorded by the conductor)
WRITE_PHRASE on yue-server (contract in yue-server/README.md): (1) a score without an Ins voice cannot reach the applier: upstream rejects a score without both voice lines and the apply route already answers 422; (2) "four identical bars" refuses one bar written 4 or more times anywhere in the phrase (SP-2 refused any all-identical phrase, even 2-3 bars; the spec wins); (3) a note no single allowed length holds is written as tied pieces, a tie running into the phrase from the bar before is undone, and no tie crosses phrase bars; (4) inline [K:] events in a replaced Ins bar are kept; (5) SP-2's pitch-range gate (C3-E6) is left out, not in the spec. Plus a seam check: a note after the phrase that would change pitch once the incoming tie is cut is flagged in checks.problems.
- instead of: SP-2's all-identical rule and range gate. Reversal cost: one gate each in score_phrase_gates.py plus a pytest.

## D-058 · 2026-10-05 · stage 7 (M1/W6) · by: assumed (W6 builder, recorded by the conductor)
F-027's clause (D-030 wording) shows on REPAINT, ADD LAYER and the stem claim line (REPLACE / ADD LAYER from a split; that is "extract to layer", SPLIT itself saves nothing), not on REMASTER MIX, which keeps no version (Q-039). SCORE counts as open unless it is hidden or ineligible, so an offline checker still shows the clause.
- instead of: the criterion's literal list including REMASTER MIX. Reversal cost: one prop.

## D-059 · 2026-10-05 · stage 7 (M1/W8) · by: assumed (W8 builder, recorded by the conductor)
WRITE PHRASE on the server and in the dock: (a) N comes from a count attached to a phrase word (phrase, line, solo, riff, lick, fill, melody, motif, hook, break), before or after it ("4-bar sax phrase", "a sax phrase of 6 bars"); no such count → 4; cap 8; a bare place ("the last 8 bars") is not a count; (b) WRITE_PHRASE is always in the schema, the prompt says to use it only when asked; (c) withLimits no longer adds "this request did not change the score or the style" when an op was refused (the refusal says why); (d) the beats enum stays exactly yue-server's even when the score's L: unit cannot hold 0.5 beats: yue-server refuses that note and the planner retries.
- instead of: asking the planner for N; a schema per request with or without the op. Reversal cost: phraseRequest.ts and its test. Risk: wordings like "a sax bit for 2 bars" get 4 bars; CP2 watches prompt tokens (prompt +15 lines).

## D-060 · 2026-10-05 · stage 7 (M1/CP2) · by: assumed (autopilot)
Q-040 default: the SCORE review lists each earlier refused attempt's reason in one line, so a phrase moved off the asked bars (or a tempo raised to fit 360 s, Q-036) is never silent; the WRITE PHRASE consequence clause says the phrase replaces the instrument part in its bars. Built on W8 before its PR. Q-036 closes with it.
- instead of: refusing a plan whose bars differ from the request's (needs request parsing of bar numbers; the planner already sees the refusal).
- with it (W8 follow-up builder): each WRITE PHRASE in a mixed plan gets its own clause, harmony and style keep the joined "are a request" clause; a refused-attempt line shows at most 2 reasons then "and n more", in rust; only a passing plan carries refusals (CHECK FAILED still shows the last attempt's reasons).

## D-061 · 2026-10-05 · stage 8 (M1 code review) · by: assumed (autopilot)
M1 code review (pipeline/reviews/M1-code.md): 0 blocking, 1 should, 3 nit. Fix #1 now (an in-bar accidental carries onto the next plain letter, so WRITE PHRASE can sound F# where the planner wrote the key's F) on fix/score-phrase-accidentals, test-first; defer #2-#4 as Q-041 next to Q-038 (W10).
- instead of: shipping M1 with the pitch bug (the user's phrase listen would judge wrong notes).

## D-062 · 2026-10-05 · stage 7 (M2 start) · by: assumed (autopilot)
M2 runs as W11 (TRANSPOSE, yue-server), W12 (REPEAT / CUT / REWRITE LYRICS + the tag rule, yue-server), a stage 5 mockup for the M2 dock
UI (Q-029), then W13 server, W14 client, W15 referent + REVISE, CP3 live, the verifier (scope.md M2 work packages). One PR per work
package from origin/main, as M0 and M1. Pipeline state on `docs/m2-state`. W10 (Q-038/Q-041 nits) stays deferred unless rounds remain.
- instead of: one M2 branch; building the dock UI before the mockup (design-first for the dock).

## D-063 · 2026-10-05 · stage 7 (M2 start) · by: assumed (autopilot)
A failed REVISE keeps the previous plan available (F-033 edge, signed-off scope D-026); D-028 (a failed re-plan drops the dimmed old
plan) stays for a fresh PLAN from the base.
- instead of: D-028 for both. revisit if: the mockup shows the two paths confuse.


## D-064 · 2026-10-05 · stage 7 (M2/W11) · by: assumed (W11 builder, recorded by the conductor)
TRANSPOSE on yue-server: (a) it runs after the other ops whatever its list position, once per plan; other ops are written in the old key the bar map shows (the planner is told so in W13); (b) a key named in the style is set to the score's new key, like SET_TEMPO's bpm (style "F minor" on a Dm score at -2 becomes "C minor"); (c) n=0 is a verdict refusal, |n| >= 12 and non-integers are a 422 from the schema; (d) its own fewest-marks speller, not score_phrase.spell_bar (which keeps every accidental it is given). The "leaves the 30-key table" refusal cannot fire (every tonic has both names upstream); the ±11 bound is what enforces F-029 #3. The REHARMONIZE stray-chord check now compares by pitch class (an enharmonic respelling passes).
- instead of: list order with the planner writing later chords in the new key; shifting the style's own key by n; 422 for 0.

## D-065 · 2026-10-05 · stage 5 (M2) · by: assumed (autopilot; user may overrule at sign-off)
The M2 dock mockup pipeline/design/score-m2.html (M2-1..M2-9) is the spec for F-029..F-033's UI, on its defaults for Q-042..Q-049: REVISE is a second outline button beside PLAN; a stale referent is a rejected row with USE BARS, never remapped; the referent is pinned when PLAN is pressed. No choice in it is blocking (each reverses in under a day of client work), so W14/W15 build on it; Q-042 and Q-043 are the two put to the user.
- instead of: waiting for sign-off before any M2 client code. owed: the dock height at 1366×768 for frame 10 (inferred ~500 px, R-006).


## D-066 · 2026-10-05 · stage 7 (M2/W12) · by: assumed (W12 builder, recorded by the conductor)
REPEAT / CUT / REWRITE_LYRICS on yue-server: (a) `REPEAT|CUT {section, label}` address the bar map's `S<n>` index, the label a cross-check; (b) numbers always mean the score and lyrics as read: bar ops first in plan order, then REWRITE_LYRICS, then section ops last section to first; verdicts stay in plan order; (c) ties undone on both sides of a REPEAT, CUT un-ties the bar before the cut, a meter/key the section changes is restated after the seam; (d) the k-th section of a kind sings the k-th block of that kind (kind = the tag's first word); a section with no block keeps the lyrics, an extra block stays put; the verdict's `note` names the case (F-030 #3); (e) after a section op every matched tag is rewritten by the instrumental rule ("[Verse 1]" → "[Verse]", "[Intro - Acoustic Guitar]" → "[Intro]"); (f) REPEAT/CUT refuse without `lyrics` ("" counts); (g) seconds per section only in the apply reply's `sections` (edited numbering); (h) an un-tie that changes a note's pitch is reported in checks.problems, not respelled; (i) repeating a section twice is allowed, repeat + cut of one section refused.
- instead of: label + occurrence; strict sequential order; tag-only blocks invented for sections without one; keeping tag descriptors. revisit if: CP3's listen hears the lost descriptors (e) — owed with the F-030 live check.

## D-067 · 2026-10-05 · stage 7 (M2/W13) · by: assumed (W13 builder, recorded by the conductor)
Server half of the M2 ops: (a) stored lyrics go to every apply (key left out when none); (b) the plan view leaves out the full edited lyrics, the dock reads verdict `note` / `diff`; (c) the cut hint fires only for an applied REPEAT, picks the smallest single section (never the repeated one or its copies), and is silent when the read-to-edited numbering does not line up; text: "estimated 367 s: over the 360 s limit; cut the outro 0:11 to fit (section 4), or at least 68 BPM fits"; (d) 0 semitones, a label mismatch and a line-count mismatch stay yue-server refusals (retried); `tag` is an enum of the song's tags; (e) NO_CHANGE reads "this request did not change the score, the style or the lyrics"; (f) songs.lyrics follows a new score version on save, as activate does; (g) labels "TRANSPOSE -2 · REPEAT chorus S3 · CUT outro S4 · REWRITE LYRICS [Chorus] #2". Prompt +1,019 chars on the 206-bar song (estimated 4.5-4.7k tokens, measured at CP3).
- instead of: lyrics only with section/lyric ops; full lyrics in the view; cutting the copy or pairs; local checks for the refusals.

## D-068 · 2026-10-05 · stage 7 (M2/W15) · by: assumed (autopilot)
REVISE (F-033) = the planner gets the request, the pending plan's ops and their verdicts/notes, and returns a complete replacement plan applied to the base as read (D-066 b numbering holds; no plan-on-plan numbering); the change list marks each op NEW / CHANGED / SAME against the pending plan (mockup frame 7). F-033 #1 "made against the first plan's result" is met by the planner seeing that result's ops, not by re-reading an edited score.
- instead of: applying the second plan to the first plan's edited score (bar and section numbers would shift under the user's selection and the bar map). revisit if: CP3 shows the planner drops ops it was told to keep.

## D-069 · 2026-10-05 · stage 7 (M2/W14) · by: assumed (W14 builder, recorded by the conductor)
Dock rows for the M2 ops: (a) REPEAT / CUT rows show label + S-number without bars or seconds, REWRITE LYRICS omits "of 3" / bars, because PlanView carries no read sections or block counts (W15c adds them if W15s puts sections in the view); (b) the client derives the new key name itself (keyAfter, fewest accidentals, mirrors yue-server new_key); (c) FILL appends ", cut the outro" to the request (no-op if present); (d) the hint renders only when the limit line names a section; (e) the new-words clause is plain, not bold.
- instead of: the server sending bars, block counts and the new key; FILL replacing the request. revisit if: review finds keyAfter drifting from yue-server (a second key speller is the Q-041 #3 drift shape).

## D-070 · 2026-10-05 · stage 7 (M2/W15s) · by: assumed (W15s builder, recorded by the conductor)
Referent and REVISE on the server: (a) a stale pick is a 409 `{error, stale}` before queueing (and `run.stale` if it goes stale by the job's turn; the planner is never asked), not a plan with a rejected row; the client draws the rejected row and USE BARS from `stale.now`; (b) a pick carries an optional `of` (how many of that label existed) so a moved pick is found counting from the end (USE BARS 37–44 after a REPEAT of chorus 1); (c) a REVISE without a referent plans the whole song: the client re-sends plan.referent to keep it pinned (M2-3); (d) marks: SAME = equal op; CHANGED = same target (whole-song ops by kind, REHARMONIZE range, WRITE_PHRASE start, REPEAT/CUT section, REWRITE_LYRICS block) or same kind over overlapping bars; else NEW; removed ops listed; (e) a failed, cancelled or refused REVISE keeps the plan (D-063), any failed PLAN drops it (D-028); (f) REVISE refusal texts live in planRevise.ts. Note: a CUT of the picked section itself, with `of`, names the same-label section before it.
- instead of: planning anyway with a rejected row; label + occurrence from the start; the server inheriting the referent.

## D-071 · 2026-10-05 · stage 7 (M2/W15c) · by: assumed (W15c builder, recorded by the conductor)
Dock pick and REVISE: (a) section picks read the score's sections from GET /score (added in the W15 follow-up; inert before it); (b) a line pick resolves its block from the server's blocks (follow-up; the client's own block counter goes, D-0002); (c) a stale pick is a client-drawn THIS rejected row; the phase stays asking, or plan 1 is kept for a REVISE; (d) a REVISE that fails for any reason (check, offline, refused) keeps plan 1 with a REVISE FAILED line; (e) a line pick shows no bars until the plan pins it; (f) REVISE stays shown but off while revising; (g) the dropped-plan line says "the plan under review".
- instead of: PLANNER OFFLINE for an offline REVISE; client-side bars for a line pick; a plan view carrying the rejected op.

## D-072 · 2026-10-05 · stage 7 (M2/W15 follow-up) · by: assumed (builder, recorded by the conductor)
GET /score sends `sections [{index, label, occurrence, from_bar, to_bar}]` and `blocks [{index, tag, occurrence, lines, first_line}]` straight from yue-server's read facts (no per-section seconds: the read has none). A line pick is matched by tag-row order and checked against tag, first line (50 chars) and line count; no client block counter, no fallback; an unmatched line is a rust "not in the score" pick that holds PLAN. The e2e has no UI pick step: the score stack has no lyric timings (YuE2 stores lyricTimestamps null, LYRICS_API_URL empty), so the strip is empty there — CP3 must check the strip on a real YuE2 song.
- instead of: matching by tag kind + occurrence (a client copy of kindOf); a silent no-op for an unmatched line.

## D-073 · 2026-10-05 · stage 7 (M2/CP3) · by: assumed (autopilot)
Q-050 option (b), reversing D-068's "complete replacement": a REVISE reply is `{drop: [pending op numbers], ops: [...]}`: the planner returns only what changes plus the pending ops to drop, and code merges it into the pending plan (a returned op with the same target as a pending one replaces it, CHANGED; the rest of the pending ops stay, SAME; drops are listed REMOVED). The merged plan is applied to the base as read, as before. Fixed on W15 before #141 merges, then a short live re-check of the additive and "fewer chords" revisions.
- instead of: (a) shipping with the loss shown under REMOVED (CP3: 4 of 4 additive revisions lost every other op, F-033's intent); (c) restating the ops in the prompt (the planner already saw them).

## D-074 · 2026-10-05 · stage 7 (M2/CP3) · by: assumed (autopilot)
Q-051, first half: the SCORE pick hint ("click a section or a lyric line") shows only when the dock has something to pick (a strip section or a timed lyric line); otherwise no hint. A strip cut from the score's sections for YuE2 songs (so a section with no lyric block, or a song without lyric timings, can be picked) is deferred to M4 with the bar map (F-036), Q-051 stays open for it.
- instead of: building the score-section strip now (a new client view; M2's F-032 criteria pass with the lyrics-read strip).

## D-075 · 2026-10-05 · stage 8 (M2 code review) · by: assumed (autopilot)
M2 code review (pipeline/reviews/M2-code.md): 0 blocking, 2 should, 3 nit. Fix now on W15 with the D-073 builder: should #1 (checks.bars shows the base's bar count under a REPEAT/CUT plan), should #2 (a strip/line click under SCORE is swallowed in states that cannot take a pick), nit #2 (MAX_OPS pinned against yue-server; a REVISE merge past 6 ops is a named refusal, not a 422 shown as PLANNER OFFLINE). Defer nit #1 (a line pick keeps its old words after a REWRITE LYRICS render) and nit #3 (the section-to-block pairing rule in three places, no cross-test) as Q-052, with Q-038/Q-041 (W10).
- instead of: shipping with "77 bars" under a plan that adds 8 (the verifier saw it live).

## D-076 · 2026-10-05 · stage 7 (M2/W15 fix, D-073/D-074/D-075) · by: assumed (W15 fix builder)
Details the D-073 merge and the D-074/D-075 fixes: (a) a returned op that equals the pending op on its target is marked SAME, not CHANGED; (b) one returned op replaces only the first kept pending op on its target, other kept pending ops on that target (two overlapping REHARMONIZEs) are removed and listed REMOVED, and a second returned op on an already-replaced target is appended NEW; (c) a returned op on a dropped op's target is NEW (the dropped one REMOVED); (d) REPEAT and CUT of one section are different targets (D-070 d), so "cut it instead" needs the REPEAT in drop, else yue-server refuses both and the retry says so; (e) refusals fed back like NO_CHANGE: an empty reply ("the revision changed nothing ..."), a merge that leaves no op, a merge over MAX_OPS ("the revised plan has 7 ops; at most 6: drop pending ops or return fewer"); a reply that only echoes pending ops unchanged is not refused (all SAME, as CP3 saw); (f) a retry's feedback starts with a legend of how the reply was merged ("op 2 = your op 1 (replaces pending op 3) ..."), since yue-server's reasons number the merged ops; (g) the strict schema's drop carries `uniqueItems` (Ollama's grammar converter is expected to ignore it, unverified; code checks duplicates anyway); (h) checks.bars = the edited score's last section `to_bar` from the apply reply (section_ranges covers every bar), the read's bars when the edited score did not parse, no yue-server change; (i) D-074's "something to pick" = a strip section or a lane line with a time; a dragged range under SCORE keeps its "range is ignored" hint; (j) SCORE takes a pick only with the read's sections known and the song not ineligible (should #2).
- instead of: marking every replacement CHANGED; refusing an all-echo reply as "changed nothing" (D-073 names only the empty reply; open for the live re-check); REPEAT/CUT as one target; adding `bars` to yue-server's apply reply (re-recording every contract fixture).

## D-077 · 2026-10-05 · stage 7 (M2 listen) · by: user (answers), recorded by the conductor
M2 A/B listen (pipeline/verify/M2/listen/answers.json): p1 transpose — same tune a tone lower yes, sounds natural yes, speed "a bit different" (measured 95.2 vs Q95, so heard, not timed); p3 rewritten chorus — new words heard clearly, fit the melody, rest of the song "a bit different" ("A more melancholic, B a bit more energetic": a whole-song YuE2 re-render, as the review line says); p4 repeat on Gertar — copy like the first chorus yes, seam 1 smooth, seam 2 audible; p2 (Romantica repeat) not judged ("?"). F-029..F-031 stand. Seam 2 (copy into the next section) audible once in one judged pair → Q-053.
- owed: p2 if the user wants it judged.

## D-078 · 2026-10-05 · stage 7 (M2 REVISE re-check) · by: assumed (conductor; the user asked to merge the rest)
REVISE re-check on 0629e20 (pipeline/verify/M2/revise/revise-recheck.md, 27 presses, 4 songs, qwen3:14b): additive revisions keep every pending op when 2+ are pending (7/7), drops work (4/4), each press unloads once (27/27), failed presses keep the plan (3/3). Still failing: an additive request on a 1-op plan drops that op (0/8, shown under REMOVED, never silent), "fewer chords" never shortens the chord list (0/4; shown as REMOVED + NEW), and a 6-op plan cannot grow (named refusal, plan kept). F-033's criteria hold; #141 merges with Q-050 kept open for those three cases (a retry line "keep the pending op unless the request removes it" is the first thing to try).
- instead of: holding M2 for a prompt iteration with no measured fix.

## D-079 · 2026-10-05 · direction (after M2) · by: user
The chat is to be the default way to create and edit songs: describe a song, or analyze an existing/reference song, go from nothing or the reference to the first generation, then iterate on the song progressively by talking with the LLM. The direct tools (verbs, prompts, repaint, add layer, SCORE) stay as the "scalpel" for specific edits. Training ACE-Step to YuE2's quality was raised and is not the path (conductor's advice: a dataset- and GPU-scale project; LoRA teaches style, not overall quality; LoRA stays post-1.0).
- consequence: a core-promise change (brief "generate → repaint → layer → version → export" becomes "talk a song into being, scalpel when needed"); needs a dated PLAN.md section and a scope pass before code (Q-054). The keep-unchanged-parts spike (SP-4) comes first, because a chat that re-rolls the whole song on every turn does not converge.

## D-080 · 2026-10-06 · stage 3 (SP-4) · by: assumed (conductor), pending the user's listen
SP-4 machine verdicts (pipeline/spikes/SP-4-keep-unchanged/RESULT.md): the chat's default for local edits is A3, render then splice the changed bars back (groove-snapped downbeat cut, 1-beat equal-power crossfade, level-matched span); REPEAT/CUT become audio-only edits (C) with no YuE2 render; no ACE-Step seam healing (B disproven); D (YuE2 forced prefix) only if the listen finds the A3 joins. The PLAN.md chat draft's decision 6 now says so. Settled by the user's 20-pair listen (spikes/SP-4-keep-unchanged/listen); the cut points inside sung words (15 of 36) are the first thing to listen for.
- instead of: whole-song re-renders for every turn (21-87% of untouched bars move > 1 dB today).

## D-081 · 2026-10-06 · stage 1/4 (chat, Q-054 #2) · by: user
The chat keeps one thread per song: stored in the database, survives reloads, deleted with the song; reopening a song continues its conversation (PLAN.md chat draft, decision 4).
- instead of: per-session memory; one global thread.

## D-082 · 2026-10-06 · stage 1/4 (chat, Q-054 #4) · by: user
When a request is unclear the assistant proposes with its assumption stated ("assuming the second chorus") and asks only when it cannot propose anything.
- instead of: asking before proposing; a follow-up question on every proposal.

## D-083 · 2026-10-06 · stage 1/4 (chat, Q-054 #5) · by: user
The assistant may propose ACE-Step instead of YuE2 for a first take when a request fits it better. Consequence: such a song is not score-eligible (D-006), so its later turns use the scalpel actions (repaint, add layer, split) and the SP-4 splice does not apply; the recipe card names the engine and says so in its consequence line. YuE2 stays the default (D-015).
- instead of: YuE2 always; asking each time.

## D-084 · 2026-10-06 · stage 1/4 (chat, Q-054 #3) · by: user
A reference song's audio is kept with the song as its source after the analysis (re-analyze or A/B against it later); it stays on this machine.
- instead of: deleting it after the analysis; referencing library songs only.

## D-085 · 2026-10-06 · stage 1/4 (chat, Q-054 #6) · by: user
Tempo and key edits offer both per turn: RE-RENDER (whole-song YuE2 render, the consequence line says the whole song changes) and SHIFT/STRETCH (pitch-shift / time-stretch of the current take, same performance). SHIFT/STRETCH is built only if a spike passes (SP-6, scheduled before C2's tempo/key turns); until then the card offers RE-RENDER alone.
- instead of: re-render only; waiting on the spike before any tempo/key turn.

## D-086 · 2026-10-06 · stage 5 (chat, Q-054 #1) · by: user
Two ways in, over one shared draft (the user, on seeing design/chat-create.html: "a chat where the form is only optional as the side bar or something (chat first, llm will do almost all of the editing). the form where the chat is like an assistant who will help and fill in the form"):
1. **Chat-first** (the default, D-079): the conversation is the main surface; the form is an optional, collapsible sidebar showing the fields the LLM fills; the LLM does almost all of the editing.
2. **Form-first**: today's Guided Create form is the main surface; the chat is a side assistant that helps and fills in the form's fields.
Both write the same draft, so switching keeps everything; CREATE SONG / GENERATE commits from either. Assumed (conductor): chat-first is the start screen (D-079); the same pairing for editing an existing song (the conversation beside the Editor's dock) is the next question, Q-055.
- instead of: A (chat with a FORM tab), B (chat only), C (form inside the chat).

## D-087 · 2026-10-06 · stage 5 (chat mockup) · by: assumed (conductor), the owner may overrule on the mockup
design/chat-create.html (CH-1..CH-10) is the layout spec for D-086 on these defaults: CREATE SONG and its consequence line live on the proposal card only (CH-2); sidebar 360 px, open on first use then remembered, a 38 px rail when collapsed (CH-3); "just filled" = sky wash + ASSISTANT tag + the old value struck, cleared on the next message or a hand edit (CH-4); UNDO TURN (CH-5); fields stay editable during a turn and the assistant skips touched fields (CH-6, Q-057); the form-first assistant panel is 300 px and never commits (CH-7); the fallbacks of Q-058 (CH-8); editing mirrors creating (CH-9, Q-055 default); Library CREATE opens the remembered mode (CH-10, Q-056).
- instead of: commit on the sidebar foot or in both places; locking fields during a turn; expanding the sidebar in place when the assistant is off.

## D-088 · 2026-10-06 · stage 5 (chat, Q-055) · by: user
Editing mirrors creating: chat-first (the song's thread, versions and the dock as the sidebar) and Editor-first (today's Editor with the chat as a side assistant that fills the dock's verbs). The chat-create.html layout is signed off ("layout is awesome").

## D-089 · 2026-10-06 · stage 5 (chat) · by: user
"Always have the latest version of the song playable": the chat view keeps a player for the song's active version in view at all times; a new version replaces it the moment it is saved.
And "always analyze the song so lyrics, abc and sections are up to date": every new version (first take, score edit, splice, repaint, add layer, any engine) is analyzed after it is saved: word timings (lyrics-server), a score with sections (YuE2's own score when YuE2 made the version, otherwise yue-server's transcriber), so the thread's song-state block, the section strip and the marking (D-090) always match what plays. Consequences in Q-062.

## D-090 · 2026-10-06 · stage 5 (chat) · by: user
The user marks a part of the song as context for the chat, like in the Editor: click a section (e.g. the chorus) to mark it, drag to extend it a bit; the chat turn gets the marked range as data alongside the prompt (bars, seconds, the sections and lyric lines it covers). Extends F-032's referent (section / lyric line) with a free bar range that may cross a section boundary.

## D-091 · 2026-10-06 · stage 5 (chat mockup 2) · by: assumed (conductor), the owner may overrule on the mockup
design/chat-song.html (CS-1..CS-11) is the spec for D-089/D-090 on the Q-063..Q-069 defaults: the player pinned at the top of the main column, in view with the sidebar collapsed; a new version swaps in place keeping position and play state, BACK TO v3 is an A/B and USE v3 activates; analysis failed → hatched strip, reason + RETRY, marking by raw time; an ACE-Step version gets a transcribed score for context and marking only (Q-062 b); marks snap to bars; the mark is sticky with a frozen echo on each sent message; "what the assistant sees" disclosure on the chip; Editor-first uses the Editor's own (unsnapped) selection; a stale mark is never remapped silently and holds SEND.
- instead of: the player above the composer; resetting play on a new version; a one-shot mark cleared after sending.

## D-092 · 2026-10-06 · stage 5 (chat mockup 2) · by: user
design/chat-song.html is signed off except the lyrics ("everything else looks great as is"). Player: "either pinned at the top or above the composer" — both acceptable to the owner; the full chat mockup (design/chat-lyrics.html) draws the final layout with A (top) as the default unless that page shows C reads better. Lyrics as a small chip text "are looking a little confusing": a new mockup compares lyric approaches in the fully designed chat (Q-071).

## D-093 · 2026-10-06 · stage 5 (chat, Q-071) · by: user
Lyrics live in a sheet in the sidebar. No active playback of lyrics (no current-line follow or karaoke). The sheet shows only the lyrics of the selected (marked) section, to reduce clutter. Assumed (conductor, Q-072): with no mark the panel lists the section names with line counts, click one to mark it; a mark across two sections shows both parts with a divider.
- instead of: a lyric lane under the waveform, a WAVE | LYRICS toggle in the player, lyrics inside the thread only, or the whole sheet always.

## D-094 · 2026-10-06 · stage 5 (chat mockup 3) · by: assumed (conductor), the owner may overrule on the mockup
design/chat-lyrics.html (LY-1..LY-6) is the spec for D-093: the sidebar lyrics panel with no mark lists sections (name, bars, line count, first line; click marks), with a mark shows that part only (a two-section mark with a dashed break and "n more lines not marked"), dims while a new version is read, shows a rust RETRY on a failed read; Q-073..Q-076 defaults. Player A (top) stays. DESIGN.md gets a clause for the panel in the chat's first UI PR.

## D-095 · 2026-10-06 · stage 5 (chat design sign-off) · by: user
The chat design is signed off with two changes: the player sits above the composer (design/chat-lyrics.html frame 3, not frame 1); the chat's send control must not resemble play/pause, so it is the outline text button `SEND ↵` (all three chat mockups updated). The specs are design/chat-create.html, chat-song.html and chat-lyrics.html, with D-086..D-094 as recorded, Q-063 closed (C).
- instead of: the player pinned at the top; an acid hexagon ▶ send next to the player's ❚❚.

## D-096 · 2026-10-06 · stage 1/4 (chat) · by: user
The PLAN.md section "Chat: Talk a Song Into Being" is signed off now ("sign off now and start scoping"), with decision 6 (how an edit turn renders) pending the owner's SP-4 listen. The Grand Goal and brief.md's core promise carry a pointer to it. Scope (stage 4) starts for C0..C4.
- instead of: signing off after the SP-4 listen.

## D-097 · 2026-10-06 · stage 4 (chat scope) · by: assumed (scope-cutter), signed off with the cut (D-103)
SP-5's pass bars as listed under Preconditions, and its ladder. Reversal: re-read the numbers.

## D-098 · 2026-10-06 · stage 4 (chat scope) · by: assumed (scope-cutter), signed off with the cut (D-103)
the C0 cut as above (4 actions, one spliced edit kind, no mark, no analyze, no panel). Reversal: each is a later milestone already; moving one into C0 costs its milestone's share.

## D-099 · 2026-10-06 · stage 4 (chat scope) · by: user
CHAT is the start screen from C0 (the owner reversed the cut's proposal to wait for C6), when `LLM_API_URL` and `YUE_API_URL` are set; otherwise the app opens on the Library as today, so the golden-path e2e does not move. The Library stays one click away and gets OPEN CHAT on a song.
- instead of: a TALK A SONG button in the Library until C6.

## D-100 · 2026-10-06 · stage 4 (chat scope) · by: assumed (scope-cutter), signed off with the cut (D-103)
an `edit` turn runs the existing plan call inside the turn's queue slot (one hand-off); architecture may prefer two jobs.

## D-101 · 2026-10-06 · stage 4 (chat scope) · by: assumed (scope-cutter), signed off with the cut (D-103)
when the join cannot be aligned the whole-song re-render is saved as the version and labelled; the alternative (save nothing, offer the render as a button) loses GPU minutes.

## D-102 · 2026-10-06 · stage 4 (chat scope) · by: assumed (scope-cutter), signed off with the cut (D-103)
thread lifecycle follows the song: kept through trash and restore, deleted at permanent delete; a reference file is stored as a copy with the song (C3).

## D-103 · 2026-10-06 · stage 4 (chat scope) · by: user
The chat cut is signed off: preconditions (SP-5, the SP-4 listen, R-025, SP-6), C0..C8, F-040..F-081, with D-097, D-098 (in C0 only a REHARMONIZE plan is spliced; every other edit re-renders the whole song and says so until C4), D-099 (CHAT is the start screen from C0), D-100..D-102. Next: SP-5.

## D-104 · 2026-10-06 · stage 6/7 (chat C0) · by: user
"Getting the chat working quickly": C0's architecture starts now, in parallel with SP-5 (small rework risk if SP-5 needs its fallback ladder), and C0 ships in two halves: **C0a create-first** (CHAT start screen, describe → recipe card + sidebar → CREATE SONG on YuE2 → song card and player above the composer, the thread kept), then **C0b** (the edit turn, the REHARMONIZE splice, the version card with A/B). C0a is usable in the real app on its own.
- instead of: full C0 before the owner sees it; strict order SP-5 → architecture → C0.

## D-105 · 2026-10-06 · housekeeping · by: user
Repo cleanup: the 10 merged agent worktrees and 25 merged local branches removed, 14 merged remote branches deleted (open-PR branches kept), old verify/spike temp data under E:\ai\tmp deleted (sp4, sp5 kept); the stale PRs #118 and #121 rebased and merged if still valid, else closed.

## D-106 · 2026-10-06 · stage 6 (chat C0) · by: assumed (architect)
A chat turn is one `plan`-kind job (label `chat turn`): one load, ≤ 3 attempts, `finally` unload with `/api/ps` empty (D-011); an `edit` reply carries SCORE ops inline (SP-5's schema) checked in the same slot by `checkOps`, yue `/v1/scores/apply` and `withLimits`, so D-100's one hand-off holds; the number of model calls (SP-5's ladder) lives only in `chat/turnCall.ts` (docs/decisions/0006). Reversal: a `chatTurn` kind is a two-union change.
- instead of: a new `chatTurn` kind; a turn job followed by a separate `plan` job.

## D-107 · 2026-10-06 · stage 6 (chat C0) · by: assumed (architect)
The A3 splice runs on yue-server as a `splice` job kind (`/v1/splices`), next to the score parser (docs/decisions/0002) and the SheetSage2 tracker; the server holds one `scoreRender` slot for render + grids + splice; base grids are cached as `${versionId}.grid.json` sidecars; `scipy==1.18.0` joins yue-server's requirements (docs/decisions/0005).
- instead of: TypeScript + ffmpeg in the server; a separate process in the SheetSage2 venv.

## D-108 · 2026-10-06 · stage 6 (chat C0) · by: assumed (architect)
Threads, messages and the draft live in SQLite (`chat_threads`, `chat_messages`, versioned JSON `draft_v` / `chat_v`, cascade from songs); live proposals stay in memory and read EXPIRED after a restart (docs/decisions/0007).
- instead of: files per thread; persisted proposals; the draft in client storage.

## D-109 · 2026-10-06 · stage 6 (chat C0, Q-080) · by: assumed (architect)
F-047's "an unresolved join on both sides" means: at both joins the snap found no usable groove (pattern correlation < 0.15 between the 8 beats before and after the cut). The 2-12 kHz verification of SP-4 is measured and logged, not a reason to fall back: read literally it would have rejected SP-4's song D reharmonization (both seams "unres.", LUFS excess +0.2 / -0.1 dB). Reversal: one constant in `splice_plan.py`.

## D-110 · 2026-10-06 · stage 6 (chat C0, Q-081) · by: assumed (architect)
Until C0b lands, an `edit` reply on a song thread is answered as a `say` that points to SCORE in the Editor (as scalpel and analyze replies point to their tools), and a `recipe` on a song thread is answered as a `say` that suggests NEW CHAT; nothing is silently dropped. Reversal: C0b's CB-2 turns edit on.

## D-111 · 2026-10-06 · stage 5 (DT-C0a) · by: user (signed off: "looks great"), defaults assumed by the conductor
design/chat-turn.html (TU-1..TU-10) is the spec for C0a's turn and recipe-card states on the Q-082..Q-086 defaults: one turn line under the message, CANCEL while queued or thinking; every ending without an answer has one shape (message stays, rust line, "nothing changed", one RETRY); SEND off while a turn is open; fields stay editable during a turn (FILLING… / YOURS / ASSISTANT; the reply names a skipped field); assistant off → RETRY and FORM ▸; card states pending / superseded / expired (ASK AGAIN) / committing / done; the pending card mirrors the live draft and CREATE SONG sends it; a commit locks the sidebar; the first take follows DESIGN.md's YuE2 rule; done folds the card, appends the song card, and the sidebar becomes a read-only song panel. The field marks move from C2 into C0 (Q-086).

## D-112 · 2026-10-06 · stage 7 (chat CA-1) · by: assumed (CA-1 builder, recorded by the conductor)
Chat data: (a) `fields.lyrics` is an array of sections `{tag, lines[]}`; the sung text is built in structure order, sections the structure doesn't place go last, no sung line = '' (YuE2 instrumental); (b) one draft thread enforced by a partial unique index; (c) a language YuE2 doesn't list (de/es/fr/it/pt) is dropped from vocal_language, as Guided Create does; (d) CREATE SONG blockers are hard rules only (YuE2 configured, style present and ≤ 2000, lyrics ≤ 16000, field values, no bracket inside a line); 4-8 lines per section and structure order are retry reasons (recipeProblems); (e) engines = ['yue2'] in C0, an 'acestep' recipe is a retry reason; (f) createBlockers(fields, {yueConfigured}) stays pure.
- risk noted: German and Spanish recipes reach YuE2 with no language word in the style (yue2.ts LANGUAGE_NAMES has en and zh only): CA-2's prompt puts the language into the style.

## D-113 · 2026-10-06 · stage 7 (chat C0a) · by: user
"Create the chat screen too and push it so that I can see it in action": C0a is compressed. CA-2 and CA-3 (turn job, routes, CREATE SONG) run as one server package stacked on CA-1; CA-6 (the screen) starts as soon as CA-5 lands; CA-4 (headless checkpoint) runs beside the screen instead of gating it. Everything merges behind the D-099 gate (CHAT shows only with LLM_API_URL and YUE_API_URL set), so the golden path and the owner's normal use don't move.
- instead of: CA-4 gating CA-6.

## D-114 · 2026-10-06 · stage 7 (chat CA-2 + CA-3) · by: assumed (builder, recorded by the conductor)
(a) C0a checks edit / scalpel / analyze and recipe-on-a-song replies for shape only, since they become a `say` (D-110); (b) SP-5 ladder rung 2 (state-allowed actions) is built, rungs 1 and 3 are not (CHAT_LADDER=1/3 runs as rung 0); (c) a cancel is a failed message with cause `cancelled`; (d) NEW CHAT is refused while a turn or take runs; (e) CREATE SONG skips the /api/ps check while a `plan` job holds the slot (it unloads before the take starts) and an unreadable /api/ps does not refuse; (f) German/Spanish/French/Italian/Portuguese go at the front of the style at CREATE SONG (`withLanguage`) plus a prompt rule (D-112's risk); (g) a second SEND while a turn is open gets 409 (Q-082); (h) estSeconds guesses 2 bars per sung line and 8 bars per section without lines; (i) the retry reuses retryMessages ("Your op list was rejected") even for a recipe.
- revisit: (e) if a take ever starts beside a loaded planner; (h) at CA-7's live run; (i) chat-specific retry wording if SP-5 shows it confuses the model.

## D-115 · 2026-10-06 · stage 7 (chat CA-6) · by: assumed (builder, recorded by the conductor)
The CHAT screen: (a) the player reuses the app's `Player` (waveform seek, volume, DOWNLOAD), not a bare seek bar (F-045 "no waveform in C0" is relaxed: the mockups show one); (b) "just filled" uses `on-sky` (#0C2530) as the mockup's --sk; DESIGN.md says why; (c) NEW CHAT asks first (DROP DRAFT / KEEP) when the thread has messages; (d) lyrics and structure parse when the field loses focus, a parse problem keeps the text and saves nothing; (e) the first frame waits up to 2.5 s for /api/chat/status so neither screen flashes; (f) FORM ▸ → Create → BACK returns to CHAT.
- follow-up in flight: RETRY after CANCELLED (TU-2), truthful cancel copy while a take renders, the score e2e under the D-099 gate.

## D-116 · 2026-10-06 · stage 7 (chat CA-6 follow-up) · by: assumed (builder, recorded by the conductor)
CANCELLED has the TU-2 shape (rust line "No reply. Nothing changed." + one RETRY, also after a reload); while a take renders the sidebar foot says only "locked until v1 is saved" (CANCEL is offered only while the take is queued; ACTIVITY's running rows have no stop); the boot switches to CHAT only while the person is still on the Library with no song open. The SCORE e2e reaches the Library via the header and asserts CHAT opens first when configured.

## D-117 · 2026-10-06 · stage 3 (SP-5) · by: assumed (conductor)
SP-5 is proven at rung 0 (one call per turn): all bars (a)-(g) pass on the v3.1 prompt (action right 97.2% scripted, 90% on a 20-turn hold-out; recipes 32/32; lyric language 32/32; edits valid within 3 attempts 31/32; turn p50 8 s, p95 27 s; prompt p95 5.3k, 206-bar worst 5.5k). The ladder is not needed. C0a's turn job (merged in #149, built from an earlier prompt) is brought to SP-5's "What C0's turn job should copy": the v3.1 prompt and schema, the run-length bar map, STYLE without the app's tempo/key hints, max_tokens 4000 for edit-capable calls, the compact-JSON reply line, the three guards. Owed: the owner's read of 10 lyric sets (spikes/SP-5-chat-planner/lyrics.html; 8 of 10 usable, below that rung 3 = lyrics as their own call, built). R-027 (added by the spike) tracks the 40-bar edit tail and ~90% routing on unseen wording.

## D-118 · 2026-10-06 · stage 7 (chat turn, SP-5 port) · by: assumed (builder, recorded by the conductor)
(a) the "style starts with the language" prompt rule (D-112) is dropped because v3.1 was measured without it; CREATE SONG's `withLanguage` still adds the language; (b) `eld` (pure JS, Apache-2.0, no deps; 529/531 on SP-5's recorded lyric sections) is a new server dependency for the lyric-language guard, loaded on first use, skipping text ≤ 40 chars; (c) history budget 2400 characters, pending card 3600; (d) the missing-section guard also runs on edits C0a only redirects; the key list is enforced by the schema enum, not written in the prompt; two bugs in the spike's key guard fixed (every key read as minor; sharp majors never matched).

## D-119 · 2026-10-06 · stage 7 (chat C0a live) · by: user
"Default to the library view when launching Mulakai": the app always starts on the Library; CHAT is one click away in the header (and OPEN CHAT on a song) when the chat is configured. Reverses D-099's CHAT start screen (and F-043's start-screen criterion, F-074's "remembered mode"). Shipped in #154.
- instead of: CHAT as the start screen when configured.

## D-120 · 2026-10-06 · stage 7 (chat C0a live) · by: conductor (bugs found in the owner's first live use)
The chat player read `song.audio_file`, which GET /api/songs/:id never sends, so no player appeared after a real CREATE SONG (#153: it plays the base layer's active take). The CA-6 screenshots ran against a stub that sent the field: a live run against the real server belongs before handing the screen over (CA-7). start-all.bat now starts Ollama with the 16k context and passes LLM_API_URL / LLM_MODEL (#152, #155). ACE-Step on :8001 runs `acestep\api_server.py` (start-all's portable path), which bears on R-025.

## D-121 · 2026-10-06 · stage 8 (C0a code review) · by: conductor
C0a-code.md: 0 blocking, 2 should, 1 nit, all checked in code. Fix all three before CA-7 (fix/chat-c0a-review): #1 CANCEL while thinking reads as a failure and lets a resend in during the unload (F-049 #1); #2 a truncated take shows DONE instead of the rust TRUNCATED line (F-044, D-025); #3 turns Map entry left on QueueFullError (trivial, same file).

## D-122 · 2026-10-06 · stage 7 (chat CA-4) · by: assumed (builder, recorded by the conductor)
chatCp0.ts: (a) hand-off = the worse of last planner answer → first empty /api/ps after the unload ack, and CREATE → take leaves `queued` (no human think time); (b) "invalid after 3" counts failed replies with cause `check` (a draft change during the reply would count too); (c) attempts = proxy call count (exact at rung 0); (d) YuE2 tok/s not recorded (the API does not expose it); (e) `--create` runs against a server on a DATA_DIR copy, never the owner's library.

## D-123 · 2026-10-06 · stage 8 fix (C0a review) · by: assumed (builder, recorded by the conductor)
fix/chat-c0a-review: (a) #1 server-only — cancelTurn sets job.cancelled on abort (the client's poll already reads that as CANCELLED, D-116 shape); POST refuses 409 TURN_OPEN while the turn is still settling, including a RETRY in the unload window, with the existing wording; (b) #2 the chat song card's rust line "TRUNCATED at 6:00, the song is cut short · v1 is saved; open it in the Editor to shorten and re-render" (no VERSIONS hint: the chat has no revert); truncated is read from the v1 label (TRUNCATED_LABEL); (c) #3 the turns entry is deleted on throw (enqueue may start the body synchronously). UI browser check of the truncated line is owed to CA-7 (needs a truncated take).

## D-124 · 2026-10-07 · stage 7 (C0a verify) · by: conductor
CA-4 live CP-C0a passes 3/3 stop lines; CA-7 live run passes F-041..F-045 on their C0a criteria (sub-criteria not run live are unit-tested; noted in features.json evidence); F-049 turn half and F-050 create half met, both stay false until C0b. Waveform on the chat player kept per D-115(a). Owner's "running in the Library" report not reproduced → Q-090; no speculative fix without a repro.

## D-125 · 2026-10-07 · scope order · by: user
"go ahead and quickly implement everything": C3 (reference songs: read a library song or dropped audio, cover proposal, fresh song borrowing from it, F-061..F-065) moves ahead of C1/C2 and runs now; C0b follows. C3 does not depend on the SP-4 listen.
- instead of: the signed-off order C0b → C1 → C2 → C3.

## D-126 · 2026-10-07 · stage 6 (chat C3) · by: assumed (architect)
A reference is read by one `transcribe`-kind job (label `chat reading`) that holds one queue slot through WORDS > SCORE > CAPTION (lyrics-server, yue-server SheetSage2 + `/v1/scores/read` + `/v1/scores/measure`, ACE-Step ANALYZE AUDIO); a pure `readingPlan` skips what the source already has (a YuE2 library song: its own score, words and style, no GPU; another library song: its own words/caption, a transcribed score). A part that fails or whose service is unset is `not read: <why>`; the job fails only when the file cannot be read. It starts only with no planner model loaded (`gpuGuard`, extracted from CREATE SONG's check). Result: a `Reading` (`reading_v: 1`) on the reference row and snapshotted in the reading card (docs/decisions/0008). Reversal: the three existing jobs, chained.
- instead of: chaining the existing `transcribe`, `lyrics` and `analyze` jobs (three slots, three job ids for one card); a new `reading` queue kind (a two-union change in genQueue, 190/200 LOC, and the client).

## D-127 · 2026-10-07 · stage 6 (chat C3, D-084, D-102) · by: assumed (architect)
References are rows of `chat_references` per thread (FK cascade) with a copy of the audio in `audioDir/references/<id>.<ext>` (served by `/audio`); a library pick is copied too (its base layer's active take, D-137) with a snapshot of the song's own score, lyrics, caption, bpm, key and meter in `own_json`. The reference follows the draft thread to the song at CREATE; trash keeps it, permanent delete and NEW CHAT remove the rows, and `sweepFiles()` removes files without a row (start, trash sweep, NEW CHAT).
- instead of: a link to the library song only (gone when that song is deleted or changed); a `songs` column (a draft thread has no song yet); keeping the file on yue-server.

## D-128 · 2026-10-07 · stage 6 (chat C3, F-063/F-064) · by: assumed (architect)
Cover vs fresh song is one `recipe` reply with `reference_use: cover | borrow | none` (in the schema only when a reading exists), not a new action. Code fills the borrowed fields from the reading (`referenceRecipe`): a cover takes tempo, key, meter and structure from the score (locked, FROM THE SCORE) and CREATE COVER runs createFromDraft with the reading's score as `cover` (USE .ABC FILE's request, cot `melody`); a borrow fills tempo, key, meter and structure (marked REFERENCE), leaves a missing value blank and says so; the model writes title, style (instrumentation words from the caption) and words. "Like this, but …" reads as a cover when the reading is coverable, said in assumptions (D-082); a cover on a non-coverable reading becomes a borrow with the reason. Measured in CP-C3 (`reference_use` right on 8 of 10). Reversal: a `cover` action (needs an SP-5-style re-measure).
- instead of: a `cover` action in the closed set; the model copying tempo and key; two commit buttons on one card.

## D-129 · 2026-10-07 · stage 6 (chat C3) · by: assumed (architect)
When a reading saves, the server queues the follow-up turn itself: the original request again, the REFERENCE block in the state, allowed actions ask / recipe / say; its line shows under the reading card. SEND stays off (409 `TURN_OPEN`) from READ until that turn settles; RE-ANALYZE writes a new reading card and queues no turn. Reversal: drop the `onRead` hook; the person types the next message.
- instead of: the person asking again after every reading.

## D-130 · 2026-10-07 · stage 6 (chat C3) · by: assumed (architect)
In C3 a reference is attached only in the draft thread (a new song). A song thread lists its references (RE-ANALYZE, A/B) and answers an `analyze` reply with a `say` pointing to NEW CHAT (D-110's shape). Reversal: allow ATTACH on a song thread once edits read a reference.
- instead of: references that change an existing song (no edit turn exists before CB-2).

## D-131 · 2026-10-07 · stage 6 (chat C3, F-061) · by: assumed (architect)
A reading asks yue-server for a transcription with chords (`chords: true`: no `--melody-only`, no piano preview); Guided Create's COVER keeps melody-only (the default). A cover still renders cot `melody` (yue-server strips chord symbols, scores.py). CB-1's grid run reuses the flag. Inferred from transcriber.py's docstring that SheetSage2 then writes chord symbols; if not, the reading says "chords: not read".
- instead of: melody-only readings (no chords for an audio reference, F-061 met only for YuE2 library songs).

## D-132 · 2026-10-07 · stage 6 (chat C3, F-065, was F-035) · by: assumed (architect)
F-065's score half lands in C3 on the dock: `scoreEligibility` admits covers, instrumentals and chord-free scores; a pure `renderMode` picks cot `full` when the score has chords or the plan has a REHARMONIZE, else `melody`; the plan carries it and the render uses it; REWRITE LYRICS on an instrumental is refused with the reason; the review names the render mode. The chat half (edit turns on such songs) arrives with CB-2 (D-110's redirect to SCORE until then), and CB-2's `spliceEligibility` sends a chord-free REHARMONIZE down the whole-song path. F-065 `passes` waits for the chat half.
- instead of: holding all of F-065 until C0b.

## D-133 · 2026-10-07 · stage 6 (chat C3) · by: assumed (architect)
No separate spike for transcription quality on arbitrary audio: the chat reuses today's COVER transcription unchanged, so the risk (R-029) is measured inside CP-C3 (score read ok, coverable, vocal-note density, reading time per step) with stop lines, and the owner hears 3 covers (owed, not blocking `passes`).
- instead of: an SP-7 transcription spike before C3 code.

## D-134 · 2026-10-07 · stage 6 (chat C3, Q-079) · by: assumed (architect)
The rights line on the READ card, the reading card and the cover card: "Stays on this machine. You are responsible for the rights to this recording." Reversal: one string in `chatReferenceCopy.ts`.

## D-135 · 2026-10-07 · stage 6 (chat C3) · by: assumed (architect)
The CAPTION step (caption, tempo, key, meter, F-061) calls ACE-Step ANALYZE AUDIO only when ACE-Step's health answers, loading its model as Guided Create's ANALYZE AUDIO does (the exact model choice is the builder's, unverified); otherwise a library song's own caption is used, else `not read: ACE-Step is not running` and tempo/key come from the score header. Tempo and key prefer ACE-Step's reading, then the score header; a cover always sings the score's own. Reversal: drop the step (the first cut if R-028 bites).

## D-136 · 2026-10-07 · stage 6 (chat C3) · by: assumed (architect)
`client/src/chatStore.ts` is at the 200-LOC cap: CR-6 first moves job polling and rehydration into `chatPoll.ts` (own refactor commit). `chatCopy.ts` (183) and `chatTurn.ts` (185) are near it, so C3's copy lives in `chatReferenceCopy.ts` and the analyze/reading card states in the `chatReading.ts` reducer (chat-client rule amended).

## D-137 · 2026-10-07 · stage 6 (chat C3) · by: assumed (architect)
A library song as a reference is its base layer's active take (as the chat player plays, D-120); extra layers are not read, and the reading card says so for a song with more than one layer.
- instead of: the client bouncing the audible mix as Guided Create's COVER does (a WAV upload of up to ~65 MB per pick).

## D-138 · 2026-10-07 · stage 6 (chat C3, F-061 edge) · by: assumed (architect)
A reference longer than 360 s is kept whole (A/B plays all of it); the reading and a cover use its first 360 s through a temp trimmed copy, said on the reading card.

## D-139 · 2026-10-07 · stage 7 (chat C3, CR-0, D-131) · by: assumed (builder)
D-131's premise is *seen in code*: SheetSage2's `infer.py` passes `melody_only` through, and `notation_sheetsage2.py` (`_assemble_abc_score`) fills the ABC's chord timeline from `chord.lab` unless `melody_only`, so a run without `--melody-only` writes chord symbols (none where it hears no chord, "N"). CR-0 defaults: `chords` is a multipart form bool (`true`/`false`, else 422); the result echoes `chords` as requested (chord presence in the ABC stays a `/v1/scores/read` fact, decisions/0002); with `chords` the job gets no piano preview and no warning for it; a replayed key with another `chords` is 409. Contract fixtures `transcription-{chords-done,chords-failed,hold}.json` carry `request` (form + file field), `response` (the 202 record), `final` (the record the fake answers when done or held) and `score` (what GET …/score serves), with id `tr-0001` and clock values pinned to 1.0.
- instead of: a `chords_present` flag computed on the transcription route (a second ABC reader path), or keeping the preview on readings.

## D-140 · 2026-10-07 · stage 7 (chat C3, CR-1) · by: assumed (builder, recorded by the conductor)
(a) a `notRead` part stores only the reason, the client prefixes "not read: "; (b) an upload needs an audio file extension; refusals 400 `{reason}`, 413 over `coverMaxUploadMb`; (c) the same file (sha256) attached twice in one thread returns the existing reference (200); (d) `own_json` also keeps `layers` (own_v 1) so the card can say "only the base layer was read" (D-137); (e) a cover is possible when the whole score fits the token budget; unmeasured → ok, GENERATE's own check is the backstop; (f) `readingFacts` uses the draft's 30-key spelling, modes and out-of-range bpm/meter count as missing; (g) GPU estimate constants are placeholders until CP-C3. Copies are written synchronously so the sweep never sees a file before its row.

## D-141 · 2026-10-07 · stage 5 (DT-C3, design/chat-reference.html) · by: assumed (conductor; owner may overrule)
No blocking choice in DT-C3, so the build proceeds on the mockup's defaults: option B (a neutral REFERENCE tag on borrowed fields, Q-097), one attach chip per thread (Q-098), no invented GPU seconds on the READ card until CP-C3 calibrates them (Q-099); Q-100 (A/B at the same seconds) deferred. RF-1..RF-6 as drawn. The page is 25.5 KB (cap 25 KB; accepted). A stray absolute-positioned "TEMPO 92 BPM REFERENCE" sample shows at the page's top-left: mockup artifact only.

## D-142 · 2026-10-07 · stage 7 (chat C3, CR-5, F-065) · by: assumed (builder, recorded by the conductor; the branch's commits call it D-139)
The dock names the render mode only when it is not the usual one: the consequence line adds "renders the melody only, no chords" (cot melody) or "adds chords: the whole song renders with chords" (REHARMONIZE on a chord-free score); the checks line reads `no chords · melody render` (plain, not rust) instead of `chords invalid` for a melody render.
- instead of: naming "renders with chords" on every plan.

## D-143 · 2026-10-07 · stage 7 (chat C3, CR-5) · by: assumed (builder, recorded by the conductor; branch: D-140)
`YueScoreReview.tsx` is Guided Create's COVER review, not the dock's, so it is unchanged; the dock's review copy is `scoreCopy.ts` + `scoreAttemptCopy.ts`, rendered by `ScorePlanList.tsx`; `api/score.ts` gains optional `ScorePlan.renderMode`.

## D-144 · 2026-10-07 · stage 7 (chat C3, CR-5, F-065 edge) · by: assumed (builder, recorded by the conductor; branch: D-141)
"Instrumental" for REWRITE LYRICS = every lyric block has 0 lines or there are none (yue-server facts). The refusal "this song is instrumental: there are no words to rewrite" is a plan check (`scoreLimits.wordsRefusal` via `withLimits`); the song stays eligible for every other op. REPEAT/TRANSPOSE on chord-free scores covered by the renderMode unit table only.

## D-145 · 2026-10-07 · stage 7 (chat C3, CR-2) · by: assumed (builder, recorded by the conductor)
(a) CAPTION calls ANALYZE AUDIO without a model first; only on "not initialized" it loads the inventory's `defaultModel` and tries once more (D-135); (b) the >360 s trim is FLAC at DATA_DIR/tmp/reading-<jobId>.flac; (c) WORDS takes the language from lyrics-server, a library song's own words use detectLanguage; no sung lines → `instrumental: true`; (d) a failed score read/measure is a warning with null facts/measure, the score part is kept; (e) a library song uses its own part when non-empty, a missing part goes to the service; (f) an exception in onRead is swallowed (the reading is already saved). ACE-Step has no unload route: its model stays loaded after CAPTION (R-028, measured in CP-C3).

## D-146 · 2026-10-07 · stage 3 (SP-4 ear half) · by: user ("can't listen to 28 songs"), pair choice by the conductor
SP-4's ear half shrinks to 10 of the 20 required pairs, the riskiest two per kind (listen/short.html): REHARMONIZE B, D (a word held across the cut / words within 80 ms); REWRITE LYRICS B, C (different words across the cut); WRITE PHRASE A, D (song A's level gap; D's moved cut); REPEAT A (+8.5 dB), C (+3.5 dB); CUT C (+3.4 dB, word across), B (-1.9 dB). Bar: a kind passes when the join is not found in either of its 2 pairs; found in 1 → that kind ships only with the fix the finding points to; found in both → that kind falls back to the whole re-render (D-101). The 8 optional extras are dropped.
- instead of: 20 pairs with "not found in 4 of 5" per kind.

## D-147 · 2026-10-07 · stage 3 (SP-4 ear half, REHARMONIZE) · by: conductor, from the owner's answers (spikes/SP-4-keep-unchanged/listen/answers-part1.json)
The owner judged all 4 REHARMONIZE pairs (p1-p4, the full page). The edited take was picked as the joined one in 2 of 4 (p1, p2), missed in p3 (picked the unedited one) and p4 ("neither"). The giveaways: p1 "side A becomes a bit louder" (a level step: song A is the one whose base already steps +5.4 dB at the chorus, and the new take sat 3.7-6.0 dB off the old audio); p2 "the chords do not fit the melody" (the edit's own quality, which a whole re-render would share, not a seam). Reading: no seam was heard as a cut or click; the A3 splice passes for REHARMONIZE with one fix pointed to: the level match must hold over the whole new span, not only at the seams (p1). The remaining kinds use listen/short.html (8 pairs, D-146).

## D-148 · 2026-10-07 · stage 7 (chat C3, CR-3) · by: assumed (builder, recorded by the conductor)
(a) a READ card with no target named uses the thread's only attached file; with 2+ and no match the turn lists them instead of guessing; (b) a reading with no sections keeps the model's structure, the card says so, structure is not listed as missing (tempo/key/meter still blank and named, F-064); (c) a cover locks bpm, key, timeSignature and structure; `handEdit` returns `refused[{field, reason}]` (routes/chat.ts shows it in CR-4); (d) the READ card's GPU estimate assumes every step uses its service until CR-4 swaps in CR-2's readingPlan; (e) attach on a song thread 409 ATTACH_ON_SONG, malformed / other chat's 400; (f) SEND is 409 TURN_OPEN while a follow-up reading card still has a live job or open turn. Prompt: REFERENCE rule ~220 tok + block ≤600 tok only when a reading is in the state; follow-up turns carry ask/recipe/say only (~2k tok smaller).

## D-149 · 2026-10-07 · stage 7 (chat C3, CR-4) · by: assumed (builder, recorded by the conductor)
(a) the analyze card is 'committing' while its reading job is live, then 'done' whatever the outcome; a card already read refuses a second READ; (b) READ and RE-ANALYZE are refused while a turn, a reading or CREATE SONG of that thread runs; (c) the follow-up turn re-asks the last user message before the analyze card; if it cannot queue, a failed line (cause offline) appears; (d) the READ estimate treats a YuE2 library song's score as its own and assumes ACE-Step is up when ACESTEP_API_URL is set. CANCEL on a reading calls cancelReading and sets job.cancelled (reads cancelled, not failed).

## D-150 · 2026-10-07 · stage 3 (SP-4 ear half, the other kinds) · by: owner confirmed 2026-10-07 ("whole re-render is fine"); reading by the conductor
Owner's answers: spikes/SP-4-keep-unchanged/listen/answers-part2.json. Join found in both pairs: REWRITE LYRICS (p6, p7: "the voice changed"), WRITE PHRASE (p9, p12: "song changed completely"), REPEAT (p13 "cross fade very obvious" = song A's +8.5 dB step; p15 "barely noticeable, sounds really good"). CUT: p18 not found but "a small hitch right at the cut"; p19 found only because "the lyrics do not make sense" (content, not seam). Proposed reading:
- REHARMONIZE: A3 splice ships (+ level match over the whole span, D-147).
- CUT: audio-only cut ships, with a fix for the hitch at the seam; the planner cuts whole sections/line groups so the words still make sense.
- REPEAT: audio-only copy ships when the seam's level step is small (p15); above a measured threshold (song A, +8.5 dB) it falls back to the score REPEAT re-render (M2).
- REWRITE LYRICS, WRITE PHRASE: the splice is heard (the new take's voice/timbre differs inside the span) → whole re-render (D-101), labelled.

## D-151 · 2026-10-07 · stage 7 (chat C3, CR-7a) · by: assumed (builder, recorded by the conductor)
(a) READ's line says "uses the GPU", or "uses no GPU" when estimate.total is 0 (D-141, Q-099); (b) the card shows a cover as not possible when the score was not read or its measured tokens exceed the budget (unmeasured fits, D-140e); the server's coverVerdict decides; (c) READ AGAIN on a failed / cancelled / interrupted card uses RE-ANALYZE's route (no follow-up turn); (d) a failed chip has only ✕, no RETRY (the store does not keep the file); (e) PROPOSING… stays plain (the phase does not tell queued from thinking). C3 copy additions live in chatReferenceCopy.ts.

## D-152 · 2026-10-07 · stage 7 (chat C3, CR-7b) · by: assumed (builder, recorded by the conductor)
(a) a missing value's warn body reads "in the reference · left blank, YuE2 decides when it renders" (no planner fills it at CREATE); (b) the player status while the reference plays is "LISTENING · SAME SECONDS" and the version pill hides; (c) one REFERENCE ⇄ SONG pill (filled lilac on the reference) instead of the mockup's two; (d) past the reference's end the player waits at its end, paused; (e) RE-ANALYZE names no GPU seconds (Q-099); (f) the reference panel shows only on a song thread. No "FILE MISSING" state yet (ReferenceView has no missing flag → Q-102). DESIGN.md updated in its own commit on the branch.

## D-153 · 2026-10-07 · stage 7 (C3 CR-8) · by: assumed (conductor; owner has not sent Q-095's recordings)
CP-C3 runs on 3 library songs on a DATA_DIR copy: 1 YuE2 song (its own score, no GPU) and 2 ACE-Step songs (real non-YuE2 audio, so transcription runs). The owner's own recordings are added later; until then R-029 (transcription on arbitrary recordings) stays a hypothesis for outside audio.

## D-154 · 2026-10-07 · stage 7 (C0b plan after SP-4) · by: conductor, from D-147/D-150
C0b's splice (CB-1, CB-3) covers REHARMONIZE (A3 with the level match held over the whole new span), CUT (audio-only, fix the seam hitch; the planner cuts whole sections / line groups) and REPEAT (audio-only when the seam's level step over the base is under a threshold, measured on SP-4's rows; above it the score REPEAT re-render). REWRITE LYRICS, WRITE PHRASE and anything else render the whole song (D-101), labelled on the edit card ("the whole song is re-rendered").

## D-155 · 2026-10-07 · stage 8 (C3 code review) · by: conductor
C3-code.md: 1 blocking (a reading card's CANCEL goes to /api/generate/:id/cancel, not the chat's cancelReading: a running reading does not stop, a queued one leaves the thread BUSY until restart), 2 should (settle-before-delete leaves BUSY on throw; a failed/cancelled READ can only be retried without the follow-up turn), 2 nit (cancel during the final settle ignored; REFERENCE block by row order). Blocking confirmed in code (ChatThread.tsx cancelCard). Fix all five on fix/chat-c3-review before CR-9; #171 may merge first, the fix follows immediately.

## D-156 · 2026-10-07 · stage 7 (chat C0b, CB-2) · by: assumed (builder, recorded by the conductor)
(a) CUT and REPEAT are splice-eligible like REHARMONIZE (D-154; splice.md updated at curate); (b) a chord-free score re-renders the whole song for CUT and REPEAT too (the grid fit reads chords); (c) a chat edit plan replaces the dock's pending plan for that song (one planStore plan per song) and the dock shows it; (d) the dock's lastRun is not noted for chat plans. Edit card body: {chat_v, planId, ops, verdicts, checks, splice: {splice:true, kind, from_bar, to_bar} | {splice:false, reason}, renderMode, assumptions, attempts, refusals}; states pending / superseded / expired / committing / done. PR #173 is a draft until CB-3 + CB-5 (feature gate: no APPLY in the client yet).

## D-157 · 2026-10-07 · stage 8 fix (C3 review) · by: assumed (builder, recorded by the conductor)
D-151 (c) now reads: READ AGAIN on a failed / cancelled / interrupted reading card still uses RE-ANALYZE's route (no follow-up); separately, a READ whose reading saved nothing puts its analyze card back to READ while its proposal lives, and that READ re-reads the same reference with the follow-up turn. When settle throws after a complete reading, the reading is kept, the job fails with the settle's reason and no follow-up is queued (the planner may still be on the GPU).

## D-158 · 2026-10-07 · stage 5 (DT-C0b) · by: assumed (ux-mocker, awaiting the owner's sign-off)
design/chat-edit.html (EC-1..EC-8) is the proposed spec for CB-5 on the Q-103..Q-106 defaults: one edit card with a splice clause ("only bars X-Y change, the rest is v1's audio") or a whole-song clause with a grey reason; a sky bar strip (option B); APPLY the only acid; phases RENDERING → SPLICING → SAVING as plain lines (two steps for a whole-song edit), WAITING FOR v2 in the composer; version cards for splice, whole song, join not aligned and TRUNCATED; BACK TO v1 as the one REFERENCE ⇄ SONG pill pattern with a neutral USE v1; refused / failed / stale / superseded / expired as one shape with no APPLY.
- instead of: words only (A); a play-bars link (C); a shader on the commit; asking before saving a whole fallback.

## D-159 · 2026-10-07 · stage 7 (C3 CR-8, CP-C3 run 1) · by: conductor
CP-C3 (pipeline/cp-c3/2026-10-07): 4/5 stop lines pass — slowest reading 90.8 s (CAPTION 66.9 s with ACE-Step cold), follow-up p50 14.0 s with the planner fully on the GPU 10/10 (R-028 holds: ACE-Step adds ~1 GB and stays), score read 3/3 (44-92 bars, chords, all coverable), hand-off 0.2 s; 2 covers saved (Cariñito → "Farewell Melody", purple trails → "Herbstlicher Traum"; owner's listen owed). STOP: reference_use right 5/10 (the model says `cover` 10/10). Also: a cover-worded SEND with an attachment never got an analyze card (0/5; scalpel or recipe instead). Re-dispatched with both causes named (schema key order + the cover tie-break; turnActions allows every action when attached) and a live re-run of the 10 wording legs before CR-9. CR-8 defaults: "score read ok" = score part read and its facts parse; the follow-up is timed from reading done to reply written; "right" = the model's own reference_use from the proxy log.

## D-160 · 2026-10-07 · stage 7 (chat C0b, CB-1) · by: assumed (builder, recorded by the conductor)
yue-server splice: REPEAT re-renders when |seam LUFS step (3 s each side)| > 4.0 dB (heard: +8.48 "very obvious", +3.52 "sounds really good"; raw step, a REPEAT seam has no base counterpart); a 4/4 check runs on yue too, so a 2/4-header song (Romantica) answers `rerender`; CUT shifts the cut only on a dip ≥ 6 dB and then narrows the crossfade to 1/4 beat (the p18 hitch: B now cuts before "Yo"/"Y dime"; not yet listened); an edge CUT fades over one beat; REPEAT's copy-end join has no crossfade (equal-power on identical audio would add +3 dB); REPEAT/CUT `not_aligned` → rerender. REHARMONIZE holds the span's gain per bar (every bar within 0.75 dB of the base on song A). Owed: a short listen of the new CUT joins (E:\ai\tmp\cb1).

## D-161 · 2026-10-07 · stage 7 (chat C0b, CB-3) · by: assumed (builder, recorded by the conductor)
(a) a whole-song APPLY also runs through spliceRenderJob (label `chat edit`, phases rendering → saving) so it gets the version card; (b) a failed splice job saves nothing and the card returns to pending; a 422/409 refusal or a `rerender` verdict saves the whole render, labelled (a CUT/REPEAT renders it first); (c) a truncated REHARMONIZE render still goes to the splice, which answers `render_truncated`, and the whole render is saved marked truncated; (d) a spliced version's sidecar is plan.abc; (e) stale is additive `EditBody.stale` + MessageState 'stale'; (f) a GPU refusal at the click is not stale. Label suffix "· bars 9–16 spliced/cut/repeated" or "· whole song re-rendered: <reason>". Routes: POST /api/chat/threads/:id/apply {proposalId} → 202 {jobId} | 409 {reason, stale}. Draft PR #178 (with #173) until CB-5.

## D-162 · 2026-10-07 · stage 7 (C3 CP-C3 re-run) · by: conductor, from the fix builder's run
CP-C3 run 4 passes 5/5 stop lines: reference_use right 9/10 (5/10 before), follow-up p50 11.8 s with the planner fully on the GPU 9/9, score read 3/3, hand-off 0.2 s, CREATE COVER saved twice. Fixes: reference_use first in the recipe schema; tie-break "unsure: borrow"; the REFERENCE rule defines cover as "ONLY this same song again" and borrow as "a different song in its style" (+11 tokens) — this reverses D-128's "'like this, but …' reads as a cover when coverable"; an attached file on a draft thread with no reading allows only ask / analyze / say (attached cover requests get the READ card 4/4 on the first SEND). Run 4 ran with ACE-Step unreachable (the owner's :8001 untouched), so CAPTION was "not read": the honest slowest reading stays run 1's 90.8 s. A library song named in words without an attachment still gets a recipe (named-cover-en) → Q-107.

## D-163 · 2026-10-07 · stage 7 (chat C0b, CB-5) · by: assumed (builder, recorded by the conductor)
(a) a song with both a reference and a previous version shows only the BACK TO pill in the player; (b) while v1 plays the status reads "v1 · NOT ACTIVE" (the mockup's longer line hit DOWNLOAD at 1366); (c) after USE v1 the "v2 is kept" note (Q-106) shows in the player as a lilac note, not a thread message; (d) the player pill shows only "v2" (the server label is too long); (e) the client treats a failed job with error 'Aborted' as a cancel — CB-4 makes the chat cancel set job.cancelled; (f) after a CUT or REPEAT, BACK TO lines up by seconds, not by bar (Q-105). The commit reducer lives in chatCommit.ts (chatTurn at its cap). C0b's whole flow is draft PR #181 (supersedes #173, #178) until CB-4 passes.

## D-164 · 2026-10-07 · stage 7 (C3 CR-9 live run) · by: conductor
pipeline/verify/C3/live/c3-live.md: F-061..F-064 and F-065's score half pass live (47 screenshots; covers rendered in ~75 s, borrow CREATE SONG 77 s; the 6:24 song reads 6:00 and says so; non-audio and noise refused with reasons; A/B same seconds; trash + empty removes the upload file). Bugs: A (blocking for done) a cancelled reading after a reload leaves the analyze card STARTING and SEND disabled (chatReading.ts keeps a stale phase); B RE-ANALYZE says "uses the GPU" for a no-GPU YuE2 reference; C "NaN:NaN" for songs with no duration; D borrowed tempo taken from ACE-Step's caption (79/47 BPM) over the score's 70 → borrow now prefers the score's facts, the caption fills only what the score lacks (refines D-140 f). All four fixed on fix/chat-c3-live before F-061..F-064 are marked passing. Owed: the owner's cover listen.

## D-165 · 2026-10-07 · stage 7 (C3 live fixes) · by: assumed (builder, recorded by the conductor)
fix/chat-c3-live (#182): borrowed tempo/key/meter prefer the transcribed score, the caption fills only gaps (reverses D-135's caption-first order for borrows); the REFERENCE facts line given to the planner also puts the score first; a cover stays score-only (the caption never fills what a cover's score lacks); ReferenceView carries a required `estimate` so RE-ANALYZE says "uses no GPU" when nothing runs on it. Bug C's cause: two covers store duration as the text 'N/A'. A, B, C unit-tested only (no browser re-run).

## D-166 · 2026-10-07 · stage 7 (C0b CB-4, CP-C0 edit leg) · by: conductor
pipeline/cp-c0/2026-10-07-edit: 5/5 stop lines pass on 3 library songs — edit turn p50 6.3 s (REHARMONIZE alone 20-25 s, over 15 s for that kind), hand-off 0.3 s, slowest edit 118 s, null test 0 different on all 6 splices (splice_check.py in WSL agrees), join LUFS excess 0.2-0.3 dB. Gertar and Cariñito: REHARMONIZE, CUT, REPEAT spliced, REWRITE LYRICS whole song. House in der Halle: REHARMONIZE plan failed the root check 3 times (no card); CUT `not_aligned` and REPEAT +6.6 dB → whole render, labelled (as designed) → Q-108. Live bugs fixed in #181: the splice reused the render's Idempotency-Key (yue 409 → every REHARMONIZE fell back to a whole render); the chat cancel now sets job.cancelled for a running APPLY. Defaults: each kind edits v1 again; hand-off = worst of unload-to-empty and APPLY-to-running; join excess counts REHARMONIZE seams only. Setup note: scipy 1.18.0 was installed into the owner's ~/yue2/.venv (C0b's playbook step) — the owner's yue-server needs the new code (pull main) for /v1/splices. Owed: the owner's A/B listen (E:/ai/tmp/cb4/listen; Gertar's real splice is -v4).

## D-167 · 2026-10-07 · stage 7 (C0b CB-6, F-046 edge) · by: conductor
The live run gave a YuE2 cover a normal edit card, against F-046's edge wording ("cover ... gets the eligibility reason and no APPLY"). That wording predates D-132: F-065 admits covers, instrumentals and chord-free scores, and its chat half lands with CB-2. Covers stay eligible; F-046's edge line is read without "cover, instrumental, chord-free". F-065 passes once instrumental and chord-free edit turns are seen live. Reversal: re-add covers to the ineligible list in `scoreEligibility`.

## D-168 · 2026-10-07 · stage 7 (C0b CB-6) · by: conductor
CB-6 live (c0b-live.md): F-046..F-048 pass, F-050 #2 passes. Fixed on fix/chat-c0b-live: the false "temporary render is deleted" copy after a splice cancel, and a restart mid-APPLY reading EXPIRED instead of INTERRUPTED (F-049 #3). Deferred, low: a stale card relabelled against the active version after USE v1; after USE v1 the v2 card has no PLAY or A/B; stale vN after an Editor delete (review nit 3). Kept: successful edits leave 30-80 MB on yue-server until its 24 h sweep.

## D-169 · 2026-10-07 · stage 7 (C0b live fixes, F-049 #3) · by: assumed (builder, recorded by the conductor)
fix/chat-c0b-live: an edit card keeps its APPLY job id only while the APPLY can still save; a failed, refused or cancelled APPLY clears it (queued cancels in the cancel route). After a restart, a card with a job id the server no longer knows and no saved version reads INTERRUPTED with ASK AGAIN — not APPLY again, since the plan and proposal live in memory and are gone. The splice-cancel line no longer claims the render was deleted (yue-server has no delete for a finished job). Known edge: a queued APPLY cancelled by trashing the song keeps its id and would read INTERRUPTED after a later restart.

## D-170 · 2026-10-07 · stage 7 (C0b, F-050 #3 owner listen) · by: conductor
Owner's A/B listen of 5 chat edits (pipeline/verify/C0b/owner-listen.json): no join bar named in 5/5 (join not found: pass), the edit came through clearly 5/5 (chords changed: pass), "the rest sounds the same" not met — tiny/tiny/a bit/a bit on the 4 splices, "different" on the whole re-render. Outside the span the splices are sample-identical to v1 (null test 0 differing samples), so what is heard is the re-sung span's instruments drifting (Acid: TB-303 bass → jazz bass), which colours the song around it. The render already reuses v1's seed and its style text, and those styles already name the instruments (tb 303; saxophone, bass; arpeggiated piano; fingerpicked guitar); yue-server takes no audio reference. F-050 stays false. Next: an instrument-hold spike (SP-6) before more chat edit work — owner's idea (instruments named, first and explicit) against a YuE2 audio reference if the model supports one.

## D-171 · 2026-10-07 · stage 6 (chat C1) · by: assumed (architect)
A saved version is analyzed by C3's reading machinery reused: one `transcribe`-kind job, label `chat analysis`, one slot through WORDS > SCORE > SECTIONS (`readingSteps.runStep` for words and score; a new sections step for grid + bar times), stored as `versions.analysis_json` (`analysis_v: 1`, additive column); word timings go to the existing `versions.word_timings`, the grid to the existing `gridCache` sidecar (docs/decisions/0009).
- why: docs/decisions/0008 already chose this; no new queue kind (genQueue 190/200, two kind unions); the splice and the Editor read what it writes.
- instead of: a new `analyze` queue kind; chaining the timings, transcribe and splice-grid jobs; a separate analysis table.
- revisit if: CP-C1 shows the single slot makes the next turn wait past its stop line (R-032).

## D-172 · 2026-10-07 · stage 6 (chat C1) · by: assumed (architect)
What is analyzed: the chat's playable version (the base layer's active take, D-120) of a song **with a chat thread**; triggered when any job that can change audio settles `done` on that song (`jobEvents`, emitted by `jobRunner.queueJob`), and by `ensureAnalysis` on GET of a song's thread (imports, songs older than C1). One pending analysis per song; it re-resolves its target when it starts, so a newer version wins and no second job is queued. Songs without a thread are not analyzed (Q-109).
- instead of: hooking the six version-insert sites; analyzing every song in the library.

## D-173 · 2026-10-07 · stage 6 (chat C1, Q-038 #4) · by: assumed (architect)
`scoreRenderJob.pendingEdit` lists only edit kinds (repaint, regenerate, retake, addLayer, split) instead of "anything but plan / scoreRender": a queued or running `timings`, `transcribe` (READ, the version analysis), `lyrics`, `analyze` or `lm` job never refuses APPLY. CREATE SONG / COVER already pass only `gpuGuard`. Built first (CL-1).
- why: today a waiting analysis would refuse APPLY with "a chat analysis was queued after this plan" (seen in code); F-052 #3.

## D-174 · 2026-10-07 · stage 6 (chat C1) · by: assumed (architect)
Bar times come from yue-server: `GET /v1/transcriptions/{id}/grid` (the chords run's `downbeat.lab` / `chord.lab` through `splice_grid.read_grid`) and `POST /v1/scores/bars {abc, grid}` (`splice_grid.fit`), CPU only. One SheetSage2 run gives a non-YuE2 version its transcribed score and its grid; a YuE2 version tracks only when no grid is cached; a spliced version's `mapped` grid is cached already (spliceRenderJob), so it needs no GPU step but WORDS.
- why: decisions/0002 keeps ABC reading on yue-server; the strip and the splice use one fit, so their bars cannot disagree.
- instead of: a TypeScript bar-time fit; a separate grid job.

## D-175 · 2026-10-07 · stage 6 (chat C1, F-055) · by: assumed (architect)
The mark is a third `planReferent` kind, `range {versionId, bars?, seconds}` (D-090 extends F-032's referent). The server resolves it at SEND and again at the turn's start against the playable version and its lineage (`barShift`): same version → pinned; the parent of a version whose edit moved no bars → carried, seconds re-timed; else stale. Stale at SEND → 409 `MARK_STALE`, nothing written; stale at the turn's start (it queued behind an APPLY) → a `failed` message "nothing changed · mark again", before the planner loads (Q-111). Never remapped.
- instead of: a chat-only mark module; trusting the client's bars; planning the whole song when the mark went stale.

## D-176 · 2026-10-07 · stage 6 (chat C1, F-055) · by: assumed (architect)
A mark limits the plan in code: bar-valued op fields are bounded to the mark in the strict schema (`opsArraySchema(…, barRange)`); a section-referenced op outside the mark is a retry reason (`markFit`); a whole-song op (tempo, key, style) stays allowed and the edit card says "changes the whole song, not only the marked bars"; where an op's own limit is shorter than the mark the bound is the intersection and the card names it (F-055's "clamped with the reason").

## D-177 · 2026-10-07 · stage 6 (chat C1, CS-9) · by: assumed (architect)
WHAT IT SEES's rows and AS SENT JSON come from the server (`markBlock` through `POST …/mark/preview`), fetched when the disclosure opens, so the chip shows exactly what the turn sends; the chip's own label is computed on the client (display only).

## D-178 · 2026-10-07 · stage 6 (chat C1, F-051) · by: assumed (architect)
The chat e2e (`chat.spec.ts`) runs on the `score` project's stack (fake Ollama 8102, fake yue-server 8103, server 3102, Vite 5184), where `LLM_API_URL` and `YUE_API_URL` are already set: no new ports. The fake Ollama gains chat replies read from `server/test-fakes/data/sp5-replies.json` plus hold and offline switches; the fake yue-server replays `/v1/splices` from the recorded splice contract fixtures. The golden path is unchanged.

## D-179 · 2026-10-07 · stage 6 (chat C1, F-052) · by: assumed (architect)
A failed analysis is stored (`{analysis_v, versionId, failed, at}`) so FAILED + RETRY survive a reload; RETRY queues a new job (`POST …/analysis/retry`). With no reading of the current version's bars the strip is hatched and a mark is seconds only; such a turn's MARK block says "bars not read" and sends no bars.

## D-180 · 2026-10-07 · stage 6 (chat C1, CS-4, CS-11) · by: assumed (architect)
One rule, `barShift`, decides whether a version moved bars relative to its base: REHARMONIZE, SET TEMPO, TRANSPOSE, EDIT STYLE, REWRITE LYRICS and WRITE PHRASE keep them; a spliced or score CUT / REPEAT moves them with a known shift (USE BARS offered); a repaint keeps them; a retake, regenerate, new take, ACE-Step or unknown version moves them with no shift. It drives both the strip's dim-vs-hatched state and stale marks.

## D-181 · 2026-10-07 · stage 6 (chat C1) · by: assumed (architect)
DT-C1 is `pipeline/design/chat-mark.html` (the strip and mark on the real player above the composer at 1366×768, thread ≥ 400 px), before CL-8a/b. C1 can split after F-053: C1a (analysis, strip, e2e), then C1b (the mark).

## D-182 · 2026-10-07 · stage 6 (chat C1) · by: assumed (architect)
WORDS in the automatic analysis is skipped when `versions.word_timings` already holds a reading, and runs otherwise; `LYRICS_API_URL` unset skips it with "no word timings" (not a failure). If CP-C1 shows lyrics-server's model pushing the planner off the GPU (R-031), the automatic analysis drops WORDS and the Editor keeps reading timings on demand.

## D-185 · 2026-10-07 · stage 5 (DT-C1, chat-mark.html) · by: assumed (ux-mocker), owner sign-off pending
The defaults of design/chat-mark.html MK-1..MK-10: player above the composer at 134 px with no lyric lane; reading line on its own row (Q-114); neutral reading text, rust only on failure; strip live / dim / hatched; one sky mark, seconds-only dashed; click on empty waveform seeks and clears (Q-116); snap on landing (Q-117); Alt-free edge reads in seconds (Q-118); one composer line (consequence, analysis wait, stale) under the chip; SEND live during an analysis.
- instead of: the options listed per decision in the page.
- revisit if: the owner's sign-off or a 1366x768 browser check shows the thread under 400 px.
## D-183 · 2026-10-07 · stage 7 (C1 CL-2) · by: assumed (builder, recorded by the conductor)
yue-server's two C1 routes answer errors with a dict `detail: {code, message}` (`no_grid` 404, `bad_grid` / `bad_score` 422) so the server can branch on a code; older routes keep plain-string details. `agreement` is null, not NaN, for a chord-free score.

## D-184 · 2026-10-07 · stage 7 (C1 CL-3) · by: assumed (builder, recorded by the conductor)
CL-3 (#192): a version's lineage is `params_json.basedOn`, else the version made just before it on the same layer (repaint/retake store no source); a truncated render, or a plan with two CUT/REPEAT ops, counts as moved bars with no shift; `composeShifts` keeps a shift only when exactly one version in the chain moved bars. A strip section's `lines` counts word segments touching it and `partialLines` those crossing its edges; YuE2 lines come from the same-label lyric block. A hatched older reading has `bars: null` and keeps its seconds for drawing only. `analysisTypes.ts` re-implements reading.ts's words/score shape checks (not exported there) — fold them together when reading.ts is next touched.

## D-186 · 2026-10-07 · stage 7 (C1 CL-0, F-051) · by: assumed (builder, recorded by the conductor)
The chat e2e (#194) uses the contract song: after the recipe card, a hand edit of the draft sets the contract style and lyrics and clears tempo, key, meter, language and structure, so the recorded read/apply fixtures match. The edit reply is SP-5's ED03 envelope carrying apply-set-tempo's ops (88 BPM). The stale step is USE v1 → card planned on v1 → v2 re-activated in the Editor → APPLY refuses STALE (no recorded apply exists for v2's score). The `/v1/splices` replay exists but no step reaches it (SET_TEMPO re-renders the whole song).

## D-187 · 2026-10-07 · stage 7 (C1 CL-7) · by: assumed (builder, recorded by the conductor)
CL-7 (#195): the client's wire types follow CL-3's analysisTypes.ts; 409 MARK_STALE body is `{error, reason, was, shift}` (CL-5 told to match); bars from `shift.atBar` move by `delta`, a bar a CUT removed or a mark split by the change gets no USE BARS; a sent mark's label is computed client-side unless the server stores one; the view has no song length, so mark gestures take the playing audio's duration from the player (CL-8a must pass it). Copy strings not in a mockup ("COULDN'T READ v5 · …", "READING v5 · SCORE · 2 OF 3") wait on DT-C1's sign-off.

## D-188 · 2026-10-07 · stage 7 (C1 CL-4) · by: assumed (builder, recorded by the conductor)
CL-4 (#197): the analysis reads no audio trim (C3's 360 s trim not applied); RETRY on an already-read take answers 409 "vN is already read", RETRY while one waits answers 202 with that job; a failed record counts as analyzed, so only RETRY re-reads it; `ensureAnalysis` is optional in the router deps (tests omit it). The two new yue clients decode D-183's dict detail; `engineClient.failure` still reads a string detail. The "APPLY queued behind a running analysis is not refused" case rests on CL-1's tests and the FIFO trigger test — CP-C1 (CL-6) must show it live.

## D-189 · 2026-10-07 · stage 7 (C1 CL-5) · by: assumed (builder, recorded by the conductor)
CL-5 (#198): a carried mark's seconds are re-timed from the new bar times, a seconds-only mark is carried as is; a stale turn fails with cause `stale` and "<reason> · nothing changed · mark again"; the MARK block reads sections, key and tempo only from the version's analysis so the preview and the turn match (no analysis → bars as marked; bar times not read → no bars, D-179). The analysis is not added to the general song-state block. The MARK block grows the edit prompt — CP-C1 measures p95.

## D-190 · 2026-10-07 · scope (owner) · by: owner
Owner: add the half/double-time fix of a transcribed score to the list after C1. Conductor's finding: SheetSage2 builds the ABC from separate saved outputs (melody MIDI, beats, chords, keys, structures; `generate_abc_from_data`), so a transcription can be "scaled" to a named BPM by correcting the beat list and rebuilding — no model re-run. Recorded as "Re-time a transcription" in scope.md "Later (chat)"; checked against the real outputs and the yue-server retention sweep when it is planned.

## D-191 · 2026-10-07 · stage 5 (DT-C1) · by: owner
Owner signed off pipeline/design/chat-mark.html and chose option B for Q-114 (the reading line on its own row, 19 px). D-185's MK-1..MK-10 and the Q-116..Q-118 defaults stand.

## D-192 · 2026-10-07 · stage 7 (C1 CL-8a) · by: assumed (builder, recorded by the conductor)
CL-8a (#199, draft until CL-6): a new `chatAnalysisStore` (zustand: view fetch, job polling every 1.5 s, RETRY; a `none` view for an unread take is re-read up to 3 × 2 s) is shared with CL-8b. Deviations from the signed-off mockup: a hatched strip has a seconds ruler (the server sends `bars: null`); the reading line uses CL-7's copy "READING v5 · SCORE · 2 OF 3" instead of the mockup's step chain "WORDS ▸ SCORE ▸ SECTIONS" with the step underlined, queued text in text-mid; the transport keeps the shared Player's volume and DOWNLOAD; the strip is blank while A/B plays another take; sections sit on the time axis when they have seconds, else flex by bars. Thread 454 px at 1366×768 (≥ 400).

## D-193 · 2026-10-07 · stage 7 (C1 CL-8b) · by: assumed (builder, recorded by the conductor)
CL-8b (#203, draft until CL-6): a stale mark blocks new drags and section clicks until USE BARS or CLEAR MARK (clicks still seek); the composer line order is stale > the turn's notes > the analysis wait > the consequence; SEND sends the chip's label so the echo matches the chip; USE BARS stays off until the new version's bars are read; the e2e fake YuE takes last as long as the recorded contract score (179.3 s). Deviations from the signed-off mockup: no SEEN ▾ on the echo; no 6 s "MARK SNAPPED" line (Q-117, the snap happens on reconcile); the free tag omits "BAR 34 + 0.4"; waveform bars inside the mark are washed, not recoloured sky; the stale card is a rust box. Not seen end to end: the cross-section label, a clamped mark, USE BARS (no fixture shifts bars) — CL-9 live.

## D-194 · 2026-10-07 · stage 7 (C1 CL-6, Q-119) · by: owner
CP-C1 (pipeline/cp-c1/2026-10-07): 4 of 5 stop lines pass (0 commits refused by an analysis, APPLY waited 15-18 s and started when it ended; slowest analysis 30 s; planner 10.9/10.9 GiB on the GPU after every analysis, R-031 not seen; prompt p95 5938 of 6000); STOP on marks: 2 of 2 seconds-only marks were planned outside the mark (markBlock sends no bars for a time-only mark). Owner: a seconds-only mark is snapped to bars at SEND when the version's bar times exist and bounds the plan like any bar mark; with no bar times the turn answers in words and offers no edit until the reading lands. Also to fix before CL-8a/8b merge: Q-120 (`/v1/scores/bars` starts not strictly increasing → the whole reply rejected, strip hatched: Acid Houzzzz v1-v3, eventide) and strip sections showing 0 lines while the reading has 35/12.

## D-195 · 2026-10-07 · stage 7 (C1, Q-119 fix) · by: assumed (builder, recorded by the conductor)
A seconds-only mark snaps to the bars at least half covered by it, else to the bar holding its middle (`markSnap.ts`), applied after `resolveRange` so SEND, the preview and the turn agree; the time label is dropped and the echo is built from the bars. With no bar times, `TurnState.timeMark` removes `edit` from the allowed actions and the MARK line asks for words (D-194).

## D-196 · 2026-10-07 · stage 7 (C1, Q-120 fix) · by: assumed (builder, recorded by the conductor)
`/v1/scores/bars` (`score_bar_times.py`) no longer reuses the splice's clamping fit: bars before the first downbeat go a median bar length back each, clamped at 0 (bars still meeting at 0 split the first seconds evenly — a guess for offsets of -2 or less); bars past the last downbeat are left out, so `starts` can be shorter than `bars`; no bar inside the audio → 422 `bad_grid`. The server stays strict on order. Strip sections pair the k-th section of a kind with the k-th lyric block of that kind (D-066 d); 0 lines on transcribed songs is not reproduced yet — CL-9 checks it on a real song.

## D-197 · 2026-10-08 · stage 7 (C1, CP-C1 re-run) · by: conductor
CP-C1 mark re-run (pipeline/cp-c1/2026-10-08, #211): 0 of 12 marked turns planned outside the mark (5 seconds-only, Cariñito 1:59-2:18 → 48-55 → REHARMONIZE 48-55); bar times ordered, Acid Houzzzz and eventide strips live; line counts no longer 0 (Acid Houzzzz reads 0 lines in total: nothing sung was read); prompt p95 5906 (max 6180, thin: 3rd planner attempts on long REHARMONIZE marks). CL-8a/CL-8b leave draft. Assumed: a transcribed score longer than its audio (eventide 80 bars vs 41 heard) shows only the sections the audio holds, a crossing section truncated, and the reading line says how many bars are not shown (fix/chat-strip-past-audio).

## D-198 · 2026-10-08 · stage 3 (SP-6 ear half, R-030, F-050) · by: owner
Owner's blind SP-6 listen (spikes/SP-6-instrument-hold/owner-listen.json): FB held the instruments ("same") on Acid and Funky but the chords did not change (Acid) or only partly (Funky); on Gertar F and FB were "different", worse than A; A was "tiny / a bit different" with the chords clearly changed on 2 of 3. Holding the sound costs the edit. Owner: keep today's render (A); the edit card's consequence line says the re-sung bars' instruments may change; F-050's "the rest sounds the same" is read as outside the edited bars, where the splice is sample-identical to v1 (null test), so the C0b listen (D-170: join not found 5/5, edit clear 5/5) passes it. No token sidecar or forced prefix. R-030 accepted. Reversal: build FB as a second APPLY choice ("keep the sound") from SP-6's RESULT.md.

## D-199 · 2026-10-08 · stage 8 (C1 review fixes, #215) · by: assumed (builder, recorded by the conductor)
A repaint (and an ALT/SIMILAR of one) stores `basedOn` = the layer's active version at job start (params_json only, never sent to ACE-Step); the reading chain and barShift trust only `basedOn`, so a version without one (older repaints, a deleted parent) counts as moved by an unknown amount: the mark is not carried, the older reading hatched. A mark across SET TEMPO is stale until the new version's bars are read (no tempo-ratio re-timing): a seconds-only mark is always stale across it; a bar mark carries once the new bar times exist, its seconds re-timed from them; the stale card names the tempo change and USE BARS waits for the reading. `cancelAnalysis` removed (Activity's cancel/abort cover it).

## D-200 · 2026-10-08 · stage 7 (C1 live fixes, B1) · by: assumed (builder, recorded by the conductor)
A stored reading is complete only when every step that ran (plan source not `skip`) read its part, or yue-server answered that it cannot (`answered`: a 4xx from `/v1/scores/bars`, or no downbeat grid). Otherwise the view's state is `failed` with `<STEP> · <why>` and the read parts still draw the strip; the job and RETRY read it again. An unset service (`skip`, e.g. LYRICS_API_URL) stays NO WORD TIMINGS, not an error. The auto trigger still counts any stored record as analyzed (D-188). Records stored before this fix carry no `answered` flag, so a legacy bar-fit refusal also reads as failed with RETRY.

## D-201 · 2026-10-08 · stage 7 (C1 live fixes, B2, B3) · by: assumed (builder, recorded by the conductor)
With a mark (bars), a whole-song op (SET TEMPO, EDIT STYLE, TRANSPOSE, any op with no bars or section) is left out of the edit schema and refused by markFit, unless the request reads as the whole song (`asksWholeSong`: whole, entire, throughout, everywhere, all over, all of it/the song, every section/part/bar). The retry feedback names the mark: "the mark covers bars X-Y, and a whole-song change needs the person to ask for it". Under a mark the card drops an assumption that names a place (bars N, a section word, the whole song); the mark line says where.

## D-202 · 2026-10-08 · stage 7 (C1 live fixes, B5, B6) · by: assumed (builder, recorded by the conductor)
The stale copy says "they are now bars X-Y" only when the numbers changed; equal numbers read "vN moved other bars; these are still bars X-Y". The MARK block (WHAT IT SEES, the prompt) rounds seconds as the chip does. Left as they are: the card's own 1 s difference and the reading line's total vs the strip's per-section sums (B4): neither has a one-line fix.

## D-203 · 2026-10-08 · stage 4 (engine pairing, Q-121, P1) · by: owner
The "never modify ACE-Step-1.5" rule is dropped (owner: "if the fork is necessary, rebase; throw away the no-edit rule"). The fork is necessary: Mulakai calls `/lyric_timestamp`, which upstream has no REST equivalent for (`/v1/analyze_audio` could move to upstream's `full_analysis_only` later). Done: the five local commits (`64ffc2f`, tagged `backup/local-analyze-audio-2026-10-08`) were replayed onto upstream `ca1e85f` as branch `mulakai` (`1a9ae64`: four commits, the merge commit dropped; conflicts in `route_setup.py`, `api_server.py`, `docs/en/API.md` resolved as the old merge did). The rebased tree runs 235 API unit tests with 17 errors, the same 17 pure upstream `ca1e85f` errors on (stale upstream tests, one Windows path); all 13 of ours pass. The existing `.venv` already meets the new requirements (torchao 0.16.0, python-multipart 0.0.22). The live checkout stays on `local/analyze-audio` until ACE-Step is next stopped, then `git checkout mulakai`. Rule now (CLAUDE.md, AGENTS.md): ACE-Step-1.5 is Mulakai's fork, edited when Mulakai needs to, kept as commits on top of upstream `main` and rebased when upstream moves. CLAUDE.md's launch line is fixed in the same change (P4: `acestep-api`, not `acestep --enable-api`).

## D-204 · 2026-10-08 · stage 3 (SP-4 ear half, R-024) · by: owner
The owner will not judge SP-4's remaining 10 listen pairs. R-024's ear half is closed on the evidence already in: the 10 riskiest short pairs (D-147, D-150) settled which edit kinds splice and which re-render the whole song; the C0b listen of 5 real chat edits found no join (D-170); SP-6 settled what changes inside the edited bars (D-198). The full pack stays at pipeline/spikes/SP-4-keep-unchanged/listen/index.html if a doubt comes up.

## D-205 · 2026-10-08 · stage 3 (SP-5 lyric read, R-027) · by: owner
Owner's read of SP-5's lyric sets (lyrics.html): English 4/4 usable; German 0/3 ("unnatural wording, the lines don't sing well"); Spanish not read (owner doesn't speak it) — the assistant's read: A 1 usable / 1 borderline / 1 not (RC09 reads as a ballad, not reggaeton), B 2 usable / 1 borderline. German B (separate lyrics call) is no better (assistant's read: grammar slips, lines that mean the opposite, weak rhyme). Below SP-5's bar (8/10), so the lyrics step moves to rung 3 (a separate lyrics call) — it helps Spanish but not German; the German gap is the planner model's German. Owner: spike other local models for the lyrics step (SP-7, R-038); downloads of gemma3:12b and mistral-small3.2:24b approved. Rung 3 is wired together with SP-7's model choice.

## D-206 · 2026-10-08 · scope (RT, D-190) · by: owner
"Re-time a transcription" fixes both consumers — the C3 cover's TRANSCRIBE score and the C1 chat reading's score — and surfaces in all three places offered: the cover panel, the SCORE dock (a RE-TIME op beside SET TEMPO) and a chat verb; the reading is re-timed from the chat (verb and reading line). Planned as milestone RT, F-090..F-094 (scope.md "RT").

## D-207 · 2026-10-08 · scope (RT, D-190) · by: owner
The transcription's SheetSage2 outputs are kept (yue-server sweeps its jobs after 24 h and keeps them in memory only), so re-time rebuilds from them at any time; a score or reading with no kept outputs offers TRANSCRIBE AGAIN. No mechanical ABC rewrite fallback.

## D-208 · 2026-10-08 · scope (RT) · by: assumed (conductor)
Feature track normal (stored data, a yue-server route, new UI). The bundle is kept by the Mulakai server as one content-addressed JSON file under `DATA_DIR/notation/` (the five `notation/song_*` files), referenced by `notationId` from the cover's base version `params_json` and the reading in `analysis_json`; no backfill, an unreferenced bundle older than 30 days is swept at start. Order RT-1 yue-server rebuild → RT-2 keep + server route → RT-3 cover panel → RT-4 SCORE dock op; RT-5 reading after C1 merges, RT-6 chat verb after C2. Reversal: ignore the field and files.

## D-209 · 2026-10-08 · stage 5 (DT-RT, design/retime.html) · by: assumed (ux-mocker), owner sign-off pending
RT-1..RT-8 of the mockup: one READ AS row (reading in words, then HALF · DOUBLE · BPM… sky chips) on the cover panel, the chat reading card and the dock; press then confirm, with a consequence line before the press (beat: apply at once + UNDO); acid outline for the free no-GPU re-time (cover panel, reading), filled acid APPLY & RENDER where YuE2 re-renders (dock, a turn); "slightly off" (±8 % of the read, not near ×2/×½) shows a hint or a SET TEMPO proposal, never RE-TIME; the stale piano preview is dimmed and tagged, not hidden (Q-127); a re-time in a reading says bar numbers change and a mark goes stale; RE-TIME stands alone in a plan (Q-132). Open: Q-127..Q-132, with Q-125/Q-126.

## D-210 · 2026-10-08 · stage 3 (SP-8, R-039) · by: assumed (conductor)
SP-8 (pipeline/spikes/SP-8-retime-rebuild/RESULT.md): the rebuild works from the kept `notation/` bundle (24 KB) in 7-25 ms on CPU; an unchanged rebuild is byte-identical to the saved score; chords and `% section` labels survive every variant; DOUBLE loses no notes; HALF and grids slower than the read tempo drop 5-26 % of notes because SheetSage2's grid is fixed at 4 subbeats per beat (8 breaks its ABC unit length). Measured on songs read correctly, so a real double-time misread should lose less. So: yue-server runs SP-8's `fit_midi` pass before `generate_abc_from_exports`, the route returns `dropped_notes`, the consequence line names it and warns above 10 %; HALF/DOUBLE come first, a typed BPM second; the BPM grid is anchored once at the first downbeat. Revisit if: owner listens find the dropped notes matter, then a finer SheetSage2 grid (fork change) is the next step.

## D-211 · 2026-10-08 · stage 5 (DT-RT, design/retime.html) · by: owner
BPM… is a chip that turns into its own text input in place, focused. A click outside reverts it to the BPM… chip with no BPM set (Esc too). Enter locks the BPM, and the field shows only an enter icon (↵, no text; owner) that does the same when clicked (the chip's own place, so "clicking the BPM button again" locks). A locked BPM is the picked mode (sky chip "92 BPM") and only then does the consequence line and RE-TIME appear. Assumed: clicking a locked chip reopens the input with its value, and clicking away again clears it (the owner's literal rule); Enter on an empty or out-of-range value does not lock but turns the field rust with the reason. Same control in the cover panel, the chat reading and the SCORE dock. Drawn as A′1-A′5 plus a live TRY IT row.

## D-212 · 2026-10-08 · stage 5 (DT-RT) · by: owner
Owner signed off pipeline/design/retime.html with press then confirm (Option 1): a mode is picked (HALF, DOUBLE, or a locked BPM per D-211), the consequence line shows, and RE-TIME AT n BPM (or APPLY & RENDER where YuE2 re-renders) runs it. D-209's RT-1..RT-8 and the Q-125..Q-132 defaults stand. RT-1 (`feat/retime-yue`) starts.

## D-228 · 2026-10-08 · stage 7 (C1 done) · by: conductor
C1 closes: F-051..F-055 pass (CL-9 live + re-check, pipeline/c1-live.md, #217/#224); CP-C1's 5 stop lines pass (pipeline/cp-c1/2026-10-07, -08, -08-p95: 0 commits refused by an analysis, slowest analysis 30 s, planner fully on the GPU, 0 of 14 marked turns outside the mark, prompt p95 5339 after #225); code review 0 blocking, 2 should fixed (#215). Curated into chat-server.md / chat-client.md. Left open: Q-137 (WRITE_PHRASE on chords-only requests), REPEAT of a song's last section (separate task), B5's 1 s card time.
## D-213 · 2026-10-08 · stage 7 (C1 N1) · by: agent
A REPEAT of the song's last section is not spliced (amends D-154): `spliceEligibility` answers whole-song re-render up front, and the card says why before APPLY ("the outro ends the song: its last bar is the ending, so the old audio has nothing to play the copy after"). Measured on Cariñito v1 (SheetSage2 grid, outro bars 56-64): the last bar is the ending (-17 to -70 LUFS in 2.0 s of a 2.52 s bar), so the copy's seam at the audio's end snaps at corr 0.139 (< 0.15, `not_aligned`), which is N1. A seam one bar earlier aligns (0.43), but a splice there repeats 8 of 9 bars and the edited score has all 9 twice, so no bar-exact audio exists; estimating the end bar past a ring-out tail does not help a song whose ending is its last bar. CUT of the last section keeps its edge-fade splice.

## D-231 · 2026-10-08 · stage 7 (RT-3, F-091) · by: assumed (conductor)
RE-TIME in the cover panel (RetimeRow, BpmChip, bpmField, retimeRules, useRetimePreview). HALF, DOUBLE and BPM… always start from what SheetSage2 read, never from an earlier re-time, so a lossy half time is never halved again. The row keeps "READ AS <the reading>" and adds "· RE-TIMED TO n BPM", where the mockup's A5 redrew the row at the new tempo. Picking a mode runs the rebuild at once (CPU, under a second), so the consequence line names the real bars and dropped notes before the press (D-210, D-212); RE-TIME AT n BPM only applies that result. UNDO is one step back to the reading. A score that has a transcription but no kept reading (null notationId, or a 404) shows the rust GONE box with TRANSCRIBE AGAIN, which re-runs the panel's own TRANSCRIBE. GENERATE COVER sends notationId (F-093 later). The piano preview is not redrawn: it dims with STALE · n BPM (Q-127 default). The slightly-off rule is ±8 % (Q-125); the cover panel's hint points at the dock's SET TEMPO (Q-130). DESIGN.md "READ AS" records the look.
## D-227 · 2026-10-08 · stage 6 (chat C2, F-058, Q-136; renumbered from D-213, which C1 N1 took on main) · by: assumed (architect)
REVISE in the chat is decided by the server, not a button: when a turn starts on a song thread whose live edit card holds the song's pending plan (`planStore` id) and the song's fingerprint is unchanged, every edit reply of that turn is a revise `{action: 'edit', drop, ops}` merged by `mergeRevise` (D-073, D-076) and applied to the base as read; the new card is plan n+1 with `since`, the old one reads superseded ("revised below"). Dropping every pending op and returning new ones is a replacement, shown as all REMOVED + NEW. A `say` / `ask` / failed turn leaves the card pending. No pending card, or the song changed → a fresh plan, as today. docs/decisions/0010.
- instead of: a REVISE button on the card (a second commit-like control); a `revise: true` flag the model sets (a choice SP-5 never measured); the card updated in place (the thread is append-only).

## D-214 · 2026-10-08 · stage 6 (chat C2, F-058 × F-055) · by: assumed (architect)
Under a mark, a revise bounds only the returned ops to the mark (`markFit`, D-176, D-201); kept pending ops stay SAME even when they lie outside it; the card's mark line names the turn's mark.
- instead of: refusing a revise whose pending plan reaches outside the new mark.

## D-215 · 2026-10-08 · stage 6 (chat C2, F-060) · by: assumed (architect)
The bar map replaces C0b's span strip in the edit card (one map, EC-2's place). It is built on the server (`chat/barMap.ts`, pure) from the facts the planner saw: the sections, the bar count and each op's bars (REWRITE LYRICS → the section its block pairs with; SET TEMPO / TRANSPOSE / EDIT STYLE → whole, hatched), stored as `EditBody.map` (additive). A card from before C2 keeps the strip from `splice`.
- instead of: building the map on the client (it has no facts and would need a fourth pairing copy); a map beside the strip.

## D-216 · 2026-10-08 · stage 6 (chat C2, Q-052 #3 server half) · by: assumed (architect)
One server pairing rule, `score/lyricPairing.ts` (`kindOf`, the k-th section of a kind sings the k-th block, D-066 d), replaces the copies in `analysisView`, `markBlock`, `markFit` and `planReferent`, cross-tested against yue-server's `read-sections.json`. The client's `lyricsBlocks.matchSectionBlocks` (the Editor's) is left as is, so Q-052 #3 stays open for the client half.
- instead of: a fifth copy in the lyrics panel.

## D-217 · 2026-10-08 · stage 6 (chat C2, F-056) · by: assumed (architect)
The lyrics panel's data rides in C1's analysis view as `shown.lyrics`, computed at read time by pure `chat/lyricsPanel.ts` from the shown reading (current, or the older dim one) and the version's stored lyrics (`params_json.request.lyrics`): a YuE2 version's tagged blocks, checked against `facts.lyric_blocks` (tag, line count, first line, as D-072) and paired with the strip's sections; a transcribed version's heard lines (word-timing segments) with their seconds. A mismatch shows a note and no lines, never a guess. No new route, nothing stored.
- instead of: a separate lyrics route (a second poll and a second "which reading is shown" rule); building it on the client from SongDetail (a client pairing copy).

## D-218 · 2026-10-08 · stage 6 (chat C2, F-056, LY-5) · by: assumed (architect)
A YuE2 line's time comes from the client's existing `alignLyrics` (the Editor's word-timestamp alignment) over the version's word timings, indexed by the server's `textLine`; a heard line carries its seconds. A line with no time (no word timings, or not aligned): click marks its section, double-click plays from the section start; a section partly inside a mark with untimed lines lists all its lines with "lines not timed".
- instead of: a server port of `alignLyrics` (two implementations); line bars from the ABC on yue-server (a read-contract change that re-records every read fixture).

## D-219 · 2026-10-08 · stage 6 (chat C2, F-056, LY-1) · by: assumed (architect)
On a song thread the sidebar is the song panel: VERSIONS, STYLE (the version's), TEMPO · KEY (the shown reading's header), then the lyrics panel; the locked draft fields are no longer shown there. LY-1's fourth row (the dock) is not built in C2 (Q-135): the chat's scalpel verbs are C7.
- instead of: keeping the locked draft fields above the panel (the draft is the first take's, not the playable version's).

## D-220 · 2026-10-08 · stage 6 (chat C2, F-059, Q-134) · by: assumed (architect)
UNDO TURN is a server record: a recipe reply's body stores `undo: {rev, before, fields}` (the values it replaced; absent = was empty), written in the merge's transaction. `POST …/messages/:messageId/undo` restores a field only when it still holds that turn's value and has no hand edit after `rev`; others are kept and named; one undo per turn; refused on a song thread, while a turn is open, without a record, or when already undone. The recipe card stays live and mirrors the draft (TU-7). Messages from before C2 offer no UNDO.
- instead of: a client-only undo from the session's `filled` marks (lost on reload, blind to a hand edit in another tab); dropping the recipe card on undo.

## D-221 · 2026-10-08 · stage 6 (chat C2, F-059, CH-4) · by: assumed (architect)
The just-filled marks are derived from the latest recipe message's `undo` record while no later user message exists, so they survive a reload; a hand edit turns that field YOURS (`fieldMark`, as today). Older messages keep the session-only marks.
- instead of: session-only marks (today, C0a).

## D-222 · 2026-10-08 · stage 6 (chat C2, F-057, Q-073/Q-074) · by: assumed (architect)
A pending REWRITE LYRICS shows in the panel (old struck above new, or the section appended in song order tagged PROPOSED when it is outside the mark) only while its edit card is `pending`; "until APPLY or dismiss" reads as until the card is done, superseded, stale or expired (there is no dismiss control). The card's OLD | NEW already exists (code: `ScorePlanList` → `ScoreLyricDiff`).
- instead of: a DISMISS control on the edit card.

## D-223 · 2026-10-08 · stage 6 (chat C2, R-040) · by: assumed (architect)
CP-C2 (CV-5), a headless checkpoint on the real machine after CV-1 and before the revised card's UI (CV-7): 12+ revise turns on 3 YuE2 songs; stop lines in architecture.md "Test strategy (C2)" #7 (prompt p95 over 8,000 tokens or any context refusal; any silent op loss; additive losses over 3 of 10; over 2 of 12 failing). The lyrics panel and UNDO have no GPU risk and need no checkpoint; CV-9 checks the line alignment live (R-041).
- instead of: going straight to the UI on fakes (Q-050's losses were found live, not in tests).

## D-224 · 2026-10-08 · stage 6 (chat C2, e2e) · by: assumed (architect)
One e2e spec per user-visible package, named `*.chat.spec.ts` so the score project's `(score|chat)\.spec\.ts$` runs them with no `playwright.config.ts` change: `lyricsPanel.chat.spec.ts`, `revise.chat.spec.ts`, `undoTurn.chat.spec.ts`; C1's `chat.spec.ts` and `chatFakes.ts` unchanged. The revise step reuses recorded fixtures: plan 1 `apply-set-tempo`, its revise adding REHARMONIZE 47-50 merges to `apply-compound`'s ops in order; the panel's diff uses `apply-rewrite-lyrics`.
- instead of: growing `chat.spec.ts` (245 lines, owned by C1's re-check).

## D-225 · 2026-10-08 · stage 6 (chat C2, Q-115) · by: assumed (architect)
Q-115 is closed by D-093 (owner): no lyric lane under the waveform; marking a lyric line happens in the sidebar panel (LY-5), so the player keeps its C1 height.
- instead of: the 21 px lane CS-4d sketched.

## D-226 · 2026-10-08 · stage 6 (chat C2, DT-C2) · by: assumed (architect), owner sign-off owed
C2 needs a design task before its UI packages: `pipeline/design/chat-converge.html` (scope.md "C2" DT-C2): the song sidebar and panel at 1366×768 with C1's player above the composer, the revised edit card, the bar map at 32 / 120 / 200 bars, UNDO TURN's states. chat-lyrics.html drew the panel with the player at the top (before D-095) and no mockup drew a chat REVISE card, a bar map (F-036's edge named a stage 5 task) or UNDO's after-state. The owner signs it off before CV-6..CV-8 merge.
- instead of: building from chat-lyrics.html and score-m2.html as drawn.

## D-230 · 2026-10-08 · stage 5 (chat C2, DT-C2, Q-140..Q-144) · by: assumed (ux-mocker), owner sign-off owed
`pipeline/design/chat-converge.html` (CX-1..CX-4) draws C2's UI. Defaults used: the song sidebar is VERSIONS, STYLE, TEMPO · KEY, then the panel, with C1's player above the composer; a pending rewrite shows old struck above new, a PROPOSED section outside the mark; the superseded edit card dims in full (Q-140); a revised card keeps the dock's PLAN n / SINCE / NEW · CHANGED · SAME / REMOVED vocabulary and failures are rust lines under the message with the live card kept; the bar map is one row to 200 bars at 2 px minimum a bar (Q-141), the hovered row lights its bars solid sky (Q-143), whole-song ops are hatched, a CUT is hatched grey; UNDO TURN is a link on the CHANGED line, replaced by UNDONE · restored … · kept …: reason (Q-142); APPLY on the old card is off while a revise runs (Q-144). DESIGN.md gets the panel's clause in CV-6 and the bar map's in CV-7; UNDO needs none. No new token or hue.
- instead of: a REVISE button, a folded superseded card, a two-row 200-bar map, a toast for UNDO (each drawn or named in the page's Options and Decisions).

## D-229 · 2026-10-08 · stage 5 (DT-C2, design/chat-converge.html) · by: owner
The owner signed off pipeline/design/chat-converge.html (D-226's gate for CV-6..CV-8) and took every default in D-230: Q-140 A (the superseded card stays dimmed in full, REVISED BELOW, no APPLY), Q-141 A (a 200-bar map in one row, 3.65 px a bar, labels thinned), Q-142 (UNDO TURN stays on older turns and names each kept field's reason), Q-143 (a change-list row lights its bars on hover and keyboard focus), Q-144 (APPLY on the pending card is off while a revise runs, back on if it fails or is cancelled).

## D-232 · 2026-10-08 · stage 3 (SP-7 owner read, R-038) · by: owner
Owner's blind read (spikes/SP-7-german-lyrics/owner-read.json): German usable gemma3:12b 4/6, gemma4 26B-A4B 4/6, mistral-small3.2 0/6, qwen3:14b 0/6; no single model reaches 5/6, but the two gemmas fail on different requests and together cover 6/6. Owner: German lyrics get two drafts, one from gemma3:12b and one from gemma4, and the person picks one on the card; English and Spanish stay on qwen3:14b (Spanish 3/3 by the assistant's read). Cost: an extra model load per German song (~4 s gemma3, ~19 s gemma4, partly CPU-offloaded at 16k). gemma4 leaked "Mulakai" from the system prompt into one lyric — the build needs a guard. Built as a feature after this (its own session; touches the chat recipe/lyrics step). R-038 moves to "check chosen, build owed".


## D-240 · 2026-10-08 · stage 7 (RT, F-091 verify; RT-4 scope) · by: owner + assumed (conductor)
Owner: RE-TIME in the SCORE dock (RT-4, F-093) is offered only while a cover's score is still its transcription, or an earlier re-time of it. Sections left out in Create stay left out, matched by name. After any other SCORE edit it is hidden, with a line saying why. Assumed (conductor): the GONE box's TRANSCRIBE AGAIN says it uses the GPU but gives no minutes. No calibrated TRANSCRIBE figure exists, and Q-099/D-157 keep invented GPU seconds out of the copy. F-091's acceptance line 2 is amended to match, and the minutes come once CP-C3 calibrates them. The verifier's two stale-state finds (a pending preview after UNDO, a pick carried to another score) are fixed by remounting the row per score (`retimeRowKey`).

## D-239 · 2026-10-08 · stage 7 (RT-4, F-093) · by: assumed (conductor)
RE-TIME in the SCORE dock is a planStore plan that no planner made, built by `POST /api/songs/:id/score/retime`. The steps: rebuild the score from the kept reading; yue-server keeps the cover's sections by name (`keep_like`, so sections left out in Create stay out, D-240); then size it through `/v1/scores/apply` with a SET TEMPO at the new tempo, which changes nothing but returns the usual checks. So APPLY & RENDER, its re-checks, the version label ("score edit · RE-TIME n") and the chat's shared path need nothing new. The plan carries one RETIME op `{mode, bpm, from_bpm, dropped_notes, notes}`, `attempts: 0` (the checks line then shows no attempt count), and `retime: {notationId, readBpm}`. The saved version keeps that `retime`, so a re-time of a re-time stays offered, and every re-time starts from the reading (D-231). Any other op on the active take turns it off, with the reason. The reading's tempo comes from the kept beat list (TS median of `song_beats.txt`, not ABC: decision 0002). The planner prompt and opSchema do not know RETIME (the chat verb is RT-6). RE-TIME needs no planner, but it is shown only when SCORE is eligible (planner reachable), because APPLY & RENDER's `/api/ps` check needs Ollama anyway.

## D-241 · 2026-10-08 · stage 7 (chat C2, CV-0, F-060) · by: assumed (builder)
The bar map's `bars` is max(the header's bars, the last section's end), so a header that undercounts hides no section; an op whose section or block is not in the read gets `spans: []`, `whole: false` (never a guessed span); spans clamp to 1..bars. A recipe that changed nothing carries no `undo` key (#230).
- instead of: trusting the header's bar count; guessing a span for an unknown section.

## D-242 · 2026-10-08 · stage 7 (chat C2, CV-3, F-059) · by: assumed (builder)
A repeated UNDO TURN is refused 409 "already undone" and changes nothing (architecture.md said replay 200); an undo is not a hand edit (`touched` unchanged, rev moves only when a field was put back); a non-recipe message answers 409 UNDO_REFUSED (#233).
- instead of: replaying the first undo's 200; 404 for a non-recipe message.

## D-243 · 2026-10-08 · stage 7 (chat C2, CV-6, F-056) · by: assumed (builder), deviates from chat-converge.html
While a mark is shown, the lyrics panel keeps the section just before and just after the mark as one dim context row each (header + the line next to the mark), so shift-click can carry a mark across a section boundary; frame 2b drew a two-section mark with no way to reach the second section. DESIGN.md says so (#244).
- instead of: keeping the full section list under a mark; shift-click only within the shown part.

## D-244 · 2026-10-08 · stage 7 (chat C2, CV-5, R-040) · by: conductor
CP-C2 (pipeline/cp-c2/2026-10-08): prompt p95 5,403 tokens, 0 context refusals, 0 silent losses, 2/21 failures — but STOP on additive drops, 5 of 11 (qwen3:14b fills `drop` with the ops a reply "replaces" even when the request only adds; every drop showed under REMOVED). Also a dropped-and-returned-identical op showed NEW + REMOVED. Fix before CV-7: SAME for an identical re-return, a prompt line that an addition keeps every pending op, re-run; if still over 3/10, a no-removal-words guard that retries once with a named reason (like D-201), never a silent override.
- instead of: building CV-7 on a revise that loses ops on additions; overriding the model's `drop` silently.
