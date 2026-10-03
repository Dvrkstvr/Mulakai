# Process audit — Mulakai (2026-10-03)

Numbers are from `git log` on local main (2eacef5; origin/main is 3 commits ahead, #116). Checked by running commands unless marked.

## Does the core promise work end to end today?
Partly proven. `generate -> repaint -> add layer -> revert -> export` passes in the e2e golden path against a **fake** ACE-Step (local run: 1 passed, 14.8 s). Client 585/585, server 493/493 unit tests pass; client build ok; oxlint 1 warning. Not proven: real ACE-Step, YuE2, HeartMuLa, Demucs/UVR, cover, split, queue (none in CI). And CI on main is red on the golden path twice (R-012: Activity shows a RUNNING and a DONE row for the same job). So "the promise works" holds for what a fake can show, and the newest redesign surface (Activity) is the flaky part.

## Redesign (PLAN.md "UI Redesign", planned 2026-10-03)
- S1 dock (#115), S2 guided Create (#114), S3 palette/Activity/CONTINUE (#113): merged, files exist, old components deleted (seen: RepaintBar, EditorLeftRail, AddLayerTrigger, LyricsPanel, ExportPanel, SettingsPanel gone).
- S4 job queue: not merged; branch feat/job-queue is 3 commits ahead ("part a"); main has genLock.ts, no genQueue.ts.
- Pace: spec merged 08:52Z, S3 09:22Z, S2 09:24Z, S1 09:36Z, a fix at 09:42Z. Three slices in 44 minutes, S1 merged by merging S2+S3 into it (f410414). That is the likely source of the Activity duplicate-row failure: it was never run in a stacked state before merge (inferred).

## Process findings
1. **Rework chain on one root cause (GPU contention).** 2026-10-01/02, about 20 fix commits all patch the single global `genLock`: let a failed generation stop blocking (c568e67), failed editor job (224e631), settled split (f98d1e0), failed YuE2 cover panel (23d5dd3), lock COVER source (081ecbf), COVER engine (8b50162), ACE-STEP COVER source (a862e49), ANALYZE takes the lock (16f6577), Create buttons name the holder (2c007d5), Editor busy labels name the holder (a9a115e, 65a2e3f, 367ac03), silent ACE-Step reported busy (ab5928f). Each is a separate branch, a docs-only "plan" commit and a docs-only "record browser check" commit. The redesign's S4 queue replaces the lock entirely; most of those labels ("WAIT FOR ...") are deleted by S4 (PLAN.md S4 decision 7). Fixing symptoms for two days before the structural change.
2. **Doc-only share.** 428 non-merge commits: 168 touch only `.md`/`docs/` (39%); 163 have a `docs:` subject. Merge commits: 258 of 686 total. Day 2026-10-02 alone: 197 non-merge commits. Pattern per micro-fix: `docs: plan X` + `fix: X` + `docs: record X browser check` (e.g. d8e8388/081ecbf/cfb275d; 4ee4452/16f6577/fcede1e).
3. **Spec log bloat.** PLAN.md is 8,329 lines (CLAUDE.md: "read it first"). One section, "Multiple Song-Creation Engines", is ~1,360 lines (2219-3578); "YuE2 Melody Covers via SheetSage2" ~740. Sections written as plans, then edited into history. Useful as a decision record, ruinous as a first read.
4. **Breadth before depth.** Features shipped: 3 ACE-Step flows, 2 extra engines, voices, adapters, import, split with 2 backends, transcribe/read lyrics/timings, forge stub. Verification depth: **one** e2e test (137 lines, added 2026-10-02, the 197-commit day; first e2e commit in the repo), all engines faked. 1,078 unit tests, most against mocks.
5. **Work merged unverified / red-after-merge.** PRs #113 and #116 show a green PR check but a failed push run on main (R-012). AGENTS.md "never merge without tests passing" held for the PR run only; the merge-ref run was not waited on. Memory note "Merge waits for CI" says the same: still not followed for the push run.
6. **Parallel sessions.** 9 worktrees under `.claude/worktrees` (8 agent-*, 3 of them detached HEADs, plus epic-napier); four already-merged redesign branches (redesign-spec, command-activity, guided-create, editor-action-dock) are still checked out in worktrees, and feat/job-queue (unmerged) is in another. Local main is 3 commits behind origin/main. Cleanup owed (not done by me).
7. **Module size policy held.** 0 of 334 non-test source files over 200 LOC (checked with wc). One of the repo's strongest practices.
8. **Mockups not in the repo.** The three redesign mockups are named in the spec but absent (find `*.dc.html`: none). The score-agent mockup also exists only outside the repo.
9. **Out-of-repo reference paths** (`S:\AI Gen\...`) are in CLAUDE.md as "do not modify" reference projects; a fresh machine cannot reproduce them (note only).

## Context bloat (`context-budget.mjs`, run from E:\repos\Mulakai)
```
Always loaded (every session):
  CLAUDE.md   109 lines   5.5 KB  ~1.4k tok  memory
  AGENTS.md    94 lines   4.4 KB  ~1.1k tok  @import from CLAUDE.md
On demand (path-scoped rules): (none)
Over budget: AGENTS.md is @imported, so it loads every session — move it to path-scoped rules or docs/
always-loaded 9.8 KB (~2.5k tok) · CLAUDE.md 109/120 lines · rules 0 unscoped, 0 scoped · OVER BUDGET (1) · exit 1
```
Real cost is not the always-loaded 2.5k tokens (lean for this repo) but the instruction "read PLAN.md first" (8,329 lines, ~100k+ tokens if followed). Fix: CLAUDE.md stays; add a PLAN.md index + path-scoped rules (e.g. `server/src/services/engines/**`, `client/src/Dock*`); AGENTS.md could move its Design System and Module Size sections to path-scoped rules. Propose as its own branch; not done here. CLAUDE.md also carries status text ("Tech Stack" and e2e orphan-port prose) that fails the line test, minor.

## Rituals that cost more than they return (ask the user which to retire; Q-010 / D-004)
- docs-only "plan" + "record browser check" commits around every micro-fix.
- Mirroring each change into PLAN.md + DESIGN.md + AUDIT.md + README tables by hand.
- `chore: refresh graphify knowledge graph` commits (graphify-out checked in; merge=ours driver; stale after every merge).
- Keep: PLAN.md as spec log for 3+ file features (good fit for spec-first), the 200-LOC cap, "consequence line before commit", e2e on PRs.

## Score-agent specific findings
- Nothing of it is in the repo (no LLM client, no score editor, no validator). The groundwork present: `score.abc` sidecar per version, `abc` request field on YuE2 cover requests, `abcMeta` reader, USE .ABC FILE.
- It conflicts with two written rules (PLAN.md "agentic editing out of scope"; AGENTS.md edits-after-first-take run on ACE-Step) and its mockup targets UI that no longer exists (prompt bar, left panel, multi-mode rail). Designing it against the old Editor would have been rework. Right order: scope decision (Q-001), then a placement mockup against the new dock (Q-002), then a spike (R-002/R-003/R-010), then a PLAN.md section.

## Recommendation
- **Track: standard.** Single user, local, no money or data-loss exposure beyond local files; but a 16 GB-VRAM GPU job and a rewrite-grade scope conflict justify feasibility + spike + scope sign-off rather than spark. Deep is not warranted.
- **Approach: spec-first (primary)** — PLAN.md is already the spec log; the pure score-op and validator modules are exactly spec-first material (acceptance = tests). **Design-first for the Editor/dock placement** of any new verb (DESIGN.md is a hard rule). **Prototype-first for the one open unknown** (does a local LLM + validator + retry reliably produce valid YuE2 ABC, and does the VRAM hand-off hold).
- **Entry stage:**
  - For the existing app: no stage-7 rebuild. Do a short verification pass on the red CI step (R-012) and the redesign slices (F-007, F-008, F-006), then merge S4 or park it. This is stage 7 for those features only.
  - For the score agent: **stage 1 (decide scope, Q-001..Q-003) then stage 2 (feasibility) then stage 3 (spike)**, before stage 4 scope and stage 5 design. Do not build or mock further against the old Editor.
- Rationale in one line: the core promise is proven on a fake and CI is red on the new Activity surface, so fix and verify first; the new feature's biggest risks are scope and unknowns, so decide and spike before designing.
