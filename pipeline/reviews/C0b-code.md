# C0b code review (edit turn, splice, versions) — lens: code

Range: #177 (1b64002) and #181 (6c3b16a, supersedes #173/#178). Read in the worktree; no tests run, app not driven. Evidence: seen in code.

## blocking
None found.

## should
None found.

## nit
1. **Two concurrent APPLY POSTs for one card leave the card EXPIRED, not done** · server/src/services/chat/editCommit.ts:56-73. `applies.set` and the `running()` guard come after `await checkRender`, so two requests (two tabs; one tab is guarded by the client's `open()`) both start a job. `updateMessage(card.id, {jobId})` keeps the second job's id, but `landed` closes over the first job's id, so the version card's `jobId` does not match the card's (messageView.cardState) and the plan is gone (dropPlan), so the card reads EXPIRED. The second job fails at its re-check (plan dropped), harmless. Fix: set `applies` (a placeholder) before the first await.
2. **"Every exit ends the yue splice job so its temp files go with it" is not so for a finished job** · server/src/services/chat/spliceRenderJob.ts:8,140 vs yue-server/jobs.py:100-110. `store.cancel` on a terminal job is a no-op; the spliced WAV and grids stay until the retention sweep. Cancel only stops a queued or running splice. Behaviour is fine (retention cleans up); fix the header comment, or add nothing.
3. **Version numbers on a stored version card go stale** · spliceRenderJob.ts:baseFile (`ids.indexOf + 1`) vs the card body stored once. After an older version is deleted in the Editor, `previous.number` / `number` in the thread still show the old vN while the Editor renumbers. Only `previous` existence is re-checked at view time (withPrevious). Low impact; note for F-048's edge.

## checked, no finding
- **GPU hand-off:** the edit turn applies its ops on yue-server inside the planner slot (turnJob), then unloads; APPLY is a `scoreRender` job whose own `checkRender` refuses while a planner is loaded. The render, the splice and the save share one slot; the planner and YuE2 never overlap.
- **ABC invariant:** TypeScript only passes `source.abc` / `plan.abc` through to `/v1/splices`; eligibility reads the facts yue-server returned. No ABC parsing in the new TS.
- **Fallbacks (D-101, D-161):** `rerender` verdict, `SpliceRefused` (422/409), truncated render (verdict `render_truncated`) each save the whole render with the reason; a failed splice or a cancel saves nothing and the card returns to pending (plan kept, dropped only on save). Splice uses `splice-<jobId>` as the Idempotency-Key (D-166's 409 fix); CANCEL of a running APPLY sets `job.cancelled`, and a cancel during the save reads ABORTED_AFTER_SAVE with the version card following.
- **Wire contract:** `/apply` 202 `{jobId}` / 409 `{reason, stale}`, `phase` values, EditBody / VersionCardBody shapes match between server and client (`chatEdit.ts`, `chatCommit.ts`); the stale card state and the BACK TO pill (`abPrevious`) follow the active version.
