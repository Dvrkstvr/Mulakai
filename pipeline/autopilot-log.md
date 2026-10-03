# Autopilot log

## Run 2026-10-03 → M0
R1 stage 3 · SP-3 resume refused (agent stopped by user) → asked user: fresh SP-3 + SP-2 models (D-016) · progress 3·0/2·6·0 · next: fresh SP-3
R2 stage 3 · SP-3 finished (fresh agent) → RESULT.md; R-010 proven, R-013 measured (harmony/instrument = request, not guarantee), R-014 measured; user A/B owed · progress 3·1/2·6·0 · next: SP-2
R3 stage 3 · SP-2 → proven (qualified): ops 97%/94% first try, notes-based WRITE PHRASE 100%/94%, p50 1.6 s; gate pass, feasibility amber; listens owed · progress 4·0/5·6·0 · next: stage 4 scope
R4 stage 4 · scope-cutter → scope.md M0..M4, F-016..F-039; 4/5 must (sign-off owed); S4 genQueue verified on origin/main 6426d5c · progress 4·4/5·6·0 · next: user sign-off
R4b stage 4 · user signed off cut (D-026) → gate 5/5 · progress 5·0·6·0 · next: stage 5 design
R5 stage 5 · ux-mocker → design/score-verb.html, 14 states; 2/3 must (Q-022, Q-023 user picks owed) · progress 5·2/3·6·2 · next: user picks
R5b stage 5 · user picked Q-022 A, Q-023 C, signed off mockup (D-032) → gate 3/3 · progress 6·0·6·0 · next: stage 6
R6 stage 6 · architect → architecture.md, playbook complete, checks green (client 624, server 518, pytest 65, e2e 5); context budget deferred to W0 by user (D-046) · progress 7·0·6·0 · STOP: fresh session before M0 build
## Run 2026-10-03 (resumed, same session, remote control on) → M0
R7 stage 7 M0/W0 · builder → 5 docs/ci commits + pipeline commit on docs/score-agent-w0; checks green (client 624, server 520, pytest 65), context-budget exit 0 · progress 7·W0 local·6·0 · waiting: user OK to push + PR
R8 stage 7 M0/W1 · builder → yue-server score read/apply routes (F-017), pytest 163 pass (98 new), 37/37 golden match; #5 live VRAM check owed at CP1 · progress 7·W1 local·6·0
R9 stage 7 M0 · #124 (W0) merged c8bb066 (user OK); W1 pushed as PR #125 (auto-fix on); W2a F-018 committed f7955e2; W2b running · progress 7·W0 merged·6·0
R10 stage 7 M0/W2b · builder → planner client, plan job (kind 'plan'), unload hand-off, context guard (F-019, F-020); server 620 tests, client 627; live items owed to CP1 · progress 7·W2 local·6·0
R11 stage 7 M0/CP1 · live checkpoint PASS 7/7: plans 6/6 first try (p50 6.5 s), unload→/api/ps empty 107–140 ms, YuE2 90–97 tok/s, VRAM back 0–4 MiB, tempo within 0.5%, truncated 0/6; Q-034 (same-root jazz) assumed D-051 · progress 7·CP1 pass·6·0

## Run 2026-10-03 → M0 (new run, fresh 12-round budget; previous run stopped on budget after CP1)
R1 stage 7 M0 · #125 (W1) merged (user OK); W2 pushed as PR #126 (auto-fix on); W3 builder dispatched on feat/score-w3-dock · progress 7·W1 merged·6·0
R2 stage 7 M0/W3 · builder → SCORE dock verb (F-021, F-022, F-024): reducer 52-row table, status route, cancel, limits; client 705, server 640; browser-checked on fakes, dock 356 px at 1366×768 and 1080p · progress 7·W3 local·6·0
R3 stage 7 M0/W3 committed (5 commits on feat/score-w3-dock); W4 builder dispatched on feat/score-w4-render · progress 7·W3 local·6·0
R4 stage 7 M0/W4 · builder → APPLY & RENDER (F-023) 6/6 in tests + browser on fakes; server 677, client 717 · progress 7·W4 local·6·0
R5 stage 7 M0 · W4 committed; #126 (W2) merged (user OK); W3 PR #127, W4 PR #128 (stacked) with auto-fix; verifier dispatched for F-016..F-025 incl. W5 live run on a library copy (user choice) · progress 7·W4 local·6·0
R6 stage 7 M0 verify · verifier → F-016..F-024 pass with evidence, F-025 false (A/B listen owed); live W5 on library copy: plans 8–15 s, unload 95–120 ms, YuE2 88–101 tok/s, tempo ≤1.2%; Ollama crash + ENOSPC once (C: full, now fixed by moving to E:) · progress 7·9/10·15·0
