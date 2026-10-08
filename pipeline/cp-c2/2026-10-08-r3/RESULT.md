# CP-C2 r3 RESULT (2026-10-08): stop lines PASS; "forget all that" still keeps everything

Code: `fix/chat-revise-additive` 7c57db3 = r2's code + 390a7c8 (one `drop` line naming both cases: "forget" or "remove"
the X drops X, do not restate its old state; "forget all that" drops every pending op; an addition keeps every pending op,
drop []) + 7c57db3 (the additive-drop guard, `chat/reviseKeep.ts`: a request with no removal words whose reply drops a
pending op that no returned op replaces goes back once, "this request adds; keep every pending op: drop []"; a second drop
stands). Same songs and turn script as runs 1 and 2, a fresh copy of the owner's data (`E:\ai\tmp\cp-c2-r3`, deleted),
the same stack and ports as r2 (server :3241 restarted on this code, Ollama :11565 via proxy :11566, yue-server :8244).
Run 03:27 to 03:34 UTC. Afterwards :3241, :8244, :11565 and :11566 were not listening and VRAM was 2257 MiB; the owner's
:3001, :5173, :8001, :8004 and :11434 were still up and untouched. Everything below was *seen running*.

## Stop lines

- **PASS** No context refusals. Revise prompt tokens p50 5078, p95 5457, max 5583 over 27 calls (limit p95 8000).
- **PASS** No silent loss: 0 of 18 revise cards.
- **PASS** 0 of 11 additive revisions dropped a pending op, all on the first attempt: every additive reply had `drop []`,
  so the guard never fired (it is unit-tested only).
- **PASS** 1 of 21 revise turns failed (limit over 2 of 12): 2-R4, a correct "say" (Acid Houzzzz has no verse). The
  over-6 turns 0-R5 and 1-R5 (7 merged ops) got the named MAX_OPS refusal 3 times each, which counts as met.

## Per kind, against runs 1 and 2

| kind | run 1 | r2 | r3 |
| --- | --- | --- | --- |
| additive kept every pending op | 6 of 11 | 11 of 11 | 11 of 11 |
| fewer ("forget the jazz chords ... keep the rest") dropped just that op | 2 of 3 (1 failed after earlier drops) | 2 of 3 (1-R3 restated the old chords, failed) | 3 of 3 |
| replace ("forget all that, just transpose it down a tone") dropped everything | 3 of 3 | 0 of 3 | 0 of 3 |

The replacement turns answer `drop []` with a TRANSPOSE -2 that CHANGES the pending TRANSPOSE +1; the card shows CHANGED
TRANSPOSE and nothing REMOVED, so it is visible but not what was asked. No reply dropped and restated an op, so the SAME
fix (55329b0) was not exercised live; it is unit-tested.

*Inferred:* with the schema's `drop` written before `ops` and no reasoning, qwen3:14b holds one default for `drop`. The run-1
lines leaned to "drop what this reply replaces", these lean to "drop []", and a "start over" request loses. Smallest next
step: the mirror guard, a pure "starts over" word check ("forget all that", "start over", "from scratch", "instead of all
that") that sends a reply back once when its drop leaves pending ops that no returned op replaces ("this request starts
over: drop every pending op"), the same retry-once rule as reviseKeep.
