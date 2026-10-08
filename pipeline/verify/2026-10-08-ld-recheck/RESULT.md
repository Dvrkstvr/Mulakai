# LD live re-check (F-095 / F-096), 2026-10-08, branch fix/lyrics-keep = 282b032 (origin/main incl. #252 D-251 + #253 D-252)

Stack: Ollama 0.32 (owner's tray app) on :11434, no model loaded at start; server from the agent-ab43 worktree on :3301
(LLM_API_URL = my counting proxy :11437 -> :11434, LLM_MODEL=qwen3:14b, DATA_DIR=E:\ai\tmp\ld-recheck\data, no yue/ACE-Step).
Driven over HTTP with `run.py` (reuses ld-live drive.py: 0.5 s sampler of /api/ps, nvidia-smi, queue). `proxy.py` logs every POST to Ollama:
`completions` = a real model call (C), `generate` with empty prompt + keep_alive 0 = an unload (U). Raw per-turn json: raw/S_*.json (r* = the
counted run; de* = an earlier run whose proxy only counted unloads, so its call counts are wrong and are ignored, its bpm/lyrics/card columns are valid).
Every follow-up is the FIRST send after the new-song chat (a fresh chat each time).

## Follow-ups (counted run, raw/S_r*_fu.json)
| chat / follow-up | card | real calls | models | lyrics | bpm | secs |
|---|---|---|---|---|---|---|
| r1 DE Bahnhof / "mach es etwas schneller" | recipe | 1 | qwen3 only | KEPT | 60 -> 75 | 9.6 |
| r6 DE Regen im Herbst / same | recipe | 1 | qwen3 only | KEPT | 60 -> 80 | 10.6 |
| r2 DE Rocksong Sommerreise / same | recipe | 2 | qwen3 + gemma4 | REWRITTEN (7 identical Outros) | 120 -> 140 | 69.5 |
| r3 DE Bahnhof / "etwas schneller bitte, Text unverändert" | recipe | 2 | qwen3 + gemma4 | REWRITTEN (7 identical Outros) | 60 -> 70 | 78.7 |
| r4 DE Bahnhof / "schreib den Refrain neu" (must write) | recipe | 2 | qwen3 + gemma4 | rewritten, as required | 60 -> 60 | 59.5 |
| r5 EN indie road trip / "make it faster" | recipe | 1 | qwen3 only | KEPT | 120 -> 140 | 9.0 |
Earlier run (de*, same method, valid except calls): "mach es etwas schneller" kept in de1, de2, de4(keep wording), de6; rewritten in de3. Totals over both runs for the
plain German "mach es etwas schneller" on the first send: 7 chats, kept 5 (1 call, ~9-10 s, no gemma4 load), rewritten 2 (r2, de3).
"There is no song to change yet" occurred 0 times in 18 first-send follow-ups (was 3 of 3 before D-251): F-095 line 2 FIXED.

## Why the 3 misses (r2, r3, de3): planner, not the keep rule
In every miss qwen3:14b answered the follow-up recipe with the SAME language but a structure that grew to `Intro, Verse, Chorus, Verse, Chorus, Bridge, Chorus,
Outro x7` (the first send had `... Chorus, Outro`; `changed` = bpm, structure, lyrics). A changed structure makes `lyricsFit` false, so code correctly goes to
the write path, gemma4 loads (+~60 s incl. cold-ish load) and the lyrics come out with 7 identical "Nur noch weisse Stille" Outro blocks (a repeated-token loop
in the planner's structure array, reproduced on 3 different chats and both wordings, all on the 8-section Intro/.../Outro layout). Not seen in the 4 keeps, which had other
layouts. The user-visible result is worse than a rewrite: a degenerate song structure. Candidate fix (not done, verifier does not fix): on a follow-up, if the
recipe's structure differs from the draft's only by repeats of one trailing tag, or if the request does not ask for structure, keep the draft's structure
(code-side, like keep-vs-write); or cap repeated adjacent tags in `recipeRules`.

## /api/ps and GPU
`{"models": []}` read 1.5 s after the job reached `done` on all 24 counted/uncounted turns (ps_after in every S_*.json); at the end, /api/ps empty and the GPU at 1.65 GB
(idle baseline of this machine). VRAM peak 15.9 GB on a German write turn, 11.2 GB on a keep turn.
Per-turn model-call order on a write turn (r1_first): completions qwen3, unload qwen3, completions gemma4, unload qwen3 (final), unload gemma4 (final).
First-send German turns: 20-66 s (the first ever, with cold gemma4: 121-146 s in the earlier run, mostly load from disk).

## chatCp3: NOT RUN
`server/scripts/chatCp3.ts` is not runnable without the owner. It needs: (1) a DATA_DIR copy of the owner's library (`--yue2 <songId>` one YuE2 song,
`--ace <id>,<id>` two ACE-Step songs, `--named-title <title>`, `--upload <audio file>`; none exist in a fresh DATA_DIR, and reading the owner's DB was
refused by the permission layer), (2) yue-server with SheetSage2, lyrics-server (`LYRICS_API_URL`) and ACE-Step (`ACESTEP_API_URL`, CAPTION), (3) a GPU idle
for the whole run (it waits on `gpuIdle`, takes ~1 h), (4) `--owner http://127.0.0.1:3001` optional. Stop lines (chatCp3Stats.stopLines): reading max short step
<= 240 s, follow-up p50 <= 15 s with the planner off the GPU, score ok on >= 2 of the audio files, `reference_use` right on >= 80 % of judged wordings,
worst GPU-sample gap <= 5 s. The owner's call: provide the three song ids (or say to use the library copy) and the services, then it is one command:
`npx tsx scripts/chatCp3.ts --server http://127.0.0.1:3401 --out pipeline/cp-c3/<date> --ollama http://127.0.0.1:11434 --yue2 <id> --ace <id>,<id> --upload <file> --named-title <t>`.
D-251 owes it (draft prompt changed); D-252 removed the `lyrics` field from the recipe schema, so the REFERENCE/cover rules' lyrics text also changed.

## Acceptance
F-095
- A follow-up that keeps the lyrics makes one call: PARTIAL. 1 call, qwen3 only, lyrics identical, bpm higher in 5 of 7 plain German + 1 of 1 English + 1 keep-wording (de4);
  FAIL in 2 of 7 plain and 1 of 2 keep-wording German chats because the planner inflates the structure to Outro x7 (above).
- First follow-up on a draft is a recipe card, never the no-song redirect: PASS (0 of 18).
- "schreib den Refrain neu" writes (2 calls, gemma4): PASS.
- English keep, 1 call: PASS.
F-096: /api/ps empty after every turn: PASS (24 of 24). German new-song first sends, counted run: 43.5, 51.0, 47.4, 53.9, 66.6 s (r6 over the 60 s bar; the model switch load dominates); keep follow-ups 9-11 s. chatCp3: not run. features.json not edited (F-095 stays failing).
