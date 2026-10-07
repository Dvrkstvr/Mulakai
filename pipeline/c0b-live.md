# C0b live verification (CB-6, the C0 live run), 2026-10-07

Code: origin/main 6c3b16a (C0b #181 merged), run from the main checkout without switching its branch. Labels: *seen running* unless stated.
Stack: nothing was running when I started (ports 3001, 5173, 8004, 11434 all closed), so I started my own, never the owner's ports: Ollama 0.32.15 (qwen3:14b, ctx 16384, models on E:), yue-server in WSL Ubuntu-24.04 :8004 from `E:\repos\Mulakai\yue-server` (main: has `/v1/splices`), Mulakai server :3701 (`tsx watch`, DATA_DIR = a copy of the owner's `server/data` made at the start, `E:\ai\tmp\c0b-live\data`, 4.5 GB; the owner's real library was not touched), Vite :5703 (`MULAKAI_API_URL`). Driven in the Browser pane at 1366x768 and the same HTTP API the UI uses (scripts in `pipeline/verify/C0b/`). Stopped afterwards: ports 3701, 5703, 8004, 11434 closed, VRAM back to 1.4 GB; the owner's ACE-Step :8001 was never running (the header says ACE-STEP OFFLINE, its health 502s in the console are that).

## Verdict per feature (I did not edit features.json)

| Feature | Verdict | Notes |
|---|---|---|
| F-046 edit card | PASS (1 spec question) | #1 #2 #3 and 3 of 4 edge items seen; Q on covers below |
| F-047 APPLY, render then splice | PASS (1 copy bug) | null test 0 differing samples on 4 of 4 songs, join excess max 0.42 dB; cancel leaves no version |
| F-048 version card, A/B, USE | PASS | deleted-previous edge seen; USE v1 and the Editor rail agree |
| F-049 commit half | PASS with 2 findings | restart reads EXPIRED not INTERRUPTED; "temporary render is deleted" is not true after a splice cancel |
| F-050 #2 by hand | PASS | thread, both versions and the Library survive reloads |
| F-050 #3 owner's listen | OWED | pack built (below); `passes` stays false |

## F-046

- #1 PASS. "Give the first chorus jazz chords" on Cariñito: edit card EDIT · SCORE "nothing runs yet", states "assuming the first chorus, bars 23-30", PLAN · 1 CHANGE · AGAINST BASE v1, the REHARMONIZE row with chords, checks line ("64 bars · est 162 s of 360 s · 1,172 of 4,096 tokens · chords valid · attempt 2 of 3", attempt 1's refusal in rust), a bar strip with bars 23-30 boxed ("BARS 23-30 CHANGE · THE OTHER 56 ARE v1"), APPLY.
- #2 PASS. Single REHARMONIZE: "re-sings bars 23-30, every other bar stays v1's audio · length may differ by under 0.25 s · saves v2, v1 is kept". REWRITE LYRICS ("rewrite the chorus lyrics about rain"): old/new lyric table and "ALL 64 BARS CHANGE · WHY THE WHOLE SONG: REWRITE LYRICS changes the whole take..."; consequence "the whole song is re-rendered: every bar will sound different, not only the listed ones". A 2/4 song (Romantica): card `splice:false, "the song is in 2/4; splicing is tested on 4/4 only"`, saved as a whole re-render ("the whole song was re-rendered, every bar sounds different from v1").
- #3 PASS. A follow-up while the card was pending: the old card reads "EDIT · SCORE · SUPERSEDED · REPLACED BY A NEWER PLAN · A newer edit card is below. This one cannot be applied."
- Edge, missing section PASS: "give the bridge jazz chords" -> a say "This song does not have a bridge section; it has an intro, verses, choruses, and an outro..." (no card).
- Edge, not eligible PASS for a non-YuE2 song (Ellies City 3): say "I cannot plan a change to this song: this song was not made by YuE2 or SCORE is not set up, so there is no score to read", no APPLY.
- Edge, failed plan PASS: Gertar, 3 attempts: "NO ANSWER IN 3 ATTEMPTS REHARMONIZE 15-22 keeps the old root in 3 of 8 bars; ... (bars 17-18 keep every root; ...)", no APPLY, nothing stored (a re-ask then worked).
- Not run: instrumental, chord-free, repaint/ACE-Step version of a YuE2 song; "over 360 s" and "no change" plans.
- SPEC QUESTION. A YuE2 cover (Barbie Metal, `gen_task cover`) gets a normal edit card (6 REHARMONIZE ops, "the plan makes 6 changes; only a single change can be spliced", i.e. whole-song). F-046's edge says a cover gets the eligibility reason and no APPLY; scope.md "C3" says a cover is SCORE-editable (F-065) and "asking the chat to edit it still points to SCORE until C0b (D-110, D-132)". So either C0b deliberately opened covers (then F-046's wording is stale) or the eligibility check lets them through. I did not APPLY it.

## F-047

