# Brief — Mulakai (reconstructed by adopt audit, 2026-10-03)

> Reconstructed from README.md, CLAUDE.md, AGENTS.md, PLAN.md headings and the code. Every guess is marked (inferred). Not yet signed off by the user.

## Core promise
**Amended 2026-10-06 (D-079, D-096):** talk a song into being. Describe it, or start from a reference song, get the first take, then improve it turn by turn in a chat with the local LLM, each turn changing only what was asked; the editor tools below stay as the scalpel. (PLAN.md "Chat: Talk a Song Into Being".)

Original promise: A single user can generate a song locally, then edit it in place without leaving one editor: repaint a time range, layer a new instrument or vocal over the mix, keep every iteration as a version they can revert to, and export the result. (README: "generate → repaint → layer → version → export".)

## For whom
One person on one Windows machine with a local GPU (16 GB VRAM, inferred from PLAN.md YuE2 notes), running ACE-Step 1.5 and optional extra engines as separate local processes. Today they would use ACE-Step's own Gradio UI or a full DAW; neither keeps per-layer version history around region-level AI edits (inferred).

## MVP is done when (as the repo implies; the MVP shipped long ago and the app is past it)
- Generate from a prompt (YuE2 by default from D-015, ACE-Step opt-in or when YuE2 isn't set up; HeartMuLa marked for removal, D-014) and see the song in the Library.
- Select a range on a layer, repaint it, get a new lilac version; revert to the old one.
- Add a layer from a description; hear it summed with the rest; export mix / stems / remaster.
- Everything above survives a reload; jobs fail visibly instead of hanging.
- (seen running) The golden-path e2e covers the first four against a fake ACE-Step.

## Redesign status (PLAN.md "UI Redesign ... (planned 2026-10-03)")
| Slice | State | Evidence |
|---|---|---|
| Spec | merged (#112) | seen in git |
| S1 Action Dock (verb tabs, LYRICS lane, versions-only rail, MIX export) | merged (#115, 2026-10-03) | seen in code: ActionDock.tsx etc.; RepaintBar/EditorLeftRail/AddLayerTrigger/ExportPanel deleted |
| S2 Guided Create (START FROM cards, RECIPE card, QUALITY presets, ETA) | merged (#114) | seen in code: StartFromCards, RecipeCard, qualitySteps, etaStore; SettingsPanel deleted |
| S3 Command palette, Activity drawer, Library CONTINUE row | merged (#113) | seen in code: CommandPalette, ActivityDrawer, ContinueRow, songsRecent |
| S4 Server job queue (genQueue, UP NEXT, CANCEL) | NOT merged: branch feat/job-queue has 3 commits (9d76767, 0d0976b, 1514a8c, "part a"); main still has genLock.ts, no genQueue.ts | seen in git |
| Deferred inside redesign | A/B compare; MIX as FLAC/MP3; queue pause while ACE-Step down; folder select in recipe | PLAN.md open questions 1-4 |

## Candidate new feature (NOT built): SCORE AGENT for YuE2 songs
Source: a prior mockup-only design session; nothing in code or PLAN.md (seen: no LLM_API_URL/ollama anywhere in server/, client/, PLAN.md).
- A local LLM (OpenAI-compatible endpoint via a new `LLM_API_URL`) turns "jazz choruses, 88 BPM, add a sax solo" into a list of deterministic score operations (SET TEMPO, TRANSPOSE, REHARMONIZE bars, REPEAT/CUT section, REWRITE LYRICS, EDIT STYLE, free-form WRITE PHRASE with check + retry up to 3).
- Mulakai code applies them to the song's saved `score.abc` sidecar and validates (bar sums, melody contract EXACT/PITCHES/FREE, YuE2 chord vocabulary, 4,096-token planning budget; upstream `skills/yue2-music/abc_tools.py` is the Apache-2.0 reference).
- With YuE2 the default first take (D-015), SCORE is the main edit path for new songs: score edits first, ACE-Step audio edits after (D-006, Q-015).
- The user reviews a change list, checks and bar map, then APPLY & RENDER re-renders the whole song on YuE2 as a new lilac version. The planner unloads before render (16 GB VRAM).
- Seen in code today: the sidecar exists (`versionFiles.ts` writes `${versionId}.abc`; `songPersist.ts`), YuE2 cover requests already accept a caller-supplied `abc` (`yue2.ts` `buildYue2CoverRequest`, `engineCovers.ts` USE .ABC FILE), and `abcMeta.ts` reads Q/K/M. Not present: any score editor, any LLM client, any score validator, any score route on an existing version.
- Scope conflicts (details in open-questions.md Q-001..Q-003): PLAN.md "Engine: YuE2" and "YuE2: Align With Upstream" say ABC score editing / agentic editing is out of scope; AGENTS.md says every edit after the first take runs on ACE-Step. PLAN.md 5598 already walked part of this back for section picking only ("Note-level editing stays out").
- Placement: the mockup (SCORE · YUE2 mode in the old Editor prompt bar, history rail, left score panel) predates the redesign; the prompt bar, left column and multi-mode right rail it relied on are deleted on main (inferred conflict, seen in code: RepaintBar.tsx, EditorLeftRail.tsx, RailMode gone).

## Non-goals (v1, from AGENTS.md / README)
- No multitrack arrangement DAW; one song open at a time.
- No accounts, sharing, playlists, social layer, video generation.
- No VST/MIDI/synth/collaboration/plugin host (ACE-Step-DAW's layers).
- No LoRA/training before 1.0 (FORGE_PLAN.md, deferred).
- Desktop-only layout.

## Constraints
- Windows 11 host; ACE-Step 1.5 external HTTP process (Mulakai's fork since D-203); YuE2 Linux-only, runs in WSL2 behind `yue-server/` (PLAN.md; documented); HeartMuLa behind `heartmula-server/` (marked for removal, D-014).
- 16 GB VRAM single GPU shared by ACE-Step, YuE2, HeartMuLa, Demucs/UVR (inferred from PLAN.md); one GPU job at a time via `genLock.ts` today.
- Design system is a hard rule (DESIGN.md: zero radius, one hue per job, acid commit only, consequence line before every generative commit).
- Local-only, localhost bind, no auth (documented, docs/AUDIT.md).
- Module size target 150 / cap 200 LOC (AGENTS.md); the audit found no non-test source file over 200 LOC at the time of check (see audit.md).

## Approach & track
Recommended, not yet decided: see audit.md "Recommendation" (track standard; spec-first primary with design-first for UI; prototype-first for the score agent's LLM question). Becomes D-### after the user confirms.

<!-- Not signed off. Needs the user's confirmation of the inferred items (Q-004). -->
