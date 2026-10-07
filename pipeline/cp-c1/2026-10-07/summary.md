# CP-C1, analysis and marks on the real machine (2026-10-07)

Server http://127.0.0.1:3221. Planner via the proxy to http://127.0.0.1:11535 (own Ollama, ctx 16384). GPU at start 2843 MiB. Run 2 (--merge): 2 more marked turns on Gertar, because Acid Houzzzz's strip stayed hatched (its bar times unreadable) and its 2 asked-for marks were sent without one.

## Stop lines

- PASS commits refused because of an analysis: 0 of 2 APPLYs behind an analysis (stop on any)
- PASS slowest analysis of a version of 4 min or less: 30.3 s (stop over 90 s)
- PASS planner not fully on the GPU after an analysis in 0 of 8 seen; next turn p50 11.9 s running (18.8 s from SEND) (stop on any, or over 15 s)
- STOP marked turns with an op outside the mark: 2 of 10 (8 edit cards) (stop over 1)
- PASS prompt tokens p95: 5938 on marked turns, 5730 on all, max 5938 (stop over 6000)

## Analyses

| song | source | trigger | v | audio s | status | waited s | run s | WORDS s | SCORE s | SECTIONS s | plan | not read | VRAM peak / end MiB | sections |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Cariñito | yue2 | open | 1 | 161 | done | 0.0 | 30.3 | 9.8 | - | 20.4 | service/own/track |  | 5901 / 1798 | intro 1-5 @0s, verse 6-22 @13s, chorus 23-30 @56s, verse 2 31-47 @76s, chorus 2 48-55 @119s, outro 56-64 @139s |
| Cariñito | yue2 | save | 2 | 161 | done | 13.8 | 18.3 | 18.3 | - | - | service/own/cached |  | 7820 / 6626 | intro 1-5 @0s, verse 6-22 @13s, chorus 23-30 @56s, verse 2 31-47 @76s, chorus 2 48-55 @119s, outro 56-64 @139s |
| Cariñito | yue2 | save | 3 | 161 | done | 0.0 | 9.9 | 9.9 | - | - | service/own/cached |  | 6740 / 11275 | intro 1-5 @0s, verse 6-22 @13s, chorus 23-30 @56s, verse 2 31-47 @76s, chorus 2 48-55 @119s, outro 56-64 @139s |
| Gertar | yue2 | open | 1 | 215 | done | 0.0 | 28.5 | 9.9 | - | 18.5 | service/own/track |  | 6746 / 2655 | intro 1-5 @0s, verse 6-14 @12s, chorus 15-22 @37s, interlude 23-26 @60s, verse 2 27-35 @71s, chorus 2 36-43 @96s, bridge 44-52 @119s, chorus 3 53-60 @144s, interlude 2 61-68 @167s, outro 69-77 @190s |
| Acid Houzzzz | yue2 | open | 1 | 79 | done | 0.0 | 28.0 | 15.8 | - | 12.2 | service/own/track | bars: YUE2 bar times -> unreadable reply | 7787 / 2662 | intro 1-17, chorus 18-33, interlude 34-43 |
| Acid Houzzzz | yue2 | save | 2 | 64 | done | 13.4 | 15.6 | 15.6 | - | - | service/own/cached | bars: YUE2 bar times -> unreadable reply | 7877 / 10721 | intro 1-17, chorus 18-33, interlude 34-43 |
| Acid Houzzzz | yue2 | save | 3 | 68 | done | 0.0 | 15.1 | 15.1 | - | - | service/own/cached | bars: YUE2 bar times -> unreadable reply | 7949 / 4312 | intro 1-17, chorus 18-33, interlude 34-43 |
| Ellies City 2 | transcribed | open | 1 | 140 | done | 0.0 | 19.3 | 7.0 | 12.3 | - | service/service/score |  | 6926 / 2833 | intro 1-4 @0s, verse 5-12 @13s, chorus 13-18 @38s, verse 2 19-26 @58s, chorus 2 27-34 @83s, outro 35-44 @109s |
| purple trails | transcribed | open | 1 | 200 | done | 0.0 | 21.9 | 7.4 | 14.5 | - | service/service/score |  | 6941 / 2838 | intro 1-8 @0s, verse 9-16 @22s, chorus 17-24 @45s, verse 2 25-32 @67s, chorus 2 33-58 @89s, outro 59-72 @162s |
| Unmoving | transcribed | open | 2 | 213 | done | 0.0 | 21.7 | 7.2 | 14.5 | - | service/service/score |  | 6942 / 2849 | intro 1-8 @0s, verse 9-16 @28s, chorus 17-24 @55s, verse 2 25-32 @83s, chorus 2 33-42 @110s, interlude 43-48 @145s, outro 49-62 @166s |

