# C0a code review (diff 41fa159...0ab70e1)

Method: read the server chat modules, routes and the client chat state/screen against F-041..F-045, F-049 (turn half) and the chat-server/chat-client rules. Evidence is *seen in code*; tests were not re-run (CI was green on each PR). No blocking findings.

## 1. should · server/src/routes/chatTurns.ts:205 + server/src/services/chat/turnJob.ts:138-149 + client/src/chatStore.ts:97-102 · CANCEL while thinking is read as a plain failure, and a quick resend is mis-attributed
`abortJob` calls `markAborted`, so the job's status is `failed` (no `cancelled` flag) immediately, while the turn body is still unloading the planner (`finally releasePlanner`, then `writeFailed`).
- Client symptom: `followTurn` polls (every 1.5 s) and sees `failed`, calls `settle(false)` -> `refetch(true)`. The cancel reply is not written yet, so `userState` returns `failed` (job failed, not cancelled), `fromServer` gives `{failed, 'the turn failed'}`, and the follow loop ends. The person who pressed CANCEL sees a failure line with RETRY instead of CANCELLED, until a reload (F-049 #1 wants a clean cancel). Window: the unload time against the 1.5 s poll.
- Server symptom: the POST /turns guard `live(m.jobId)` is false for that `failed` job, so a resend inside the unload window is accepted. User message 2 is appended, then turn 1's `writeFailed(..., 'cancelled')` lands after it. `replyOf` gives user 2 that cancelled reply, so user 2 reads CANCELLED even though its turn runs, and its real reply never counts as its reply.
- Fix: in the POST guard also refuse while `turnOf(jobId)` is live (the body has not settled; `turns` is deleted in `finally`). In `followTurn`, when the job is `failed` and the user message has no reply yet, refetch once more after a poll (or set `job.cancelled = true` in the turn's abort callback so `userState` returns `cancelled`).

## 2. should · server/src/services/chat/createFromDraft.ts:155-163, client/src/ChatSongCard.tsx:20-21, client/src/chatCopy.ts:168 · a take truncated at 360 s reads as DONE (F-044 edge)
Acceptance: "saved with a rust TRUNCATED line, not DONE (D-025)". The server does save the version with label `first generation (truncated)`. The client shows the recipe card as `DONE · v1 SAVED` (`doneLine` has no truncated case) and the song card only appends the label to the title in plain text. There is no rust line and nothing says the song was cut. Failure: a YuE2 take that hits the cap lands as DONE.
Fix: pass `truncated` in the song card body (or compare `label` with `TRUNCATED_LABEL`) and render a rust TRUNCATED line on the song card; make `doneLine` say TRUNCATED. Add a test.

## 3. nit · server/src/services/chat/turnJob.ts:136-137 · `turns` entry leaks when the queue is full
`turns.set(job.id, ...)` runs before `queueJob`. When `queueJob` throws `QueueFullError`, nothing deletes the entry (the `finally` that does is inside the queued body). One small Map entry per refused SEND; no behavioural effect (the job id is never returned). Fix: set it after `queueJob`, or delete it in a catch.

## Checked, no defect found
F-041 (cascade on permanent delete; trash keeps the thread; attach keeps order; clientKey replay is one turn). F-042 (one load, `release` in `finally` on every path, context pre/post-flight, 3 attempts, scalpel/analyze/edit/recipe-on-song become `say`). F-043 entry (D-119: starts on the Library; CHAT and OPEN CHAT only when `configured`). F-044 (CREATE SONG sends the live draft, blockers come from the server, newer card supersedes, failed take keeps the card pending with RETRY). F-045 (the player reads the base layer's active take; the thread id survives the attach). F-049 turn half (reload mid-turn restores from the job, a restart gives `interrupted` and `expired` cards).
