# CP-C1, analysis and marks on the real machine (2026-10-08 local, re-run after #210)

## Findings (re-run after #210, D-194..D-196)

Code: origin/main ea4a3d8 + the script tweaks on `test/chat-cp1-marks`. Stack as on 2026-10-07 (its notes.md): server
:3221 on a fresh `DATA_DIR` copy under `E:\ai\tmp` (no analysis stored for any song in the set, so every OPEN analysed v1
with the new code), own Ollama :11535 (ctx 16384) behind the recording proxy :11536, yue-server :8224 in WSL with
SheetSage2, lyrics-server :8235. The owner's :3001 / :8001 / :8005 / :11434 untouched; everything I started stopped,
temp data deleted. Run 1: 11 marks + 1 transcribed turn; run 2 (`--merge`): 3 more marks. Everything *seen running*.

1. **Mark stop line: PASS, 0 of 12** marked turns that ran planned an op outside the mark (6 edit cards, 3 failed plans,
   3 "say" on the ACE-Step song eventide: "not made by YuE2"). 2 more marks were refused at SEND (400, eventide run 1, item 3) and are not counted.
2. **Seconds-only marks are bounded now (D-194/D-195): 5 sent, 0 outside.** Cariñito 1:59-2:18 snapped to bars 48-55 ->
   REHARMONIZE 48-55 (was 25-30 on 10-07). Gertar 1:59-2:24 -> bars 44-52; the plan failed the planner's own root rule
   (no card, nothing outside; was REHARMONIZE 15-22). Acid Houzzzz -> 18-33 -> REHARMONIZE 18-33. Gertar 27-35 ->
   REHARMONIZE 27-35. eventide's (its last bar, 41) -> "say".
3. **Bar times come back ordered (D-196); both strips are live.** Acid Houzzzz: 39 starts, strictly increasing, strip
   `current` (hatched on v1-v3 on 10-07); both its marks ran and stayed inside. eventide: 41 starts, ordered, strip
   `current` (was "unreadable reply"). New: eventide's transcribed score has **80 bars, the audio 41**, and the strip
   still lists the sections past the audio (verse 41-56, interlude 57-72, outro 73-80, `seconds: null`). A mark the
   script built on verse 41-56 was refused at SEND (400 "the mark reaches bar 56; the song has 41 bars"); the cross
   mark built next to it had no seconds (400; a script bug, fixed: marks are built only from sections the bar times
   hold). Whether the strip should drop or grey sections past the audio is open (*inferred*: the client cannot mark them).
4. **Per-section line counts are no longer 0.** YuE2 Cariñito: intro 0, verse 5, chorus 8, verse 2 13, chorus 2 8,
   outro 0. Transcribed Ellies City 2: 1+1, 5+2, 5+2, 5+1, 6, 2 (lines + lines crossing an edge). Acid Houzzzz 0 in
   every section with a reading total of 0 (no words read). eventide 5, in the intro only.
5. **Prompt p95: 5906 over all marked turns (PASS, stop over 6000), max 6180.** The max is the 3rd attempt of a failed
   Cariñito REHARMONIZE (verse 6-22, 17 bars); run 1 alone had p95 6180 over its turns. Thin margin: retries of long
   REHARMONIZE marks reach 5.7-6.2k.
6. Not re-checked (not this task): APPLY behind an analysis (NO DATA, no APPLY pressed). Q-070's planner answer on a
   transcribed song: Ellies City 2 still answered with an invented section list, as on 10-07.

Server http://127.0.0.1:3221. Planner via the proxy to http://127.0.0.1:11535 (own Ollama, ctx 16384). GPU at start 2603 MiB. Re-run after #210 (D-194..D-196): marks only, no APPLY. Run 2 (--merge): eventide marks inside the 41 bars its audio holds, one more seconds-only mark on Gertar.

## Stop lines

