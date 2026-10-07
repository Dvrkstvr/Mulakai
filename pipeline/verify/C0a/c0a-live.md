# C0a live verification (CA-4 live pass + CA-7 live run), 2026-10-06/07

Code: origin/main c63c7b6 (CA-4 #156) + local merge of origin/fix/chat-c0a-review (#157, not pushed), worktree agent-a0c2856e457fd15e3.
Stack (all mine, stopped afterwards): Ollama 0.32.15 (qwen3:14b, ctx 16384, models on E:), yue-server in WSL Ubuntu-24.04 :8004, Mulakai server :3201 on scratch DATA_DIRs on E: (a copy of server/data for run 1, empty ones for later runs), Vite :5283. The owner's :3001/:8001 were never touched. Labels: *seen running* unless stated.

## 1. CA-4 live pass (F-050 #1, create leg): no STOP line

`chatCp0.ts --create 1 --gpu` against :3201 through the proxy :11436. Files: `pipeline/cp-c0/2026-10-06/{summary.md,results.json,run.log,nvidia-smi.csv}`.
- PASS turn p50 11.5 s (p95 18.5 s; cold first turn 10.8 s, warm p50 11.7 s). Stop line 15 s.
- PASS worst hand-off 0.1 s (unload-to-empty max 104 ms on every turn; CREATE-to-running 6 ms). Stop line 5 s.
- PASS invalid after 3 attempts: 0 (attempts max 1 on 10 of 10). Prompt about 2.7k tokens per turn on a fresh draft.
- CREATE SONG on the sea ballad: take saved in 95 s, 181 s of audio.
- The 3 vague prompts got a `recipe`, not the script's expected `ask`. F-042 allows it ("a vague request gets a recipe with its assumption stated"); the script's `expect: 'ask'` is stale against that rule, so summary.md lists them as "not the expected action".

## 2. CA-7 live run (F-050 #2, create half), real app at 1366x768

Done end to end three times (run 1 with a Library copy, run 2 on an empty DATA_DIR staying on the chat the whole take, plus two more takes for the Library finding below).
- Library -> CHAT -> "a slow Spanish ballad about the sea, nylon guitar, soft female voice": THINKING line with attempt count, sidebar fields FILLING, reply (English) lists CHANGED fields, recipe card (title, style, 60 BPM, key, 8 sections, 16 lines, YUE2, consequence line "Renders a new song on YuE2, about 4 min · uses the GPU · lands in Library · nothing else changes", CREATE SONG acid). Lyrics Spanish.
- Tempo changed by hand in the sidebar (60 -> 66 run 1, 60 -> 68 run 2): the card shows the old value struck through and YOUR EDIT. The yue job's recorded request says "68 bpm, A major, 4/4 time", so CREATE sent the hand-edited value, not the proposed one.
- CREATE SONG: card "creating", "RENDERING ON YUE2", sidebar locked ("locked until v1 is saved"), SEND waits ("WAITING FOR v1").
- Reload mid-take (run 1): the app opens on the Library (D-119); CHAT shows the thread with RENDERING ON YUE2 restored. When the take landed with the chat in view (run 2, no reload): header MAR DE SUEÑOS "v1 · 3:30 · IN LIBRARY", card DONE · v1 SAVED, song card (v1 pill, "first generation", 3:30 · YUE2), player above the composer (0:00 / 3:29, waveform, DOWNLOAD, pill), sidebar flips to SONG · read-only with VERSIONS v1. Take 2:10 for 28 lyric lines.
- Play: advanced to 0:03 after 4 s (both runs). Space toggles play/pause outside a text field and does nothing with the message box focused. Collapsing the sidebar leaves the rail "FORM · 8 FIELDS FILLED" and the player in view.
- Reload after the song: Library (starts there), then OPEN CHAT on the song: whole conversation incl. SUPERSEDED/CANCELLED rows, DONE card, song card and player back at 0:00. The Library shows the new song (46 -> 47).
- CANCEL while thinking (review fix #1): UI reads "CANCELLED · no reply · nothing changed", not a failure line. API race test: POST turn, cancel at 2.5 s, immediate resend returns 409 "the assistant is still answering in this chat: wait for it or CANCEL"; once the unload is done (about 0.1 s) a resend is accepted (202) and attributed correctly (user 1 cancelled + "cancelled" reply, user 2 runs and gets its own reply).
- Vague prompt: "something nice" -> a recipe (assumptions in the card); "make it better" on an empty draft -> an `ask` with four suggestion chips.
- Hand-edit rule: title typed by hand while a turn ran: line "skipped TITLE, you changed it", TEMPO changed to 170, title stayed "Mein Titel", tag YOURS.
- Restart mid-turn: server killed 3 s into a turn and restarted: reload shows "INTERRUPTED The server restarted while this ran. Nothing changed." with RETRY; RETRY gives a recipe. Older cards show "THIS PROPOSAL EXPIRED when the server restarted ... ASK AGAIN". Qwen3 stays resident in Ollama after the kill until its keep-alive ends (seen in /api/ps); the next turn coped.
- NEW CHAT with a draft: "Drops this draft and its 2 messages · the Library is untouched", DROP DRAFT / KEEP.
- ASSISTANT OFF: Ollama stopped: "ASSISTANT OFF planner offline: no answer from http://127.0.0.1:11434 (fetch failed). Guided Create works without it (FORM ▸); nothing carries over yet." with RETRY and FORM, composer disabled. LLM_API_URL unset: /api/chat/status configured:false and no CHAT / OPEN CHAT anywhere.
- DESIGN.md look at 1366x768: no element has a non-zero border-radius (computed styles); the document is 1366x768 with no scroll in the draft view, the song thread with player and the collapsed sidebar; acid only on CREATE SONG / play; consequence line on the card. Sidebar width (360 px) not measured.
- TRUNCATED line (fix #2): UNCHECKED live: no take hit the 360 s cap (all under 3:30). Still owed.

Screenshots: `pipeline/verify/C0a/live/01..20-*.jpg`. The browser tool's screenshots sometimes lag one action or crop to 800x600, so DOM text was the primary check.

## 3. Finding for the owner: "chat shows the song done, Library still shows it running" (F-044/F-045)

NOT REPRODUCED. Three paths on my 3201 stack, each with screenshots, none leaves a running row once the take is saved:
1. Stay on the chat until DONE (song card + player), then Library without a reload (15-17): Library lists "Licht am Meer · Generated · just now", ACTIVITY shows DONE "NEW SONG · GENERATED · just now" and no RUNNING row.
2. CREATE SONG, switch to the Library while it renders, no reload (18, 19): Library shows a GENERATING placeholder (from `/active`, ACTIVITY · 1 RUNNING, 0:06 -> 1:19, 41 %), then at the end the placeholder is replaced by the real song row, ACTIVITY moves to DONE, the new song is loaded into the footer player and starts playing (the existing "load the freshly generated song" behaviour).
3. CREATE SONG, reload mid-take on the Library (20): the running row is rebuilt from `/active`, and when the take lands the Library refreshes and lists the song; `/api/generate/active` is `{"active":null}`.
Server side is consistent: `engineGenJobs.ts:77-83` persists the song, runs `onSaved` (thread attach, song card), then sets `job.status = 'done'` last, so a chat DONE can never lead the job state by more than the `onSaved` await.
How the Library learns of a chat take (seen in code): the chat never registers the job with `generationStore`/`activityStore` (`chatStore.ts:184-197` `create` only calls `chatApi.createChatSong` and `followCommit`). The Library and ACTIVITY learn of it only through the lock poll: `useAppSync.ts:26-28` (`refreshLock` every 3 s) -> `generationStore.ts:137-141` -> `adopt` (`generationStore.ts:98-103`) which makes a card and `pollJob`s it; the library refresh and autoplay when it lands are `useAppSync.ts` "landed" effect (genJobs `stage === 'done'`, linger 900 ms, `generationPoll.ts:17,63-64`). Inferred failure paths that could leave a stale running row or a missing refresh, none seen:
- A take that is not seen running by a 3 s lock poll (short take, or the tab was hidden/throttled) is never adopted, so no landed event: the Library list is not refreshed until the next `refresh()` (App.tsx:71 on showLibrary, folder change). That gives a missing song, not a stuck row.
- `adopt` returns early while any provisional card with `jobId === ''` and `stage === 'loading'` exists (`generationStore.ts:100`), so a failed/stuck Guided Create submit would hide a chat take's card.
- `pollJob` keeps polling on any non-404 error (`generationPoll.ts:43-45`), so a card adopted just before a server restart or a job record dropped with a non-404 failure would stay "running" until reload.
- The owner's real Library (46 songs, ACE-Step on :8001 up) differs from my scratch DB; I could not run that combination. A second tab was not tested. Next step if the owner can still see it: note whether ACTIVITY or the song row shows it, the tab it was in, and `curl /api/generate/active` at that moment (a non-null value means the server job, not the client, is stuck).

## 4. Verdict per feature (I did not edit features.json)

- F-041 PASS on every live leg: messages persist across reloads and a server restart; pending card shows EXPIRED with ASK AGAIN and no live button; the draft thread became the song's thread (order kept, nothing duplicated); NEW CHAT consequence line. Not exercised live: permanent-delete cascade / trash keeps thread, migration additive and golden-path-unchanged (CI), "a song made before the chat opens an empty thread".
- F-042 PASS on live-checkable items: one turn, attempts 1, unload seen empty in 98-104 ms on all CP turns and the live ones; prompt about 2.7k tokens (p95 6k on the 206-bar song not run); English request -> English reply with Spanish lyrics; vague -> recipe, truly unactionable -> ask. Not run: 3 failures -> RETRY, scalpel/analyze -> say, context-too-short refusal.
- F-043 PASS: entry only with both URLs and the app starts on the Library (D-119), CHAT in the header and OPEN CHAT on a song, SEND ↵ outline text button, fields fill and stay editable during the turn, hand-edit skip line, collapse rail with count, reload keeps the draft, ASSISTANT OFF with cause/RETRY/FORM, unset URL hides the entry, 1366x768 fits.
- F-044 PASS for the create path (card, consequence line, CREATE SONG acid only on the card, current values sent, newer card greys the older as SUPERSEDED, job runs on YuE2, song lands in the Library). Unchecked live: failed take -> rust error + RETRY, YUE unset / invalid lyrics disabled reason, TRUNCATED line. The owner's "Library still running" observation is not reproduced (section 3), so it does not fail the feature on my evidence.
- F-045 PASS: song card, v1 pill, length, player (play/pause, time, seek bar, pill), stays with sidebar collapsed, Space rule, reload restores player at 0:00 and the thread. Not run: click-to-seek, OPEN CHAT on a song with no thread. Note: the player draws a waveform while the criterion says the waveform is not in C0 (F-053); decide if that is the existing player look.
- F-049 turn half PASS: CANCEL while thinking reads CANCELLED and resend during the unload is refused (409); reload mid-turn/mid-take restores the running phase; server restart gives INTERRUPTED + RETRY and EXPIRED cards; ASSISTANT OFF. Not run: cancel while queued, unload-not-confirmed-in-10-s, commit refusing while /api/ps lists a model.
- F-050 create half (#1 CP-C0a, #2 CA-7): met; F-050 stays false until the edit leg (CB-4/CB-6) and the owner's A/B listen.

## Observations (none blocks C0a)
1. The saved song's bpm/key come from YuE2's generated ABC (`readAbcMeta`): the recipe said 68 BPM / A major, the saved song reads bpm 70, "Eb major". The hints go only in the style text, so the card's tempo and key are a request, not a result.
2. "starts after 1 job" stays on the card while "RENDERING ON YUE2" already shows (the queue count includes the running take).
3. A cancelled earlier message leaks into the next turn's reply ("...and a more hopeful chorus" after a cancelled request that asked for it): the history sent to the model includes a cancelled user turn.
4. The first chat render after a reload takes a moment in Vite dev (lazy chunk); API calls are under 10 ms.

## Cleanup
Stopped Ollama, yue-server (WSL), both node servers and Vite; ports 11434, 11436, 8004, 3201, 5283 free; no process left with the worktree path. VRAM 1.3 GB idle (the owner's ACE-Step :8001 / :3001 started meanwhile; my baseline was 0.8 GB). Scratch DATA_DIR copies deleted; logs remain in E:\ai\scratch\c0a-live.
