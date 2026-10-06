# CP-C0a, create leg (2026-10-06)

Server http://127.0.0.1:3201. Planner via the proxy to http://127.0.0.1:11434.

## Stop lines

- PASS turn p50 11.5 s (stop over 15 s)
- PASS worst hand-off 0.1 s: unload-to-empty max 0.1 s, CREATE-to-running max 0.0 s (stop over 5 s)
- PASS invalid after 3 attempts: 0 (stop when more than 1)

## Numbers

- turns 10; actions recipe 10
- turn p50 11.5 s, p95 18.5 s; cold (first) 10.8 s, warm p50 11.7 s
- attempts max 1; invalid after 3: 0; not the expected action: en-vague-song, de-vague, en-vague-nice
- unload-to-empty max 104 ms; CREATE-to-running 6 ms; takes saved in 95 s

## Turns

| # | id | lang | expect | action | cause | attempts | turn s | prompt tokens | unload ms | CREATE SONG |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | en-sea-ballad | en | recipe | recipe | - | 1 | 10.8 | 2727 | 104 | saved, hand-off 6 ms, take 95 s |
| 2 | de-abschied | de | recipe | recipe | - | 1 | 13.9 | 2741 | 102 | - |
| 3 | es-cumbia | es | recipe | recipe | - | 1 | 11.9 | 2748 | 104 | - |
| 4 | en-vague-song | en | ask | recipe | - | 1 | 10.9 | 2721 | 99 | - |
| 5 | en-synthpop | en | recipe | recipe | - | 1 | 18.5 | 2738 | 100 | - |
| 6 | de-vague | de | ask | recipe | - | 1 | 9.9 | 2723 | 101 | - |
| 7 | en-waltz | en | recipe | recipe | - | 1 | 11.7 | 2741 | 100 | - |
| 8 | es-lluvia | es | recipe | recipe | - | 1 | 11.5 | 2742 | 98 | - |
| 9 | en-vague-nice | en | ask | recipe | - | 1 | 8.5 | 2719 | 99 | - |
| 10 | de-rock | de | recipe | recipe | - | 1 | 13.7 | 2749 | 104 | - |
