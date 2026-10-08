# CP-C2, revise turns on the real machine (2026-10-08)

Server http://127.0.0.1:3241; planner via the recording proxy to http://127.0.0.1:11565 (own Ollama, ctx 16384). GPU at start 2310 MiB. Pending ops = the live edit card before the turn; judged by value against the card after.

## Stop lines

- PASS context refusals 0; prompt tokens on revise turns p50 5078 p95 5457 max 5583 over 27 planner calls (stop on any refusal or p95 over 8000)
- PASS pending ops missing from both the merged plan and REMOVED: 0 of 18 revise cards (stop on any)
- PASS additive revisions dropping a pending op: 0 of 11 (stop over 3 of 10)
- PASS revise turns failing: 1 of 21 (stop over 2 of 12)

Prompt tokens on every turn (fresh plans too): p95 5457, max 5583.

## Turns

| song | turn | kind | mark | reply | attempts | run s | prompt tok | pending | merged | kept / changed / removed / new | lost | note |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ecf8eb5a | 0-F0 | fresh |  | edit | 2 | 16.3 | 4315 4482 | - | 2 | - |  |  |
| ecf8eb5a | 0-R1 | additive |  | edit | 1 | 6.2 | 4781 | 2 | 3 | 2 / 0 / 0 / 1 |  |  |
| ecf8eb5a | 0-R2 | additive | yes | edit | 1 | 10.2 | 4962 | 3 | 4 | 3 / 0 / 0 / 1 |  |  |
| ecf8eb5a | 0-R3 | fewer |  | edit | 1 | 5.8 | 5027 | 4 | 3 | 3 / 0 / 1 / 0 |  |  |
| ecf8eb5a | 0-R4 | additive |  | edit | 2 | 13.4 | 4902 5078 | 3 | 4 | 3 / 0 / 0 / 1 |  |  |
| ecf8eb5a | 0-R5 | over6 |  | failed | 3 | 26.0 | 5093 5217 5341 | 4 | - | - |  | the revised plan has 7 ops; at most 6: drop pending ops or return fewer |
| ecf8eb5a | 0-R6 | replace |  | edit | 1 | 6.3 | 5079 | 4 | 4 | 3 / 1 / 0 / 0 |  |  |
| ecf8eb5a | 0-R7 | additive |  | edit | 1 | 6.0 | 5069 | 4 | 4 | 3 / 1 / 0 / 0 |  |  |
| a69541f2 | 1-F0 | fresh |  | edit | 2 | 18.7 | 4619 4800 | - | 2 | - |  |  |
| a69541f2 | 1-R1 | additive |  | edit | 1 | 6.0 | 5124 | 2 | 3 | 2 / 0 / 0 / 1 |  |  |
| a69541f2 | 1-R2 | additive | yes | edit | 1 | 11.2 | 5312 | 3 | 4 | 3 / 0 / 0 / 1 |  |  |
| a69541f2 | 1-R3 | fewer |  | edit | 1 | 5.7 | 5410 | 4 | 3 | 3 / 0 / 1 / 0 |  |  |
| a69541f2 | 1-R4 | additive |  | edit | 1 | 8.1 | 5246 | 3 | 4 | 3 / 0 / 0 / 1 |  |  |
| a69541f2 | 1-R5 | over6 |  | failed | 3 | 26.8 | 5331 5457 5583 | 4 | - | - |  | the revised plan has 7 ops; at most 6: drop pending ops or return fewer |
| a69541f2 | 1-R6 | replace |  | edit | 1 | 6.4 | 5317 | 4 | 4 | 3 / 1 / 0 / 0 |  |  |
| a69541f2 | 1-R7 | additive |  | edit | 1 | 5.9 | 5307 | 4 | 4 | 3 / 1 / 0 / 0 |  |  |
| 95c93e3d | 2-F0 | fresh |  | edit | 1 | 21.6 | 3862 | - | 2 | - |  |  |
| 95c93e3d | 2-R1 | additive |  | edit | 1 | 7.4 | 4755 | 2 | 3 | 2 / 0 / 0 / 1 |  |  |
| 95c93e3d | 2-R2 | additive | yes | edit | 1 | 21.8 | 4920 | 3 | 3 | 3 / 0 / 0 / 0 |  |  |
| 95c93e3d | 2-R3 | fewer |  | edit | 1 | 5.3 | 4818 | 3 | 2 | 2 / 0 / 1 / 0 |  |  |
| 95c93e3d | 2-R4 | additive |  | say | 2 | 7.5 | 4251 4386 | 2 | - | - |  | This song does not have a verse; it has an intro, chorus, and interlude instead. |
| 95c93e3d | 2-R5 | over6 |  | edit | 1 | 9.3 | 4260 | 2 | 5 | 2 / 0 / 0 / 3 |  |  |
| 95c93e3d | 2-R6 | replace |  | edit | 1 | 5.7 | 4527 | 5 | 5 | 4 / 1 / 0 / 0 |  |  |
| 95c93e3d | 2-R7 | additive |  | edit | 1 | 5.8 | 4517 | 5 | 5 | 4 / 1 / 0 / 0 |  |  |
