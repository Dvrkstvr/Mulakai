# CP-C4, chained splices (2026-10-09)

Server http://127.0.0.1:3501. CK-4 run 1 + run 2 (--append): server feat/chat-c4-cp4 (main + CK-3 444ce03), CHAT_SPLICE_CHAIN=1, own yue-server from the worktree on :8504 (the owner's :8004 predates CK-2), Ollama :11434 shared with another session's Ollama :11735 on the same GPU. Run 2 replaced House in der Halle (trashed in the library today, chat 404) with Polski Polka; run 2 proxy events only.

## Stop lines

- PASS null test on the saved files: 0 failing, 4 chains, 0 unchecked (stop on any differing sample)
- PASS partial saves: none (stop on any)
- PASS join LUFS excess over 1 dB on 0 of 3 songs (stop on 2 of 3)
- PASS slowest multi-op edit (APPLY -> saved) 219.6 s (stop over 5 min)
- PASS whole-song fallbacks at APPLY 2 of 6 (stop over 3); plan-time rule fallbacks 0, unsaved 0, no multi-op plan 0

## Plans

| song | plan | mix | ops | card | outcome | edit s | splice verdict | null (record) | null (saved file) | join excess dB | temp MB | label |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Gertar | gertar-rr | reharmonize+reharmonize | 2 | reharmonize 44-52, reharmonize 15-22 | chain | 193.1 | ok | 0/18248540 | 0/7940488 | 0.27 | 83.1 | score edit · REHARMONIZE 15–22 · REHARMONIZE 44–52 · bars 15–22, 44–52 spliced |
| Gertar | gertar-rc | reharmonize+cut | 2 | cut 61-68, reharmonize 15-22 | fallback | 133.7 | rerender @1: not_aligned: no groove to line the cut up on | - | - | - | 0.6 | score edit · REHARMONIZE 15–22 · CUT interlude S9 · whole song re-rendered: the join could not be aligned (step 1, bars 61–68) |
| Cariñito | carinito-rr | reharmonize+reharmonize | 2 | reharmonize 48-55, reharmonize 23-30 | chain | 166.2 | ok | 0/13462585 | 0/5730980 | 0.238 | 62.4 | score edit · REHARMONIZE 23–30 · REHARMONIZE 48–55 · bars 23–30, 48–55 spliced |
| Cariñito | carinito-rp | reharmonize+repeat | 2 | reharmonize 48-55, repeat 23-30 | chain | 219.6 | ok | 0/14447363 | 0/6715738 | 0.175 | 70.3 | score edit · REPEAT chorus S3 · REHARMONIZE 48–55 · bars 48–55 spliced · bars 23–30 repeated |
| Polski Polka | polka-rr | reharmonize+reharmonize | 2 | reharmonize 106-113, reharmonize 33-40 | chain | 216.4 | ok | 0/19046524 | 0/8835312 | 0.281 | 82.7 | score edit · REHARMONIZE 33–40 · REHARMONIZE 106–113 · bars 33–40, 106–113 spliced |
| Polski Polka | polka-rc | reharmonize+cut | 2 | reharmonize 106-113, cut 49-69 | fallback | 98.3 | rerender @1: length: the new take's bars 106-113 run 6.96 s longer than the current version's (a splice keeps the length within 0.25 s) | - | - | - | 0.8 | score edit · CUT verse S5 · REHARMONIZE 106–113 · whole song re-rendered: the new take's bars 106-113 run 6.96 s longer than the current version's (a splice keeps the length within 0.25 s) (step 1, bars 106–113) |

## Steps (yue-server, in step order)

