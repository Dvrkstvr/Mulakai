# CP-C2 r4 RESULT (2026-10-08): stop lines PASS; start over 3 of 3, fewer 3 of 3

Code: `fix/chat-revise-additive` 6f2c648 (rebased on origin/main 4950876, CV-1 merged) = r3's code + the start-over guard
(`chat/reviseKeep.ts`, D-250). That guard applies when the words start over ("forget all that", "start over", ...) and
the reply keeps a pending op it neither drops nor replaces. The reply then goes back once with "this request starts over:
drop every pending op"; a second keep would stand. Same songs, turn script and machine rules as runs 1 to 3. The stack:
server :3241 on this code, `DATA_DIR` a fresh copy under `E:\ai\tmp\cp-c2-r4` (deleted), Ollama :11565 via the proxy
:11566, yue-server :8244 in WSL (`~/yue-data-cp2r4`, deleted). Run 03:40 to 03:47 UTC. Afterwards :3241, :8244, :11565
and :11566 were not listening and VRAM was 2261 MiB. The owner's :3001, :5173, :8001, :8004 and :11434 were left alone.
Everything below was *seen running*.

## Stop lines

- **PASS** No context refusals. Revise prompt tokens p50 5100, p95 5428, max 5554 over 31 calls (limit p95 8000).
- **PASS** No silent loss: 0 of 18 revise cards.
- **PASS** 0 of 11 additive revisions dropped a pending op. Every additive reply had `drop []` on its first attempt, so
  the keep guard never fired.
- **PASS** 1 of 21 revise turns failed: 2-R4, a correct "say" (Acid Houzzzz has no verse). The over-6 turns 0-R5 and
  1-R5 (7 merged ops) got the named MAX_OPS refusal and count as met. 2-R5 made a 5-op plan.

## Per kind

| kind | run 1 | r2 | r3 | r4 |
| --- | --- | --- | --- | --- |
| additive kept every pending op | 6 / 11 | 11 / 11 | 11 / 11 | 11 / 11 |
| fewer dropped just the first chorus's chords | 2 / 3 | 2 / 3 | 3 / 3 | 3 / 3 |
| start over ("forget all that, just transpose it down a tone") dropped everything | 3 / 3 | 0 / 3 | 0 / 3 | 3 / 3 |

- Each start-over turn took 2 attempts. The first reply was `drop []` with TRANSPOSE -2, and the guard sent it back. The
  second dropped every other pending op and replaced TRANSPOSE in place. The card shows CHANGED TRANSPOSE, and the rest
  are REMOVED. Run time was 6-7 s per turn.
- 0-R3 "fewer" took 2 attempts. The first reply restated the chorus's chords instead of dropping them and was refused.
  The second was `drop [2]`.
- 2-R7 returned the pending TRANSPOSE -2 unchanged next to SET_TEMPO 80 and did not drop it, so the merge kept it SAME.
