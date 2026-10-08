# 0010 · A follow-up message revises the pending edit card; the server decides

Date: 2026-10-08 · Status: accepted (assumed by the architect, D-213..D-215) · Source: F-058, F-060, D-073, D-076

## Context

C0b's edit turn always makes a fresh plan: a follow-up ("and slow it down a bit") supersedes the pending card and
the planner never sees what it proposed, so a conversation restarts instead of converging. The score agent's dock
already solved this for its REVISE button (F-033): the planner sees the pending plan's numbered ops and returns only
what changes, `{drop, ops}`; code merges it (`mergeRevise`: SAME / CHANGED / NEW, REMOVED) and applies the merged
plan to the base as read (D-073, D-076). Q-050 showed why code must merge: asked to restate the plan, the model
dropped the ops it was not asked about in 4 of 4 additive revisions.

## Decision

- **No button, no flag.** When a turn starts on a song thread whose live edit card still holds the song's pending
  plan and the song is unchanged (plan id + fingerprint), the turn's edit action is the revise contract: the PENDING
  PLAN lines in the prompt, `drop` in the edit schema, `readRevise` in the check, the merged plan applied once. The
  model starts over by dropping every pending op; the card shows that as REMOVED + NEW.
- **The chat's card is the dock's plan.** The revised plan goes through `buildPlan` with `revision` and `since`, so
  `ScorePlanList` draws the marks it already draws in the dock, and APPLY treats it like any plan.
- **The bar map comes with the card.** The server builds it from the facts the planner saw (`barMap.ts`), so the
  map, the planner's numbers and the change list cannot disagree; it replaces the C0b strip.
- A failed, cancelled or offline revise changes nothing (the pending card and plan stay), as every failed turn.

## Alternatives

- **A REVISE button on the edit card** (the dock's shape): explicit, but a second commit-like control on a card that
  should carry one acid action, and the person has to know to press it before typing.
- **The model chooses** (`revise: true` in its reply): one more decision SP-5 never measured, on a 14B model whose
  revise behaviour is already the risk.
- **Restating the pending ops and asking for a complete plan** (D-068): measured to lose ops (Q-050).

## Consequences

- The edit prompt grows by the PENDING block; CP-C2 (R-040) measures it before the card's UI is built.
- A dock PLAN on the same song replaces the plan, so the chat card expires and the next message plans fresh.
- Reversal: drop `turnRevise.pendingFor`'s result and every turn plans fresh again; no data to migrate.
