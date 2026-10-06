---
paths:
  - "client/src/Chat*.tsx"
  - "client/src/chat*.ts"
  - "client/src/useChat*.ts"
  - "client/src/api/chat.ts"
---

# Chat — client

Spec: `pipeline/design/chat-create.html`, `chat-song.html`, `chat-lyrics.html`
(frame 3 is final: the player above the composer, D-095), scope.md "A turn,
end to end"; modules in `pipeline/architecture.md` "Chat (C0)".

- CHAT is the start screen only when the server says the chat is configured
  (`chatEntry`, D-099); otherwise the Library, as the golden path expects.
- One draft store (`chatDraftStore`, D-086): C6's Guided Create reads it too.
  Never re-implement recipe rules here; show the server's `blockers`.
- Message and turn states go only through the `chatTurn` reducer; chat copy
  lives only in `chatCopy.ts`.
- The send control is the outline text button `SEND ↵`, never a play-like
  glyph. CREATE SONG / APPLY live on the proposal card only, with the
  consequence line above them; their labels never turn into progress.
- Fields stay editable while a turn runs.
- Reuse the Editor's pieces (`Player`, `useSingleAudioPlayback`,
  `ScorePlanList`, `scoreCopy`) instead of copies.
