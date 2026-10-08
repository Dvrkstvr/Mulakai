---
paths:
  - "client/src/Chat*.tsx"
  - "client/src/chat*.ts"
  - "client/src/useChat*.ts"
  - "client/src/api/chat.ts"
  - "client/src/api/chatEdit.ts"
---

# Chat — client

Spec: `pipeline/design/chat-create.html`, `chat-song.html`, `chat-lyrics.html`
(frame 3 is final: the player above the composer, D-095), scope.md "A turn,
end to end"; modules in `pipeline/architecture.md` "Chat (C0)".

- The app starts on the Library (D-119); CHAT is one click away only when
  the server says the chat is configured (`chatEntry`).
- Check a chat screen against the real server's responses before handing it
  over, not a stub: GET /api/songs/:id sends no `audio_file`, the player plays
  the base layer's active take (D-120).
- One draft store (`chatDraftStore`, D-086): C6's Guided Create reads it too.
  Never re-implement recipe rules here; show the server's `blockers`.
- Message and turn states go only through the `chatTurn` reducer, the analyze
  and reading cards' through `chatReading`; chat copy lives only in
  `chatCopy.ts`, C3's in `chatReferenceCopy.ts` (both near the cap, D-136)
  and C0b's edit and version cards' in `chatEditCopy.ts`. A card's commit
  (CREATE SONG, APPLY) goes through `chatCommit` (re-exported by `chatTurn`).
- `chatStore.ts` is at the 200-LOC cap: polling lives in `chatPoll.ts`.
- The send control is the outline text button `SEND ↵`, never a play-like
  glyph. CREATE SONG / APPLY live on the proposal card only, with the
  consequence line above them; their labels never turn into progress.
- Fields stay editable while a turn runs.
- Reuse the Editor's pieces (`Player`, `useSingleAudioPlayback`,
  `ScorePlanList`, `scoreCopy`) instead of copies.
- A/B (reference now, versions in C0b) goes through `chatAb` and
  `useChatPlayback`; never a second player or a second clamp.
- C1: the reading line and strip states go only through `chatAnalysis`, mark
  geometry and `markStale` through `chatMark`, mark copy in `chatMarkLabel`.
  WHAT IT SEES shows the server's preview, never a client-built prompt.
- The strip shows only the bars the audio holds; the line count comes from
  the server's `readingLines` (one source with the strip, D-197).