- NO DATA commits refused because of an analysis: 0 of 0 APPLYs behind an analysis (stop on any)
- PASS slowest analysis of a version of 4 min or less: 71.5 s (stop over 90 s)
- PASS planner not fully on the GPU after an analysis in 0 of 1 seen; next turn p50 5.4 s running (5.4 s from SEND) (stop on any, or over 15 s)
- PASS marked turns with an op outside the mark: 0 of 12 (6 edit cards; 2 mark refused at SEND) (stop over 1)
- PASS prompt tokens p95: 5906 on marked turns, 5906 on all, max 6180 (stop over 6000)

## Analyses

| song | source | trigger | v | audio s | status | waited s | run s | WORDS s | SCORE s | SECTIONS s | plan | not read | VRAM peak / end MiB | sections |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Cariñito | yue2 | open | 1 | 161 | done | 0.0 | 40.7 | 20.1 | - | 20.5 | service/own/track |  | 6699 / 2588 | intro 1-5 @0s 0L, verse 6-22 @13s 5L, chorus 23-30 @56s 8L, verse 2 31-47 @76s 13L, chorus 2 48-55 @119s 8L, outro 56-64 @139s 0L |
| Gertar | yue2 | open | 1 | 215 | done | 0.0 | 35.1 | 12.4 | 0.1 | 22.5 | service/own/track |  | 6749 / 2608 | intro 1-5 @0s 0L, verse 6-14 @12s 7L, chorus 15-22 @37s 4L, interlude 23-26 @60s 0L, verse 2 27-35 @71s 8L, chorus 2 36-43 @96s 4L, bridge 44-52 @119s 4L, chorus 3 53-60 @144s 0L, interlude 2 61-68 @167s 0L, outro 69-77 @190s 5L |
| Acid Houzzzz | yue2 | open | 1 | 79 | done | 0.0 | 32.2 | 19.9 | - | 12.2 | service/own/track |  | 7718 / 2598 | intro 1-17 @6s 0L, chorus 18-33 @38s 0L, interlude 34-43 0L |
| eventide | acestep | open | 1 | 147 | done | 0.0 | 71.5 | 55.0 | 16.4 | - | service/service/score |  | 7725 / 2604 | intro 1-32 @0s 5L, interlude 33-40 @116s 0L, verse 41-56 0L, interlude 2 57-72 0L, outro 73-80 0L |
| Ellies City 2 | transcribed | open | 1 | 140 | done | 0.0 | 22.0 | 7.6 | 14.2 | - | service/service/score |  | 6708 / 2604 | intro 1-4 @0s 1L+1p, verse 5-12 @13s 5L+2p, chorus 13-18 @38s 5L+2p, verse 2 19-26 @58s 5L+1p, chorus 2 27-34 @83s 6L, outro 35-44 @109s 2L |

## Turns

