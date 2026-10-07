# CP-C0, edit leg (2026-10-07)

Server http://127.0.0.1:3601. Planner via the proxy to http://127.0.0.1:11434. CB-4 live run 2 (after the Idempotency-Key fix e81a44f), yue-server from the CB-4 worktree

## Stop lines

- PASS edit turn p50 6.3 s (stop over 15 s)
- PASS worst hand-off 0.3 s: unload-to-empty max 275 ms, APPLY-to-running max 25 ms (stop over 5 s)
- PASS slowest edit (APPLY -> saved) 117.9 s (stop over 4 min)
- PASS null test failing: none
- PASS join LUFS excess over 1 dB on 0 of 3 songs (stop on 3 of 3)

## Per kind

- reharmonize: 2/3 edit cards, 2 saved (2 spliced, 0 whole), turn p50 21.7 s, slowest edit 117.9 s
- cut: 3/3 edit cards, 3 saved (2 spliced, 1 whole), turn p50 5.9 s, slowest edit 56.8 s
- repeat: 3/3 edit cards, 3 saved (2 spliced, 1 whole), turn p50 5.6 s, slowest edit 77 s
- rewrite: 3/3 edit cards, 3 saved (0 spliced, 3 whole), turn p50 9.5 s, slowest edit 95 s

## Edits

| song | kind | reply | turn s | unload ms | edit card | APPLY | hand-off ms | edit s | splice verdict | null (record) | null (saved file) | join excess dB | label |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Gertar | reharmonize | edit | 21.7 | 159 | splice reharmonize 15-22 | saved | 19 | 117.9 | ok | 0/9194052 | 0/9194052 | 0.318 | score edit · REHARMONIZE 15–22 · bars 15–22 spliced |
| Gertar | cut | edit | 5.9 | 200 | splice cut 27-35 | saved | 18 | 3.5 | ok | 0/9084446 | 0/9084446 | - | score edit · CUT verse S5 · bars 27–35 cut |
| Gertar | repeat | edit | 5.6 | 173 | splice repeat 15-22 | saved | 18 | 3.3 | ok | 0/10295313 | 0/10295313 | - | score edit · REPEAT chorus S3 · bars 15–22 repeated |
| Gertar | rewrite | edit | 9.6 | 275 | whole: REWRITE LYRICS changes the whole take, so it cannot be spliced into the old one | saved | 25 | 95 | - | - | - | - | score edit · REWRITE LYRICS [Chorus] #1 |
| Cariñito | reharmonize | edit | 20.1 | 135 | splice reharmonize 23-30 | saved | 17 | 97.4 | ok | 0/6731858 | 0/6731858 | 0.205 | score edit · REHARMONIZE 23–30 · bars 23–30 spliced |
| Cariñito | cut | edit | 6.3 | 154 | splice cut 31-47 | saved | 14 | 2.9 | ok | 0/5640217 | 0/5640217 | - | score edit · CUT verse S4 · bars 31–47 cut |
| Cariñito | repeat | edit | 5.5 | 164 | splice repeat 23-30 | saved | 15 | 3 | ok | 0/7716616 | 0/7716616 | - | score edit · REPEAT chorus S3 · bars 23–30 repeated |
| Cariñito | rewrite | edit | 9.5 | 145 | whole: REWRITE LYRICS changes the whole take, so it cannot be spliced into the old one | saved | 17 | 66.7 | - | - | - | - | score edit · REWRITE LYRICS [Chorus] #1 |
| House in der Halle | reharmonize | failed | 25.1 | 200 | - | - | - | - | - | - | - | - | - |
| House in der Halle | cut | edit | 5.8 | 136 | splice cut 38-49 | saved | 13 | 56.8 | rerender: not_aligned: no groove to line the cut up on | - | - | - | score edit · CUT verse S5 · whole song re-rendered: the join could not be aligned |
| House in der Halle | repeat | edit | 6.1 | 160 | splice repeat 18-29 | saved | 14 | 77 | rerender: level_step: the copy's seam steps +6.6 dB in loudness (more than 4 dB): the whole song is re-rendered | - | - | - | score edit · REPEAT chorus S3 · whole song re-rendered: the copy's seam steps +6.6 dB in loudness (more than 4 dB): the whole song is re-rendered |
| House in der Halle | rewrite | edit | 7.8 | 148 | whole: REWRITE LYRICS changes the whole take, so it cannot be spliced into the old one | saved | 14 | 52.6 | - | - | - | - | score edit · REWRITE LYRICS [Chorus] #1 |

## Notes (builder, CB-4)

- Run 1 (01:15 UTC) found a bug: the chat edit job sent its job id as the Idempotency-Key on both the YuE2 render and the splice; yue-server keeps one key map, answered 409, and Gertar's REHARMONIZE was saved as the whole re-render (labelled). Fixed in e81a44f (splice key `splice-<job id>`); this table is run 2. Run 1's fallback version is still in the data copy and in the listen folder as `Gertar-reharmonize-v2.wav` (whole render, not a splice); the spliced pair is `Gertar-reharmonize-v4.wav`.
- Each kind edits v1 (USE v1 between kinds), so every saved version is a v1 -> vN pair.
- House in der Halle REHARMONIZE: the plan failed its check 3 times ("keeps the old root in 4 of 12 bars"), no edit card; the turn changed nothing.
- "null (saved file)" and the join excess come from yue-server/splice_check.py run in WSL on the saved library file against its base; CUT/REPEAT seams have no base counterpart (raw step only).
- REHARMONIZE turns (20-25 s) are slower than the other kinds (5-10 s); the overall p50 is 6.3 s.
