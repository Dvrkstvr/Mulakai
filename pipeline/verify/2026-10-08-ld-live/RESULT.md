# LD live run (F-095 / F-096), 2026-10-08, branch test/ld-live = 94562cc (origin/main, LD-2 #246)

Machine: RTX 4080 16 GB, idle 1.2-1.4 GB used. Stack started by the verifier, all stopped after:
Ollama 0.32.15 on 127.0.0.1:11435 (OLLAMA_MODELS=E:\ai\ollama\models, OLLAMA_CONTEXT_LENGTH=16384), yue-server (WSL Ubuntu-24.04, real YuE2) on :8004,
server :3001 (LLM_API_URL=:11435, LLM_MODEL=qwen3:14b, DATA_DIR=E:\ai\tmp\ld-live\data), client :5173. ACE-Step not started (not needed).
Models present: qwen3:14b, gemma4:26b-a4b-it-q4_K_M, gemma3:12b (nothing pulled). Driven over the HTTP API with `drive.py` (0.5 s sampler of
job status/progressText, /api/ps, nvidia-smi, /api/generate/queue); the German turn was also run through the UI (browser pane): recipe card appears,
progress line read "THINKING... attempt 1 of 3 · writing lyrics · gemma4". Raw per-turn json (timeline, thread, draft): raw/*.json.

## Turns (seconds = SEND to job done; steps from Ollama log + sampler)
| turn | total | recipe call (qwen load+call) | lyrics call | models after | VRAM peak |
|---|---|---|---|---|---|
| DE run1 (first, gemma4 not in page cache) | 35.3 | 10.3 | 23.8 gemma4 (load+call) | /api/ps empty | 15.75 GB |
| DE run2 warm | 25.2 | 7.4 | 17.3 gemma4 | empty | 15.73 |
| DE run3 warm | 25.6 | 7.1 | 18.0 | empty | 15.74 |
| DE run4 warm (CREATEd) | 22.2 | 6.8 | 14.9 | empty | 15.46 |
| DE run5 warm, UI | ~25 | 6.8 | 23.1 (log) | empty | not sampled |
| EN "upbeat indie road trip" | 15.6 | 6.9 (qwen load+call) | 8.2 qwen3 (same loaded model, no reload) | empty | 12.53 |
| ES "una balada sobre el mar" | 13.7 | 5.5 | 7.9 qwen3 | empty | 12.57 |

Sequence on German (sampler, run2): qwen3 in /api/ps 3.4-7 s -> planner unloaded (/api/ps empty, VRAM 1.5 GB) at ~8 s, BEFORE VRAM
climbs to 13-15.7 GB for gemma4 (load ~8-10 s of the lyrics call, gemma4 listed at 19.8 s) -> gemma4 unloaded, /api/ps empty, VRAM 1.4 GB, job done at
24.9 s. Calls per German turn: 2 (recipe on qwen3:14b, lyrics on gemma4), 1 attempt each, no retry in any run. English and Spanish: 2 calls on qwen3:14b,
one load, one release. Not measured: a fully cold disk cache (run1 is the closest; gemma4 was last used 4 days ago).
/api/ps was read 1.5 s after every job reached `done`: `{"models": []}` in all 14 API turns (and after the UI turn) (raw/*.json `ps_after`).

## Follow-up "mach es etwas schneller" on the German chat (run2, run3; plus a keep-wording variant)
- 1st send, both chats: 1 call (~5 s), reply `say`: "There is no song to change yet: describe the song you want and I will propose one." The recipe call
  answered `edit`, which turnDispatch redirects (no song yet). Nothing changed, lyrics untouched, tempo NOT sped up.
- 2nd identical send: recipe, bpm 60 -> 75, but 2 calls (qwen3 + gemma4, 24 s) and the lyrics were REWRITTEN (changed: bpm, lyrics). Not a one-call keep.
- "setz das Tempo auf 80 bpm, den Text lässt du unverändert": 1st send the same `say` redirect (1 call); 2nd and 3rd send: bpm 80 but again 2 calls and new lyrics.
- So the live planner (qwen3:14b) never returned `lyrics: "keep"` in 3 recipe follow-ups (inferred: structure was unchanged, so lyricsFit would have kept it; it is the
  model's `write`). The keep path is only covered by fakes. See raw/de2_followup*.json, raw/de3_fu*.json, raw/de3_keep*.json.

## CREATE SONG and the queue (German run4, raw/de4_queuetest.json, raw/de4_take.json)
CREATE was sent 3 s into a German follow-up turn (qwen3 already in /api/ps): accepted (202), queue showed run=plan, queued=[generate]. The take started
only at 4.5 s, after the turn's job was done and /api/ps/VRAM were back to 1.1 GB; yue-server logged the job queued+started at 13:18:08, right then. YuE2 render:
planning 0 s, semantic 12 s, synthesis 79 s, decode 110 s, saved 119 s (VRAM 9.0-10.25 GB); song "Abschied am Bahnhof" 228 s long, layer Base, no failure.
(Side note: that follow-up turn itself ended as the `say` redirect, so the song was made from the run4 recipe card.)

## "Mulakai" and prompt words
None of the 7 lyric sets contains "Mulakai", a section tag, "prompt", "json" or "lines" (scan per set in raw/lyrics.md). The refusal-and-retry of such a lyric did not
occur live and cannot be provoked on demand; it is covered by the server fakes (`vitest run src/services/chat/lyrics* turnLyrics turnCall`: 8 files, 74 tests pass).

## Acceptance
F-095
- English recipe: 2 calls, one model, one release: PASS (live).
- German: 2 calls on 2 models, planner unloaded before gemma4 loads, /api/ps empty before the slot is released on success: PASS (live). Check failure, cancel, unload timeout: NOT run live (fakes only).
- A follow-up that keeps the lyrics makes one call: FAIL live (see above; qwen3 asked for a rewrite every time, the one-call turns were the `say` redirect, not a keep).
- Prompt-only word refused and retried: not exercised live (no occurrence); fakes pass.
F-096
- German turn <= 60 s warm: PASS (22-26 s warm; 35 s on the first, coolest run).
- No model in /api/ps after any turn: PASS (14/14 API turns + UI turn).
- Queued YuE2 take starts only after the slot is released: PASS (queue order and timestamps above) and it rendered (228 s song in 119 s).
- Owner reads the German lyrics as usable: OWNER'S CALL. Verbatim in raw/lyrics.md (all three languages, plus 4 more German drafts). Verifier's note only: the German is
  singable and on topic but has weak lines ("Verliert uns im fahlen Mondschein-Lohn", "Dein Abschied ist wie ein tiefer Ton"), and the 5-line
  verses of runs 2 and 4 against 4-line verses elsewhere.

## Findings for the conductor
1. Follow-up that should keep the lyrics rewrites them with gemma4 (24 s) - the keep path never fires with qwen3:14b.
2. A first follow-up on a draft chat is answered "There is no song to change yet" (planner picks `edit`), reproduced 3 of 3; the resend works. Likely a prompt/state issue in the chat rules for a draft with a card.
3. The turn-cost copy ("~35 s" German) was not checked in the UI.
4. Strays: running `ollama list` at the start launched the Ollama tray app + server (PIDs 55680, 44592, 11434, started by me, idle, no model). Stopping them was refused by the
   permission layer, so they are still running; I used my own Ollama on :11435. Stop them or leave them as the owner prefers. All other processes were stopped; GPU back to ~0.96 GB.
