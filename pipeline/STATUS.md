# Status — Mulakai

<!-- ≤ 60 lines. The "Now" section is injected at every session start; keep it ≤ 12 lines. -->

## Now
- track: standard · approach: spec-first (+ design-first: dock verb UI, prototype-first: planner/VRAM)
- focus: score agent for YuE2 songs (D-005..D-007); existing app adopted at stage 7 verify-only
- stage: 7 Build M0 — W3 (F-021, F-022, F-024 SCORE dock verb) on feat/score-w3-dock (stacked on W2)
- clarity: blocking 0 · open assumable/deferred listed in open-questions.md (latest Q-031) · decisions to D-046
- feasibility: amber · H-open 0 · M-open 1 · spiked 4 · owed: user listens (SP-3 A/B, SP-2 phrases)
- milestone: M0 (F-016..F-025) · features passing 6/39 · owed: user listens (SP-3, SP-2); R-012 red golden path
- autopilot: M0 · round 1/12 · W3 dock verb · auto-fix on · remote on
- next: settle Q-034; open W2 PR (stacked on #125); W3 (F-021, F-022, F-024 dock verb) → W4 → W5; `/pipeline:auto M0` resumes

## Stages
| # | Stage | State | Gate | Date |
|---|---|---|---|---|
| 0 | Adopt | done | 5/5 outputs; brief signed off (D-008) | 2026-10-03 |
| 1 | Intake | done | Q-001/Q-003/Q-004 answered by user | 2026-10-03 |
| 2 | Feasibility | done | 4/4 must; red → SP-1..SP-3 scheduled | 2026-10-03 |
| 3 | Spike | done | 3/3 RESULT.md; feasibility amber; listens owed | 2026-10-03 |
| 4 | Scope | done | 5/5 must; user signed off (D-026) | 2026-10-03 |
| 5 | Design | done | 3/3 must; mockup signed off (D-032) | 2026-10-03 |
| 6 | Architecture | done | 3/4 + context budget lands in W0 (D-046) | 2026-10-03 |
| 7 | Build | active (M0 W0) | — | — |
| 8 | Review | todo | — | — |
| 9 | Release | n/a (local single-user app) | — | — |

## Notes
- 2026-10-03: D-014/D-015 make SCORE the primary edit path for new songs; PLAN.md "YuE2 Is the Default First-Take Engine" → "With the score agent" records the link (branch docs/engine-lineup).
- Before any score-agent code: dated PLAN.md section superseding "ABC score editing is out of scope" + AGENTS.md amendment (D-005).
- Score agent waits on redesign S4 job queue (feat/job-queue, unmerged) per D-003.
- Existing app: golden-path e2e red on push to main after #113 and #116 (R-012: Activity drawer shows RUNNING + DONE rows for one job). Fix before more merges.
- The 2026-10-02 mockup (canvas "Score Agent Mockup") predates the redesign; superseded by D-007 for placement, still valid for the workflow, ops list and checks.
- Local main is 3 commits behind origin/main (#116).
