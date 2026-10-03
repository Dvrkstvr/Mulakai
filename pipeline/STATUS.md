# Status — Mulakai

<!-- ≤ 60 lines. The "Now" section is injected at every session start; keep it ≤ 12 lines. -->

## Now
- track: standard · approach: spec-first (+ design-first: dock verb UI, prototype-first: planner/VRAM)
- focus: score agent for YuE2 songs (D-005..D-007); existing app adopted at stage 7 verify-only
- stage: 7 Build M0 — verified 9/10 (F-016..F-024 pass); F-025 waits on the user A/B listen (pipeline/verify/M0/listen/index.html)
- clarity: blocking 0 · open assumable/deferred listed in open-questions.md (latest Q-031) · decisions to D-046
- feasibility: amber · H-open 0 · M-open 1 · spiked 4 · owed: user listens (SP-3 A/B, SP-2 phrases)
- milestone: M0 · features passing 15/39 (F-016..F-024 + existing 6) · owed: M0 A/B listen; SP-3/SP-2 listens
- autopilot: M0 · round 6/12 · waiting on user: A/B listen, merges of #127/#128 · auto-fix on · remote on
- next: user listen → F-025 passes → stage 8 review (code lens) → curate → merge #127/#128

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
| 7 | Build | active (M0: W0–W4 built, verify 9/10, F-025 owed listen) | — | — |
| 8 | Review | todo | — | — |
| 9 | Release | n/a (local single-user app) | — | — |

## Notes
- 2026-10-04 storage: DONE. Ollama models E:\ai\ollama\models (OLLAMA_MODELS), WSL Ubuntu-24.04 at E:\ai\wsl\Ubuntu-24.04, caches E:\ai\cache\{uv,pip,npm}; C: 0.5 -> 138 GB free. Big temp data goes on E:.
- 2026-10-03: D-014/D-015 make SCORE the primary edit path for new songs; PLAN.md "YuE2 Is the Default First-Take Engine" → "With the score agent" records the link (branch docs/engine-lineup).
- Existing app: golden-path e2e red on push to main after #113 and #116 (R-012: Activity drawer shows RUNNING + DONE rows for one job). Fix before more merges.
- The 2026-10-02 mockup (canvas "Score Agent Mockup") predates the redesign; superseded by D-007 for placement, still valid for the workflow, ops list and checks.
