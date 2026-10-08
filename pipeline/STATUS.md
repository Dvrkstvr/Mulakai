# Status — Mulakai

<!-- ≤ 60 lines. The "Now" section is injected at every session start; keep it ≤ 12 lines. -->

## Now
- track: standard · approach: spec-first (+ design-first: dock verb UI, prototype-first: planner/VRAM)
- focus: chat-first (C0..C8, D-096/D-103); score agent M0-M2 done; existing app adopted at stage 7
- stage: 7 build — C1 DONE 2026-10-08 (built #190-#212, reviewed #215, CP-C1 5/5, live-verified #217 #224, fixes #219 #220 #225, curated); C2 runs in its own session
- clarity: blocking 0 · latest Q-144 · decisions to D-249
- feasibility: amber · H-open 1 (R-038 German lyrics: gemma4 chosen D-237, build = LD) · R-024 closed · R-030 accepted (D-198) · R-033 fixed #201 · R-031 not seen, R-032 measured (CP-C1) · spiked 7 · R-042 LD turn time
- milestone: C0 + C1 + C3 done · features passing 43/83 · C2 (own session) · Re-time a transcription (own session)
- autopilot: stopped — C1 reached (run 5, 6/12 rounds)
- autopilot C2: round 4/12 (run 6) · wave 3 (CV-6, CV-8 building; CV-1 #238; CP-C2 next) · stall 0
- LD (lyrics own call; German on gemma4): built #242 #246, fixes #252 (D-251 draft offers no edit) #253 (D-252 code keeps lyrics) #260 (D-255 looped structure refused) · re-check 2026-10-08: redirect 0/18, keep 8/11 (misses = Outro loop, #260) · owed: live keep re-check after #260, chatCp3 (owner songs), owner reads German lyrics
- owed: cover listen (C3), M2 pair 2, M1 phrase
- next: LD-1 PR → LD-2 once #238 merges; C2 and the BPM fix run in their own sessions; REPEAT-last-section task card

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
| 7 | Build | active (C1 done 2026-10-08: CP-C1 5/5, live re-check, curated) | C1 gate met | 2026-10-08 |
| 8 | Review | C1 code: 0 blocking, 2 should fixed (#215), nits partly | 2/2 must | 2026-10-08 |
| 9 | Release | n/a (local single-user app) | — | — |

## Notes
- 2026-10-08 RT (re-time a transcription, D-190, D-205..D-212, D-231, D-240, D-248): RT-1..RT-3 merged, F-090 + F-091 pass; RT-4 #243 (F-093 passes, D-249); RT-5 #247 (F-092 passes, verifier); RT-6 (chat verb) after C2.
- 2026-10-04 storage: DONE. Ollama models E:\ai\ollama\models (OLLAMA_MODELS), WSL Ubuntu-24.04 at E:\ai\wsl\Ubuntu-24.04, caches E:\ai\cache\{uv,pip,npm}; C: 0.5 -> 138 GB free. Big temp data goes on E:.
- 2026-10-03: D-014/D-015 make SCORE the primary edit path for new songs; PLAN.md "YuE2 Is the Default First-Take Engine" → "With the score agent" records the link (branch docs/engine-lineup).
- The 2026-10-02 mockup (canvas "Score Agent Mockup") predates the redesign; superseded by D-007 for placement, still valid for the workflow, ops list and checks.
