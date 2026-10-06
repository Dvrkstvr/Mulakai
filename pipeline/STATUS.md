# Status — Mulakai

<!-- ≤ 60 lines. The "Now" section is injected at every session start; keep it ≤ 12 lines. -->

## Now
- track: standard · approach: spec-first (+ design-first: dock verb UI, prototype-first: planner/VRAM)
- focus: score agent for YuE2 songs (D-005..D-007); existing app adopted at stage 7 verify-only
- stage: 4 Scope (chat) — cut written (scope.md: preconditions SP-5/SP-4 listen/R-025/SP-6, C0..C8, F-040..F-081); awaiting the owner's sign-off · score agent M0-M2 done
- clarity: blocking 0 · latest Q-079 · decisions to D-102 (D-097..D-102 pending the cut's sign-off)
- feasibility: amber · H-open 1 (R-024: SP-4 machine half done, A3 splice + audio-only REPEAT/CUT; ear half owed) · R-025 repaint launcher unverified · spiked 5
- milestone: M2 done · features passing 24/39 · owed: M2 listen pair 2 (unjudged), M1 phrase listen
- autopilot: none running
- next: owner signs off the chat cut → SP-5 chat planner spike → owner's SP-4 listen → stage 6 architecture for C0

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
| 7 | Build | active (M2 done 2026-10-06: 5/5, reviewed, curated) | M2 gate met 4/4 | 2026-10-06 |
| 8 | Review | M2 code: 0 blocking, 2 should fixed (0629e20), 3 nit (1 fixed, 2 → Q-052) | 2/2 must | 2026-10-05 |
| 9 | Release | n/a (local single-user app) | — | — |

## Notes
- 2026-10-04 storage: DONE. Ollama models E:\ai\ollama\models (OLLAMA_MODELS), WSL Ubuntu-24.04 at E:\ai\wsl\Ubuntu-24.04, caches E:\ai\cache\{uv,pip,npm}; C: 0.5 -> 138 GB free. Big temp data goes on E:.
- 2026-10-03: D-014/D-015 make SCORE the primary edit path for new songs; PLAN.md "YuE2 Is the Default First-Take Engine" → "With the score agent" records the link (branch docs/engine-lineup).
- The 2026-10-02 mockup (canvas "Score Agent Mockup") predates the redesign; superseded by D-007 for placement, still valid for the workflow, ops list and checks.
