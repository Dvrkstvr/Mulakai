# 0006 · A chat turn is one `plan`-kind job, and an edit's ops come in the turn's reply

Date: 2026-10-06 · Status: accepted (assumed by the architect, D-106); amended 2026-10-08 by D-233 (LD) · Source: D-011, D-100, PLAN.md "Chat" decision 3, SP-5, SP-7

## Context

Every turn loads `qwen3:14b` on the 16 GB card, which YuE2 and ACE-Step also need. The score agent already guarantees one
load and a confirmed unload (`/api/ps` empty) per `plan` job before the slot is released (D-011). An `edit` turn must also
produce a valid SCORE plan.

## Decision

- A turn is queued as kind `plan` (label `chat turn`): `chat/turnJob.ts` probes, preflights the context, gets a checked
  reply from `chat/turnCall.ts`, and in `finally` calls `releasePlanner`. No new kind, so `genQueue.ts` (at its LOC cap),
  the client kind union and `RUNNING_LABEL` do not change; `scoreRenderJob`'s "pending edit" check already ignores `plan`.
- An `edit` reply carries SCORE ops inline (SP-5's schema: `opsArraySchema`), checked inside the same attempts by the score
  agent's own `checkOps`, yue-server `/v1/scores/apply` and `withLimits`; the plan is built by `score/planBuild.ts` and
  stored in `planStore`, so the chat's plan and the dock's plan are one thing.
- How many model calls a turn makes (one; or SP-5's ladder: router + per-action, lyrics on their own) is decided inside
  `chat/turnCall.ts` only; the job, the hand-off and the dispatch do not change shape.
- **Amended by D-233 (LD, F-095):** a turn may load more than one model, one at a time, all inside its one `plan` slot:
  the planner, then the lyrics model a recipe's language names (`gemma4:26b-a4b-it-q4_K_M` for German, D-237; the
  planner itself for the others, so no reload). Before a different model loads, the one before is unloaded and
  `/api/ps` read empty; the `finally` unloads every model the turn touched and waits for `/api/ps` empty before the slot
  is released (`chat/turnModels.ts` over `ollamaControl.releaseModels`; `releasePlanner` alone would leave gemma4
  loaded). The rule is one load per model the turn needs, each unloaded before the next and all before release; the
  planner family and YuE2 still never share the GPU.

## Alternatives

- **A new `chatTurn` kind.** Same behaviour, plus a kind in both unions, labels and the pending-edit filter; genQueue is
  at 190/200 lines.
- **Two jobs per edit turn (turn, then a `plan` job).** Two loads and two unloads per edit, and the plan could be
  overtaken by a queued render in between.
- **The turn emits the request in words and runs the SCORE planner's own prompt as a second call.** Kept as the ladder's
  rung 1 inside `turnCall.ts`; the default is SP-5's single call.
- **The lyrics as a second queue job (D-233).** A YuE2 take could slip in between and find the planner's answer half
  written; the lyrics call stays in the turn's slot.

## Consequences

- Activity shows a chat turn as PLANNING until F-080 (C8) gives it its own label.
- A chat edit replaces a pending SCORE plan on the same song and vice versa (one plan per song, D-028).
- A German recipe turn holds the slot for two loads (SP-7: about 35 s warm); a "keep" follow-up makes one call (D-234).