- gertar-rr step 1: REHARMONIZE bars 44-52, ok, snaps -22.419/4.115 ms, gain {"in":-0.239,"out":2.673,"bars":[-0.239,-0.491,-0.344,2.332,-0.454,1.807,0.958,2.178,2.673]} dB, joins 119.03, 144.3524 s, length -0.0876 s, null 0/9058692
- gertar-rr step 2: REHARMONIZE bars 15-22, ok, snaps 26.884/5.67 ms, gain {"in":0.616,"out":-1.229,"bars":[0.616,1.559,0.226,0.214,-0.738,2.22,1.152,-1.229]} dB, joins 37.16, 59.6688 s, length -0.0812 s, null 0/9189848
- gertar-rc step 1: CUT bars 61-68, rerender (not_aligned: no groove to line the cut up on), snaps 21.689 ms, gain null dB, joins - s, length - s, null -
- carinito-rr step 1: REHARMONIZE bars 48-55, ok, snaps -39.855/6.441 ms, gain {"in":-1.473,"out":0.737,"bars":[-1.473,0.793,0.788,0.826,-0.865,0.619,0.775,0.737]} dB, joins 118.65, 138.8664 s, length -0.0036 s, null 0/6730898
- carinito-rr step 2: REHARMONIZE bars 23-30, ok, snaps -9.463/141.03 ms, gain {"in":-0.095,"out":0.495,"bars":[-0.095,-0.31,0.325,0.264,-1.099,0.197,0.345,0.495]} dB, joins 55.51, 75.72 s, length 0.01 s, null 0/6731687
- carinito-rp step 1: REHARMONIZE bars 48-55, ok, snaps -2.536/4.302 ms, gain {"in":1.508,"out":5.73,"bars":[1.508,4.975,4.9,2.399,1.619,4.201,5.113,5.73]} dB, joins 118.65, 138.8669 s, length -0.0031 s, null 0/6730898
- carinito-rp step 2: REPEAT bars 23-30, ok, snaps -7.801 ms, gain null dB, joins 75.71, 95.9178 s, length 20.2078 s, null 0/7716465
- polka-rr step 1: REHARMONIZE bars 106-113, ok, snaps -10.312/-15.393 ms, gain {"in":2.924,"out":1.842,"bars":[2.924,2.536,2.465,2.51,3.767,3.708,2.627,1.842]} dB, joins 181.41, 195.2849 s, length -0.0251 s, null 0/9524344
- polka-rr step 2: REHARMONIZE bars 33-40, ok, snaps -19.703/-8.933 ms, gain {"in":0.15,"out":0.336,"bars":[0.15,0.219,1.426,1.244,2.649,1.435,1.699,0.336]} dB, joins 54.45, 68.3608 s, length -0.0092 s, null 0/9522180
- polka-rc step 1: REHARMONIZE bars 106-113, rerender (length: the new take's bars 106-113 run 6.96 s longer than the current version's (a splice keeps the length within 0.25 s)), snaps 8.84/-3.63 ms, gain {"in":0.915,"out":0.39,"bars":[0.915,1.521,0.404,0.808,-1.204,0.276,1.382,0.39]} dB, joins - s, length 6.9575 s, null -

## Joins on the saved files (splice_check.py --chain)

- gertar-rr join 118.9488 s: step 2.193 dB, base 2.18 dB, excess 0.013
- gertar-rr join 144.2712 s: step -0.562 dB, base -0.832 dB, excess 0.27
- gertar-rr join 37.16 s: step 1.043 dB, base 1.193 dB, excess -0.15
- gertar-rr join 59.6688 s: step 1.744 dB, base 1.986 dB, excess -0.242
- carinito-rr join 118.66 s: step 4.247 dB, base 4.138 dB, excess 0.109
- carinito-rr join 138.8764 s: step -0.091 dB, base 0.147 dB, excess -0.238
- carinito-rr join 55.51 s: step 3.757 dB, base 3.858 dB, excess -0.101
- carinito-rr join 75.72 s: step -2.553 dB, base -2.771 dB, excess 0.218
- carinito-rp join 138.8578 s: step 4.313 dB, base 4.138 dB, excess 0.175
- carinito-rp join 159.0747 s: step 0.155 dB, base 0.147 dB, excess 0.008
- carinito-rp join 75.71 s: step -0.259 dB, base - dB, excess - (no base counterpart)
- carinito-rp join 95.9178 s: step -2.771 dB, base - dB, excess - (no base counterpart)
- polka-rr join 181.4008 s: step 2.71 dB, base 2.429 dB, excess 0.281
- polka-rr join 195.2757 s: step -0.147 dB, base 0.123 dB, excess -0.27
- polka-rr join 54.45 s: step -1.116 dB, base -1.194 dB, excess 0.078
- polka-rr join 68.3608 s: step -0.214 dB, base 0.005 dB, excess -0.219
