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
