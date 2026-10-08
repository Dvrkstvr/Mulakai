# CP-C2, revise turns on the real machine (2026-10-08)

Server http://127.0.0.1:3241; planner via the recording proxy to http://127.0.0.1:11565 (own Ollama, ctx 16384). GPU at start 2269 MiB. Pending ops = the live edit card before the turn; judged by value against the card after.

## Stop lines

- PASS context refusals 0; prompt tokens on revise turns p50 5100 p95 5428 max 5554 over 31 planner calls (stop on any refusal or p95 over 8000)
- PASS pending ops missing from both the merged plan and REMOVED: 0 of 18 revise cards (stop on any)
- PASS additive revisions dropping a pending op: 0 of 11 (stop over 3 of 10)
- PASS revise turns failing: 1 of 21 (stop over 2 of 12)

Prompt tokens on every turn (fresh plans too): p95 5428, max 5554.

## Turns

| song | turn | kind | mark | reply | attempts | run s | prompt tok | pending | merged | kept / changed / removed / new | lost | note |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ecf8eb5a | 0-F0 | fresh |  | edit | 2 | 17.1 | 4315 4482 | - | 2 | - |  |  |
| ecf8eb5a | 0-R1 | additive |  | edit | 1 | 5.7 | 4811 | 2 | 3 | 2 / 0 / 0 / 1 |  |  |
| ecf8eb5a | 0-R2 | additive | yes | edit | 1 | 11.0 | 4992 | 3 | 4 | 3 / 0 / 0 / 1 |  |  |
| ecf8eb5a | 0-R3 | fewer |  | edit | 2 | 10.2 | 5100 5325 | 4 | 3 | 3 / 0 / 1 / 0 |  |  |
| ecf8eb5a | 0-R4 | additive |  | edit | 2 | 15.7 | 4936 5112 | 3 | 4 | 3 / 0 / 0 / 1 |  |  |
| ecf8eb5a | 0-R5 | over6 |  | failed | 3 | 26.2 | 5142 5266 5390 | 4 | - | - |  | the revised plan has 7 ops; at most 6: drop pending ops or return fewer |
| ecf8eb5a | 0-R6 | replace |  | edit | 2 | 6.7 | 5128 5248 | 4 | 1 | 0 / 1 / 3 / 0 |  |  |
| ecf8eb5a | 0-R7 | additive |  | edit | 1 | 6.1 | 4698 | 1 | 2 | 1 / 0 / 0 / 1 |  |  |
| a69541f2 | 1-F0 | fresh |  | edit | 2 | 17.1 | 4619 4800 | - | 2 | - |  |  |
| a69541f2 | 1-R1 | additive |  | edit | 1 | 5.9 | 5085 | 2 | 3 | 2 / 0 / 0 / 1 |  |  |
| a69541f2 | 1-R2 | additive | yes | edit | 1 | 10.4 | 5273 | 3 | 4 | 3 / 0 / 0 / 1 |  |  |
| a69541f2 | 1-R3 | fewer |  | edit | 1 | 5.9 | 5331 | 4 | 3 | 3 / 0 / 1 / 0 |  |  |
| a69541f2 | 1-R4 | additive |  | edit | 1 | 8.1 | 5207 | 3 | 4 | 3 / 0 / 0 / 1 |  |  |
| a69541f2 | 1-R5 | over6 |  | failed | 3 | 27.2 | 5302 5428 5554 | 4 | - | - |  | the revised plan has 7 ops; at most 6: drop pending ops or return fewer |
| a69541f2 | 1-R6 | replace |  | edit | 2 | 6.6 | 5288 5408 | 4 | 1 | 0 / 1 / 3 / 0 |  |  |
| a69541f2 | 1-R7 | additive |  | edit | 1 | 5.2 | 4987 | 1 | 2 | 1 / 0 / 0 / 1 |  |  |
| 95c93e3d | 2-F0 | fresh |  | edit | 1 | 21.3 | 3862 | - | 2 | - |  |  |
| 95c93e3d | 2-R1 | additive |  | edit | 1 | 5.8 | 4755 | 2 | 3 | 2 / 0 / 0 / 1 |  |  |
| 95c93e3d | 2-R2 | additive | yes | edit | 1 | 23.5 | 4920 | 3 | 3 | 3 / 0 / 0 / 0 |  |  |
| 95c93e3d | 2-R3 | fewer |  | edit | 1 | 5.7 | 4818 | 3 | 2 | 2 / 0 / 1 / 0 |  |  |
| 95c93e3d | 2-R4 | additive |  | say | 2 | 7.5 | 4251 4386 | 2 | - | - |  | This song does not have a verse; it has an intro, chorus, and interlude. Would you like to change the lyrics of one of these sections instea |
| 95c93e3d | 2-R5 | over6 |  | edit | 1 | 11.2 | 4273 | 2 | 5 | 2 / 0 / 0 / 3 |  |  |
| 95c93e3d | 2-R6 | replace |  | edit | 2 | 6.4 | 4540 4663 | 5 | 1 | 0 / 1 / 4 / 0 |  |  |
| 95c93e3d | 2-R7 | additive |  | edit | 1 | 6.0 | 4275 | 1 | 2 | 1 / 0 / 0 / 1 |  |  |
