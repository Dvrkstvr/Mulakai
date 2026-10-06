---
paths:
  - "server/src/services/genQueue.ts"
  - "server/src/services/jobRunner.ts"
  - "server/src/services/jobRegistry.ts"
  - "server/src/services/queueGuards.ts"
  - "server/src/services/*Jobs.ts"
  - "server/src/services/score/*Job.ts"
  - "server/src/services/enginePoll.ts"
  - "server/src/services/engineClient.ts"
---

# GPU job queue

- One GPU slot. A slot is released only once the backend has let go:
  ABORT holds it while the engine drains, and a `plan` job holds it until
  the planner is unloaded and `/api/ps` is empty.
- `genQueue.ts` is at its LOC cap (188 of 200): add new kinds only and put
  logic in its own module.
- A queued job may wait minutes: what it works on is read again when it
  starts (`queueGuards.ts`); a deleted or trashed target fails the job
  with that reason.
- A busy GPU never disables a commit; the queue refuses at `QUEUE_LIMIT`
  (10 waiting) with a reason the client shows.
- A new kind extends the kind unions on both sides in the same PR: the
  client's `ActiveGeneration.kind` (`client/src/api/types.ts`), and so its
  Activity label maps, `RUNNING_LABEL` first. M0's `plan` kind missed it.
- First takes and score renders share one engine poll loop (D-036).
