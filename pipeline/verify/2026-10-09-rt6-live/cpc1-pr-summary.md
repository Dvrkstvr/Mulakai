# CP-C1, analysis and marks on the real machine (2026-10-09)

Server http://127.0.0.1:3521. Planner via the proxy to http://127.0.0.1:11735 (own Ollama, ctx 16384). GPU at start 977 MiB. RT-6 PR cd49f2f marks only; LLM_TIMEOUT_MS 480000

## Stop lines

- NO DATA commits refused because of an analysis: 0 of 0 APPLYs behind an analysis (stop on any)
- PASS slowest analysis of a version of 4 min or less: 20.6 s (stop over 90 s)
- NO DATA planner not fully on the GPU after an analysis in 0 of 0 seen; next turn p50 - running (- from SEND) (stop on any, or over 15 s)
- STOP marked turns with an op outside the mark: 8 of 14 (12 edit cards) (stop over 1)
- PASS prompt tokens p95: 5883 on marked turns, 5883 on all, max 5944 (stop over 6000)

## Analyses

| song | source | trigger | v | audio s | status | waited s | run s | WORDS s | SCORE s | SECTIONS s | plan | not read | VRAM peak / end MiB | sections |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Cariñito | yue2 | open | 1 | 161 | done | 0.0 | 0.1 | - | - | - | skip/own/cached | words: word timings are off on this machine | - / 1888 | intro 1-5 @0s 0L, verse 6-22 @13s 5L, chorus 23-30 @56s 8L, verse 2 31-47 @76s 13L, chorus 2 48-55 @119s 8L, outro 56-64 @139s 0L |
| Gertar | yue2 | open | 1 | 215 | done | 0.0 | 20.6 | - | - | 20.4 | skip/own/track | words: word timings are off on this machine | 4600 / 843 | intro 1-5 @0s 0L, verse 6-14 @12s 7L, chorus 15-22 @37s 4L, interlude 23-26 @60s 0L, verse 2 27-35 @71s 8L, chorus 2 36-43 @96s 4L, bridge 44-52 @119s 4L, chorus 3 53-60 @144s 0L, interlude 2 61-68 @167s 0L, outro 69-77 @190s 5L |
| Acid Houzzzz | yue2 | open | 1 | 79 | done | 0.0 | 14.2 | - | - | 14.1 | skip/own/track | words: word timings are off on this machine | 4609 / 848 | intro 1-17 @6s 0L, chorus 18-33 @38s 0L, interlude 34-39 @68s 0L |

## Turns

