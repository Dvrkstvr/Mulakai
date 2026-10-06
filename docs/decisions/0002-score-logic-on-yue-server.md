# 0002 · Score logic runs on yue-server, not in TypeScript

Date: 2026-10-03 · Status: accepted · Source: D-019, R-016 (`pipeline/`),
PLAN.md "Score Agent"

## Context

A plan's operations must be applied to a native YuE2 ABC score, and the
result validated (bar unit sums, melody unchanged where it must be, chords
valid), measured (duration, token count) and summarized for the planner
(bar map). Upstream YuE ships the parser and comparer (`abc_tools.py`,
vendored unmodified in `yue-server/upstream/`) and warns against
substituting a parser with different accidental semantics.

## Decision

Apply, validate, bar map, duration estimate and token count run in
yue-server as CPU-only routes (`POST /v1/scores/read`, `POST
/v1/scores/apply`) next to the vendored `abc_tools.py`. The Mulakai server
holds the planner client, prompt, jobs and routes, and never parses ABC
beyond the existing header read (`abcMeta.ts`).

## Alternatives

- A TypeScript port with golden tests: the spike's applier alone is 553
  lines of Python (past the 200-LOC cap), and a second parser can drift on
  accidentals, so a score could pass our check and fail upstream's.

## Consequences

- No plan is possible while yue-server is down, even if the planner is up.
- The score routes must never touch the GPU path, and tokenizer calls take
  a lock (D-042).
- The server's fake yue replays replies recorded by pytest, so it cannot
  drift from the real routes (D-039).
- Revisit if the route proves awkward; then port with SP-2's
  `golden.json` as the contract.
