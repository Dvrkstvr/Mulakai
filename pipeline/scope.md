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
2. **The owner's SP-4 listen** (`pipeline/spikes/SP-4-keep-unchanged/listen`, 20 pairs; Q-054 #1; blocks W-C0b, the splice, and all of C4).
   Outcome goes into decisions.md and PLAN.md decision 6 is cut down to one branch in a docs commit. If the A3 joins are rejected, F-047 is
   re-cut before W-C0b (whole-song re-render plus the explicit "keep the old take for these bars" splice the person listens to). The
   thread/turn/recipe packages (W-C0a) do not depend on it and may overlap the owner's listening.
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
- **The `edit` action** hands the request text to the existing plan machinery (op schema, validators, retry feedback, limits) inside the same
  queue slot as the turn, so there is one hand-off per turn, not two (D-100, architecture confirms).

Work packages, risk first; each is one PR from `origin/main` (the stage-7 style of M0..M2). A design task precedes the UI packages:
- **DT-C0 (stage 5, small):** `pipeline/design/chat-turn.html`, the frames the three signed mockups do not draw: a turn queued / thinking /
  cancelling; the proposal card pending / superseded / expired / committing (RENDERING..., SPLICING...) / failed; the edit card with and
  without a splice consequence line; the join-failed and TRUNCATED lines; "waiting for v2". Tokens from DESIGN.md; no new hue. The owner
  signs it off like the others (a frame set, not a redesign).
- **W-C0a** F-041, F-042: `chat_messages` migration and store, the turn job and action schema, prompt and song-state block, dispatcher stubs.
  Headless, Vitest with the fake Ollama; reuses `plannerClient`, `ollamaControl`, `contextGuard`, `planAttempts`.
- **W-C0b** F-047 yue-server half: `/v1/splices` (grid, snap, crossfade, level match, null-test helper) ported from SP-4's `sp4lib.py` /
  `splice_all.py`, pytest golden cases from SP-4's recorded outputs, contract fixtures for the fake. Parallel with W-C0a. Needs P2.
- **W-C0c** F-046, F-047 server half, F-049 (server states): edit proposal, commit, render-then-splice job, version row with `params_json.splice`,
  cancel and stale paths. **Checkpoint CP-C0** (like CP1): a script, not the UI, runs recipe -> CREATE -> edit turn -> APPLY -> splice -> version
  against the real Ollama and the real yue-server on this machine through the Mulakai HTTP API on :3201 with a throwaway `DATA_DIR` (D-040); log
  kept in `pipeline/cp-c0/`. If it misses a number (turn p50 over 15 s, hand-off over 5 s, edit wall time over 4 min, a null test failing,
  join LUFS excess over 1 dB on 3 of 3 songs) stop and raise it before the UI.
