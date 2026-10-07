# CP-C0, edit leg (2026-10-07)

Server http://127.0.0.1:3601. Planner via the proxy to http://127.0.0.1:11434. CB-4 live run 2 (after the Idempotency-Key fix e81a44f), yue-server from the CB-4 worktree

## Stop lines

- PASS edit turn p50 5.9 s (stop over 15 s)
- PASS worst hand-off 0.2 s: unload-to-empty max 200 ms, APPLY-to-running max 19 ms (stop over 5 s)
- PASS slowest edit (APPLY -> saved) 117.9 s (stop over 4 min)
- PASS null test failing: none
- PASS join LUFS excess over 1 dB on 0 of 1 songs (stop on 3 of 3)

## Per kind

- reharmonize: 1/1 edit cards, 1 saved (1 spliced, 0 whole), turn p50 21.7 s, slowest edit 117.9 s
- cut: 1/1 edit cards, 1 saved (1 spliced, 0 whole), turn p50 5.9 s, slowest edit 3.5 s
- repeat: 1/1 edit cards, 1 saved (1 spliced, 0 whole), turn p50 5.6 s, slowest edit 3.3 s

## Edits

| song | kind | reply | turn s | unload ms | edit card | APPLY | hand-off ms | edit s | splice verdict | null (record) | null (saved file) | join excess dB | label |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Gertar | reharmonize | edit | 21.7 | 159 | splice reharmonize 15-22 | saved | 19 | 117.9 | ok | 0/9194052 | 0/9194052 | 0.318 | score edit · REHARMONIZE 15–22 · bars 15–22 spliced |
| Gertar | cut | edit | 5.9 | 200 | splice cut 27-35 | saved | 18 | 3.5 | ok | 0/9084446 | 0/9084446 | - | score edit · CUT verse S5 · bars 27–35 cut |
| Gertar | repeat | edit | 5.6 | 173 | splice repeat 15-22 | saved | 18 | 3.3 | ok | 0/10295313 | 0/10295313 | - | score edit · REPEAT chorus S3 · bars 15–22 repeated |