| song | turn | role | after analysis | mark (bars) | reply | wait s | run s | from SEND s | prompt tok | planner | VRAM before | ops | outside | note |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ecf8eb5a | x-ecf8-one@0/0 | marked |  | bars [6,22] | edit | 0.0 | 58.0 | 58.0 | 4412 4524 4799 | 10.9 of 10.9 GiB on the GPU | 1889 | REHARMONIZE 6-17, REHARMONIZE 18-22 |  |  |
| ecf8eb5a | x-ecf8-one@1/5 | marked |  | bars [23,30] | failed | 0.0 | 25.0 | 25.0 | 5104 5370 5565 | 10.9 of 10.9 GiB on the GPU | 876 |  |  | op 4 (WRITE_PHRASE): the Vocal sings in bars 27-30; free: 1-5, 56-64 |
| ecf8eb5a | x-ecf8-one@2/1 | marked |  | bars [31,47] | edit | 0.0 | 26.2 | 26.2 | 5121 5274 | 10.9 of 10.9 GiB on the GPU | 856 | REHARMONIZE 6-17, REHARMONIZE 18-22, REHARMONIZE 31-46 | op 1 REHARMONIZE: bar 6 outside bars 31-47; op 2 REHARMONIZE: bar 18 outside bars 31-47 |  |
| ecf8eb5a | x-ecf8-one@3/5 | marked |  | bars [48,55] | edit | 0.0 | 16.6 | 16.6 | 5571 5777 | 10.9 of 10.9 GiB on the GPU | 857 | REHARMONIZE 6-17, REHARMONIZE 18-22, REHARMONIZE 31-46, REHARMONIZE 48-55 | op 1 REHARMONIZE: bar 6 outside bars 48-55; op 2 REHARMONIZE: bar 18 outside bars 48-55; op 3 REHARMONIZE: bar 31 outside bars 48-55 |  |
| ecf8eb5a | x-ecf8-cross@0/0 | marked |  | bars [21,26] | edit | 0.0 | 8.3 | 8.3 | 5883 | 10.9 of 10.9 GiB on the GPU | 857 | REHARMONIZE 6-17, REHARMONIZE 18-22, REHARMONIZE 31-46, REHARMONIZE 48-55, REHARMONIZE 23-26 | op 1 REHARMONIZE: bar 6 outside bars 21-26; op 2 REHARMONIZE: bar 18 outside bars 21-26; op 3 REHARMONIZE: bar 31 outside bars 21-26; op 4 REHARMONIZE: bar 48 outside bars 21-26 |  |
| ecf8eb5a | x-ecf8-secs@2/0 | marked |  | seconds [31,47] | edit | 0.0 | 15.3 | 15.3 | 5944 | 10.9 of 10.9 GiB on the GPU | 865 | REHARMONIZE 6-17, REHARMONIZE 18-22, REHARMONIZE 31-46, REHARMONIZE 48-55, REHARMONIZE 23-26 | op 1 REHARMONIZE: bar 6 outside bars 31-47; op 2 REHARMONIZE: bar 18 outside bars 31-47; op 4 REHARMONIZE: bar 48 outside bars 31-47; op 5 REHARMONIZE: bar 23 outside bars 31-47 |  |
| a69541f2 | x-a695-one@1/5 | marked |  | bars [15,22] | edit | 0.0 | 58.2 | 58.2 | 4715 5233 5666 | 10.9 of 10.9 GiB on the GPU | 843 | REHARMONIZE 15-22 |  |  |
| a69541f2 | x-a695-one@0/0 | marked |  | bars [6,14] | edit | 0.0 | 10.4 | 10.4 | 5178 | 10.9 of 10.9 GiB on the GPU | 853 | REHARMONIZE 15-22, REHARMONIZE 6-14 | op 1 REHARMONIZE: bar 15 outside bars 6-14 |  |
| a69541f2 | x-a695-one@4/0 | marked |  | bars [44,52] | edit | 0.0 | 20.6 | 20.6 | 5439 5636 5823 | 10.9 of 10.9 GiB on the GPU | 845 | REHARMONIZE 15-22, REHARMONIZE 6-14, REHARMONIZE 44-52 | op 1 REHARMONIZE: bar 15 outside bars 44-52; op 2 REHARMONIZE: bar 6 outside bars 44-52 |  |
| a69541f2 | x-a695-cross@3/0 | marked |  | bars [42,47] | edit | 0.0 | 9.7 | 9.7 | 5768 | 10.9 of 10.9 GiB on the GPU | 847 | REHARMONIZE 15-22, REHARMONIZE 6-14, REHARMONIZE 42-47 | op 1 REHARMONIZE: bar 15 outside bars 42-47; op 2 REHARMONIZE: bar 6 outside bars 42-47 |  |
| a69541f2 | x-a695-secs@2/1 | marked |  | seconds [27,35] | edit | 0.0 | 11.0 | 11.0 | 5671 | 10.9 of 10.9 GiB on the GPU | 848 | REHARMONIZE 15-22, REHARMONIZE 6-14, REHARMONIZE 42-47, REHARMONIZE 27-35 | op 1 REHARMONIZE: bar 15 outside bars 27-35; op 2 REHARMONIZE: bar 6 outside bars 27-35; op 3 REHARMONIZE: bar 42 outside bars 27-35 |  |
| 95c93e3d | x-95c9-one@0/5 | marked |  | bars [18,33] | failed | 0.0 | 117.1 | 117.1 | 3937 4287 4579 | 10.9 of 10.9 GiB on the GPU | 848 |  |  | op 5 (WRITE_PHRASE): bar 1 of the phrase (score bar 30) sums to 3.5 beats, the meter needs 4 (too short by 0.5); bar 2 of the phrase (score  |
| 95c93e3d | x-95c9-one@0/0 | marked |  | bars [18,33] | edit | 0.0 | 22.8 | 22.9 | 3952 | 10.9 of 10.9 GiB on the GPU | 863 | REHARMONIZE 18-33 |  |  |
| 95c93e3d | x-95c9-secs@0/0 | marked |  | seconds [18,33] | edit | 0.0 | 23.7 | 23.7 | 4954 | 10.9 of 10.9 GiB on the GPU | 885 | REHARMONIZE 18-33 |  |  |

## APPLY

| song | apply | behind an analysis | POST | reason | wait s (press to running) | started after the analysis ended s | outcome | edit s |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
