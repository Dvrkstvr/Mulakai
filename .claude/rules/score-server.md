---
paths:
  - "server/src/services/score/**"
  - "server/src/routes/score.ts"
  - "server/src/services/engines/yue2Score.ts"
  - "server/scripts/scoreCp1.ts"
---

# Score agent — server

Spec: PLAN.md "Score Agent"; module table: `pipeline/architecture.md`.

- Deciding logic lives in the pure modules (`opSchema`, `plannerRules`,
  `plannerPrompt`, `planAttempts`, `contextGuard`, `scoreLimits`,
  `scoreEligibility`): values in, answers out, no I/O, clock or DB. Write
  their tests first and break each module once on purpose to see a test
  fail.
- I/O modules stay thin (`plannerClient`, `ollamaControl`,
  `yueScoreClient`, `scoreSource`, `scoreStatus`, `planJob`,
  `scoreRenderJob`, `scoreVersion`), each with a fake in
  `server/test-fakes/`.
- `planJob` unloads (`keep_alive: 0`) and waits for `/api/ps` to be empty
  in `finally`, on success, failure and cancel alike, before the slot is
  released. Never shorten or skip it (D-011, D-041).
- APPLY & RENDER refuses while `/api/ps` lists a model, and re-checks
  eligibility, the base version and the plan at run time; each refusal is
  named and starts no engine job.
- Prompts show the bar map from yue-server, never the raw score.
- Planner calls send `reasoning_effort: "none"` and a strict JSON-schema
  `response_format` (docs/decisions/0001).
- `scoreSource` is the one reader of a song's score, style, lyrics and
  seed (always from the active base version).
- Refusal and limit texts live in `scoreLimits` / `contextGuard`; the
  dock's copy lives in `client/src/scoreCopy.ts`.
- A refusal the planner retries past is carried to the review
  (`Plan.refusals`, D-060): a retry never silently changes what the user
  asked (a moved phrase, a raised tempo).
- Limits mirrored from yue-server (`phraseSchema.ts`, `sectionSchema.ts`,
  `MAX_OPS`) are pinned by tests that read the Python models: change both
  sides; a drift is a 422 that the dock shows as PLANNER OFFLINE.
- Never ask the planner to repeat what stays: it drops it (CP3: a REVISE
  asked for a complete plan lost every other op). REVISE replies
  `{drop, ops}` and code merges into the pending plan (D-073).
- Every number in an op means the song as read (bars, sections, blocks,
  old key), whatever the op order; yue-server orders the ops (D-066).
- Pending plans live in `planStore` memory only (docs/decisions/0004).
- The render's `cot` comes only from `renderMode` (chords present or a
  REHARMONIZE → `full`, else `melody`); covers, instrumentals and chord-free
  scores are eligible from C3 (D-132). Never hard-code `cot: 'full'` again.
