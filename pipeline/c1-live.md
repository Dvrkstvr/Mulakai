# C1 live verification (CL-9), 2026-10-08

Code: origin/main 86392e4 (#212 strip past audio, #214 instruments line, #216 docs merged) plus a local merge of `fix/chat-c1-review` (#215). **#215 was CLOSED, not merged**, so its three commits (repaint `basedOn`, mark across SET TEMPO, cancelAnalysis removal) are not on main; I ran them from a local merge, so the SET TEMPO stale card below tests code that main does not have yet. Labels: *seen running* unless stated.
Stack (all mine, stopped after; owner's :3001 :5173 :8001 :8005 :11434 untouched, still listening): server :3321 (DATA_DIR copy under `E:\ai\tmp\c1-live`, DB via SQLite backup), Vite :5323, Ollama :11535 (qwen3:14b, ctx 16384), yue-server :8224 in WSL with SheetSage2, lyrics-server :8235. ACE-Step not started (eventide is an existing ACE-Step song; its reading needs no ACE-Step). Driven in the Browser pane at 1366x768 (the pane re-sized itself several times; I re-applied it) and by reading the DOM. Screenshots: `pipeline/verify/C1/`. Temp data and WSL `yue-data-c1live` deleted.
Checks (playbook): client 1239 tests pass, lint 0 errors (1 warning), tsc ok; server tsc ok, 1511 tests pass; yue-server pytest 532 pass; e2e not re-run locally, CI E2E + Checks green on main 86392e4.

## Verdict

| Feature | Verdict | Why |
|---|---|---|
| F-051 e2e | PASS (CI only) | chat.spec.ts covers assistant off, cancel while thinking, CREATE, mark, edit+APPLY, stale; green on main |
| F-052 analysis | FAIL (B1) | everything passes except a failed/partial reading has no reason and no RETRY |
| F-053 player strip | FAIL (B4 low, dim not seen) | strip, line, BARS NOT SHOWN, transcribed, hatched pass |
| F-054 marking | PASS | Alt and the pointer tag not exercised |
| F-055 mark as data | FAIL (B2) | "make this jazzier" is not bounded to the mark |

## F-052
- #1 PASS. Cariñito v1 line: `READING v1 · SECTIONS · 3 OF 3 · tracking the beat` -> `READ v1 · 6 SECTIONS · 44 LINES` (01). eventide/Ellies: `WORDS · 1 OF 3 · lyrics-server`, `SCORE · 2 OF 3 · transcribing`. Two songs opened back to back: `READING v1 · QUEUED · STARTS AFTER 1 JOB`. After each splice (Cariñito v2-v4, Gertar v2-v6) a reading started by itself. Reload mid-reading (eventide): server job kept running, OPEN CHAT again showed `READING v1 · WORDS · 1 OF 3`.
- #2 PASS. YuE2 songs read their own score; eventide and Ellies City 2 read `TRANSCRIBED SCORE · CONTEXT AND MARKING ONLY` (08, 09). A splice's reading landed in under 1 s on Gertar v5 (grid cached; `/v1/scores/bars` called, no tracker run).
- #3 PASS. Gertar: Acid Houzzzz's reading was running (`WORDS`), APPLY on Gertar's card showed `APPLY · QUEUED · STARTS AFTER 1 JOB` with CANCEL, never refused, rendering began when Acid's reading ended (10). A turn sent during a reading: `THINKING · QUEUED · STARTS AFTER 1 JOB`, composer `READING v1 · a message sent now starts after it` (Q-069 ok). **Weak spot:** my first try (Cariñito, eventide reading) I did not capture the queued line; Gertar is the evidence.
- #4 PARTIAL. LYRICS_API_URL unset (server restarted): `READ v1 · 6 SECTIONS · 44 LINES · NO WORD TIMINGS`, strip live, no failure ok. Q-070: Ellies City 2 section names intro/verse/chorus/verse 2/chorus 2/outro (real names). Per-section lines on a transcribed song are no longer 0: 1+1, 5+2, 5+2, 5+1, 6+0, 2+0 (lines + crossing). Marking by time works with a dead reading (below). **FAIL: B1.**

## F-053
- Reading line `READ v4 · 12 SECTIONS · 48 LINES`; strip has every score section incl. a third chorus (Gertar: 12 sections). PASS.
- eventide (ACE-Step, 80-bar score, 41 bars of audio): `READ v1 · 3 SECTIONS · 9 LINES · SCORE LONGER THAN THE AUDIO · 39 BARS NOT SHOWN` + second row `TRANSCRIBED SCORE · CONTEXT AND MARKING ONLY` (08). PASS (D-197 seen live).
- Hatched while reading after a bar-moving edit: Gertar v2 (SET TEMPO re-render) and v3/v4 (REPEAT) read `chat-strip hatched` with a seconds ruler, going `live` when read (11). A no-bar-move splice (Cariñito v2): mark carried, strip not hatched. The `dim` state (v-1 reading dimmed, clickable) was **not observed**: splice readings land in under 1 s so there is no window; code path only.
- Thread height at 1366x768: 454 px with no mark, 400 px with chip, chip + WHAT IT SEES, stale card, hatched strip (measured via `getBoundingClientRect`, 400 is the floor) PASS (>= 400).
- Note B4: reading total (44) is the sum of all lyric blocks, the strip pairs the k-th section with the k-th block of its kind: Cariñito strip sums 34 vs 44 in the line; Ellies City 2: 24 + partial vs 21.

## F-054
- Click CHORUS 1: chip `THIS: CHORUS 1 · BARS 23–30 · 0:56–1:16` (02). Right grip +2 bars: `THIS: CHORUS 1 + 2 BARS · BARS 23–32 · 0:56–1:21`. Body drag +3 bars (Gertar chorus 15-22 -> 18-25, length kept, snapped). Drag on empty waveform: `THIS: VERSE 2 – CHORUS 2 · BARS 45–50 · 1:51–2:06` (two sections, 06). Esc clears the mark and the chip. Drag past the end: clamped `BARS 60–64 · 2:29–2:41`.
- Echo re-marks on click while valid (Cariñito). Echo of a stale mark: `v4 MOVED THESE BARS · text only`.
- Hatched strip: time drag gave `THIS: 0:55–1:22 · BARS WHEN THE READING LANDS`; when the reading landed the chip became `2 BARS + VERSE 2 · BARS 25–35 · 0:56–1:22` (snap on landing). With bar times never read: `THIS: 1:05–1:33 · NO BARS READ`, composer `plans on this time only`.
- Not exercised: Alt to free snapping, the pointer tag text during a drag.

## F-055
- Marked turn: Cariñito chorus 1 "give this part jazz chords" -> card `PLANNED ON THE MARK · BARS 23–30`, REHARMONIZE 23-30 only, `BARS 23-30 CHANGE · THE OTHER 56 ARE v1`, consequence line `re-sings bars 23-30, instruments there may change, every other bar stays v1's audio` (D-198 line ok on every card seen). WHAT IT SEES: VERSION, BARS, TIME, SECTIONS, LYRICS, KEY Dm, TEMPO 95, METER 4/4; AS SENT shows the JSON (03). Cross-section mark -> REHARMONIZE 45-50 (06). APPLY -> v2/v3, mark carried (no bars moved).
- Seconds-only: Gertar mark by time sent while the reading ran; the turn waited, snapped, card `PLANNED ON THE MARK · BARS 30–36` (12). No bar times (yue-server down, Polski Polka): mark `NO BARS READ`; chat answered in words ("has not been read yet ... mark the section again"), no card (13).
- SET TEMPO (Cariñito 95 -> 110, local merge of #215): mark on chorus 2 made on v3, APPLY -> v4: chip rust `CHORUS 2 · STALE`, card `STALE MARK · you marked bars 48–55 of v3. v4 changed the tempo, so the old times are other music; the bars are the same; use them once its bars are read`, SEND held (07). USE BARS disabled while v4 was read (logged `disabled=true`), enabled when read; pressing it gave `BARS 48–55 · 1:43–2:00` (re-timed). Same stale card on Gertar after a REPEAT (v5 -> v6).
- Edge: no mark -> whole song, no chip, no "PLANNED ON THE MARK" (Gertar). ACE-Step song eventide with a mark: say "I cannot plan a change to this song: this song was not made by YuE2..." no card.
- **FAIL: B2** (below). Clamp reason on the card exists: `EDIT STYLE changes the whole song, not only the marked bars`.

## Bugs
- **B1 (medium) a partial reading is permanent and silent.** Steps: stop yue-server (and/or lyrics-server), OPEN CHAT on a song with no stored reading (Polski Polka, Unmoving), restart the services, reopen. Expected: F-052 #1 "failed with the reason and RETRY" (or the line says what was not read). Actual: analysis state `done`, `notRead.bars = "YUE2 transcribe -> fetch failed"`, line `READ v1 · 0 SECTIONS · 39 LINES` (words down: `NO WORD TIMINGS`, same copy as "unset"), strip hatched for good; `POST /api/chat/songs/:id/analysis/retry` -> 409 "v2 is already read". The chat answer reads "has not been read yet". Guess: `server/src/services/chat/analysisJob.ts` treats step errors as notRead and stores done; `ChatReadingLine` ignores `notRead`.
- **B2 (medium) "make this jazzier" on a chorus mark plans `EDIT STYLE` (whole song) + REHARMONIZE 23-30**, so the card is `ALL 64 BARS CHANGE` (04); the reason is on the card but the edit is not bounded to the mark (CP-C1 saw the same once and counted 0 outside). Expected: a style op is dropped or refused under a mark. Guess: planner/`planReferent.ts` mark rules allow EDIT_STYLE.
- B3 (low) card header `assuming the first chorus, bars 15-22` stays when the mark is bars 30-36 / 25-35 (Gertar, Cariñito); contradicts `PLANNED ON THE MARK`.
- B4 (low) reading line lines vs strip sections differ (above); chip `1:08–1:24`, card `1:08–1:25`; chip `0:56–1:16`, WHAT IT SEES `0:55–1:15` (floor vs round).
- B5 (low) stale copy `v6 moved them, so they are now bars 15–22` when old and new numbers are equal (a REPEAT of the marked bars; also Gertar v3). Misleading.
- B6 (low, known) a server restart turns pending cards into `EXPIRED` (seen again, as C0b).
- Open: #215 closed unmerged; main lacks its fixes.

## Cleanup
Stopped Vite, server, lyrics-server, yue-server, Ollama :11535 (by PID/port), no process of mine left; owner's six ports unchanged; deleted `E:\ai\tmp\c1-live` and WSL `~/yue-data-c1live`. Old `E:\ai\tmp\c0b-live` (4.5 GB, not mine) left alone.

## Re-check 2026-10-08

Code: origin/main bade396 (#219 B1/B2/B3/B5/B6 and #220 B4 merged) plus a local merge of `origin/docs/c1-live` (#217 was still open, CI golden-path failing, after ~35 min of polling; only this report was missing). Labels: *seen running*. Stack (mine, scratch ports): server :3421 (DATA_DIR copy `E:\ai\tmp\c1live2`, DB by SQLite backup; ACESTEP_API_URL pointed at a dead port after the first hour, the first run used the default :8001 but never called it), Vite :5423, Ollama :11635 (qwen3:14b, ctx 16384) behind a recording proxy :11636, yue-server :8324 in WSL with SheetSage2, lyrics-server :8335. Owner's :3001 :5173 :8001 :8005 :11434 untouched. Browser pane at 1366x768 (re-applied after each pane resize). Screenshots: `pipeline/verify/C1/recheck/`. The GPU was shared with the owner's models (11.7 GB in use before I started; 97 % busy), so planner calls ran 5-45 s, one 288 s.

| Item | Verdict | Seen |
|---|---|---|
| B1 failure reason + RETRY | PASS | Polski Polka, both services stopped: `COULDN'T READ v1 · WORDS · lyrics-server transcribe -> fetch failed` + RETRY (01); API state `failed`, notRead words and bars. Services restarted: RETRY `POST .../analysis/retry` 202, reading went running -> done in ~150 s: `READ v1 · 9 SECTIONS · 34 LINES · 14 LINES OUTSIDE THE SECTIONS`, notRead all null (02) |
| B1 unset service | PASS | server restarted without LYRICS_API_URL, Purple Shinings: `READ v1 · 4 SECTIONS · 21 LINES · 14 LINES OUTSIDE THE SECTIONS · NO WORD TIMINGS`, strip live, state done (10) |
| B2 "make this jazzier" on chorus 1 | PASS | 1st try NO ANSWER in 3 attempts (planner kept writing phrases where the vocal sings; no card) (05); 2nd try failed on the planner-unload guard (GPU shared); 3rd: `PLANNED ON THE MARK · BARS 23-30`, REHARMONIZE 23-30 only, `BARS 23-30 CHANGE · THE OTHER 56 ARE v1`, no EDIT STYLE (06) |
| B2 / D-201 "make the whole song faster" | PASS | SET TEMPO 95 -> 120 allowed on the mark: header `SET TEMPO changes the whole song, not only the marked bars`, `ALL 64 BARS CHANGE` (07) |
| B2 / D-201 "make it faster" | bounded | REHARMONIZE 23-30 only (the planner's own words said "increase the tempo of the whole song", the card does not: a copy mismatch, N2) |
| B3 | PASS | verse 2 marked (bars 31-47) + "make the chorus jazzier": card on bar 47 only, header `PLANNED ON THE MARK`, assumption line `a request`, no "assuming the first chorus" |
| B4 line = strip | PASS | Carinito: line `34 LINES · 10 LINES OUTSIDE THE SECTIONS` = strip sections 0+5+8+13+8+0 = 34 (was 44) (04); Ellies City 2 (transcribed): 21 = strip 1+5+5+5+6+2 = 24 minus 3 crossing lines counted once, no outside row (03); Polski Polka 34 + 14 |
| B4 dim | PASS | Carinito v2 -> APPLY REHARMONIZE with two other readings queued behind the render: v3 reading `QUEUED · STARTS AFTER 2 JOBS`, strip class `dim` (v2's reading), chip kept `THIS: CHORUS 1 · BARS 23-30`, strip click re-marked Verse 2 (09). After the REPEAT (v2) the strip went `hatched`, not dim, as specified for bar-moving edits (08) |
| B6 copy | PASS | unmarked "repeat the outro once" APPLY after marking chorus 1 (bars 23-30): `STALE MARK · you marked bars 23-30. v2 moved other bars; these are still bars 23-30.` (08) |
| Prompt p95 | FAIL on the line | 13 marked attempts: p95 9144, max 9144; the one 3-attempt failed turn made 4518, 6831, 9144 (each retry adds ~2.3k of refusals). The other 10 marked attempts: 4532-5467 (p95 5467). First attempts of 6 turns: 4518-4983. |

New findings
- N1 (medium, one sighting) the REPEAT of the outro (S6, bars 56-64, plan `73 bars`, card text "Repeats bars 56-64 in v1's audio") saved v2 as `whole song re-rendered: the join could not be aligned` (3:03, `Every bar sounds different from v1`), not the in-place splice the card promised. Steps: Cariñito v1, no mark, "repeat the outro once", APPLY. Not investigated; may be the repeat-at-end case. Cause (2026-10-08, synthetic repro): with no downbeat after the last bar the grid gives the audio's end, so the seam sat after the ring-out (3 s tail: `level_step` +10 dB; 6 s: `not_aligned`, corr 0.08). Fixed in yue-server `section_end`: the last section ends at its last downbeat plus one tracked bar, and the ring-out plays once at the end. Live re-check owed.
- N2 (low) "make it faster" with a mark: the chat sentence says it will change the whole song's tempo while the card is a REHARMONIZE on the marked bars.
- N3 (low, environment) the planner unload guard `qwen3:14b is still loaded after 10 s` failed one turn while another process shared the GPU (turn failed, RETRY worked).
- N4 (medium) retries carry the refused ops back into the prompt: a failed marked turn reaches 9144 tokens at attempt 3, over the 6000 stop line (CP-C1 saw a max of 6180). Not a regression of #219/#220 as far as I can tell (the first attempt is 4.5k) but it breaks the 6000 line the moment a turn fails twice.

Not re-checked: B5 (rounding) beyond the chip/`WHAT IT SEES` reading, Alt and pointer tag. Cleanup: all services stopped, `E:\ai\tmp\c1live2` and WSL `~/yue-data-c1live2` deleted.
