# CP-C1, analysis and marks on the real machine (2026-10-08)

## Findings (re-measure of the prompt stop line after #225, compact retries)

Code: origin/main 1caa2a1 (#225 merged) + one script text ("make this jazzier") on `test/chat-cp1-p95`. Stack as on
2026-10-08 (`../2026-10-08/summary.md`): server :3221 on a fresh `DATA_DIR` copy under `E:\ai\tmp\cp-c1-p95`,
`ACESTEP_API_URL` dead (:8299), own Ollama :11535 (qwen3:14b, ctx 16384) behind the recording proxy :11536, yue-server
:8224 in WSL, lyrics-server :8235. The owner's :3001 / :5173 / :8001 / :8005 / :11434 and SP-7's Ollama :11545 untouched
(waited until SP-7's `/api/ps` was empty). Everything I started is stopped; temp data deleted. One run, `--merge --marks`,
14 marked turns on three YuE2 songs (CariÃ±ito, Gertar, Acid Houzzzz). Everything *seen running*.

1. **Prompt p95: 5339 over all 30 planner attempts of 14 marked turns (PASS, stop over 6000); max 5527** (was p95 5906,
   max 6180). The max is attempt 3 of Gertar "make this jazzier" on chorus 15-22 (4795 / 5301 / 5527, an edit card).
2. **Attempt 3 was reached in 7 of 14 turns** (attempt 1: 14, attempt 2: 9, attempt 3: 7); highest per attempt
   4901 / 5301 / 5527. A retry now adds 112-506 tokens (median about 200); before #225 it added 435-871. Same mark as
   10-08's max: CariÃ±ito verse 6-22 "give this part jazz chords" now 4583 / 4695 / 4970 (was 4613 / 5309 / 6180), and it
   ended in an edit card (REHARMONIZE 6-17, 18-22) where 10-08's failed.
3. **Mark stop line: PASS, 0 of 14 outside** (10 edit cards, 4 failed plans with no card). Long REHARMONIZE marks held:
   verse 2 31-47 -> REHARMONIZE 31-46; the seconds-only mark on it -> 31-46 + 47-47; Acid Houzzzz chorus 18-33 -> 18-33.
   "make this jazzier" on four choruses: 3 cards inside (23-30, 48-55, 15-22), 1 failed (Acid Houzzzz, WRITE_PHRASE with 0 notes).
4. Failed plans (no card, nothing outside): 3 Gertar jazz-chord turns (verse 6-14, bridge 44-52, cross 42-47) all
   planned a WRITE_PHRASE on bars the Vocal sings and were refused 3 times ("the Vocal sings in bars 6-9; free: ...").
   The planner kept adding a melody op to a chords request; *inferred* a prompt-side cause, not a size one.

Server http://127.0.0.1:3221. Planner via the proxy to http://127.0.0.1:11535 (own Ollama, ctx 16384). GPU at start 2162 MiB. Re-measure after #225 (compact retries): marks only, no APPLY; long REHARMONIZE marks and 'make this jazzier' on choruses.

## Stop lines

- NO DATA commits refused because of an analysis: 0 of 0 APPLYs behind an analysis (stop on any)
- PASS slowest analysis of a version of 4 min or less: 34.8 s (stop over 90 s)
- NO DATA planner not fully on the GPU after an analysis in 0 of 0 seen; next turn p50 - running (- from SEND) (stop on any, or over 15 s)
- PASS marked turns with an op outside the mark: 0 of 14 (10 edit cards) (stop over 1)
- PASS prompt tokens p95: 5339 on marked turns, 5339 on all, max 5527 (stop over 6000)

## Analyses

| song | source | trigger | v | audio s | status | waited s | run s | WORDS s | SCORE s | SECTIONS s | plan | not read | VRAM peak / end MiB | sections |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Cariñito | yue2 | open | 1 | 161 | done | 0.0 | 34.1 | 15.6 | - | 18.4 | service/own/track |  | 6471 / 2472 | intro 1-5 @0s 0L, verse 6-22 @13s 5L, chorus 23-30 @56s 8L, verse 2 31-47 @76s 13L, chorus 2 48-55 @119s 8L, outro 56-64 @139s 0L |
| Gertar | yue2 | open | 1 | 215 | done | 0.0 | 31.6 | 11.0 | - | 20.5 | service/own/track |  | 6519 / 2434 | intro 1-5 @0s 0L, verse 6-14 @12s 7L, chorus 15-22 @37s 4L, interlude 23-26 @60s 0L, verse 2 27-35 @71s 8L, chorus 2 36-43 @96s 4L, bridge 44-52 @119s 4L, chorus 3 53-60 @144s 0L, interlude 2 61-68 @167s 0L, outro 69-77 @190s 5L |
| Acid Houzzzz | yue2 | open | 1 | 79 | done | 0.0 | 34.8 | 18.4 | - | 16.3 | service/own/track |  | 7618 / 2490 | intro 1-17 @6s 0L, chorus 18-33 @38s 0L, interlude 34-39 @68s 0L |

## Turns

| song | turn | role | after analysis | mark (bars) | reply | wait s | run s | from SEND s | prompt tok | planner | VRAM before | ops | outside | note |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ecf8eb5a | x-ecf8-one@0/0 | marked |  | bars [6,22] | edit | 0.1 | 61.6 | 61.7 | 4583 4695 4970 | 10.9 of 10.9 GiB on the GPU | 2481 | REHARMONIZE 6-17, REHARMONIZE 18-22 |  |  |
| ecf8eb5a | x-ecf8-one@1/5 | marked |  | bars [23,30] | edit | 0.0 | 13.3 | 13.3 | 4564 | 10.9 of 10.9 GiB on the GPU | 2393 | REHARMONIZE 23-30 |  |  |
| ecf8eb5a | x-ecf8-one@2/1 | marked |  | bars [31,47] | edit | 0.0 | 53.5 | 53.5 | 4645 4758 | 10.9 of 10.9 GiB on the GPU | 2387 | REHARMONIZE 31-46 |  |  |
| ecf8eb5a | x-ecf8-one@3/5 | marked |  | bars [48,55] | edit | 0.0 | 24.9 | 24.9 | 4615 | 10.9 of 10.9 GiB on the GPU | 2621 | REHARMONIZE 48-55 |  |  |
| ecf8eb5a | x-ecf8-cross@0/0 | marked |  | bars [21,26] | edit | 0.0 | 13.3 | 13.3 | 4680 | 10.9 of 10.9 GiB on the GPU | 2454 | REHARMONIZE 23-26 |  |  |
| ecf8eb5a | x-ecf8-secs@2/0 | marked |  | seconds [31,47] | edit | 0.0 | 43.4 | 43.4 | 4708 4821 5106 | 10.9 of 10.9 GiB on the GPU | 2511 | REHARMONIZE 31-46, REHARMONIZE 47-47 |  |  |
| a69541f2 | x-a695-one@1/5 | marked |  | bars [15,22] | edit | 0.0 | 59.2 | 59.2 | 4795 5301 5527 | 10.9 of 10.9 GiB on the GPU | 2434 | REHARMONIZE 15-22 |  |  |
| a69541f2 | x-a695-one@0/0 | marked |  | bars [6,14] | failed | 0.0 | 45.2 | 45.2 | 4804 4956 5086 | 10.9 of 10.9 GiB on the GPU | 2446 |  |  | op 1 (WRITE_PHRASE): the Vocal sings in bars 6-9; free: 1-5, 23-26, 61-67, 73-77 |
| a69541f2 | x-a695-one@4/0 | marked |  | bars [44,52] | failed | 0.0 | 34.4 | 34.4 | 4879 5123 5339 | 10.9 of 10.9 GiB on the GPU | 2425 |  |  | op 2 (WRITE_PHRASE): the Vocal sings in bars 44-47; free: 1-5, 23-26, 61-67, 73-77 |
| a69541f2 | x-a695-cross@3/0 | marked |  | bars [42,47] | failed | 0.0 | 57.4 | 57.4 | 4901 5057 5213 | 10.9 of 10.9 GiB on the GPU | 2469 |  |  | op 2 (WRITE_PHRASE): the Vocal sings in bars 42-45; free: 1-5, 23-26, 61-67, 73-77 |
| a69541f2 | x-a695-secs@2/1 | marked |  | seconds [27,35] | edit | 0.0 | 20.8 | 20.8 | 4898 5073 | 10.9 of 10.9 GiB on the GPU | 2428 | REHARMONIZE 27-35 |  |  |
| 95c93e3d | x-95c9-one@0/5 | marked |  | bars [18,33] | failed | 0.0 | 126.2 | 126.2 | 4003 4267 4531 | 10.9 of 10.9 GiB on the GPU | 2490 |  |  | WRITE_PHRASE bars 30-33: the phrase has 0 notes; write at least 4 |
| 95c93e3d | x-95c9-one@0/0 | marked |  | bars [18,33] | edit | 0.0 | 21.4 | 21.4 | 4018 | 10.9 of 10.9 GiB on the GPU | 2506 | REHARMONIZE 18-33 |  |  |
| 95c93e3d | x-95c9-secs@0/0 | marked |  | seconds [18,33] | edit | 0.0 | 22.5 | 22.5 | 4038 | 10.9 of 10.9 GiB on the GPU | 2514 | REHARMONIZE 18-33 |  |  |

## APPLY

| song | apply | behind an analysis | POST | reason | wait s (press to running) | started after the analysis ended s | outcome | edit s |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
