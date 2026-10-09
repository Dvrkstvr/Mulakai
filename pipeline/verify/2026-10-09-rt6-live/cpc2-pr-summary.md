# CP-C2, revise turns on the real machine (2026-10-09)

Server http://127.0.0.1:3521; planner via the recording proxy to http://127.0.0.1:11735 (own Ollama, ctx 16384). GPU at start 858 MiB. Pending ops = the live edit card before the turn; judged by value against the card after.

## Stop lines

- PASS context refusals 0; prompt tokens on revise turns p50 5050 p95 5470 max 5496 over 27 planner calls (stop on any refusal or p95 over 8000)
- PASS pending ops missing from both the merged plan and REMOVED: 0 of 18 revise cards (stop on any)
- PASS additive revisions dropping a pending op: 0 of 11 (stop over 3 of 10)
- PASS revise turns failing: 1 of 21 (stop over 2 of 12)

Prompt tokens on every turn (fresh plans too): p95 5470, max 5496.

## Turns

| song | turn | kind | mark | reply | attempts | run s | prompt tok | pending | merged | kept / changed / removed / new | lost | note |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ecf8eb5a | 0-F0 | fresh |  | edit | 2 | 148.4 | 4269 4436 | - | 2 | - |  |  |
| ecf8eb5a | 0-R1 | additive |  | edit | 1 | 4.9 | 4869 | 2 | 3 | 2 / 0 / 0 / 1 |  |  |
| ecf8eb5a | 0-R2 | additive | yes | edit | 1 | 12.4 | 5050 | 3 | 4 | 3 / 0 / 0 / 1 |  |  |
| ecf8eb5a | 0-R3 | fewer |  | edit | 1 | 5.1 | 5262 | 4 | 3 | 3 / 0 / 1 / 0 |  |  |
| ecf8eb5a | 0-R4 | additive |  | edit | 2 | 12.8 | 4997 5173 | 3 | 4 | 3 / 0 / 0 / 1 |  |  |
| ecf8eb5a | 0-R5 | over6 |  | failed | 3 | 25.2 | 5222 5346 5470 | 4 | - | - |  | too many changes: that makes 7, and a plan holds at most 6; ask to drop one first |
| ecf8eb5a | 0-R6 | replace |  | edit | 1 | 5.0 | 5208 | 4 | 1 | 0 / 0 / 4 / 1 |  |  |
| ecf8eb5a | 0-R7 | additive |  | edit | 1 | 5.1 | 4639 | 1 | 2 | 1 / 0 / 0 / 1 |  |  |
| a69541f2 | 1-F0 | fresh |  | edit | 2 | 318.4 | 4573 4754 | - | 2 | - |  |  |
| a69541f2 | 1-R1 | additive |  | edit | 1 | 5.0 | 5027 | 2 | 3 | 2 / 0 / 0 / 1 |  |  |
| a69541f2 | 1-R2 | additive | yes | edit | 1 | 8.9 | 5215 | 3 | 4 | 3 / 0 / 0 / 1 |  |  |
| a69541f2 | 1-R3 | fewer |  | edit | 1 | 5.0 | 5274 | 4 | 3 | 3 / 0 / 1 / 0 |  |  |
| a69541f2 | 1-R4 | additive |  | edit | 1 | 6.7 | 5150 | 3 | 4 | 3 / 0 / 0 / 1 |  |  |
| a69541f2 | 1-R5 | over6 |  | failed | 3 | 24.0 | 5244 5370 5496 | 4 | - | - |  | too many changes: that makes 7, and a plan holds at most 6; ask to drop one first |
| a69541f2 | 1-R6 | replace |  | edit | 1 | 5.3 | 5230 | 4 | 1 | 0 / 0 / 4 / 1 |  |  |
| a69541f2 | 1-R7 | additive |  | edit | 1 | 5.1 | 4935 | 1 | 2 | 1 / 0 / 0 / 1 |  |  |
| 95c93e3d | 2-F0 | fresh |  | edit | 1 | 19.0 | 3816 | - | 2 | - |  |  |
| 95c93e3d | 2-R1 | additive |  | edit | 1 | 5.1 | 4717 | 2 | 3 | 2 / 0 / 0 / 1 |  |  |
| 95c93e3d | 2-R2 | additive | yes | edit | 1 | 19.0 | 4882 | 3 | 3 | 3 / 0 / 0 / 0 |  |  |
| 95c93e3d | 2-R3 | fewer |  | edit | 1 | 4.8 | 4780 | 3 | 2 | 2 / 0 / 1 / 0 |  |  |
| 95c93e3d | 2-R4 | additive |  | say | 2 | 6.4 | 4205 4340 | 2 | - | - |  | This song does not have a verse section; it has an intro, chorus, and interlude instead. |
| 95c93e3d | 2-R5 | over6 |  | edit | 1 | 27.6 | 4215 | 2 | 5 | 2 / 0 / 0 / 3 |  |  |
| 95c93e3d | 2-R6 | replace |  | edit | 1 | 4.9 | 4482 | 5 | 1 | 0 / 0 / 5 / 1 |  |  |
| 95c93e3d | 2-R7 | additive |  | edit | 1 | 5.3 | 4217 | 1 | 2 | 1 / 0 / 0 / 1 |  |  |
