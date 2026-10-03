# Graph Report - Mulakai  (2026-10-03)

## Corpus Check
- 739 files · ~465,807 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 4477 nodes · 9606 edges · 397 communities (267 shown, 130 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 324 edges (avg confidence: 0.74)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f7955e27`
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
- 1. Authentication
- Cover Lyrics From the Recording (planned 2026-10-01)
- voiceStore.test.ts
- editorJobStore.test.ts
- Motion
- 5. Batch Query Task Results
- 6. Format Input
- E2E Fails on Uncaught Page Errors (planned 2026-10-02)
- Style Tag Vocabulary for the Caption Field (planned 2026-07-31)
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
- Exception
- JobStore
- Path
- READ LYRICS With TRANSCRIBE for Uploads (planned 2026-10-01)
- lyrics.test.ts
- lyricsClient.test.ts
- tsconfig.json
- 12. Health Check
- 1. Authentication
- A Settled Split Blocks Nothing (planned 2026-10-01)
- fake_infer.py
- README.md
- FastAPI
- Path
- Path
- Path
- Upstream Sync: `complete`/`lego` Skip the LM (planned + implemented 2026-09-30)
- UVR Separator: Roformer Vocals for SPLIT (planned + implemented 2026-09-30)
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
- 12. Health Check
- FastAPI
- Path
- Path
- GenerateRequest
- Path
- splitHealth.test.ts
- Abandoned Splits Leave No Stems Behind (planned 2026-10-02)
- ReferenceAudioPicker.tsx
- versionsTimings.test.ts
- stemSplit.evict.test.ts
- FastAPI
- Voice
- Playwright Golden-Path E2E (planned 2026-10-02)
- Path
- FastAPI
- Mulakai — Agent Instructions
- api.py
- COVER and ARRANGE Reference Audio: No Influence Sliders (planned + implemented 2026-09-30)
- Exception
- Worker
- A Dropped Generation Stops Polling (planned 2026-10-02)
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
- Add Layer Lyrics (implemented 2026-07-08)
- Add Layer Mixes Each Layer at Its Own Volume (planned 2026-10-02)
- An Unreachable ACE-Step Is a Failure, Not "No Models" (planned 2026-10-02)
- ANALYZE AUDIO Takes the genLock (planned 2026-10-02)
- READ LYRICS With TRANSCRIBE for Uploads (planned 2026-10-01)
- RE-EXTRACT Never Touches a Claimed Stem (planned 2026-10-02)
- Editor Failures Say So (planned 2026-10-02)
- COVER Sends the Settings It Shows (planned 2026-10-02)
- The Newest Library Search Wins (planned 2026-10-02)
- Idle Jobs Leave Every Registry (planned 2026-10-02)
- Lookup Failures Aren't Answers (planned 2026-10-02)
- Create-Side Lookup Failures (planned 2026-10-02)
- SPLIT Names Its Real Backend (planned 2026-10-02)
- Split Health: Which Service, and Why It's Off (planned 2026-10-02)
- Voice List Failures (planned 2026-10-02)
- Shader Surfaces Give Their WebGL Context Back (planned 2026-10-02)
- Repaint Crossfade Is Clamped at Submit (planned 2026-10-02)
- Import a Song (planned 2026-07-30)
- Output Format: Rate / Depth / Bitrate, Everywhere (planned + implemented 2026-07-31)
- STEPS AUTO Resolves Per Model (planned 2026-07-31)
- Upstream Sync: `complete`/`lego` Skip the LM (planned + implemented 2026-09-30)
- UVR Separator: Roformer Vocals for SPLIT (planned + implemented 2026-09-30)
- 8. List Available Models
- A Failed Generation Blocks Nothing (planned 2026-10-01)
- A Settled Split Blocks Nothing (planned 2026-10-01)
- COVER and ARRANGE Reference Audio: No Influence Sliders (planned + implemented 2026-09-30)
- Text2music Reference Audio: Style Influence Only (planned + implemented 2026-09-30)
- YuE2: Align With Upstream's `yue2-music` Skill (planned 2026-09-30)
- E2E Fails on Uncaught Page Errors (planned 2026-10-02)
- The Model List Waits Out a Busy ACE-Step (planned 2026-10-02)
- Universal Advanced Settings (Repaint + Add Layer) (implemented 2026-07-08)
- layersRepaint.test.ts
- Runner
- FastAPI
- Path
- Repaint Crossfade Is Clamped at Submit (planned 2026-10-02)
- Import a Song (planned 2026-07-30)
- Output Format: Rate / Depth / Bitrate, Everywhere (planned + implemented 2026-07-31)
- STEPS AUTO Resolves Per Model (planned 2026-07-31)
- Upstream Sync: `complete`/`lego` Skip the LM (planned + implemented 2026-09-30)
- UVR Separator: Roformer Vocals for SPLIT (planned + implemented 2026-09-30)
- Remove the HeartMuLa Engine (planned 2026-10-03)
- A Failed Editor Job Blocks Nothing (planned 2026-10-01)
- A Settled Split Blocks Nothing (planned 2026-10-01)
- COVER and ARRANGE Reference Audio: No Influence Sliders (planned + implemented 2026-09-30)
- E2E Fails on Uncaught Page Errors (planned 2026-10-02)
- The Model List Waits Out a Busy ACE-Step (planned 2026-10-02)
- Model Status Badge (planned 2026-10-02)
- Universal Advanced Settings (Repaint + Add Layer) (implemented 2026-07-08)
- client.md
- dock.md
- e2e.md
- graphify-out.md
- job-queue.md
- score-server.md
- ui.md
- versions-data.md
- yue-server.md
- ablations.sh
- ablations2.sh
- Fraction
- test_hallucinations.py
- YuePipeline
- engineGenJobs.test.ts
- abcMeta.ts
- scoreStatus.test.ts
- yueScoreRead.ts
- api.py
- contextGuard.ts
- scoreSource.test.ts
- 1. Authentication

## God Nodes (most connected - your core abstractions)
1. `Mulakai — Project Plan` - 81 edges
2. `useCreateDraftStore` - 58 edges
3. `useSettings` - 53 edges
4. `Decisions` - 51 edges
5. `api` - 48 edges
6. `config` - 40 edges
7. `Song` - 35 edges
8. `wasAborted()` - 35 edges
9. `queueJob()` - 35 edges
10. `Open questions` - 34 edges

## Surprising Connections (you probably didn't know these)
- `DockAddLayer()` --indirect_call--> `lyrics()`  [INFERRED]
  client/src/DockAddLayer.tsx → heartmula-server/tests/conftest.py
- `LayerLane()` --indirect_call--> `body()`  [INFERRED]
  client/src/LayerLane.tsx → pipeline/spikes/SP-3-cot-full-adherence/build_variants.py
- `RecipeQuality()` --indirect_call--> `q()`  [INFERRED]
  client/src/RecipeQuality.tsx → pipeline/spikes/SP-2-planner-quality/report.py
- `YueCoverPanel()` --indirect_call--> `abc()`  [INFERRED]
  client/src/YueCoverPanel.tsx → pipeline/spikes/SP-1-vram-handoff/make_inputs.py
- `test_a_chordless_plan_is_generated_with_cot_melody()` --references--> `NATIVE`  [EXTRACTED]
  yue-server/tests/test_instrumental.py → client/src/abcFacts.test.ts

## Import Cycles
- None detected.

## Communities (397 total, 130 thin omitted)

### Community 0 - "Backend Generation & Job Services"
Cohesion: 0.16
Nodes (23): message(), syncWarning(), loadLora(), loraStatus, setLoraScale(), toggleLora(), unloadLora(), getModelGeneration() (+15 more)

### Community 1 - "Editor UI Components"
Cohesion: 0.24
Nodes (11): RefineRail(), SongFields, AUTO_OPTION, KNOWN_TIME_SIGNATURES, KNOWN_VOCAL_LANGUAGES, TIME_SIGNATURES, timeSignatureLabel(), VOCAL_LANGUAGES (+3 more)

### Community 2 - "App Shell & Library UI"
Cohesion: 0.29
Nodes (8): PlaybackApi, fmt(), Player(), Props, PlayerFooter(), Props, Props, VolumeSlider()

### Community 3 - "Project Docs & Design Concepts"
Cohesion: 0.08
Nodes (24): R-001 · impact M · evidence platform, R-002 · impact H · evidence proven, qualified (SP-2, 2026-10-03: seen running; [RESULT](spikes/SP-2-planner-quality/RESULT.md); musicality listen OWED), R-003 · impact H · evidence proven (SP-1, 2026-10-03: [RESULT](spikes/SP-1-vram-handoff/RESULT.md)), R-004 · impact H · evidence known, R-005 · impact M · evidence known, R-006 · impact M · evidence known, R-007 · impact M · evidence known, R-008 · impact M · evidence known (+16 more)

### Community 4 - "Core Song/Layer/Version API"
Cohesion: 0.05
Nodes (46): backfillGenTask(), db, app, adaptersRouter, enginesRouter, foldersRouter, generateRouter, layersRouter (+38 more)

### Community 5 - "Lyrics & Export Panel"
Cohesion: 0.10
Nodes (23): songDetail, AddLayerJob, AddLayerSubmission, EditorJob, JobBase, RegenerateJob, RemasterJob, RepaintJob (+15 more)

### Community 6 - "API Client & Create Flow"
Cohesion: 0.18
Nodes (15): buildTagGuide(), clean(), Cluster, clusterByKeyword(), clusterByPrefix(), clusterBySuffix(), finalizeClusters(), INSTRUMENT_BUCKETS (+7 more)

### Community 7 - "Server Package Config"
Cohesion: 0.05
Nodes (39): 1. Reference Audio: Global Acoustic Feature Control, 2. Source Audio: Semantic Structure Control, 3. Source Audio Context-Based Control: Local Completion and Modification, 4. Base Model Advanced Audio Control Tasks, About Audio Control: Controlling Sound with Sound, About Caption: The Most Important Input, About Lyrics: The Temporal Script, About Music Metadata: Optional Fine Control (+31 more)

### Community 8 - "Client Package Config"
Cohesion: 0.05
Nodes (39): 1. Reference Audio: Global Acoustic Feature Control, 2. Source Audio: Semantic Structure Control, 3. Source Audio Context-Based Control: Local Completion and Modification, 4. Base Model Advanced Audio Control Tasks, About Audio Control: Controlling Sound with Sound, About Caption: The Most Important Input, About Lyrics: The Temporal Script, About Music Metadata: Optional Fine Control (+31 more)

### Community 9 - "Voice Picker & Management"
Cohesion: 0.19
Nodes (17): AudioFormat, BitDepth, clampDepth(), DEFAULT_OUTPUT, DEPTHS_BY_FORMAT, outputExt(), parseOutputSettings(), SampleRate (+9 more)

### Community 10 - "Playback Mix Engine"
Cohesion: 0.10
Nodes (42): sweepTemp(), STEM_KINDS, upload, OutputSettings, cancelQueued(), enqueue(), evictIdle(), sweepStaleTemp() (+34 more)

### Community 11 - "Client TSConfig (app)"
Cohesion: 0.09
Nodes (35): agree(), agree_tones(), analyse(), best_offset(), both(), chance(), chance_tones(), f1() (+27 more)

### Community 12 - "Advanced Generation Settings"
Cohesion: 0.10
Nodes (59): audioFileExt(), downloadAudio(), lyricTimestamp(), queryResult(), rawPathFromAudioUrl(), releaseTask(), ReleaseTaskParams, TaskResult (+51 more)

### Community 13 - "AI Thinking & Create View"
Cohesion: 0.14
Nodes (21): main(), lyricTagsRouter, health(), createRandomSample(), createSampleFromQuery(), extractTags(), FreshTagEntry, getProbeState() (+13 more)

### Community 14 - "Song Detail & Refine Rail"
Cohesion: 0.16
Nodes (26): ScoreSize, fitLyricsToSections(), hasWords(), scoreSections(), sectionOutline(), SCORE, UNSUNG, wordBlocks() (+18 more)

### Community 15 - "Client TSConfig (node)"
Cohesion: 0.05
Nodes (37): A Failed Generation Blocks Nothing (planned 2026-10-01), ACE-Step Integration (verified against docs/en/API.md + INFERENCE.md, 2026-07-02), Add Layer: Forced batch_size 1 + Track-Type Picker (implemented 2026-07-10), Architecture, Architecture, Create AUDIO/ARRANGE Flows — `cover` and `complete` (implemented 2026-07-07), Create Draft Persistence + Origin-Aware Reuse (planned 2026-07-30), Custom Player Controls (planned 2026-07-02, then implemented) (+29 more)

### Community 16 - "Add-Layer & Mix Bounce"
Cohesion: 0.13
Nodes (27): asTagList(), CAP, captionToStyleTags(), Found, headKind(), Kind, modifiersBefore(), NOT_STYLE (+19 more)

### Community 17 - "Settings Store"
Cohesion: 0.22
Nodes (8): _flag(), Settings, Clock, test_a_cancel_that_races_completion_wins(), test_idempotency_keys_expire_with_their_job(), test_settings_defaults_match_the_spike(), test_settings_read_the_environment(), test_sweep_drops_expired_jobs_and_their_artifacts()

### Community 18 - "Server TSConfig"
Cohesion: 0.13
Nodes (10): IdempotencyConflict, JobStore, QueueFull, In-memory job table and FIFO queue for yue-server.  The job record mirrors YuE, Drop finished jobs (and their artifacts) older than the retention window., Returns (job, created). A repeated Idempotency-Key with the same body         r, None for an unknown id, or one of another kind when `kind` is given., Block until a queued job exists (or stop/timeout), then mark it running. (+2 more)

### Community 19 - "Icon Sprite Assets"
Cohesion: 0.48
Nodes (7): Bluesky Icon (butterfly logo, social link), Discord Icon (game controller/mask logo, social link), Documentation Icon (book with folded corner, docs link), GitHub Icon (Octocat cat logo, source-code link), Social Icon (person silhouette with star badge, community link), icons.svg Sprite Sheet, X (Twitter) Icon (stylized X logo, social link)

### Community 20 - "Core Domain Entities (Plan)"
Cohesion: 0.15
Nodes (20): WordTimings, Props, lineRegion(), round2(), roundCovering(), sameRegion(), SPANS, widenToMinimum() (+12 more)

### Community 21 - "Tech Stack & Structure Docs"
Cohesion: 0.13
Nodes (24): coversApi, editorApi, EngineControl, generationApi, appendParams(), json(), libraryApi, lyricsApi (+16 more)

### Community 22 - "Client Lint Config"
Cohesion: 0.09
Nodes (38): DONE_LABEL, KIND_NAME, rowTitle(), RunningActivityRow(), SettledActivityRow(), SettledProps, UNTITLED, AI_KINDS (+30 more)

### Community 23 - "Demucs Stem-Split Server"
Cohesion: 0.12
Nodes (23): applyReasons(), AttemptDeps, AttemptsOutcome, parse(), planAttempts(), BAR_999, facts, start (+15 more)

### Community 24 - "FileTags Test Suite"
Cohesion: 0.33
Nodes (5): createFromPath, fakeFile, fakeId3Tag, fakeTag, idSettings

### Community 25 - "Player & Mix Polish (Plan)"
Cohesion: 0.10
Nodes (38): AudioFormat, BitDepth, clampDepth(), depthLabel(), DEPTHS_BY_FORMAT, FORMATS, maxDepth(), MP3_BITRATES (+30 more)

### Community 28 - "Client TSConfig Root"
Cohesion: 0.33
Nodes (11): A SheetSage2 snapshot whose infer.py is tests/fake_infer.py., sheetsage(), test_a_failed_render_still_returns_the_score(), test_a_replayed_key_returns_the_same_transcription(), test_a_transcription_serves_its_score_preview_and_facts(), test_cancel_kills_a_running_transcription(), test_failures_say_what_sheetsage2_said(), test_health_says_why_transcription_is_unavailable() (+3 more)

### Community 32 - "Jobs Service Test Suite"
Cohesion: 0.13
Nodes (25): config, __dirname, generateHelpersRouter, queueLm(), call(), Envelope, fetchWithTimeout(), healthState (+17 more)

### Community 39 - "Human-Centered Design Philosophy"
Cohesion: 0.07
Nodes (27): 10. ~~Abort/persist race reverses an abort silently~~ — fixed, PR #107, 11. ~~Job registries never evict~~ — fixed, PRs #96 + #104, 12. ~~WebGL context leak in `ShaderCanvas`~~ — fixed, PR #108, 13. ~~`generationStore.pollJob` has no cancellation~~ — fixed, PRs #104 + #106, 14. Misc leaks, 15. UX inconsistencies, 16. Shader palette violation, 17. Server-side polish (+19 more)

### Community 47 - "Git Workflow Rules"
Cohesion: 0.12
Nodes (22): LyricLine, isEditorBusy(), selectSplitRunning(), isGenerating(), LyricAlignment, matchSectionBlocks(), splitLyricsBlocks(), findActiveSectionIndex() (+14 more)

### Community 48 - "Red Lines (Never Do)"
Cohesion: 0.12
Nodes (24): beat_units(), chord_text(), decomp(), key_pc(), lyric_blocks(), new_key(), op_cut(), op_edit_style() (+16 more)

### Community 49 - "SettingsPanel.tsx"
Cohesion: 0.05
Nodes (33): Version, reading(), activeLayers(), AudibleTake, audibleTakes(), layer(), version(), volumes() (+25 more)

### Community 50 - "Claude Commands"
Cohesion: 0.12
Nodes (30): Folder, Song, CommandActivityLayer(), AppCommandDeps, appCommands(), GROUP_ORDER, itemScore(), paletteResults() (+22 more)

### Community 58 - "FORGE — LoRA/LoKr Training & Dataset Studio (planning doc, not yet implemented)"
Cohesion: 0.14
Nodes (12): Layer, Props, Props, EditorRail(), Props, latestOnly(), LayerLane(), LayerPatch (+4 more)

### Community 59 - "4. Create Generation Task"
Cohesion: 0.15
Nodes (12): Configuration, Design, Development, Licence, Mulakai, Repository layout, Requirements, Running it (+4 more)

### Community 60 - "lyricSections.ts"
Cohesion: 0.14
Nodes (21): call(), LoadedModel, loadedModels(), notOllama(), PlannerTarget, probePlanner(), releasePlanner(), stillLoaded() (+13 more)

### Community 61 - "CreateView.tsx"
Cohesion: 0.11
Nodes (33): AceGenTune(), AUTO, autoStepsLabel(), AddLayerTune(), AdvancedGenSettings(), INFER_METHOD_OPTIONS, CustomSelect(), Props (+25 more)

### Community 62 - "demucs-server"
Cohesion: 0.08
Nodes (29): FolderScope, App(), View, SettingsSection, createCoverDraft(), draftHasIntent(), reusePromptDraft(), FolderRail() (+21 more)

### Community 63 - "13. Environment Variables"
Cohesion: 0.07
Nodes (55): EngineCapabilities, EngineId, EngineInfo, aceOnlyNote(), coverEngines(), coverUnavailableReason(), durationReadout(), Engine (+47 more)

### Community 64 - "Mulakai — UX & Visual Polish Notes"
Cohesion: 0.12
Nodes (32): resolveCoverSource(), CoverSteps(), EngineGenSettings(), useEngineSettings, addSample(), etaKey(), EtaKeyParts, EtaState (+24 more)

### Community 65 - "FakeAudio"
Cohesion: 0.14
Nodes (28): ActivityButton(), ActivityDrawer(), Drawer(), Props, retryEntry(), ActivityEntry, EDITOR_BADGE, editorSettled() (+20 more)

### Community 66 - "lyricTags.ts"
Cohesion: 0.40
Nodes (4): INLINE_TAGS, LYRIC_TAGS, LyricTag, SECTION_TAGS

### Community 67 - "5. Batch Query Task Results"
Cohesion: 0.06
Nodes (24): create_app(), HTTP layer, built around an injected separate() so tests need no torch. Speaks, JobFiles, The on-disk side of /split: each split gets a job dir under data_dir, and its s, Make the stems downloadable; returns kind -> path under /audio., _remove(), Clock, finished_job() (+16 more)

### Community 68 - "6. Format Input"
Cohesion: 0.17
Nodes (21): makeScorePlanRouter(), planView(), scorePlanRouter, splitStatus(), isQueued(), queuePosition(), plan(), reasonOf() (+13 more)

### Community 69 - "7. Get Random Sample"
Cohesion: 0.11
Nodes (16): IdempotencyConflict, JobStore, QueueFull, In-memory job table and FIFO queue.  Snapshots mirror YuE2-Turbo's yue2-serve, Forget finished jobs older than the cutoff; returns their ids., Returns (snapshot, created). A repeated key with the same request is a, Block for the next queued job, mark it running, return (id, request)., Record the outcome. A cancel that arrived mid-job wins; returns the final status (+8 more)

### Community 70 - "9. Initialize or Switch Models"
Cohesion: 0.10
Nodes (22): lyricsRouter, receiveSource(), upload, LyricSegment, lyricsHealth(), LyricsReading, LyricWord, num() (+14 more)

### Community 71 - "genLock.ts"
Cohesion: 0.16
Nodes (10): bar_seconds(), Each score section's start in seconds, for placing read lyrics by time (PLAN.md, (label, 0-based first bar) for each `% label` comment, in score order., One bar on the score's tempo grid, for sections past the last downbeat., [{label, bar, seconds}] per section, or None when there is nothing to anchor it, section_bars(), section_starts(), test_a_section_past_the_last_downbeat_is_extrapolated_on_the_tempo_grid() (+2 more)

### Community 72 - "React + TypeScript + Vite"
Cohesion: 0.20
Nodes (13): beatsPerBar(), BPM, buildOpSchema(), checkOps(), isInt(), obj(), op(), OP_NAMES (+5 more)

### Community 73 - "10. Server Statistics"
Cohesion: 0.18
Nodes (3): test_happy_path_serves_flac_score_and_result(), test_idempotency_key_replays_the_original_job(), test_truncated_job_keeps_its_audio()

### Community 74 - "11. Download Audio Files"
Cohesion: 0.11
Nodes (17): ForgeSection(), daysLeft(), fmtBytes(), LibraryMaintenanceSection(), LyricTagGuideSection(), LyricTagsSection(), OutputMetadataSection(), Props (+9 more)

### Community 75 - "8. List Available Models"
Cohesion: 0.06
Nodes (44): SplitHealth, acestepRow(), AcestepState, checking(), COVER_MODEL, engineRows(), RowState, service() (+36 more)

### Community 77 - "1. Authentication"
Cohesion: 0.09
Nodes (19): BaseModel, ('ready' | 'not_configured' | 'missing_files', detail)., Transcriber, Delete artifact directories left by a previous run (jobs are not persisted)., GenerateRequest, The POST /v1/jobs body, validated before anything reaches the pipeline., yue2-serve's body, minus `n` (one take per job), plus a tolerated `id`     (Mul, add_score_routes() (+11 more)

### Community 78 - "Training API"
Cohesion: 0.10
Nodes (37): ActionDock(), activeNumber(), DockRepaintInputs, VERBS, DockRepaint(), Props, SectionLyrics, DockSectionLyrics() (+29 more)

### Community 133 - "Waveform.tsx"
Cohesion: 0.07
Nodes (26): author, dependencies, better-sqlite3, express, multer, node-taglib-sharp, description, devDependencies (+18 more)

### Community 134 - "settings.ts"
Cohesion: 0.26
Nodes (10): fit_to_ceiling(), Path, Write the engine's float audio as a lossless FLAC master.  HeartMuLa's float p, Return (audio, gain_db). Only ever turns down, never up., write_flac(), test_audio_within_the_ceiling_is_untouched(), test_non_finite_samples_are_rejected(), test_over_full_scale_is_turned_down_to_the_ceiling() (+2 more)

### Community 135 - "Add Layer (lego) — Phase 6+7 Design (planned 2026-07-02)"
Cohesion: 0.23
Nodes (14): arrange(), is_instrumental(), Upstream's instrumental workflow (PLAN.md "YuE2: Align With Upstream's `yue2-mu, Upstream's rule: lyrics that are only section tags. Empty lyrics don't     coun, `% pre-chorus` → `[Pre-Chorus]`, as upstream's `lyric_tags` writes them., Returns (plan, request, record) to generate from. record is None when the     r, section_tags(), noop() (+6 more)

### Community 136 - "Repaint Editor UX Upgrade (planned 2026-07-02)"
Cohesion: 0.19
Nodes (15): plan, QueueEntry, DockSplit(), GenerateButton(), Props, PreviewPlayback, queuedLine(), queuedTitle() (+7 more)

### Community 137 - "Export & Remaster — Phase 9 Design (planned 2026-07-06)"
Cohesion: 0.08
Nodes (37): abc(), Build the planner prompt and the two yue-server job bodies from real library dat, BAR_999, base, deps(), events, FakeOllama, FakeYue (+29 more)

### Community 138 - "AIGeneratingBackground.tsx"
Cohesion: 0.22
Nodes (12): captionToTags(), CFG, clamp(), heartmula, HEARTMULA_CAPABILITIES, isSet(), MAX_LENGTH_MS, NO_META (+4 more)

### Community 139 - "Add Layer Lyrics (implemented 2026-07-08)"
Cohesion: 0.21
Nodes (15): IdeaLucky(), IdeaSteps(), instrumentalNaNote(), isInstrumental(), toggleInstrumental(), followLmJob(), lmWaitNote(), useLmJob() (+7 more)

### Community 140 - "Universal Advanced Settings (Repaint + Add Layer) (implemented 2026-07-08)"
Cohesion: 0.09
Nodes (37): AutoReadFacts, shouldAutoRead(), base, Props, aceCoverLocks(), CoverScore, CoverSourceState, engineLockedBy() (+29 more)

### Community 141 - "Create AUDIO/ARRANGE Flows — `cover` and `complete` (implemented 2026-07-07)"
Cohesion: 0.19
Nodes (14): ActiveAdapterNote(), AdapterAddForm(), AdaptersSection(), AdapterStrength(), activeAdapter(), adapterConsequence(), AdapterState, deleteAdapter (+6 more)

### Community 142 - "backfillGenTask.test.ts"
Cohesion: 0.22
Nodes (11): make_client(), check_contract(), Contract fixtures (D-039): each score-route request and the reply pytest saw, sa, POST /v1/scores/read and /v1/scores/apply (F-017): tokens with chords kept, CPU, test_apply_rejects_a_malformed_request(), test_apply_returns_the_edit_its_checks_and_what_changed(), test_contract_replies(), test_read_reports_verdict_facts_seconds_and_tokens_with_chords_kept() (+3 more)

### Community 143 - "api.ts"
Cohesion: 0.14
Nodes (15): Fetch, test_demucs_looks_again_after_download(), test_demucs_still_missing_after_download_raises(), test_demucs_uses_an_installed_model_without_resolving(), test_reuses_the_cached_entry(), test_unknown_hash_leaves_it_to_the_runner(), test_writes_the_upstream_entry_for_the_hash(), demucs_model_path() (+7 more)

### Community 145 - "Create Draft Persistence + Origin-Aware Reuse (planned 2026-07-30)"
Cohesion: 0.10
Nodes (28): AudioPreviewPopover(), Props, ClearDraftButton(), ContinueRow(), Props, CoverSourcePicker(), START_FROM, isDraftEmpty() (+20 more)

### Community 146 - "FakeAudio"
Cohesion: 0.14
Nodes (18): generateAudioRouter, BOOLEAN_FIELDS, GEN_FIELDS, labelOnlyReferenceMeta(), NUMERIC_FIELDS, pickMultipartParams(), pickParams(), upload (+10 more)

### Community 147 - "devDependencies"
Cohesion: 0.17
Nodes (11): devDependencies, @playwright/test, tsx, @types/node, typescript, name, private, scripts (+3 more)

### Community 148 - "MoveToEditorAction.tsx"
Cohesion: 0.31
Nodes (9): send(), target(), allContracts(), contract(), CONTRACT_DIR, ContractFixture, FakeYue, same() (+1 more)

### Community 149 - "AdaptersSection.tsx"
Cohesion: 0.44
Nodes (7): abcFacts, barsOf(), header(), keyOf(), MODES, tempoOf(), NATIVE

### Community 150 - "SettingsView.tsx"
Cohesion: 0.09
Nodes (37): addLayerCommitLabel(), addLayerConsequence(), addLayerName(), sungTrack(), trackLabel(), AddLayerDraft, useAddLayerDraft, DockAddLayer() (+29 more)

### Community 151 - "Waveform.tsx"
Cohesion: 0.11
Nodes (24): AnalyzeAudioButton(), Props, ModelInventory, AutoTextarea(), Props, CarriedPromptNote(), MEANING, CreateStep() (+16 more)

### Community 152 - "generationStore.ts"
Cohesion: 0.08
Nodes (24): dependencies, framer-motion, react, react-dom, zustand, devDependencies, oxlint, @types/node (+16 more)

### Community 153 - "adapters.test.ts"
Cohesion: 0.15
Nodes (18): analyzeAndWait(), AnalyzeCancelled, RefineResult, Props, AnalyzeSource, AnalyzeState, canAnalyze(), fillable() (+10 more)

### Community 154 - "inferenceSteps.ts"
Cohesion: 0.11
Nodes (22): bars_text(), chord_offsets(), decompose(), emit_bar(), emit_line(), parse_bar(), Bar-level events of a native YuE2 score, for the score model and ops.  An event, `units` as upstream's allowed lengths, longest first (27 -> 24 + 3). (+14 more)

### Community 155 - "adapterStore.test.ts"
Cohesion: 0.23
Nodes (4): JobFiles, The on-disk side of /split: each split gets a job dir under data_dir, and its s, Make the stems downloadable; returns kind -> path under /audio., _remove()

### Community 156 - "apiStatusStore.ts"
Cohesion: 0.18
Nodes (23): parse_abc(), Public import entry point; no model load, files, or optional dependencies., bar_range_of_line(), blocks_of(), body(), ins_window(), main(), music_lines() (+15 more)

### Community 157 - "lyricSections.ts"
Cohesion: 0.13
Nodes (19): mix_into(), output_path(), The two-pass split behind /split. See PLAN.md "UVR Separator: Roformer Vocals f, Where uvr-headless-runner writes a stem: `{base}_({Stem}).wav`., Add `extra` into `target` in place, keeping float32 WAV., Separate `src` into Mulakai's four StemKinds, as float32 WAVs under `out_dir`., _require(), run_chain() (+11 more)

### Community 158 - "compilerOptions"
Cohesion: 0.20
Nodes (9): compilerOptions, module, moduleResolution, noEmit, skipLibCheck, strict, target, types (+1 more)

### Community 159 - "Adapter Loading (LoRA/LoKr) at Inference (planned 2026-07-31)"
Cohesion: 0.12
Nodes (20): bar_sums(), _bar_units(), _chords_per_bar(), message(), Checks around upstream's parser and comparer: a score's verdict (upstream's own, {bar, voice, units, expected} for each bar whose lengths do not add up to     it, {ok, error, bar_sums, messages, chords_present}; error is upstream's text., _units() (+12 more)

### Community 160 - "adapters.test.ts"
Cohesion: 0.29
Nodes (4): loadLora, loraStatus, setLoraScale, unloadLora

### Community 161 - "SectionStrip.tsx"
Cohesion: 0.09
Nodes (21): Acid — "what makes something happen?" (commit actions), AI states — the one exception to "one hue, one job", App model — a flat set of top-level views, one page, Audio preview module (added 2026-07-29), Carbon — "the world" (structure), Color tokens, Copy rules, Design language in one sentence (+13 more)

### Community 162 - "Style Tag Vocabulary for the Caption Field (planned 2026-07-31)"
Cohesion: 0.29
Nodes (3): jobStatus, lyricsHealth, readTimings

### Community 163 - "Output Format: Rate / Depth / Bitrate, Everywhere (planned + implemented 2026-07-31)"
Cohesion: 0.24
Nodes (20): check_edit(), {ok, problems, differences} for an edit made by `ops` (the applied ones);     di, apply_ops(), {abc, style, verdicts}: the edited score and style, one verdict per op., sync_style_bpm(), changed_lines(), chord(), F-017 #3: SET_TEMPO, REHARMONIZE and EDIT_STYLE, each checked with upstream's pa (+12 more)

### Community 164 - "STEPS AUTO Resolves Per Model (planned 2026-07-31)"
Cohesion: 0.14
Nodes (9): apply_ops(), Doc, emit_body(), op_write_phrase(), parse_body(), [(section_index0, group, bar_index_in_group)] in global order, (first_bar, last_bar) 1-based inclusive; None when the section has no bars, bar -> [(beat_units_offset, chord)] for the Vocal voice (+1 more)

### Community 168 - "adapterStore.test.ts"
Cohesion: 0.10
Nodes (19): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+11 more)

### Community 169 - "waveformPeaks.ts"
Cohesion: 0.23
Nodes (13): planner_call(), ev(), http(), Mem, ps(), SP-1 driver: planner (Ollama) <-> YuE2 (yue-server) VRAM hand-off. Throwaway. S, wait until VRAM stable (±tol MiB) for secs; return it, Sampler (+5 more)

### Community 171 - "ExportPanel.tsx"
Cohesion: 0.06
Nodes (48): Engine, Generated, JobCancelled, What the job worker needs from an engine. Torch-free, so the API, the queue and, Raised inside a job when its cancel flag is seen., drop_kv_caches(), HeartMulaEngine, park() (+40 more)

### Community 173 - "JobStore"
Cohesion: 0.17
Nodes (11): prepare_score(), Checks a supplied score (a cover's `abc`) before it is queued, so a bad one is, The score to generate from: validated, and chord-free for `melody`., The header (everything before the first `% name` line) and each section's     b, ScoreError, split_sections(), POST /v1/scores/measure and the section split behind it (PLAN.md, "YuE2 Covers:, test_a_score_without_sections_is_all_header() (+3 more)

### Community 174 - "Exception"
Cohesion: 0.16
Nodes (18): note_count(), bar_map(), key_notes(), lyric_blocks(), _number(), Doc, Fraction, What the planner is told about a score instead of the raw ABC (SP-2's v2 prompt) (+10 more)

### Community 175 - "engineGenJobs.ts"
Cohesion: 0.06
Nodes (15): playOrStayPaused(), STAYS_PAUSED, make(), PendingAudio, createPreviewPlayback(), PreviewAudioElement, PreviewSnapshot, FakeAudio (+7 more)

### Community 176 - ".publish"
Cohesion: 0.15
Nodes (9): test_classify(), classify(), Engine, Exception, JobStore, Path, The single inference thread: load the engine once, then run jobs one at a time., Jobs live in memory, so job folders left by an earlier process are orphans. (+1 more)

### Community 177 - "stemSplit.reextract.test.ts"
Cohesion: 0.29
Nodes (3): idle(), settledSplit(), StemKind

### Community 178 - "JobCancelled"
Cohesion: 0.29
Nodes (3): base, current, ScoreStatus

### Community 179 - "Multiple Song-Creation Engines (planned 2026-09-30)"
Cohesion: 0.14
Nodes (14): DATA_ROOT, PORTS, test, activeVersion(), downloadBytes(), dragRegion(), FakeTask, fakeTasks() (+6 more)

### Community 180 - "heartmula.ts"
Cohesion: 0.33
Nodes (4): client, engine, FACTS, source

### Community 181 - ".submit"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 182 - "main.py"
Cohesion: 0.19
Nodes (15): DURATION_SEC, FakeTask, MODELS, ok(), PENDING_MS, PORT, queryRow(), readBody() (+7 more)

### Community 183 - "yue-server"
Cohesion: 0.06
Nodes (34): Open questions, Q-001 · blocking · stage 1 · answered → D-005, Q-002 · blocking · stage 5 · answered → D-007 (palette + Activity sub-questions stay open for stage 5), Q-003 · blocking · stage 1 · answered → D-006, Q-004 · assumable · stage 1 · answered → D-008, Q-005 · assumable · stage 4 · answered by the tree → D-022 (genQueue.ts present in the working tree; verify on main), Q-006 · assumable · stage 3 · open, Q-007 · blocking · stage 3 · assumed → D-010 (settled by upstream docs 2026-10-03; audible adherence spiked as R-013 / SP-3) (+26 more)

### Community 184 - "engine_api.py"
Cohesion: 0.40
Nodes (3): acestepHealth, engineHealth, transcriptionHealth

### Community 185 - "Mulakai"
Cohesion: 0.20
Nodes (7): cancelSplit, jobStatus, repaint, repaintParams, settled, splitStatus, startSplit

### Community 186 - "SongEngine"
Cohesion: 1.00
Nodes (3): drop_hallucinations(), _norm(), _stock()

### Community 187 - "run_job"
Cohesion: 0.20
Nodes (7): draft(), jobStatus, READING, readLyrics, src, T, withScore()

### Community 188 - "timingsJobs.test.ts"
Cohesion: 0.67
Nodes (3): from_env(), Settings, read once from the environment., Settings

### Community 189 - "CustomSelect.tsx"
Cohesion: 0.11
Nodes (17): Architecture — Mulakai score agent (M0 on top of the existing app), CI (gate item 5) — proposed `.github/workflows/checks.yml` (D-033), CLAUDE.md (target ≤ 120 lines including what it imports; today 109 + 94 imported), `.claude/rules/` (one per area in the module table; each ≤ 80 lines, `paths:` front matter), Client (`client/src/`, flat as today), Context map (current) and the CI gap, Context skeleton (to land in W0), Core-promise path through the code (+9 more)

### Community 190 - "engineGenJobs.test.ts"
Cohesion: 0.14
Nodes (20): COT_VALUES, NUMBER_FIELDS, pickCreateFields(), STRING_FIELDS, coverEngine(), coversRouter, PREVIEW_HEADERS, receiveSource() (+12 more)

### Community 191 - "abcMeta.ts"
Cohesion: 0.20
Nodes (17): build_cases(), evaluate(), first_idx(), gpu_snap(), intent(), jazzy(), kinds_no_style(), library() (+9 more)

### Community 192 - "yue2.ts"
Cohesion: 0.22
Nodes (11): buildYue2CoverRequest(), buildYue2Request(), chooseSeed(), INSTRUMENTAL_CONDITIONS, instrumentalStyle(), LANGUAGE_NAMES, METER_TEXT, meterText() (+3 more)

### Community 193 - "heartmula-server"
Cohesion: 0.15
Nodes (10): downbeat.lab's first column; empty when the file is missing or unreadable., read_downbeats(), _collect(), _kill(), SheetSage2 transcription, the second job kind (PLAN.md, "yue-server transcripti, Transcribe into `out`; returns the result facts plus `preview` (bool)., _read(), run_transcription() (+2 more)

### Community 194 - "test_store_and_worker.py"
Cohesion: 0.04
Nodes (51): D-001 · 2026-10-03 · stage 1 · by: assumed, D-002 · 2026-10-03 · stage 3 · by: assumed, D-003 · 2026-10-03 · stage 4 · by: assumed, D-004 · 2026-10-03 · stage 1 · by: assumed, D-005 · 2026-10-03 · stage 1 · by: user, D-006 · 2026-10-03 · stage 1 · by: user, D-007 · 2026-10-03 · stage 5 · by: user, D-008 · 2026-10-03 · stage 1 · by: user (+43 more)

### Community 195 - "README.md"
Cohesion: 0.24
Nodes (6): ShaderCanvas(), compile(), createProgram(), Program, startShader(), disconnect

### Community 196 - "engines.test.ts"
Cohesion: 0.43
Nodes (6): post(), test_downloading_every_stem_leaves_the_data_dir_empty(), test_failed_split_is_a_500_and_still_frees_the_gpu(), test_health_answers_while_a_split_runs(), test_split_keeps_only_the_served_stems(), test_split_returns_downloadable_urls_for_all_four_stems()

### Community 198 - "uvr-server"
Cohesion: 0.13
Nodes (16): Any, dominant_language(), make_transcriber(), The language most sung words are in: each 30 s window holding words votes its de, The model is loaded per job and freed afterwards, handing its VRAM back     to, FakeModel, Stands in for faster_whisper.WhisperModel: records each call, yields     segmen, test_a_failed_job_still_frees_the_model() (+8 more)

### Community 199 - "generationStore.test.ts"
Cohesion: 0.18
Nodes (8): activeGeneration, coverWithEngine, generate, generateFromAudio, generateWithEngine, jobStatus, params, queue

### Community 200 - "Color tokens"
Cohesion: 0.29
Nodes (6): Config (env vars), Endpoints, lyrics-server, Run, Setup (native Windows), Tests

### Community 201 - "YuE2 Melody Covers via SheetSage2 (planned 2026-09-30)"
Cohesion: 0.18
Nodes (4): Doc, Fraction, The bar's events to change in place; a full-bar rest becomes plain rests., (section number, label, first bar, last bar) for each section with bars.

### Community 203 - "registry.test.ts"
Cohesion: 0.10
Nodes (19): test_a_supplied_score_is_checked_and_stripped_for_melody(), test_an_instrumental_cover_moves_the_supplied_melody_to_ins(), Stands in for run_mdx_headless / run_demucs_headless: records each call     and, test_health_reports_loading_then_failed(), test_the_job_saves_the_converted_score_the_planned_one_and_the_record(), RuntimeError, FakePipeline, A fake of the yue_pipeline.YuePipeline adapter, so tests run without torch, yue (+11 more)

### Community 204 - "The Newest Library Search Wins (planned 2026-10-02)"
Cohesion: 0.12
Nodes (19): Transcription, barSeconds(), CoverScoreLike, lineTime(), Placement, placeReading(), sectionAt(), sectionBarCounts() (+11 more)

### Community 205 - "Upstream Sync: `complete`/`lego` Skip the LM (planned + implemented 2026-09-30)"
Cohesion: 0.18
Nodes (15): fresh_directory(), Small standard-library helpers shared by the portable command-line tools., sha256(), write_json(), compile_events(), compress(), fraction(), lengths() (+7 more)

### Community 206 - "UVR Separator: Roformer Vocals for SPLIT (planned + implemented 2026-09-30)"
Cohesion: 0.36
Nodes (11): client_for(), fake_separate(), post(), Writes what demucs.separate.main() would: job_dir/<model>/<stem>.wav., test_downloading_every_stem_leaves_the_data_dir_empty(), test_health_answers_while_a_split_runs(), test_health_names_the_model(), test_no_stems_is_a_500() (+3 more)

### Community 207 - "COVER and ARRANGE Reference Audio: No Influence Sliders (planned + implemented 2026-09-30)"
Cohesion: 0.17
Nodes (10): http(), ps(), Per-model side measurements: cold load, tokens/s, GPU/CPU split, VRAM peak and r, bar_map(), build_schema(), key_notes(), op_schemas(), Doc (+2 more)

### Community 208 - "Text2music Reference Audio: Style Influence Only (planned + implemented 2026-09-30)"
Cohesion: 0.13
Nodes (15): Ablations (each 2 reps over the same scores, same models), Criterion (D-013, unchanged), Models (D-016), Not covered, Owed: WRITE PHRASE musicality listen, Per-template, final prompt (v2), both models, Question, R-015 · does a score plus rules fit the context? Yes at 16k; and Ollama overflows silently (+7 more)

### Community 210 - "RE-EXTRACT Never Touches a Claimed Stem (planned 2026-10-02)"
Cohesion: 0.33
Nodes (15): AbcError, compare(), fail(), json_value(), key_accidentals(), main(), meter_value(), parse() (+7 more)

### Community 212 - "1. Authentication"
Cohesion: 0.15
Nodes (12): compilerOptions, esModuleInterop, module, moduleResolution, outDir, rootDir, skipLibCheck, strict (+4 more)

### Community 213 - "Cover Lyrics From the Recording (planned 2026-10-01)"
Cohesion: 0.25
Nodes (6): LayerRef, pendingTakes(), TAKE_KINDS, empty, vocals, useNextVersion()

### Community 214 - "voiceStore.test.ts"
Cohesion: 0.15
Nodes (10): test_progress_is_a_per_stage_fraction(), _error(), Exception, JobStore, The single inference thread: loads the pipeline once, then runs queued jobs one, Only meaningful once ready; the submit routes return 503 before that., The score's size in the planner's tokens; None until the pipeline is loaded., run_job() (+2 more)

### Community 215 - "editorJobStore.test.ts"
Cohesion: 0.25
Nodes (6): failedRepaint(), jobs(), jobStatus, params, repaint, retakeVersion

### Community 216 - "Motion"
Cohesion: 0.20
Nodes (9): AGENTS.md — Mulakai Development Rules, Code Style, Design System (mandatory for all UI work), Git Workflow, Module Size Policy, Red Lines, Scope Discipline, Spec-Driven Development (+1 more)

### Community 217 - "5. Batch Query Task Results"
Cohesion: 0.16
Nodes (18): Props, adoptLock(), newGenKey(), GetState, JobsSlice, polling, pollJob(), pollUntilSettled() (+10 more)

### Community 218 - "6. Format Input"
Cohesion: 0.20
Nodes (9): 12.1 API Definition, 12.2 Response Example, 12. Health Check, 2. Response Format, 3. Task Status Description, ACE-Step API Client Documentation, Best Practices, Error Handling (+1 more)

### Community 219 - "E2E Fails on Uncaught Page Errors (planned 2026-10-02)"
Cohesion: 0.27
Nodes (11): add_score_edit_routes(), ApplyRequest, Chord, EditStyle, _parsed(), FastAPI, POST /v1/scores/read and POST /v1/scores/apply: the score agent's CPU-only route, ReadRequest (+3 more)

### Community 220 - "Style Tag Vocabulary for the Caption Field (planned 2026-07-31)"
Cohesion: 0.44
Nodes (8): client_for(), post(), seg(), test_failed_job_is_a_500_and_removes_the_upload(), test_hallucinated_segments_are_dropped(), test_health_names_the_model_without_running_a_job(), test_language_is_passed_when_given(), test_transcribe_hands_over_the_upload_and_returns_segments()

### Community 222 - "YuE2 Covers: Pick the Score's Sections (planned 2026-10-01)"
Cohesion: 0.25
Nodes (5): cancelJob, jobStatus, queue, sample, submit

### Community 223 - "10. Server Statistics"
Cohesion: 0.18
Nodes (30): EngineTarget, errorMessage(), failure(), fetchAudio(), fetchScore(), headers(), health(), request() (+22 more)

### Community 224 - "test_api.py"
Cohesion: 0.20
Nodes (7): create_app(), Engine, FastAPI, Settings, Thin HTTP wrapper around HeartMuLa (https://github.com/HeartMuLa/heartlib) so M, GenerateRequest, POST /v1/jobs body. Field names are heartlib's own, so Mulakai's engines/heartm

### Community 225 - "Mulakai — UX & Visual Polish Notes"
Cohesion: 0.14
Nodes (23): describe(), generateStatusRouter, abortRunning(), cancelQueuedForSong(), cancelWhere(), Entry, GenKind, GenTask (+15 more)

### Community 226 - "Vendored ACE-Step 1.5 documentation"
Cohesion: 0.20
Nodes (9): Approach & track, Brief — Mulakai (reconstructed by adopt audit, 2026-10-03), Candidate new feature (NOT built): SCORE AGENT for YuE2 songs, Constraints, Core promise, For whom, MVP is done when (as the repo implies; the MVP shipped long ago and the app is past it), Non-goals (v1, from AGENTS.md / README) (+1 more)

### Community 227 - "Add Layer Lyrics (implemented 2026-07-08)"
Cohesion: 0.25
Nodes (4): cancelJob, CANCELLED, jobStatus, submitted

### Community 228 - "ShaderCanvas.tsx"
Cohesion: 0.20
Nodes (10): SP-1 phases. usage: python run.py <phase> ...   phases: baseline planner_cycle h, mutate(), R-016: golden cases for a TypeScript port of the upstream validator. For every l, verdict(), chord_midi(), hz(), main(), Cheap audio for the owed WRITE PHRASE musicality listen: render LLM-written phra (+2 more)

### Community 230 - "Training API"
Cohesion: 0.14
Nodes (14): Component map / file-level plan, Decisions, Decisions, Decisions, Decisions, File-level plan, File-level plan, File-level plan (+6 more)

### Community 231 - "YuE2: Align With Upstream's `yue2-music` Skill (planned 2026-09-30)"
Cohesion: 0.14
Nodes (14): Engine: HeartMuLa (ships second), Engine picker UI decisions (2026-09-30, `feat/engine-picker-ui`), Engine: YuE2 (ships first), File-level plan, Framework decisions (2026-09-30, `feat/engine-framework`), General engine design (decided once, shared by every engine), heartmula-server decisions (2026-09-30), HeartMuLa spike results (2026-09-30) (+6 more)

### Community 232 - "fake_infer.py"
Cohesion: 0.22
Nodes (8): Data model, Decisions locked in (from discussion, 2026-07-04), FORGE — LoRA/LoKr Training & Dataset Studio (planning doc, not yet implemented), Open questions for `/opsx:explore` when this starts, Phased plan, What ACE-Step 1.5 already gives us (verified 2026-07-04, native REST — no Gradio), What ace-step-ui-main's training UI is worth borrowing (checked 2026-07-04), Why this exists, and why it's separate

### Community 233 - "README.md"
Cohesion: 0.14
Nodes (13): 1. WSL2 + Ubuntu 24.04, 2. The venv (inside WSL), 3. `yue2 doctor` and the weights, 4. Start the server, 5. Covers: SheetSage2 (optional), API, Config (env vars, all optional), If Ubuntu's first-run user setup hangs (+5 more)

### Community 234 - "Path"
Cohesion: 0.22
Nodes (8): API, Config (env vars), GPU: one model at a time (read this), heartmula-server, Run, Setup (native Windows), Tests, WSL2 fallback

### Community 235 - "Engine"
Cohesion: 0.67
Nodes (5): RecentSong, describeEdit(), fmtAgo(), lastAction(), parseDbTime()

### Community 236 - "FastAPI"
Cohesion: 0.17
Nodes (14): attempt(), errorText(), api, readDuration(), generatedWithLabel(), taskToGenType(), MoveToEditorAction(), fmtDuration() (+6 more)

### Community 237 - "Settings"
Cohesion: 0.22
Nodes (8): Context bloat (`context-budget.mjs`, run from E:\repos\Mulakai), Does the core promise work end to end today?, Process audit — Mulakai (2026-10-03), Process findings, Recommendation, Redesign (PLAN.md "UI Redesign", planned 2026-10-03), Rituals that cost more than they return (ask the user which to retire; Q-010 / D-004), Score-agent specific findings

### Community 239 - "Exception"
Cohesion: 0.25
Nodes (8): 4.1 API Definition, 4.2 Request Parameters, 4.3 Response Example, 4.4 Usage Examples (cURL), 4. Create Generation Task, Method A: JSON Request (application/json), Method B: File Upload (multipart/form-data), Parameter Naming Convention

### Community 240 - "JobStore"
Cohesion: 0.15
Nodes (12): Interaction specs, Later, M0 — The core-promise path, headless first, then in the dock, M1 — The riskiest remaining op, the warning, the regression net, M2 — Deterministic section ops, referents, revise, M3 — More songs, M4 — Seeing and reaching it, Not doing (+4 more)

### Community 241 - "Path"
Cohesion: 0.22
Nodes (8): Approach, Check commands (all must pass before a commit), Playbook — Mulakai, Quality bar (track: standard), Run & verify, Score agent: run & verify (M0), Stack, Voice & conventions

### Community 242 - "READ LYRICS With TRANSCRIBE for Uploads (planned 2026-10-01)"
Cohesion: 0.29
Nodes (6): Done-criteria, Orchestrator: Redesign B + C + D, shipped in stages, Round 1, Round 2, Round log, Task board

### Community 245 - "tsconfig.json"
Cohesion: 0.18
Nodes (11): offline, start, yue, cancel(), EngineCover, persistEngineSong(), pollEngine(), startEngineGeneration() (+3 more)

### Community 246 - "12. Health Check"
Cohesion: 0.52
Nodes (6): http(), log(), main(), SP-3 runner (run inside WSL, stdlib only): for each job body in jobs/, POST /v1/, render(), transcribe()

### Community 247 - "1. Authentication"
Cohesion: 0.17
Nodes (12): Cover Lyrics From the Recording (planned 2026-10-01), Cover lyrics spike results (2026-10-01), Decisions (proposed; the spike confirms or changes them), File-level plan, lyrics-server contract (PR 1, 2026-10-01), Mulakai server for READ LYRICS (PR 2, 2026-10-01), Open questions, READ LYRICS browser check (2026-10-01) (+4 more)

### Community 252 - "FastAPI"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 253 - "Path"
Cohesion: 0.18
Nodes (7): Core-promise path (existing app), Core-promise path (M0: score agent), Risks, SP-1 · VRAM hand-off (R-003, R-019), SP-2 · local planner quality (R-002), SP-3 · cot=full audible adherence (R-013, R-014, residue of R-010), Spikes to schedule (stage 3; all on this machine: RTX 4080 16 GB, Windows 11 + WSL2 Ubuntu-24.04, yue-server, ACE-Step with `ACESTEP_OFFLOAD_TO_CPU=true`)

### Community 255 - "Path"
Cohesion: 0.33
Nodes (6): 13. Environment Variables, Cache Configuration, LM Configuration, Model Configuration, Queue Configuration, Server Configuration

### Community 257 - "Upstream Sync: `complete`/`lego` Skip the LM (planned + implemented 2026-09-30)"
Cohesion: 0.18
Nodes (11): Client cover decisions (2026-10-01, `feat/yue-cover-ui`), Cover spike results (2026-09-30), Decisions, File-level plan, Mulakai server cover decisions (2026-10-01, `feat/yue-cover-server`), Open questions, Rollout, Upstream skill-doc review (2026-09-30) (+3 more)

### Community 258 - "UVR Separator: Roformer Vocals for SPLIT (planned + implemented 2026-09-30)"
Cohesion: 0.33
Nodes (5): Mulakai — UX & Visual Polish Notes, Proposed next passes (not yet done), The core loop today, Visual polish applied this pass (`index.css`), Workflow observations → improvements

### Community 260 - "backfillGenTask.test.ts"
Cohesion: 0.20
Nodes (9): gemma4_26b: 116 plans (6 infeasible cases skipped), gemma4_26b_freechords: 18 plans (0 infeasible cases skipped), gemma4_26b_nopattern: 18 plans (0 infeasible cases skipped), gemma4_26b_notes: 32 plans (4 infeasible cases skipped), qwen3_14b: 116 plans (6 infeasible cases skipped), qwen3_14b_freechords: 18 plans (0 infeasible cases skipped), qwen3_14b_nopattern: 18 plans (0 infeasible cases skipped), qwen3_14b_notes: 32 plans (4 infeasible cases skipped) (+1 more)

### Community 261 - "Path"
Cohesion: 0.40
Nodes (5): 5.1 API Definition, 5.2 Request Parameters, 5.3 Response Example, 5.4 Usage Example, 5. Batch Query Task Results

### Community 262 - "Runner"
Cohesion: 0.40
Nodes (5): 6.1 API Definition, 6.2 Request Parameters, 6.3 Response Example, 6.4 Usage Example, 6. Format Input

### Community 263 - "Path"
Cohesion: 0.40
Nodes (5): 7.1 API Definition, 7.2 Request Parameters, 7.3 Response Example, 7.4 Usage Example, 7. Get Random Sample

### Community 264 - "Path"
Cohesion: 0.40
Nodes (5): 9.1 API Definition, 9.2 Request Parameters, 9.3 Response Example, 9.4 Usage Examples, 9. Initialize or Switch Models

### Community 266 - "FastAPI"
Cohesion: 0.22
Nodes (8): Commands, Costly rules (digest of AGENTS.md), graphify, Invariants (score agent), Mulakai — Agent Instructions, Project Structure, Reference Projects (do not modify), Tech Stack

### Community 267 - "Settings"
Cohesion: 0.22
Nodes (9): Criterion (from risks.md SP-1, unchanged), Not covered / owed, Question, Re-run, Setup (exact), SP-1 · VRAM hand-off (R-003, R-019), Surprises, Verdict (+1 more)

### Community 268 - "FastAPI"
Cohesion: 0.40
Nodes (4): Notes, Now, Stages, Status — Mulakai

### Community 269 - "FastAPI"
Cohesion: 0.50
Nodes (3): Expanding the Oxlint configuration, React Compiler, React + TypeScript + Vite

### Community 270 - "Path"
Cohesion: 0.31
Nodes (6): bar_map(), build_schema(), op_schemas(), Doc, SP-2 spike: op schema, prompt builder, mini JSON-schema validator, Ollama client, user_prompt()

### Community 271 - "Split Health: Which Service, and Why It's Off (planned 2026-10-02)"
Cohesion: 0.40
Nodes (3): activeGeneration, generate, params

### Community 272 - "Exception"
Cohesion: 0.50
Nodes (4): 10.1 API Definition, 10.2 Response Example, 10.3 Usage Example, 10. Server Statistics

### Community 273 - "JobStore"
Cohesion: 0.50
Nodes (4): 11.1 API Definition, 11.2 Request Parameters, 11.3 Usage Example, 11. Download Audio Files

### Community 274 - "Settings"
Cohesion: 0.50
Nodes (4): 8.1 API Definition, 8.2 Response Example, 8.3 Usage Example, 8. List Available Models

### Community 275 - "voiceStore.test.ts"
Cohesion: 0.08
Nodes (35): Props, SongDetail, DockVerb, Editor(), Props, pickRange(), shownRange(), EditorTitleRow() (+27 more)

### Community 276 - "ACE-STEP COVER's Source Holds Still Too (planned 2026-10-02)"
Cohesion: 0.40
Nodes (3): cancelJob, queue, RUNNING

### Community 278 - "12. Health Check"
Cohesion: 0.50
Nodes (3): Keeping them current, Licence, Vendored ACE-Step 1.5 documentation

### Community 280 - "FastAPI"
Cohesion: 0.29
Nodes (6): Config (env vars), demucs-server, Endpoints, Run, Setup, Tests

### Community 281 - "Path"
Cohesion: 0.29
Nodes (6): Config (env vars), Endpoints, Run, Setup (native Windows), Tests, uvr-server

### Community 284 - "GenerateRequest"
Cohesion: 0.25
Nodes (8): Criterion (risks.md SP-3, unchanged), Limits, OWED: user listen (does the user hear the change in >= 4 of 5 pairs?), Question, SP-3 · cot=full audible adherence (R-013, R-014, residue of R-010), Surprises, Verdicts, What the real build should copy

### Community 285 - "Path"
Cohesion: 0.25
Nodes (8): Add Layer (lego) — Phase 6+7 Design (planned 2026-07-02), Architecture: client-side mixing, Architecture: layer stack UI, Architecture: server, Decisions, Feature gating (per the existing ACE-Step Integration table, now enforced), File-level plan, Settings

### Community 287 - "Abandoned Splits Leave No Stems Behind (planned 2026-10-02)"
Cohesion: 0.25
Nodes (8): Browser check, PR 2 (2026-10-02), Browser check, PR 3 (2026-10-02), Decisions, Editor Word Timestamps: Click a Lyric Line (planned 2026-10-02), File-level plan, Open questions, Timing spike (2026-10-02), What is there today (checked 2026-10-02)

### Community 289 - "ReferenceAudioPicker.tsx"
Cohesion: 0.25
Nodes (8): Decisions, File-level plan, Limits the spikes set, Op set per milestone, Open questions, Score Agent (planned 2026-10-03), SCORE verb states, The plan → render hand-off

### Community 293 - "FastAPI"
Cohesion: 0.67
Nodes (3): LoKr Training, LoRA Training, Training API

### Community 296 - "Voice"
Cohesion: 0.14
Nodes (9): Voice, ReferenceAudioMeta(), referenceAudioValue(), daniel, song, daniel, VoiceList(), listVoices (+1 more)

### Community 297 - "Playwright Golden-Path E2E (planned 2026-10-02)"
Cohesion: 0.29
Nodes (6): 0003 · WRITE PHRASE takes notes with beats; code writes the ABC, Alternatives, Consequences, Context, Decision, Evidence (SP-2, 2026-10-03, real library scores, upstream validator)

### Community 302 - "api.py"
Cohesion: 0.48
Nodes (6): load(), norm(), pct(), q(), Aggregate results/<tag>.jsonl into per-template tables. Usage: python report.py, summarize()

### Community 305 - "Worker"
Cohesion: 0.29
Nodes (7): (a) Drift (R-014), (b) Chord adherence on reharmonized bars (cot=full, `b`) vs the control (`bm`, cot=melody), (c) Tempo (variant `c`, `Q:` +15%), (d) Repeat (variant `d`) / section count, (e) `Ins` phrase (variant `e`), Evidence, Melody outside the edit (>= 0.9)

### Community 309 - "Create-Side Lookup Failures (planned 2026-10-02)"
Cohesion: 0.29
Nodes (7): 1. History row: prompt instead of timestamp, 2. Draggable/resizable waveform selection, 3. Standalone playhead timeline, 4. Delete a history entry, 5. Regenerate a history entry as an alternate, File-level plan, Repaint Editor UX Upgrade (planned 2026-07-02)

### Community 315 - "Idle Jobs Leave Every Registry (planned 2026-10-02)"
Cohesion: 0.33
Nodes (5): 0001 · Planner transport: OpenAI-compatible chat plus Ollama-native control, Alternatives, Consequences, Context, Decision

### Community 322 - "RefineResult"
Cohesion: 0.33
Nodes (5): 0002 · Score logic runs on yue-server, not in TypeScript, Alternatives, Consequences, Context, Decision

### Community 323 - "FakeAudio"
Cohesion: 0.33
Nodes (5): 0004 · Pending plans live in server memory, one per song, Alternatives, Consequences, Context, Decision

### Community 324 - "waveformPeaks.ts"
Cohesion: 0.10
Nodes (19): SplitStatus, ApiError, StemKind, StemResult, AudioPreview(), fmtTime(), Props, ArrangeMethod (+11 more)

### Community 326 - "A Failed Editor Job Blocks Nothing (planned 2026-10-01)"
Cohesion: 0.33
Nodes (6): Adapter Loading (LoRA/LoKr) at Inference (planned 2026-07-31), Decisions, File-level plan, Open questions, Rollout, Verified against ACE-Step source, 2026-07-31

### Community 327 - "Model Status Badge (planned 2026-10-02)"
Cohesion: 0.40
Nodes (5): Evidence, Step 4: negative control (planner left loaded, `keep_alive` 5 m, then YuE2), Step 5: CPU-only planner (feeds Q-012), Step 6: near-budget renders (planner not loaded), Steps 2-3: hand-off (planner on, unload, YuE2 immediately)

### Community 331 - "FastAPI"
Cohesion: 0.40
Nodes (5): ANALYZE AUDIO on COVER · YUE2 (planned 2026-10-01), Browser check (2026-10-01), Decisions, File-level plan, Open questions

### Community 332 - "Settings"
Cohesion: 0.40
Nodes (5): Architecture, Decisions, Export & Remaster — Phase 9 Design (planned 2026-07-06), Feature gating, File-level plan

### Community 337 - "Add Layer Lyrics (implemented 2026-07-08)"
Cohesion: 0.40
Nodes (5): Browser check (2026-10-01), Decisions, File-level plan, Open questions, YuE2 Covers: Pick the Score's Sections (planned 2026-10-01)

### Community 338 - "Add Layer Mixes Each Layer at Its Own Volume (planned 2026-10-02)"
Cohesion: 0.40
Nodes (5): Browser check (2026-10-02), COVER's Source Holds Still While a Job Reads It (planned 2026-10-02), Decisions, File-level plan, Open questions

### Community 339 - "An Unreachable ACE-Step Is a Failure, Not "No Models" (planned 2026-10-02)"
Cohesion: 0.40
Nodes (5): Browser check (2026-10-02), COVER's Engine Holds Still Too (planned 2026-10-02), Decisions, File-level plan, Open questions

### Community 340 - "ANALYZE AUDIO Takes the genLock (planned 2026-10-02)"
Cohesion: 0.40
Nodes (5): Browser check (2026-10-02), Decisions, File-level plan, Open questions, The Library Loads Without Trying to Play (planned 2026-10-02)

### Community 341 - "READ LYRICS With TRANSCRIBE for Uploads (planned 2026-10-01)"
Cohesion: 0.40
Nodes (5): CI (added 2026-10-02), Decisions, File-level plan, Open questions, Playwright Golden-Path E2E (planned 2026-10-02)

### Community 342 - "RE-EXTRACT Never Touches a Claimed Stem (planned 2026-10-02)"
Cohesion: 0.40
Nodes (5): Decisions, File-level plan, Open questions, Rollout, Style Tag Vocabulary for the Caption Field (planned 2026-07-31)

### Community 343 - "Editor Failures Say So (planned 2026-10-02)"
Cohesion: 0.40
Nodes (5): Decisions, File-level plan (one PR, `feat/yue2-default-engine`), Open questions, With the score agent (agentic editing, planned), YuE2 Is the Default First-Take Engine (planned 2026-10-03)

### Community 344 - "COVER Sends the Settings It Shows (planned 2026-10-02)"
Cohesion: 0.50
Nodes (3): Autopilot log, Run 2026-10-03 → M0, Run 2026-10-03 (resumed, same session, remote control on) → M0

### Community 345 - "The Newest Library Search Wins (planned 2026-10-02)"
Cohesion: 0.50
Nodes (4): A Dropped Generation Stops Polling (planned 2026-10-02), Browser check (2026-10-02), Decisions, File-level plan

### Community 346 - "Idle Jobs Leave Every Registry (planned 2026-10-02)"
Cohesion: 0.50
Nodes (4): A Preview Stopped Before It Starts Fails Quietly (planned 2026-10-02), Browser check (2026-10-02), Decisions, File-level plan

### Community 347 - "Lookup Failures Aren't Answers (planned 2026-10-02)"
Cohesion: 0.50
Nodes (4): Abandoned Splits Leave No Stems Behind (planned 2026-10-02), Browser check (2026-10-02), Decisions, File-level plan

### Community 348 - "Create-Side Lookup Failures (planned 2026-10-02)"
Cohesion: 0.50
Nodes (4): ACE-STEP COVER's Source Holds Still Too (planned 2026-10-02), Browser check (2026-10-02), Decisions, File-level plan

### Community 349 - "SPLIT Names Its Real Backend (planned 2026-10-02)"
Cohesion: 0.50
Nodes (4): Add Layer Lyrics (implemented 2026-07-08), Decisions, File-level plan, Model restriction (confirmed, no code change)

### Community 350 - "Split Health: Which Service, and Why It's Off (planned 2026-10-02)"
Cohesion: 0.50
Nodes (4): Add Layer Mixes Each Layer at Its Own Volume (planned 2026-10-02), Browser check (2026-10-02), Decisions, File-level plan

### Community 351 - "Voice List Failures (planned 2026-10-02)"
Cohesion: 0.50
Nodes (4): An Unreachable ACE-Step Is a Failure, Not "No Models" (planned 2026-10-02), Browser check (2026-10-02), Decisions, File-level plan

### Community 352 - "Shader Surfaces Give Their WebGL Context Back (planned 2026-10-02)"
Cohesion: 0.50
Nodes (4): ANALYZE AUDIO Takes the genLock (planned 2026-10-02), Browser check (2026-10-02), Decisions, File-level plan

### Community 353 - "Repaint Crossfade Is Clamped at Submit (planned 2026-10-02)"
Cohesion: 0.50
Nodes (4): Browser check (2026-10-01), Decisions, Files, READ LYRICS With TRANSCRIBE for Uploads (planned 2026-10-01)

### Community 354 - "Import a Song (planned 2026-07-30)"
Cohesion: 0.50
Nodes (4): Browser check (2026-10-02), Decisions, File-level plan, RE-EXTRACT Never Touches a Claimed Stem (planned 2026-10-02)

### Community 355 - "Output Format: Rate / Depth / Bitrate, Everywhere (planned + implemented 2026-07-31)"
Cohesion: 0.50
Nodes (4): Browser check (2026-10-02), Decisions, Editor Failures Say So (planned 2026-10-02), File-level plan

### Community 356 - "STEPS AUTO Resolves Per Model (planned 2026-07-31)"
Cohesion: 0.50
Nodes (4): Browser check (2026-10-02), COVER Sends the Settings It Shows (planned 2026-10-02), Decisions, File-level plan

### Community 357 - "Upstream Sync: `complete`/`lego` Skip the LM (planned + implemented 2026-09-30)"
Cohesion: 0.50
Nodes (4): Browser check (2026-10-02), Decisions, File-level plan, The Newest Library Search Wins (planned 2026-10-02)

### Community 358 - "UVR Separator: Roformer Vocals for SPLIT (planned + implemented 2026-09-30)"
Cohesion: 0.50
Nodes (4): Browser check (2026-10-02), Decisions, File-level plan, Idle Jobs Leave Every Registry (planned 2026-10-02)

### Community 360 - "A Failed Generation Blocks Nothing (planned 2026-10-01)"
Cohesion: 0.50
Nodes (4): Browser check (2026-10-02), Decisions, File-level plan, Lookup Failures Aren't Answers (planned 2026-10-02)

### Community 361 - "A Settled Split Blocks Nothing (planned 2026-10-01)"
Cohesion: 0.50
Nodes (4): Browser check (2026-10-02), Create-Side Lookup Failures (planned 2026-10-02), Decisions, File-level plan

### Community 363 - "Text2music Reference Audio: Style Influence Only (planned + implemented 2026-09-30)"
Cohesion: 0.50
Nodes (4): Browser check (2026-10-02), Decisions, File-level plan, SPLIT Names Its Real Backend (planned 2026-10-02)

### Community 364 - "YuE2: Align With Upstream's `yue2-music` Skill (planned 2026-09-30)"
Cohesion: 0.50
Nodes (4): Browser check (2026-10-02), Decisions, File-level plan, Split Health: Which Service, and Why It's Off (planned 2026-10-02)

### Community 366 - "The Model List Waits Out a Busy ACE-Step (planned 2026-10-02)"
Cohesion: 0.50
Nodes (4): Browser check (2026-10-02), Decisions, File-level plan, Voice List Failures (planned 2026-10-02)

### Community 367 - "Universal Advanced Settings (Repaint + Add Layer) (implemented 2026-07-08)"
Cohesion: 0.50
Nodes (4): Browser check (2026-10-02), Decisions, File-level plan, Shader Surfaces Give Their WebGL Context Back (planned 2026-10-02)

### Community 374 - "Repaint Crossfade Is Clamped at Submit (planned 2026-10-02)"
Cohesion: 0.50
Nodes (4): Browser check (2026-10-02), Decisions, File-level plan, Repaint Crossfade Is Clamped at Submit (planned 2026-10-02)

### Community 375 - "Import a Song (planned 2026-07-30)"
Cohesion: 0.50
Nodes (4): Decisions, File-level plan, Import a Song (planned 2026-07-30), Open questions

### Community 376 - "Output Format: Rate / Depth / Bitrate, Everywhere (planned + implemented 2026-07-31)"
Cohesion: 0.50
Nodes (4): Decisions, File-level plan, Open questions, Output Format: Rate / Depth / Bitrate, Everywhere (planned + implemented 2026-07-31)

### Community 377 - "STEPS AUTO Resolves Per Model (planned 2026-07-31)"
Cohesion: 0.50
Nodes (4): Decisions, File-level plan, Open questions, STEPS AUTO Resolves Per Model (planned 2026-07-31)

### Community 378 - "Upstream Sync: `complete`/`lego` Skip the LM (planned + implemented 2026-09-30)"
Cohesion: 0.50
Nodes (4): Decisions, File-level plan, Open questions, Upstream Sync: `complete`/`lego` Skip the LM (planned + implemented 2026-09-30)

### Community 379 - "UVR Separator: Roformer Vocals for SPLIT (planned + implemented 2026-09-30)"
Cohesion: 0.50
Nodes (4): Decisions, File-level plan (as built), Open questions, UVR Separator: Roformer Vocals for SPLIT (planned + implemented 2026-09-30)

### Community 380 - "Remove the HeartMuLa Engine (planned 2026-10-03)"
Cohesion: 0.50
Nodes (4): Existing HeartMuLa songs, File-level plan (one PR, `feat/remove-heartmula`), Open questions, Remove the HeartMuLa Engine (planned 2026-10-03)

### Community 382 - "A Failed Editor Job Blocks Nothing (planned 2026-10-01)"
Cohesion: 0.67
Nodes (3): A Failed Editor Job Blocks Nothing (planned 2026-10-01), Decisions, File-level plan

### Community 383 - "A Settled Split Blocks Nothing (planned 2026-10-01)"
Cohesion: 0.67
Nodes (3): A Settled Split Blocks Nothing (planned 2026-10-01), Decisions, File-level plan

### Community 384 - "COVER and ARRANGE Reference Audio: No Influence Sliders (planned + implemented 2026-09-30)"
Cohesion: 0.67
Nodes (3): COVER and ARRANGE Reference Audio: No Influence Sliders (planned + implemented 2026-09-30), Decisions, File-level plan

### Community 385 - "E2E Fails on Uncaught Page Errors (planned 2026-10-02)"
Cohesion: 0.67
Nodes (3): Decisions, E2E Fails on Uncaught Page Errors (planned 2026-10-02), File-level plan

### Community 386 - "The Model List Waits Out a Busy ACE-Step (planned 2026-10-02)"
Cohesion: 0.67
Nodes (3): Decisions, File-level plan, The Model List Waits Out a Busy ACE-Step (planned 2026-10-02)

### Community 387 - "Model Status Badge (planned 2026-10-02)"
Cohesion: 0.67
Nodes (3): Decisions, File-level plan, Model Status Badge (planned 2026-10-02)

### Community 388 - "Universal Advanced Settings (Repaint + Add Layer) (implemented 2026-07-08)"
Cohesion: 0.67
Nodes (3): Decisions, File-level plan, Universal Advanced Settings (Repaint + Add Layer) (implemented 2026-07-08)

### Community 401 - "test_hallucinations.py"
Cohesion: 0.52
Nodes (6): test_real_lyrics_are_kept_untouched(), test_segments_without_letters_go(), test_singable_phrases_go_only_at_the_end(), test_stock_subtitle_lines_go_wherever_they_are(), test_subtitle_cues_go_only_as_a_whole_segment(), texts()

### Community 402 - "YuePipeline"
Cohesion: 0.12
Nodes (7): Environment configuration for yue-server. Every knob is optional; the defaults, Adapter over the official YuE2 pipeline (`yue2-infer`, installed into this venv, Forwards to the pipeline's stage reporter and mirrors update() calls., Move weights to system RAM and hand the cached VRAM back., _StageTap, _tapped(), YuePipeline

### Community 403 - "engineGenJobs.test.ts"
Cohesion: 0.18
Nodes (7): EngineJobState, client, DONE, engine, fields, readMeta, RUNNING

### Community 404 - "abcMeta.ts"
Cohesion: 0.36
Nodes (9): headerFields(), MAJOR, METERS, MINOR, MODES, parseKey(), parseMeter(), parseTempo() (+1 more)

### Community 405 - "scoreStatus.test.ts"
Cohesion: 0.20
Nodes (5): CONTRACT, invalid, ok, Recorded, ScoreRead

### Community 406 - "yueScoreRead.ts"
Cohesion: 0.24
Nodes (8): num(), readScore(), ScoreReadFacts, CONTRACT, fixtures, Recorded, seen, Wire

### Community 409 - "api.py"
Cohesion: 0.13
Nodes (9): create_app(), HTTP layer, built around an injected transcriber so tests need no model. Speaks, faster-whisper with the settings PLAN.md's "Cover lyrics spike results" picked, _segment(), _t(), Whisper writes stock video-subtitle lines over instrumental stretches ("Thanks, _load_audio(), Reads the words sung in a song (PLAN.md "Cover Lyrics From the Recording"): fas (+1 more)

### Community 412 - "contextGuard.ts"
Cohesion: 0.67
Nodes (5): contextPostflight(), contextPreflight(), expectedPromptTokens(), minPromptTokens(), refusal()

### Community 417 - "1. Authentication"
Cohesion: 0.67
Nodes (3): 1. Authentication, Authentication Methods, Configuring API Key

## Knowledge Gaps
- **1312 isolated node(s):** `$schema`, `plugins`, `react/rules-of-hooks`, `react/only-export-components`, `name` (+1307 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **130 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `strip_chords()` connect `RE-EXTRACT Never Touches a Claimed Stem (planned 2026-10-02)` to `Add Layer (lego) — Phase 6+7 Design (planned 2026-07-02)`, `Client TSConfig (app)`, `Upstream Sync: `complete`/`lego` Skip the LM (planned + implemented 2026-09-30)`, `JobStore`, `Exception`, `Red Lines (Never Do)`, `backfillGenTask.test.ts`, `inferenceSteps.ts`, `apiStatusStore.ts`, `Adapter Loading (LoRA/LoKr) at Inference (planned 2026-07-31)`?**
  _High betweenness centrality (0.079) - this node is a cross-community bridge._
- **Why does `body()` connect `apiStatusStore.ts` to `MoveToEditorAction.tsx`, `FORGE — LoRA/LoKr Training & Dataset Studio (planning doc, not yet implemented)`, `lyricSections.ts`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **Why does `Stands in for run_mdx_headless / run_demucs_headless: records each call     and` connect `registry.test.ts` to `engines.test.ts`, `Add Layer (lego) — Phase 6+7 Design (planned 2026-07-02)`, `10. Server Statistics`, `ExportPanel.tsx`, `JobStore`, `backfillGenTask.test.ts`, `Settings Store`, `Client TSConfig Root`, `lyricSections.ts`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._
- **What connects `$schema`, `plugins`, `react/rules-of-hooks` to the rest of the system?**
  _1456 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Project Docs & Design Concepts` be split into smaller, more focused modules?**
  _Cohesion score 0.08333333333333333 - nodes in this community are weakly interconnected._
- **Should `Core Song/Layer/Version API` be split into smaller, more focused modules?**
  _Cohesion score 0.04828828828828829 - nodes in this community are weakly interconnected._
- **Should `Lyrics & Export Panel` be split into smaller, more focused modules?**
  _Cohesion score 0.1010752688172043 - nodes in this community are weakly interconnected._