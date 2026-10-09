# Status — Mulakai

<!-- ≤ 60 lines. The "Now" section is injected at every session start; keep it ≤ 12 lines. -->

## Now
- track: standard · approach: spec-first (+ design-first: dock verb UI, prototype-first: planner/VRAM)
- focus: chat-first (C0..C8, D-096/D-103); score agent M0-M2 done; existing app adopted at stage 7
- stage: 7 build — C4 DONE 2026-10-09 (one version from several local ops: built #275-#287, CP-C4 GO, reviewed C4-code.md 0 blocking + #285, live c4-live.md, F-066 + F-069 pass, F-067/F-068 not doing D-262, curated); C2 done 2026-10-09
- clarity: blocking 0 · latest Q-152 · decisions to D-289
- feasibility: amber · H-open 1 (R-038 German lyrics: gemma4 chosen D-237, build = LD) · R-024 closed · R-030 accepted (D-198) · R-033 fixed #201 · R-031 not seen, R-032 measured (CP-C1) · spiked 7 · R-042 LD turn time
- milestone: C0 + C1 + C2 + C3 + C4 done · RT done (F-090..F-094; F-094 #274 #286 #289, flag in #283) · features passing 56/97
- autopilot: stopped — C4 reached (run 9, 9/12 rounds); RT-6 run 8 stopped at F-094 (10/12)
- LD (lyrics own call; German on gemma4): built #242 #246 · fixes #252 (D-251) #253 (D-252 keep) #260 (D-255 loop refused) #270 (D-259 lyrics cap 1200, cut call waited out) · live: redirect 0/18, loop retries resolve in-turn; 7/10 German firsts hit the 180 s timeout before #270 · owner tests #270 in use and reports (no re-check run) · owed: chatCp3 (owner songs), owner reads German lyrics
- owed: cover listen (C3), M2 pair 2, M1 phrase · C4 (optional): seam listen at c4-live.md times, one real run watching SPLICING · k OF N · restart yue-server/WSL (forwarding died 20:08, owner yue predates the chain code)
- next: LD-1 PR → LD-2 once #238 merges; BPM fix in its own session; REPEAT-last-section task card

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
| 7 | Build | active (C4 done 2026-10-09: F-066 + F-069 pass, CP-C4 GO, live c4-live.md, curated) | C4 gate met | 2026-10-09 |
| 8 | Review | C4 code: 0 blocking, 1 should fixed (#285); C2 0 blocking (#251) | 2/2 must | 2026-10-09 |
| 9 | Release | n/a (local single-user app) | — | — |

## Notes
- 2026-10-08 RT (re-time a transcription, D-190, D-205..D-212, D-231, D-240, D-248): RT-1..RT-3 merged, F-090 + F-091 pass; RT-4 #243 (F-093 passes, D-249); RT-5 #247 (F-092 passes, verifier); RT-6 (chat verb) after C2.
- 2026-10-04 storage: DONE. Ollama models E:\ai\ollama\models (OLLAMA_MODELS), WSL Ubuntu-24.04 at E:\ai\wsl\Ubuntu-24.04, caches E:\ai\cache\{uv,pip,npm}; C: 0.5 -> 138 GB free. Big temp data goes on E:.
- 2026-10-03: D-014/D-015 make SCORE the primary edit path for new songs; PLAN.md "YuE2 Is the Default First-Take Engine" → "With the score agent" records the link (branch docs/engine-lineup).
- The 2026-10-02 mockup (canvas "Score Agent Mockup") predates the redesign; superseded by D-007 for placement, still valid for the workflow, ops list and checks.
