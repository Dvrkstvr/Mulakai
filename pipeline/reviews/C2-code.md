# C2 code review (lens: code)

Scope: PRs #230, #235, #233, #237, #238, #240, #244, #249 as merged on origin/main (b265ac6) and open PR #248 (head c274dcd). Evidence: *seen in code*, plus one script run (the regexes of reviseKeep.ts from the PR head, run under tsx).
Counts: blocking 0 · should 1 · nit 2.

## should

- **should · server/src/services/chat/reviseKeep.ts:45 (PR #248) · the keep guard bounces a correct start-over reply.** `keepReason` stands down only when `asksToRemove(request)` is true, but `START_WORDS` accepts phrases that `REMOVE_WORDS`/`REMOVE_STEMS` do not contain. Run on the PR head: "never mind that, set the tempo to 90", "start again with a slower tempo", "von vorne, bitte 90 bpm", "desde cero, a 90 bpm" give `asksToRemove=false`, `startsOver=true`. The planner's right answer (drop every pending op, return SET_TEMPO) has drops no returned op replaces, so `keepReason` returns "this request adds; keep every pending op: drop []". That is the opposite instruction, it costs one of the 3 attempts, and the refusal lands in the card's `refusals`. The model may then keep every op and the start-over guard (still unspent) bounces it again. Fix: make `keepReason` return null when `startsOver(request)` (or add the START phrases to `asksToRemove`); add the four phrases as tests.

## nit

- **nit · server/src/services/chat/reviseKeep.ts:12-17 (PR #248) · `REMOVE_WORDS` switches the keep guard off for many additions.** It holds "just", "only", "no", "not", "cut", "less". "and also add a bridge, just 4 bars" is an addition, but the guard is skipped and the planner's habit of filling `drop` goes unchecked. The loss then shows under REMOVED (Q-050), so it is not silent. Fix if CP-C2 shows it: require a verb-like removal word, or drop "just/only/no/not".
- **nit · server/src/services/chat/lyricsPanel.ts:48 · a heard line can be empty.** `w.text.trim()` may be "", so a transcribed section lists a numbered, clickable, empty row and counts it in "n lines". Fix: filter out empty segments before numbering.

## Checked, no defect found

- Wire types: client `api/chatConverge.ts` against server `chat/convergeTypes.ts` (BarMap, PanelLine/PanelSection/LyricsPanel, RecipeUndo/Undone, undo result 200/409 and its codes, the message view's `undo` offer). They match field for field. `RecipeUndo.before` goes out raw with absent keys and the client reads it with `k in before`, so it is fine.
- UNDO TURN transaction (`routes/chat.ts` undoTurn plus `draftUndo`): better-sqlite3 runs it synchronously, so a hand edit PUT cannot interleave. A hand edit after the reply has `touched > undo.rev` and is kept. A later reply gives KEPT_LATER. A failed `writeDraft` throws and rolls back the `undone` write. The client flushes pending edits before the POST.
- Lyrics panel `textLine`: `lyricsSplit` indexes `text.split('\n')` after the CRLF fold, and `text` is returned in that same folded form. `alignLyrics` splits the same `text`, so the indexes agree. The client times lines with the shown version's own `wordTimings`, and a missing version degrades to untimed lines.
- Bar map against panel: both use the same label-occurrence count and `pairBlocks`/`sectionOf`. The map is built on the read's facts and the panel on audio-cut strip sections. The difference (a section past the audio) is clamped and documented.
- Revise merge (`mergeRevise` plus the PR #248 "back" branch): a dropped op returned unchanged becomes SAME in place, and the legend no longer lists it as dropped. No lost or duplicated op found in the cases traced (replace, supersede, split, restore).
- Reload state: `justFilled`/`recordRevs` rebuild the ASSISTANT marks from the body's `undo` record, and an undone turn clears them.
