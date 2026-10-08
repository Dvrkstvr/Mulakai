# CP-C2 r2 RESULT (2026-10-08): stop lines PASS, but "forget all that" now keeps everything

Code: `fix/chat-revise-additive` 7773d20 = `test/chat-cp2` 585bbff + 55329b0 (a dropped op returned unchanged is SAME) +
7773d20 (the chat's PENDING block: `drop` only for what the request removes, closing line "A request that adds ... keeps every
pending op: drop []"; the rules sentence the same). Same songs (Cariñito `ecf8eb5a`, Gertar `a69541f2`, Acid Houzzzz
`95c93e3d`) and the same turn script as run 1. Run 03:18 to 03:25 UTC. Everything below was *seen running*.

Stack, all mine and stopped afterwards: server :3241 (`tsx src/index.ts` from this worktree, `DATA_DIR` a copy of the
owner's `server/data` under `E:\ai\tmp\cp-c2-r2`, db by SQLite backup), `ACESTEP_API_URL` a dead port (:8299), no
`LYRICS_API_URL`; Ollama :11565 (`OLLAMA_CONTEXT_LENGTH=16384`, qwen3:14b) behind the script's recording proxy :11566;
yue-server :8244 in WSL from this worktree (`YUE_DATA_DIR=~/yue-data-cp2r`). The owner's :3001, :5173, :8001, :8004 and
:11434 were left alone; the script waited for an idle GPU, no owner job and an empty owner Ollama before every turn.

## Stop lines

- **PASS** No context refusals. Revise prompt tokens p50 5116, p95 5688, max 5769 over 29 calls (limit p95 8000).
- **PASS** No silent loss: 0 of 17 revise cards.
- **PASS** 0 of 11 additive revisions dropped a pending op (run 1: 5 of 11). Every additive reply had `drop []`.
- **PASS** 2 of 21 revise turns failed (limit over 2 of 12): 1-R3 and 2-R4 (a "say": Acid Houzzzz has no verse, correct).
  The two over-6 turns that hit MAX_OPS (0-R5: 7 ops, 1-R5: 8 ops) count as met: the named refusal fired 3 times each.

## The over-correction (no stop line, but a regression)

1. **Replacements 0 of 3** (run 1: 3 of 3). "forget all that, just transpose it down a tone" got `drop []` and a TRANSPOSE
   -2 that CHANGED the pending TRANSPOSE +1; every other pending op stayed (0-R6 3 kept, 1-R6 4, 2-R6 4). The card says
   CHANGED TRANSPOSE and nothing REMOVED, so it is visible, but it is not what was asked.
2. **1-R3 "fewer": failed 3 times.** Instead of dropping the first chorus's REHARMONIZE, the planner restated it as the
   "original" chords (`drop []`, a REHARMONIZE 15-22 replacing pending op 2), which yue-server's root check refused.
   0-R3 and 2-R3 dropped correctly.
3. The SAME fix was not exercised: no reply dropped and restated an op this time.

*Inferred:* the closing line now ends the PENDING block on "keeps every pending op: drop []", and qwen3:14b applies that to
removals too. Next (r3): one balanced `drop` line that names both cases, removal ("forget" / "remove" the X drops X,
do not restate it; "forget all that" drops every pending op) and addition (drop []), plus the additive-drop guard as a
safety net, with first-attempt drops recorded separately so the prompt's own effect stays visible.
