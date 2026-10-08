# CP-C2 RESULT (2026-10-08): STOP on the additive-drop line

Code: `test/chat-cp2` = `origin/feat/chat-c2-revise` 5d3dd40 (CV-1, PR #238 open) + `server/scripts/chatCp2*.ts`.
I started the whole stack and stopped it afterwards. The server ran on :3231 (`tsx src/index.ts` from this worktree) with
`DATA_DIR` set to a copy of `server/data` under `E:\ai\tmp\cp-c2` (the db copied by SQLite backup; deleted afterwards).
`ACESTEP_API_URL` pointed at a dead port (:8299) and `LYRICS_API_URL` was unset. The planner was my own Ollama on :11555
(qwen3:14b, `OLLAMA_CONTEXT_LENGTH=16384`), reached through the script's recording proxy on :11556. yue-server ran on
:8234 in WSL from this worktree (`YUE_DATA_DIR=~/yue-data-cp2`, deleted afterwards). The owner's :3001, :5173, :8001,
:8004 and :11434 were left alone. Before every turn the script checked that the GPU was idle, that the owner's app had
no job and that the owner's Ollama was empty. The run took 03:00 to 03:07 UTC. No APPLY was pressed.

Songs (YuE2, the same set as CP-C1): Cariñito `ecf8eb5a`, Gertar `a69541f2`, Acid Houzzzz `95c93e3d`. Each song got
one fresh plan followed by 7 revise turns: additive, additive under a chorus-2 mark, fewer, additive lyric rewrite,
over-6, replace, additive. That makes 21 revise turns. Everything below was *seen running*. The raw data is in
`turns.jsonl` (one line per turn: the pending ops, the mark, each planner reply) and `proxy.jsonl`; `summary.md` has the
table.

## Stop lines

- **PASS** No context refusals. Prompt tokens on revise turns: p50 4871, p95 5403, max 5464, over 26 planner calls.
  Fresh plans included: the same p95 and max. The limit was 8000.
- **PASS** No silent loss: 0 of 19 revise cards dropped a pending op without listing it. Every pending op was found
  by value in the merged plan, as the source of a CHANGED op, or in REMOVED.
- **STOP** 5 of 11 additive revisions dropped pending ops (stop over 3 of 10). The ops were listed as REMOVED, so the
  drop was visible but not what the person asked for. In each case the planner itself filled `drop`:
  - 0-R1 "and also transpose it up a semitone": `drop [1,2]`, so SET_TEMPO and REHARMONIZE 23-30 were REMOVED.
  - 0-R2 "do the same here: jazz chords" (chorus 2 marked): `drop [1]`, so TRANSPOSE was REMOVED.
  - 0-R4 and 1-R4 "also rewrite the lyrics of the second verse about the sea": `drop [1]` and `drop [1,2,3]`.
  - 1-R7 "and also slow it down to 80 BPM": `drop [1]` removed TRANSPOSE. The reply's message still says "transposed
    down a tone and slowed down", so the card's sentence contradicts its plan.
  - The 6 additive turns that kept everything: 1-R1, 1-R2, 2-R1, 2-R2, 0-R7, 2-R7.
- **PASS** 2 of 21 revise turns failed (stop over 2 of 12).
  - 0-R3 "fewer": refused 3 times with "the revision drops every op". The only pending op left was the one being
    removed, because 0-R1 and 0-R2 had already dropped the rest.
  - 2-R4: a "say" reply. Acid Houzzzz has no verse, so this one is correct.

## Other things seen

1. **Over-6 was never exercised.** The pending plans were already short because of the drops. The largest merged
   plan had 4 ops (0-R5, 1-R5), and in 2-R5 the planner dropped 2 to add 3. The MAX_OPS named refusal never fired on
   the real machine.
2. **An op dropped and restated reads as REMOVED + NEW.** In 0-R7 and 2-R7 the planner dropped TRANSPOSE -2 and
   returned it unchanged. The card marks it NEW and lists it under REMOVED, although the op is in the plan. The judge
   here counts it as kept by value.
3. **Turn length.** Revise turns ran 5-23 s and most took 1 attempt. Losses: none. Replacements (R6 "forget all that")
   were correct 3 of 3: everything REMOVED, then TRANSPOSE NEW.
4. *Inferred:* the cause is on the prompt side. qwen3:14b reads `drop` as "the ops this reply replaces" even when the
   request adds something. R-040's fallback (shorter PENDING lines) does not address this. A likely fix is a closing
   line that says "drop only what the request asks to remove; an addition keeps every pending op", or a check that
   refuses a `drop` on a request with no removal words. Neither was tried here: no code was changed.
