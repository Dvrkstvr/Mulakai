# Scope — Chat (talk a song into being)

<!-- Stage 4, 2026-10-06, for the amended core promise (D-079, D-096; PLAN.md "Chat: Talk a Song Into Being"). NOT signed off: the owner's
     sign-off of THIS cut in chat is the open gate item. Features F-040..F-081 in features.json carry "scope": "chat".
     Supersedes the PLAN.md milestone table (its C0 = spikes, C1..C4): here the spikes are the PRECONDITIONS and C0 is the thin path.
     New assumed defaults and questions are listed at the end of this section with PROPOSED ids; the conductor files them in decisions.md and
     open-questions.md (this stage was told to write only scope.md and features.json). The score-agent scope follows below, intact
     except that its M3/M4 headings point here. -->

What "MVP" means here: the score agent (M0..M2 below) is built and verified. The chat is the new front door onto it. C0 is the whole chat promise
on the real machine, as thin as it can be: describe a song, get a proposal card, CREATE SONG, hear it above the composer, ask for one local edit,
get a version that changed only the asked bars, switch A/B, reload and find the thread. Everything else is judged against what C0 teaches.

## Preconditions (spikes and checks, before any chat code; F-040)

Each blocks the work package named; the first two block everything because they decide whether the chat is worth building as designed.

