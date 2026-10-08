# Graph Report - mystifying-wu-90ac74  (2026-10-08)

## Corpus Check
- 1560 files · ~1,617,337 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 9146 nodes · 21112 edges · 601 communities (425 shown, 176 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 947 edges (avg confidence: 0.75)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1f764f91`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Backend Generation & Job Services
- Editor UI Components
- App Shell & Library UI
- Project Docs & Design Concepts
- Core Song/Layer/Version API
- Lyrics & Export Panel
- API Client & Create Flow
- Server Package Config
- Client Package Config
- Voice Picker & Management
- Playback Mix Engine
- Client TSConfig (app)
- Advanced Generation Settings
- AI Thinking & Create View
- Song Detail & Refine Rail
- Client TSConfig (node)
- Add-Layer & Mix Bounce
- Settings Store
- Server TSConfig
- Icon Sprite Assets
- Core Domain Entities (Plan)
- Tech Stack & Structure Docs
- Client Lint Config
- Demucs Stem-Split Server
- FileTags Test Suite
- Player & Mix Polish (Plan)
- RepaintJobs Test Suite
- RemasterJobs Test Suite
- Client TSConfig Root
- Voices Route Test
- CompleteGenJobs Test Suite
- CoverGenJobs Test Suite
- Jobs Service Test Suite
- Spec-Driven Dev Workflow
- Adapter & Init API
- ACE-Step Model Architecture
- Autogen & Random Factors
- Caption & Lyrics Guide
- Human-Centered Design Philosophy
- AI States & Motion Design
- Output File Metadata (Plan)
- Git Workflow Rules
- Red Lines (Never Do)
- SettingsPanel.tsx
- Claude Commands
- Favicon Brand Icon
- Format-Input API Endpoint
- Models List API Endpoint
- FORGE — LoRA/LoKr Training & Dataset Studio (planning doc, not yet implemented)
- 4. Create Generation Task
- lyricSections.ts
- CreateView.tsx
- demucs-server
- 13. Environment Variables
- Mulakai — UX & Visual Polish Notes
- FakeAudio
- lyricTags.ts
- 5. Batch Query Task Results
- 6. Format Input
- 7. Get Random Sample
- 9. Initialize or Switch Models
- genLock.ts
- React + TypeScript + Vite
- 10. Server Statistics
- 11. Download Audio Files
- 8. List Available Models
- addLayerJobs.test.ts
- 1. Authentication
- Training API
- Mulakai client entry (index.html)
- Design System Mandate
- Demucs (stem separation model)
- demucs-server Python dependencies
- POST /query_result
- POST /release_task
- Complete task (accompaniment from single track)
- DiT (Diffusion Transformer, Executor)
- Elephant Rider Metaphor
- Lego task (add tracks)
- Lyrics (temporal script)
- Random Factors (seed/temperature/sde)
- Reference Audio control
- Source Audio / Repaint task
- Turbo Series models
- XL (4B) models
- Acid — commit actions
- App Model (flat top-level views)
- Carbon — structure
- Create view
- Editor view (layer stack, timeline, rail)
- Library view
- Lilac — versions/history/AI markers
- Rust — errors/warnings/trash
- Settings view (4th peer screen)
- Sky — selection/scope
- ace-step-ui-main TrainingPanel.tsx reference
- ACE-Step Adapter (LoRA) API surface
- ACE-Step Dataset API surface
- FORGE (LoRA/LoKr Training & Dataset Studio)
- ACE-Step Training API surface
- training_runs SQLite table
- ACE-Step Integration (native FastAPI)
- Add Layer (lego) Phase 6+7 Design
- client/src/AddLayer.tsx
- Custom Player Controls
- The Editing Model (layer stack)
- Export & Remaster — Phase 9 Design
- Layer entity
- Layer Stack Polish + Live Multi-Layer Playback
- client/src/LayerStack.tsx
- mix/bounceMix.ts
- mix/decodeLayers.ts
- mix/playbackEngine.ts
- Output File Metadata
- Playback Engine (Web Audio/Tone.js)
- client/src/Player.tsx
- server/src/services/remasterJobs.ts
- Repaint Editor UX Upgrade
- Settings Screen (4th peer screen)
- Song entity
- Task-Type Mapping Table
- Version entity
- Waveform.tsx
- settings.ts
- Add Layer (lego) — Phase 6+7 Design (planned 2026-07-02)
- Repaint Editor UX Upgrade (planned 2026-07-02)
- Export & Remaster — Phase 9 Design (planned 2026-07-06)
- AIGeneratingBackground.tsx
- Add Layer Lyrics (implemented 2026-07-08)
- Universal Advanced Settings (Repaint + Add Layer) (implemented 2026-07-08)
- Create AUDIO/ARRANGE Flows — `cover` and `complete` (implemented 2026-07-07)
- backfillGenTask.test.ts
- api.ts
- songImport.test.ts
- Create Draft Persistence + Origin-Aware Reuse (planned 2026-07-30)
- FakeAudio
- devDependencies
- MoveToEditorAction.tsx
- AdaptersSection.tsx
- SettingsView.tsx
- Waveform.tsx
- generationStore.ts
- adapters.test.ts
- inferenceSteps.ts
- adapterStore.test.ts
- apiStatusStore.ts
- lyricSections.ts
- compilerOptions
- Adapter Loading (LoRA/LoKr) at Inference (planned 2026-07-31)
- adapters.test.ts
- SectionStrip.tsx
- Style Tag Vocabulary for the Caption Field (planned 2026-07-31)
- Output Format: Rate / Depth / Bitrate, Everywhere (planned + implemented 2026-07-31)
- STEPS AUTO Resolves Per Model (planned 2026-07-31)
- songLayers.test.ts
- songs.test.ts
- adapterStore.test.ts
- waveformPeaks.ts
- api.multipart.test.ts
- ExportPanel.tsx
- JobStore
- Exception
- engineGenJobs.ts
- .publish
- stemSplit.reextract.test.ts
- JobCancelled
- Multiple Song-Creation Engines (planned 2026-09-30)
- heartmula.ts
- .submit
- main.py
- yue-server
- engine_api.py
- Mulakai
- SongEngine
- run_job
- timingsJobs.test.ts
- CustomSelect.tsx
- engineGenJobs.test.ts
- abcMeta.ts
- yue2.ts
- heartmula-server
- test_store_and_worker.py
- README.md
- engines.test.ts
- 🟠 Correctness
- uvr-server
- generationStore.test.ts
- Color tokens
- YuE2 Melody Covers via SheetSage2 (planned 2026-09-30)
- engineClient.test.ts
- registry.test.ts
- The Newest Library Search Wins (planned 2026-10-02)
- Upstream Sync: `complete`/`lego` Skip the LM (planned + implemented 2026-09-30)
- UVR Separator: Roformer Vocals for SPLIT (planned + implemented 2026-09-30)
- COVER and ARRANGE Reference Audio: No Influence Sliders (planned + implemented 2026-09-30)
- Text2music Reference Audio: Style Influence Only (planned + implemented 2026-09-30)
- RE-EXTRACT Never Touches a Claimed Stem (planned 2026-10-02)
- transcribeStore.test.ts
- 1. Authentication
- Cover Lyrics From the Recording (planned 2026-10-01)
- voiceStore.test.ts
- editorJobStore.test.ts
- Motion
- 5. Batch Query Task Results
- 6. Format Input
- E2E Fails on Uncaught Page Errors (planned 2026-10-02)
- Style Tag Vocabulary for the Caption Field (planned 2026-07-31)
- ANALYZE AUDIO on COVER · YUE2 (planned 2026-10-01)
- YuE2 Covers: Pick the Score's Sections (planned 2026-10-01)
- 10. Server Statistics
- test_api.py
- Mulakai — UX & Visual Polish Notes
- Vendored ACE-Step 1.5 documentation
- Add Layer Lyrics (implemented 2026-07-08)
- ShaderCanvas.tsx
- engineTranscribeClient.test.ts
- Training API
- YuE2: Align With Upstream's `yue2-music` Skill (planned 2026-09-30)
- fake_infer.py
- README.md
- Path
- Engine
- FastAPI
- Settings
- Engine
- Exception
- JobStore
- Path
- READ LYRICS With TRANSCRIBE for Uploads (planned 2026-10-01)
- lyrics.test.ts
- lyricsClient.test.ts
- tsconfig.json
- 12. Health Check
- 1. Authentication
- A Failed Editor Job Blocks Nothing (planned 2026-10-01)
- A Settled Split Blocks Nothing (planned 2026-10-01)
- fake_infer.py
- README.md
- FastAPI
- Path
- Path
- Path
- Path
- Upstream Sync: `complete`/`lego` Skip the LM (planned + implemented 2026-09-30)
- UVR Separator: Roformer Vocals for SPLIT (planned + implemented 2026-09-30)
- A Failed Editor Job Blocks Nothing (planned 2026-10-01)
- backfillGenTask.test.ts
- Path
- Runner
- Path
- Path
- Path
- FastAPI
- Settings
- FastAPI
- FastAPI
- Path
- Split Health: Which Service, and Why It's Off (planned 2026-10-02)
- Exception
- JobStore
- Settings
- voiceStore.test.ts
- ACE-STEP COVER's Source Holds Still Too (planned 2026-10-02)
- RE-EXTRACT Never Touches a Claimed Stem (planned 2026-10-02)
- 12. Health Check
- registry.ts
- FastAPI
- Path
- 12. Health Check
- Path
- GenerateRequest
- Path
- splitHealth.test.ts
- Abandoned Splits Leave No Stems Behind (planned 2026-10-02)
- ReferenceAudioPicker.tsx
- versionsTimings.test.ts
- ReferenceAudioPicker.tsx
- stemSplit.evict.test.ts
- FastAPI
- Path
- FastAPI
- Voice
- Playwright Golden-Path E2E (planned 2026-10-02)
- Path
- FastAPI
- Mulakai — Agent Instructions
- Repaint Crossfade Is Clamped at Submit (planned 2026-10-02)
- api.py
- COVER and ARRANGE Reference Audio: No Influence Sliders (planned + implemented 2026-09-30)
- Exception
- Worker
- A Dropped Generation Stops Polling (planned 2026-10-02)
- COVER Sends the Settings It Shows (planned 2026-10-02)
- Add Layer Mixes Each Layer at Its Own Volume (planned 2026-10-02)
- Create-Side Lookup Failures (planned 2026-10-02)
- transcribe_routes.py
- Universal Advanced Settings (Repaint + Add Layer) (implemented 2026-07-08)
- test_api.py
- make_transcriber
- test_api.py
- Idle Jobs Leave Every Registry (planned 2026-10-02)
- jobRegistry.evict.test.ts
- .new_job
- registry.ts
- adapterStore.test.ts
- RefineResult
- FakeAudio
- waveformPeaks.ts
- config.py
- A Failed Editor Job Blocks Nothing (planned 2026-10-01)
- Model Status Badge (planned 2026-10-02)
- Path
- Engine
- FastAPI
- Settings
- Engine
- Exception
- JobStore
- Path
- Song
- previewPlayback.ts
- FakeAudio
- createPreviewPlayback
- lmJob.test.ts
- queuedJobs.test.ts
- generationJob.ts
- MoveToEditorAction.tsx
- PendingAudio
- FakeAudio
- backfillGenTask.test.ts
- queueKinds.test.ts
- generationStore.adopt.test.ts
- queueStore.test.ts
- layersRepaint.test.ts
- measure.py
- test_job_files.py
- test_job_files.py
- yue-server
- SP-4 · Keep the unchanged parts of a song through an edit (R-024)
- run
- scoreLimits.ts
- ui.mjs
- planJob.sections.test.ts
- test_api.py
- choose (letter, alteration) for a midi pitch in `key`; prefer the key signature,
- m2_driver.mjs
- planJob.cancel.test.ts
- planJob.phrase.test.ts
- planJob.test.ts
- pendingTakes.ts
- Findings
- RuntimeError
- SP-4 · Keep the unchanged parts of a song through an edit (R-024)
- scorePlan.revise.test.ts
- compilerOptions
- planner.py
- summary.md
- Brief — Mulakai (reconstructed by adopt audit, 2026-10-03)
- CP1 · headless live run after W2 (2026-10-03)
- scoreStatus.test.ts
- Mulakai — Agent Instructions
- Process audit — Mulakai (2026-10-03)
- Playbook — Mulakai
- m2_analyze.py
- Findings
- summarize.py
- m1_driver.mjs
- trials.mjs
- score.test.ts
- scoreRender.test.ts
- scoreRenderJob.test.ts
- scoreVersion.test.ts
- ports.ts
- test_api.py
- Findings
- planner_v1.py
- M1 verify — F-026, F-027, F-028
- report.py
- Grid
- Score Agent (planned 2026-10-03)
- 0003 · WRITE PHRASE takes notes with beats; code writes the ABC
- test_chain.py
- M2 F-033 REVISE live re-check after D-073 / D-076 (autopilot)
- Autopilot log
- phrase_wav.py
- build_listen.py
- m1_services.mjs
- m2_services.mjs
- services.mjs
- scorePlan.test.ts
- contextGuard.ts
- dockJobLine.test.ts
- 0001 · Planner transport: OpenAI-compatible chat plus Ollama-native control
- 0002 · Score logic runs on yue-server, not in TypeScript
- 0004 · Pending plans live in server memory, one per song
- transpose
- cp1_analyze.py
- onset_env
- Chat: Talk a Song Into Being (planned 2026-10-06)
- build_listen.py
- check_listen.mjs
- Status — Mulakai
- YuE2 Is the Default First-Take Engine (planned 2026-10-03)
- api.py
- 8. List Available Models
- make_inputs.py
- asr_spans.py
- make_tables.py
- checks.sh
- Remove the HeartMuLa Engine (planned 2026-10-03)
- scoreSource.test.ts
- api.py
- COVER and ARRANGE Reference Audio: No Influence Sliders (planned + implemented 2026-09-30)
- The Model List Waits Out a Busy ACE-Step (planned 2026-10-02)
- Universal Advanced Settings (Repaint + Add Layer) (implemented 2026-07-08)
- client.md
- graphify-out.md
- ui.md
- Action Dock
- E2E and fakes
- GPU job queue
- score-server.md
- versions-data.md
- yue-server.md
- make_spec.py
- build_near_budget.py
- count_tokens.py
- mk_near_variant.py
- ablations.sh
- ablations2.sh
- peek.sh
- peek2.sh
- aggregate.py
- make_asr_jobs.py
- make_heal_jobs.py
- prep_facts.py
- transcribe_outs.py
- words_at_cuts.py
- list_elig.mjs
- f030_direct.py
- list_elig.mjs
- m2_report.py
- Fraction
- Doc
- Doc
- FastAPI
- Doc
- Fraction
- Doc
- Doc
- Doc
- Fraction
- Doc
- Doc
- Doc
- shared_sampler.ps1
- tables.md
- block_report.py
- edges_transpose.py
- show_plan.py
- adapterStore.test.ts
- quickStartStore.test.ts
- 0003 · WRITE PHRASE takes notes with beats; code writes the ABC
- phrase_wav.py
- build_listen.py
- save_flac
- CP-C1, analysis and marks on the real machine (2026-10-08 local, re-run after #210)
- Scope — Engine pairing (ACE-Step 1.5 × YuE2)
- chatReferencesRead.test.ts
- createCover.test.ts
- readCommit.test.ts
- turnJob.test.ts
- lookup.test.ts
- 0005 · The chat's splice runs on yue-server as a `splice` job
- 0006 · A chat turn is one `plan`-kind job, and an edit's ops come in the turn's reply
- 0007 · Threads, messages and the draft in SQLite; proposals in memory
- 0008 · A reference song is read by one queued job and kept as a copy with the thread
- 0009 · A saved version is read by the reference-reading job, and "this" is a referent
- 0001 · Planner transport: OpenAI-compatible chat plus Ollama-native control
- 0002 · Score logic runs on yue-server, not in TypeScript
- 0004 · Pending plans live in server memory, one per song
- heal.py
- Sc
- Modules — server, `server/src/services/chat/` (new folder beside `score/`)
- CP-C0, edit leg (2026-10-07)
- CP-C1, analysis and marks on the real machine (2026-10-07)
- CP-C3, reference songs (2026-10-07)
- C0a code review (diff 41fa159...0ab70e1)
- C0b code review (edit turn, splice, versions) — lens: code
- C3 code review (reference songs) — lens: code
- cancel_splice.mjs
- Studio Network: Server on home.lan, GPU PC Wakes on Demand (planned 2026-10-06)
- chatReferences.test.ts
- analysisTrigger.test.ts
- referenceStore.test.ts
- songStateSource.test.ts
- repaintLineage.test.ts
- scoreMidi.test.ts
- build_listen.py
- m0_analyze.py
- Context skeleton (to land in W0)
- Modules
- CP-C0a, create leg (2026-10-06)
- CP-C1 notes (2026-10-07)
- Interaction specs (chat)
- E2 — Pairing verbs (F-083, F-085, F-086, F-087)
- make_results.py
- analyze2.py
- pairs.mjs
- chatMark.test.ts
- createFromDraft.test.ts
- yueSpliceClient.test.ts
- asr_spans.py
- make_tables.py
- config.py
- E1 — Quick wins (F-082, F-084, F-088)
- run_all.sh
- run_all2.sh
- run_all3.sh
- results.md
- results2.md
- build_listen.mjs
- chatTurnsAttach.test.ts
- readTarget.test.ts
- chatPoll.test.ts
- zustandServerSnapshot.ts
- prep.py
- serve.mjs
- E2E Fails on Uncaught Page Errors (planned 2026-10-02)
- Footer Player Shows, Dims and Hides With Playback (planned 2026-10-07)
- Export a Score as MIDI (planned 2026-10-07)
- gridCache.test.ts
- chat-client.md
- chat-server.md
- e2e.md
- job-queue.md
- score-server.md
- splice.md
- versions-data.md
- yue-server.md
- Client (TypeScript)
- graphify-out (generated)
- ui.md
- build_near_budget.py
- count_tokens.py
- mk_near_variant.py
- ablations2.sh
- ablations.sh
- peek2.sh
- peek.sh
- aggregate.py
- make_asr_jobs.py
- make_heal_jobs.py
- prep_facts.py
- transcribe_outs.py
- words_at_cuts.py
- m2_report.py
- build_listen.py
- fake_infer.py
- Fraction
- ndarray
- chk.sh
- peek.sh
- run.sh
- setup.sh

## God Nodes (most connected - your core abstractions)
1. `Decisions` - 213 edges
2. `Open questions` - 107 edges
3. `Mulakai — Project Plan` - 89 edges
4. `useCreateDraftStore` - 63 edges
5. `ScoreFacts` - 62 edges
6. `map` - 61 edges
7. `wasAborted()` - 56 edges
8. `config` - 55 edges
9. `api` - 54 edges
10. `useSettings` - 53 edges

## Surprising Connections (you probably didn't know these)
- `sleep()` --indirect_call--> `r()`  [INFERRED]
  pipeline/verify/C0b/cancel_splice.mjs → client/src/scoreRender.test.ts
- `slowAceStep()` --indirect_call--> `r()`  [INFERRED]
  server/src/services/adapters.test.ts → client/src/scoreRender.test.ts
- `chat()` --indirect_call--> `e()`  [INFERRED]
  pipeline/spikes/SP-2-planner-quality/planner.py → server/src/services/chat/proposalStore.test.ts
- `chat()` --indirect_call--> `e()`  [INFERRED]
  pipeline/spikes/SP-2-planner-quality/planner_v1.py → server/src/services/chat/proposalStore.test.ts
- `proxy()` --indirect_call--> `e()`  [INFERRED]
  pipeline/verify/M1/m1_services.mjs → server/src/services/chat/proposalStore.test.ts

## Import Cycles
- 3-file cycle: `server/src/services/chat/chatTypes.ts -> server/src/services/chat/reading.ts -> server/src/services/chat/recipeRules.ts -> server/src/services/chat/chatTypes.ts`
- 4-file cycle: `server/src/services/chat/analysisTypes.ts -> server/src/services/chat/reading.ts -> server/src/services/chat/recipeRules.ts -> server/src/services/chat/chatTypes.ts -> server/src/services/chat/analysisTypes.ts`
- 4-file cycle: `server/src/services/chat/chatTypes.ts -> server/src/services/chat/reading.ts -> server/src/services/chat/recipeRules.ts -> server/src/services/chat/draftFields.ts -> server/src/services/chat/chatTypes.ts`
- 4-file cycle: `client/src/dockTarget.ts -> client/src/scoreEnds.ts -> client/src/scoreCopy.ts -> client/src/scoreReferentCopy.ts -> client/src/dockTarget.ts`
- 5-file cycle: `server/src/services/chat/analysisTypes.ts -> server/src/services/chat/reading.ts -> server/src/services/chat/recipeRules.ts -> server/src/services/chat/draftFields.ts -> server/src/services/chat/chatTypes.ts -> server/src/services/chat/analysisTypes.ts`
- 5-file cycle: `client/src/dockTarget.ts -> client/src/scoreEnds.ts -> client/src/scoreCopy.ts -> client/src/scoreReviseCopy.ts -> client/src/scoreReferentCopy.ts -> client/src/dockTarget.ts`

## Communities (601 total, 176 thin omitted)

### Community 0 - "Backend Generation & Job Services"
Cohesion: 0.05
Nodes (77): ChatMessageState, ChatRecipeBody, ChatUserBody, abPrevious(), useChatAnalysisStore, and(), assistantOffLine(), blockersLine() (+69 more)

### Community 1 - "Editor UI Components"
Cohesion: 0.06
Nodes (43): RecentSong, RefineResult, ClearDraftButton(), ContinueRow(), Props, CreateBar(), Props, START_FROM (+35 more)

### Community 2 - "App Shell & Library UI"
Cohesion: 0.05
Nodes (84): aceOnlyNote(), COT_OPTIONS, EngineGenSettings(), SLIDERS, coverParams(), enginePromptParams(), PromptIntent, DRAFT (+76 more)

### Community 3 - "Project Docs & Design Concepts"
Cohesion: 0.01
Nodes (213): D-001 · 2026-10-03 · stage 1 · by: assumed, D-002 · 2026-10-03 · stage 3 · by: assumed, D-003 · 2026-10-03 · stage 4 · by: assumed, D-004 · 2026-10-03 · stage 1 · by: assumed, D-005 · 2026-10-03 · stage 1 · by: user, D-006 · 2026-10-03 · stage 1 · by: user, D-007 · 2026-10-03 · stage 5 · by: user, D-008 · 2026-10-03 · stage 1 · by: user (+205 more)

### Community 4 - "Core Song/Layer/Version API"
Cohesion: 0.04
Nodes (137): ChatRouteDeps, chatRouter, defaults, draftBlockers(), isLive(), jobView(), makeChatRouter(), threadBusy() (+129 more)

### Community 5 - "Lyrics & Export Panel"
Cohesion: 0.12
Nodes (32): ActivityButton(), ActivityDrawer(), Drawer(), Props, retryEntry(), ActivityEntry, EDITOR_BADGE, editorSettled() (+24 more)

### Community 6 - "API Client & Create Flow"
Cohesion: 0.18
Nodes (16): LyricTag, buildTagGuide(), clean(), Cluster, clusterByKeyword(), clusterByPrefix(), clusterBySuffix(), finalizeClusters() (+8 more)

### Community 7 - "Server Package Config"
Cohesion: 0.05
Nodes (39): 1. Reference Audio: Global Acoustic Feature Control, 2. Source Audio: Semantic Structure Control, 3. Source Audio Context-Based Control: Local Completion and Modification, 4. Base Model Advanced Audio Control Tasks, About Audio Control: Controlling Sound with Sound, About Caption: The Most Important Input, About Lyrics: The Temporal Script, About Music Metadata: Optional Fine Control (+31 more)

### Community 8 - "Client Package Config"
Cohesion: 0.05
Nodes (39): 1. Reference Audio: Global Acoustic Feature Control, 2. Source Audio: Semantic Structure Control, 3. Source Audio Context-Based Control: Local Completion and Modification, 4. Base Model Advanced Audio Control Tasks, About Audio Control: Controlling Sound with Sound, About Caption: The Most Important Input, About Lyrics: The Temporal Script, About Music Metadata: Optional Fine Control (+31 more)

### Community 9 - "Voice Picker & Management"
Cohesion: 0.17
Nodes (24): parse_abc(), Public import entry point; no model load, files, or optional dependencies., bar_range_of_line(), blocks_of(), body(), ins_window(), main(), music_lines() (+16 more)

### Community 10 - "Playback Mix Engine"
Cohesion: 0.04
Nodes (83): file, db, app, chatTurnsRouter, foldersRouter, layersRouter, outputMetadataRouter, remasterRouter (+75 more)

### Community 11 - "Client TSConfig (app)"
Cohesion: 0.08
Nodes (31): Any, create_app(), HTTP layer, built around an injected transcriber so tests need no model. Speaks, dominant_language(), make_transcriber(), faster-whisper with the settings PLAN.md's "Cover lyrics spike results" picked, The language most sung words are in: each 30 s window holding words votes its de, The model is loaded per job and freed afterwards, handing its VRAM back     to (+23 more)

### Community 12 - "Advanced Generation Settings"
Cohesion: 0.07
Nodes (86): generateRouter, generateAudioRouter, BOOLEAN_FIELDS, GEN_FIELDS, labelOnlyReferenceMeta(), NUMERIC_FIELDS, pickMultipartParams(), pickParams() (+78 more)

### Community 13 - "AI Thinking & Create View"
Cohesion: 0.06
Nodes (60): ScorePlan, ScoreRenderRun, ScoreStatusView, DockScore(), Props, clock(), jobLine(), readingLine() (+52 more)

### Community 14 - "Song Detail & Refine Rail"
Cohesion: 0.06
Nodes (78): AnalysisView, RangeMark, Shift, ShownBars, ShownReading, StripSection, chatAnalysisApi, failed (+70 more)

### Community 15 - "Client TSConfig (node)"
Cohesion: 0.05
Nodes (42): A Settled Split Blocks Nothing (planned 2026-10-01), ACE-Step Integration (verified against docs/en/API.md + INFERENCE.md, 2026-07-02), Add Layer: Forced batch_size 1 + Track-Type Picker (implemented 2026-07-10), Architecture, Architecture, Create AUDIO/ARRANGE Flows — `cover` and `complete` (implemented 2026-07-07), Create Bar Mirrors Create (planned 2026-10-07), Create Bar Status Chips (planned 2026-10-07) (+34 more)

### Community 16 - "Add-Layer & Mix Bounce"
Cohesion: 0.13
Nodes (28): asTagList(), CAP, captionToStyleTags(), Found, headKind(), Kind, modifiersBefore(), NOT_STYLE (+20 more)

### Community 17 - "Settings Store"
Cohesion: 0.07
Nodes (52): ScoreLyricDiff, bars(), chordName(), clip(), consequenceLine(), n(), names(), OpRow (+44 more)

### Community 18 - "Server TSConfig"
Cohesion: 0.07
Nodes (30): SP-6 throwaway: splice the forced-prefix renders (F, FB) into v1 with yue-server, UploadFile, create_app(), main(), FastAPI, Settings, Thin HTTP wrapper around the official YuE2 pipeline (https://github.com/multimo, add_retime_routes() (+22 more)

### Community 19 - "Icon Sprite Assets"
Cohesion: 0.48
Nodes (7): Bluesky Icon (butterfly logo, social link), Discord Icon (game controller/mask logo, social link), Documentation Icon (book with folded corner, docs link), GitHub Icon (Octocat cat logo, source-code link), Social Icon (person silhouette with star badge, community link), icons.svg Sprite Sheet, X (Twitter) Icon (stylized X logo, social link)

### Community 20 - "Core Domain Entities (Plan)"
Cohesion: 0.16
Nodes (17): lineRegion(), round2(), roundCovering(), sameRegion(), SPANS, widenToMinimum(), alignLyrics(), editDistance() (+9 more)

### Community 21 - "Tech Stack & Structure Docs"
Cohesion: 0.06
Nodes (42): coversApi, Transcription, editorApi, EngineControl, generationApi, ApiError, appendParams(), json() (+34 more)

### Community 22 - "Client Lint Config"
Cohesion: 0.09
Nodes (36): RunningActivityRow(), AIGeneratingBackground(), AIGeneratingBackgroundProps, useWaveVeil(), CardState, draftChipText(), DraftText, genCard() (+28 more)

### Community 23 - "Demucs Stem-Split Server"
Cohesion: 0.16
Nodes (9): _error(), Exception, JobStore, The single inference thread: loads the pipeline once, then runs queued jobs one, Only meaningful once ready; the submit routes return 503 before that., The score's size in the planner's tokens; None until the pipeline is loaded., run_job(), _save() (+1 more)

### Community 24 - "FileTags Test Suite"
Cohesion: 0.33
Nodes (5): createFromPath, fakeFile, fakeId3Tag, fakeTag, idSettings

### Community 25 - "Player & Mix Polish (Plan)"
Cohesion: 0.05
Nodes (77): ChatAnalyzeBody, ChatReadingBody, ChatReadingEstimate, isNotRead(), NotRead, ReadingCaption, ReadingPartSource, ReadingScore (+69 more)

### Community 28 - "Client TSConfig Root"
Cohesion: 0.14
Nodes (26): A SheetSage2 snapshot whose infer.py is tests/fake_infer.py., sheetsage(), test_a_failed_render_still_returns_the_score(), test_a_replayed_key_returns_the_same_transcription(), test_a_transcription_serves_its_score_preview_and_facts(), test_cancel_kills_a_running_transcription(), test_failures_say_what_sheetsage2_said(), test_health_says_why_transcription_is_unavailable() (+18 more)

### Community 32 - "Jobs Service Test Suite"
Cohesion: 0.07
Nodes (48): main(), config, __dirname, generateHelpersRouter, queueLm(), lyricsRouter, receiveSource(), upload (+40 more)

### Community 39 - "Human-Centered Design Philosophy"
Cohesion: 0.07
Nodes (27): 10. ~~Abort/persist race reverses an abort silently~~ — fixed, PR #107, 11. ~~Job registries never evict~~ — fixed, PRs #96 + #104, 12. ~~WebGL context leak in `ShaderCanvas`~~ — fixed, PR #108, 13. ~~`generationStore.pollJob` has no cancellation~~ — fixed, PRs #104 + #106, 14. Misc leaks, 15. UX inconsistencies, 16. Shader palette violation, 17. Server-side polish (+19 more)

### Community 47 - "Git Workflow Rules"
Cohesion: 0.10
Nodes (29): Props, ParsedText(), DockVerb, BASE_VERBS, dockVerbs(), SCORE_VERB, verbOfKey(), VerbSpec (+21 more)

### Community 48 - "Red Lines (Never Do)"
Cohesion: 0.02
Nodes (107): Open questions, Q-001 · blocking · stage 1 · answered → D-005, Q-002 · blocking · stage 5 · answered → D-007 (palette + Activity sub-questions stay open for stage 5), Q-003 · blocking · stage 1 · answered → D-006, Q-004 · assumable · stage 1 · answered → D-008, Q-005 · assumable · stage 4 · answered by the tree → D-022 (genQueue.ts present in the working tree; verify on main), Q-006 · assumable · stage 3 · open, Q-007 · blocking · stage 3 · assumed → D-010 (settled by upstream docs 2026-10-03; audible adherence spiked as R-013 / SP-3) (+99 more)

### Community 49 - "SettingsPanel.tsx"
Cohesion: 0.05
Nodes (72): makeScorePlanRouter(), PlanView, statusDeps, gpuGuard(), gpuGuardDeps, readingDeps, analyzeFor(), AnalyzeResolved (+64 more)

### Community 50 - "Claude Commands"
Cohesion: 0.04
Nodes (81): Song, App(), View, CommandActivityLayer(), Props, AppCommandDeps, appCommands(), GROUP_ORDER (+73 more)

### Community 58 - "FORGE — LoRA/LoKr Training & Dataset Studio (planning doc, not yet implemented)"
Cohesion: 0.05
Nodes (49): Layer, SongDetail, secs(), Props, Props, RepaintLineInput, EditorRail(), Props (+41 more)

### Community 59 - "4. Create Generation Task"
Cohesion: 0.15
Nodes (12): Configuration, Design, Development, Licence, Mulakai, Repository layout, Requirements, Running it (+4 more)

### Community 60 - "lyricSections.ts"
Cohesion: 0.16
Nodes (10): drop_kv_caches(), HeartMulaEngine, park(), _raise_if(), HeartMuLa behind the worker's Engine interface, with RAM parking.  Both models, torchtune 0.4's setup_cache skips any layer whose cache already exists,     so, test_drop_kv_caches_leaves_cacheless_modules_alone(), test_vram_cap_defaults_to_card_total_minus_2_gib() (+2 more)

### Community 61 - "CreateView.tsx"
Cohesion: 0.08
Nodes (45): AceGenTune(), AUTO, autoStepsLabel(), AddLayerTune(), AdvancedGenSettings(), INFER_METHOD_OPTIONS, ModelInventory, v() (+37 more)

### Community 62 - "demucs-server"
Cohesion: 0.10
Nodes (32): AbCarry, abPosition(), abReference(), abResume(), AbSide, abSource(), AbSources, abToggle() (+24 more)

### Community 63 - "13. Environment Variables"
Cohesion: 0.10
Nodes (33): EngineCapabilities, EngineInfo, coverEngines(), coverUnavailableReason(), durationReadout(), Engine, GatedField, languageOptions() (+25 more)

### Community 64 - "Mulakai — UX & Visual Polish Notes"
Cohesion: 0.24
Nodes (7): Props, DockJobs(), ScoreEndsClause(), stemClaimLine(), Props, SplitStemRow(), STEM_LABELS

### Community 65 - "FakeAudio"
Cohesion: 0.22
Nodes (6): BASE_ABC, OK, Op, read, REHARM, states()

### Community 66 - "lyricTags.ts"
Cohesion: 0.11
Nodes (36): t(), analysisPlan, AnalysisInput, AnalysisParts, AnalysisStepDeps, analyzeSteps(), bars(), base() (+28 more)

### Community 67 - "5. Batch Query Task Results"
Cohesion: 0.09
Nodes (29): RunningSources, gen, songDetail, SplitStatus, StemResult, AddLayerJob, AddLayerSubmission, EditorJob (+21 more)

### Community 68 - "6. Format Input"
Cohesion: 0.29
Nodes (3): GenerateRequest, The POST /v1/jobs body, validated before anything reaches the pipeline., yue2-serve's body, minus `n` (one take per job), plus a tolerated `id`     (Mul

### Community 69 - "7. Get Random Sample"
Cohesion: 0.05
Nodes (51): ChatAnalyzeTarget, ChatAskBody, ChatCreateStart, ChatDraft, ChatDraftFields, ChatDraftKey, ChatDraftPatch, ChatDraftPut (+43 more)

### Community 70 - "9. Initialize or Switch Models"
Cohesion: 0.09
Nodes (27): AnalysisState, AnalysisStep, AnalysisView, BarShift, FailedAnalysis, GAP_STEPS, LiveAnalysisJob, PART_OK (+19 more)

### Community 71 - "genLock.ts"
Cohesion: 0.09
Nodes (22): bar_seconds(), Each score section's start in seconds, for placing read lyrics by time (PLAN.md, (label, 0-based first bar) for each `% label` comment, in score order., One bar on the score's tempo grid, for sections past the last downbeat., downbeat.lab's first column; empty when the file is missing or unreadable., [{label, bar, seconds}] per section, or None when there is nothing to anchor it, read_downbeats(), section_bars() (+14 more)

### Community 72 - "React + TypeScript + Vite"
Cohesion: 0.06
Nodes (50): http(), log(), main(), SP-3 runner (run inside WSL, stdlib only): for each job body in jobs/, POST /v1/, render(), transcribe(), http(), log() (+42 more)

### Community 73 - "10. Server Statistics"
Cohesion: 0.06
Nodes (28): test_a_supplied_score_is_checked_and_stripped_for_melody(), test_an_instrumental_cover_moves_the_supplied_melody_to_ins(), test_happy_path_serves_flac_score_and_result(), test_health_reports_loading_then_failed(), test_idempotency_key_replays_the_original_job(), test_truncated_job_keeps_its_audio(), noop(), test_a_chordless_plan_is_generated_with_cot_melody() (+20 more)

### Community 74 - "11. Download Audio Files"
Cohesion: 0.07
Nodes (43): abc(), Build the planner prompt and the two yue-server job bodies from real library dat, defaults(), Facts, makeScoreRouter(), pickable(), reading(), ScoreRouteDeps (+35 more)

### Community 75 - "8. List Available Models"
Cohesion: 0.09
Nodes (35): SplitHealth, ENGINE_NOTES, EnginesSection(), status(), EngineState, useEngineStore, Lookup, acestepRow() (+27 more)

### Community 77 - "1. Authentication"
Cohesion: 0.07
Nodes (15): _flag(), Environment configuration for yue-server. Every knob is optional; the defaults, Settings, Adapter over the official YuE2 pipeline (`yue2-infer`, installed into this venv, Forwards to the pipeline's stage reporter and mirrors update() calls., Move weights to system RAM and hand the cached VRAM back., _StageTap, _tapped() (+7 more)

### Community 78 - "Training API"
Cohesion: 0.14
Nodes (14): Engine: HeartMuLa (ships second), Engine picker UI decisions (2026-09-30, `feat/engine-picker-ui`), Engine: YuE2 (ships first), File-level plan, Framework decisions (2026-09-30, `feat/engine-framework`), General engine design (decided once, shared by every engine), heartmula-server decisions (2026-09-30), HeartMuLa spike results (2026-09-30) (+6 more)

### Community 133 - "Waveform.tsx"
Cohesion: 0.08
Nodes (24): dependencies, framer-motion, react, react-dom, zustand, devDependencies, oxlint, @types/node (+16 more)

### Community 134 - "settings.ts"
Cohesion: 0.31
Nodes (8): fit_to_ceiling(), Write the engine's float audio as a lossless FLAC master.  HeartMuLa's float p, Return (audio, gain_db). Only ever turns down, never up., write_flac(), test_audio_within_the_ceiling_is_untouched(), test_non_finite_samples_are_rejected(), test_over_full_scale_is_turned_down_to_the_ceiling(), test_write_flac_is_24_bit_stereo_without_clipping()

### Community 135 - "Add Layer (lego) — Phase 6+7 Design (planned 2026-07-02)"
Cohesion: 0.07
Nodes (55): test_section_tags_come_from_the_score_comments(), `% pre-chorus` → `[Pre-Chorus]`, as upstream's `lyric_tags` writes them., section_tags(), block_facts(), follow(), join_blocks(), _name(), _occurrence() (+47 more)

### Community 136 - "Repaint Editor UX Upgrade (planned 2026-07-02)"
Cohesion: 0.17
Nodes (12): Cover Lyrics From the Recording (planned 2026-10-01), Cover lyrics spike results (2026-10-01), Decisions (proposed; the spike confirms or changes them), File-level plan, lyrics-server contract (PR 1, 2026-10-01), Mulakai server for READ LYRICS (PR 2, 2026-10-01), Open questions, READ LYRICS browser check (2026-10-01) (+4 more)

### Community 137 - "Export & Remaster — Phase 9 Design (planned 2026-07-06)"
Cohesion: 0.08
Nodes (46): sectionsOf(), AnalyzeTarget, ReadingBody, coverVerdict, draftBpm(), draftKey(), draftMeter(), isObject() (+38 more)

### Community 138 - "AIGeneratingBackground.tsx"
Cohesion: 0.10
Nodes (11): reading(), contexts, ctxNow(), durations, Engine, FakeContext, FakeSource, flushEnded() (+3 more)

### Community 139 - "Add Layer Lyrics (implemented 2026-07-08)"
Cohesion: 0.08
Nodes (41): bars_text(), note_count(), OpError, A native YuE2 score that upstream's parse_abc has already accepted, held as hea, An op that cannot be applied; the message goes back to the planner as is., chord_text(), _chords_by_bar(), The score ops: M0's SET_TEMPO, REHARMONIZE and EDIT_STYLE (D-018), M1's WRITE_P (+33 more)

### Community 140 - "Universal Advanced Settings (Repaint + Add Layer) (implemented 2026-07-08)"
Cohesion: 0.04
Nodes (104): AnalyzeAudioButton(), Props, analyzeAndWait(), AnalyzeCancelled, ScoreSize, EngineId, blob(), AutoReadFacts (+96 more)

### Community 141 - "Create AUDIO/ARRANGE Flows — `cover` and `complete` (implemented 2026-07-07)"
Cohesion: 0.11
Nodes (22): ActiveAdapterNote(), AdapterAddForm(), AdaptersSection(), AdapterStrength(), activeAdapter(), adapterConsequence(), AdapterState, deleteAdapter (+14 more)

### Community 142 - "backfillGenTask.test.ts"
Cohesion: 0.04
Nodes (111): mode(), defaults(), GONE, makeScoreRetimeRouter(), MODES, ScoreRetimeDeps, scoreRetimeRouter, calls (+103 more)

### Community 143 - "api.ts"
Cohesion: 0.14
Nodes (15): Fetch, test_demucs_looks_again_after_download(), test_demucs_still_missing_after_download_raises(), test_demucs_uses_an_installed_model_without_resolving(), test_reuses_the_cached_entry(), test_unknown_hash_leaves_it_to_the_runner(), test_writes_the_upstream_entry_for_the_hash(), demucs_model_path() (+7 more)

### Community 144 - "songImport.test.ts"
Cohesion: 0.05
Nodes (71): chatApi, ChatAttach, ChatFailedBody, ChatStatus, ChatThreadView, chatEditApi, chatReferencesApi, analysisRunning() (+63 more)

### Community 145 - "Create Draft Persistence + Origin-Aware Reuse (planned 2026-07-30)"
Cohesion: 0.15
Nodes (28): ChatAnalysisDeps, chatAnalysisRouter, defaults, makeChatAnalysisRouter(), songAnalysisView(), songLive(), liveAnalysis(), done() (+20 more)

### Community 146 - "FakeAudio"
Cohesion: 0.05
Nodes (44): check_contract(), Contract fixtures (D-039): each score-route request and the reply pytest saw, s, check_plan(), {ok, problems, differences}, stage by stage: the bar ops' checks     (score_che, lyrics_of(), Lyrics for the section-op tests: the block layout (tags and line counts) of the, library(), Shared data for the score-agent tests: SP-2's golden cases (10 library sidecars (+36 more)

### Community 147 - "devDependencies"
Cohesion: 0.17
Nodes (11): devDependencies, @playwright/test, tsx, @types/node, typescript, name, private, scripts (+3 more)

### Community 148 - "MoveToEditorAction.tsx"
Cohesion: 0.06
Nodes (35): PlanCause, scoreApi, ScoreChord, ScoreOp, ScorePhraseNote, ScorePlanRun, ScorePlanState, ScoreReading (+27 more)

### Community 149 - "AdaptersSection.tsx"
Cohesion: 0.25
Nodes (8): Browser check, PR 2 (2026-10-02), Browser check, PR 3 (2026-10-02), Decisions, Editor Word Timestamps: Click a Lyric Line (planned 2026-10-02), File-level plan, Open questions, Timing spike (2026-10-02), What is there today (checked 2026-10-02)

### Community 150 - "SettingsView.tsx"
Cohesion: 0.09
Nodes (34): beatsPerBar(), BPM, buildOpSchema(), checkOps(), isInt(), obj(), op(), OP_NAMES (+26 more)

### Community 151 - "Waveform.tsx"
Cohesion: 0.05
Nodes (61): EditBody, no(), span(), Splice, spliceEligibility(), SpliceInput, SpliceKind, facts (+53 more)

### Community 152 - "generationStore.ts"
Cohesion: 0.13
Nodes (25): arg(), DATA, events, gpu, log(), logFile, main(), OLLAMA (+17 more)

### Community 153 - "adapters.test.ts"
Cohesion: 0.18
Nodes (11): Client cover decisions (2026-10-01, `feat/yue-cover-ui`), Cover spike results (2026-09-30), Decisions, File-level plan, Mulakai server cover decisions (2026-10-01, `feat/yue-cover-server`), Open questions, Rollout, Upstream skill-doc review (2026-09-30) (+3 more)

### Community 154 - "inferenceSteps.ts"
Cohesion: 0.06
Nodes (53): test_set_tempo_appends_a_bpm_when_the_style_names_none(), bar_sums(), _bar_units(), check_edit(), _chords_per_bar(), message(), Checks around upstream's parser and comparer: a score's verdict (upstream's own, {ok, problems, differences} for an edit made by `ops` (the applied ones);     d (+45 more)

### Community 155 - "adapterStore.test.ts"
Cohesion: 0.23
Nodes (4): JobFiles, The on-disk side of /split: each split gets a job dir under data_dir, and its s, Make the stems downloadable; returns kind -> path under /audio., _remove()

### Community 156 - "apiStatusStore.ts"
Cohesion: 0.10
Nodes (19): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+11 more)

### Community 157 - "lyricSections.ts"
Cohesion: 0.13
Nodes (20): mix_into(), output_path(), The two-pass split behind /split. See PLAN.md "UVR Separator: Roformer Vocals f, Where uvr-headless-runner writes a stem: `{base}_({Stem}).wav`., Add `extra` into `target` in place, keeping float32 WAV., Separate `src` into Mulakai's four StemKinds, as float32 WAVs under `out_dir`., _require(), run_chain() (+12 more)

### Community 158 - "compilerOptions"
Cohesion: 0.06
Nodes (58): Named, SCALPEL_KINDS, SchemaInput, DraftFields, TurnAction, EditBase, CheckContext, CheckDeps (+50 more)

### Community 159 - "Adapter Loading (LoRA/LoKr) at Inference (planned 2026-07-31)"
Cohesion: 0.14
Nodes (26): agree(), agree_tones(), analyse(), best_offset(), both(), chance(), chance_tones(), f1() (+18 more)

### Community 160 - "adapters.test.ts"
Cohesion: 0.09
Nodes (11): flush(), Follow, follows, result, card, sleep(), loadLora, loraStatus (+3 more)

### Community 161 - "SectionStrip.tsx"
Cohesion: 0.05
Nodes (40): R-001 · impact M · evidence platform, R-002 · impact H · evidence proven, qualified (SP-2, 2026-10-03: seen running; [RESULT](spikes/SP-2-planner-quality/RESULT.md); musicality listen OWED), R-003 · impact H · evidence proven (SP-1, 2026-10-03: [RESULT](spikes/SP-1-vram-handoff/RESULT.md)), R-004 · impact H · evidence known, R-005 · impact M · evidence known, R-006 · impact M · evidence known, R-007 · impact M · evidence known, R-008 · impact M · evidence known (+32 more)

### Community 162 - "Style Tag Vocabulary for the Caption Field (planned 2026-07-31)"
Cohesion: 0.29
Nodes (3): jobStatus, lyricsHealth, readTimings

### Community 163 - "Output Format: Rate / Depth / Bitrate, Everywhere (planned + implemented 2026-07-31)"
Cohesion: 0.28
Nodes (16): FakeEngine, Stands in for HeartMulaEngine: no torch, no GPU. `gate` lets a test hold     a, make_client(), test_a_value_naming_a_file_is_refused(), test_bearer_key_is_enforced_only_when_set(), test_cancel_while_running(), test_failures_carry_a_code_and_message(), test_happy_path_returns_a_flac_within_full_scale() (+8 more)

### Community 164 - "STEPS AUTO Resolves Per Model (planned 2026-07-31)"
Cohesion: 0.12
Nodes (17): Assumed defaults (filed as D-097..D-102, Q-078, Q-079), C0 — The core-promise path, thin (F-041 .. F-050), C1 — "This": always analyze, the strip, the mark (F-051 .. F-055), C2 — Converging turns: lyrics panel, REVISE, UNDO TURN, the bar map (F-056 .. F-060), C3 — Reference songs (F-061 .. F-065), C4 — Structure edits and the rest of the splice (F-066 .. F-069), needs the owner's SP-4 listen, C5 — Tempo and key, both ways (F-070), needs SP-6, C6 — Two ways in, completed (F-071 .. F-074) (+9 more)

### Community 165 - "songLayers.test.ts"
Cohesion: 0.06
Nodes (66): AskBody, Draft, DraftField, DraftReference, FailedBody, LyricSection, MessageBody, MessageKind (+58 more)

### Community 168 - "adapterStore.test.ts"
Cohesion: 0.12
Nodes (26): checksSegments(), n(), plain(), refusedLines(), Segment, opRows(), rowDetail(), Props (+18 more)

### Community 169 - "waveformPeaks.ts"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 171 - "ExportPanel.tsx"
Cohesion: 0.13
Nodes (10): Engine, Generated, JobCancelled, What the job worker needs from an engine. Torch-free, so the API, the queue and, Attn, Backbone, FakeCodec, FakeLM (+2 more)

### Community 173 - "JobStore"
Cohesion: 0.16
Nodes (25): ScoreStaleReferent, askingClause(), barsIn(), barsOf(), chipName(), clip(), forClause(), movedOnNote() (+17 more)

### Community 174 - "Exception"
Cohesion: 0.08
Nodes (31): analysisSources(), Skip, ace, all, none, yue2, VersionFacts, AnalysisPlanSources (+23 more)

### Community 175 - "engineGenJobs.ts"
Cohesion: 0.06
Nodes (15): playOrStayPaused(), STAYS_PAUSED, settle(), make(), PendingAudio, settle(), createPreviewPlayback(), PreviewAudioElement (+7 more)

### Community 176 - ".publish"
Cohesion: 0.08
Nodes (34): apply_ops(), beat_units(), chord_text(), decomp(), Doc, emit_body(), key_pc(), lyric_blocks() (+26 more)

### Community 177 - "stemSplit.reextract.test.ts"
Cohesion: 0.29
Nodes (3): idle(), settledSplit(), StemKind

### Community 178 - "JobCancelled"
Cohesion: 0.14
Nodes (14): Component map / file-level plan, Decisions, Decisions, Decisions, Decisions, File-level plan, File-level plan, File-level plan (+6 more)

### Community 179 - "Multiple Song-Creation Engines (planned 2026-09-30)"
Cohesion: 0.19
Nodes (14): test, activeVersion(), downloadBytes(), dragRegion(), FakeTask, fakeTasks(), holdFake(), lastTaskOfType() (+6 more)

### Community 180 - "heartmula.ts"
Cohesion: 0.11
Nodes (20): attempt(), errorText(), api, readDuration(), chatShown(), SONG, Header(), MoveToEditorAction() (+12 more)

### Community 181 - ".submit"
Cohesion: 0.06
Nodes (49): { abc: ABC, grid: GRID }, AnalysisDeps, BARS, FACTS, READING, FACTS, ReadingBody, ReadingDeps (+41 more)

### Community 182 - "main.py"
Cohesion: 0.22
Nodes (14): DURATION_SEC, FakeTask, MODELS, ok(), PENDING_MS, PORT, queryRow(), readBody() (+6 more)

### Community 183 - "yue-server"
Cohesion: 0.25
Nodes (8): Add Layer (lego) — Phase 6+7 Design (planned 2026-07-02), Architecture: client-side mixing, Architecture: layer stack UI, Architecture: server, Decisions, Feature gating (per the existing ACE-Step Integration table, now enforced), File-level plan, Settings

### Community 184 - "engine_api.py"
Cohesion: 0.29
Nodes (7): 1. History row: prompt instead of timestamp, 2. Draggable/resizable waveform selection, 3. Standalone playhead timeline, 4. Delete a history entry, 5. Regenerate a history entry as an alternate, File-level plan, Repaint Editor UX Upgrade (planned 2026-07-02)

### Community 185 - "Mulakai"
Cohesion: 0.20
Nodes (7): cancelSplit, jobStatus, repaint, repaintParams, settled, splitStatus, startSplit

### Community 186 - "SongEngine"
Cohesion: 0.33
Nodes (5): create(), loadLora, post(), setLoraScale, unloadLora

### Community 187 - "run_job"
Cohesion: 0.20
Nodes (7): draft(), jobStatus, READING, readLyrics, src, T, withScore()

### Community 188 - "timingsJobs.test.ts"
Cohesion: 0.08
Nodes (31): ANALYSIS_STEPS, AnalysisState, AnalysisStep, chatAnalysisApi, conflictError(), isMarkStaleBody(), MarkPreview, MarkStaleBody (+23 more)

### Community 189 - "CustomSelect.tsx"
Cohesion: 0.50
Nodes (4): ANALYZE AUDIO Takes the genLock (planned 2026-10-02), Browser check (2026-10-02), Decisions, File-level plan

### Community 190 - "engineGenJobs.test.ts"
Cohesion: 0.54
Nodes (6): abcFacts, barsOf(), header(), keyOf(), MODES, tempoOf()

### Community 191 - "abcMeta.ts"
Cohesion: 0.33
Nodes (6): Adapter Loading (LoRA/LoKr) at Inference (planned 2026-07-31), Decisions, File-level plan, Open questions, Rollout, Verified against ACE-Step source, 2026-07-31

### Community 192 - "yue2.ts"
Cohesion: 0.06
Nodes (58): ChatMessageView, ChatSongBody, ChatApplyPhase, ChatApplyStart, ChatEditBody, ChatSplice, ChatSpliceKind, ChatVersionBody (+50 more)

### Community 193 - "heartmula-server"
Cohesion: 0.15
Nodes (12): compilerOptions, esModuleInterop, module, moduleResolution, outDir, rootDir, skipLibCheck, strict (+4 more)

### Community 194 - "test_store_and_worker.py"
Cohesion: 0.10
Nodes (21): applied(), ApplyResult, BAD, base, CHORUS, deps(), events, FakeOllama (+13 more)

### Community 195 - "README.md"
Cohesion: 0.24
Nodes (6): ShaderCanvas(), compile(), createProgram(), Program, startShader(), disconnect

### Community 196 - "engines.test.ts"
Cohesion: 0.40
Nodes (5): ANALYZE AUDIO on COVER · YUE2 (planned 2026-10-01), Browser check (2026-10-01), Decisions, File-level plan, Open questions

### Community 198 - "uvr-server"
Cohesion: 0.50
Nodes (4): Browser check (2026-10-02), Decisions, File-level plan, Voice List Failures (planned 2026-10-02)

### Community 199 - "generationStore.test.ts"
Cohesion: 0.18
Nodes (8): activeGeneration, coverWithEngine, generate, generateFromAudio, generateWithEngine, jobStatus, params, queue

### Community 200 - "Color tokens"
Cohesion: 0.29
Nodes (6): Config (env vars), Endpoints, lyrics-server, Run, Setup (native Windows), Tests

### Community 201 - "YuE2 Melody Covers via SheetSage2 (planned 2026-09-30)"
Cohesion: 0.40
Nodes (5): Architecture, Decisions, Export & Remaster — Phase 9 Design (planned 2026-07-06), Feature gating, File-level plan

### Community 203 - "registry.test.ts"
Cohesion: 0.40
Nodes (5): Browser check (2026-10-01), Decisions, File-level plan, Open questions, YuE2 Covers: Pick the Score's Sections (planned 2026-10-01)

### Community 204 - "The Newest Library Search Wins (planned 2026-10-02)"
Cohesion: 0.50
Nodes (4): Browser check (2026-10-02), Decisions, File-level plan, The Newest Library Search Wins (planned 2026-10-02)

### Community 205 - "Upstream Sync: `complete`/`lego` Skip the LM (planned + implemented 2026-09-30)"
Cohesion: 0.14
Nodes (14): prepare_score(), Checks a supplied score (a cover's `abc`) before it is queued, so a bad one is, The score to generate from: validated, and chord-free for `melody`., The header (everything before the first `% name` line) and each section's     b, ScoreError, split_sections(), POST /v1/scores/measure and the section split behind it (PLAN.md, "YuE2 Covers:, test_a_score_without_sections_is_all_header() (+6 more)

### Community 206 - "UVR Separator: Roformer Vocals for SPLIT (planned + implemented 2026-09-30)"
Cohesion: 0.40
Nodes (5): Browser check (2026-10-02), COVER's Source Holds Still While a Job Reads It (planned 2026-10-02), Decisions, File-level plan, Open questions

### Community 207 - "COVER and ARRANGE Reference Audio: No Influence Sliders (planned + implemented 2026-09-30)"
Cohesion: 0.40
Nodes (5): Browser check (2026-10-02), Decisions, File-level plan, Open questions, The Library Loads Without Trying to Play (planned 2026-10-02)

### Community 208 - "Text2music Reference Audio: Style Influence Only (planned + implemented 2026-09-30)"
Cohesion: 0.40
Nodes (5): Decisions, File-level plan, Open questions, Rollout, Style Tag Vocabulary for the Caption Field (planned 2026-07-31)

### Community 210 - "RE-EXTRACT Never Touches a Claimed Stem (planned 2026-10-02)"
Cohesion: 0.12
Nodes (30): NATURAL, AbcError, compare(), fail(), json_value(), key_accidentals(), main(), meter_value() (+22 more)

### Community 211 - "transcribeStore.test.ts"
Cohesion: 0.29
Nodes (6): jobStatus, land(), src, T, tick(), transcribe

### Community 212 - "1. Authentication"
Cohesion: 0.50
Nodes (4): An Unreachable ACE-Step Is a Failure, Not "No Models" (planned 2026-10-02), Browser check (2026-10-02), Decisions, File-level plan

### Community 213 - "Cover Lyrics From the Recording (planned 2026-10-01)"
Cohesion: 0.50
Nodes (4): Add Layer Lyrics (implemented 2026-07-08), Decisions, File-level plan, Model restriction (confirmed, no code change)

### Community 214 - "voiceStore.test.ts"
Cohesion: 0.50
Nodes (4): Browser check (2026-10-01), Decisions, Files, READ LYRICS With TRANSCRIBE for Uploads (planned 2026-10-01)

### Community 215 - "editorJobStore.test.ts"
Cohesion: 0.25
Nodes (6): failedRepaint(), jobs(), jobStatus, params, repaint, retakeVersion

### Community 216 - "Motion"
Cohesion: 0.12
Nodes (5): test_classify(), classify(), The single inference thread: load the engine once, then run jobs one at a time., Jobs live in memory, so job folders left by an earlier process are orphans., Worker

### Community 217 - "5. Batch Query Task Results"
Cohesion: 0.16
Nodes (17): barShift(), isObject(), isSpan(), KEEPS, KEPT, MOVES, moveSpan(), RETIMED (+9 more)

### Community 218 - "6. Format Input"
Cohesion: 0.50
Nodes (4): Browser check (2026-10-02), Decisions, File-level plan, SPLIT Names Its Real Backend (planned 2026-10-02)

### Community 219 - "E2E Fails on Uncaught Page Errors (planned 2026-10-02)"
Cohesion: 0.26
Nodes (20): BaseModel, Cut, The op shapes of REPEAT, CUT (F-030) and REWRITE_LYRICS (F-031) on POST /v1/sco, Repeat, RewriteLyrics, _Strict, add_score_edit_routes(), ApplyRequest (+12 more)

### Community 220 - "Style Tag Vocabulary for the Caption Field (planned 2026-07-31)"
Cohesion: 0.40
Nodes (5): Browser check (2026-10-02), COVER's Engine Holds Still Too (planned 2026-10-02), Decisions, File-level plan, Open questions

### Community 221 - "ANALYZE AUDIO on COVER · YUE2 (planned 2026-10-01)"
Cohesion: 0.25
Nodes (5): callOrder, initModel, queryResult, reconcileAdapter, releaseTask

### Community 222 - "YuE2 Covers: Pick the Score's Sections (planned 2026-10-01)"
Cohesion: 0.50
Nodes (4): Decisions, File-level plan, Import a Song (planned 2026-07-30), Open questions

### Community 223 - "10. Server Statistics"
Cohesion: 0.09
Nodes (46): arg(), main(), MARKS, TEXT, used, Bars, buildMark(), db() (+38 more)

### Community 224 - "test_api.py"
Cohesion: 0.07
Nodes (45): editOps(), AnalyzeBody, TurnReply, asksWholeSong(), assumptionsUnderMark(), BarRange, barsOf(), BOUNDED (+37 more)

### Community 225 - "Mulakai — UX & Visual Polish Notes"
Cohesion: 0.07
Nodes (59): sweepTemp(), splitRouter, STEM_KINDS, upload, Proposal, analyzeById(), AnalyzeProposal, dropProposals() (+51 more)

### Community 226 - "Vendored ACE-Step 1.5 documentation"
Cohesion: 0.08
Nodes (39): SECTION_TAGS, action(), arr(), NO_SONG_FACTS, obj(), recipeSchema(), REFERENCE_USES, Schema (+31 more)

### Community 227 - "Add Layer Lyrics (implemented 2026-07-08)"
Cohesion: 0.50
Nodes (4): Decisions, File-level plan, Open questions, Output Format: Rate / Depth / Bitrate, Everywhere (planned + implemented 2026-07-31)

### Community 228 - "ShaderCanvas.tsx"
Cohesion: 0.20
Nodes (19): kept_roots(), _old_chords(), pitch_class(), D-055: a REHARMONIZE changes the harmony, not only the chord colour. The M0 A/B, (bar, beat, root) of every Vocal chord symbol in score order., The refusal for a REHARMONIZE `op` on the score `doc` (before the edit)     tha, same_root(), _sounding() (+11 more)

### Community 230 - "Training API"
Cohesion: 0.22
Nodes (8): Data model, Decisions locked in (from discussion, 2026-07-04), FORGE — LoRA/LoKr Training & Dataset Studio (planning doc, not yet implemented), Open questions for `/opsx:explore` when this starts, Phased plan, What ACE-Step 1.5 already gives us (verified 2026-07-04, native REST — no Gradio), What ace-step-ui-main's training UI is worth borrowing (checked 2026-07-04), Why this exists, and why it's separate

### Community 231 - "YuE2: Align With Upstream's `yue2-music` Skill (planned 2026-09-30)"
Cohesion: 0.50
Nodes (4): Decisions, File-level plan, Open questions, STEPS AUTO Resolves Per Model (planned 2026-07-31)

### Community 232 - "fake_infer.py"
Cohesion: 0.22
Nodes (8): API, Config (env vars), GPU: one model at a time (read this), heartmula-server, Run, Setup (native Windows), Tests, WSL2 fallback

### Community 233 - "README.md"
Cohesion: 0.50
Nodes (4): Decisions, File-level plan, Open questions, Upstream Sync: `complete`/`lego` Skip the LM (planned + implemented 2026-09-30)

### Community 234 - "Path"
Cohesion: 0.25
Nodes (8): 4.1 API Definition, 4.2 Request Parameters, 4.3 Response Example, 4.4 Usage Examples (cURL), 4. Create Generation Task, Method A: JSON Request (application/json), Method B: File Upload (multipart/form-data), Parameter Naming Convention

### Community 235 - "Engine"
Cohesion: 0.13
Nodes (27): ScoreLyricBlock, ScoreReferent, ScoreSection, LyricLine, matchSectionBlocks(), splitLyricsBlocks(), findActiveSectionIndex(), groupSections() (+19 more)

### Community 236 - "FastAPI"
Cohesion: 0.09
Nodes (24): Candidates, in the order the spike runs them, Cost, Edits split three ways (this decides which approach can apply), Out of scope, noted for later, Pass bar, Protocol, Question, SP-4 · Keep the unchanged parts of a song through an edit (R-024) (+16 more)

### Community 237 - "Settings"
Cohesion: 0.44
Nodes (8): client_for(), post(), seg(), test_failed_job_is_a_500_and_removes_the_upload(), test_hallucinated_segments_are_dropped(), test_health_names_the_model_without_running_a_job(), test_language_is_passed_when_given(), test_transcribe_hands_over_the_upload_and_returns_segments()

### Community 238 - "Engine"
Cohesion: 0.07
Nodes (27): 10.1 API Definition, 10.2 Response Example, 10.3 Usage Example, 10. Server Statistics, 11.1 API Definition, 11.2 Request Parameters, 11.3 Usage Example, 11. Download Audio Files (+19 more)

### Community 239 - "Exception"
Cohesion: 0.18
Nodes (16): _chord(), new_key(), _note(), TRANSPOSE (F-029): every pitch of both voices moves by exactly n semitones (-11, Move the whole score by op["semitones"]; the style is synced by apply_ops., Upstream's parsed `score` as a TRANSPOSE by n should leave it, for check_edit., `key` moved n semitones, as one of upstream's 30 key names., (letter, alteration, ABC letter, octave marks) for a MIDI pitch in `key`. (+8 more)

### Community 240 - "JobStore"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 241 - "Path"
Cohesion: 0.33
Nodes (5): Mulakai — UX & Visual Polish Notes, Proposed next passes (not yet done), The core loop today, Visual polish applied this pass (`index.css`), Workflow observations → improvements

### Community 242 - "READ LYRICS With TRANSCRIBE for Uploads (planned 2026-10-01)"
Cohesion: 0.50
Nodes (4): Decisions, File-level plan (as built), Open questions, UVR Separator: Roformer Vocals for SPLIT (planned + implemented 2026-09-30)

### Community 243 - "lyrics.test.ts"
Cohesion: 0.18
Nodes (8): v(), lyricsHealth, post(), startLyricsTranscription, app, importSong(), app, postAddLayer()

### Community 245 - "tsconfig.json"
Cohesion: 0.10
Nodes (30): assemble(), band_level(), fades(), gain_ramp(), lufs(), onset_env(), pattern_lag(), ndarray (+22 more)

### Community 246 - "12. Health Check"
Cohesion: 0.33
Nodes (6): 13. Environment Variables, Cache Configuration, LM Configuration, Model Configuration, Queue Configuration, Server Configuration

### Community 247 - "1. Authentication"
Cohesion: 0.08
Nodes (34): Root, agree(), bar_chords(), best_offset(), Fit, Path, Score bar -> audio seconds for one take, from SheetSage2's downbeats and chord, Audio time at the start of score bar i (0-based); i == bars is the end of the so (+26 more)

### Community 248 - "A Failed Editor Job Blocks Nothing (planned 2026-10-01)"
Cohesion: 0.16
Nodes (28): check_sections(), _key_at(), _pitch(), The checks of a plan's applied REPEAT/CUT ops (F-030), between the score the ba, {ok, problems}; `ops` are the applied REPEAT/CUT ops., _same(), {index, label, from_bar, to_bar, seconds} per section with bars, as YuE2 plays t, section_seconds() (+20 more)

### Community 249 - "A Settled Split Blocks Nothing (planned 2026-10-01)"
Cohesion: 0.10
Nodes (34): NATIVE, abc_file_to_midi(), abc_to_midi(), _conductor(), _meta(), _name(), _parse_complete(), Fraction (+26 more)

### Community 250 - "fake_infer.py"
Cohesion: 0.13
Nodes (32): BeatError, double(), _first_downbeat(), half(), lead_in(), Re-time a transcription (PLAN.md "Re-time a Transcription", SP-8): correct Shee, The tempo the beat list reads as: 60 / the median gap between beats., beat_in_bar cycles 1..numerator and restarts at 1 whenever the meter changes. (+24 more)

### Community 252 - "FastAPI"
Cohesion: 0.40
Nodes (5): 5.1 API Definition, 5.2 Request Parameters, 5.3 Response Example, 5.4 Usage Example, 5. Batch Query Task Results

### Community 253 - "Path"
Cohesion: 0.07
Nodes (48): r(), sleep(), songs, sleep(), [songId,text], arg(), flag(), main() (+40 more)

### Community 254 - "Path"
Cohesion: 0.15
Nodes (27): FakePipeline, wav_bytes(), AudioPipeline, contract(), done(), FakeTracker, ndarray, The /v1/splices test harness: synthetic takes and scores, a fake SheetSage2 tra (+19 more)

### Community 255 - "Path"
Cohesion: 0.40
Nodes (5): 9.1 API Definition, 9.2 Request Parameters, 9.3 Response Example, 9.4 Usage Examples, 9. Initialize or Switch Models

### Community 257 - "Upstream Sync: `complete`/`lego` Skip the LM (planned + implemented 2026-09-30)"
Cohesion: 0.67
Nodes (3): Decisions, File-level plan, Text2music Reference Audio: Style Influence Only (planned + implemented 2026-09-30)

### Community 258 - "UVR Separator: Roformer Vocals for SPLIT (planned + implemented 2026-09-30)"
Cohesion: 0.67
Nodes (3): Decisions, File-level plan, YuE2: Align With Upstream's `yue2-music` Skill (planned 2026-09-30)

### Community 259 - "A Failed Editor Job Blocks Nothing (planned 2026-10-01)"
Cohesion: 0.50
Nodes (4): Browser check (2026-10-02), Decisions, File-level plan, Lookup Failures Aren't Answers (planned 2026-10-02)

### Community 260 - "backfillGenTask.test.ts"
Cohesion: 0.50
Nodes (3): Expanding the Oxlint configuration, React Compiler, React + TypeScript + Vite

### Community 261 - "Path"
Cohesion: 0.14
Nodes (23): ChatMessage, MessageView, cardSummary(), cut(), historyLines(), line(), opLine(), PLACE (+15 more)

### Community 262 - "Runner"
Cohesion: 0.12
Nodes (30): main(), null_test(), ndarray, The splice's two machine checks (F-047 #2), shared by the job and by CP-C0:  -, parts: [{"source", "out_s": [o0, o1], "src_s": [t0, t1]}] in output order., seams(), step(), _edge_fade() (+22 more)

### Community 263 - "Path"
Cohesion: 0.50
Nodes (3): Keeping them current, Licence, Vendored ACE-Step 1.5 documentation

### Community 265 - "Path"
Cohesion: 0.14
Nodes (7): Reads the words sung in a song (PLAN.md "Cover Lyrics From the Recording"): fas, Thin HTTP wrapper around Demucs (https://github.com/adefossez/demucs) so Mulakai, 7.1 API Definition, 7.2 Request Parameters, 7.3 Response Example, 7.4 Usage Example, 7. Get Random Sample

### Community 266 - "FastAPI"
Cohesion: 0.12
Nodes (28): _bar_gains(), build(), REHARMONIZE as SP-4's A3 splice (RESULT "What the real build should copy" 1): c, The map for the result JSON and the null test, in exact sample times., Groove-continuity shift (s) for the adjustable end ('next' moves next_t0, 'prev', Assemble `parts`, dropping empty ones (an edit at a song edge). widths and base_, (new time at the bar's centre, dB) for each bar of the span: base loudness minus, Bars [s, e) (0-based) of `base` replaced by the same bars of `new`. (+20 more)

### Community 267 - "Settings"
Cohesion: 0.08
Nodes (23): intent(), kinds_no_style(), Heavy-tail experiment: ED10 / LG01.t1 (REHARMONIZE of a 40-bar chorus) with and, Prompt experiment: first-try validity of REHARMONIZE edits under prompt variants, Experiment: the retry's closing line. Current: "Return a corrected, complete rep, Experiment: a helper field `was` (the old chord's root at that bar, copied from, chat(), ps() (+15 more)

### Community 271 - "Split Health: Which Service, and Why It's Off (planned 2026-10-02)"
Cohesion: 0.50
Nodes (4): Browser check (2026-10-02), Decisions, File-level plan, Split Health: Which Service, and Why It's Off (planned 2026-10-02)

### Community 273 - "JobStore"
Cohesion: 0.13
Nodes (25): Exception, ValueError, AudioError, ndarray, Path, Audio in and out for the splice: 48 kHz float32 stereo (SP-4's canonical format, read_audio(), _to_float_stereo() (+17 more)

### Community 275 - "voiceStore.test.ts"
Cohesion: 0.11
Nodes (32): ActionDock(), activeNumber(), DockRepaintInputs, DockRepaint(), Props, SectionLyrics, DockSectionLyrics(), Props (+24 more)

### Community 276 - "ACE-STEP COVER's Source Holds Still Too (planned 2026-10-02)"
Cohesion: 0.50
Nodes (4): ACE-STEP COVER's Source Holds Still Too (planned 2026-10-02), Browser check (2026-10-02), Decisions, File-level plan

### Community 277 - "RE-EXTRACT Never Touches a Claimed Stem (planned 2026-10-02)"
Cohesion: 0.50
Nodes (4): Browser check (2026-10-02), Decisions, File-level plan, RE-EXTRACT Never Touches a Claimed Stem (planned 2026-10-02)

### Community 280 - "FastAPI"
Cohesion: 0.29
Nodes (6): Config (env vars), demucs-server, Endpoints, Run, Setup, Tests

### Community 281 - "Path"
Cohesion: 0.29
Nodes (6): Config (env vars), Endpoints, Run, Setup (native Windows), Tests, uvr-server

### Community 284 - "GenerateRequest"
Cohesion: 0.50
Nodes (4): Browser check (2026-10-02), Decisions, File-level plan, Shader Surfaces Give Their WebGL Context Back (planned 2026-10-02)

### Community 285 - "Path"
Cohesion: 0.50
Nodes (4): A Preview Stopped Before It Starts Fails Quietly (planned 2026-10-02), Browser check (2026-10-02), Decisions, File-level plan

### Community 287 - "Abandoned Splits Leave No Stems Behind (planned 2026-10-02)"
Cohesion: 0.50
Nodes (4): Abandoned Splits Leave No Stems Behind (planned 2026-10-02), Browser check (2026-10-02), Decisions, File-level plan

### Community 289 - "ReferenceAudioPicker.tsx"
Cohesion: 0.19
Nodes (15): F-017 #4 (duration) and the planner's facts: header, key notes, sections, lyric, test_duration_is_bars_times_meter_over_q(), test_header_key_notes_and_sections(), test_lyric_blocks_are_numbered_with_their_occurrence(), test_the_bar_map_has_one_line_per_bar_in_sp2_format(), test_the_bar_map_states_each_meter_change_and_sixteenth_beats(), bar_map(), key_notes() (+7 more)

### Community 291 - "ReferenceAudioPicker.tsx"
Cohesion: 0.50
Nodes (4): Browser check (2026-10-02), Decisions, Editor Failures Say So (planned 2026-10-02), File-level plan

### Community 293 - "FastAPI"
Cohesion: 0.11
Nodes (23): chats(), EDIT_REPLY, openSongThread(), RECIPE, TITLE, composer(), draftThread, editDraft() (+15 more)

### Community 294 - "Path"
Cohesion: 0.10
Nodes (12): chord_offsets(), decompose(), emit_bar(), emit_line(), Bar-level events of a native YuE2 score, for the score model and ops.  An even, `units` as upstream's allowed lengths, longest first (27 -> 24 + 3)., (units from the bar start, chord) for each chord symbol in the bar., Make `offset` an event boundary, splitting a note (tied) or a rest into     all (+4 more)

### Community 295 - "FastAPI"
Cohesion: 0.29
Nodes (13): changed_lines(), chord(), F-017 #3: SET_TEMPO, REHARMONIZE and EDIT_STYLE, each checked with upstream's p, reharm(), test_a_failed_op_leaves_the_score_as_it_was_and_the_others_still_apply(), test_an_op_that_fails_half_way_leaves_no_trace(), test_check_edit_catches_a_moved_melody_and_chords_changed_outside_the_window(), test_lines_no_op_touched_keep_their_own_spelling() (+5 more)

### Community 296 - "Voice"
Cohesion: 0.11
Nodes (26): AudioPreview(), fmtTime(), Props, AudioPreviewPopover(), Props, CoverSourcePicker(), Dropzone(), Props (+18 more)

### Community 297 - "Playwright Golden-Path E2E (planned 2026-10-02)"
Cohesion: 0.40
Nodes (5): CI (added 2026-10-02), Decisions, File-level plan, Open questions, Playwright Golden-Path E2E (planned 2026-10-02)

### Community 298 - "Path"
Cohesion: 0.08
Nodes (33): chatMarkRouter, makeChatMarkRouter(), markStaleBody(), RangeResolution, Shift, BarTimesNow, clock(), isName() (+25 more)

### Community 299 - "FastAPI"
Cohesion: 0.14
Nodes (19): build_cases(), evaluate(), first_idx(), gpu_snap(), jazzy(), library(), main(), phrase_sanity() (+11 more)

### Community 300 - "Mulakai — Agent Instructions"
Cohesion: 0.25
Nodes (7): Architecture — Mulakai score agent (M0 on top of the existing app); the chat (C0) follows below, Context map (current) and the CI gap, Core-promise path through the code, Data, Seams, Shape in one paragraph, Test strategy (by risk)

### Community 301 - "Repaint Crossfade Is Clamped at Submit (planned 2026-10-02)"
Cohesion: 0.50
Nodes (4): Browser check (2026-10-02), Decisions, File-level plan, Repaint Crossfade Is Clamped at Submit (planned 2026-10-02)

### Community 302 - "api.py"
Cohesion: 0.22
Nodes (13): contractSongDraft(), editReplyFor(), Recorded, recordedTurn(), SP5, sp5Turn(), allContracts(), contract() (+5 more)

### Community 304 - "Exception"
Cohesion: 0.13
Nodes (9): IdempotencyConflict, JobStore, QueueFull, In-memory job table and FIFO queue for yue-server.  The job record mirrors YuE, Drop finished jobs (and their artifacts) older than the retention window., Delete artifact directories left by a previous run (jobs are not persisted)., Returns (job, created). A repeated Idempotency-Key with the same body         r, None for an unknown id, or one of another kind when `kind` is given. (+1 more)

### Community 305 - "Worker"
Cohesion: 0.12
Nodes (15): Ablations (each 2 reps over the same scores, same models), Criterion (D-013, unchanged), Models (D-016), Not covered, Owed: WRITE PHRASE musicality listen, Per-template, final prompt (v2), both models, Question, R-015 · does a score plus rules fit the context? Yes at 16k; and Ollama overflows silently (+7 more)

### Community 306 - "A Dropped Generation Stops Polling (planned 2026-10-02)"
Cohesion: 0.50
Nodes (4): A Dropped Generation Stops Polling (planned 2026-10-02), Browser check (2026-10-02), Decisions, File-level plan

### Community 307 - "COVER Sends the Settings It Shows (planned 2026-10-02)"
Cohesion: 0.50
Nodes (4): Browser check (2026-10-02), COVER Sends the Settings It Shows (planned 2026-10-02), Decisions, File-level plan

### Community 308 - "Add Layer Mixes Each Layer at Its Own Volume (planned 2026-10-02)"
Cohesion: 0.50
Nodes (4): Add Layer Mixes Each Layer at Its Own Volume (planned 2026-10-02), Browser check (2026-10-02), Decisions, File-level plan

### Community 309 - "Create-Side Lookup Failures (planned 2026-10-02)"
Cohesion: 0.50
Nodes (4): Browser check (2026-10-02), Create-Side Lookup Failures (planned 2026-10-02), Decisions, File-level plan

### Community 315 - "Idle Jobs Leave Every Registry (planned 2026-10-02)"
Cohesion: 0.50
Nodes (4): Browser check (2026-10-02), Decisions, File-level plan, Idle Jobs Leave Every Registry (planned 2026-10-02)

### Community 320 - "registry.ts"
Cohesion: 0.03
Nodes (64): SP-6 arm P (throwaway, WSL, yue-server stopped): the edited score rendered by th, COT_VALUES, NUMBER_FIELDS, pickCreateFields(), STRING_FIELDS, coverEngine(), coversRouter, PREVIEW_HEADERS (+56 more)

### Community 321 - "adapterStore.test.ts"
Cohesion: 0.07
Nodes (27): author, dependencies, better-sqlite3, eld, express, multer, node-taglib-sharp, description (+19 more)

### Community 324 - "waveformPeaks.ts"
Cohesion: 0.38
Nodes (4): createPeaksLoader(), loader, PeaksDecoder, flush()

### Community 326 - "A Failed Editor Job Blocks Nothing (planned 2026-10-01)"
Cohesion: 0.67
Nodes (3): A Failed Editor Job Blocks Nothing (planned 2026-10-01), Decisions, File-level plan

### Community 327 - "Model Status Badge (planned 2026-10-02)"
Cohesion: 0.67
Nodes (3): Decisions, File-level plan, Model Status Badge (planned 2026-10-02)

### Community 337 - "Song"
Cohesion: 0.12
Nodes (15): (a) Drift (R-014), (b) Chord adherence on reharmonized bars (cot=full, `b`) vs the control (`bm`, cot=melody), (c) Tempo (variant `c`, `Q:` +15%), Criterion (risks.md SP-3, unchanged), (d) Repeat (variant `d`) / section count, (e) `Ins` phrase (variant `e`), Evidence, Limits (+7 more)

### Community 338 - "previewPlayback.ts"
Cohesion: 0.13
Nodes (14): Criterion (from risks.md SP-1, unchanged), Evidence, Not covered / owed, Question, Re-run, Setup (exact), SP-1 · VRAM hand-off (R-003, R-019), Step 4: negative control (planner left loaded, `keep_alive` 5 m, then YuE2) (+6 more)

### Community 339 - "FakeAudio"
Cohesion: 0.15
Nodes (24): adaptersRouter, message(), syncWarning(), loadLora(), loraStatus, setLoraScale(), toggleLora(), unloadLora() (+16 more)

### Community 340 - "createPreviewPlayback"
Cohesion: 0.14
Nodes (21): clock(), cutHint, editedBars(), editQueued(), fmt(), LimitFacts, limitReasons(), minBpmThatFits() (+13 more)

### Community 341 - "lmJob.test.ts"
Cohesion: 0.25
Nodes (5): cancelJob, jobStatus, queue, sample, submit

### Community 342 - "queuedJobs.test.ts"
Cohesion: 0.25
Nodes (4): cancelJob, CANCELLED, jobStatus, submitted

### Community 343 - "generationJob.ts"
Cohesion: 0.18
Nodes (9): call(), main(), multipart(), SP-4 candidate B: ACE-Step repaint of a short window around each seam of a splic, repaint(), OutOfMemoryError, Stands in for torch.OutOfMemoryError, which the worker matches by name., FakePipeline (+1 more)

### Community 344 - "MoveToEditorAction.tsx"
Cohesion: 0.13
Nodes (14): Check commands (all ran by me at 27b457a, all exit 0), Cleanup, Dock height at 1366x768 (R-006 / Q-049), F-029 TRANSPOSE — PASS, F-030 REPEAT / CUT, lyrics and tags follow — PASS (with notes), F-031 REWRITE LYRICS — PASS, F-032 the dock's selection goes with the request as "this one" — PASS, with a gap (Q-051), F-033 REVISE — PASS on the criteria, with a planner-quality finding (Q-050) (+6 more)

### Community 345 - "PendingAudio"
Cohesion: 0.14
Nodes (15): jobView(), useEditorJobStore, LayerRef, pendingTakes(), TAKE_KINDS, empty, vocals, selectJobsAhead() (+7 more)

### Community 346 - "FakeAudio"
Cohesion: 0.07
Nodes (20): message(), applied, ApplyResult, EditBody, events, FakeOllama, REHARM, ScoreStatus (+12 more)

### Community 347 - "backfillGenTask.test.ts"
Cohesion: 0.10
Nodes (7): backfillGenTask(), before, dataDir, songsBefore, before, dataDir, facts

### Community 349 - "generationStore.adopt.test.ts"
Cohesion: 0.40
Nodes (3): activeGeneration, generate, params

### Community 350 - "queueStore.test.ts"
Cohesion: 0.40
Nodes (3): cancelJob, queue, RUNNING

### Community 354 - "measure.py"
Cohesion: 0.12
Nodes (24): ReferenceUse, MAX_TOKENS, ctx, facts, messages, analyzeReply(), askReply(), badKeyRecipe() (+16 more)

### Community 355 - "test_job_files.py"
Cohesion: 0.06
Nodes (24): create_app(), HTTP layer, built around an injected separate() so tests need no torch. Speaks, JobFiles, The on-disk side of /split: each split gets a job dir under data_dir, and its s, Make the stems downloadable; returns kind -> path under /audio., _remove(), Clock, finished_job() (+16 more)

### Community 356 - "test_job_files.py"
Cohesion: 0.19
Nodes (19): double(), facts(), first_downbeat(), fit_midi(), half(), lead_in(), main(), _names() (+11 more)

### Community 357 - "yue-server"
Cohesion: 0.10
Nodes (33): make_client(), Fit, audio_starts(), bar_times(), POST /v1/scores/bars (chat C1, D-174; Q-120): a score's bar start times on a ta, (strictly increasing starts of the score bars the audio holds, the end of the la, {offset, starts, end, agreement, bars}: score bar i (0-based) starts at starts[i, POST /v1/scores/bars (chat C1, D-174): a score's bar start times on a take's do (+25 more)

### Community 358 - "SP-4 · Keep the unchanged parts of a song through an edit (R-024)"
Cohesion: 0.13
Nodes (20): DEFAULT, toneWav(), WavFormat, same(), mismatch(), OPTIONAL, Send, specField() (+12 more)

### Community 359 - "run"
Cohesion: 0.11
Nodes (19): assemble(), beat_period(), beat_phase(), centroid(), _fades(), lufs(), onset_env(), pattern_lag() (+11 more)

### Community 360 - "scoreLimits.ts"
Cohesion: 0.12
Nodes (45): attemptOf(), follow(), LIVE, Msg, Prompt, runCreate(), RunCtx, runTurn() (+37 more)

### Community 361 - "ui.mjs"
Cohesion: 0.28
Nodes (10): dock(), launch(), openScore(), txt(), waitPlanDone(), req, apply, plan (+2 more)

### Community 362 - "planJob.sections.test.ts"
Cohesion: 0.17
Nodes (8): base, Chat, deps(), FakeOllama, FakeYue, read, ScoreStatus, status()

### Community 363 - "test_api.py"
Cohesion: 0.36
Nodes (11): client_for(), fake_separate(), post(), Writes what demucs.separate.main() would: job_dir/<model>/<stem>.wav., test_downloading_every_stem_leaves_the_data_dir_empty(), test_health_answers_while_a_split_runs(), test_health_names_the_model(), test_no_stems_is_a_500() (+3 more)

### Community 364 - "choose (letter, alteration) for a midi pitch in `key`; prefer the key signature,"
Cohesion: 0.19
Nodes (11): offlineLines(), Props, ScoreFailure(), fillLabel(), fillRequest(), limitHint, num(), Props (+3 more)

### Community 365 - "m2_driver.mjs"
Cohesion: 0.23
Nodes (11): body, doRender, doRevise, J(), log(), out, sleep(), smi() (+3 more)

### Community 366 - "planJob.cancel.test.ts"
Cohesion: 0.20
Nodes (10): applied(), ApplyResult, base, deps(), events, FakeOllama, read, ScoreStatus (+2 more)

### Community 367 - "planJob.phrase.test.ts"
Cohesion: 0.20
Nodes (10): base, Chat, chats(), deps(), FakeOllama, FakeYue, feedback(), read (+2 more)

### Community 368 - "planJob.test.ts"
Cohesion: 0.18
Nodes (10): BAR_999, base, deps(), events, FakeOllama, FakeYue, read, ScoreStatus (+2 more)

### Community 369 - "pendingTakes.ts"
Cohesion: 0.09
Nodes (21): Acid — "what makes something happen?" (commit actions), AI states — the one exception to "one hue, one job", App model — a flat set of top-level views, one page, Audio preview module (added 2026-07-29), Carbon — "the world" (structure), Color tokens, Copy rules, Design language in one sentence (+13 more)

### Community 370 - "Findings"
Cohesion: 0.18
Nodes (10): 1. should · W4 (#128) · `server/src/routes/versions.ts:60` · deleting the active score version leaves the song's bpm/key/meter/length on the deleted render, 2. should · W4 (#128) · `server/src/services/score/scoreRenderCheck.ts:33` + `client/src/scoreVerb.ts` (`renderRefused` -> `stale`) · a planner that is simply stopped makes APPLY & RENDER refuse as "PLAN OUT OF DATE", and PLAN AGAIN cannot fix it, 3. should · W3 (#127) · `client/src/api/types.ts:174`, `client/src/activityRunning.ts:46` · queue kind `plan` is not in the client kind union or `RUNNING_LABEL`, 4. nit · W4 (#128) · `server/src/services/score/scoreRenderJob.ts:45` · a queued word-timings job on the song blocks the render and stales the plan, 5. nit · W2 (merged #126) · `server/src/services/score/ollamaControl.ts:37` and `planJob.ts:72` · an untagged `LLM_MODEL` never matches Ollama's names, 6. nit · W2/W4 · `server/src/routes/scorePlan.ts:33`, `scoreRenderRouter` (`routes/scoreRender.ts:28`) · two concurrent POSTs both pass the "already queued" guard, 7. nit · W4 · `server/src/services/score/scoreVersion.ts:113` · a second reader of the sidecar, Checked, no finding (+2 more)

### Community 371 - "RuntimeError"
Cohesion: 0.12
Nodes (15): checks.sh script, TEMP, TMP, How reliable is the offline language-ID on lyrics? Ground truth = library songs, Library scan: every .abc sidecar in server/data (read-only) -> /v1/scores/read f, read(), rows(), Builds lyrics.html: the 10 lyric sets (RC01..RC10 of one rep, no cherry-picking) (+7 more)

### Community 372 - "SP-4 · Keep the unchanged parts of a song through an edit (R-024)"
Cohesion: 0.14
Nodes (20): build_messages(), clean_style(), fmt_history(), fmt_pending(), fmt_recipe(), key_words(), mark_line(), phrase_bars_of() (+12 more)

### Community 373 - "scorePlan.revise.test.ts"
Cohesion: 0.22
Nodes (9): base, CHORUS, current, planned(), post(), SAME_TEMPO, ScoreStatus, state() (+1 more)

### Community 374 - "compilerOptions"
Cohesion: 0.20
Nodes (9): compilerOptions, module, moduleResolution, noEmit, skipLibCheck, strict, target, types (+1 more)

### Community 375 - "planner.py"
Cohesion: 0.10
Nodes (19): mutate(), R-016: golden cases for a TypeScript port of the upstream validator. For every l, verdict(), http(), ps(), Per-model side measurements: cold load, tokens/s, GPU/CPU split, VRAM peak and r, chord_midi(), hz() (+11 more)

### Community 376 - "summary.md"
Cohesion: 0.20
Nodes (9): gemma4_26b: 116 plans (6 infeasible cases skipped), gemma4_26b_freechords: 18 plans (0 infeasible cases skipped), gemma4_26b_nopattern: 18 plans (0 infeasible cases skipped), gemma4_26b_notes: 32 plans (4 infeasible cases skipped), qwen3_14b: 116 plans (6 infeasible cases skipped), qwen3_14b_freechords: 18 plans (0 infeasible cases skipped), qwen3_14b_nopattern: 18 plans (0 infeasible cases skipped), qwen3_14b_notes: 32 plans (4 infeasible cases skipped) (+1 more)

### Community 377 - "Brief — Mulakai (reconstructed by adopt audit, 2026-10-03)"
Cohesion: 0.20
Nodes (9): Approach & track, Brief — Mulakai (reconstructed by adopt audit, 2026-10-03), Candidate new feature (NOT built): SCORE AGENT for YuE2 songs, Constraints, Core promise, For whom, MVP is done when (as the repo implies; the MVP shipped long ago and the app is past it), Non-goals (v1, from AGENTS.md / README) (+1 more)

### Community 378 - "CP1 · headless live run after W2 (2026-10-03)"
Cohesion: 0.15
Nodes (19): Fit, fit_midi(), Path, Fit the transcription's melody MIDI to a re-timed beat grid (SP-8). SheetSage2, beats_text(), bundle(), make_sheetsage(), melody_midi() (+11 more)

### Community 379 - "scoreStatus.test.ts"
Cohesion: 0.20
Nodes (5): CONTRACT, invalid, ok, Recorded, ScoreRead

### Community 380 - "Mulakai — Agent Instructions"
Cohesion: 0.20
Nodes (9): ACE-Step fork, Commands, Costly rules (digest of AGENTS.md), graphify, Invariants (score agent), Mulakai — Agent Instructions, Project Structure, Reference Projects (do not modify) (+1 more)

### Community 381 - "Process audit — Mulakai (2026-10-03)"
Cohesion: 0.22
Nodes (8): Context bloat (`context-budget.mjs`, run from E:\repos\Mulakai), Does the core promise work end to end today?, Process audit — Mulakai (2026-10-03), Process findings, Recommendation, Redesign (PLAN.md "UI Redesign", planned 2026-10-03), Rituals that cost more than they return (ask the user which to retire; Q-010 / D-004), Score-agent specific findings

### Community 382 - "Playbook — Mulakai"
Cohesion: 0.17
Nodes (21): CreateResult, s1(), Spec, FollowRecord, judged(), Leg, maxOf(), nums() (+13 more)

### Community 383 - "m2_analyze.py"
Cohesion: 0.20
Nodes (4): M2/CP3 audio checks (verifier); run in WSL: ~/sheetsage2/.venv/bin/python m2_ana, SheetSage2 sometimes tracks half bars (downbeats every 2 beats, bpm_from_bars ab, thin_if_double(), transcribe()

### Community 384 - "Findings"
Cohesion: 0.14
Nodes (17): edit_intent(), lid(), lines_language(), lyrics_language(), ops_by(), SP-5 checks: schema validation (independent of Ollama's grammar), recipe validit, (whole-lyrics language by lingua, by langdetect, per-section lingua codes)., What the attempt loop sends back for a recipe (all derivable by code without kno (+9 more)

### Community 385 - "summarize.py"
Cohesion: 0.17
Nodes (17): draftLines(), fieldLines(), scoreLines(), SongInput, songLines(), SongStateInput, songStateLines(), facts (+9 more)

### Community 386 - "m1_driver.mjs"
Cohesion: 0.33
Nodes (8): J(), log(), out, sleep(), smi(), t0, [tag, songId, request, doRender], waitIdle()

### Community 387 - "trials.mjs"
Cohesion: 0.31
Nodes (7): J(), out, sleep(), smi(), steps, [tag, stepsJson], waitIdle()

### Community 388 - "score.test.ts"
Cohesion: 0.22
Nodes (5): current, facts, planner, ScoreStatus, source

### Community 389 - "scoreRender.test.ts"
Cohesion: 0.22
Nodes (5): loaded, LoadedModel, Plan, ScoreStatus, source

### Community 390 - "scoreRenderJob.test.ts"
Cohesion: 0.20
Nodes (5): FakeYue, loaded, LoadedModel, read, RenderMode

### Community 391 - "scoreVersion.test.ts"
Cohesion: 0.22
Nodes (4): audio, firstTake, Plan, request

### Community 392 - "ports.ts"
Cohesion: 0.23
Nodes (6): DATA_ROOT, Reply, Seen, startFakeOllama(), PORTS, SCORE_PORTS

### Community 393 - "test_api.py"
Cohesion: 0.43
Nodes (6): post(), test_downloading_every_stem_leaves_the_data_dir_empty(), test_failed_split_is_a_500_and_still_frees_the_gpu(), test_health_answers_while_a_split_runs(), test_split_keeps_only_the_served_stems(), test_split_returns_downloadable_urls_for_all_four_stems()

### Community 394 - "Findings"
Cohesion: 0.25
Nodes (7): 1. should · W7 (#132) · `yue-server/score_phrase.py:46-56` (`note_events`) · an in-bar accidental carries onto the next plain letter, so the phrase sounds a different pitch than the planner wrote, and no gate sees it, 2. nit · W7 · `yue-server/score_phrase.py:112` (`add_instrument`) · a substring match decides the instrument is already in the style, 3. nit · W8 (#134) · `server/src/services/score/phraseSchema.ts:6-14` vs `yue-server/score_phrase.py:23-27` · PITCH, BEATS, 8 bars, 16 notes, 40 chars live twice and only one side is pinned, 4. nit · W9 (#133) · `e2e/playwright.config.ts` (`chromium` project's server env) · the golden-path server does not blank `LLM_API_URL`, Checked, no finding, Findings, M1 review, lens: code

### Community 395 - "planner_v1.py"
Cohesion: 0.11
Nodes (22): S, bar_map(), build_schema(), chat(), op_schemas(), SP-2 spike: op schema, prompt builder, mini JSON-schema validator, Ollama client, user_prompt(), action_schema() (+14 more)

### Community 396 - "M1 verify — F-026, F-027, F-028"
Cohesion: 0.25
Nodes (7): Check commands (all ran by me at 1d73654, all exit 0), Cleanup, F-026 WRITE PHRASE, F-027 first-edit warning, F-028 SCORE golden path in CI, Failures, M1 verify — F-026, F-027, F-028

### Community 397 - "report.py"
Cohesion: 0.11
Nodes (15): BASE_ABC, deps(), EDITED, FakeYue, GRID, OK, Op, read (+7 more)

### Community 398 - "Grid"
Cohesion: 0.11
Nodes (18): (a)/(c)/(d) recipes and lyrics, (b) action and ask discipline, Criterion, (e) edit turns, Evidence, (f) time, unload, the machine, (g) tokens, Ladder (v3 + run-length bar map, 1 rep each, 49 turns) (+10 more)

### Community 399 - "Score Agent (planned 2026-10-03)"
Cohesion: 0.25
Nodes (8): Decisions, File-level plan, Limits the spikes set, Op set per milestone, Open questions, Score Agent (planned 2026-10-03), SCORE verb states, The plan → render hand-off

### Community 400 - "0003 · WRITE PHRASE takes notes with beats; code writes the ABC"
Cohesion: 0.16
Nodes (16): MarkPreview, RangeMark, UserBody, blockLyrics(), clock(), kindOf(), markBlock, marked() (+8 more)

### Community 401 - "test_chain.py"
Cohesion: 0.20
Nodes (15): block(), draftFields(), lyricsText(), meterValue(), sung(), FIELDS, headerFields(), MAJOR (+7 more)

### Community 403 - "M2 F-033 REVISE live re-check after D-073 / D-076 (autopilot)"
Cohesion: 0.29
Nodes (6): Check commands (ran on 0629e20, all exit 0), M2 F-033 REVISE live re-check after D-073 / D-076 (autopilot), Not done / limits, Results (27 REVISE presses, 6 songs/plan families, qwen3:14b), Verdict, What blocks merging #141

### Community 404 - "Autopilot log"
Cohesion: 0.15
Nodes (12): Autopilot log, Run 2026-10-03 → M0, Run 2026-10-03 → M0 (new run, fresh 12-round budget; previous run stopped on budget after CP1), Run 2026-10-03 (resumed, same session, remote control on) → M0, Run 2026-10-05 → M1 (new run, 12-round budget), Run 2026-10-05 → M2 (new run, 12-round budget), Run 2026-10-06 → C0a (new run, 12-round budget), Run 2026-10-07 (2) → C3 then C0b (fresh 12-round budget; owner: "whole re-render is fine, keep going") (+4 more)

### Community 405 - "phrase_wav.py"
Cohesion: 0.26
Nodes (16): feats(), abc_bar_roots(), analyse(), band_share(), centroid(), chroma_roots(), load(), mel_fb() (+8 more)

### Community 406 - "build_listen.py"
Cohesion: 0.09
Nodes (34): DockCommit(), DockExport(), DockExportMidi(), DockRequest, ExportWhat, useDockRequest, myEditorJobs(), exportWhats() (+26 more)

### Community 407 - "m1_services.mjs"
Cohesion: 0.29
Nodes (5): dir, proxy(), ps, tr, yj

### Community 408 - "m2_services.mjs"
Cohesion: 0.14
Nodes (9): base, chatApi, chatReferencesApi, jobStatus, phase(), READ, recipe, store() (+1 more)

### Community 410 - "scorePlan.test.ts"
Cohesion: 0.29
Nodes (3): base, current, ScoreStatus

### Community 411 - "contextGuard.ts"
Cohesion: 0.20
Nodes (12): isEditorBusy(), selectSplitRunning(), isGenerating(), LyricAlignment, alignedLyricLines(), sectionTimings(), ALIGNED, shouldAutoRead() (+4 more)

### Community 412 - "dockJobLine.test.ts"
Cohesion: 0.23
Nodes (14): analyse(), bars_out_for(), base_notes_in_new(), edit_zone(), fit_idx(), main(), prep(), SP-4 machine measures. WSL: ~/sheetsage2/.venv/bin/python measure.py [song ...] (+6 more)

### Community 413 - "0001 · Planner transport: OpenAI-compatible chat plus Ollama-native control"
Cohesion: 0.14
Nodes (8): IdempotencyConflict, JobStore, QueueFull, In-memory job table and FIFO queue.  Snapshots mirror YuE2-Turbo's yue2-serve, Forget finished jobs older than the cutoff; returns their ids., Returns (snapshot, created). A repeated key with the same request is a, Block for the next queued job, mark it running, return (id, request)., Record the outcome. A cancel that arrived mid-job wins; returns the final status

### Community 414 - "0002 · Score logic runs on yue-server, not in TypeScript"
Cohesion: 0.13
Nodes (14): Arms and what they sent (all: v1's seed, cot full, v1's lyrics, the plan's edited ABC; the splice spec is identical across arms), Criterion, E: can YuE2 take a v1 clip as a reference? No (seen in upstream files, `~/yue2/repo` = YuE `18a07bb`, yue2-infer 0.1.6), Evidence, Files, Owed, Question, SP-6 · Instrument hold in a re-sung span (R-030, D-170) (+6 more)

### Community 415 - "0004 · Pending plans live in server memory, one per song"
Cohesion: 0.14
Nodes (10): LyricSegment, LyricWord, num(), readReading(), readWord(), READING, source, transcribeLyrics (+2 more)

### Community 416 - "transpose"
Cohesion: 0.30
Nodes (9): plan, QueueEntry, DockSplit(), queuedLine(), queuedTitle(), queueSuffix(), startsAfter(), VERB (+1 more)

### Community 417 - "cp1_analyze.py"
Cohesion: 0.14
Nodes (13): Criterion (SPIKE.md pass bar) and how I read it, Evidence, Files, Limits, OWED to the user, Question, SP-4 · Keep the unchanged parts of a song through an edit (R-024), Surprises (+5 more)

### Community 418 - "onset_env"
Cohesion: 0.37
Nodes (13): action_schema(), arr(), beats_per_bar(), i(), obj(), op(), ops_array_schema(), phrase_op() (+5 more)

### Community 419 - "Chat: Talk a Song Into Being (planned 2026-10-06)"
Cohesion: 0.29
Nodes (7): C3: reference songs (planned 2026-10-07, moved ahead of C0b by the owner, D-125), Chat: Talk a Song Into Being (planned 2026-10-06), Decisions (proposed; the ones marked **owner** need the owner's pick), Design (signed off by the owner, 2026-10-06), Milestones (cut 2026-10-06, `pipeline/scope.md`, features F-040..F-081), Open questions for the owner (Q-054), Shape of the code (detailed at architecture)

### Community 420 - "build_listen.py"
Cohesion: 0.14
Nodes (9): BASE_ABC, FakeYue, loaded, LoadedModel, OK, Op, read, REHARM (+1 more)

### Community 421 - "check_listen.mjs"
Cohesion: 0.40
Nodes (4): bad, { chromium }, errs, require

### Community 422 - "Status — Mulakai"
Cohesion: 0.40
Nodes (4): Notes, Now, Stages, Status — Mulakai

### Community 423 - "YuE2 Is the Default First-Take Engine (planned 2026-10-03)"
Cohesion: 0.40
Nodes (5): Decisions, File-level plan (one PR, `feat/yue2-default-engine`), Open questions, With the score agent (agentic editing, planned), YuE2 Is the Default First-Take Engine (planned 2026-10-03)

### Community 424 - "api.py"
Cohesion: 0.13
Nodes (11): coverReady, engines, fetchTranscriptionPreview, jobs, measureScore, noCover, startEngineGeneration, startTranscription (+3 more)

### Community 425 - "8. List Available Models"
Cohesion: 0.14
Nodes (13): 1. WSL2 + Ubuntu 24.04, 2. The venv (inside WSL), 3. `yue2 doctor` and the weights, 4. Start the server, 5. Covers: SheetSage2 (optional), API, Config (env vars, all optional), If Ubuntu's first-run user setup hangs (+5 more)

### Community 426 - "make_inputs.py"
Cohesion: 0.29
Nodes (10): Version, activeLayers(), AudibleTake, audibleTakes(), layer(), version(), volumes(), audibleStructureKey() (+2 more)

### Community 427 - "asr_spans.py"
Cohesion: 0.27
Nodes (9): FacetGlass(), FacetMap, useFacetMap(), FACET, facetDisplacement(), facetNoise(), facetOf(), TAN_10 (+1 more)

### Community 428 - "make_tables.py"
Cohesion: 0.32
Nodes (10): FakePipe, make(), HeartMulaEngine's orchestration against a fake heartlib pipeline built from tin, run(), test_auto_knobs_get_heartlibs_defaults(), test_cancel_stops_the_lm_mid_song_and_still_parks_it(), test_kv_caches_are_dropped_and_the_cancel_hook_removed_after_the_lm(), test_one_model_on_the_gpu_at_a_time_and_both_parked_after() (+2 more)

### Community 429 - "checks.sh"
Cohesion: 0.24
Nodes (12): apply_reasons(), call_loop(), do_turn(), edit_reasons(), history_text(), main(), SP-5 runner: scripted conversations -> one turn per user message through qwen3:1, One turn under a ladder mode. Returns attempts (all calls), reply, accepted, app (+4 more)

### Community 430 - "Remove the HeartMuLa Engine (planned 2026-10-03)"
Cohesion: 0.50
Nodes (4): Existing HeartMuLa songs, File-level plan (one PR, `feat/remove-heartmula`), Open questions, Remove the HeartMuLa Engine (planned 2026-10-03)

### Community 432 - "api.py"
Cohesion: 0.20
Nodes (12): DONE_LABEL, KIND_NAME, rowTitle(), SettledActivityRow(), SettledProps, UNTITLED, AI_KINDS, Draft (+4 more)

### Community 433 - "COVER and ARRANGE Reference Audio: No Influence Sliders (planned + implemented 2026-09-30)"
Cohesion: 0.17
Nodes (12): Interaction specs, Later, M0 — The core-promise path, headless first, then in the dock, M1 — The riskiest remaining op, the warning, the regression net, M2 — Deterministic section ops, referents, revise, M3 — More songs, M4 — Seeing and reaching it, Not doing (+4 more)

### Community 434 - "The Model List Waits Out a Busy ACE-Step (planned 2026-10-02)"
Cohesion: 0.67
Nodes (3): Decisions, File-level plan, The Model List Waits Out a Busy ACE-Step (planned 2026-10-02)

### Community 435 - "Universal Advanced Settings (Repaint + Add Layer) (implemented 2026-07-08)"
Cohesion: 0.27
Nodes (6): A Failed Generation Blocks Nothing (planned 2026-10-01), Decisions, Decisions, File-level plan, File-level plan, Universal Advanced Settings (Repaint + Add Layer) (implemented 2026-07-08)

### Community 436 - "client.md"
Cohesion: 0.23
Nodes (11): AttachChip(), AttachMenu(), carriesFiles(), ChatAttachControl(), ChatDropZone(), DropOverlay(), droppedFile(), MenuProps (+3 more)

### Community 437 - "graphify-out.md"
Cohesion: 0.20
Nodes (7): CHORDS, F-017 #1 and #2: SP-2's golden cases give upstream's ok/error text through the, test_a_valid_score_has_no_bar_sums(), test_an_overfull_bar_reports_its_unit_sum(), test_an_underfull_bar_and_a_meter_change_report_their_own_lengths(), test_golden_case_matches_upstream(), upstream()

### Community 438 - "ui.md"
Cohesion: 0.18
Nodes (10): Bugs and findings (none blocks C0b), C0b live verification (CB-6, the C0 live run), 2026-10-07, Cleanup, F-046, F-047, F-048, F-049 (commit half), F-050 #2 (by hand) (+2 more)

### Community 440 - "E2E and fakes"
Cohesion: 0.18
Nodes (10): Approach, Chat: run & verify (C0), Chat: run & verify (C3, reference songs), Check commands (all must pass before a commit), Playbook — Mulakai, Quality bar (track: standard), Run & verify, Score agent: run & verify (M0) (+2 more)

### Community 441 - "GPU job queue"
Cohesion: 0.20
Nodes (9): AGENTS.md — Mulakai Development Rules, Code Style, Design System (mandatory for all UI work), Git Workflow, Module Size Policy, Red Lines, Scope Discipline, Spec-Driven Development (+1 more)

### Community 442 - "score-server.md"
Cohesion: 0.20
Nodes (9): Chords on the reharmonized bars (reported, not pass/fail), CP1 · headless live run after W2 (2026-10-03), Criteria, F-017 #5: the score routes during a live YuE2 job, Files, Plans (6/6 valid on the first attempt), Render step (CP1-only code; W4 has no route yet), Renders (6, YuE2, cot full) (+1 more)

### Community 443 - "versions-data.md"
Cohesion: 0.29
Nodes (9): groove continuity across the join at output time t: lag (ms) between the W = 8 b, seam_phase_error(), null_test(), SP-4 candidates A (bar-aligned splice of the new render into the base) and C (RE, groove-continuity shift in seconds for the adjustable end (mode 'next' moves nex, every sample of a base part, away from the crossfade windows, equals the base sa, run(), seam_report() (+1 more)

### Community 444 - "yue-server.md"
Cohesion: 0.20
Nodes (10): Chat (C1) — "this": always analyze, the strip, the mark, Data (C1), Feature → modules, GPU and the queue (C1), Modules — client (`client/src/`, flat), Modules — server, Seams and fakes (C1), Shape in one paragraph (+2 more)

### Community 446 - "build_near_budget.py"
Cohesion: 0.20
Nodes (10): Chat (C3) — reference songs, Data (C3), Feature → modules, GPU and the queue, Modules — client (`client/src/`, flat), Modules — server, Seams and fakes (C3), Shape in one paragraph (+2 more)

### Community 447 - "count_tokens.py"
Cohesion: 0.20
Nodes (9): Bugs, C1 live verification (CL-9), 2026-10-08, Cleanup, F-052, F-053, F-054, F-055, Re-check 2026-10-08 (+1 more)

### Community 448 - "mk_near_variant.py"
Cohesion: 0.27
Nodes (8): main(), pc_of(), Builds cases.json: the 40 scripted conversations (36 single-turn + 4 multi-turn, A real substitution: every bar's chord root moved up `shift` semitones, seventh/, recipe_fx(), reharm_ops(), cases_holdout.json: 20 single-turn cases written AFTER the prompt was tuned on t, single()

### Community 449 - "ablations.sh"
Cohesion: 0.22
Nodes (8): 1. should · F-030 #4 / F-033 · `server/src/services/score/planJob.ts:114` · the review's checks line shows the BASE's bar count under a plan that repeats or cuts sections, 2. should · F-032 · `client/src/useScoreVerb.ts:237-253` (`useScorePick`) + `server/src/routes/score.ts:47-62` · under the SCORE tab with no pickable data, a strip or lyric-line click does nothing at all, 3. nit · F-032 edge · `server/src/services/score/planReferent.ts:159-163` (`resolveReferent`, line branch) · a line pick survives a REWRITE LYRICS render with its old words, 4. nit · mirrored limit, unpinned · `server/src/services/score/opSchema.ts:12` (`MAX_OPS = 6`) vs `yue-server/score_edit_routes.py:104` (`max_length=6`), 5. nit · second implementation, no drift test · `client/src/scoreReferent.ts:264` (`kindOf`), `server/src/services/score/planReferent.ts:103` (`kindOf`, `linePin`), `yue-server/score_lyrics.py:32,62` (`tag_word`, `pairs`), Checked, no finding, Findings, M2 review, lens: code

### Community 450 - "ablations2.sh"
Cohesion: 0.36
Nodes (7): SP-4: assemble results.json (per-song tables from summarize.py + cross-song numb, lines_of(), main(), SP-4: fold results/measure_<song>.json (+ asr.json) into results.json and print, row_of(), span_value(), wer()

### Community 451 - "peek.sh"
Cohesion: 0.21
Nodes (11): downbeats(), grid(), groove(), _hit(), ndarray, Synthetic songs for the splice tests: a 4/4 drum groove (the same waveform for, `bars` bars of 4/4 starting at `lead` s; pad_db(i) is bar i's pad level (dB,, A tracker grid (sidecar shape) for a groove: one downbeat and one chord row per (+3 more)

### Community 452 - "peek2.sh"
Cohesion: 0.33
Nodes (6): BarTimesNow, snapMark(), snapToBars(), carinito, gertar, Sec

### Community 453 - "aggregate.py"
Cohesion: 0.08
Nodes (43): describe(), generateStatusRouter, inFlight(), makeScoreRenderRouter(), scoreRenderRouter, splitStatus(), attempt(), AUDIO_KINDS (+35 more)

### Community 454 - "make_asr_jobs.py"
Cohesion: 0.38
Nodes (8): check_spec(), _int(), Doc, The splice request (`spec`, a JSON form field of POST /v1/splices), checked bef, The op's bars as a 0-based [start, end) range of the base score., _score(), span(), SpecError

### Community 455 - "make_heal_jobs.py"
Cohesion: 0.39
Nodes (7): load(), norm(), pct(), q(), Aggregate results/<tag>.jsonl into per-template tables. Usage: python report.py, summarize(), wer()

### Community 456 - "prep_facts.py"
Cohesion: 0.25
Nodes (5): Grid, SheetSage2 sometimes tracks half bars on a 4/4 score (m2_analyze.py): keep every, score bar i (0-based) -> audio time, for one render, with the offset fitted on `, audio time (s) at the start of score bar i (i == n gives the end of the last bar, thin_if_double()

### Community 457 - "transcribe_outs.py"
Cohesion: 0.22
Nodes (7): Beat-transform rules that worked (`retime.py`), Evidence (all *seen running*: SheetSage2 venv python 3.11, WSL Ubuntu-24.04, real outputs, no GPU, no yue-server), Failure modes / surprises, SP-8 · Re-time a transcription by correcting saved beats and rebuilding (R-039), The call, Verdict, What the real build should copy

### Community 458 - "words_at_cuts.py"
Cohesion: 0.14
Nodes (9): from_env(), Settings, read once from the environment., Settings, Raised inside a job when its cancel flag is seen., create_app(), Thin HTTP wrapper around HeartMuLa (https://github.com/HeartMuLa/heartlib) so M, GenerateRequest, POST /v1/jobs body. Field names are heartlib's own, so Mulakai's engines/heartm (+1 more)

### Community 460 - "f030_direct.py"
Cohesion: 0.25
Nodes (8): F-090 · The rebuild and the kept outputs (RT-1 yue-server, RT-2 server), F-091 · RE-TIME on the cover's transcribed score (RT-3, `YueCoverPanel.tsx`), F-092 · Re-time a chat reading (RT-5, after C1 is merged), F-093 · RE-TIME as a SCORE dock op (RT-4), F-094 · A chat verb (RT-6, after C2), Not doing (RT), RT — Re-time a transcription (F-090 .. F-094; D-190, D-206 .. D-208), Stored data (before code, F-090)

### Community 462 - "m2_report.py"
Cohesion: 0.25
Nodes (8): Chat (C0) — talk a song into being, thin, Data (chat), Seams and fakes (chat), Shape in one paragraph, Splice placement — decided (D-107, decisions/0005), Test strategy (chat, by risk), The commit paths, The turn job (C0a; C0b adds the edit branch)

### Community 467 - "FastAPI"
Cohesion: 0.25
Nodes (7): 1. CA-4 live pass (F-050 #1, create leg): no STOP line, 2. CA-7 live run (F-050 #2, create half), real app at 1366x768, 3. Finding for the owner: "chat shows the song done, Library still shows it running" (F-044/F-045), 4. Verdict per feature (I did not edit features.json), C0a live verification (CA-4 live pass + CA-7 live run), 2026-10-06/07, Cleanup, Observations (none blocks C0a)

### Community 477 - "shared_sampler.ps1"
Cohesion: 0.25
Nodes (7): Bugs / observations, C3 live run (CR-9), 2026-10-07, F-061 read a reference: PASS, F-062 reference kept with the song: PASS, F-063 cover proposal: PASS, F-064 borrow proposal: PASS, F-065 score half (cover dock): PASS

### Community 478 - "tables.md"
Cohesion: 0.36
Nodes (7): call(), insertSong(), Job, land(), recipeTurn(), settle(), takes

### Community 479 - "block_report.py"
Cohesion: 0.25
Nodes (4): ensure, FACTS, Job, start

### Community 480 - "edges_transpose.py"
Cohesion: 0.25
Nodes (4): FACTS, ReadingDeps, StepDeps, steps

### Community 483 - "adapterStore.test.ts"
Cohesion: 0.57
Nodes (5): isWordChar(), matchScore(), positions(), score(), startsWord()

### Community 484 - "quickStartStore.test.ts"
Cohesion: 0.29
Nodes (7): Core-promise path (existing app), Core-promise path (M0: score agent), Risks, SP-1 · VRAM hand-off (R-003, R-019), SP-2 · local planner quality (R-002), SP-3 · cot=full audible adherence (R-013, R-014, residue of R-010), Spikes to schedule (stage 3; all on this machine: RTX 4080 16 GB, Windows 11 + WSL2 Ubuntu-24.04, yue-server, ACE-Step with `ACESTEP_OFFLOAD_TO_CPU=true`)

### Community 485 - "0003 · WRITE PHRASE takes notes with beats; code writes the ABC"
Cohesion: 0.29
Nodes (6): 0003 · WRITE PHRASE takes notes with beats; code writes the ABC, Alternatives, Consequences, Context, Decision, Evidence (SP-2, 2026-10-03, real library scores, upstream validator)

### Community 486 - "phrase_wav.py"
Cohesion: 0.29
Nodes (5): dir, proxy(), ps, tr, yj

### Community 487 - "build_listen.py"
Cohesion: 0.57
Nodes (6): dur_of(), main(), make(), make_control(), mp3(), SP-4: build listen/index.html (+ mp3s) from results/splice_*.json and the healed

### Community 488 - "save_flac"
Cohesion: 0.29
Nodes (4): SP-4: sanity check of one healed file against its input: format, length, where t, SP-4: what 'the rest moves' means in dB. For each full re-render (the control, t, SP-4: undo what ACE-Step does to the whole file and record what it did inside th, _slice()

### Community 489 - "CP-C1, analysis and marks on the real machine (2026-10-08 local, re-run after #210)"
Cohesion: 0.29
Nodes (6): Analyses, APPLY, CP-C1, analysis and marks on the real machine (2026-10-08 local, re-run after #210), Findings (re-run after #210, D-194..D-196), Stop lines, Turns

### Community 490 - "Scope — Engine pairing (ACE-Step 1.5 × YuE2)"
Cohesion: 0.29
Nodes (6): E3 — Native runtimes (F-089, spike first), F-089 · YuE2 and ACE-Step without WSL (risky; SP-7, R-037), Later (engine pairing), Not doing (engine pairing), Preconditions (fixes, not features; before E1), Scope — Engine pairing (ACE-Step 1.5 × YuE2)

### Community 491 - "chatReferencesRead.test.ts"
Cohesion: 0.38
Nodes (6): analyzeCard(), call(), Job, jobs, states(), wav()

### Community 492 - "createCover.test.ts"
Cohesion: 0.33
Nodes (5): coverCard(), Job, Reading, start, wav()

### Community 493 - "readCommit.test.ts"
Cohesion: 0.33
Nodes (5): analyzeCard(), Job, ReadCommitDeps, ReadingOptions, wav()

### Community 494 - "turnJob.test.ts"
Cohesion: 0.33
Nodes (4): deps(), events, FakeOllama, send()

### Community 495 - "lookup.test.ts"
Cohesion: 0.13
Nodes (25): addLayerCommitLabel(), addLayerConsequence(), addLayerLine(), addLayerName(), sungTrack(), trackLabel(), AddLayerDraft, useAddLayerDraft (+17 more)

### Community 496 - "0005 · The chat's splice runs on yue-server as a `splice` job"
Cohesion: 0.33
Nodes (5): 0005 · The chat's splice runs on yue-server as a `splice` job, Alternatives, Consequences, Context, Decision

### Community 497 - "0006 · A chat turn is one `plan`-kind job, and an edit's ops come in the turn's reply"
Cohesion: 0.33
Nodes (5): 0006 · A chat turn is one `plan`-kind job, and an edit's ops come in the turn's reply, Alternatives, Consequences, Context, Decision

### Community 498 - "0007 · Threads, messages and the draft in SQLite; proposals in memory"
Cohesion: 0.33
Nodes (5): 0007 · Threads, messages and the draft in SQLite; proposals in memory, Alternatives, Consequences, Context, Decision

### Community 499 - "0008 · A reference song is read by one queued job and kept as a copy with the thread"
Cohesion: 0.33
Nodes (5): 0008 · A reference song is read by one queued job and kept as a copy with the thread, Alternatives, Consequences, Context, Decision

### Community 500 - "0009 · A saved version is read by the reference-reading job, and "this" is a referent"
Cohesion: 0.33
Nodes (5): 0009 · A saved version is read by the reference-reading job, and "this" is a referent, Alternatives, Consequences, Context, Decision

### Community 501 - "0001 · Planner transport: OpenAI-compatible chat plus Ollama-native control"
Cohesion: 0.33
Nodes (5): 0001 · Planner transport: OpenAI-compatible chat plus Ollama-native control, Alternatives, Consequences, Context, Decision

### Community 502 - "0002 · Score logic runs on yue-server, not in TypeScript"
Cohesion: 0.33
Nodes (5): 0002 · Score logic runs on yue-server, not in TypeScript, Alternatives, Consequences, Context, Decision

### Community 503 - "0004 · Pending plans live in server memory, one per song"
Cohesion: 0.33
Nodes (5): 0004 · Pending plans live in server memory, one per song, Alternatives, Consequences, Context, Decision

### Community 504 - "heal.py"
Cohesion: 0.29
Nodes (5): dir, proxy(), ps, tr, yj

### Community 505 - "Sc"
Cohesion: 0.33
Nodes (4): load_score(), a rendered score (the intended one), quarter position -> (bar index, fraction), Sc

### Community 506 - "Modules — server, `server/src/services/chat/` (new folder beside `score/`)"
Cohesion: 0.33
Nodes (6): C0a, C0b (server), C0b (yue-server) — the splice, next to the score code (D-107, decisions/0005), Client (`client/src/`, flat), Feature → modules, Modules — server, `server/src/services/chat/` (new folder beside `score/`)

### Community 507 - "CP-C0, edit leg (2026-10-07)"
Cohesion: 0.33
Nodes (5): CP-C0, edit leg (2026-10-07), Edits, Notes (builder, CB-4), Per kind, Stop lines

### Community 508 - "CP-C1, analysis and marks on the real machine (2026-10-07)"
Cohesion: 0.33
Nodes (5): Analyses, APPLY, CP-C1, analysis and marks on the real machine (2026-10-07), Stop lines, Turns

### Community 509 - "CP-C3, reference songs (2026-10-07)"
Cohesion: 0.33
Nodes (5): CP-C3, reference songs (2026-10-07), CREATE COVER, Readings, Stop lines, Turns and reference_use

### Community 510 - "C0a code review (diff 41fa159...0ab70e1)"
Cohesion: 0.33
Nodes (5): 1. should · server/src/routes/chatTurns.ts:205 + server/src/services/chat/turnJob.ts:138-149 + client/src/chatStore.ts:97-102 · CANCEL while thinking is read as a plain failure, and a quick resend is mis-attributed, 2. should · server/src/services/chat/createFromDraft.ts:155-163, client/src/ChatSongCard.tsx:20-21, client/src/chatCopy.ts:168 · a take truncated at 360 s reads as DONE (F-044 edge), 3. nit · server/src/services/chat/turnJob.ts:136-137 · `turns` entry leaks when the queue is full, C0a code review (diff 41fa159...0ab70e1), Checked, no defect found

### Community 511 - "C0b code review (edit turn, splice, versions) — lens: code"
Cohesion: 0.33
Nodes (5): blocking, C0b code review (edit turn, splice, versions) — lens: code, checked, no finding, nit, should

### Community 512 - "C3 code review (reference songs) — lens: code"
Cohesion: 0.33
Nodes (5): blocking, C3 code review (reference songs) — lens: code, checked, no finding, nit, should

### Community 513 - "cancel_splice.mjs"
Cohesion: 0.29
Nodes (5): finished, heldSave(), Job, queryResult, Settled

### Community 514 - "Studio Network: Server on home.lan, GPU PC Wakes on Demand (planned 2026-10-06)"
Cohesion: 0.33
Nodes (6): Decisions, File-level plan, Later, Open questions, Studio Network: Server on home.lan, GPU PC Wakes on Demand (planned 2026-10-06), What each job kind starts

### Community 516 - "analysisTrigger.test.ts"
Cohesion: 0.33
Nodes (3): Job, SongFacts, YES

### Community 517 - "referenceStore.test.ts"
Cohesion: 0.47
Nodes (5): librarySong(), Reading, refDir(), refFiles(), wav()

### Community 520 - "scoreMidi.test.ts"
Cohesion: 0.40
Nodes (3): saveBlob, scoreMidi, songScoreMidi

### Community 521 - "build_listen.py"
Cohesion: 0.14
Nodes (8): clip(), main(), SP-3: cut before/after clips around each edit (original library audio vs the var, times(), window(), M1/CP2 audio checks (verifier); run in WSL: ~/sheetsage2/.venv/bin/python m1_ana, transcribe(), SP-6, the calibrated view: every arm's RENDER (before splicing) against v1, with

### Community 522 - "m0_analyze.py"
Cohesion: 0.60
Nodes (4): main(), M0 W5 audible checks (run in WSL with ~/sheetsage2/.venv/bin/python), CP1's meth, transcribe(), wsl()

### Community 523 - "Context skeleton (to land in W0)"
Cohesion: 0.40
Nodes (5): CI (gate item 5) — proposed `.github/workflows/checks.yml` (D-033), CLAUDE.md (target ≤ 120 lines including what it imports; today 109 + 94 imported), `.claude/rules/` (one per area in the module table; each ≤ 80 lines, `paths:` front matter), Context skeleton (to land in W0), `docs/decisions/` (standard track: choices with real alternatives)

### Community 524 - "Modules"
Cohesion: 0.40
Nodes (5): Client (`client/src/`, flat as today), Feature → modules, Modules, Mulakai server — `server/src/services/score/` (new subfolder, like `services/engines/`; D-034), yue-server (Python, W1 / F-017) — next to the vendored `upstream/abc_tools.py`, never a TS port (D-019)

### Community 525 - "CP-C0a, create leg (2026-10-06)"
Cohesion: 0.40
Nodes (4): CP-C0a, create leg (2026-10-06), Numbers, Stop lines, Turns

### Community 526 - "CP-C1 notes (2026-10-07)"
Cohesion: 0.40
Nodes (4): CP-C1 notes (2026-10-07), Findings, Runs, Stack (all mine, all stopped afterwards; the owner's :3001 / :5173 / :8001 / :8005 / :11434 untouched)

### Community 527 - "Interaction specs (chat)"
Cohesion: 0.40
Nodes (5): A turn, end to end (F-042, F-044, F-046, F-047, F-049; layout frames: chat-create.html frame 5, chat-turn.html from DT-C0), Design tasks, Interaction specs (chat), Stale mark (C1, F-055; CS-11), the analysis states (C1, F-052/F-053; CS-3, CS-4), the lyrics panel (C2, F-056; LY-3..LY-6), The player above the composer and a version arriving (F-045, F-048; chat-song.html CS-2, chat-lyrics.html frame 3)

### Community 528 - "E2 — Pairing verbs (F-083, F-085, F-086, F-087)"
Cohesion: 0.40
Nodes (5): E2 — Pairing verbs (F-083, F-085, F-086, F-087), F-083 · Bar-true regions from the score (normal), F-085 · EXTEND past the end (normal; R-036), F-086 · Replace one part of a single-mix song (normal; needs P1), F-087 · A closer-to-source REMASTER (small; owner A/B decides)

### Community 529 - "make_results.py"
Cohesion: 0.60
Nodes (4): line(), load(), main(), Consolidates results/score_<mode>.json (+ probe_tokens.json, langid.json) into r

### Community 530 - "analyze2.py"
Cohesion: 0.53
Nodes (5): main(), CP1 audible checks (run in WSL with ~/sheetsage2/.venv/bin/python), SP-3's metho, transcribe(), window(), wsl()

### Community 531 - "pairs.mjs"
Cohesion: 0.60
Nodes (4): apply(), job(), main(), SP-4 step 1 (Windows python, stdlib): edited scores + yue-server job bodies thro

### Community 535 - "asr_spans.py"
Cohesion: 0.67
Nodes (3): add_dlls(), main(), SP-4: Whisper (faster-whisper large-v3, the lyrics-server settings) on audio spa

### Community 536 - "make_tables.py"
Cohesion: 0.67
Nodes (3): SP-4: markdown tables for RESULT.md from results.json. python make_tables.py > r, seam_cell(), table()

### Community 537 - "config.py"
Cohesion: 0.40
Nodes (5): 6.1 API Definition, 6.2 Request Parameters, 6.3 Response Example, 6.4 Usage Example, 6. Format Input

### Community 538 - "E1 — Quick wins (F-082, F-084, F-088)"
Cohesion: 0.50
Nodes (4): E1 — Quick wins (F-082, F-084, F-088), F-082 · The song's facts in every ACE-Step edit (small; needs P1 for lego), F-084 · Route a song's first take by its language (normal; owner default Q-122), F-088 · Wordless vocal, then words (small; needs P1)

### Community 539 - "run_all.sh"
Cohesion: 0.50
Nodes (3): PYTHONPATH, PYTHONUTF8, run_all.sh script

### Community 540 - "run_all2.sh"
Cohesion: 0.50
Nodes (3): PYTHONPATH, PYTHONUTF8, run_all2.sh script

### Community 541 - "run_all3.sh"
Cohesion: 0.50
Nodes (3): PYTHONPATH, PYTHONUTF8, run_all3.sh script

### Community 542 - "results.md"
Cohesion: 0.50
Nodes (3): Acid  (span bars [18, 33]), Funky  (span bars [27, 34]), Gertar  (span bars [15, 22])

### Community 543 - "results2.md"
Cohesion: 0.50
Nodes (3): Acid: render vs v1 (span bars [18, 33]; v1 78.9 s), Funky: render vs v1 (span bars [27, 34]; v1 159.3 s), Gertar: render vs v1 (span bars [15, 22]; v1 214.8 s)

### Community 544 - "build_listen.mjs"
Cohesion: 0.50
Nodes (3): files, html, pairs

### Community 545 - "chatTurnsAttach.test.ts"
Cohesion: 0.50
Nodes (3): age(), DATA, file()

### Community 551 - "E2E Fails on Uncaught Page Errors (planned 2026-10-02)"
Cohesion: 0.67
Nodes (3): Decisions, E2E Fails on Uncaught Page Errors (planned 2026-10-02), File-level plan

### Community 553 - "Export a Score as MIDI (planned 2026-10-07)"
Cohesion: 0.67
Nodes (3): COVER and ARRANGE Reference Audio: No Influence Sliders (planned + implemented 2026-09-30), Decisions, File-level plan

## Knowledge Gaps
- **2567 isolated node(s):** `$schema`, `plugins`, `react/rules-of-hooks`, `react/only-export-components`, `name` (+2562 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **176 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `e()` connect `Voice` to `cancel_splice.mjs`, `Lyrics & Export Panel`, `planner_v1.py`, `songImport.test.ts`, `Core Domain Entities (Plan)`, `m1_services.mjs`, `FastAPI`, `Git Workflow Rules`, `.publish`, `client.md`, `FORGE — LoRA/LoKr Training & Dataset Studio (planning doc, not yet implemented)`, `13. Environment Variables`, `registry.ts`, `8. List Available Models`, `FakeAudio`, `Mulakai — UX & Visual Polish Notes`, `test_job_files.py`, `phrase_wav.py`, `planner.py`, `heal.py`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **Why does `map` connect `Mulakai — UX & Visual Polish Notes` to `Core Song/Layer/Version API`, `Lyrics & Export Panel`, `API Client & Create Flow`, `Path`, `AIGeneratingBackground.tsx`, `Playback Mix Engine`, `Universal Advanced Settings (Repaint + Add Layer) (implemented 2026-07-08)`, `Advanced Generation Settings`, `backfillGenTask.test.ts`, `songImport.test.ts`, `Settings Store`, `Create Draft Persistence + Origin-Aware Reuse (planned 2026-07-30)`, `test_chain.py`, `Jobs Service Test Suite`, `SettingsPanel.tsx`, `.submit`, `main.py`, `engineGenJobs.test.ts`, `7. Get Random Sample`, `9. Initialize or Switch Models`, `aggregate.py`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **Why does `r()` connect `Path` to `Editor UI Components`, `App Shell & Library UI`, `m1_driver.mjs`, `trials.mjs`, `Core Song/Layer/Version API`, `Universal Advanced Settings (Repaint + Add Layer) (implemented 2026-07-08)`, `AI Thinking & Create View`, `backfillGenTask.test.ts`, `Advanced Generation Settings`, `songImport.test.ts`, `MoveToEditorAction.tsx`, `adapters.test.ts`, `engineGenJobs.ts`, `SettingsPanel.tsx`, `Claude Commands`, `FORGE — LoRA/LoKr Training & Dataset Studio (planning doc, not yet implemented)`, `5. Batch Query Task Results`, `waveformPeaks.ts`, `7. Get Random Sample`, `11. Download Audio Files`, `8. List Available Models`, `test_api.py`, `scoreLimits.ts`, `m2_driver.mjs`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **What connects `$schema`, `plugins`, `react/rules-of-hooks` to the rest of the system?**
  _2957 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Backend Generation & Job Services` be split into smaller, more focused modules?**
  _Cohesion score 0.05322953923837576 - nodes in this community are weakly interconnected._
- **Should `Editor UI Components` be split into smaller, more focused modules?**
  _Cohesion score 0.06386946386946386 - nodes in this community are weakly interconnected._
- **Should `App Shell & Library UI` be split into smaller, more focused modules?**
  _Cohesion score 0.05042016806722689 - nodes in this community are weakly interconnected._