| song | turn | role | after analysis | mark (bars) | reply | wait s | run s | from SEND s | prompt tok | planner | VRAM before | ops | outside | note |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ecf8eb5a | x-ecf8-secs@3/0 | marked |  | seconds [48,55] | edit | 0.1 | 25.0 | 25.1 | 4504 | 10.9 of 10.9 GiB on the GPU | 2588 | REHARMONIZE 48-55 |  |  |
| ecf8eb5a | x-ecf8-one@0/0 | marked |  | bars [6,22] | failed | 0.0 | 40.6 | 40.6 | 4613 5309 6180 | 10.9 of 10.9 GiB on the GPU | 2697 |  |  | REHARMONIZE 6-17 keeps the old root in 7 of 12 bars; change the root in at least one chord per 2 bars (bars 8-9, 14-15, 16-17 keep every roo |
| ecf8eb5a | x-ecf8-cross@1/0 | marked |  | bars [29,34] | edit | 0.0 | 8.5 | 8.5 | 4583 | 10.9 of 10.9 GiB on the GPU | 2610 | REHARMONIZE 29-30 |  |  |
| a69541f2 | x-a695-secs@4/1 | marked |  | seconds [44,52] | failed | 0.0 | 24.8 | 24.8 | 4823 5296 5770 | 10.9 of 10.9 GiB on the GPU | 2608 |  |  | REHARMONIZE 44-52 keeps the old root in 4 of 9 bars; change the root in at least one chord per 2 bars (bars 44-45, 46-47 keep every root; a  |
| a69541f2 | x-a695-one@1/1 | marked |  | bars [15,22] | failed | 0.0 | 23.0 | 23.0 | 4814 5275 5733 | 10.9 of 10.9 GiB on the GPU | 2635 |  |  | REHARMONIZE 15-22 keeps the old root in 3 of 8 bars; change the root in at least one chord per 2 bars (bars 15-16 keep every root; a 7th or  |
| a69541f2 | x-a695-cross@3/1 | marked |  | bars [42,47] | edit | 0.0 | 27.6 | 27.6 | 4862 5384 5906 | 10.9 of 10.9 GiB on the GPU | 2591 | REHARMONIZE 42-47, EDIT_STYLE |  | EDIT STYLE changes the whole song, not only the marked bars |
| 95c93e3d | x-95c9-one@0/4 | marked |  | bars [18,33] | edit | 0.0 | 20.2 | 20.2 | 4043 | 10.9 of 10.9 GiB on the GPU | 2598 | REHARMONIZE 18-33 |  |  |
| 95c93e3d | x-95c9-secs@0/0 | marked |  | seconds [18,33] | edit | 0.0 | 20.5 | 20.5 | 4075 | 10.9 of 10.9 GiB on the GPU | 2598 | REHARMONIZE 18-33 |  |  |
| 5d40797e | x-5d40-one@0/1 | marked |  | bars [41,56] | refused 400 | - | - | - |  | - | - |  |  | {"error":"the mark reaches bar 56; the song has 41 bars"} |
| 5d40797e | x-5d40-secs@1/1 | marked |  | seconds [41,41] | say | 0.0 | 7.1 | 7.1 | 2987 | 10.9 of 10.9 GiB on the GPU | 2604 |  |  | I cannot plan a change to this song: this song was not made by YuE2 or SCORE is not set up, so there is no score to read |
| 5d40797e | x-5d40-cross@0/2 | marked |  | bars [55,60] | refused 400 | - | - | - |  | - | - |  |  | {"error":"mark must be {kind: \"range\", versionId, bars?: [from, to], seconds: [start, end]}"} |
| 68f65c90 | tr0-T1 | after-analysis | yes |  | say | 0.0 | 5.4 | 5.4 | 2878 | 10.9 of 10.9 GiB on the GPU | 2604 |  |  | The song 'Ellies City 2' has the following sections: Intro, Verse, Pre-Chorus, Chorus, Bridge, and Outro. The Intro starts at bar 1, the Ver |
| 5d40797e | x-5d40-one@0/1 | marked |  | bars [1,32] | say | 0.0 | 34.1 | 34.1 | 3390 | 10.9 of 10.9 GiB on the GPU | 2603 |  |  | I cannot plan a change to this song: this song was not made by YuE2 or SCORE is not set up, so there is no score to read |
| 5d40797e | x-5d40-cross@0/2 | marked |  | bars [31,36] | say | 0.0 | 5.5 | 5.5 | 3209 | 10.9 of 10.9 GiB on the GPU | 2603 |  |  | The chat cannot do that yet: open the song in the Editor and use REPAINT there. |
| a69541f2 | x-a695-secs@2/0 | marked |  | seconds [27,35] | edit | 0.0 | 22.1 | 22.1 | 4885 5327 5762 | 10.9 of 10.9 GiB on the GPU | 2603 | REHARMONIZE 27-35 |  |  |

## APPLY

| song | apply | behind an analysis | POST | reason | wait s (press to running) | started after the analysis ended s | outcome | edit s |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
