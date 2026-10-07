# C3 code review (reference songs) — lens: code

Range: af5fced (#160 merge) .. origin/feat/chat-cr7b-cover-panel. Read in a scratch worktree; no tests run. Evidence: seen in code.

## blocking

1. **CANCEL on a reading card calls the wrong endpoint** · client/src/ChatThread.tsx:60-63 (`api.cancelJob` for stage `read`) vs server/src/routes/chatTurns.ts:74-86 and server/src/routes/generateStatus.ts:59-64.
   Stage `read` posts to `/api/generate/:jobId/cancel`, which only does `cancelQueued` and answers 409 (`ALREADY_STARTED`) for a running job; the client swallows the error.
   - Running reading (card shows CANCEL on WORDS > SCORE > CAPTION): the click does nothing. The job runs to the end, saves, and queues the follow-up turn. F-061's "cancel between steps" is unreachable from the UI.
   - Queued reading: the generic route removes it from the line, but `cancelReading` never runs. `readings` (readingJob.ts:130) keeps the job id forever, and `job.cancelled` is never set. The card reads FAILED "cancelled" instead of CANCELLED. `threadBusy` (readCommit.ts:37) then sees `readingOf(jobId)` as live, so every later READ or RE-ANALYZE in that draft thread answers 409 BUSY until the server restarts.
   - Fix: use `chatApi.cancelChatJob` (`/api/chat/jobs/:id/cancel`) for both stages. Test with a running reading; the client tests never exercise cancelCard.

## should

2. **A throwing `settle` leaks the live-reading entry and loses the reading** · server/src/services/chat/readingJob.ts:143-149. In the `finally`, `await deps.settle()` comes before `readings.delete(job.id)`. If `releasePlanner` throws ("still loaded"), the delete is skipped. Same permanent-BUSY effect as finding 1, and the finished reading is dropped (`setReading` is never reached). Fix: nest try/finally so `readings.delete` always runs, and let `settle` failure not discard a completed reading.

3. **A failed or cancelled READ leaves the analyze card stuck, and READ AGAIN is a different flow** · server/src/services/chat/readCommit.ts:93 (`if (card.jobId) 'already read'`), messageView.ts:analyzeState (job ended means `done`, whatever the outcome). Once READ is pressed the analyze card is `done` even if the reading failed (file gone, GPU guard refusing at its turn, cancelled). The only retry is READ AGAIN on the reading card, which uses `reread`: a new reading, no follow-up turn, so no cover or recipe proposal arrives. The person must retype the request. F-061/F-063 acceptance ("a cover card without typing again") fails after any failed read. Fix: either pass `after` (analyzeId and origin) through READ AGAIN when the failed card has `followUp: true`, or clear the analyze card's `jobId` when its reading fails.

## nit

4. **Cancel during the final settle is overridden** · readingJob.ts:150-157. `markAborted` sets status `failed`, but the body then does `job.status = 'done'` and `onRead`. The route said `{aborted:true}` and the follow-up turn still runs. Re-check `wasAborted(job)` after the `finally`.

5. **`referenceBlock` and `reading` pick the newest reference with a reading by row order, not the latest-read one** · songStateSource.ts:52. After RE-ANALYZE of an older reference, a later turn's REFERENCE block describes the newer reference. Harmless while one reference per thread is typical.

## checked, no finding

- **GPU hand-off:** `gpuGuard` runs at the click and again inside the reading's slot; the follow-up turn is queued FIFO behind the reading; `settle` confirms the planner is off. The planner and the reading never overlap.
- **`createFromDraft` cover path:** `coverBlockers` and `isRead` are re-checked at the click. The cover argument carries `reading.score.abc` and `source`. `landed` attaches the thread, so reference rows follow it to the song.
- **Wire contract (everything except cancel):** `references`, `ReadStart` 202/409, the bodies (`analyze`, `reading`, recipe `reference`), `progressText` beginning with the step name, and the message states (`reading`, `queued`, `thinking`) all match between `chatPoll`, `chatReading` and `messageView`.