## Turns

| song | turn | role | after analysis | mark (bars) | reply | wait s | run s | from SEND s | prompt tok | planner | VRAM before | ops | outside | note |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ecf8eb5a | 0-T1 | after-analysis | yes |  | edit | 0.1 | 20.6 | 20.7 | 4302 4700 5094 | 10.9 of 10.9 GiB on the GPU | 1798 | REHARMONIZE 23-30 |  |  |
| ecf8eb5a | 0-T2 | behind-apply |  |  | edit | 97.6 | 13.8 | 111.4 | 4796 | 10.9 of 10.9 GiB on the GPU | 2693 | REHARMONIZE 48-55 |  |  |
| ecf8eb5a | 0-M1 | marked | yes | bars [6,22] | failed | 11.4 | 29.1 | 40.5 | 5382 5938 | 10.9 of 10.9 GiB on the GPU | 11275 |  |  | REHARMONIZE 6-16 keeps the old root in 11 of 11 bars; change the root in at least one chord per 2 bars (bars 6-7, 8-9, 10-11, 12-13, 14-15,  |
| ecf8eb5a | 0-M2 | marked |  | bars [23,30] | failed | 0.0 | 19.1 | 19.1 | 4749 5159 5575 | 10.9 of 10.9 GiB on the GPU | 2642 |  |  | REHARMONIZE 23-30 keeps the old root in 8 of 8 bars; change the root in at least one chord per 2 bars (bars 23-24, 25-26, 27-28, 29-30 keep  |
| ecf8eb5a | 0-M3 | marked |  | bars [46,51] | edit | 0.0 | 16.1 | 16.1 | 4751 | 10.9 of 10.9 GiB on the GPU | 2647 | REHARMONIZE 46-51 |  |  |
| ecf8eb5a | 0-M4 | marked |  | seconds [48,55] | edit | 0.0 | 8.4 | 8.4 | 4741 | 10.9 of 10.9 GiB on the GPU | 2643 | REHARMONIZE 25-30 | op 1 REHARMONIZE: bar 25 outside bars 48-55 |  |
| a69541f2 | 1-T1 | after-analysis | yes |  | failed | 0.0 | 21.9 | 21.9 | 4606 5074 5529 | 10.9 of 10.9 GiB on the GPU | 2655 |  |  | REHARMONIZE 15-22 keeps the old root in 3 of 8 bars; change the root in at least one chord per 2 bars (bars 17-18 keep every root; a 7th or  |
| a69541f2 | 1-M1 | marked |  | bars [15,22] | edit | 0.0 | 19.8 | 19.8 | 4814 5421 | 10.9 of 10.9 GiB on the GPU | 2655 | REWRITE_LYRICS B3, REHARMONIZE 15-22 |  |  |
| a69541f2 | 1-M2 | marked |  | bars [27,35] | edit | 0.0 | 6.6 | 6.6 | 4876 5011 | 10.9 of 10.9 GiB on the GPU | 2653 | REPEAT S5 |  |  |
| a69541f2 | 1-M3 | marked |  | bars [42,47] | edit | 0.0 | 9.9 | 9.9 | 4905 | 10.9 of 10.9 GiB on the GPU | 2653 | EDIT_STYLE, REHARMONIZE 42-47 |  | EDIT STYLE changes the whole song, not only the marked bars |
| a69541f2 | 1-M4 | marked |  | seconds [44,52] | edit | 0.0 | 9.2 | 9.2 | 4900 | 10.9 of 10.9 GiB on the GPU | 2662 | REHARMONIZE 15-22 | op 1 REHARMONIZE: bar 15 outside bars 44-52 |  |
| 95c93e3d | 2-T1 | after-analysis | yes |  | edit | 0.0 | 18.8 | 18.8 | 3849 | 10.9 of 10.9 GiB on the GPU | 2662 | REHARMONIZE 18-33 |  |  |
| 95c93e3d | 2-T2 | behind-apply |  |  | edit | 50.7 | 13.4 | 64.1 | 4369 | 10.9 of 10.9 GiB on the GPU | 2744 | REHARMONIZE 30-33 |  |  |
| 95c93e3d | 2-M1 | no-mark | yes |  | edit | 16.6 | 11.9 | 28.5 | 4470 | 10.9 of 10.9 GiB on the GPU | 11456 | REHARMONIZE 30-33 |  |  |
| 95c93e3d | 2-M2 | no-mark |  |  | say | 0.0 | 4.9 | 4.9 | 4108 | 10.9 of 10.9 GiB on the GPU | 2822 |  |  | The chat cannot do that yet: open the song in the Editor and use REPAINT there. |
| 68f65c90 | tr0-T1 | after-analysis | yes |  | say | 0.0 | 5.1 | 5.1 | 2875 | 10.9 of 10.9 GiB on the GPU | 2833 |  |  | The song 'Ellies City 2' has the following sections: Intro, Verse, Pre-Chorus, Chorus, Bridge, and Outro. The Intro starts at bar 1, the Ver |
| 0356be33 | tr1-T1 | after-analysis | yes |  | say | 0.0 | 5.1 | 5.1 | 2904 | 10.9 of 10.9 GiB on the GPU | 2838 |  |  | The song 'purple trails' has the following sections: Intro, Verse, Pre-Chorus, Chorus, Bridge, and Outro. The Intro starts at bar 1, the Ver |
| cfc9224f | tr2-T1 | after-analysis | yes |  | say | 0.0 | 5.2 | 5.2 | 2887 | 10.9 of 10.9 GiB on the GPU | 2849 |  |  | The song 'Unmoving' has the following sections: an Intro, a Verse, a Pre-Chorus, a Chorus, a Bridge, and an Outro. The Intro starts at bar 1 |
| a69541f2 | x-a695-one@5/4 | marked |  | bars [53,60] | edit | 0.0 | 19.1 | 19.1 | 4915 5330 5730 | 10.9 of 10.9 GiB on the GPU | 2843 | REHARMONIZE 53-60 |  |  |
| a69541f2 | x-a695-cross@4/2 | marked |  | bars [51,56] | edit | 0.0 | 6.7 | 6.7 | 4946 | 10.9 of 10.9 GiB on the GPU | 2842 | REWRITE_LYRICS B6 |  |  |

## APPLY

| song | apply | behind an analysis | POST | reason | wait s (press to running) | started after the analysis ended s | outcome | edit s |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ecf8eb5a | 0-apply1 | none | 202 | - | 0.0 | - | saved | 97.6 |
| ecf8eb5a | 0-apply2 | running | 202 | - | 18.0 | 0.0 | saved | 101.2 |
| 95c93e3d | 2-apply1 | none | 202 | - | 0.0 | - | saved | 50.7 |
| 95c93e3d | 2-apply2 | running | 202 | - | 15.3 | 0.0 | saved | 59.9 |
