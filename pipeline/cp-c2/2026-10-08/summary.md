# CP-C2, revise turns on the real machine (2026-10-08)

Server http://127.0.0.1:3231; planner via the recording proxy to http://127.0.0.1:11555 (own Ollama, ctx 16384). GPU at start 2253 MiB. Pending ops = the live edit card before the turn; judged by value against the card after.

## Stop lines

- PASS context refusals 0; prompt tokens on revise turns p50 4871 p95 5403 max 5464 over 26 planner calls (stop on any refusal or p95 over 8000)
- PASS pending ops missing from both the merged plan and REMOVED: 0 of 19 revise cards (stop on any)
- STOP additive revisions dropping a pending op: 5 of 11 (stop over 3 of 10)
- PASS revise turns failing: 2 of 21 (stop over 2 of 12)

Prompt tokens on every turn (fresh plans too): p95 5403, max 5464.

## Turns

| song | turn | kind | mark | reply | attempts | run s | prompt tok | pending | merged | kept / changed / removed / new | lost | note |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ecf8eb5a | 0-F0 | fresh |  | edit | 2 | 16.4 | 4305 4472 | - | 2 | - |  |  |
| ecf8eb5a | 0-R1 | additive |  | edit | 1 | 5.7 | 4781 | 2 | 1 | 0 / 0 / 2 / 1 |  |  |
| ecf8eb5a | 0-R2 | additive | yes | edit | 1 | 21.0 | 4737 | 1 | 1 | 0 / 0 / 1 / 1 |  |  |
| ecf8eb5a | 0-R3 | fewer |  | failed | 3 | 7.6 | 5231 5317 5403 | 1 | - | - |  | the revision drops every op: keep a pending op or return one |
| ecf8eb5a | 0-R4 | additive |  | edit | 2 | 12.6 | 5245 5402 | 1 | 1 | 0 / 0 / 1 / 1 |  |  |
| ecf8eb5a | 0-R5 | over6 |  | edit | 1 | 12.0 | 4817 | 1 | 4 | 1 / 0 / 0 / 3 |  |  |
| ecf8eb5a | 0-R6 | replace |  | edit | 1 | 6.0 | 5211 | 4 | 1 | 0 / 0 / 4 / 1 |  |  |
| ecf8eb5a | 0-R7 | additive |  | edit | 1 | 6.0 | 4663 | 1 | 2 | 1 / 0 / 0 / 2 |  |  |
| a69541f2 | 1-F0 | fresh |  | edit | 2 | 18.4 | 4609 4790 | - | 2 | - |  |  |
| a69541f2 | 1-R1 | additive |  | edit | 1 | 5.9 | 5056 | 2 | 3 | 2 / 0 / 0 / 1 |  |  |
| a69541f2 | 1-R2 | additive | yes | edit | 1 | 9.3 | 5244 | 3 | 4 | 3 / 0 / 0 / 1 |  |  |
| a69541f2 | 1-R3 | fewer |  | edit | 1 | 5.2 | 5306 | 4 | 3 | 3 / 0 / 1 / 0 |  |  |
| a69541f2 | 1-R4 | additive |  | edit | 1 | 8.1 | 5178 | 3 | 1 | 0 / 0 / 3 / 1 |  |  |
| a69541f2 | 1-R5 | over6 |  | edit | 1 | 12.0 | 5061 | 1 | 4 | 1 / 0 / 0 / 3 |  |  |
| a69541f2 | 1-R6 | replace |  | edit | 1 | 5.7 | 5464 | 4 | 1 | 0 / 0 / 4 / 1 |  |  |
| a69541f2 | 1-R7 | additive |  | edit | 1 | 6.7 | 4984 | 1 | 1 | 0 / 0 / 1 / 1 |  |  |
| 95c93e3d | 2-F0 | fresh |  | edit | 1 | 22.5 | 3852 | - | 2 | - |  |  |
| 95c93e3d | 2-R1 | additive |  | edit | 1 | 6.0 | 4706 | 2 | 3 | 2 / 0 / 0 / 1 |  |  |
| 95c93e3d | 2-R2 | additive | yes | edit | 1 | 23.2 | 4871 | 3 | 3 | 3 / 0 / 0 / 1 |  |  |
| 95c93e3d | 2-R3 | fewer |  | edit | 1 | 5.6 | 4769 | 3 | 2 | 2 / 0 / 1 / 0 |  |  |
| 95c93e3d | 2-R4 | additive |  | say | 2 | 8.1 | 4218 4357 | 2 | - | - |  | This song does not have a verse section; it has an intro, chorus, and interlude instead. |
| 95c93e3d | 2-R5 | over6 |  | edit | 2 | 19.0 | 4228 4411 | 2 | 3 | 0 / 0 / 2 / 3 |  |  |
| 95c93e3d | 2-R6 | replace |  | edit | 1 | 6.2 | 4466 | 3 | 1 | 0 / 0 / 3 / 1 |  |  |
| 95c93e3d | 2-R7 | additive |  | edit | 1 | 6.4 | 4230 | 1 | 2 | 1 / 0 / 0 / 2 |  |  |
