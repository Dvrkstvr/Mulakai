---
paths:
  - "server/src/services/chat/**"
  - "server/src/routes/chat*.ts"
  - "server/src/db/chatSchema.ts"
  - "server/test-fakes/chatScripts.ts"
  - "server/scripts/chatCp*.ts"
---

# Chat — server: marks, analysis, revise (C1, C2, RT)

Spec: architecture.md "Chat (C1)" (ADR 0009), "Chat (C2)" (ADR 0010); the
general chat-server rules are in `chat-server.md`.

- C1 (architecture.md "Chat (C1)", docs/decisions/0009): a version analysis
  reuses `readingSteps`; `analysis_json` (`analysis_v`) is read from the raw
  blob. One rule (`barShift`) says whether bars moved; the mark is a
  `planReferent` `range`, resolved at SEND and at the turn's start, never
  remapped (stale → 409 or a failed line before the planner loads).
- An analysis never stales or refuses a commit: `pendingEdit` counts only
  `EDIT_KINDS` (D-173). A reading step that ran and read nothing is
  `failed` with its reason and RETRY, never `done` (D-200).
- Bars move only by what `basedOn` proves; a version without it moved by an
  unknown amount (D-199). Across a SET TEMPO a mark is stale until the new
  bar times are read.
- A seconds-only mark is snapped to bars at SEND (`markSnap`, D-195); with a
  mark, whole-song ops are refused unless the words ask for the whole song
  (`asksWholeSong`, D-201).
- Retries reuse attempt 1's messages, refused reply shortened (#225); re-run
  `chatCp1 --marks` (p95 stop 6000) after any prompt or MARK-block change.
- C2 (ADR 0010): revise only via `turnRevise` → `readRevise`/`mergeRevise`,
  never a full restatement; block pairing only in `score/lyricPairing.ts`;
  UNDO TURN restores only untouched fields. An op returned unchanged twice
  stands as SAME (D-254) except on a start over, where it is dropped and an
  empty plan retires the card as `scrapped` (D-257, D-258, `replyCheck`).
- RT-5 (D-248): RE-TIME replaces the stored reading in place (new `readAt`, `retime.previous` for UNDO), bars on the re-timed downbeats, never re-fitted; a bars mark whose `readAt` differs from the playable reading's is stale.
- RT-6 (D-275, D-280): a chat RETIME is an edit op, alone in a plan, offered only when there is something to re-time; where it goes is decided only by `routeRetime` (dock vs reading vs SET TEMPO within 8 %). The planner's HALF/DOUBLE direction is unreliable for wrong-way words: fix in code (D-289 refusal names the other mode), not more prompt rules. An undone re-time stays in the history as `[UNDONE …]` (D-287); UNDO TURN identity is `readAt`/`asReadAt` (D-279).