- APPLY on Cariñito (REHARMONIZE 48-55): job phases RENDERING (YUE2, "generating song tokens step 1 of 3") -> SPLICING ("bars 48-55 into the old take, step 2 of 3") -> SAVING -> DONE · BARS 48-55 and a version card, v2 active. Edit wall times through the API: Acid 66 s, Funky 99 s, Gertar 142 s, Romantica (whole) 66 s, Cariñito about 130 s including a cancelled try.
- #1 PASS. v2's `params_json.splice` = `{"splice_v":1,"kind":"reharmonize","bars":[48,55],"joins_s":[118.65,138.868],"crossfade_s":[0.631579,0.631579],"gain_db":{"in":-0.091,"out":-0.074,"bars":[...]},"snap_ms":[-2.179,7.985],"length_diff_s":-0.002,"null_test":{"samples":6730898,"different":0}}`; the render temp is `yue-data/<render job>`, the splice reads it by `render_job` (log "chat edit ...: splice ... on 61855652 bytes of base audio").
- #2 PASS on the machine checks. `yue-server/splice_check.py` in WSL on the saved library file against its base, on 4 songs (`pipeline/verify/C0b/*.check.json`): null test different 0 of 6.7 M / 2.3 M / 9.2 M / 6.9 M samples on Cariñito, Acid Houzzzz, Gertar, Funky Jazz Groove; seam LUFS excess -0.21..+0.42 dB (limit 1). The "chord roots at least the temp re-render's minus 0.05" part is in the job's own verdict (all four came back `ok`, not `rerender`); I did not recompute it.
- #3 PASS. The next turn read v2 as its base ("AGAINST BASE v2", "THE OTHER 56 ARE v2"). The card says length: "0.01 s longer than v1" (Gertar). The version has its `.abc` sidecar and `.grid.json` in the audio dir.
- Edge, whole-song path PASS for 2/4 (above). Edge, bar 1 / last bar one join, no usable grid, truncated render: not run live (CB-4 covered the fallback on House in der Halle).
- Edge, cancel PASS: see F-049. BUT the copy "the temporary render is deleted" is not true after a splice cancel: the YuE render job's directory (14 MB flac, `~/yue-data/f60497b3...`) stays until yue-server's retention (24 h). Same for successful splices (`~/yue-data/<splice id>`, 60-80 MB each, plus the `splice-uploads` cache, 198 MB after 7 edits). A render cancelled while rendering did not leave its directory.

## F-048

- #1 PASS. Card: VERSION, v2 pill, SAVED · ACTIVE NOW, label "score edit · REHARMONIZE 48-55 · bars 48-55 spliced", "2:41 · bars 48-55 changed · the rest is v1's audio", PLAY, BACK TO v1. Player after save: lilac "NOW PLAYING THE NEW VERSION" which went away on play. Played, seeked to 2:02, BACK TO v1: time 2:07 -> 2:08 -> 2:10 still playing, button "◂ v1 · BACK TO v2" (aria-pressed true), the pill stayed v2 (active), both /audio files fetched, `active` flag unchanged in the API.
- #2 PASS. USE v1: API shows v1 active, song duration 161.08 restored, the chat sidebar reads "VERSIONS v1 ●", the Editor's VERSIONS · BASE list shows v1 CURRENT and v2 selectable. Position reset to 0:02 on USE (the A/B kept it); fine, not in the criteria.
- Edge PASS: v1 deleted via the version DELETE API (what the Editor calls) -> v2's card reads "the version before it was deleted in the Editor: no A/B" with PLAY only. Position clamp not exercised.
- Observation: after USE v1, the v2 card has no PLAY / USE v2 (PLAY and BACK TO are only drawn on the active newest card, `ChatVersionCard.tsx`), and the sidebar shows only the active version, so v2 can be brought back only from the Editor's version rail. The design allows it; the owner may expect a way back from the thread.

## F-049 (commit half)

- CANCEL while rendering PASS: card back to pending with "CANCELLED WHILE RENDERING · the temporary render is deleted · no v2 saved", APPLY back, versions still 1; yue log "job ... cancelled (parked in 6.7 s)", its dir gone. (The card line before the cancel settles said "starts after 2 jobs", a count that still included the dying job.)
- CANCEL while splicing PASS on the contract (`cancel_splice.mjs`): job RENDERING -> SPLICING at 15:13:07.704, `POST /api/chat/jobs/<id>/cancel` 200 `aborted`, job `failed|splicing` 0.26 s later, edit card `pending`, no version message, versions 2 -> 2, the yue splice job removed. Temp caveat: see F-047.
- CANCEL while queued PASS (turn): `queued` -> cancel 200 `cancelled` -> `failed "cancelled"`; thread: "CANCELLED No reply. Nothing changed. RETRY" and `/api/ps` empty. CANCEL while thinking: C0a evidence (not re-run).
- WAITING FOR v2 PASS: after APPLY the composer note reads "WAITING FOR v2 · a message sent now is read after v2 is saved"; a message sent then ("Repeat the first chorus once more") shows "THINKING · QUEUED · STARTS AFTER 1 JOB", ran after v2 saved, and its card says "AGAINST BASE v2" (it saw the new version).
- Reload mid-render PASS: reloaded during RENDERING; OPEN CHAT again shows the card still applying, then "SPLICING · bars 48-55 ... step 2 of 3", the queued message, then the version card; no loss.
- Stale proposal PASS: card proposed against v2, then USE v1; APPLY -> "EDIT · SCORE · STALE ... THIS SONG CHANGED SINCE THE PROPOSAL a repaint was queued in the Editor, or another version was chosen. Nothing started. ASK AGAIN"; `/api/generate/active` null; ASK AGAIN re-asked and gave a new card against v1. Finding: the stale card is relabelled "AGAINST BASE v1 / THE OTHER 56 ARE v1" though it was proposed against v2 (it showed v2 before). File guess: the card renders the song's current active version instead of the proposal's own base (`ChatEditCard.tsx` / `chatEditCopy.ts` plan header).
- Server restart mid-APPLY (killed the server during RENDERING, restarted): job unknown after restart, the card reads "EDIT · SCORE · EXPIRED ... THIS EDIT EXPIRED when the server restarted. Ask again for a new card. ASK AGAIN"; no version saved. F-049 #3 says a restart ends it as interrupted (for a turn C0a showed INTERRUPTED + RETRY); an APPLY shows EXPIRED with no "the render was cut" wording. Low; the user can recover. File guess: boot-time sweep in `chat/proposalStore.ts` / `editCommit.ts` treats an applying card as expired.
- Not run: unload not confirmed in 10 s, commits refused while `/api/ps` lists a model (C0a did not either), ASSISTANT OFF (C0a did).