1. **SP-5, the chat planner** (blocks all of C0; same method as SP-2: scripted cases, schema-checked by code, recorded as a fixture, RESULT.md
   with one row per bar). `qwen3:14b` Q4_K_M, 16k context, reasoning off, through the real Ollama and the real validators. **40 scripted
   conversations** over 5 library songs' real song-state blocks: 10 recipes from a description (4 English, 3 German, 3 Spanish, 3 of them vague);
   6 ask-or-propose cases (3 where nothing can be proposed, 3 near-misses where proposing is right); 10 single edit turns (chords of "the
   chorus", words of chorus 2, slower, a different key, a style change, one with a mark attached, one naming a section that does not exist);
   4 `say` questions about the song; 4 requests that belong to the scalpel (repaint a section with new words, add a layer, split, export);
   2 reference-song requests (`analyze`); 4 multi-turn runs of 3-4 turns (refine a recipe; "no, the second chorus"; an edit after an edit; a
   change of mind). The closed set is tested whole (ask, recipe, edit, scalpel, analyze, say) so the cards of later milestones need no re-spike.
   **Pass bars (default, assumed; D-097):** (a) reply schema-valid on the first try 95% or more, within 3 attempts 100%; (b) the
   action is the right one on 90% or more of the 36 single-turn cases, and `ask` appears on no more than 1 of the 12 must-propose cases and on
   at least 2 of the 3 stuck cases; (c) recipes: every field valid against Guided Create's own rules (key in the 30-name table, tempo range,
   structure tags from the allowed list, style within YuE2's limit) on 90% or more, and the assumption stated on 80% or more of the vague ones;
   (d) lyrics: section tags from the closed list, 4-8 lines per section, no tags inside lines, and the language the request asked for (language
   ID check, tool unverified) on 90% or more per language, plus the owner reads 10 lyric sets (3 per language, 1 spare) and finds 8 usable as a
   first take (owed, not a blocker for starting; below 8 the lyrics step moves to a second call with a per-language prompt); (e) edit turns: a
   plan that passes the existing validators within 3 attempts on 70% or more (D-013's line), the intended section or bars on 80% or more when a
   mark is attached; (f) a turn is p50 15 s or less and p95 30 s or less warm, each turn unloads once and `/api/ps` is empty before the slot
   is released (reuse CP1's harness); (g) the prompt (song-state block + pending proposal + last 4 turns) is 6k tokens or less at p95 on the
   206-bar song, so 16k holds it with the completion. **Ladder if a bar is missed** (shown to the owner before C0 code, as D-005 did): split the
   turn into a router call (one enum) and a per-action call; offer only the actions the state allows; move lyrics to their own call; the MoE
   as an env value (D-024); last, the assistant only fills the form and never routes (the form-first pairing of D-086 becomes the only mode).
2. **The owner's SP-4 listen** (`pipeline/spikes/SP-4-keep-unchanged/listen`, 20 pairs; Q-054 #1; blocks CB-1 (the splice, was W-C0b), and all of C4).
   Outcome goes into decisions.md and PLAN.md decision 6 is cut down to one branch in a docs commit. If the A3 joins are rejected, F-047 is
   re-cut before CB-1 (whole-song re-render plus the explicit "keep the old take for these bars" splice the person listens to). The
   thread/turn/recipe packages (C0a, CA-1..CA-7) do not depend on it and may overlap the owner's listening.
3. **R-025, which ACE-Step launcher `:8001` runs** (five minutes; blocks only C7's scalpel and ACE-Step first takes, F-075 to F-077). Seen
   in SP-4: the `acestep --enable-api` launcher ignores `src_audio`. Check by route or process command line; fix CLAUDE.md's command or the client.
4. **SP-6, shift/stretch** (R-026; blocks only C5/F-070, D-085). Four library songs, 2-3 DSP options, key/tempo accuracy measured and an A/B
   listen against the YuE2 re-render. Not needed for C0; C5 is not built if it fails and RE-RENDER stays the only tempo/key path.
5. Environment as P3 of the score agent below (`LLM_API_URL`, `LLM_MODEL`, `OLLAMA_CONTEXT_LENGTH=16384`, `ACESTEP_OFFLOAD_TO_CPU=true`); the
   chat adds no new variable in C0. `LYRICS_API_URL` joins from C1 (analysis words).

## C0 — The core-promise path, thin (F-041 .. F-050)

What the person can do when C0 is done: on a machine with Ollama and YuE2 set up, open Mulakai (CHAT is the start screen), type "a slow Spanish ballad
about the sea, nylon guitar, soft female voice", read the recipe card, change the tempo in the sidebar by hand, press CREATE SONG, hear the first
take in the player above the composer, type "give the chorus jazz chords", read the edit card ("assuming chorus 1, bars 25-32 · only those bars
change"), press APPLY, hear v2 (bars 25-32 changed, everything else the old take), press BACK TO v1 to compare, reload the page and find the
whole conversation, both versions and the song.

**What is in, and why it is this thin** (each choice reversible in the work packages; D-098):
- **Actions: ask, recipe, edit, say.** `analyze` is C3 and `scalpel` is C7; the model may produce them in SP-5, C0's dispatcher turns them
  into a plain `say` ("not in this version: use the Editor/Guided Create") so a request is never silently dropped.
- **Recipe -> CREATE SONG on YuE2 only**, through the existing first-take job. ACE-Step first takes (D-083) are C7: they add the not-score-editable
  branch and R-025.
- **One edit kind is spliced: a plan that is a single REHARMONIZE.** It is the kind SP-4 proved on 4 of 4 songs (4/4 meter; no 3/4 song was
  tested) and the one the M0 listen made trustworthy. Any other plan (tempo, key, style, lyrics, phrase, structure, several ops) takes the
  whole-song re-render path that already exists (F-023), and the card says "the whole song changes". That is decision 6's own last branch,
  and it keeps C0 to one new audio mechanism. WRITE PHRASE (3 of 4) and REWRITE LYRICS (inconclusive) join the splice in C4 once the listen has
  spoken for them; structure edits (REPEAT/CUT audio-only) are C4.
- **No mark in C0.** The person names the place in words; ambiguity gets the stated assumption and the bars on the card (D-082), and the card's
  consequence line names the bars that change, so a wrong guess is caught before the GPU minutes are spent and fixed by saying "the second
  one". Why not: marking needs the waveform, the section strip and a fresh analysis of every version (CS-3..CS-11, eight states). That is a
  milestone by itself (C1), and C0's promise is checkable without it. The cost accepted: "which chorus" is the one intent failure SP-2 saw.
- **No analyze job in C0.** The song-state block for a YuE2 song comes from `scoreSource` and yue-server's `/v1/scores/read` as today (the
  spliced version's sidecar is the edited score, so it stays true). The splice needs a downbeat grid: it is computed on demand by yue-server's
  transcriber (SheetSage2, `downbeat.lab`) for the base version once, cached by version id, and for the new render. C1's analyze job
  replaces the on-demand call by a prepared cache; nothing is thrown away.
- **No lyrics panel, strip, waveform, UNDO TURN, sky "just filled" marks, REVISE-merge, form-first, Editor-first, start-screen switch.** The sidebar
  is the draft's fields only. A follow-up message while an edit card is pending replaces the card (D-028's rule). The hand-edit rule (skip
  touched fields, say so) stays: it protects the person's typing and is a few lines. Fallback when the assistant is off: the reason, RETRY and
  a FORM link to today's Guided Create (no draft carry-over until C6).
- **Entry** (the owner's, D-099): CHAT is the start screen from C0 when `LLM_API_URL` and `YUE_API_URL` are set; the Library stays one click
  away in the header and gets OPEN CHAT on a song. With either unset the app opens on the Library as today, so the golden-path e2e (which
  leaves `LLM_API_URL` empty) does not move; the chat e2e (C1) covers the chat start screen.
- **One draft store from day one** (the single shared draft of D-086) even though only the chat reads it in C0, so C6 adds a reader, not a rewrite.
- **The `edit` action** carries SCORE ops in the turn's reply (SP-5's shape) and is checked by the existing plan machinery (op schema,
  yue-server apply, retry feedback, limits) inside the same queue slot as the turn, so there is one hand-off per turn, not two (D-100;
  architecture confirmed it, D-106, docs/decisions/0006).

Work packages (stage 6, 2026-10-06; replaces the stage-4 list W-C0a..W-C0f). C0 ships in two halves (D-104): **C0a create-first**,
usable in the real app on its own, then **C0b** (edit turn, splice, version card). Each package is one PR from `origin/main`, risk
first, with the files it owns named so builder batches stay disjoint; modules, LOC and tests are in architecture.md "Chat (C0)".
A package that changes a file another package owns waits for that one to merge (marked "after"). Server packages are headless and
land with their Vitest/pytest tests; UI packages are browser-checked at 1366×768.

Design tasks (stage 5): **DT-C0a** before CA-6 (`pipeline/design/chat-turn.html`, the C0a frames: a turn queued / thinking /
cancelling / failed; the recipe card pending / superseded / expired / committing; ASSISTANT OFF), **DT-C0b** before CB-5 (the edit
card with and without the splice clause, RENDERING / SPLICING lines, join-failed and TRUNCATED lines, WAITING FOR v2, the version
card). Tokens from DESIGN.md, no new hue; the owner signs each off like the others.

**C0a — create-first (F-041..F-045, F-049 turn half)**
- **CA-1 · chat data** (F-041 server, F-044 rules): `server/src/db/chatSchema.ts`, `server/src/db/index.ts`,
  `server/src/services/chat/{chatTypes,threadStore,messageStore,draftModel,recipeRules,draftFields}.ts` + tests. Needs nothing.
- **CA-2 · the turn job** (F-042, F-049 cancel/offline), after CA-1: `chat/{chatRules,songState,songStateSource,turnPrompt,
  turnActions,actionSchema,replyCheck,turnAttempts,turnCall,turnDispatch,proposalStore,turnJob}.ts`,
  `server/test-fakes/chatScripts.ts` (+ `test-fakes/data/sp5-replies.json` once SP-5 records its fixture) + tests. SP-5's ladder,
  if it is needed, changes only `turnCall.ts` (and `turnActions.ts` for rung 2).
- **CA-3 · routes and CREATE SONG** (F-041 rest, F-044 server, F-045 song card, F-049 states), after CA-2:
  `chat/{createFromDraft,chatStatus,messageView}.ts`, `server/src/routes/{chat,chatTurns}.ts`, `server/src/index.ts`,
  `server/src/services/engineGenJobs.ts` (`onSaved`) + tests.
- **CA-4 · CP-C0a, headless checkpoint** (F-050 #1, create leg), after CA-3: `server/scripts/chatCp0.ts`; evidence in
  `pipeline/cp-c0/<date>/`. Stop lines: turn p50 > 15 s, hand-off > 5 s, a recipe still invalid after 3 attempts more than once →
  stop and raise before CA-6. If SP-5 named a ladder rung by then, CA-4 runs with it.
- **CA-5 · client chat state** (F-041, F-043, F-044 logic), parallel with CA-3 (client only; the route contract is in
  architecture.md): `client/src/api/chat.ts`, `client/src/{chatEntry,chatTurn,chatCopy,chatStore,chatDraftStore}.ts` + tests.
- **CA-6 · the CHAT screen** (F-043, F-044, F-045), after CA-4, CA-5 and DT-C0a: `client/src/{ChatView,ChatThread,ChatTurnLine,
  ChatComposer,ChatRecipeCard,ChatSongCard,ChatSidebar,ChatDraftFields,ChatPlayer}.tsx`, `client/src/App.tsx`,
  `client/src/Header.tsx`, `client/src/SongDetailRail.tsx` (OPEN CHAT), `client/src/index.css`; `docs/design/DESIGN.md` as its own
  commit. The golden-path e2e must pass unchanged (it opens on the Library: `LLM_API_URL` empty).
- **CA-7 · C0a live run** (F-050 #2, create half): describe → card → sidebar edit → CREATE SONG → hear it → reload, in the real
  app (verifier). The owner can use C0a from here.

**C0b — edit, splice, versions (F-046..F-048, F-049 commit half)**
- **CB-1 · yue-server splice** (F-047 yue half), parallel with all of C0a, **after the owner's SP-4 listen** (precondition 2):
  `yue-server/{splice_dsp,splice_grid,splice_plan,splice_job,splice_routes,splice_check}.py`, `yue-server/{worker,transcriber,
  main}.py`, `yue-server/requirements.txt`, `yue-server/requirements-test.txt`, `yue-server/README.md` (splice section),
  `yue-server/tests/test_splice_*.py`, `yue-server/tests/data/splice/` (SP-4's recorded lab rows + scores),
  `yue-server/tests/data/contract/splice-*.json`. Setup step for the real service: `~/yue2/.venv/bin/pip install scipy==1.18.0`.
- **CB-2 · the edit turn** (F-046), after CA-3: `server/src/services/score/{planBuild,planJob}.ts`,
  `chat/{spliceEligibility,turnDispatch}.ts`, `chat/turnActions.ts` (edit on) + tests.
- **CB-3 · APPLY, render then splice** (F-047 server, F-048 server, F-049 commit states), after CB-1 and CB-2:
  `score/{scoreRenderRun,scoreRenderJob,scoreVersion}.ts`, `services/versionFiles.ts`, `chat/{yueSpliceClient,gridCache,
  spliceRenderJob,editCommit,versionCard}.ts`, `routes/chatTurns.ts` (apply), `chat/messageView.ts` (commit states),
  `server/test-fakes/fakeYue.ts` (splice replay) + tests.
- **CB-4 · CP-C0, headless checkpoint** (F-050 #1, edit leg), after CB-3: `server/scripts/chatCp0.ts` (`--leg edit`) + the
  `splice_check.py` run in WSL on 3 library songs (4/4); log in `pipeline/cp-c0/<date>/`. Stop lines: turn p50 over 15 s, hand-off
  over 5 s, edit wall time over 4 min, a null test failing, join LUFS excess over 1 dB on 3 of 3 songs → stop and raise before CB-5.
- **CB-5 · edit and version cards** (F-046, F-048, F-049 client), after CB-4 and DT-C0b: `client/src/{ChatEditCard,
  ChatVersionCard}.tsx`, `client/src/{chatAb,useChatPlayback}.ts` (exist from C3's CR-7b: extend for versions),
  `client/src/{chatTurn,chatCopy}.ts` (commit phases),
  `client/src/ChatPlayer.tsx` (BACK TO / USE), `client/src/api/chat.ts` (apply), `client/src/index.css`; DESIGN.md own commit.
- **CB-6 · C0 live run, then the owner's listen** (F-050 #2, #3).

Honest size: C0a about 8 working days (CA-1 1, CA-2 3, CA-3 1.5, CA-4 0.5, CA-5 1 in parallel, CA-6 2.5), C0b about 7 (CB-1 3 in
parallel with C0a, CB-2 1, CB-3 2.5, CB-4 0.5, CB-5 2.5). CP-C0a and CP-C0 are where to re-plan. If the owner wants C0b sooner,
the first thing to drop is the spliced edit (whole-song edit turns only, decision 6's fallback: CB-1 and most of CB-3 go), and the
promise loses "only the asked bars change".

C0 exit evidence: one real run on the real card, logged: turn latencies (cold, warm), attempts, unload-to-empty, YuE2 tokens/s and wall time,
transcription seconds (base and new), splice wall time, bytes of temp audio and their removal, null-test result on the saved file, join LUFS
excess over the base's own step, chord roots on the edited bars against the temp re-render. Owed to the owner when F-050 is verified (`passes`
stays false until it is in): 5 A/B pairs of v1 against v2 from chat edits: join not found in 4 of 5, "the rest sounds the same" yes, "the
chords changed" yes.

## C1 — "This": always analyze, the strip, the mark (F-051 .. F-055)

Highest remaining risk and the owner's explicit ask (D-089, D-090): after every save a queued `analyze` job refreshes words, score, sections and
the downbeat grid; the player gains its waveform and section strip; the person marks a part and the turn carries it. Risk: GPU scheduling of
a job after every save (it must never refuse the next APPLY: Q-038 #4 becomes a C1 fix) and marking that sends wrong bars as fact (stale
handling). Chat e2e first (F-051) so the new screen has a CI net before it grows. Mockups: chat-song.html CS-3..CS-11, with D-095's player
placement (above the composer). Honest size: 1.5 weeks; split after F-053 if it runs long. Q-051's half "a strip cut from the score's
sections" is closed by F-053 (the strip comes from the reading).

**Work packages (stage 6, 2026-10-07; modules, data and tests in architecture.md "Chat (C1)"; D-171..D-182).**
What the person can do when C1 is done: on a song's thread, see the waveform, the bar ruler and the section strip above the composer,
with a reading line ("READ v4 · 9 SECTIONS · 22 LINES"); after APPLY the new version plays at once and its reading follows ("READING v5 ·
SCORE"), never blocking the next message or APPLY; click CHORUS 2, drag its edge two bars on, read the chip "THIS: CHORUS 2 + 2 BARS ·
BARS 49-58 · 1:58-2:22", open WHAT IT SEES, type "make this jazzier", get an edit card planned on those bars only; after a version that
moved those bars, find the chip rust with USE BARS / CLEAR MARK and SEND held.

The thin path (each reversible; D-171..D-182): the C3 reading job reused for versions (one `transcribe`-kind slot, label `chat analysis`,
no new kind, docs/decisions/0009); only songs with a chat thread are analyzed (D-172); the grid comes from the splice's cache or the
same SheetSage2 run, and bar times from yue-server (D-174); the mark is a `planReferent` kind (D-175), resolved by the server at SEND and
at the turn's start, never remapped; Editor-first's selection as the mark (CS-10) stays C6.

Each package is one PR from `origin/main`, owning the files named so builder batches stay disjoint; "after" = waits for that one to merge.
None touches the render request (`engines/yue2Score.ts`, `score/scoreRenderRun.ts`, yue-server render code), so SP-6 (instrument hold,
R-030) runs beside C1 without a shared file.
- **CL-0 · the chat e2e** (F-051), **first**, needs nothing: `e2e/tests/chat.spec.ts`, `e2e/tests/chatFakes.ts`,
  `e2e/fake-score/{ollama,yue,chatReplies}.ts` (chat replies from `server/test-fakes/data/sp5-replies.json` read as data; hold and
  offline switches; `/v1/splices` replayed from `yue-server/tests/data/contract/splice-*.json`), `e2e/playwright.config.ts` (the spec in
  the `score` project's stack, no new ports, D-178), `.claude/rules/e2e.md` (one line). Recipe → CREATE SONG → edit turn → APPLY → v2;
  ASSISTANT OFF; CANCEL while thinking; a stale card. Golden path and score spec unchanged; CI green on the PR. 1.5-2 days.
- **CL-1 · a reading never stales a commit; settle events** (F-052 #3, Q-038 #4), needs nothing: `server/src/services/score/
  scoreRenderJob.ts` (`EDIT_KINDS`), `server/src/services/{jobEvents,jobRunner}.ts` + tests (queued `timings`, `transcribe`, `lyrics`,
  `chat analysis` jobs leave APPLY clean; a repaint still refuses). 0.5 day.
- **CL-2 · yue-server grid and bar times** (F-052 yue half, D-174), needs nothing: `yue-server/{transcribe_routes,score_edit_routes}.py`,
  `yue-server/README.md` (two routes), `yue-server/tests/test_{transcribe_grid,scores_bars}.py`, `yue-server/tests/data/contract/
  {transcription-grid,scores-bars}-*.json`. 1 day.
- **CL-3 · analysis data, plan and view** (F-052 storage, F-053 logic), needs nothing: `server/src/db/index.ts` (column),
  `server/src/services/chat/{analysisTypes,analysisStore,analysisPlan,barShift,analysisView}.ts` + tests. All C1 server types land here
  (`chatTypes.ts` gets only `UserBody.mark`), so CL-4, CL-5 and CL-7 build on one contract. 1.5 days.
- **CL-4 · the analysis job and trigger** (F-052 core), after CL-1, CL-2 (or a hand-written fixture until it merges), CL-3:
  `chat/{analysisSteps,analysisJob,analysisTrigger}.ts`, `server/src/services/{engineTranscribeClient,transcribeJobs}.ts`,
  `score/yueScoreBars.ts`, `server/test-fakes/{fakeYue,fakeYueTranscribe}.ts` (split first, own commit), `server/src/routes/
  chatAnalysis.ts` (view, retry), `server/src/routes/chat.ts` (`ensureAnalysis`), `server/src/index.ts` + tests. 2 days.
- **CL-5 · the mark on the server** (F-055 server), after CL-3, parallel with CL-4: `score/{planReferent,opSchema}.ts`,
  `chat/{markBlock,markFit,turnOutcome,turnJob,songStateSource,turnPrompt,actionSchema,replyCheck,turnDispatch,messageView,chatTypes}.ts`
  (`turnOutcome` split out of `turnJob` first, own refactor commit), `server/src/routes/chatTurns.ts` (`mark`, 409 `MARK_STALE`), the
  preview route in `routes/chatAnalysis.ts` (after CL-4 merges, or a separate `chatMark.ts` router if CL-4 is still open),
  `server/test-fakes/chatScripts.ts` + tests. 2 days.
- **CL-6 · CP-C1, headless checkpoint** (F-052 on the real machine, R-031, R-032), after CL-4 and CL-5: `server/scripts/chatCp1.ts`;
  evidence in `pipeline/cp-c1/<date>/`. Stop lines (architecture.md "Test strategy (C1)" #9): any commit refused because of an
  analysis; an analysis of a ≤ 4 min version over 90 s; the planner not fully on the GPU after an analysis or the next turn p50 over
  15 s; an op outside the mark on more than 1 of 10; prompt p95 over 6k → stop and raise before CL-8a. Records Q-070's section names
  on 3 transcribed songs. 0.5-1 day.
- **CL-7 · client state** (F-052..F-055 logic), parallel from the start (the wire contract is in architecture.md):
  `client/src/api/chatAnalysis.ts`, `client/src/api/chat.ts` (`mark?` only), `client/src/{chatAnalysis,chatMark,chatMarkLabel,
  chatMarkStore}.ts`, `client/src/chatStore.ts` (`send(…, mark?)`) + tests. 2 days.
- **DT-C1 · design** (stage 5), parallel from the start, before CL-8a/b: `pipeline/design/chat-mark.html` on the real player above
  the composer at 1366×768 (chat-song.html drew it at the top: the strip's height comes out of the thread, which keeps ≥ 400 px,
  F-053 #4): strip live / dim / hatched, the reading line's states (queued, reading step, done, failed + RETRY, transcribed), a mark
  whole-section / + n bars / across two sections / seconds-only, the snap pointer and tag, the chip with WHAT IT SEES open, the frozen
  echo, the stale chip with and without USE BARS and SEND held, the composer line while an analysis runs. Tokens from DESIGN.md, one
  sky (CS-6), no new hue; the owner signs it off.
- **CL-8a · player: waveform, ruler, strip, reading line** (F-053, F-052 states), after CL-4, CL-7, DT-C1 and CL-6's stop lines:
  `client/src/{ChatStrip,ChatReadingLine,ChatPlayer}.tsx`, `client/src/chatStrip.css`, `e2e/tests/chat.spec.ts` (strip + reading line);
  `docs/design/DESIGN.md` (strip, ruler, reading line; own commit). Browser check at 1366×768: the thread keeps ≥ 400 px. 1.5 days.
- **CL-8b · marking, chip, echo, stale** (F-054, F-055 client), after CL-8a and CL-5: `client/src/{ChatMarkLayer,ChatMarkChip,
  ChatMarkEcho,ChatComposer,ChatThread}.tsx`, `client/src/chatMark.css`, `e2e/tests/chat.spec.ts` (a marked turn whose prompt carries
  MARK; a stale chip); `docs/design/DESIGN.md` (the sky mark, grips, chip: Q-068's clause; own commit). 2 days.
- **CL-9 · C1 live run** (verifier), after CL-8b: on the real machine, a YuE2 song and an ACE-Step song: save → reading line → strip;
  APPLY clicked during a reading (queued, not refused); a mark by click, by edge drag, across two sections, by time on a hatched strip;
  "make this jazzier" → edit card inside the mark; a CUT that moves the marked bars → stale chip, USE BARS; reload: the echo re-marks;
  `LYRICS_API_URL` unset → "no word timings" and no failure.

Parallel waves: (1) CL-0, CL-1, CL-2, CL-3, CL-7, DT-C1 · (2) CL-4, CL-5 · (3) CL-6 · (4) CL-8a · (5) CL-8b · (6) CL-9.
Honest size: about 15 working days of package work; the critical path CL-3 → CL-4 → CL-6 → CL-8a → CL-8b → CL-9 is about 8 days.
Split point (the scope's "after F-053"): **C1a** = CL-0..CL-4, CL-6 (analysis half), CL-7 (analysis half), DT-C1, CL-8a; **C1b** = CL-5,
CL-7 (mark half), CL-8b. If the owner wants it sooner, cut in this order: WHAT IT SEES's preview route (the chip shows bars and seconds
only), the frozen echo's re-mark on click (the echo stays text), the WORDS step in the automatic analysis (R-031's fallback; the Editor
still reads timings on demand), seconds-only marks on a hatched strip (marking waits for the reading).

## C2 — Converging turns: lyrics panel, REVISE, UNDO TURN, the bar map (F-056 .. F-060)

The things that make a conversation converge instead of restarting: the lyrics panel in the sidebar (chat-lyrics.html LY-1..LY-6), a lyric rewrite
shown as OLD | NEW twice, REVISE as a follow-up turn (the existing merge, D-073/D-076), UNDO TURN and the "just filled" marks (CH-4, CH-5), the
bar map inside the edit card (was F-036; PLAN: M4's bar map goes into the edit card). Mostly existing machinery behind new cards, so lower
risk than C1; value high once C1 exists because the mark makes lyric rows pickable.

**Work packages (stage 6, 2026-10-08; modules, data and tests in architecture.md "Chat (C2)"; D-214..D-227).**
What the person can do when C2 is done: on a song's thread, the sidebar shows VERSIONS, STYLE, TEMPO · KEY and the
lyrics panel; with no mark it lists the sections, a click marks CHORUS 2 and the panel shows only its lines; shift-click
a verse line to stretch the mark; "make this jazzier" gives an edit card with a bar map whose bars 49-56 light when the
REHARMONIZE row is hovered; "and slow it down a bit" gives PLAN 2 below it (REHARMONIZE SAME, SET TEMPO NEW, nothing
REMOVED) and the first card greys; "rewrite the second chorus" shows OLD | NEW on the card and the old lines struck
above the new in the panel (PROPOSED if chorus 2 is not marked); on a new-song draft, UNDO TURN puts back what the
last reply filled and keeps the field typed by hand.

The thin path (each reversible): REVISE is decided by the server, not a button (a live, unchanged edit card makes the
turn's edit a `{drop, ops}` revise merged by the score agent's `mergeRevise`, D-227, docs/decisions/0010); the
lyrics panel rides in C1's analysis view, no new route (D-217); line times come from the Editor's `alignLyrics` (D-218);
the bar map is built on the server and replaces the edit card's strip (D-215); UNDO is a server record written with
the merge (D-220). No new queue kind, no migration, no yue-server transcription file (the "Re-time a transcription"
session's files, D-190).

Each package is one PR from `origin/main`, owning the files named so builder batches stay disjoint; "after" = waits for
that one to merge.
- **CV-0 · the shared contract: types, one pairing, the bar map, the undo record** (F-056/F-059/F-060 data), first,
  needs nothing: `server/src/services/chat/convergeTypes.ts`; `server/src/services/score/lyricPairing.ts` + the switch
  of `chat/{analysisView,markBlock,markFit}.ts` and `score/planReferent.ts` to it (own refactor commit; a cross-test
  against `yue-server/tests/data/contract/read-sections.json`); `chat/barMap.ts`; `chat/draftModel.ts` (`before`),
  `chat/editTypes.ts` (`revision?`, `since?`, `map?`), `chat/chatTypes.ts` (`RecipeBody.undo?`, `undone?`),
  `chat/turnDispatch.ts` (the recipe body's `undo`, the edit card's `map`) + tests. 1.5 days.
- **CV-1 · REVISE as a follow-up turn** (F-058 server), after CV-0: `chat/{turnRevise,actionSchema,turnCall,turnPrompt,
  replyCheck,turnJob,turnDispatch}.ts` (`revision` / `since`), `score/reviseReply.ts` (export the `drop` part),
  `server/test-fakes/chatScripts.ts` + tests (architecture.md "Test strategy (C2)" #1). 2 days.
- **CV-2 · the lyrics panel's data** (F-056 server), after CV-0: `chat/{lyricsSplit,lyricsPanel}.ts`,
  `chat/{analysisView,analysisTypes,analysisStore}.ts` (`shown.lyrics`, `versionLyrics`), `routes/chatAnalysis.ts` +
  tests. 1.5 days.
- **CV-3 · UNDO TURN on the server** (F-059 server), after CV-0: `chat/draftUndo.ts`, `routes/chat.ts` (the undo
  route), `chat/messageView.ts` (`undo` offer) + tests (#2). 1 day.
- **CV-4 · client state and wire** (F-056..F-060 logic), parallel from the start (the wire contract is in
  architecture.md): `client/src/api/chatConverge.ts`, `client/src/api/{chatEdit,chatAnalysis}.ts` (additive fields),
  `client/src/{chatLyricsPanel,chatLyricsMark,chatBarMap,chatUndo,chatConvergeCopy}.ts` + tests. 2 days.
- **DT-C2 · design** (stage 5), parallel from the start, before CV-6..CV-8: `pipeline/design/chat-converge.html` at
  1366×768 with C1's real player above the composer: the song sidebar (VERSIONS, STYLE, TEMPO · KEY, the panel) in
  LY-3's states with a line mark and shift-click; LY-4's struck / new and PROPOSED with the card beside it; the
  revised edit card (REVISED · PLAN 2, NEW / CHANGED / SAME, REMOVED, the superseded card above, a failed revision
  under a live card, the over-6 refusal line); the bar map in the card at 32, 120 and 200 bars (a cover), a whole-song
  op, a CUT, hover; UNDO TURN on the reply line, after undo ("restored TITLE, STYLE · kept LYRICS: you changed it"),
  and no UNDO once the song exists. Tokens from DESIGN.md, sky for marks and just-filled, no new hue; **the owner
  signs it off** (D-226).
- **CV-5 · CP-C2, headless checkpoint** (F-058 on the real machine, R-040), after CV-1: `server/scripts/chatCp2.ts`;
  evidence in `pipeline/cp-c2/<date>/`. Stop lines (architecture.md "Test strategy (C2)" #7): any context refusal or
  prompt p95 over 8,000 tokens; any pending op missing from both the merged plan and REMOVED; an additive revision
  dropping a pending op in more than 3 of 10; more than 2 of 12 revise turns failing → stop and raise before CV-7.
  0.5-1 day.
- **CV-6 · the song sidebar and the lyrics panel** (F-056, F-057 panel half), after CV-2, CV-4 and DT-C2:
  `client/src/{ChatSongPanel,ChatLyricsPanel,ChatView}.tsx`, `client/src/chatLyrics.css`,
  `e2e/tests/lyricsPanel.chat.spec.ts`; `docs/design/DESIGN.md` (the panel's clause, own commit). Browser check at
  1366×768. 2 days.
- **CV-7 · the edit card: REVISED, the bar map, hover** (F-058 client, F-060, F-057 card check), after CV-1, CV-4,
  DT-C2, CV-5's stop lines and CV-6 (DESIGN.md): `client/src/{ChatEditCard,ChatBarMap,ScorePlanList}.tsx`
  (`onHoverRow?`, additive for the dock), `client/src/chatEditCopy.ts`, `client/src/chatEdit.css`,
  `e2e/tests/revise.chat.spec.ts`; `docs/design/DESIGN.md` (the bar map, own commit). 1.5 days.
- **CV-8 · UNDO TURN and reload-proof marks** (F-059 client), after CV-3, CV-4 and DT-C2:
  `client/src/{ChatUndoLine,ChatRecipeCard,ChatDraftFields}.tsx`, `client/src/chatDraftStore.ts`,
  `e2e/tests/undoTurn.chat.spec.ts`. No DESIGN.md change (the ASSISTANT tag and YOURS are in it since C0a); if DT-C2's
  sign-off adds one, after CV-6. 1.5 days.
- **CV-9 · C2 live run** (verifier), after CV-6, CV-7, CV-8: on the real machine, a YuE2 song and an ACE-Step song:
  the panel lists, marks a section, a line (aligned times, R-041: the chip's bars match the line heard), shift-click
  across two sections; the panel dims while a new version is read, RETRY after a failed read, "no words" with
  `LYRICS_API_URL` unset; a revise chain of 3 (additive, fewer chords, replace) with REMOVED read on screen; a lyric
  rewrite in the panel and PROPOSED; the bar map on a 200-bar cover at 1366×768; UNDO TURN after a hand edit, then
  reload.

Parallel waves: (1) CV-0, CV-4, DT-C2 · (2) CV-1, CV-2, CV-3 · (3) CV-5, CV-6, CV-8 · (4) CV-7 · (5) CV-9.
Honest size: about 15 working days of package work; the critical path CV-0 → CV-1 → CV-5 → CV-7 → CV-9 is about 7
days, with DT-C2's sign-off needed by wave 3.
Split point: **C2a** (the converging card) = CV-0, CV-1, CV-4 (bar map half), CV-5, CV-7; **C2b** = CV-2, CV-3, CV-4
(panel and undo halves), CV-6, CV-8. If the owner wants it sooner, cut in this order: reload-proof just-filled marks
(the session marks stay, D-221), UNDO TURN on older turns (only the latest offers it), shift-click extend and
double-click play in the panel (click and header marks stay), PROPOSED outside the mark (the card's diff stays the
one view, LY-4's alternative).

## C3 — Reference songs (F-061 .. F-065)

The other half of the amended core promise: drop an audio file or pick a library song, `analyze` it (words, score with melody and chords,
caption/tempo/key), keep it as the song's source (D-084), propose a cover (transcribed score, new words and style: the existing USE .ABC FILE
path) or a fresh song that borrows tempo, key, structure and instrumentation words. Folds in the score agent's M3 half "chord-free,
instrumental and cover scores" (F-035) as F-065, because covers are exactly the chord-free scores. Risk: transcription quality on arbitrary
audio and the rights line (the person's responsibility, said on the card). Q-060 arrives here.

**Moved ahead of C0b/C1/C2 (D-125); work packages (stage 6, 2026-10-07; modules, data and tests in architecture.md "Chat (C3)").**
What the person can do when C3 is done: in the draft thread, drop a song file (or ATTACH ▾ FROM LIBRARY…) and type "like this, but in
German"; read the READ card ("uses the GPU about N s, changes nothing · stays on this machine, the rights are yours"), press READ, watch
WORDS > SCORE > CAPTION, read the reading card, get a cover card (or, for "a song like this", a recipe with tempo/key/structure marked
REFERENCE) without typing again, press CREATE COVER, hear it, and find the reference in the song's sidebar with RE-ANALYZE and A/B. A cover is
SCORE-editable on the dock (F-065); asking the chat to edit it still points to SCORE in the Editor until C0b (D-110, D-132).

The thin path (each choice reversible; D-126..D-138): one `transcribe`-kind reading job, no new queue kind or process; a YuE2 library song
reads its own score and words (no GPU); the follow-up proposal is one `recipe` with `reference_use`, and code (not the model) fills the
borrowed fields; CREATE COVER is CREATE SONG's own path with the reading's score (USE .ABC FILE's request); ATTACH in the draft thread only;
no section picking for an over-long cover (Q-096), no references on existing songs' threads, no chat edit turns before CB-2.

Each package is one PR from `origin/main`, owning the files named, so builder batches stay disjoint; "after" = waits for that one to merge.
- **CR-0 · yue-server: transcription keeps chords on request** (F-061 score, D-131), needs nothing: `yue-server/{transcriber,
  transcribe_routes}.py`, `yue-server/README.md` (transcription section), `yue-server/tests/test_transcri*.py`,
  `yue-server/tests/data/contract/transcription-*.json` (recorded for the TS fake). `chords` defaults false: Guided Create's COVER is
  unchanged. About 0.5 day.
- **CR-1 · reference data and upload** (F-061 storage, F-062 lifecycle), needs nothing: `server/src/db/chatSchema.ts`,
  `server/src/services/chat/{chatTypes,reading,referenceRules,referenceStore}.ts`, `server/src/routes/chatReferences.ts` (upload,
  library pick, list), `server/src/routes/chat.ts` (`references` in the thread view, sweep on NEW CHAT), `server/src/services/
  trashSweep.ts`, `server/src/index.ts` + tests. All C3 type additions land here so CR-2, CR-3 and CR-6 build on one contract. 1.5 days.
- **CR-2 · the reading job** (F-061 core), after CR-1 (CR-0's fixtures, or a hand-written one until it merges):
  `chat/{readingPlan,readingSteps,readingJob,gpuGuard}.ts`, `server/src/services/{transcribeJobs,engineTranscribeClient,
  transcode}.ts`, `server/test-fakes/fakeYue.ts` (transcriptions) + tests. 2 days.
- **CR-3 · the turn with a reference** (F-061 analyze card, F-063/F-064 proposals), after CR-1, parallel with CR-2:
  `chat/{referenceResolve,referenceTurn,referenceRecipe,turnActions,actionSchema,chatRules,turnPrompt,songStateSource,turnDispatch,
  draftModel,turnJob,proposalStore}.ts`, `server/src/routes/chatTurns.ts` (`attach`), `server/test-fakes/chatScripts.ts` + tests.
  2.5 days.
- **CR-4 · READ, RE-ANALYZE, CREATE COVER** (F-061 commit, F-062 re-read, F-063/F-064 commit), after CR-2 and CR-3:
  `chat/{readCommit,createFromDraft,messageView}.ts`, `routes/chatReferences.ts` (read routes) + tests. 1.5 days.
- **CR-5 · F-065 score half** (cover / instrumental / chord-free scores on the dock), needs nothing, parallel with all:
  `score/{scoreEligibility,renderMode,scoreRenderJob,planTypes,planJob,scoreLimits}.ts`, `engines/yue2Score.ts`,
  `client/src/{scoreCopy.ts,YueScoreReview.tsx}`, `yue-server/score_ops.py` + a chord-free pytest (code change only if that test fails)
  + tests. Browser check on the dock with a cover song. 1.5 days. (C0b note: CB-2's `spliceEligibility` must send a REHARMONIZE on a
  chord-free score down the whole-song path, F-065 edge.)
- **CR-6 · client state** (F-061..F-064 logic), parallel from the start (the wire contract is in architecture.md):
  `client/src/chatPoll.ts` (moved out of `chatStore.ts` first, own refactor commit, D-136), `client/src/{chatStore,chatAttachStore,
  chatReading,chatReferenceCopy}.ts`, `client/src/api/{chat,chatReferences}.ts` + tests. 1.5 days.
- **DT-C3 · design** (stage 5), parallel from the start, before CR-7a/b: `pipeline/design/chat-reference.html`: the drop zone and the
  ATTACH ▾ menu with the library list, the chip (uploading / attached / failed), the READ card (pending, superseded, expired), the
  reading card (queued, reading step k of 3, done, partial with not-read lines, failed, cancelled, a 360 s cut, an instrumental,
  cover not possible), PROPOSING… under it, the cover recipe card (CREATE COVER, FROM THE SCORE fields) and the borrowed recipe card
  (REFERENCE marks, a missing key), the song panel's reference with RE-ANALYZE and the REFERENCE ⇄ SONG pill, at 1366×768. Tokens
  from DESIGN.md, no new hue; the owner signs it off.
- **CR-7a · attach and reading UI** (F-061), after CR-6 and DT-C3: `client/src/{ChatAttach,ChatAnalyzeCard,ChatReadingCard,
  ChatThread,ChatComposer}.tsx`, `client/src/chatReference.css`; `docs/design/DESIGN.md` (all C3 clauses, own commit). 1.5 days.
- **CR-7b · cover card, borrowed fields, the reference panel, A/B** (F-062..F-064), after CR-6 and DT-C3, parallel with CR-7a:
  `client/src/{ChatRecipeCard,ChatDraftFields,ChatReferencePanel,ChatSidebar,ChatPlayer}.tsx`, `client/src/{chatAb,
  useChatPlayback}.ts`, `client/src/chatReferenceSong.css`; DESIGN.md only if it deviates, after CR-7a. 1.5 days. (CB-5 later extends
  `chatAb` / `useChatPlayback` for versions instead of writing them.)
- **CR-8 · CP-C3, headless checkpoint** (F-061..F-064 on the real machine; R-028, R-029), after CR-4, beside CR-7a/b (D-113's
  rhythm): `server/scripts/chatCp3.ts`; evidence in `pipeline/cp-c3/<date>/`. Stop lines in architecture.md "Test strategy (C3)":
  a reading over 4 min for a file of 4 min or less, follow-up turn p50 > 15 s or the planner off the GPU, the score read ok on < 2 of
  3 audio files, `reference_use` right on < 8 of 10, hand-off > 5 s → stop and raise before CR-9. 0.5-1 day.
- **CR-9 · C3 live run** (verifier), after CR-7a, CR-7b, CR-8 and CR-5: attach a file and a library song → READ → reading card →
  cover card → CREATE COVER → hear it → reload → reference in the sidebar, RE-ANALYZE, A/B; a borrow recipe with a missing key; a
  non-audio file; F-065 on the dock (SET TEMPO and REHARMONIZE on the cover, REWRITE LYRICS refused on an instrumental). Owed to
  the owner: 3 covers listened (Q-095's recordings if he gives them).

Parallel waves: (1) CR-0, CR-1, CR-5, CR-6, DT-C3 · (2) CR-2, CR-3 · (3) CR-4 · (4) CR-7a, CR-7b, CR-8 · (5) CR-9.
Honest size: about 15 working days of package work; the critical path CR-1 → CR-3 → CR-4 → CR-7a/b → CR-9 is about 7.5 days.
If the owner wants it sooner, cut in this order: the caption step (borrowed instrumentation then comes from the person's words; also
removes R-028's ACE-Step half), FROM LIBRARY's list (a library song by title in words still works), the A/B pill (RE-ANALYZE stays),
the automatic follow-up turn (the person types the next message).

## C4 — one version from several local ops (F-066, F-069; F-067/F-068 not doing)

<!-- Rewritten by stage 6 (architecture), 2026-10-09, from the re-scope proposal (rescope-2026-10-09.md, C4 table) and the owner's
     answers there: F-067/F-068 → Not doing (D-262). The listen gate is gone (D-204). Old title: "C4 — Structure edits and the rest of
     the splice (F-066 .. F-069), needs the owner's SP-4 listen". Modules: architecture.md "Chat (C4)". Decisions D-262..D-270,
     questions Q-149..Q-152, risk R-043. -->

What the person can do when C4 is done: ask "jazz chords on verse 1 and on the last chorus, and cut the bridge" and get ONE new version in
which only those places changed: each span is spliced into the old take, the rest is the old audio sample for sample. Today any plan with
more than one op re-renders the whole song (*code*: `spliceEligibility.ts`, "the plan makes N changes"), and chat plans are routinely multi-op
(c2-live B3), so this is the core promise's weak spot. C4 also closes REPEAT/CUT audio-only (F-066), which C0b already built.

- **F-066 · REPEAT/CUT audio-only — ALREADY BUILT in C0b** (D-154, D-156, D-160, D-161; CP-C0 5/5, D-166; owner closed SP-4's ear half,
  D-204). Verify only, against the criteria rewritten to what shipped:
  1. The edit card says the audio is copied or removed at the section edges with no render; outside the 1-beat crossfades the saved version
     equals the base (null test: CP-C0 measured 0 differing samples).
  2. A REPEAT whose seam steps more than 4.0 dB in loudness renders the whole song instead, labelled with the reason (D-160); a REPEAT of the
     last section is a whole-song render and the card says why before APPLY (D-213).
  3. A CUT that would leave no section is refused; a CUT of the last section keeps its edge fade.
  4. After an audio-only REPEAT, a later whole-song re-render over 360 s refuses with the existing line.
  5. **The one build item:** a RE-RENDER WHOLE SONG button on the version card of a spliced version, for when a seam is heard. It does not
     exist (*code*: no such string in `client/src`, 2026-10-09). It opens a normal edit card (whole-song consequence line, APPLY) that
     re-renders the active version's own score; no model call (D-268).
  Q-053 (REPEAT's second seam audible) closes by D-160/D-204/D-213 (D-269).
- **F-069 · several local ops, one version — the build.** Criteria:
  1. A plan of 2-4 ops, each a REHARMONIZE, CUT or REPEAT on non-overlapping spans, saves ONE version, made by applying the single-span
     splice once per span from the last bar back to the first (earlier bar numbers stay valid). The card names every span (bar map, D-270).
  2. Outside every span the saved file equals the base (null test, 0 differing samples); each join is within 1 dB of the base's own step at
     that point.
  3. Overlapping or adjacent REHARMONIZE spans (gap under 2 bars or under 3 s) merge into one span before counting. A CUT or REPEAT that
     overlaps or touches another op's span is not chained: the whole plan renders, with the reason (D-265, Q-149).
  4. Any op that is not spliceable (WRITE PHRASE, REWRITE LYRICS, tempo, key, style, a REPEAT of the last section), more than 4 spans after
     merging, a join `not_aligned`, a REPEAT seam over 4.0 dB, or any failing step sends the whole plan to the whole-song render, labelled
     with the reason. Never a partial save (no version with some spans spliced and others not).
  5. CANCEL at any step (rendering, any splice step, before saving) deletes the temp files and saves nothing; the card returns to pending.
  6. **Checkpoint CP-C4 before any UI:** 3 library songs (4/4, with chords) × 2 multi-op plans each (one REHARMONIZE + REHARMONIZE, one
     REHARMONIZE + CUT or REPEAT), headless, logged in `pipeline/cp-c4/<date>/` (D-166's rhythm). Stop lines below.
- **F-067 / F-068 → Not doing** (owner, 2026-10-09, D-262): see "Not doing (chat)".

**Work packages** (each one PR from `origin/main`; files owned so batches stay disjoint; modules and tests in architecture.md "Chat (C4)").

| id | what | files it touches | after | size |
|---|---|---|---|---|
| CK-0 | F-066 verify (verifier, no code): criteria 1-4 against the merged code, c0b-live.md and CP-C0; set F-066's evidence (passes stays false until CK-6 lands) | `pipeline/features.json` only | — | XS |
| CK-1 | the chain planner, pure: plan ops + facts → ordered steps (last bar first), merge, step limit, reasons; `spliceEligibility` calls it for 2+ ops; the `several` splice shape | **`server/src/services/chat/spliceSteps.ts`** + test, `server/src/services/chat/spliceEligibility.ts` + test, `server/src/services/chat/editTypes.ts` (doc comment only) | — | S (1 d) |
| CK-2 | yue-server chained splice: spec `steps`, base → edited bar mapping across section ops, step loop with per-step verdict and null test, one result with per-step rows, mapped out grid; `splice_check.py --chain` on the saved file | **`yue-server/splice_chain.py`**, **`yue-server/splice_chain_job.py`**, `yue-server/splice_spec.py`, `yue-server/splice_job.py` (dispatch), `yue-server/splice_result.py`, `yue-server/splice_check.py`, `yue-server/README.md` (splice section), **`yue-server/tests/test_splice_chain.py`**, `yue-server/tests/test_splice_job.py`, **`yue-server/tests/data/contract/splice-chain-{ok,rerender,hold}.json`** | — | M (2 d) |
| CK-6 | RE-RENDER WHOLE SONG (F-066 #5): a no-op plan on the active spliced version → a whole-song edit card in the thread | **`server/src/services/chat/rerenderWhole.ts`** + test, `server/src/routes/chatTurns.ts` (`POST /threads/:id/versions/:versionId/rerender`), `client/src/ChatVersionCard.tsx` (+test), `client/src/api/chat.ts` | — | S (1 d) |
| CK-3 | server wiring: spec with steps, render only when a step needs it, the v2 splice record, fallbacks and cancel for the chain | `server/src/services/chat/spliceRenderJob.ts`, **`server/src/services/chat/spliceSpec.ts`** + test (spec and record builders, pure; keeps the job under 200 LOC), `server/src/services/chat/yueSpliceClient.ts` (+test), `server/src/services/chat/versionCard.ts` (+test), `server/src/services/score/scoreVersion.ts` (+test), `server/test-fakes/fakeYueSplice.ts`, `server/src/services/chat/spliceRenderJob.test.ts` | CK-1, CK-2 | M (1.5 d) |
| CK-4 | CP-C4, headless checkpoint on the real machine | **`server/scripts/chatCp4.ts`**, **`server/scripts/chatCp4Stats.ts`** + test; evidence `pipeline/cp-c4/<date>/` | CK-3 | S (0.5-1 d) |
| CK-5 | the cards: consequence line, phase line (`SPLICING · 2 OF 3`), done line and version card for several spans; strip fallback for cards without a bar map; one e2e spec | `client/src/api/chatEdit.ts`, **`client/src/chatSpliceCopy.ts`** + test (the several-span words; keeps `chatEditCopy.ts` under 150), `client/src/chatEditCopy.ts` (+test), `client/src/ChatEditCard.tsx` (+test), **`e2e/tests/chatSplice.chat.spec.ts`**, `e2e/fake-score/splices.ts` | CK-4 (its stop lines pass) | M (1.5 d) |
| CK-7 | C4 live run (verifier): one multi-op chat edit in the real app, A/B, reload; sets F-069 (and F-066 after CK-6) | `pipeline/c4-live.md`, `pipeline/features.json` | CK-5, CK-6 | S |

**Waves** (disjoint files inside a wave): **W0** CK-0 · **W1** CK-1 ∥ CK-2 ∥ CK-6 · **W2** CK-3 · **W3** CK-4 (stop or go) · **W4** CK-5 ·
**W5** CK-7. Honest size about 6-7 working days; CP-C4 is where to re-plan.

**CP-C4 stop lines** (any one → stop and raise before CK-5): a null test with any differing sample outside the spans on a saved file; any
partial save; join LUFS excess over 1 dB at any join on 2 of 3 songs; a multi-op edit's wall time over 5 min (render + base grid cached +
render grid + 2-4 steps); more than 3 of the 6 plans falling back to the whole song for a reason other than the stated rules (then the
feature does nothing). Logged per plan: steps, per-step verdict, snaps, gains, joins, null test, wall time, temp bytes and their removal.

**Design:** no new design task (D-270). The edit card's bar map already names every span, one row per op, lit on hover (chat-converge.html
frame 4, 4a-4d; CX-3; `mapCaption` words several spans today). What changes is copy (consequence, phase and version lines), written in
CK-5 in the existing card; RE-RENDER WHOLE SONG is a secondary button in the version card's existing button style and its commit uses the
existing whole-song edit card (chat-edit.html frames 1-2). DESIGN.md does not change; if CK-5 needs a new element, it is a design question first.

## C5 — Tempo and key, both ways (F-070), needs SP-6

Only if SP-6 passes: SHIFT/STRETCH next to RE-RENDER on a tempo/key card (D-085). RE-RENDER already works from C0 (SET TEMPO/TRANSPOSE take
the whole-song path); this milestone is one option on one card and is about three days, so it may be done inside C4's week.

## C6 — Two ways in, completed (F-071 .. F-074)

Form-first with the 300 px assistant that fills fields and never commits; the one shared draft and the CHAT | FORM toggle (Guided Create reads the
draft C0 already built); the Editor-first mirror (CHAT | EDITOR; the Editor's selection is the mark); the Library's CREATE and CONTINUE rows
open the remembered mode and the song's thread. UI-heavy, low risk, after the engine paths are proven.
Q-061 and Q-077 are decided at its design pass.

## C7 — The scalpel from the chat and ACE-Step first takes (F-075 .. F-078), needs R-025

`scalpel` proposals (repaint a section with new words, add a layer, split, export) through the existing jobs and their limits; Editor edits shown
in the thread as version cards (decision 9); ACE-Step first takes (D-083: the card says not score-editable, later turns are scalpel only);
NEW SONG FROM THIS SCORE as the chat's answer for a song that is no longer score-eligible (was F-034).

## C8 — Remnants of the score agent's M3/M4 (F-079 .. F-081)

Settings planner card (was F-037), Activity entries for plan, render, chat turn, analyze and splice jobs (was F-038 plus CS-3's Activity half),
the palette's "Ask in chat" replacing "Edit score" (was F-039). All small and independent; each can move up if the owner trips over its absence.

### Mapping of the score agent's unbuilt M3/M4 (features.json F-034..F-039 stay as written, unchanged)

| score-agent feature | lands in | as |
|---|---|---|
| F-034 NEW SONG FROM THIS SCORE | C7 | F-078 |
| F-035 chord-free / instrumental / cover scores | C3 | F-065 |
| F-036 bar map in the review | C2 | F-060 (inside the edit card) |
| F-037 Settings planner card | C8 | F-079 |
| F-038 Activity entries for plan and render | C8 | F-080 (plus chat turn, analyze, splice) |
| F-039 palette "Edit score" | C8 | F-081 ("Ask in chat") |

When a mapped chat feature passes, the conductor sets the old entry's `passes` the same way and copies the evidence pointer.

## Interaction specs (chat)

Mockup frames settle the layout; this section settles states and transitions. Where a frame exists it is named.

### A turn, end to end (F-042, F-044, F-046, F-047, F-049; layout frames: chat-create.html frame 5, chat-turn.html from DT-C0)

States of one user message:
1. `composing`: composer text; SEND ↵ is an outline text button (D-095), disabled when empty. C1 adds: held while a stale mark is shown (CS-11), and
   a message sent during analysis or during a running commit shows `WAITING FOR v2 · read after it saves` and queues (Q-069 and below).
2. `queued`: the GPU slot is busy: `THINKING · QUEUED · STARTS AFTER 2 JOBS`, CANCEL. Fields stay editable.
3. `thinking`: slot held; `THINKING… attempt 2 of 3` with the reason of a retry in `text-low`; CANCEL. The hand-edit set is recorded at SEND
   and grows as fields are touched.
4. Outcome, exactly one of: `say` (text); `ask` (one question with choices, only when nothing can be proposed); `recipe` card; `edit` card;
   `failed` (3 attempts spent, or a schema/limit refusal: rust line with the reason, "nothing changed", RETRY); `offline` (below).
5. A proposal card is `pending` (commit button live, consequence line), `superseded` (a newer proposal of the same kind exists: greyed, no
   button; a recipe card's fields live on in the sidebar), `expired` (server restart: "this proposal expired, ask again", no button),
   `committing` (below) or `done`.
6. Commit (CREATE SONG, APPLY): re-check on the server (eligibility, base version unchanged, proposal alive, `/api/ps` empty), then the
   existing jobs: first take; or for an edit `render queued` -> `rendering` (YuE2, the existing job line) -> `splicing` (grid of the base
   from cache, grid of the new render, snap, crossfade, level match; seconds) -> `saved`. A thread line shows the phase; the card keeps
   its button label (never becomes progress).
7. `saved`: a version card is appended, the player swaps in place (below), the card becomes `done`. The thread's next turn reads the new
   version.
8. `commit failed`: the engine's error in rust with RETRY; no version; the card returns to `pending`. `join not aligned`: the whole-song
   re-render is saved as the version, labelled so ("whole song re-rendered: the join could not be aligned"), rust line, never a silent splice
   (D-101). `truncated`: saved, rust TRUNCATED (D-025). `stale`: the re-check fails ("this song changed since the proposal: a repaint
   was queued"): no job starts, card `expired`-styled with ASK AGAIN.

Cancel:
- while `queued`: removed (`cancelQueued`), the message stays with "CANCELLED", no reply.
- while `thinking`: abort the planner call, then still `keep_alive 0` and poll `/api/ps` until empty before the slot is released (the
  `onAbort` shape of D-041); no proposal; fields and the draft unchanged.
- while `rendering`: the existing ABORT (the slot is held while YuE2 drains); no version; the proposal returns to `pending`.
- while `splicing`: cancel the job; the temp render is deleted; no version; the proposal returns to `pending` (the render is not kept: it is
  GPU minutes lost, said on the cancel line).
- closing the tab or reloading: server jobs continue; the thread rehydrates the running phase from the job. A server restart ends them as
  `interrupted` and expires pending proposals (decisions/0004).

Errors:
- planner HTTP error, 404 model, probe failure -> `offline`: the message "ASSISTANT OFF · <cause and fix>" with RETRY and a FORM link to
  Guided Create (CH-8, C0 form: no draft carry-over; from C6 the full fallback to form-first). A failed turn changes nothing (atomic).
- unload not confirmed in 10 s: the turn ends in an error naming the model and `ollama stop <model>`; slot released after the bound; every
  commit refuses while `/api/ps` lists a model (R-003, D-053).
- context short (`usage.prompt_tokens` below the lower bound, or `context_length` below prompt + 2,500): refuse naming `OLLAMA_CONTEXT_LENGTH=16384`.
  Never a proposal from a truncated prompt (D-050).
- the song-state block cannot be read (yue-server down, sidecar fails the validator): the turn answers as `say` with the reason (Eligibility
  text) and proposes nothing that needs the score.
- double SEND: one turn (idempotency key per message; Q-038 #6 is not carried into chat).

A hand edit during a turn (CH-6, Q-057): fields stay editable. At SEND the server notes the draft revision; a field touched since then is
skipped when the reply applies, and the reply names it ("skipped TITLE, you changed it"). A hand edit to a field of a `pending` recipe card
updates the card's summary and CREATE SONG sends the live draft, not the proposal.

Messages during a commit: one commit per song at a time. A turn sent while a render/splice runs is queued and read after the version saves,
so it sees the new version (the composer says so). A turn sent while only an `analyze` job runs (C1) queues behind it (Q-069).

The draft shared by both modes (CH-1, CH-9): in C0 one `draftStore` per thread holds the fields; the chat's sidebar is its only view, a
CHAT | FORM switch does not exist yet (the FORM link opens Guided Create with its own state). From C6 Guided Create and the sidebar are two
views of the same store, either commits, switching keeps everything, and the form-first assistant fills fields but never commits (CH-7).
UNDO TURN (C2, CH-5) restores only the fields that turn filled and leaves hand edits alone.

### The player above the composer and a version arriving (F-045, F-048; chat-song.html CS-2, chat-lyrics.html frame 3)

- The player sits above the composer (D-095), in view with the sidebar collapsed. C0: play/pause, time, seek, active-version pill, BACK TO vN.
  C1: waveform, bar ruler, section strip, reading state line.
- A saved version becomes active at once: the audio swaps in place at the same position and play state; a lilac line says NOW PLAYING THE NEW
  VERSION until the next play, scrub, mark or send; v1 is one click away (BACK TO v1 = an A/B listen, nothing activated until USE v1).
- A/B plays the other version at the same seconds (clamped to the shorter one's end). After a splice the later bars may shift by the span's
  length difference (under 0.25 s in SP-4); after an audio-only REPEAT/CUT (C4) "same seconds" is wrong by design, Q-070's A/B-by-bar is
  Later and the card says "bars after the cut are earlier".

### Stale mark (C1, F-055; CS-11), the analysis states (C1, F-052/F-053; CS-3, CS-4), the lyrics panel (C2, F-056; LY-3..LY-6)

Specified by the mockups as drawn: a version that moves the marked bars turns the chip rust, outlines the old place, offers USE BARS (only if the
edit reported the shift) or CLEAR MARK, and holds SEND; while the reading is old it stays dimmed and clickable only if the edit moved no bars,
otherwise the strip is hatched and marking works by time; the lyrics panel dims while a reading runs and shows RETRY when it failed. C1/C2's
acceptance criteria quote these; nothing is added here.

### Design tasks

DT-C0a and DT-C0b above (turn and card states, before CA-6 and CB-5). DT-C1 (before C1's client work): the strip and mark on the real waveform at 1366x768 with
the player above the composer (chat-song.html drew the player at the top: the 134 px cost moves; re-check thread height). DT-C2: DESIGN.md
clauses for the player, the sky mark, the ASSISTANT tag and the lyrics panel, each in the first UI PR that uses it as its own commit (AGENTS.md).

## What C0 leaves out, and where it lands

| left out of C0 | lands | why not in C0 |
|---|---|---|
| analyze after every version, the strip | C1 | the splice computes its own grid on demand; the strip needs the analysis |
| the mark ("this") | C1 | needs the strip; words plus a stated assumption carry C0 |
| lyrics panel, UNDO TURN, "just filled", REVISE-merge, bar map | C2 | convergence polish; each has a fallback in C0 |
| reference songs, cover vs fresh | C3 | the other entry to the promise, not the one the thin path needs |
| REPEAT/CUT audio-only, multi-span (phrase and lyrics splices: not doing, D-262) | C4 | REPEAT/CUT shipped in C0b after all (D-154); multi-span is C4's build |
| tempo/key SHIFT/STRETCH | C5 | gated by SP-6; RE-RENDER works from C0 |
| form-first, shared-draft toggle, Editor-first mirror | C6 | one draft store exists from C0; the second view is UI |
| scalpel actions, Editor edits in the thread, ACE-Step first takes, new song from this score | C7 | R-025, and ineligible songs get a plain reason in C0 |
| Settings card, Activity entries, palette | C8 | small remnants |

## Later (chat)

- **YuE2 forced-prefix continuation (SP-4 candidate D)**, only if the owner's listen finds the A3 joins; it was not run.
- **Moving a cut to the nearest word gap** (a quarter bar), only if the listen finds stutters at the 15 of 36 cuts that land inside a sung word.
- **An explicit "smooth this join" ACE-Step action** (B, disproven as a default: worse adherence, quieter windows); would need the gain, tail and clipping
  fixes SP-4 lists.
- **Splice on meters SP-4 did not test (3/4 and others)**: C0 falls back to the whole-song path for them with the reason; a spike widens it.
- **Score editing on ACE-Step transcriptions** (Q-062 b; context and marking only for now) and transcription-based `melody` re-renders of
  ACE-Step songs.
- **A/B by bar after REPEAT/CUT** (Q-070); an A/B control in the Editor's version rail (Q-008's remainder: the chat has it, the rail does not).
- **Streaming replies** (a turn is 3-15 s; not worth a second transport yet); **a kept-warm planner across a conversation** (2 GiB free is too
  little to co-reside, D-011); **plans surviving a server restart** (D-020 / decisions/0004); **queue pause while a backend is down** (Q-009).
- **A free-disk check before a commit** (Q-037): each edit now writes a temp render and a spliced file of 65-80 MB on top of the version; C0 deletes temps
  on every path and the C0 run logs the bytes; a check is added if the log shows pressure.

- **Re-time a transcription** (D-190): planned 2026-10-08 as milestone RT below (F-090 .. F-094, D-206 .. D-208).

## Not doing (chat)

- **LoRA / training ACE-Step toward YuE2's quality** (D-079): a dataset- and GPU-scale project, teaches style not overall quality; post-1.0.
- **Applying each turn as soon as it is planned** (decision 2 alternative): breaks DESIGN.md's consequence-line rule and spends GPU minutes on
  misunderstandings.
- **The chat writing ABC, or any note-level edit by free text** (decisions/0002): edits are SCORE ops applied by yue-server.
- **The whole transcript in the model's context**: 16k does not hold it; the song-state block replaces it.
- **ACE-Step repaint as seam healing by default** (SP-4 B: adherence and level worse).
- **Lyric playback follow / karaoke, a lyric lane under the waveform, typing lyrics into the panel** (D-093, Q-075): words change by chat or in the Editor.
- **Beat-level mark snapping, a second chat-only mark in Editor-first mode** (CS-5, CS-10).
- **Several threads per song or a global thread** (D-081).
- **Reference songs from a URL or a streaming service**: local files and library songs only; rights stay the person's (D-084).
- **A larger or cloud chat model** (no room at 16k on 16 GB; local-only): the MoE stays an env value.
- **SHIFT/STRETCH if SP-6 fails** (R-026): RE-RENDER stays the only tempo/key path, D-085's reversal is recorded.
- **WRITE PHRASE spliced (F-067) and REWRITE LYRICS spliced (F-068)** (owner, 2026-10-09, D-262): the owner heard both splices and rejected
  them (D-150: "the voice changed", "song changed completely") and said a whole re-render is fine; both kinds stay whole-song (D-101, D-154).
  Revisit only if YuE2 forced-prefix continuation (SP-4 candidate D, in Later) is ever spiked. Q-137 is separate and stays open.

## Re-check of deferred questions

- **Q-060** (START FROM A SONG I HAVE / ONE TRACK in chat-first): arrives with C3, a FORM link until then. Not blocking.
  Stage 6 (2026-10-07): A SONG I HAVE = C3's ATTACH ▾ FILE… / FROM LIBRARY… (CR-7a); ONE TRACK stays a FORM link (Q-060 kept open for it).
- **Q-061** (does form-first's DESCRIBE IT go to the thread): touches only C6. Not blocking; decided at C6's design pass (default: yes, as a
  user message marked "from the form").
- **Q-070** (section names on transcribed songs, A/B by bar): the first half is verified inside F-052 (three non-YuE2 songs); the second is Later. Not blocking.
- **Q-077** (collapsed-sidebar rail text, WHAT IT SEES showing the words): C2/C6 polish. Not blocking.
- **Q-008** (A/B): answered in effect by the chat (decision 8, CS-2); remainder is Later. **Q-037**: not blocking, see Later (disk). **Q-009**: unchanged.
- **Q-038 #4** (a queued word-timings job refuses the render): not blocking C0 (no analyze job exists), **blocking for C1**: F-052's
  criterion says an analyze job never refuses a commit. Stage 6 (C1, 2026-10-07): fixed in CL-1 by an allowlist of edit kinds in
  `pendingEdit` (D-173), no longer blocking. **Q-038 #6** (double POST) is a C0 criterion on the turn route (F-042).
- **Q-050** (REVISE drops ops on 1-op plans, "fewer chords"): not blocking; F-058 shows the loss as REMOVED, never silent. **Q-053**: judged in C4.
  **Q-062 a/c, Q-063..Q-069, Q-072..Q-076**: assumed in D-091/D-094, built as drawn. **Q-051**: strip half closed by F-053; the hint half stays D-074.
- **No question became blocking for the cut.** The one owner-gated item is the SP-4 listen (Q-054 #1), which blocks CB-1 and C4 only; the SP-5 numbers
  are a spike result, not a question.

## Assumed defaults (filed as D-097..D-102, Q-078, Q-079)

See decisions.md and open-questions.md.

---

# Scope — MVP (the score agent)

<!-- Stage 4 draft, 2026-10-03. NOT signed off: the user's sign-off in chat is the one open gate item (D-### goes here once given).
     Features and pass flags live in features.json (F-016 onward are the score agent; F-001..F-015 are the existing app and keep their evidence).
     Spike evidence: spikes/SP-1-vram-handoff, SP-2-planner-quality, SP-3-cot-full-adherence RESULT.md. Owed to the user, not blockers:
     SP-3 A/B listen (12 pairs), SP-2 WRITE PHRASE listen. Where they inform the cut it says so. -->

What "MVP" means here: the existing app is past its MVP. This scope is the score agent only, ordered so that the first milestone is the
whole promise on the real machine, as thin as it can be, and everything else is judged against what M0 teaches.

## Preconditions (before any M0 code)

1. **P1 = F-016, the amendment (D-005, R-004).** A dated PLAN.md section "Score Agent" that supersedes "ABC score editing / agentic editing
   is out of scope" ("Engine: YuE2", "YuE2: Align With Upstream") and carries this file's decisions and interaction specs; AGENTS.md "Scope
   Discipline" amended so YuE2 may re-render its own song from an edited score (the "every edit after the first take runs on ACE-Step"
   line); the same wording fix in `yue-server/README.md` line 6. Docs-only PR, merged before the first code PR. D-015's PR already
   changed the first-take default and left this amendment to the score agent (PLAN.md "With the score agent", point 3).
2. **P2 = job queue (D-003, Q-005): satisfied in the working tree.** `server/src/services/genQueue.ts` exists on the checked-out branch
   (`docs/engine-lineup`), `genLock` survives only as a word in one test (seen in code, 2026-10-03), and DESIGN.md already describes S4
   part b. So the brief's "S4 NOT merged" row and R-007 are stale: M0 targets `genQueue` with two new kinds (`plan`, `scoreRender`).
   Verify on `main` with `git log main -- server/src/services/genQueue.ts` before starting; if S4 is not on `main`, M0 waits for it
   (D-003), it does not fall back to `genLock` (D-022).
3. **P3 = environment, documented in the PLAN.md section:** `LLM_API_URL` (Ollama), `LLM_MODEL` (default `qwen3:14b`),
   `OLLAMA_CONTEXT_LENGTH=16384` on the Ollama server, `ACESTEP_OFFLOAD_TO_CPU=true` (SP-1 measured with the three start-all.bat offload
   flags, 0.5 GB idle; the Gradio launcher held 4.8 GB and would not fit). The planner and a loaded ACE-Step must not co-reside.

## M0 — The core-promise path, headless first, then in the dock

What the user can do when M0 is done: open a library song that YuE2 made (one layer, no repaints, score with chords), pick the SCORE verb,
type "jazz chords in the chorus, 88 BPM", read a checked change list with a consequence line, press APPLY & RENDER, and get a new lilac
base version rendered by YuE2 with `cot` full at about 88 BPM, with the previous version one click away.

The cut, and why it is this thin:
- **Op set: SET TEMPO, REHARMONIZE, EDIT STYLE** (D-018). It is the smallest set that exercises every H risk: R-002 (planner + validator +
  retry loop: REHARMONIZE as `root`+`quality` enums, SP-2 100%), R-003 (hand-off), R-013 (tempo is reliable, harmony is the hard-to-hear
  case: roots followed 8/8 bars in 2 of 3 SP-3 songs). **WRITE PHRASE moves to M1**: it needs a second schema shape, a beat-sum retry loop,
  an `Ins` overlay applier, sanity gates and an unverified instrument; SP-2 shows it is where qwen3 fails (44% as ABC strings) and its
  musicality listen is still owed. It is the next-riskiest thing, so it is M1's whole job, not a rider on M0. The ≤ 3-retry loop with numeric
  feedback is in M0 anyway (a plan can fail the validator on 360 s or a bar number), so M1 adds an op, not a mechanism.
- No UI beyond one dock verb: a change list (one row per op with its verdict), one checks line, the consequence line. No bar map, no
  per-op drop, no Settings card, no Activity entry, no palette pre-fill (all M4). The plan job is visible in the dock's own state line only;
  an unknown queue kind must not break the Activity drawer (F-019 criterion).
- Eligibility is strict: YuE2 first take, one layer, no repaint versions, sidecar that passes `parse_abc`, score has chords (so `cot` full is
  right, D-010). Cover, instrumental and chord-free songs show the reason and wait for M3 (D-021).
- Lyrics and style are sent **as stored**, changed only by what an op says: SP-3 measured that normalizing `[Verse 1]` to `[Verse]` alone moves
  2-8% of the notes, so no op in M0 may re-derive tags (D-023). Tag derivation arrives with the first section op (M2).
- The plan lives in server memory with the job registry; a server restart loses it (D-020).
- Planner: dense qwen3:14b Q4_K_M at 16k context (10.9 GiB, 2 GiB of card left, 2.5 s cold load). The model name is an env setting; the 26B
  MoE (gemma4:26b-a4b, 16.98 GiB, card 96% full, 12-50 s cold load) is a supported *value*, not a tested configuration (D-024).
- Validator and applier run on the yue-server (R-016): CPU-only routes next to upstream `abc_tools.py`, not a TypeScript port (D-019).

Work packages, each one PR, in this order (risk first; the headless checkpoint burns down the real-platform risk before any UI):
1. W0 F-016 amendment (docs).
2. W1 F-017 yue-server score routes (apply / check / bar map / token+duration), golden tests from SP-2's 39 cases.
3. W2 F-018 eligibility, F-019 plan job, F-020 hand-off + context guard. **Checkpoint CP1:** a script (not the UI) runs request →
   plan → apply → render → new version against real Ollama + real yue-server on this machine; log kept. If CP1 fails a spike number
   (hand-off > 5 s, YuE2 < 80 tok/s, plan p50 > 60 s), stop and raise it before W3.
4. W3 F-021 dock verb, F-022 review limits, F-024 error and cancel states.
5. W4 F-023 APPLY & RENDER + version.
6. W5 F-025 the live run in the real app (the M0 exit).
Honest size: this is more than one focused week (W1 and W2 are each 2-3 days, W3-W5 about 4). It cannot be cut further without removing a step
of the promise; the CP1 checkpoint is where to re-plan if W1-W2 run long. Features: F-016 .. F-025.

M0 exit evidence (what "done" means; `passes` for F-025 stays false until the user's listen is in):
- one real run, on the real card, logged: plan latency (cold and warm), attempt count, unload-to-empty time, VRAM vs the pre-plan baseline,
  YuE2 tokens/s, duration estimate vs actual, `truncated` flag, tempo from median bar length within 4% of the new `Q:` (SP-3 `analyze.py`
  method), root agreement on the reharmonized bars (reported next to the SP-3 chance level, not pass/fail);
- owed to the user, numbered when F-025 is verified: A/B the two versions (base vN-1 vs vN) for tempo (expect "clearly") and chords
  ("clearly / slightly / no"). If the user hears the chord change in fewer than the 4 of 5 SP-3 pairs, REHARMONIZE ships with the "a
  request, not a guarantee" wording only and Q-001 C's fallback is raised before M1.

## M1 — The riskiest remaining op, the warning, the regression net

Highest remaining risk first: WRITE PHRASE as a phrase of `{pitch, beats}` notes, code writing the ABC (SP-2: 100% / 94% valid; free ABC strings
are Not doing). Then the first-ACE-Step-edit warning (Q-015 default A), because with YuE2 the default (D-015) every new song starts with SCORE
open and the first ACE-Step edit closes it (D-006), and the warning must exist before users have SCORE. Then the e2e: SCORE touches
the golden path, and CI has no Ollama or yue-server, so it needs two fakes. Features: F-026, F-027, F-028.
- If the user's SP-2 phrase listen (owed) says the phrases are not musical, F-026 ships with an "EXPERIMENTAL" label and a Q is raised
  (D-005's revisit clause is about validity, not taste); it is not a reason to delay M1.

Work packages (2026-10-05, autopilot), each one PR from `origin/main`, files named so batches stay disjoint:
1. W6 F-027 first-ACE-Step-edit warning: client consequence builders of REPAINT, ADD LAYER, extract-to-layer, REMASTER MIX
   (+ Vitests present/absent). Copy per D-030: "score editing ends after this edit, SCORE will be off for this song". Branch
   `feat/score-w6-warning`. Batch 1.
2. W7 F-026 yue-server half: phrase `{pitch, beats}` -> ABC writer (units, ties, bar sums), `Ins` overlay only where the Vocal rests,
   refusal naming the free bars, sanity gates (>= 4 notes, >= 3 pitches, >= 70% in key, not 4 identical bars), beat-sum errors with
   numbers; ported from SP-2 `score.py` `op_write_phrase`; pytest. Branch `feat/score-w7-phrase-yue`. Batch 1.
3. W9 F-028 e2e: fake Ollama + fake yue-server score routes in `e2e/` beside fake-acestep, a SCORE spec (happy path, planner offline,
   360 s refusal, cancel while planning), CI. The existing golden path unchanged, no LLM_API_URL. Branch `feat/score-w9-e2e`. Batch 1.
4. W8 F-026 server + client half (after W7's route contract): op schema (N bars per request), planner prompt + retry feedback, style
   append, change-list row, consequence clause "the instrument is a request, not a guarantee". Branch `feat/score-w8-phrase`. Batch 2.
5. CP2 live: the compound request on 3 library songs (copies), attempts logged; then the verifier for F-026..F-028.
6. W10 (if the round budget allows) Q-038 review nits, D-056. Branch `fix/score-m0-nits`. After W8 (shares server score files).

## M2 — Deterministic section ops, referents, revise

TRANSPOSE, REPEAT / CUT, REWRITE LYRICS, and the lyric-tag rule they force (R-018: tags rewritten from the edited score's `% section`
comments, the planner never writes tags; REPEAT un-ties the seam, the finding from `f3e3bfdc`). The dock's selection (section, lyric
line) goes with the request as the referent, since "which chorus" was the only intent failure in SP-2. REVISE: a follow-up request
that sees the pending plan. The duration guard learns to name the section to cut. Features: F-029 .. F-033.

Work packages (2026-10-05, autopilot, D-062), each one PR from `origin/main`:
1. W11 F-029 yue-server TRANSPOSE: `score_transpose.py` (every pitch +n, every K: line incl. inline, chord roots, the 30-name key
   table, refusal outside it), op on `/v1/scores/apply` (-11..11), selftest 9 library scores x 6 intervals, contract fixture.
   Branch `feat/score-w11-transpose-yue`. Batch 1.
2. W12 F-030 + F-031 yue-server: `score_sections.py` REPEAT / CUT (literal copy, seam un-tied, f3e3bfdc), `score_lyrics.py` (blocks,
   tags rewritten from the edited score's `% section` comments, R-018; the rule for a section with no matching block; REWRITE_LYRICS by
   block number + tag occurrence, same line count, no tags); apply takes and returns `lyrics`; seconds per section for the cut hint;
   contract fixtures. Branch `feat/score-w12-sections-yue`. Batch 1 (shares the op dispatcher and README with W11: second to merge rebases).
3. D-M2 mockup (stage 5 for M2, Q-029): referent on the chip (F-032), stale selection, REVISE and "changed since the last plan"
   (F-033), lyric-diff row and block naming (F-031), the cut hint (F-030 #2). `pipeline/design/score-m2.html`. Batch 1.
4. W13 server half (after W11/W12 contracts): op schema + planner rules for TRANSPOSE, REPEAT, CUT, REWRITE_LYRICS; render sends the
   edited lyrics; duration guard names the section to cut. Branch `feat/score-w13-section-ops`. Batch 2.
5. W14 client half (after W13's types + the mockup): change-list rows, consequence clauses (key "follows", lyric diff, whole-song
   re-render), cut hint. Branch `feat/score-w14-section-dock`. Batch 2/3.
6. W15 F-032 + F-033 referent and REVISE, server + client (after W13/W14). Branch `feat/score-w15-referent-revise`. Batch 3.
7. CP3 live: a repeated chorus renders (F-030 #4), transpose + revise on library copies; then the verifier for F-029..F-033.

## M3 — More songs

> **Folded into the chat scope (2026-10-06, D-079/D-096): see C3 and C7 above.** F-034 -> C7/F-078, F-035 -> C3/F-065. Not built; do not start it as M3.

"New song from this score" for songs D-006 makes ineligible (the other half of D-006), and chord-free, instrumental and cover scores (the
`melody` render path, REHARMONIZE writing all chords makes it `full`). Features: F-034, F-035.

## M4 — Seeing and reaching it

> **Folded into the chat scope (2026-10-06): see C2 and C8 above.** F-036 -> C2/F-060 (bar map inside the edit card), F-037 -> C8/F-079, F-038 -> C8/F-080, F-039 -> C8/F-081 ("Edit score" becomes "Ask in chat"). Not built; do not start it as M4.

Bar map in the review (the dock-body-height question R-006 is judged at stage 5 and may pull a collapsed bar map into M0's review if the layout wants
it), Settings planner card, Activity drawer entry for the plan, palette pre-fill. Features: F-036 .. F-039.

## Interaction specs

### SCORE verb (F-021, F-022, F-023, F-024) — states, transitions, error, cancel

States (the dock keeps the verb's body mounted; the verb is per-session state, as for the other four):
1. `hidden` — the song's base is not from YuE2 (ACE-Step songs, imports, HeartMuLa), or `LLM_API_URL` unset (feature-gated, AGENTS.md).
   No tab. (An unset `LLM_API_URL` is "not set up", not "offline".)
2. `ineligible` — a YuE2 song that fails D-006/R-017: more than one layer, a repaint version exists, sidecar missing or failing the validator,
   score has no chords (until M3). Body = one rust-free reason line naming the cause ("this song has a repaint version, score editing ended
   when it was made"); M3 adds NEW SONG FROM THIS SCORE.
3. `offline` — probe of `LLM_API_URL` (Ollama `GET /api/tags`, model present) failed: "PLANNER OFFLINE — start Ollama · model qwen3:14b
   not pulled: `ollama pull qwen3:14b`" in rust, with RECHECK. A non-Ollama server reads "LLM_API_URL is not an Ollama server: the GPU
   hand-off can't be confirmed" (D-012).
4. `asking` — request text field, empty example text, the one-line consequence "asks the planner · uses the GPU for ~10 s · changes nothing
   yet", and PLAN. The score reading (bars, duration, tempo, key) is shown as `text-low`.
5. `queued` — PLAN pressed while the GPU is busy: `PLANNING · QUEUED · STARTS AFTER 2 JOBS`; CANCEL.
6. `planning` — slot held; `PLANNING… attempt 1 of 3`; a retry shows the reason in `text-low` ("bar 5 had 31/32 units"); CANCEL. The slot is held
   across every attempt and the unload; the user's review never holds it.
7. `plan ready` — change list (SET TEMPO 87 → 88 BPM · REHARMONIZE bars 17-24 · EDIT STYLE …), each row with a verdict tick; checks line
   (`65 bars · est 183 s of 360 s · 1,520 of 4,096 tokens · chords valid`); consequence line (below); APPLY & RENDER (acid) enabled. The
   request field stays editable; editing it and pressing PLAN again replaces the plan (M2: REVISE sees it).
8. `check failed` — three attempts spent, or a hard limit, or a refused op, or context truncated, or the plan changes nothing:
   rust lines, one per cause with the number ("estimated 458 s: over the 360 s limit; at least 112 BPM fits"), APPLY & RENDER disabled,
   the request editable. An op the validator rejected is listed with its reason, never silently dropped.
9. `render queued` / `rendering` — APPLY & RENDER stays the commit (label never becomes progress), a job line under it:
   `RENDERING… 1:12 · 38%` (AI shader like repaint) or `RENDERING · QUEUED · STARTS AFTER 1 JOB`; CANCEL.
10. `done` — "Saved base v3 · 88.1 BPM, 3:04"; lilac version badge; the VERSIONS rail shows v3 active, v2 below it. A `truncated` result
   instead reads in rust "TRUNCATED at 6:00, the song is cut short — v3 is saved; revert in VERSIONS or shorten and re-render" (never DONE).
11. `render failed` — rust error from the engine job with RETRY RENDER; no new version; base unchanged; the plan is kept and reviewable.
12. `stale` — at APPLY & RENDER the server re-checks: eligibility lost (a repaint was queued after the plan), the base version is no longer the
   one planned against, or the plan expired (server restart): the refusal names the reason, no engine job starts; PLAN AGAIN.

Transitions:
- `hidden` ⇄ `ineligible` / `offline` / `asking`: song opened, song changed (a version added), probe result; the verb re-evaluates on song load.
- `asking` → PLAN → `queued` (slot busy) or `planning` (slot free); `queued` → `planning` when the slot is free.
- `planning` → `plan ready` (valid within 3 attempts) | `check failed` (invalid after 3, limits, truncation) | `offline` (planner unreachable
  mid-plan) | `asking` (CANCEL).
- `plan ready` → APPLY & RENDER → `stale` (re-check fails) | `render queued` → `rendering` → `done` | `render failed` | `plan ready` (CANCEL: plan kept).
- `plan ready` / `check failed` → edit request + PLAN → `planning` (the old plan stays visible, dimmed, until the new one is ready).
- `done` → request field cleared, `asking`; the new version's own sidecar is what the next plan reads.

Cancel:
- while `queued`: removed from the queue (existing `cancelQueued`), back to `asking` with the text kept.
- while `planning`: abort the HTTP call, then **still** `keep_alive 0` and poll `/api/ps` until empty before the slot is released (the same
  "slot waits for the backend to let go" shape as ABORT on a running job); back to `asking`, text kept, no plan.
- while `rendering`: the existing ABORT: the slot is held while YuE2 drains; no new version; base stays active; the plan stays on screen.
- closing the tab or reloading: server-side jobs continue; reopening SCORE rehydrates from the job (like generation jobs do).

Error:
- planner HTTP error / timeout / 404 model not found: after trying the unload anyway, → `offline` (names the cause and the fix).
- unload not confirmed (`/api/ps` still lists a model after 10 s): the plan job ends in an error naming the model and `ollama stop <model>`; the
  slot is released after the bound; **APPLY & RENDER refuses while `/api/ps` lists a model** (R-003 fallback, enforced at commit).
- context: after the call, `/api/ps` `context_length` below `prompt_tokens + 2,500`, or `usage.prompt_tokens` below the character-based
  lower bound for the prompt (the spike's silent-truncation signature: ~half the context), → `check failed`: "planner context is N, needs
  ~M: set OLLAMA_CONTEXT_LENGTH=16384". Never a plan from a truncated prompt.
- engine job errors use the existing rust error line + RETRY.

Consequence line (composed from the ops actually in the plan; D-007, R-013, R-014):
`Saves base v3 · re-renders the whole song on YuE2, about 3 min · every bar will sound different · tempo follows 88 BPM · harmony in bars 17-24 is a
request to YuE2, not a guarantee · v2 stays in VERSIONS`. SET TEMPO and REPEAT/CUT/TRANSPOSE state "follows" (reliable); REHARMONIZE and
WRITE PHRASE (and an instrument named in EDIT STYLE) state "a request, not a guarantee"; a plan of only reliable ops omits that clause.

Design tasks for stage 5 (layout decides these, not this file): DT-1 the SCORE dock body: the dock's idiom is one consequence line,
the change list + checks make it taller (R-006): row height, whether the checks collapse to one line, whether the dock grows or the body scrolls;
DT-2 the SCORE key (R, L, S, E are taken) and tab order; DT-3 the TARGET chip text for SCORE (`SONG · WHOLE SCORE`?) and whether the lyrics-lane selection
shows as a referent (M2); DT-4 hues: errors and `truncated` rust, version badge lilac, scope chip sky, APPLY & RENDER the only acid fill,
PLAN's outline weight; DT-5 the dimmed-old-plan treatment. DESIGN.md is updated in the same PR as its own commit (AGENTS.md).

### The plan → render hand-off (F-019, F-020, F-023) — the part with no UI

`enqueue(plan)`: slot taken → build the prompt (BAR MAP, from the yue-server) → planner call(s) ≤ 3 with the numeric feedback → unload →
poll `/api/ps` (250 ms) until empty → verdict stored on the job → slot released. `APPLY & RENDER` → re-check (D-006, base version, plan alive,
`/api/ps` empty) → `enqueue(scoreRender)` with its own slot → yue-server `POST /v1/jobs` (edited `abc`, `cot` full, stored style, stored lyrics
(or the op's edit), the base's seed) → result → new base version + `${versionId}.abc` sidecar → release. Two slots, not one: the user's review
must not hold the GPU.

## Later

- **A/B listen of two versions (Q-008, deferred; re-checked: stays deferred).** The version rail already activates v2 or v3 for ordinary playback, so
  the comparison exists without new UI; an A/B control needs its own design and the redesign's open question 1 is unanswered. Revisit after M0's
  listen shows whether people reach for it. R-013's fallback text names it as the trust tool, so it is the first Later item.
- **Post-render "did it take?" report** (SheetSage2 re-read of tempo and edited-bar roots, as SP-3 did) — a second GPU job of 1-3 min per render;
  M0's consequence line and the owed listen carry the honesty instead. Do it if users distrust the harmony results.
- **Drop one op from a plan** — REVISE (M2) covers the need; a per-op checkbox needs the validator to re-run per subset.
- **Plans surviving a server restart** (D-020), **keeping the planner warm for a session of revisions** (cold load is 2.5 s for the 14B; the 14B
  leaves 2 GiB of card free, which is not enough margin to co-reside), **NVML VRAM baseline check** before render (`/api/ps` empty was enough in SP-1;
  needs a baseline taken just before the plan, not a constant), **CPU-only planner** (Q-012 C: 98.7 s vs 8 s, over D-013's p50 line),
  **llama.cpp router support** (D-012 Ollama first), **a tested MoE planner profile** (gemma4 26B-A4B: 16.98 GiB, card 96% full, 12-50 s cold
  load; works as an env value only), **multi-turn conversation memory**, **selecting bars by dragging on the bar map**.
- **Queue pause while a backend is down (Q-009, deferred; unchanged).**
- **Score edits after an ACE-Step edit** (Q-003 B/C): D-006 blocks them; revisit if users routinely want them (D-006's clause).

## Not doing

- **Free-form ABC bar strings for WRITE PHRASE** (the mockup's design) — SP-2: 44% within 3 retries on qwen3:14b, 89% (Wilson low 67%) on the
  26B MoE, versus 100% / 94% as `{pitch, beats}` notes with code writing the ABC. The model does the music, code does the arithmetic (R-002).
- **A TypeScript port of the validator or applier** — upstream warns against substituting a parser with different accidental semantics; the spike's
  applier is 553 lines, past the 200-LOC cap (R-016 → D-019).
- **The planner writing lyric section tags** — derived by code from `% section` comments (R-018). A silent tag change is itself a drift source (SP-3).
- **The mockup's old surfaces**: a SCORE · YUE2 mode in the prompt bar, a left score panel, a history rail (all deleted by S1; superseded by D-007), a
  new top-level Score view (D-007 B) and a rail that swaps to review (D-007 C).
- **User-facing melody-contract modes (EXACT / PITCHES / FREE)** — the contract stays inside the validator, as `compare`'s allowed changes per op
  (SP-2); nothing for the user to set.
- **Region-level YuE2 re-render, "keep the rest identical"** — YuE2 has no waveform inpainting and re-renders everything (R-014); the consequence line
  says so. Repaint on ACE-Step remains the local-edit tool.
- **Cloud / frontier-model planners** — local-only (brief); `LLM_API_URL` is a local server.
- **Thinking-mode planners** — `reasoning_effort: "none"` is part of the contract (SP-1: 1,500 tokens of reasoning, empty content, 71 s otherwise).
- **Per-note / piano-roll editing, tuplets, repeat signs, `w:` lyric lines in the score** — the native dialect rejects them; AGENTS.md rules out a MIDI editor.
- **SCORE on HeartMuLa, ACE-Step, import or other-engine songs** — no score exists (D-014, D-015, R-017).
# Scope — Engine pairing (ACE-Step 1.5 × YuE2)

Framed 2026-10-08 from an audit of both upstreams (feature pass step 1, not yet sized by the owner). Sources: YuE `main` @ `1647252`
(docs/, README, `src/yue2/`, `skills/yue2-music/`); ACE-Step-1.5 `main` @ `ca1e85f` (docs/en/, `acestep/api/http/`, `constants.py`,
`inference.py`, GitHub issues to #1350); `ace-step/awesome-ace-step` (README, 2026-05-28) and the projects it lists, chiefly
gary4juce v5 (YuE2 + ACE-Step in one plugin, AGPL: patterns only, no code), Ace-Step-Wrangler and yuey.cpp. Local ACE-Step:
`S:\AI Gen\ACE-Step-1.5` @ `64ffc2f` (`local/analyze-audio`, upstream base `6d467e4`, 15 commits behind, five local commits).

The split stays as it is (D-015, AGENTS.md): YuE2 writes the song and owns the score; ACE-Step does every audio edit. YuE2 has the better
first take (upstream SongBench 6.73 vs 6.01) and a score, but sings en/zh only, has no stems, no local edit and stops at 360 s. ACE-Step
cannot plan structure, but repaints locally, adds and extracts layers, sings 51 languages and can outpaint past the end. Each feature
below hands one engine's strength to the other. Each gets its dated PLAN.md section with its build PR (CLAUDE.md, 3+ files).

## Preconditions (fixes, not features; before E1)

- **P1 — ACE-Step fork sync (R-034, Q-121) — rebased 2026-10-08 (D-203); live once ACE-Step restarts on branch `mulakai`.** The local fork lacks upstream #1287 (lego/complete skip the 5Hz LM so `src_audio` is
  honoured; locally `inference.py:646` skips it only for cover/repaint/extract and `use_cot_caption`/`use_cot_language` default true),
  #1273/#1282 (DCW off for base/sft over REST; locally `dcw_enabled` defaults true with no REST field: distortion on Base) and #1284 (a
  requested model loads instead of silently falling back). F-082, F-086 and F-088 run lego/complete on Base, so they wait for P1.
- **P2 — Stem extract wiring (R-035).** `stemRunners.ts:53-58, 89-94` sends a free-form `instruction` (used verbatim; the model was
  trained on "Extract the VOCALS track from the audio:", built from `track_name`) and no `model` (runs on the last-loaded model, often
  Turbo, which has no extract). Send `track_name` and a Base model; "other" has no ACE-Step track name.
- **P3 — TAKES waste.** text2music `batch_size` AUTO is 2 and `poll()` keeps one (`jobRunner.ts:95`): force 1, or keep the extra take.
- **P4 — Doc fix — done with D-203.** CLAUDE.md:76 names `uv run acestep … --enable-api`, whose API is text2music-only (no `src_audio`, R-025);
  `start-all.bat` correctly runs `acestep-api`.

## E1 — Quick wins (F-082, F-084, F-088)

### F-082 · The song's facts in every ACE-Step edit (small; needs P1 for lego)
Repaint, Add Layer and complete on a song send what the song already knows instead of the bare instruction: `bpm`, `key_scale`,
`time_signature` from the song row (a YuE2 song's come from its score header via `abcMeta.ts`; an ACE-Step song's from its result
metas), and for lego the song's caption as `global_caption` (upstream's song-level caption for stem lego). The user's instruction stays the
local prompt. ACE-Step's tutorial calls the caption the most important input; repaint and Add Layer send none today.
- Acceptance: unit tests on the built request for a YuE2 song, an ACE-Step song and a song with no metadata (sends none, never invents);
  owner listen, 3 Add Layer drum takes on 2 YuE2 songs with and without, at fixed seeds; kept if the owner hears a tighter fit in at least
  2 of 3, else reverted and recorded.
- Non-goals: no caption field in the UI, no LM rewriting of the instruction, no change to cover/remaster (they already send the row).
- Open: Q-123 (repaint's prompt: instruction only, or instruction plus caption).

### F-084 · Route a song's first take by its language (normal; owner default Q-122)
YuE2 sings en/zh (model card; Cantonese poor, issue #184); German/Spanish/French/Italian/Portuguese recipes reach it today with only a
language word in the style (D-112, `withLanguage`). ACE-Step lists 51 languages. A new song whose vocal language is neither en nor zh
defaults its first take to ACE-Step, with the reason and "no SCORE editing" in the consequence line; the person can switch back to YuE2.
- Precondition: an owner listen, 2 German and 2 Spanish songs on both engines, confirms YuE2 is worse; if not, F-084 is dropped.
- Acceptance: Create picks ACE-STEP for a `de` song with the reason shown and an override; en, zh and instrumental songs unchanged;
  in chat the recipe may only name `acestep` once C7 lands (D-112 (e), R-025), until then the reply names the risk.
- Non-goals: automatic language detection beyond the existing lyric-language guard; translating lyrics.

### F-088 · Wordless vocal, then words (small; needs P1)
gary4juce's "gibberish to lyrics": on a song with no vocal, ADD LAYER vocals with no lyrics (lego on Base) gives a wordless vocal idea;
a second step covers that layer with the person's lyrics, keeping its melody. Gives vocal ideas over a YuE2 instrumental, which YuE2
itself cannot add without re-rendering the whole song.
- Acceptance: both steps run on 2 instrumentals; the second step's words read back by lyrics-server at WER ≤ 30 %; the vocal stays in
  the same bars (onset map within 1 beat); each step is its own version with a consequence line.
- Non-goals: harmony/backing-vocal stacks, per-line timing control.

## E2 — Pairing verbs (F-083, F-085, F-086, F-087)

### F-083 · Bar-true regions from the score (normal)
YuE2 lands within 0.1 % of the score's tempo (R-013), so a scored song's bar and section times are exact; chat C1 already reads them
(`/v1/scores/bars`, `yueScoreBars.ts`, D-194, Q-120). The Editor does not: a YuE2 song has `lyricTimestamps` null and shows no section
strip until a lyrics-server reading lands. Use the bar map in the Editor: the section strip draws from the score's `% section` timing
at once, and REPAINT / Add Layer regions snap to bar edges (Alt frees, as in the chat).
- Acceptance: a YuE2 song with no lyrics reading shows its sections; a drag snaps to bar times (within one 40 ms latent frame); after an
  ACE-Step repaint the bars stay (D-006, `barShift.ts`), after an edit that moves them the strip falls back to the reading.
- Non-goals: beat-level snapping (chat "Not doing"); bar maps for songs without a score.

### F-085 · EXTEND past the end (normal; R-036)
YuE2 stops at 360 s and has no continuation. ACE-Step repaint pads the source with silence when `repainting_end` passes its end
(`padding_utils.py:38-70`), so a repaint over the last few seconds plus N new seconds continues the song; chaining extends further
(tutorial: 3-90 s per step). The new version carries F-082's song facts.
- Acceptance: a version N s longer (±0.1 s) for N in 10..90; the kept part matches the source after gain matching (ACE-Step
  peak-normalises, SP-4); two chained extends work; a result over 600 s (ACE-Step's ceiling) is refused before the job; on a YuE2 song the
  consequence line says SCORE editing ends (D-006).
- Non-goals: extending at the start, extending a single layer of a layered song.

### F-086 · Replace one part of a single-mix song (normal; needs P1)
YuE2 gives one stereo mix. REPLACE <part>: split the song (Demucs/UVR, not ACE extract), keep the stems as layers, mute the chosen one,
and regenerate it with lego on Base (`track_name`, F-082's facts) or complete with `track_classes`. gary4juce reports lego is strong for
vocals and backing vocals and generic for other parts, and loops a source under about 1 minute up to about 2 minutes, then trims.
- Acceptance: drums and vocals replaced on 2 YuE2 songs; the original stem stays as a muted layer (nothing destroyed); the consequence
  line names the split and the part; a source under 60 s is looped and trimmed back to its length.
- Non-goals: replacing a part over a region only (Add Layer is whole-song, PLAN.md); stems beyond the separator's four.
- Stored data: a song gains layers from its own split; the migration note goes in the PLAN.md section before code if the split-to-layers
  path does not exist yet.

### F-087 · A closer-to-source REMASTER (small; owner A/B decides)
REMASTER runs `cover` (FSQ: the source passes through 5 Hz codes) on xl-sft at 100 steps. Upstream's `cover-nofsq` feeds raw latents
and stays closer to the source; gary4juce uses it at `cover_noise_strength` 0.2 and reports a pass makes a YuE2 take "shinier". Issue
#1329: noise strength above 0 gives near-silence on XL SFT, so this tries 2B SFT and xl-turbo.
- Acceptance: duration unchanged; words kept (lyrics-server WER change ≤ 5 points); owner A/B on 3 YuE2 songs, kept only if preferred in
  at least 2 of 3 (Q-124: REMASTER's path changes, no new verb).
- Later: loudness/EQ matching to a reference track (Matchering, GPLv3: only as a separate process).

## E3 — Native runtimes (F-089, spike first)

### F-089 · YuE2 and ACE-Step without WSL (risky; SP-7, R-037)
yuey.cpp (MIT, C++/GGML YuE2, prebuilt Windows CUDA; BF16 6.8 GiB, Q8 3.6 GiB, Q4_K_M 2.4 GiB; plan-only and score output; SheetSage2
built in) and acestep.cpp (MIT, loads models on first request) may run both engines natively on the 16 GB card, possibly side by side.
Windows Python YuE2 falls back to slow attention (#209), which is why yue-server lives in WSL.
- SP-7 measures on the RTX 4080: render quality against Python YuE2 at the same score and seed (owner blind A/B, 4 songs), RTF, VRAM
  peak, both resident at once, and whether yuey.cpp covers yue-server's contract (external `abc`, `cot` modes, plan-only, token counts
  for the 4,096 budget, `truncated`). Pass: a PLAN.md migration section; fail: WSL stays, recorded.
- Non-goals: dropping the Python path before SP-7 passes; GGUF quantisations below Q8 for the shipped default.

## Later (engine pairing)

- **Plan-only YuE2 jobs** (upstream `--stage plan`, about 18 s vs about 95 s): draft the score, edit it, then pay for audio.
- **A fast chord scaffold instead of the YuE2 planner** (gary4juce): code writes the ABC from tempo, key, meter and bar counts using stock
  progressions; their finding is that chord changes per bar hold YuE2 to tempo.
- **MIDI melody/chord import into a score** with gary4juce's rules (monophonic, straight grid, root-position triads, no partial bars).
- **Syllable fit for REWRITE_LYRICS** (`score_lyrics.py:109` checks only the line count; upstream says match syllables to the melody).
- **CPU forced alignment for word timings** (torchaudio MMS_FA, as Ace-Step-Wrangler): timings for YuE2 songs without GPU time.
- **`repaint_mode` / `repaint_strength`** as REPAINT's one strength control; **`full_analysis_only`** as the upstream replacement for the
  fork's `/v1/analyze_audio`.
- **Community YuE2 adapters** (Mothersuperior instrumental AR LoRA; real-audio tokenizer + NAR LoRA for continuation from audio):
  CC BY-NC like the weights; only after SP-7 decides the runtime.

## Not doing (engine pairing)

- **ACE-Step `extract` as the default SPLIT** — Demucs/UVR stay the default (gary4juce hid ACE extract for the same reason); P2 only
  makes the option correct.
- **YuE v1** (`YuE-v1` branch: stems and audio-prompt ICL): a third engine, ruled out in PLAN.md; nothing in the audit changes that.
- **Splice seams healed by ACE-Step repaint** (SP-4 B, D-080), unchanged.
- **Copying code from gary4juce, DEMON or ACE-Step-DAW** (AGPL): patterns only.

## RT — Re-time a transcription (F-090 .. F-094; D-190, D-206 .. D-208)

A SheetSage2 score sometimes reads the beat wrong: half time, double time, or a tempo the owner can name. SheetSage2 builds the ABC from
saved model outputs (`notation/song_melody.mid`, `_beats.txt`, `_chords.txt`, `_keys.txt`, `_structures.txt`) and snaps the melody onto
the beat list, so the fix is a corrected beat list and a rebuild: CPU only, seconds, no model re-run (SP-8, R-039). A tempo only slightly
off stays SET TEMPO (exists). Both consumers and every surface (owner, D-206): the C3 cover's TRANSCRIBE score, the C1 chat reading's
score, the SCORE dock and a chat verb. The outputs are kept on the Mulakai server with the transcription, so re-time still works after
yue-server's 24 h sweep or a restart; with no saved outputs the person is offered TRANSCRIBE AGAIN (owner, D-207).

Feature track: normal (stored data, a yue-server route, new UI). Order: RT-1 → RT-2 → RT-3 → RT-4; RT-5 after C1 is merged; RT-6 after C2.

### F-090 · The rebuild and the kept outputs (RT-1 yue-server, RT-2 server)
- RT-1: yue-server `POST /v1/scores/retime` `{bundle, mode: half | double | bpm, bpm?, melody_only}` → `{abc, measures, bpm, warnings}`,
  the beat transform in Python (only yue-server reads/writes ABC, decision 0002), the rebuild in SheetSage2's venv as a CPU subprocess;
  a transcription job also returns its bundle (`GET /v1/transcriptions/{id}/notation`). 422 with the reason when the rebuild fails or the
  BPM is out of range.
- RT-2: the server fetches the bundle when a transcription finishes and keeps it (see "Stored data" below); `POST /api/retime` rebuilds
  from a kept bundle by its id.
- Acceptance: half/double/BPM rebuild on 2 real outputs in under 10 s with measures ≈ ½ / × 2 / × ratio; double and a BPM at or above
  the read tempo keep the melody's notes (≤ 3 % lost); half and slower grids snap notes onto SheetSage2's fixed 4-subbeat grid
  (`fit_midi`) and report `dropped_notes`, never claimed lossless (SP-8: 9-26 % on correctly-read songs, D-210); chords and section labels
  survive; a bundle survives a yue-server restart; a missing bundle answers `no_bundle`.
- Non-goals: re-running any model; beat-level editing; re-timing a score that no transcription made.

### F-091 · RE-TIME on the cover's transcribed score (RT-3, `YueCoverPanel.tsx`)
The cover panel shows what was read (`READ AS 140 BPM · 4/4 · 96 BARS`) with HALF · DOUBLE · BPM…; the consequence line names the new
tempo and bar count before the rebuild. The rebuilt score replaces the panel's score; UNDO returns the one before.
- Acceptance: a 140-read score becomes 70 BPM with half the bars and the cover renders from it; BPM… refuses outside 40–240; a cover whose
  bundle is gone shows TRANSCRIBE AGAIN with its GPU time.
- Non-goals: re-rendering the piano preview if SP-8 shows it is not cheap (then the preview is marked stale).

### F-092 · Re-time a chat reading (RT-5, after C1 is merged)
The reading's SCORE part (a transcribed song, not a YuE2 one) can be re-timed from the reading line; the consequence says the bar numbers
change and a mark on this version goes stale. The re-timed reading replaces the stored one (bars, sections, bar times) and is kept as the
version's reading.
- Acceptance: after HALF the strip shows half the bars at the same seconds; an existing mark on the version shows the stale card.
- Non-goals: re-timing a YuE2 song's own score (its beat is what YuE2 rendered: SET TEMPO / SCORE are the tools).

### F-093 · RE-TIME as a SCORE dock op (RT-4)
For a cover whose score came from a transcription and whose bundle is kept, the dock offers RE-TIME beside SET TEMPO; it is generative
(YuE2 re-renders), so it has a consequence line with the render time, like every SCORE op.
- Acceptance: RE-TIME HALF on a cover song plans, shows the consequence and renders a new version at half the bars.
- Non-goals: offering it on a YuE2 original or on a cover with no bundle (Q-126).

### F-094 · A chat verb (RT-6, after C2)
"it's half time" / "it's really 92 BPM" makes the planner propose a RE-TIME op card (F-093's op, or F-092's when the turn is about the
reading) with the same consequence copy.
- Acceptance: 3 phrasings each give a RE-TIME card with the right mode; a slight BPM change gives SET TEMPO instead (Q-125).
- Prep done 2026-10-08 (owner: wait for C2 before the prompt): `chat/retimeVerb.ts` `routeRetime` decides, in code, where a
  RE-TIME request goes: the dock's plan (`makeRetimePlan`) for a cover still on its transcription; the reading re-time
  (`readingRetime`, no render) for a song that is not a cover or a turn about the reading; SET TEMPO when the BPM is within 8 %
  of the read; else refused with the reason (D5, D-240, Q-129). Left for RT-6, after C2: RETIME `{mode, bpm?}` in the reply
  schema and the planner prompt (alone in a plan, Q-132), dispatch through `routeRetime`, the reading route's card (D4: UNDO
  TURN = the reading's UNDO), then `chatCp1 --marks` and CP-C2 for the prompt budget.

### Stored data (before code, F-090)
- New: a notation bundle per finished transcription, stored by the server as one JSON file (the five files, base64, tens of KB) under
  `DATA_DIR/notation/<sha256>.json`, content-addressed so the same source shares one. Referenced by id from the cover job's result and the
  cover song's base version `params_json.notationId`, and from the reading's score part in `versions.analysis_json` (`notationId`).
- No change to existing rows and no backfill: a score or reading without `notationId` offers TRANSCRIBE AGAIN. Deleting a version or song
  does not delete a bundle another row may share; an unreferenced bundle older than 30 days is swept at server start.
- Reversal: the files and the optional field can be ignored; nothing else reads them.

### Not doing (RT)
- A mechanical ABC rewrite (scale durations, re-bar) as a fallback (D-207: TRANSCRIBE AGAIN instead).
- Tempo maps or rubato (one tempo per re-time; the BPM grid anchors to detected downbeats).


## LD — Lyrics as their own call; German lyrics on gemma4 (F-095, F-096, F-097; D-205, D-232, D-233 .. D-237, D-260, D-261)

The lyrics step becomes SP-5's rung 3 for every language: the planner's recipe call no longer writes lyrics, a separate lyrics
call does (SP-5 `ladder.py lyrics_call`: system rules per language, `{sections: [{lines}]}` with exactly one entry per sung section,
≤ 3 attempts with the reasons fed back). English and Spanish use the planner's `qwen3:14b` (no reload); German uses
`gemma4:26b-a4b-it-q4_K_M` (owner, D-237: one model, not D-232's two drafts). The extra model loads inside the turn's one `plan`
slot and the turn unloads every model it touched, with `/api/ps` empty, before the slot is released (CLAUDE.md invariant;
docs/decisions/0006 amended by D-233). The recipe card does not change shape.

Feature track: **normal** (a turn protocol change). SP-7 measured the loads and calls; no new spike, no mockup (no new UI). Order:
LD-1 (pure modules, new files) → LD-2 wiring (after C2's CV-1, #238, merges: it owns `turnCall`/`turnJob`/`actionSchema`/
`turnDispatch`) → LD-3 live run.

### F-095 · Lyrics as their own call, every language (LD-1 pure, LD-2 wiring)
The recipe reply says `lyrics: "write" | "keep"` instead of carrying the lines (D-234); code forces `write` when the draft has no
lyrics or its sung sections no longer follow the new structure. `write` runs the lyrics call after the recipe passes its checks, in
the same slot; the card is written only when the lyrics pass too. The lyrics model per language comes from env `LYRICS_MODEL_<LANG>`,
default `de = gemma4:26b-a4b-it-q4_K_M`, every other language = `LLM_MODEL` (D-235). The progress line names the step
(`writing lyrics · gemma4`); the German turn-cost copy says ~35 s, not ~10 s.
- Checks, each a reason fed back to the next attempt: the schema; no bracket tag in a line; language-ID of the whole text = the
  recipe's language (`lyricLanguage`, ≥ 40 chars); no line with an embedded newline or under 6 characters (SP-7); **no prompt-only
  word**: a word from the lyrics call's system prompt that is in neither the request, the title nor the style (stop-list `Mulakai`
  always; SP-7: gemma4 RC09's outro) (D-236).
- A lyrics model that is not pulled fails the turn with `run 'ollama pull <model>'` (nothing changes, F-049).
- Acceptance (fakes): an English recipe makes 2 calls on one model and one release; a German recipe makes 2 calls on 2 models with
  the planner unloaded and `/api/ps` empty before gemma4 loads, and every model unloaded, `/api/ps` empty, before the slot is released,
  on success, a failed check, a cancel during each call, and an unload that times out (the turn fails `unload`); a "make it faster"
  follow-up keeps the draft's lyrics and makes one call; a lyric containing "Mulakai" is refused and retried; CP-C1's prompt p95 stop
  still holds.
- Non-goals: a lyrics model per genre; two drafts (D-237); English quality changes (rung 3 is SP-5's own measured path, D-205).

### F-096 · Live run on the real machine (LD-3, verifier)
On the owner's GPU, with the stack: one German, one English and one Spanish chat song through recipe → CREATE SONG. Record per turn:
calls, models, seconds per step, `/api/ps` after the slot, VRAM peak; and that a YuE2 take queued behind a German turn starts only
after the slot is released. Bar: German turn ≤ 60 s on a warm disk cache; no model listed after any turn; the owner reads the German
lyrics as usable.

### F-097 · An instrumental new song from chat (small feature track; D-260)
Owner report 2026-10-09: on a new-song chat, "remove the lyrics" / "make the song an instrumental" was not complied with (the recipe
had to carry a sung section, and "remove the lyrics" named the words without a keep word, so the lyrics call wrote fresh ones).
- The planner's recipe says `vocals: "sung" | "instrumental"` (one rule sentence: instrumental when the person asks for no vocals,
  no lyrics, no singing or an instrumental, in any language; a follow-up keeps the PROPOSAL / SIDEBAR's). An instrumental recipe
  gets no lyrics call and no lines; the draft keeps `vocals` (additive under `draft_v: 1`). The draft's vocals change only on a
  request that names the words or the voice (`namesVocals`), so "etwas schneller" on an instrumental stays one call and instrumental.
- CREATE SONG of an instrumental draft sends YuE2 its structure as a tags-only skeleton and an `Instrumental, …, no vocals` style
  (buildYue2Request treats tags-only lyrics as instrumental). A sung draft with no lyrics blocks CREATE SONG with
  `LYRICS are empty: write the words, or ask for an instrumental` (never a silent instrumental).
- Client: the card says `INSTRUMENTAL · no vocals` where the LYRICS toggle goes; the sidebar's LYRICS row reads
  `instrumental · no vocals` and stays editable: typed lyrics make the draft sung (server, handEdit).
- Acceptance (fakes): "mach es instrumental" / "remove the lyrics" / "ohne Gesang" / "keine Lyrics" / "sin letra" on a German draft
  with lyrics → recipe instrumental, 1 call, no gemma4, lyrics []; "etwas schneller" on an instrumental stays instrumental in 1 call
  even if the planner flips; "doch mit Text bitte" → sung, 2 calls; CREATE SONG sends the skeleton + instrumental style; an
  empty-lyrics sung draft blocks; the card and sidebar render INSTRUMENTAL.
- Non-goal: removing the vocals from a finished song (a song thread's edit; a stem split is the scalpel for that).

### Not doing (LD)
- Two German drafts with a pick (D-232's plan, replaced by D-237); promising Deutschrap or Liedermacher lyrics in German (SP-7).
- Shrinking gemma4's context for the lyrics call (SP-7: not tried; a later measure if F-096 is slow).
