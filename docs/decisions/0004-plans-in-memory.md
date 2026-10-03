# 0004 · Pending plans live in server memory, one per song

Date: 2026-10-03 · Status: accepted · Source: D-020, D-035 (`pipeline/decisions.md`)

## Context

After PLAN, a person reviews the change list for seconds to minutes before
APPLY & RENDER. The plan (ops, edited score and style, checks) must survive
that review, and a new PLAN must replace the old one.

## Decision

`server/src/services/score/planStore.ts` keeps pending plans in memory,
one per song. A new PLAN replaces the song's plan; a render, trashing the
song or a server restart drops it. A render naming an unknown plan id is
refused with "plan expired, plan again".

## Alternatives

- A `plans` table: a schema and migration for a minutes-long review.
- The plan on the Job record: the job registry evicts after one hour
  unread, which would expire a plan under review, and "PLAN again replaces
  the plan" is per song, not per job.

## Consequences

- A restart loses a pending plan; the person presses PLAN again (a warm
  plan takes ~2 s).
- No version key is needed: plans are never persisted.
- Revisit if users lose plans to restarts, or M2's REVISE needs several
  pending plans per song.