## F-050 #2 (by hand)

Describe is C0a's. Edit leg in the real app: open chat on a library song -> edit request -> edit card -> APPLY -> phases -> v2 -> A/B -> USE -> reload (twice) -> thread, v1, v2 and the Library all there: after a reload the app opens on the Library, the CONTINUE row shows the song ("Cariñito v2 Score edit · REHARMONIZE 48-55 ... BASE"), OPEN CHAT restores the whole thread with the version card, the Editor lists both versions. Library row quirk: after USE v1 the CONTINUE row still shows "v2" (the latest version, not the active one); harmless, noted.

## F-050 #3: the owner's listen (OWED)

`E:\ai\tmp\c0b-live\listen\` (5 pairs, v1 and v2 of one chat edit each; page `index.html`, Range-capable server `serve.mjs`): `cd E:\ai\tmp\c0b-live\listen && node serve.mjs 8078` then http://localhost:8078/index.html (a server is left running on 8078 now). Template is SP-4's listen page: A/B in random order, same-position switch, bar timeline with the edited bars shaded, jump buttons, reveal shows the joins in red, answers box (join found, rest the same, chords changed). Bar lines are even (length / bar count), so approximate.

| Pair | Edit | Kind |
|---|---|---|
| Carinito | "make the last chorus a bit calmer" (REHARMONIZE 48-55, UI run) | spliced |
| Gertar | reharmonize first chorus, 15-22 | spliced |
| Acid Houzzzz | reharmonize first chorus, 18-33 | spliced |
| Funky Jazz Groove | reharmonize first chorus, 27-34 | spliced; its "v1" is the owner's WRITE PHRASE bass version that was active, not the first generation |
| Romantica | reharmonize first chorus, 23-30 | whole re-render (2/4), so "join not found" counts as trivially true; the other four are the real join test |

Pass line: join not found in 4 of 5, "the rest sounds the same" yes, "the chords changed" yes. Heads-up: Carinito's plan wrote 32 chords for 8 bars (the planner's check passed "chords valid"), so its "calmer" may sound odd; judge the join and the rest, not the taste.

## Bugs and findings (none blocks C0b)

1. COPY / low: "CANCELLED WHILE RENDERING/SPLICING · the temporary render is deleted" (`client/src/chatEditCopy.ts:81`). After a splice cancel the YuE render dir stays on yue-server for 24 h (14 MB seen); successful edits leave 30-80 MB each plus the upload cache. Expected: deleted, or the copy not claiming it. Steps: APPLY a REHARMONIZE, CANCEL once the phase reads SPLICING, `wsl ls ~/yue-data`.
2. LOW: server restart mid-APPLY reads EXPIRED, not INTERRUPTED (above).
3. LOW: stale card shows the active version as its base (above).
4. SPEC: cover handling vs F-046 edge (above); someone should decide.
5. UX note: v2's card loses PLAY / A/B after USE v1; a version number shifts when an earlier version is deleted (header "v1", card "v2" on Acid Houzzzz after deleting its v1).
6. Planner: an 8-bar REHARMONIZE with 32 chords passes the checks (Cariñito). Not C0b's code.

## Cleanup

Stopped everything I started (Ollama, WSL yue-server, both node servers, Vite, their npm parents); no process with the repo path left; 3701/5703/8004/11434 free. Left: the listen server on :8078 and the data copy `E:\ai\tmp\c0b-live\data` (about 4.5 GB; delete when the listen is done). `~/yue-data` in WSL holds about 600 MB of retained render and splice artifacts from this run (swept after 24 h when yue-server runs; delete by hand otherwise). Logs: `E:\ai\tmp\c0b-live\logs`. Evidence copied to `pipeline/verify/C0b/` (pair logs, splice_check results, the driver scripts). Nothing committed.
