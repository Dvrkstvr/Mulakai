---
paths:
  - "server/src/services/chat/**"
  - "server/src/routes/chat*.ts"
  - "server/src/db/chatSchema.ts"
  - "server/test-fakes/chatScripts.ts"
  - "server/scripts/chatCp*.ts"
---

# Chat — server

Spec: scope.md "Scope — Chat" (C0 = F-041..F-050); modules, data and seams:
`pipeline/architecture.md` "Chat (C0)" and "Chat (C3)" (reference songs). Mockups:
`pipeline/design/chat-*.html`.

- A turn is one `plan`-kind job (`turnJob`): one load, ≤ 3 attempts, and
  `releasePlanner` in `finally` on every path before the slot is released
  (D-011, docs/decisions/0006). Never add a second load or unload per turn.
- How many model calls a turn makes (SP-5's ladder) lives only in
  `turnCall.ts` (+ `turnActions.ts` for state-allowed actions).
- Deciding logic stays pure: `draftModel`, `recipeRules`, `draftFields`,
  `songState`, `turnPrompt`, `turnActions`, `actionSchema`, `replyCheck`,
  `turnAttempts`, `turnCall`, `turnDispatch`, `messageView`,
  `spliceEligibility`, `versionCard`. Tests first; break each once.
- Reuse, never copy, the score agent: `opsArraySchema`, `checkOps`,
  `applyOps`, `withLimits`, `applyReasons`, `retryMessages`, `phraseLines`,
  `contextGuard`, `ollamaControl`, `planBuild`, `checkRender`,
  `scoreRenderRun`, `persistScoreVersion`. A chat edit plan is a
  `planStore` plan.
- The reply schema has no ABC field (docs/decisions/0002); the model never
  writes a score.
- Recipe and CREATE SONG rules live only in `recipeRules.ts`; the client
  shows the server's `blockers`.
- A cancel sets `job.cancelled` when it aborts; the cancelled reply is
  written only after the unload, so SEND / RETRY stay refused (409
  TURN_OPEN) while the turn is still in `turns` (D-121).
- A take cut at the cap reads TRUNCATED on the song card, never DONE (D-025).
- A failed turn changes nothing (no draft write, no proposal); a field the
  person touched after SEND is skipped and named.
- Proposals live in memory (`proposalStore`, `planStore`); threads, messages
  and the draft in SQLite with `draft_v` / `chat_v` (docs/decisions/0007).
- A splice that cannot be aligned saves the whole render, labelled (D-101,
  D-109); never a silent splice. Cancel stops a queued or running yue splice
  job; a finished one's files stay until yue-server's 24 h sweep, so no copy
  may claim they were deleted.
- APPLY takes its per-thread guard before the first await (two tabs, #185).
  An APPLY that ends unsaved clears the edit card's job id; after a restart a
  card still holding an unknown id reads INTERRUPTED (ASK AGAIN, the plan is
  gone), any other reads EXPIRED (D-169).
- C3 references: one `transcribe`-kind reading job holds one slot through
  WORDS > SCORE > CAPTION (docs/decisions/0008); never a new queue kind. READ,
  CREATE SONG and CREATE COVER all pass `gpuGuard` (no planner loaded).
- A reading part that fails or is unset is `not read: <why>`, never empty or
  guessed; borrowed fields come from `readingFacts` in code
  (`referenceRecipe`), never from the model's values (F-064).
- Borrowed facts prefer the transcribed score; the caption only fills gaps; a
  cover is score-only (D-165: ACE-Step's caption tempo drifts run to run).
- Cover vs borrow routing is the REFERENCE rule's wording, not the key order
  (D-162); measure any change to it with `chatCp3` before merging.
- `Reading` (`reading_v`) and `own_json` (`own_v`) are read from the raw blob;
  reference files are removed only by `sweepFiles()` (orphans by id).
- C1 (architecture.md "Chat (C1)", docs/decisions/0009): a version analysis
  reuses `readingSteps`; `analysis_json` (`analysis_v`) is read from the raw
  blob. One rule (`barShift`) says whether bars moved; the mark is a
  `planReferent` `range`, resolved at SEND and at the turn's start, never
  remapped (stale → 409 or a failed line before the planner loads).
- C2 (docs/decisions/0010): a revise is the score agent's `readRevise` /
  `mergeRevise` through the chat turn, decided by `turnRevise` (live card +
  same fingerprint); never a complete-plan restatement. Section-to-block
  pairing only via `score/lyricPairing.ts`. UNDO TURN restores only fields
  still holding that turn's value with no hand edit after it.
