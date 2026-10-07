# Status — Mulakai

<!-- ≤ 60 lines. The "Now" section is injected at every session start; keep it ≤ 12 lines. -->

## Now
- track: standard · approach: spec-first (+ design-first: dock verb UI, prototype-first: planner/VRAM)
- focus: chat-first (C0..C8, D-096/D-103); score agent M0-M2 done; existing app adopted at stage 7
- stage: 7 build — C3 DONE · C0b DONE 2026-10-07 (built #177 #181, reviewed #185, live-verified + fixed #186, curated); F-050 waits on the owner's listen
- clarity: blocking 0 · latest Q-108 · decisions to D-169
- feasibility: amber · H-open 1 (R-024: SP-4 ear half owed) · R-025 repaint launcher unverified · R-027 edit tail · spiked 6
- milestone: C0a + C3 + C0b done · features passing 37/81 (C0b: F-046..F-049; F-050 owed listen)
- autopilot: stopped — C0b reached (run 3, 7/12 rounds); waiting on the owner's C0b listen
- owed: C0b A/B listen (E:/ai/tmp/c0b-live/listen, F-050 #3), cover listen (C3), SP-5 lyric read, M2 pair 2, M1 phrase
- next: owner listen (5 pairs) → F-050; then pick the next milestone (C1 golden-path e2e, C2, or C4 per scope.md)

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
| 7 | Build | active (C0b done 2026-10-07: CB-6 live, fixes #186, curated) | C0b gate met (F-050 #3 owed) | 2026-10-07 |
| 8 | Review | C0b code: 0 blocking, 0 should, 3 nits (2 fixed #185, 1 deferred) | 2/2 must | 2026-10-07 |
| 9 | Release | n/a (local single-user app) | — | — |

## Notes
- 2026-10-04 storage: DONE. Ollama models E:\ai\ollama\models (OLLAMA_MODELS), WSL Ubuntu-24.04 at E:\ai\wsl\Ubuntu-24.04, caches E:\ai\cache\{uv,pip,npm}; C: 0.5 -> 138 GB free. Big temp data goes on E:.
- 2026-10-03: D-014/D-015 make SCORE the primary edit path for new songs; PLAN.md "YuE2 Is the Default First-Take Engine" → "With the score agent" records the link (branch docs/engine-lineup).
- The 2026-10-02 mockup (canvas "Score Agent Mockup") predates the redesign; superseded by D-007 for placement, still valid for the workflow, ops list and checks.
