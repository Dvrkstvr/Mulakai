# Graph Report - wt  (2026-10-02)

## Corpus Check
- 469 files · ~297,662 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 3071 nodes · 6490 edges · 327 communities (201 shown, 126 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 185 edges (avg confidence: 0.72)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `71437e6e`
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
- songLayers.ts
- Exception
- JobStore
- Settings
- App.tsx
- ACE-STEP COVER's Source Holds Still Too (planned 2026-10-02)
- RE-EXTRACT Never Touches a Claimed Stem (planned 2026-10-02)
- 12. Health Check
- registry.ts
- FastAPI
- Path
- GenerateRequest
- Path
- abcMeta.ts
- Path
- test_api.py
- Abandoned Splits Leave No Stems Behind (planned 2026-10-02)
- engineGenJobs.test.ts
- versionsTimings.test.ts
- ReferenceAudioPicker.tsx
- stemSplit.evict.test.ts
- FastAPI
- Path
- FastAPI
- Worker
- E2E Fails on Uncaught Page Errors (planned 2026-10-02)
- Path
- FastAPI
- 1. Authentication
- engineGenJobs.ts
- 4. Create Generation Task
- Runner
- FastAPI
- Path
- Output Format: Rate / Depth / Bitrate, Everywhere (planned + implemented 2026-07-31)
- STEPS AUTO Resolves Per Model (planned 2026-07-31)
- Upstream Sync: `complete`/`lego` Skip the LM (planned + implemented 2026-09-30)
- UVR Separator: Roformer Vocals for SPLIT (planned + implemented 2026-09-30)
- api.py
- transcribe_routes.py
- A Failed Editor Job Blocks Nothing (planned 2026-10-01)
- 6. Format Input
- Idle Jobs Leave Every Registry (planned 2026-10-02)
- jobRegistry.evict.test.ts
- A Failed Generation Blocks Nothing (planned 2026-10-01)
- A Settled Split Blocks Nothing (planned 2026-10-01)
- COVER and ARRANGE Reference Audio: No Influence Sliders (planned + implemented 2026-09-30)
- Text2music Reference Audio: Style Influence Only (planned + implemented 2026-09-30)
- E2E Fails on Uncaught Page Errors (planned 2026-10-02)
- Universal Advanced Settings (Repaint + Add Layer) (implemented 2026-07-08)
- api.py
- splitHealth.test.ts

## God Nodes (most connected - your core abstractions)
1. `Mulakai — Project Plan` - 73 edges
2. `api` - 45 edges
3. `useCreateDraftStore` - 40 edges
4. `useSettings` - 37 edges
5. `releaseGenLock()` - 35 edges
6. `config` - 34 edges
7. `acquireGenLock()` - 32 edges
8. `useGenerationStore` - 29 edges
9. `AddLayerTrigger()` - 26 edges
10. `Song` - 26 edges

## Surprising Connections (you probably didn't know these)
- `AddLayerTrigger()` --indirect_call--> `lyrics()`  [INFERRED]
  client/src/AddLayerTrigger.tsx → heartmula-server/tests/conftest.py
- `test_a_chordless_plan_is_generated_with_cot_melody()` --references--> `NATIVE`  [EXTRACTED]
  yue-server/tests/test_instrumental.py → client/src/abcFacts.test.ts
- `startVersionTimings()` --indirect_call--> `reading()`  [INFERRED]
  server/src/services/timingsJobs.ts → client/src/lyricAlign.test.ts
- `useAnalyzeSourceAudio()` --indirect_call--> `result()`  [INFERRED]
  client/src/useAnalyzeSourceAudio.ts → server/src/services/lyricTimestamps.test.ts
- `Clock` --uses--> `JobFiles`  [INFERRED]
  uvr-server/tests/test_job_files.py → demucs-server/job_files.py

## Import Cycles
- None detected.

## Communities (327 total, 126 thin omitted)

### Community 0 - "Backend Generation & Job Services"
Cohesion: 0.15
Nodes (24): adaptersRouter, message(), syncWarning(), loadLora(), loraStatus, setLoraScale(), toggleLora(), unloadLora() (+16 more)

### Community 1 - "Editor UI Components"
Cohesion: 0.20
Nodes (13): Props, RefineRail(), SongFields, AUTO_OPTION, KNOWN_TIME_SIGNATURES, KNOWN_VOCAL_LANGUAGES, TIME_SIGNATURES, timeSignatureLabel() (+5 more)

### Community 2 - "App Shell & Library UI"
Cohesion: 0.20
Nodes (11): PlaybackApi, fmt(), Player(), Props, PlayerFooter(), Props, COLORS, PlayerWaveform() (+3 more)

### Community 3 - "Project Docs & Design Concepts"
Cohesion: 0.10
Nodes (12): offline, start, yue, acestepHealth, engineHealth, transcriptionHealth, SongEngine, TranscriptionState (+4 more)

### Community 4 - "Core Song/Layer/Version API"
Cohesion: 0.08
Nodes (38): config, __dirname, db, layersRouter, outputMetadataRouter, ALLOWED_EXTS, songImportRouter, upload (+30 more)

### Community 5 - "Lyrics & Export Panel"
Cohesion: 0.20
Nodes (14): StemResult, AddLayerJob, EditorJob, JobBase, RegenerateJob, RemasterJob, RepaintJob, RetakeJob (+6 more)

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
Cohesion: 0.08
Nodes (25): app, sweepTemp(), enginesRouter, foldersRouter, generateStatusRouter, remasterRouter, upload, songLayersRouter (+17 more)

### Community 10 - "Playback Mix Engine"
Cohesion: 0.08
Nodes (49): STEM_KINDS, upload, queryResult(), AudioFormat, BitDepth, clampDepth(), DEFAULT_OUTPUT, DEPTHS_BY_FORMAT (+41 more)

### Community 11 - "Client TSConfig (app)"
Cohesion: 0.08
Nodes (31): Any, create_app(), HTTP layer, built around an injected transcriber so tests need no model. Speaks, dominant_language(), make_transcriber(), faster-whisper with the settings PLAN.md's "Cover lyrics spike results" picked, The language most sung words are in: each 30 s window holding words votes its de, The model is loaded per job and freed afterwards, handing its VRAM back     to (+23 more)

### Community 12 - "Advanced Generation Settings"
Cohesion: 0.22
Nodes (35): versionsRouter, releaseTask(), startAddLayer(), startCompleteGeneration(), startCoverGeneration(), TranscriptionFacts, acquireGenLock(), releaseGenLock() (+27 more)

### Community 13 - "AI Thinking & Create View"
Cohesion: 0.13
Nodes (22): main(), generateHelpersRouter, lyricTagsRouter, health(), createRandomSample(), createSampleFromQuery(), extractTags(), FreshTagEntry (+14 more)

### Community 14 - "Song Detail & Refine Rail"
Cohesion: 0.10
Nodes (41): ScoreSize, fitLyricsToSections(), hasWords(), scoreSections(), sectionOutline(), SCORE, UNSUNG, wordBlocks() (+33 more)

### Community 15 - "Client TSConfig (node)"
Cohesion: 0.11
Nodes (21): ActiveGeneration, ApiStatusState, useApiStatusStore, taskToGenType(), SingleEditorJob, adoptLock(), LOCK_NAME, repaint (+13 more)

### Community 16 - "Add-Layer & Mix Bounce"
Cohesion: 0.13
Nodes (27): asTagList(), CAP, captionToStyleTags(), Found, headKind(), Kind, modifiersBefore(), NOT_STYLE (+19 more)

### Community 17 - "Settings Store"
Cohesion: 0.13
Nodes (6): Adapter over the official YuE2 pipeline (`yue2-infer`, installed into this venv, Forwards to the pipeline's stage reporter and mirrors update() calls., Move weights to system RAM and hand the cached VRAM back., _StageTap, _tapped(), YuePipeline

### Community 18 - "Server TSConfig"
Cohesion: 0.12
Nodes (10): IdempotencyConflict, JobStore, QueueFull, In-memory job table and FIFO queue for yue-server.  The job record mirrors YuE, Drop finished jobs (and their artifacts) older than the retention window., Delete artifact directories left by a previous run (jobs are not persisted)., Returns (job, created). A repeated Idempotency-Key with the same body         r, None for an unknown id, or one of another kind when `kind` is given. (+2 more)

### Community 19 - "Icon Sprite Assets"
Cohesion: 0.48
Nodes (7): Bluesky Icon (butterfly logo, social link), Discord Icon (game controller/mask logo, social link), Documentation Icon (book with folded corner, docs link), GitHub Icon (Octocat cat logo, source-code link), Social Icon (person silhouette with star badge, community link), icons.svg Sprite Sheet, X (Twitter) Icon (stylized X logo, social link)

### Community 20 - "Core Domain Entities (Plan)"
Cohesion: 0.06
Nodes (31): ACE-Step Integration (verified against docs/en/API.md + INFERENCE.md, 2026-07-02), Add Layer: Forced batch_size 1 + Track-Type Picker (implemented 2026-07-10), Architecture, Architecture, Create AUDIO/ARRANGE Flows — `cover` and `complete` (implemented 2026-07-07), Create Draft Persistence + Origin-Aware Reuse (planned 2026-07-30), Custom Player Controls (planned 2026-07-02, then implemented), Decisions (+23 more)

### Community 21 - "Tech Stack & Structure Docs"
Cohesion: 0.07
Nodes (33): coversApi, editorApi, EngineControl, generationApi, ApiError, appendParams(), json(), libraryApi (+25 more)

### Community 22 - "Client Lint Config"
Cohesion: 0.21
Nodes (24): AddLayerDraft, useAddLayerDraft, AddLayerTrigger(), Editor(), isEditorBusy(), myEditorJob(), errMsg(), runSingleJob() (+16 more)

### Community 23 - "Demucs Stem-Split Server"
Cohesion: 0.35
Nodes (8): AudioPreview(), fmtTime(), Props, AudioPreviewPopover(), Props, PreviewPlayback, PreviewSnapshot, usePreviewState()

### Community 24 - "FileTags Test Suite"
Cohesion: 0.33
Nodes (5): createFromPath, fakeFile, fakeId3Tag, fakeTag, idSettings

### Community 25 - "Player & Mix Polish (Plan)"
Cohesion: 0.24
Nodes (9): attempt(), errorText(), TaskType, Dropzone(), Props, lookupRunner(), fmtDuration(), SongDetailRail() (+1 more)

### Community 28 - "Client TSConfig Root"
Cohesion: 0.18
Nodes (17): A SheetSage2 snapshot whose infer.py is tests/fake_infer.py., sheetsage(), test_a_failed_render_still_returns_the_score(), test_a_replayed_key_returns_the_same_transcription(), test_a_supplied_score_is_checked_and_stripped_for_melody(), test_a_transcription_serves_its_score_preview_and_facts(), test_an_instrumental_cover_moves_the_supplied_melody_to_ins(), test_cancel_kills_a_running_transcription() (+9 more)

### Community 32 - "Jobs Service Test Suite"
Cohesion: 0.11
Nodes (26): call(), fetchWithTimeout(), initModel(), analyzeAudio(), formatInput(), audioFileExt(), downloadAudio(), lyricTimestamp() (+18 more)

### Community 39 - "Human-Centered Design Philosophy"
Cohesion: 0.07
Nodes (26): author, dependencies, better-sqlite3, express, multer, node-taglib-sharp, description, devDependencies (+18 more)

### Community 47 - "Git Workflow Rules"
Cohesion: 0.10
Nodes (19): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+11 more)

### Community 48 - "Red Lines (Never Do)"
Cohesion: 0.28
Nodes (16): FakeEngine, Stands in for HeartMulaEngine: no torch, no GPU. `gate` lets a test hold     a, make_client(), test_a_value_naming_a_file_is_refused(), test_bearer_key_is_enforced_only_when_set(), test_cancel_while_running(), test_failures_carry_a_code_and_message(), test_happy_path_returns_a_flac_within_full_scale() (+8 more)

### Community 49 - "SettingsPanel.tsx"
Cohesion: 0.14
Nodes (30): EngineId, EngineInfo, api, coverSourceKey(), coverSourceReady(), resolveCoverSource(), Props, EngineSettingsState (+22 more)

### Community 50 - "Claude Commands"
Cohesion: 0.08
Nodes (24): dependencies, framer-motion, react, react-dom, zustand, devDependencies, oxlint, @types/node (+16 more)

### Community 58 - "FORGE — LoRA/LoKr Training & Dataset Studio (planning doc, not yet implemented)"
Cohesion: 0.21
Nodes (9): RefineResult, AnalyzeState, fillable(), IDLE, EMPTY, R, YueAnalysis, yueAnalysisPatch() (+1 more)

### Community 59 - "4. Create Generation Task"
Cohesion: 0.15
Nodes (12): Configuration, Design, Development, Licence, Mulakai, Repository layout, Requirements, Running it (+4 more)

### Community 60 - "lyricSections.ts"
Cohesion: 0.07
Nodes (27): 10. Abort/persist race reverses an abort silently, 11. ~~Job registries never evict~~ — fixed, PRs #96 + #104, 12. WebGL context leak in `ShaderCanvas`, 13. ~~`generationStore.pollJob` has no cancellation~~ — fixed, PRs #104 + #106, 14. Misc leaks, 15. UX inconsistencies, 16. Shader palette violation, 17. Server-side polish (+19 more)

### Community 61 - "CreateView.tsx"
Cohesion: 0.26
Nodes (16): GeneratingCard(), Props, STAGE_LABEL, EDITOR_STAGE_LABEL, EditorJobKind, ENGINE_STAGES, fmtElapsed(), fmtProgress() (+8 more)

### Community 62 - "demucs-server"
Cohesion: 0.16
Nodes (10): drop_kv_caches(), HeartMulaEngine, park(), _raise_if(), HeartMuLa behind the worker's Engine interface, with RAM parking.  Both models, torchtune 0.4's setup_cache skips any layer whose cache already exists,     so, test_drop_kv_caches_leaves_cacheless_modules_alone(), test_vram_cap_defaults_to_card_total_minus_2_gib() (+2 more)

### Community 63 - "13. Environment Variables"
Cohesion: 0.14
Nodes (18): JobCancelled, Raised inside a job when its cancel flag is seen., lyrics(), Attn, Backbone, FakeCodec, FakeLM, FakePipe (+10 more)

### Community 64 - "Mulakai — UX & Visual Polish Notes"
Cohesion: 0.22
Nodes (13): Version, activeLayers(), AudibleTake, audibleTakes(), layer(), version(), volumes(), DecodedLayer (+5 more)

### Community 65 - "FakeAudio"
Cohesion: 0.06
Nodes (66): AdvancedGenSettings(), INFER_METHOD_OPTIONS, CustomSelect(), Props, COT_OPTIONS, EngineGenSettings(), SLIDERS, ForgeSection() (+58 more)

### Community 66 - "lyricTags.ts"
Cohesion: 0.40
Nodes (4): INLINE_TAGS, LYRIC_TAGS, LyricTag, SECTION_TAGS

### Community 67 - "5. Batch Query Task Results"
Cohesion: 0.23
Nodes (4): JobFiles, The on-disk side of /split: each split gets a job dir under data_dir, and its s, Make the stems downloadable; returns kind -> path under /audio., _remove()

### Community 68 - "6. Format Input"
Cohesion: 0.09
Nodes (21): Acid — "what makes something happen?" (commit actions), AI states — the one exception to "one hue, one job", App model — a flat set of top-level views, one page, Audio preview module (added 2026-07-29), Carbon — "the world" (structure), Color tokens, Copy rules, Design language in one sentence (+13 more)

### Community 69 - "7. Get Random Sample"
Cohesion: 0.17
Nodes (8): _flag(), Environment configuration for yue-server. Every knob is optional; the defaults, Settings, Clock, test_idempotency_keys_expire_with_their_job(), test_settings_defaults_match_the_spike(), test_settings_read_the_environment(), test_sweep_drops_expired_jobs_and_their_artifacts()

### Community 70 - "9. Initialize or Switch Models"
Cohesion: 0.15
Nodes (14): lyricsRouter, receiveSource(), upload, LyricSegment, lyricsHealth(), LyricsReading, LyricWord, num() (+6 more)

### Community 71 - "genLock.ts"
Cohesion: 0.19
Nodes (9): bar_seconds(), Each score section's start in seconds, for placing read lyrics by time (PLAN.md, (label, 0-based first bar) for each `% label` comment, in score order., One bar on the score's tempo grid, for sections past the last downbeat., [{label, bar, seconds}] per section, or None when there is nothing to anchor it, section_bars(), section_starts(), test_a_section_past_the_last_downbeat_is_extrapolated_on_the_tempo_grid() (+1 more)

### Community 72 - "React + TypeScript + Vite"
Cohesion: 0.09
Nodes (31): Folder, FolderScope, Song, App(), View, CreateBar(), Props, createCoverDraft() (+23 more)

### Community 73 - "10. Server Statistics"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 74 - "11. Download Audio Files"
Cohesion: 0.13
Nodes (11): FakePipeline, test_the_job_saves_the_converted_score_the_planned_one_and_the_record(), test_classify(), OutOfMemoryError, Stands in for torch.OutOfMemoryError, which the worker matches by name., test_cancel_queued_job_never_reaches_the_pipeline(), test_cancel_while_running_parks_before_reporting(), test_failures_carry_a_code_and_still_park() (+3 more)

### Community 75 - "8. List Available Models"
Cohesion: 0.13
Nodes (11): coverReady, engines, fetchTranscriptionPreview, jobs, measureScore, noCover, startEngineGeneration, startTranscription (+3 more)

### Community 77 - "1. Authentication"
Cohesion: 0.23
Nodes (12): Transcription, barSeconds(), CoverScoreLike, lineTime(), placeReading(), sectionAt(), sectionBarCounts(), sectionTimes (+4 more)

### Community 78 - "Training API"
Cohesion: 0.15
Nodes (6): playOrStayPaused(), STAYS_PAUSED, openTrack(), TrackAudio, TrackEvents, useSingleAudioPlayback()

### Community 133 - "Waveform.tsx"
Cohesion: 0.11
Nodes (8): The header (everything before the first `% name` line) and each section's     b, split_sections(), test_happy_path_serves_flac_score_and_result(), test_idempotency_key_replays_the_original_job(), test_truncated_job_keeps_its_audio(), POST /v1/scores/measure and the section split behind it (PLAN.md, "YuE2 Covers:, test_a_score_without_sections_is_all_header(), test_split_sections_keeps_every_byte_in_order()

### Community 134 - "settings.ts"
Cohesion: 0.29
Nodes (9): fit_to_ceiling(), Write the engine's float audio as a lossless FLAC master.  HeartMuLa's float p, Return (audio, gain_db). Only ever turns down, never up., write_flac(), test_audio_within_the_ceiling_is_untouched(), test_non_finite_samples_are_rejected(), test_over_full_scale_is_turned_down_to_the_ceiling(), test_write_flac_is_24_bit_stereo_without_clipping() (+1 more)

### Community 135 - "Add Layer (lego) — Phase 6+7 Design (planned 2026-07-02)"
Cohesion: 0.17
Nodes (18): arrange(), is_instrumental(), Upstream's instrumental workflow (PLAN.md "YuE2: Align With Upstream's `yue2-mu, Upstream's rule: lyrics that are only section tags. Empty lyrics don't     coun, `% pre-chorus` → `[Pre-Chorus]`, as upstream's `lyric_tags` writes them., Returns (plan, request, record) to generate from. record is None when the     r, section_tags(), noop() (+10 more)

### Community 136 - "Repaint Editor UX Upgrade (planned 2026-07-02)"
Cohesion: 0.15
Nodes (15): SplitHealth, Lookup, listModels, listVoices, run(), splitHealth, splitBackendTitle(), splitServiceLabel() (+7 more)

### Community 137 - "Export & Remaster — Phase 9 Design (planned 2026-07-06)"
Cohesion: 0.17
Nodes (10): downbeat.lab's first column; empty when the file is missing or unreadable., read_downbeats(), test_read_downbeats_tolerates_missing_and_broken_files(), _collect(), _kill(), SheetSage2 transcription, the second job kind (PLAN.md, "yue-server transcripti, Transcribe into `out`; returns the result facts plus `preview` (bool)., _read() (+2 more)

### Community 138 - "AIGeneratingBackground.tsx"
Cohesion: 0.08
Nodes (12): reading(), PlaybackEngine, contexts, ctxNow(), durations, Engine, FakeContext, FakeSource (+4 more)

### Community 139 - "Add Layer Lyrics (implemented 2026-07-08)"
Cohesion: 0.21
Nodes (9): readDuration(), MoveToEditorAction(), Nav, NavigationContext, useNavigation(), ImportDraft, importFields(), EMPTY (+1 more)

### Community 140 - "Universal Advanced Settings (Repaint + Add Layer) (implemented 2026-07-08)"
Cohesion: 0.12
Nodes (25): AutoReadFacts, shouldAutoRead(), base, MEANING, aceCoverLocks(), CoverScore, CoverSourceState, engineLockedBy() (+17 more)

### Community 141 - "Create AUDIO/ARRANGE Flows — `cover` and `complete` (implemented 2026-07-07)"
Cohesion: 0.37
Nodes (9): ActiveAdapterNote(), AdapterAddForm(), AdaptersSection(), AdapterStrength(), activeAdapter(), adapterConsequence(), AdapterState, useAdapterStore (+1 more)

### Community 142 - "backfillGenTask.test.ts"
Cohesion: 0.40
Nodes (5): 7.1 API Definition, 7.2 Request Parameters, 7.3 Response Example, 7.4 Usage Example, 7. Get Random Sample

### Community 143 - "api.ts"
Cohesion: 0.06
Nodes (41): _load_audio(), Reads the words sung in a song (PLAN.md "Cover Lyrics From the Recording"): fas, client_for(), post(), seg(), test_failed_job_is_a_500_and_removes_the_upload(), test_hallucinated_segments_are_dropped(), test_health_names_the_model_without_running_a_job() (+33 more)

### Community 145 - "Create Draft Persistence + Origin-Aware Reuse (planned 2026-07-30)"
Cohesion: 0.38
Nodes (3): createPeaksLoader(), loader, PeaksDecoder

### Community 146 - "FakeAudio"
Cohesion: 0.14
Nodes (19): generateRouter, generateAudioRouter, BOOLEAN_FIELDS, GEN_FIELDS, labelOnlyReferenceMeta(), NUMERIC_FIELDS, pickMultipartParams(), pickParams() (+11 more)

### Community 147 - "devDependencies"
Cohesion: 0.17
Nodes (11): devDependencies, @playwright/test, tsx, @types/node, typescript, name, private, scripts (+3 more)

### Community 148 - "MoveToEditorAction.tsx"
Cohesion: 0.10
Nodes (31): EngineCapabilities, CreatePromptTab(), aceOnlyNote(), coverEngines(), coverUnavailableReason(), durationReadout(), Engine, GatedField (+23 more)

### Community 149 - "AdaptersSection.tsx"
Cohesion: 0.27
Nodes (5): make(), createPreviewPlayback(), PreviewAudioElement, make(), useMainTransportGuard()

### Community 150 - "SettingsView.tsx"
Cohesion: 0.14
Nodes (14): Engine: HeartMuLa (ships second), Engine picker UI decisions (2026-09-30, `feat/engine-picker-ui`), Engine: YuE2 (ships first), File-level plan, Framework decisions (2026-09-30, `feat/engine-framework`), General engine design (decided once, shared by every engine), heartmula-server decisions (2026-09-30), HeartMuLa spike results (2026-09-30) (+6 more)

### Community 151 - "Waveform.tsx"
Cohesion: 0.11
Nodes (32): AnalyzeAudioButton(), Props, AutoTextarea(), Props, CarriedPromptNote(), ClearDraftButton(), CoverSourcePicker(), CreateArrangeTab() (+24 more)

### Community 152 - "generationStore.ts"
Cohesion: 0.14
Nodes (8): IdempotencyConflict, JobStore, QueueFull, In-memory job table and FIFO queue.  Snapshots mirror YuE2-Turbo's yue2-serve, Forget finished jobs older than the cutoff; returns their ids., Returns (snapshot, created). A repeated key with the same request is a, Block for the next queued job, mark it running, return (id, request)., Record the outcome. A cancel that arrived mid-job wins; returns the final status

### Community 153 - "adapters.test.ts"
Cohesion: 0.17
Nodes (12): ForgeStub(), Props, HeaderSlotContext, useHeaderSlot(), daysLeft(), fmtBytes(), LibraryMaintenanceSection(), LyricTagGuideSection() (+4 more)

### Community 154 - "inferenceSteps.ts"
Cohesion: 0.21
Nodes (8): Clock, finished_job(), setup(), test_each_stem_is_served_once_then_deleted(), test_last_download_removes_the_job_dir(), test_only_published_stems_are_served(), test_publish_maps_kinds_to_paths_under_the_job(), test_sweep_removes_unfetched_jobs_once_expired()

### Community 155 - "adapterStore.test.ts"
Cohesion: 0.23
Nodes (4): JobFiles, The on-disk side of /split: each split gets a job dir under data_dir, and its s, Make the stems downloadable; returns kind -> path under /audio., _remove()

### Community 156 - "apiStatusStore.ts"
Cohesion: 0.25
Nodes (5): callOrder, initModel, queryResult, reconcileAdapter, releaseTask

### Community 157 - "lyricSections.ts"
Cohesion: 0.20
Nodes (9): AGENTS.md — Mulakai Development Rules, Code Style, Design System (mandatory for all UI work), Git Workflow, Module Size Policy, Red Lines, Scope Discipline, Spec-Driven Development (+1 more)

### Community 158 - "compilerOptions"
Cohesion: 0.20
Nodes (9): compilerOptions, module, moduleResolution, noEmit, skipLibCheck, strict, target, types (+1 more)

### Community 159 - "Adapter Loading (LoRA/LoKr) at Inference (planned 2026-07-31)"
Cohesion: 0.21
Nodes (8): Clock, finished_job(), setup(), test_each_stem_is_served_once_then_deleted(), test_last_download_removes_the_job_dir(), test_only_published_stems_are_served(), test_publish_maps_kinds_to_paths_under_the_job(), test_sweep_removes_unfetched_jobs_once_expired()

### Community 160 - "adapters.test.ts"
Cohesion: 0.29
Nodes (4): loadLora, loraStatus, setLoraScale, unloadLora

### Community 161 - "SectionStrip.tsx"
Cohesion: 0.14
Nodes (13): 1. WSL2 + Ubuntu 24.04, 2. The venv (inside WSL), 3. `yue2 doctor` and the weights, 4. Start the server, 5. Covers: SheetSage2 (optional), API, Config (env vars, all optional), If Ubuntu's first-run user setup hangs (+5 more)

### Community 162 - "Style Tag Vocabulary for the Caption Field (planned 2026-07-31)"
Cohesion: 0.29
Nodes (3): jobStatus, lyricsHealth, readTimings

### Community 163 - "Output Format: Rate / Depth / Bitrate, Everywhere (planned + implemented 2026-07-31)"
Cohesion: 0.24
Nodes (23): cancel(), EngineTarget, errorMessage(), failure(), fetchAudio(), fetchScore(), headers(), health() (+15 more)

### Community 164 - "STEPS AUTO Resolves Per Model (planned 2026-07-31)"
Cohesion: 0.18
Nodes (5): Engine, Generated, What the job worker needs from an engine. Torch-free, so the API, the queue and, InterruptedError, Protocol

### Community 168 - "adapterStore.test.ts"
Cohesion: 0.16
Nodes (11): ('ready' | 'not_configured' | 'missing_files', detail)., Transcriber, create_app(), main(), Thin HTTP wrapper around the official YuE2 pipeline (https://github.com/multimo, add_score_routes(), POST /v1/scores/measure: a cover's score in the planner's tokens, per section,, add_transcription_routes() (+3 more)

### Community 169 - "waveformPeaks.ts"
Cohesion: 0.17
Nodes (12): Cover Lyrics From the Recording (planned 2026-10-01), Cover lyrics spike results (2026-10-01), Decisions (proposed; the spike confirms or changes them), File-level plan, lyrics-server contract (PR 1, 2026-10-01), Mulakai server for READ LYRICS (PR 2, 2026-10-01), Open questions, READ LYRICS browser check (2026-10-01) (+4 more)

### Community 171 - "ExportPanel.tsx"
Cohesion: 0.18
Nodes (11): Client cover decisions (2026-10-01, `feat/yue-cover-ui`), Cover spike results (2026-09-30), Decisions, File-level plan, Mulakai server cover decisions (2026-10-01, `feat/yue-cover-server`), Open questions, Rollout, Upstream skill-doc review (2026-09-30) (+3 more)

### Community 173 - "JobStore"
Cohesion: 0.15
Nodes (12): compilerOptions, esModuleInterop, module, moduleResolution, outDir, rootDir, skipLibCheck, strict (+4 more)

### Community 174 - "Exception"
Cohesion: 0.33
Nodes (6): SongDetail, ExportPanel(), Props, songReloader(), song, useSongDetail()

### Community 176 - ".publish"
Cohesion: 0.22
Nodes (8): Commands, Design System, graphify, Mulakai — Agent Instructions, Project Structure, Reference Projects (do not modify), Spec-Driven Development, Tech Stack

### Community 177 - "stemSplit.reextract.test.ts"
Cohesion: 0.29
Nodes (3): idle(), settledSplit(), StemKind

### Community 178 - "JobCancelled"
Cohesion: 0.29
Nodes (6): 2. Response Format, 3. Task Status Description, ACE-Step API Client Documentation, Best Practices, Error Handling, Table of Contents

### Community 179 - "Multiple Song-Creation Engines (planned 2026-09-30)"
Cohesion: 0.15
Nodes (13): DATA_ROOT, PORTS, test, activeVersion(), downloadBytes(), dragRegion(), FakeTask, fakeTasks() (+5 more)

### Community 180 - "heartmula.ts"
Cohesion: 0.09
Nodes (32): fmt(), Props, lineRegion(), round2(), sameRegion(), SPANS, widenToMinimum(), LineSpan (+24 more)

### Community 181 - ".submit"
Cohesion: 0.36
Nodes (7): mix_into(), output_path(), Where uvr-headless-runner writes a stem: `{base}_({Stem}).wav`., Add `extra` into `target` in place, keeping float32 WAV., Separate `src` into Mulakai's four StemKinds, as float32 WAVs under `out_dir`., _require(), run_chain()

### Community 182 - "main.py"
Cohesion: 0.21
Nodes (14): DURATION_SEC, FakeTask, MODELS, ok(), PENDING_MS, PORT, queryRow(), readBody() (+6 more)

### Community 183 - "yue-server"
Cohesion: 0.44
Nodes (7): abcFacts, barsOf(), header(), keyOf(), MODES, tempoOf(), NATIVE

### Community 185 - "Mulakai"
Cohesion: 0.20
Nodes (7): cancelSplit, jobStatus, repaint, repaintParams, settled, splitStatus, startSplit

### Community 186 - "SongEngine"
Cohesion: 0.29
Nodes (7): OutputMetadataSection(), create(), loadLora, patch(), post(), setLoraScale, unloadLora

### Community 187 - "run_job"
Cohesion: 0.20
Nodes (7): draft(), jobStatus, READING, readLyrics, src, T, withScore()

### Community 188 - "timingsJobs.test.ts"
Cohesion: 0.33
Nodes (5): from_env(), Settings, read once from the environment., Settings, create_app(), Thin HTTP wrapper around HeartMuLa (https://github.com/HeartMuLa/heartlib) so M

### Community 189 - "CustomSelect.tsx"
Cohesion: 0.25
Nodes (8): Add Layer (lego) — Phase 6+7 Design (planned 2026-07-02), Architecture: client-side mixing, Architecture: layer stack UI, Architecture: server, Decisions, Feature gating (per the existing ACE-Step Integration table, now enforced), File-level plan, Settings

### Community 190 - "engineGenJobs.test.ts"
Cohesion: 0.24
Nodes (11): captionToTags(), CFG, clamp(), heartmula, HEARTMULA_CAPABILITIES, isSet(), MAX_LENGTH_MS, NO_META (+3 more)

### Community 191 - "abcMeta.ts"
Cohesion: 0.25
Nodes (8): Browser check, PR 2 (2026-10-02), Browser check, PR 3 (2026-10-02), Decisions, Editor Word Timestamps: Click a Lyric Line (planned 2026-10-02), File-level plan, Open questions, Timing spike (2026-10-02), What is there today (checked 2026-10-02)

### Community 192 - "yue2.ts"
Cohesion: 0.22
Nodes (11): buildYue2CoverRequest(), buildYue2Request(), chooseSeed(), INSTRUMENTAL_CONDITIONS, instrumentalStyle(), LANGUAGE_NAMES, METER_TEXT, meterText() (+3 more)

### Community 193 - "heartmula-server"
Cohesion: 0.22
Nodes (8): Data model, Decisions locked in (from discussion, 2026-07-04), FORGE — LoRA/LoKr Training & Dataset Studio (planning doc, not yet implemented), Open questions for `/opsx:explore` when this starts, Phased plan, What ACE-Step 1.5 already gives us (verified 2026-07-04, native REST — no Gradio), What ace-step-ui-main's training UI is worth borrowing (checked 2026-07-04), Why this exists, and why it's separate

### Community 194 - "test_store_and_worker.py"
Cohesion: 0.22
Nodes (8): API, Config (env vars), GPU: one model at a time (read this), heartmula-server, Run, Setup (native Windows), Tests, WSL2 fallback

### Community 195 - "README.md"
Cohesion: 0.40
Nodes (5): 9.1 API Definition, 9.2 Request Parameters, 9.3 Response Example, 9.4 Usage Examples, 9. Initialize or Switch Models

### Community 196 - "engines.test.ts"
Cohesion: 0.29
Nodes (5): deleteAdapter, listAdapters, registerAdapter, setActiveAdapter, setAdapterScale

### Community 198 - "uvr-server"
Cohesion: 0.36
Nodes (7): ACESTEP_CAPABILITIES, coverReady(), EngineInfo, EXTRA_ENGINES, listEngines(), EngineCapabilities, transcriptionHealth()

### Community 199 - "generationStore.test.ts"
Cohesion: 0.22
Nodes (7): activeGeneration, coverWithEngine, generate, generateFromAudio, generateWithEngine, jobStatus, params

### Community 200 - "Color tokens"
Cohesion: 0.29
Nodes (6): Config (env vars), Endpoints, lyrics-server, Run, Setup (native Windows), Tests

### Community 203 - "registry.test.ts"
Cohesion: 0.57
Nodes (6): level(), split(), test_folds_demucs_vocals_into_other(), test_maps_outputs_to_stem_kinds(), test_missing_output_fails_loudly(), test_runs_vocal_model_on_the_mix_then_demucs_on_its_instrumental()

### Community 204 - "The Newest Library Search Wins (planned 2026-10-02)"
Cohesion: 0.29
Nodes (7): 1. History row: prompt instead of timestamp, 2. Draggable/resizable waveform selection, 3. Standalone playhead timeline, 4. Delete a history entry, 5. Regenerate a history entry as an alternate, File-level plan, Repaint Editor UX Upgrade (planned 2026-07-02)

### Community 205 - "Upstream Sync: `complete`/`lego` Skip the LM (planned + implemented 2026-09-30)"
Cohesion: 0.15
Nodes (13): The two-pass split behind /split. See PLAN.md "UVR Separator: Roformer Vocals f, FakeRunners, Stands in for run_mdx_headless / run_demucs_headless: records each call     and, runners(), write_tone(), test_mix_into_tolerates_a_length_mismatch(), post(), setup() (+5 more)

### Community 207 - "COVER and ARRANGE Reference Audio: No Influence Sliders (planned + implemented 2026-09-30)"
Cohesion: 0.33
Nodes (6): Adapter Loading (LoRA/LoKr) at Inference (planned 2026-07-31), Decisions, File-level plan, Open questions, Rollout, Verified against ACE-Step source, 2026-07-31

### Community 210 - "RE-EXTRACT Never Touches a Claimed Stem (planned 2026-10-02)"
Cohesion: 0.10
Nodes (39): prepare_score(), Checks a supplied score (a cover's `abc`) before it is queued, so a bad one is, The score to generate from: validated, and chord-free for `melody`., ScoreError, test_measure_counts_the_prepared_score_per_section(), AbcError, compare(), fail() (+31 more)

### Community 211 - "transcribeStore.test.ts"
Cohesion: 0.29
Nodes (6): jobStatus, land(), src, T, tick(), transcribe

### Community 212 - "1. Authentication"
Cohesion: 0.40
Nodes (5): ANALYZE AUDIO on COVER · YUE2 (planned 2026-10-01), Browser check (2026-10-01), Decisions, File-level plan, Open questions

### Community 213 - "Cover Lyrics From the Recording (planned 2026-10-01)"
Cohesion: 0.40
Nodes (5): Architecture, Decisions, Export & Remaster — Phase 9 Design (planned 2026-07-06), Feature gating, File-level plan

### Community 214 - "voiceStore.test.ts"
Cohesion: 0.40
Nodes (5): Browser check (2026-10-01), Decisions, File-level plan, Open questions, YuE2 Covers: Pick the Score's Sections (planned 2026-10-01)

### Community 215 - "editorJobStore.test.ts"
Cohesion: 0.33
Nodes (3): jobStatus, repaint, retakeVersion

### Community 216 - "Motion"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 217 - "5. Batch Query Task Results"
Cohesion: 0.50
Nodes (4): 8.1 API Definition, 8.2 Response Example, 8.3 Usage Example, 8. List Available Models

### Community 218 - "6. Format Input"
Cohesion: 0.14
Nodes (19): WordTimings, LyricLine, alignLyrics(), editDistance(), LyricAlignment, pairTokens(), similarity(), tokenize() (+11 more)

### Community 219 - "E2E Fails on Uncaught Page Errors (planned 2026-10-02)"
Cohesion: 0.40
Nodes (5): Browser check (2026-10-02), COVER's Source Holds Still While a Job Reads It (planned 2026-10-02), Decisions, File-level plan, Open questions

### Community 220 - "Style Tag Vocabulary for the Caption Field (planned 2026-07-31)"
Cohesion: 0.40
Nodes (5): Browser check (2026-10-02), COVER's Engine Holds Still Too (planned 2026-10-02), Decisions, File-level plan, Open questions

### Community 221 - "ANALYZE AUDIO on COVER · YUE2 (planned 2026-10-01)"
Cohesion: 0.40
Nodes (5): 5.1 API Definition, 5.2 Request Parameters, 5.3 Response Example, 5.4 Usage Example, 5. Batch Query Task Results

### Community 222 - "YuE2 Covers: Pick the Score's Sections (planned 2026-10-01)"
Cohesion: 0.40
Nodes (5): Browser check (2026-10-02), Decisions, File-level plan, Open questions, The Library Loads Without Trying to Play (planned 2026-10-02)

### Community 223 - "10. Server Statistics"
Cohesion: 0.40
Nodes (5): CI (added 2026-10-02), Decisions, File-level plan, Open questions, Playwright Golden-Path E2E (planned 2026-10-02)

### Community 224 - "test_api.py"
Cohesion: 0.40
Nodes (5): Decisions, File-level plan, Open questions, Rollout, Style Tag Vocabulary for the Caption Field (planned 2026-07-31)

### Community 225 - "Mulakai — UX & Visual Polish Notes"
Cohesion: 0.33
Nodes (5): Mulakai — UX & Visual Polish Notes, Proposed next passes (not yet done), The core loop today, Visual polish applied this pass (`index.css`), Workflow observations → improvements

### Community 226 - "Vendored ACE-Step 1.5 documentation"
Cohesion: 0.50
Nodes (3): Keeping them current, Licence, Vendored ACE-Step 1.5 documentation

### Community 227 - "Add Layer Lyrics (implemented 2026-07-08)"
Cohesion: 0.70
Nodes (4): listModels(), acestepHealth(), demucsHealth(), splitHealth

### Community 228 - "ShaderCanvas.tsx"
Cohesion: 0.13
Nodes (15): Props, AIGeneratingBackground(), AIGeneratingBackgroundProps, useWaveVeil(), Layer, latestOnly(), LayerLane(), LayerPatch (+7 more)

### Community 230 - "Training API"
Cohesion: 0.67
Nodes (3): LoKr Training, LoRA Training, Training API

### Community 231 - "YuE2: Align With Upstream's `yue2-music` Skill (planned 2026-09-30)"
Cohesion: 0.50
Nodes (4): A Dropped Generation Stops Polling (planned 2026-10-02), Browser check (2026-10-02), Decisions, File-level plan

### Community 232 - "fake_infer.py"
Cohesion: 0.50
Nodes (3): Expanding the Oxlint configuration, React Compiler, React + TypeScript + Vite

### Community 233 - "README.md"
Cohesion: 0.50
Nodes (4): A Preview Stopped Before It Starts Fails Quietly (planned 2026-10-02), Browser check (2026-10-02), Decisions, File-level plan

### Community 242 - "READ LYRICS With TRANSCRIBE for Uploads (planned 2026-10-01)"
Cohesion: 0.50
Nodes (4): Abandoned Splits Leave No Stems Behind (planned 2026-10-02), Browser check (2026-10-02), Decisions, File-level plan

### Community 246 - "12. Health Check"
Cohesion: 0.50
Nodes (4): ACE-STEP COVER's Source Holds Still Too (planned 2026-10-02), Browser check (2026-10-02), Decisions, File-level plan

### Community 247 - "1. Authentication"
Cohesion: 0.50
Nodes (4): Add Layer Lyrics (implemented 2026-07-08), Decisions, File-level plan, Model restriction (confirmed, no code change)

### Community 248 - "A Failed Editor Job Blocks Nothing (planned 2026-10-01)"
Cohesion: 0.50
Nodes (4): Add Layer Mixes Each Layer at Its Own Volume (planned 2026-10-02), Browser check (2026-10-02), Decisions, File-level plan

### Community 249 - "A Settled Split Blocks Nothing (planned 2026-10-01)"
Cohesion: 0.50
Nodes (4): An Unreachable ACE-Step Is a Failure, Not "No Models" (planned 2026-10-02), Browser check (2026-10-02), Decisions, File-level plan

### Community 257 - "Upstream Sync: `complete`/`lego` Skip the LM (planned + implemented 2026-09-30)"
Cohesion: 0.50
Nodes (4): ANALYZE AUDIO Takes the genLock (planned 2026-10-02), Browser check (2026-10-02), Decisions, File-level plan

### Community 258 - "UVR Separator: Roformer Vocals for SPLIT (planned + implemented 2026-09-30)"
Cohesion: 0.50
Nodes (4): Browser check (2026-10-01), Decisions, Files, READ LYRICS With TRANSCRIBE for Uploads (planned 2026-10-01)

### Community 259 - "A Failed Editor Job Blocks Nothing (planned 2026-10-01)"
Cohesion: 0.50
Nodes (4): Browser check (2026-10-02), Decisions, File-level plan, RE-EXTRACT Never Touches a Claimed Stem (planned 2026-10-02)

### Community 260 - "backfillGenTask.test.ts"
Cohesion: 0.24
Nodes (4): classify(), The single inference thread: load the engine once, then run jobs one at a time., Jobs live in memory, so job folders left by an earlier process are orphans., Worker

### Community 271 - "songLayers.ts"
Cohesion: 0.50
Nodes (4): Browser check (2026-10-02), Decisions, Editor Failures Say So (planned 2026-10-02), File-level plan

### Community 275 - "App.tsx"
Cohesion: 0.50
Nodes (4): Browser check (2026-10-02), COVER Sends the Settings It Shows (planned 2026-10-02), Decisions, File-level plan

### Community 276 - "ACE-STEP COVER's Source Holds Still Too (planned 2026-10-02)"
Cohesion: 0.50
Nodes (4): Browser check (2026-10-02), Decisions, File-level plan, The Newest Library Search Wins (planned 2026-10-02)

### Community 277 - "RE-EXTRACT Never Touches a Claimed Stem (planned 2026-10-02)"
Cohesion: 0.50
Nodes (4): Browser check (2026-10-02), Decisions, File-level plan, Idle Jobs Leave Every Registry (planned 2026-10-02)

### Community 278 - "12. Health Check"
Cohesion: 0.33
Nodes (6): 13. Environment Variables, Cache Configuration, LM Configuration, Model Configuration, Queue Configuration, Server Configuration

### Community 279 - "registry.ts"
Cohesion: 0.12
Nodes (23): COT_VALUES, NUMBER_FIELDS, pickCreateFields(), STRING_FIELDS, coverEngine(), coversRouter, PREVIEW_HEADERS, receiveSource() (+15 more)

### Community 280 - "FastAPI"
Cohesion: 0.29
Nodes (6): Config (env vars), demucs-server, Endpoints, Run, Setup, Tests

### Community 281 - "Path"
Cohesion: 0.29
Nodes (6): Config (env vars), Endpoints, Run, Setup (native Windows), Tests, uvr-server

### Community 282 - "GenerateRequest"
Cohesion: 0.14
Nodes (7): BaseModel, GenerateRequest, The POST /v1/jobs body, validated before anything reaches the pipeline., yue2-serve's body, minus `n` (one take per job), plus a tolerated `id`     (Mul, MeasureRequest, GenerateRequest, POST /v1/jobs body. Field names are heartlib's own, so Mulakai's engines/heartm

### Community 283 - "Path"
Cohesion: 0.50
Nodes (4): Browser check (2026-10-02), Decisions, File-level plan, Lookup Failures Aren't Answers (planned 2026-10-02)

### Community 284 - "abcMeta.ts"
Cohesion: 0.32
Nodes (10): headerFields(), MAJOR, METERS, MINOR, MODES, parseKey(), parseMeter(), parseTempo() (+2 more)

### Community 285 - "Path"
Cohesion: 0.50
Nodes (4): Browser check (2026-10-02), Create-Side Lookup Failures (planned 2026-10-02), Decisions, File-level plan

### Community 286 - "test_api.py"
Cohesion: 0.50
Nodes (4): Browser check (2026-10-02), Decisions, File-level plan, SPLIT Names Its Real Backend (planned 2026-10-02)

### Community 287 - "Abandoned Splits Leave No Stems Behind (planned 2026-10-02)"
Cohesion: 0.50
Nodes (4): Browser check (2026-10-02), Decisions, File-level plan, Split Health: Which Service, and Why It's Off (planned 2026-10-02)

### Community 289 - "engineGenJobs.test.ts"
Cohesion: 0.18
Nodes (7): EngineJobState, client, DONE, engine, fields, readMeta, RUNNING

### Community 291 - "ReferenceAudioPicker.tsx"
Cohesion: 0.50
Nodes (4): Browser check (2026-10-02), Decisions, File-level plan, Voice List Failures (planned 2026-10-02)

### Community 296 - "Worker"
Cohesion: 0.25
Nodes (3): Only meaningful once ready; the submit routes return 503 before that., The score's size in the planner's tokens; None until the pipeline is loaded., Worker

### Community 297 - "E2E Fails on Uncaught Page Errors (planned 2026-10-02)"
Cohesion: 0.50
Nodes (4): Decisions, File-level plan, Import a Song (planned 2026-07-30), Open questions

### Community 300 - "1. Authentication"
Cohesion: 0.67
Nodes (3): 1. Authentication, Authentication Methods, Configuring API Key

### Community 302 - "4. Create Generation Task"
Cohesion: 0.25
Nodes (8): 4.1 API Definition, 4.2 Request Parameters, 4.3 Response Example, 4.4 Usage Examples (cURL), 4. Create Generation Task, Method A: JSON Request (application/json), Method B: File Upload (multipart/form-data), Parameter Naming Convention

### Community 306 - "Output Format: Rate / Depth / Bitrate, Everywhere (planned + implemented 2026-07-31)"
Cohesion: 0.50
Nodes (4): Decisions, File-level plan, Open questions, Output Format: Rate / Depth / Bitrate, Everywhere (planned + implemented 2026-07-31)

### Community 307 - "STEPS AUTO Resolves Per Model (planned 2026-07-31)"
Cohesion: 0.50
Nodes (4): Decisions, File-level plan, Open questions, STEPS AUTO Resolves Per Model (planned 2026-07-31)

### Community 308 - "Upstream Sync: `complete`/`lego` Skip the LM (planned + implemented 2026-09-30)"
Cohesion: 0.50
Nodes (4): Decisions, File-level plan, Open questions, Upstream Sync: `complete`/`lego` Skip the LM (planned + implemented 2026-09-30)

### Community 310 - "UVR Separator: Roformer Vocals for SPLIT (planned + implemented 2026-09-30)"
Cohesion: 0.50
Nodes (4): Decisions, File-level plan (as built), Open questions, UVR Separator: Roformer Vocals for SPLIT (planned + implemented 2026-09-30)

### Community 311 - "api.py"
Cohesion: 0.50
Nodes (3): create_app(), HTTP layer, built around an injected separate() so tests need no torch. Speaks, Separate

### Community 312 - "transcribe_routes.py"
Cohesion: 0.50
Nodes (4): 10.1 API Definition, 10.2 Response Example, 10.3 Usage Example, 10. Server Statistics

### Community 313 - "A Failed Editor Job Blocks Nothing (planned 2026-10-01)"
Cohesion: 0.67
Nodes (3): A Failed Editor Job Blocks Nothing (planned 2026-10-01), Decisions, File-level plan

### Community 314 - "6. Format Input"
Cohesion: 0.40
Nodes (5): 6.1 API Definition, 6.2 Request Parameters, 6.3 Response Example, 6.4 Usage Example, 6. Format Input

### Community 315 - "Idle Jobs Leave Every Registry (planned 2026-10-02)"
Cohesion: 0.67
Nodes (3): 12.1 API Definition, 12.2 Response Example, 12. Health Check

### Community 319 - "A Failed Generation Blocks Nothing (planned 2026-10-01)"
Cohesion: 0.67
Nodes (3): A Failed Generation Blocks Nothing (planned 2026-10-01), Decisions, File-level plan

### Community 320 - "A Settled Split Blocks Nothing (planned 2026-10-01)"
Cohesion: 0.67
Nodes (3): A Settled Split Blocks Nothing (planned 2026-10-01), Decisions, File-level plan

### Community 321 - "COVER and ARRANGE Reference Audio: No Influence Sliders (planned + implemented 2026-09-30)"
Cohesion: 0.67
Nodes (3): COVER and ARRANGE Reference Audio: No Influence Sliders (planned + implemented 2026-09-30), Decisions, File-level plan

### Community 322 - "Text2music Reference Audio: Style Influence Only (planned + implemented 2026-09-30)"
Cohesion: 0.67
Nodes (3): Decisions, File-level plan, Text2music Reference Audio: Style Influence Only (planned + implemented 2026-09-30)

### Community 323 - "E2E Fails on Uncaught Page Errors (planned 2026-10-02)"
Cohesion: 0.67
Nodes (3): Decisions, E2E Fails on Uncaught Page Errors (planned 2026-10-02), File-level plan

### Community 324 - "Universal Advanced Settings (Repaint + Add Layer) (implemented 2026-07-08)"
Cohesion: 0.67
Nodes (3): Decisions, File-level plan, Universal Advanced Settings (Repaint + Add Layer) (implemented 2026-07-08)

## Knowledge Gaps
- **906 isolated node(s):** `$schema`, `plugins`, `react/rules-of-hooks`, `react/only-export-components`, `name` (+901 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **126 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `reading()` connect `AIGeneratingBackground.tsx` to `6. Format Input`, `Advanced Generation Settings`?**
  _High betweenness centrality (0.071) - this node is a cross-community bridge._
- **Why does `startVersionTimings()` connect `Advanced Generation Settings` to `AIGeneratingBackground.tsx`?**
  _High betweenness centrality (0.070) - this node is a cross-community bridge._
- **Why does `AddLayerTrigger()` connect `Client Lint Config` to `Mulakai — UX & Visual Polish Notes`, `FakeAudio`, `ShaderCanvas.tsx`, `Waveform.tsx`, `CreateView.tsx`, `13. Environment Variables`?**
  _High betweenness centrality (0.059) - this node is a cross-community bridge._
- **What connects `$schema`, `plugins`, `react/rules-of-hooks` to the rest of the system?**
  _987 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Project Docs & Design Concepts` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._
- **Should `Core Song/Layer/Version API` be split into smaller, more focused modules?**
  _Cohesion score 0.07769423558897243 - nodes in this community are weakly interconnected._
- **Should `Server Package Config` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._