- **W-C0d** F-043, F-044, F-045 (after DT-C0): chat screen, sidebar draft, recipe card, song card, player above the composer (SEND ↵).
- **W-C0e** F-048, F-049 (client states): version card, A/B, lifecycle states.
- **W-C0f** F-050: the live run in the real app, then the owner's listen.
Honest size: about two weeks (W-C0a/b about 3 days each in parallel, W-C0c 3 days, W-C0d/e about 5 days). It cannot be cut further without
removing a step of the promise: CP-C0 is where to re-plan. If the owner wants a one-week C0, the first thing to drop is the spliced edit
(whole-song edit turns only, decision 6's fallback), and the promise loses "only the asked bars change".

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

## C2 — Converging turns: lyrics panel, REVISE, UNDO TURN, the bar map (F-056 .. F-060)

The things that make a conversation converge instead of restarting: the lyrics panel in the sidebar (chat-lyrics.html LY-1..LY-6), a lyric rewrite
shown as OLD | NEW twice, REVISE as a follow-up turn (the existing merge, D-073/D-076), UNDO TURN and the "just filled" marks (CH-4, CH-5), the
bar map inside the edit card (was F-036; PLAN: M4's bar map goes into the edit card). Mostly existing machinery behind new cards, so lower
risk than C1; value high once C1 exists because the mark makes lyric rows pickable.

## C3 — Reference songs (F-061 .. F-065)

The other half of the amended core promise: drop an audio file or pick a library song, `analyze` it (words, score with melody and chords,
caption/tempo/key), keep it as the song's source (D-084), propose a cover (transcribed score, new words and style: the existing USE .ABC FILE
path) or a fresh song that borrows tempo, key, structure and instrumentation words. Folds in the score agent's M3 half "chord-free,
instrumental and cover scores" (F-035) as F-065, because covers are exactly the chord-free scores. Risk: transcription quality on arbitrary
audio and the rights line (the person's responsibility, said on the card). Q-060 arrives here.

## C4 — Structure edits and the rest of the splice (F-066 .. F-069), needs the owner's SP-4 listen

REPEAT/CUT as audio-only edits (SP-4's C: no YuE2 render, about 0.2 s), the splice for WRITE PHRASE and REWRITE LYRICS, and one version from several
local ops. Built only as far as the owner's listen accepts: a rejected seam keeps that kind on the whole-song path. Q-053 (REPEAT's second
seam audible) is judged here.

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

DT-C0 above (turn and card states, before W-C0d). DT-C1 (before C1's client work): the strip and mark on the real waveform at 1366x768 with
the player above the composer (chat-song.html drew the player at the top: the 134 px cost moves; re-check thread height). DT-C2: DESIGN.md
clauses for the player, the sky mark, the ASSISTANT tag and the lyrics panel, each in the first UI PR that uses it as its own commit (AGENTS.md).

## What C0 leaves out, and where it lands

| left out of C0 | lands | why not in C0 |
|---|---|---|
| analyze after every version, the strip | C1 | the splice computes its own grid on demand; the strip needs the analysis |
| the mark ("this") | C1 | needs the strip; words plus a stated assumption carry C0 |
| lyrics panel, UNDO TURN, "just filled", REVISE-merge, bar map | C2 | convergence polish; each has a fallback in C0 |
| reference songs, cover vs fresh | C3 | the other entry to the promise, not the one the thin path needs |
| REPEAT/CUT audio-only, splice of phrase and lyrics, multi-span | C4 | gated by the owner's listen and its ears-only items |
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

## Re-check of deferred questions

- **Q-060** (START FROM A SONG I HAVE / ONE TRACK in chat-first): arrives with C3, a FORM link until then. Not blocking.
- **Q-061** (does form-first's DESCRIBE IT go to the thread): touches only C6. Not blocking; decided at C6's design pass (default: yes, as a
  user message marked "from the form").
- **Q-070** (section names on transcribed songs, A/B by bar): the first half is verified inside F-052 (three non-YuE2 songs); the second is Later. Not blocking.
- **Q-077** (collapsed-sidebar rail text, WHAT IT SEES showing the words): C2/C6 polish. Not blocking.
- **Q-008** (A/B): answered in effect by the chat (decision 8, CS-2); remainder is Later. **Q-037**: not blocking, see Later (disk). **Q-009**: unchanged.
- **Q-038 #4** (a queued word-timings job refuses the render): not blocking C0 (no analyze job exists), **blocking for C1**: F-052's
  criterion says an analyze job never refuses a commit. **Q-038 #6** (double POST) is a C0 criterion on the turn route (F-042).
- **Q-050** (REVISE drops ops on 1-op plans, "fewer chords"): not blocking; F-058 shows the loss as REMOVED, never silent. **Q-053**: judged in C4.
  **Q-062 a/c, Q-063..Q-069, Q-072..Q-076**: assumed in D-091/D-094, built as drawn. **Q-051**: strip half closed by F-053; the hint half stays D-074.
- **No question became blocking for the cut.** The one owner-gated item is the SP-4 listen (Q-054 #1), which blocks W-C0b and C4 only; the SP-5 numbers
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
