# Graph Report - Mulakai  (2026-09-30)

## Corpus Check
- 303 files · ~198,649 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2005 nodes · 4104 edges · 210 communities (133 shown, 77 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 153 edges (avg confidence: 0.74)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `74c0bbab`
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
- waveformPeaks.ts
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
- voiceStore.test.ts
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
- registry.ts
- engineGenJobs.ts
- CreateView.tsx
- worker.py
- JobCancelled
- Multiple Song-Creation Engines (planned 2026-09-30)
- heartmula.ts
- test_engine.py
- main.py
- yue-server
- engine_api.py
- Mulakai
- SongEngine
- run_job
- GenerateRequest
- CustomSelect.tsx
- engineGenJobs.test.ts
- abcMeta.ts
- yue2.ts
- heartmula-server
- test_store_and_worker.py
- README.md
- generationStore.ts
- 🟠 Correctness
- uvr-server
- generationStore.test.ts
- Color tokens
- YuE2 Melody Covers via SheetSage2 (planned 2026-09-30)
- engineClient.test.ts
- 🟡 Resource leaks / unbounded growth
- config.py
- Upstream Sync: `complete`/`lego` Skip the LM (planned + implemented 2026-09-30)
- UVR Separator: Roformer Vocals for SPLIT (planned + implemented 2026-09-30)
- COVER and ARRANGE Reference Audio: No Influence Sliders (planned + implemented 2026-09-30)
- Text2music Reference Audio: Style Influence Only (planned + implemented 2026-09-30)

## God Nodes (most connected - your core abstractions)
1. `Mulakai — Project Plan` - 42 edges
2. `api` - 36 edges
3. `useSettings` - 30 edges
4. `releaseGenLock()` - 25 edges
5. `useCreateDraftStore` - 23 edges
6. `acquireGenLock()` - 23 edges
7. `JobStore` - 22 edges
8. `config` - 22 edges
9. `useGenerationStore` - 21 edges
10. `useVoiceStore` - 21 edges

## Surprising Connections (you probably didn't know these)
- `AddLayerTrigger()` --indirect_call--> `lyrics()`  [INFERRED]
  client/src/AddLayerTrigger.tsx → heartmula-server/tests/conftest.py
- `useAnalyzeSourceAudio()` --indirect_call--> `result()`  [INFERRED]
  client/src/useAnalyzeSourceAudio.ts → server/src/services/lyricTimestamps.test.ts
- `Clock` --uses--> `JobStore`  [INFERRED]
  yue-server/tests/test_store_and_worker.py → heartmula-server/jobs.py
- `Worker` --uses--> `JobStore`  [INFERRED]
  yue-server/worker.py → heartmula-server/jobs.py
- `OutputMetadataSection()` --indirect_call--> `patch()`  [INFERRED]
  client/src/OutputMetadataSection.tsx → server/src/routes/adapters.test.ts

## Import Cycles
- None detected.

## Communities (210 total, 77 thin omitted)

### Community 0 - "Backend Generation & Job Services"
Cohesion: 0.10
Nodes (36): adaptersRouter, message(), syncWarning(), analyzeAudio(), call(), Envelope, fetchWithTimeout(), formatInput() (+28 more)

### Community 1 - "Editor UI Components"
Cohesion: 0.18
Nodes (15): RefineResult, Props, RefineRail(), SongFields, AUTO_OPTION, KNOWN_TIME_SIGNATURES, KNOWN_VOCAL_LANGUAGES, TIME_SIGNATURES (+7 more)

### Community 2 - "App Shell & Library UI"
Cohesion: 0.12
Nodes (19): App(), View, createCoverDraft(), draftHasIntent(), reusePromptDraft(), LibraryFilter, LibrarySort, LibraryToolbar() (+11 more)

### Community 3 - "Project Docs & Design Concepts"
Cohesion: 0.22
Nodes (9): AGENTS.md — Mulakai Development Rules, Code Style, Design System (mandatory for all UI work), Git Workflow, Module Size Policy, Red Lines, Scope Discipline, Spec-Driven Development (+1 more)

### Community 4 - "Core Song/Layer/Version API"
Cohesion: 0.08
Nodes (38): config, __dirname, db, app, foldersRouter, generateRouter, layersRouter, outputMetadataRouter (+30 more)

### Community 5 - "Lyrics & Export Panel"
Cohesion: 0.05
Nodes (39): 1. Reference Audio: Global Acoustic Feature Control, 2. Source Audio: Semantic Structure Control, 3. Source Audio Context-Based Control: Local Completion and Modification, 4. Base Model Advanced Audio Control Tasks, About Audio Control: Controlling Sound with Sound, About Caption: The Most Important Input, About Lyrics: The Temporal Script, About Music Metadata: Optional Fine Control (+31 more)

### Community 6 - "API Client & Create Flow"
Cohesion: 0.05
Nodes (49): ActiveAdapterNote(), AdapterAddForm(), AdaptersSection(), AdapterStrength(), activeAdapter(), adapterConsequence(), AdapterState, deleteAdapter (+41 more)

### Community 7 - "Server Package Config"
Cohesion: 0.07
Nodes (26): author, dependencies, better-sqlite3, express, multer, node-taglib-sharp, description, devDependencies (+18 more)

### Community 8 - "Client Package Config"
Cohesion: 0.08
Nodes (24): dependencies, framer-motion, react, react-dom, zustand, devDependencies, oxlint, @types/node (+16 more)

### Community 9 - "Voice Picker & Management"
Cohesion: 0.14
Nodes (22): LyricLine, Editor(), fmt(), Props, myEditorJob(), useEditorJobStore, useGenerationStore, LyricsBlock (+14 more)

### Community 10 - "Playback Mix Engine"
Cohesion: 0.07
Nodes (49): STEM_KINDS, upload, listModels(), queryResult(), AudioFormat, BitDepth, clampDepth(), DEFAULT_OUTPUT (+41 more)

### Community 11 - "Client TSConfig (app)"
Cohesion: 0.10
Nodes (19): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+11 more)

### Community 12 - "Advanced Generation Settings"
Cohesion: 0.21
Nodes (38): audioFileExt(), downloadAudio(), rawPathFromAudioUrl(), releaseTask(), TaskResult, persistNewLayer(), startAddLayer(), startCompleteGeneration() (+30 more)

### Community 13 - "AI Thinking & Create View"
Cohesion: 0.16
Nodes (17): main(), lyricTagsRouter, extractTags(), FreshTagEntry, getProbeState(), getStoredTags(), loadStore(), LyricTagRecord (+9 more)

### Community 14 - "Song Detail & Refine Rail"
Cohesion: 0.12
Nodes (15): 15. UX inconsistencies, 16. Shader palette violation, 17. Server-side polish, 18. Module-size hard cap (AGENTS.md: 200 LOC) — current violations, 19. No Playwright e2e exists, 1. Playback never ends, 20. Untested critical modules, 2. Demucs re-extract silently overwrites already-claimed stems (+7 more)

### Community 15 - "Client TSConfig (node)"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 16 - "Add-Layer & Mix Bounce"
Cohesion: 0.47
Nodes (6): Props, ReferenceAudioPicker(), influenceHint(), pct(), ReferenceTaskType, showsStyleInfluence()

### Community 18 - "Server TSConfig"
Cohesion: 0.15
Nodes (12): compilerOptions, esModuleInterop, module, moduleResolution, outDir, rootDir, skipLibCheck, strict (+4 more)

### Community 19 - "Icon Sprite Assets"
Cohesion: 0.48
Nodes (7): Bluesky Icon (butterfly logo, social link), Discord Icon (game controller/mask logo, social link), Documentation Icon (book with folded corner, docs link), GitHub Icon (Octocat cat logo, source-code link), Social Icon (person silhouette with star badge, community link), icons.svg Sprite Sheet, X (Twitter) Icon (stylized X logo, social link)

### Community 20 - "Core Domain Entities (Plan)"
Cohesion: 0.07
Nodes (28): ACE-Step Integration (verified against docs/en/API.md + INFERENCE.md, 2026-07-02), Add Layer: Forced batch_size 1 + Track-Type Picker (implemented 2026-07-10), Architecture, Architecture, Create AUDIO/ARRANGE Flows — `cover` and `complete` (implemented 2026-07-07), Create Draft Persistence + Origin-Aware Reuse (planned 2026-07-30), Custom Player Controls (planned 2026-07-02, then implemented), Decisions Locked In (+20 more)

### Community 21 - "Tech Stack & Structure Docs"
Cohesion: 0.22
Nodes (8): Commands, Design System, graphify, Mulakai — Agent Instructions, Project Structure, Reference Projects (do not modify), Spec-Driven Development, Tech Stack

### Community 22 - "Client Lint Config"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 23 - "Demucs Stem-Split Server"
Cohesion: 0.18
Nodes (9): Thin HTTP wrapper around Demucs (https://github.com/adefossez/demucs) so Mulakai, split(), create_app(), Engine, FastAPI, Settings, Thin HTTP wrapper around HeartMuLa (https://github.com/HeartMuLa/heartlib) so M, Request (+1 more)

### Community 24 - "FileTags Test Suite"
Cohesion: 0.33
Nodes (5): createFromPath, fakeFile, fakeId3Tag, fakeTag, idSettings

### Community 25 - "Player & Mix Polish (Plan)"
Cohesion: 0.13
Nodes (15): AI states — the one exception to "one hue, one job", App model — a flat set of top-level views, one page, Audio preview module (added 2026-07-29), Copy rules, Design language in one sentence, Interaction rhythm, Interactive feedback, Motion (+7 more)

### Community 32 - "Jobs Service Test Suite"
Cohesion: 0.25
Nodes (5): callOrder, initModel, queryResult, reconcileAdapter, releaseTask

### Community 39 - "Human-Centered Design Philosophy"
Cohesion: 0.05
Nodes (39): 1. Reference Audio: Global Acoustic Feature Control, 2. Source Audio: Semantic Structure Control, 3. Source Audio Context-Based Control: Local Completion and Modification, 4. Base Model Advanced Audio Control Tasks, About Audio Control: Controlling Sound with Sound, About Caption: The Most Important Input, About Lyrics: The Temporal Script, About Music Metadata: Optional Fine Control (+31 more)

### Community 47 - "Git Workflow Rules"
Cohesion: 0.24
Nodes (12): AddLayerJob, EditorJob, errMsg(), JobBase, RegenerateJob, RemasterJob, RepaintJob, RetakeJob (+4 more)

### Community 48 - "Red Lines (Never Do)"
Cohesion: 0.14
Nodes (20): AnalyzeAudioButton(), Props, AutoTextarea(), Props, CarriedPromptNote(), CreateArrangeTab(), CreateAudioTab(), GenerateButton() (+12 more)

### Community 49 - "SettingsPanel.tsx"
Cohesion: 0.17
Nodes (14): MEANING, CreateBar(), Props, CreateDraft, GEN_TYPE_LABEL, GenType, Source, ARRANGE (+6 more)

### Community 50 - "Claude Commands"
Cohesion: 0.20
Nodes (9): 12.1 API Definition, 12.2 Response Example, 12. Health Check, 2. Response Format, 3. Task Status Description, ACE-Step API Client Documentation, Best Practices, Error Handling (+1 more)

### Community 58 - "FORGE — LoRA/LoKr Training & Dataset Studio (planning doc, not yet implemented)"
Cohesion: 0.22
Nodes (8): Data model, Decisions locked in (from discussion, 2026-07-04), FORGE — LoRA/LoKr Training & Dataset Studio (planning doc, not yet implemented), Open questions for `/opsx:explore` when this starts, Phased plan, What ACE-Step 1.5 already gives us (verified 2026-07-04, native REST — no Gradio), What ace-step-ui-main's training UI is worth borrowing (checked 2026-07-04), Why this exists, and why it's separate

### Community 59 - "4. Create Generation Task"
Cohesion: 0.25
Nodes (8): 4.1 API Definition, 4.2 Request Parameters, 4.3 Response Example, 4.4 Usage Examples (cURL), 4. Create Generation Task, Method A: JSON Request (application/json), Method B: File Upload (multipart/form-data), Parameter Naming Convention

### Community 60 - "lyricSections.ts"
Cohesion: 0.13
Nodes (18): BOOLEAN_FIELDS, GEN_FIELDS, labelOnlyReferenceMeta(), NUMERIC_FIELDS, pickMultipartParams(), pickParams(), upload, createRandomSample() (+10 more)

### Community 61 - "CreateView.tsx"
Cohesion: 0.22
Nodes (19): AddLayerDraft, useAddLayerDraft, AddLayerTrigger(), GeneratingCard(), STAGE_LABEL, EDITOR_STAGE_LABEL, EditorJobKind, ENGINE_STAGES (+11 more)

### Community 62 - "demucs-server"
Cohesion: 0.33
Nodes (5): Config (env vars), demucs-server, Endpoints, Run, Setup

### Community 63 - "13. Environment Variables"
Cohesion: 0.33
Nodes (6): 13. Environment Variables, Cache Configuration, LM Configuration, Model Configuration, Queue Configuration, Server Configuration

### Community 64 - "Mulakai — UX & Visual Polish Notes"
Cohesion: 0.33
Nodes (5): Mulakai — UX & Visual Polish Notes, Proposed next passes (not yet done), The core loop today, Visual polish applied this pass (`index.css`), Workflow observations → improvements

### Community 65 - "FakeAudio"
Cohesion: 0.12
Nodes (23): AudioFormat, BitDepth, clampDepth(), depthLabel(), DEPTHS_BY_FORMAT, FORMATS, maxDepth(), MP3_BITRATES (+15 more)

### Community 66 - "lyricTags.ts"
Cohesion: 0.40
Nodes (4): INLINE_TAGS, LYRIC_TAGS, LyricTag, SECTION_TAGS

### Community 67 - "5. Batch Query Task Results"
Cohesion: 0.40
Nodes (5): 5.1 API Definition, 5.2 Request Parameters, 5.3 Response Example, 5.4 Usage Example, 5. Batch Query Task Results

### Community 68 - "6. Format Input"
Cohesion: 0.40
Nodes (5): 6.1 API Definition, 6.2 Request Parameters, 6.3 Response Example, 6.4 Usage Example, 6. Format Input

### Community 69 - "7. Get Random Sample"
Cohesion: 0.40
Nodes (5): 7.1 API Definition, 7.2 Request Parameters, 7.3 Response Example, 7.4 Usage Example, 7. Get Random Sample

### Community 70 - "9. Initialize or Switch Models"
Cohesion: 0.40
Nodes (5): 9.1 API Definition, 9.2 Request Parameters, 9.3 Response Example, 9.4 Usage Examples, 9. Initialize or Switch Models

### Community 71 - "genLock.ts"
Cohesion: 0.08
Nodes (32): create_app(), FastAPI, Path, Runner, HTTP layer, built around injected runners so tests need no torch. Speaks the con, mix_into(), output_path(), Path (+24 more)

### Community 72 - "React + TypeScript + Vite"
Cohesion: 0.50
Nodes (3): Expanding the Oxlint configuration, React Compiler, React + TypeScript + Vite

### Community 73 - "10. Server Statistics"
Cohesion: 0.50
Nodes (4): 10.1 API Definition, 10.2 Response Example, 10.3 Usage Example, 10. Server Statistics

### Community 74 - "11. Download Audio Files"
Cohesion: 0.50
Nodes (4): 11.1 API Definition, 11.2 Request Parameters, 11.3 Usage Example, 11. Download Audio Files

### Community 75 - "8. List Available Models"
Cohesion: 0.50
Nodes (4): 8.1 API Definition, 8.2 Response Example, 8.3 Usage Example, 8. List Available Models

### Community 77 - "1. Authentication"
Cohesion: 0.67
Nodes (3): 1. Authentication, Authentication Methods, Configuring API Key

### Community 78 - "Training API"
Cohesion: 0.67
Nodes (3): LoKr Training, LoRA Training, Training API

### Community 133 - "Waveform.tsx"
Cohesion: 0.33
Nodes (6): Seed(), compile(), createProgram(), ShaderCanvas(), AiEnhanceBadge(), Toggle()

### Community 134 - "settings.ts"
Cohesion: 0.10
Nodes (34): EngineCapabilities, EngineControl, EngineId, EngineInfo, generationApi, CreatePromptTab(), durationReadout(), Engine (+26 more)

### Community 135 - "Add Layer (lego) — Phase 6+7 Design (planned 2026-07-02)"
Cohesion: 0.25
Nodes (8): Add Layer (lego) — Phase 6+7 Design (planned 2026-07-02), Architecture: client-side mixing, Architecture: layer stack UI, Architecture: server, Decisions, Feature gating (per the existing ACE-Step Integration table, now enforced), File-level plan, Settings

### Community 136 - "Repaint Editor UX Upgrade (planned 2026-07-02)"
Cohesion: 0.29
Nodes (7): 1. History row: prompt instead of timestamp, 2. Draggable/resizable waveform selection, 3. Standalone playhead timeline, 4. Delete a history entry, 5. Regenerate a history entry as an alternate, File-level plan, Repaint Editor UX Upgrade (planned 2026-07-02)

### Community 137 - "Export & Remaster — Phase 9 Design (planned 2026-07-06)"
Cohesion: 0.40
Nodes (5): Architecture, Decisions, Export & Remaster — Phase 9 Design (planned 2026-07-06), Feature gating, File-level plan

### Community 138 - "AIGeneratingBackground.tsx"
Cohesion: 0.21
Nodes (15): Props, Layer, activeLayers(), bounceMix(), encodeWav(), DecodedLayer, decodeLayers(), LayerAudioInput (+7 more)

### Community 139 - "Add Layer Lyrics (implemented 2026-07-08)"
Cohesion: 0.50
Nodes (4): Add Layer Lyrics (implemented 2026-07-08), Decisions, File-level plan, Model restriction (confirmed, no code change)

### Community 140 - "Universal Advanced Settings (Repaint + Add Layer) (implemented 2026-07-08)"
Cohesion: 0.67
Nodes (3): Decisions, File-level plan, Universal Advanced Settings (Repaint + Add Layer) (implemented 2026-07-08)

### Community 141 - "Create AUDIO/ARRANGE Flows — `cover` and `complete` (implemented 2026-07-07)"
Cohesion: 0.10
Nodes (29): test_classify(), classify(), Exception, InterruptedError, RuntimeError, FakePipeline, make_client(), A fake of the yue_pipeline.YuePipeline adapter, so tests run without torch, yue (+21 more)

### Community 142 - "backfillGenTask.test.ts"
Cohesion: 0.10
Nodes (23): AIGeneratingBackground(), AIGeneratingBackgroundProps, useWaveVeil(), jobStatus, repaint, tick(), LayerLane(), Props (+15 more)

### Community 143 - "api.ts"
Cohesion: 0.50
Nodes (4): Decisions, File-level plan, Import a Song (planned 2026-07-30), Open questions

### Community 145 - "Create Draft Persistence + Origin-Aware Reuse (planned 2026-07-30)"
Cohesion: 0.14
Nodes (21): aceOnlyNote(), COT_OPTIONS, EngineGenSettings(), SLIDERS, enginePromptParams(), PromptIntent, DRAFT, HEARTMULA (+13 more)

### Community 146 - "FakeAudio"
Cohesion: 0.23
Nodes (4): createPreviewPlayback(), PreviewAudioElement, FakeAudio, make()

### Community 147 - "waveformPeaks.ts"
Cohesion: 0.12
Nodes (15): fit_to_ceiling(), Path, Write the engine's float audio as a lossless FLAC master.  HeartMuLa's float p, Return (audio, gain_db). Only ever turns down, never up., write_flac(), test_audio_within_the_ceiling_is_untouched(), test_non_finite_samples_are_rejected(), test_over_full_scale_is_turned_down_to_the_ceiling() (+7 more)

### Community 148 - "MoveToEditorAction.tsx"
Cohesion: 0.11
Nodes (20): Voice, readDuration(), MoveToEditorAction(), Nav, NavigationContext, useNavigation(), PromptGenerateRow(), genParams() (+12 more)

### Community 149 - "AdaptersSection.tsx"
Cohesion: 0.13
Nodes (16): Thin HTTP wrapper around uvr-headless-runner (https://github.com/chyinan/uvr-hea, _run_demucs(), _run_mdx(), Fetch, test_demucs_looks_again_after_download(), test_demucs_still_missing_after_download_raises(), test_demucs_uses_an_installed_model_without_resolving(), test_reuses_the_cached_entry() (+8 more)

### Community 150 - "SettingsView.tsx"
Cohesion: 0.09
Nodes (25): ApiError, StemKind, StemResult, AudioPreview(), fmtTime(), Props, taskToGenType(), ArrangeMethod (+17 more)

### Community 151 - "Waveform.tsx"
Cohesion: 0.20
Nodes (11): api, Version, AudioPreviewPopover(), Props, PreviewPlayback, PreviewSnapshot, usePreviewState(), RemasterResult (+3 more)

### Community 152 - "generationStore.ts"
Cohesion: 0.14
Nodes (12): JobStore, Forget finished jobs older than the cutoff; returns their ids., Block for the next queued job, mark it running, return (id, request)., Record the outcome. A cancel that arrived mid-job wins; returns the final status, test_a_cancel_mid_job_wins_over_success(), test_a_repeated_idempotency_key_replays_the_job(), test_cancel_on_a_finished_job_is_a_no_op(), test_cancelling_a_queued_job_skips_it() (+4 more)

### Community 153 - "adapters.test.ts"
Cohesion: 0.26
Nodes (16): FakeEngine, Stands in for HeartMulaEngine: no torch, no GPU. `gate` lets a test hold     a, make_client(), test_a_value_naming_a_file_is_refused(), test_bearer_key_is_enforced_only_when_set(), test_cancel_while_running(), test_failures_carry_a_code_and_message(), test_happy_path_returns_a_flac_within_full_scale() (+8 more)

### Community 154 - "inferenceSteps.ts"
Cohesion: 0.25
Nodes (7): ReleaseTaskParams, AUTO_STEPS, hasToken(), modelFamily, stepsForModel(), params, stub

### Community 155 - "adapterStore.test.ts"
Cohesion: 0.23
Nodes (15): AdvancedGenSettings(), AUTO_STEPS, autoSteps(), ditModelDescription(), guidanceEffective(), hasToken(), lmModelDescription(), modelFamily (+7 more)

### Community 156 - "apiStatusStore.ts"
Cohesion: 0.43
Nodes (5): ActiveGeneration, ApiStatusState, useApiStatusStore, Header(), Props

### Community 158 - "voiceStore.test.ts"
Cohesion: 0.12
Nodes (21): editorApi, appendParams(), json(), libraryApi, managementApi, AdapterList, Folder, FolderScope (+13 more)

### Community 159 - "Adapter Loading (LoRA/LoKr) at Inference (planned 2026-07-31)"
Cohesion: 0.33
Nodes (6): Adapter Loading (LoRA/LoKr) at Inference (planned 2026-07-31), Decisions, File-level plan, Open questions, Rollout, Verified against ACE-Step source, 2026-07-31

### Community 160 - "adapters.test.ts"
Cohesion: 0.33
Nodes (4): loadLora, loraStatus, setLoraScale, unloadLora

### Community 161 - "SectionStrip.tsx"
Cohesion: 0.14
Nodes (11): remasterRouter, upload, songLayersRouter, upload, GenKind, GenLockError, GenLockInfo, GenTask (+3 more)

### Community 162 - "Style Tag Vocabulary for the Caption Field (planned 2026-07-31)"
Cohesion: 0.40
Nodes (5): Decisions, File-level plan, Open questions, Rollout, Style Tag Vocabulary for the Caption Field (planned 2026-07-31)

### Community 163 - "Output Format: Rate / Depth / Bitrate, Everywhere (planned + implemented 2026-07-31)"
Cohesion: 0.50
Nodes (4): Decisions, File-level plan, Open questions, Output Format: Rate / Depth / Bitrate, Everywhere (planned + implemented 2026-07-31)

### Community 164 - "STEPS AUTO Resolves Per Model (planned 2026-07-31)"
Cohesion: 0.50
Nodes (4): Decisions, File-level plan, Open questions, STEPS AUTO Resolves Per Model (planned 2026-07-31)

### Community 168 - "adapterStore.test.ts"
Cohesion: 0.13
Nodes (7): Settings, Adapter over the official YuE2 pipeline (`yue2-infer`, installed into this venv, Forwards to the pipeline's stage reporter and mirrors update() calls., Move weights to system RAM and hand the cached VRAM back., _StageTap, _tapped(), YuePipeline

### Community 169 - "waveformPeaks.ts"
Cohesion: 0.38
Nodes (3): createPeaksLoader(), loader, PeaksDecoder

### Community 171 - "ExportPanel.tsx"
Cohesion: 0.17
Nodes (10): drop_kv_caches(), HeartMulaEngine, park(), _raise_if(), HeartMuLa behind the worker's Engine interface, with RAM parking.  Both models, torchtune 0.4's setup_cache skips any layer whose cache already exists,     so, test_drop_kv_caches_leaves_cacheless_modules_alone(), test_vram_cap_defaults_to_card_total_minus_2_gib() (+2 more)

### Community 173 - "JobStore"
Cohesion: 0.17
Nodes (5): JobStore, Path, Drop finished jobs (and their artifacts) older than the retention window., Delete artifact directories left by a previous run (jobs are not persisted)., Block until a queued job exists (or stop/timeout), then mark it running.

### Community 174 - "registry.ts"
Cohesion: 0.20
Nodes (13): COT_VALUES, enginesRouter, NUMBER_FIELDS, pickCreateFields(), STRING_FIELDS, ACESTEP_CAPABILITIES, EngineInfo, EXTRA_ENGINES (+5 more)

### Community 175 - "engineGenJobs.ts"
Cohesion: 0.38
Nodes (14): cancel(), EngineTarget, errorMessage(), failure(), fetchAudio(), fetchScore(), headers(), health() (+6 more)

### Community 176 - "CreateView.tsx"
Cohesion: 0.22
Nodes (9): ClearDraftButton(), isDraftEmpty(), INITIAL, useCreateDraftStore, CreateView(), Props, ResizeHandle(), Options (+1 more)

### Community 177 - "worker.py"
Cohesion: 0.17
Nodes (10): Exception, IdempotencyConflict, QueueFull, In-memory job table and FIFO queue.  Snapshots mirror YuE2-Turbo's yue2-serve, Returns (snapshot, created). A repeated key with the same request is a, The single inference thread: load the engine once, then run jobs one at a time., IdempotencyConflict, QueueFull (+2 more)

### Community 178 - "JobCancelled"
Cohesion: 0.22
Nodes (7): JobCancelled, Raised inside a job when its cancel flag is seen., Attn, Backbone, FakeCodec, FakeLM, Recorded

### Community 179 - "Multiple Song-Creation Engines (planned 2026-09-30)"
Cohesion: 0.14
Nodes (14): Engine: HeartMuLa (ships second), Engine picker UI decisions (2026-09-30, `feat/engine-picker-ui`), Engine: YuE2 (ships first), File-level plan, Framework decisions (2026-09-30, `feat/engine-framework`), General engine design (decided once, shared by every engine), heartmula-server decisions (2026-09-30), HeartMuLa spike results (2026-09-30) (+6 more)

### Community 180 - "heartmula.ts"
Cohesion: 0.22
Nodes (12): captionToTags(), CFG, clamp(), heartmula, HEARTMULA_CAPABILITIES, isSet(), MAX_LENGTH_MS, NO_META (+4 more)

### Community 181 - "test_engine.py"
Cohesion: 0.32
Nodes (10): FakePipe, make(), HeartMulaEngine's orchestration against a fake heartlib pipeline built from tin, run(), test_auto_knobs_get_heartlibs_defaults(), test_cancel_stops_the_lm_mid_song_and_still_parks_it(), test_kv_caches_are_dropped_and_the_cancel_hook_removed_after_the_lm(), test_one_model_on_the_gpu_at_a_time_and_both_parked_after() (+2 more)

### Community 182 - "main.py"
Cohesion: 0.22
Nodes (10): create_app(), main(), FastAPI, Settings, Thin HTTP wrapper around the official YuE2 pipeline (https://github.com/multimo, _flag(), Environment configuration for yue-server. Every knob is optional; the defaults, Settings (+2 more)

### Community 183 - "yue-server"
Cohesion: 0.15
Nodes (12): 1. WSL2 + Ubuntu 24.04, 2. The venv (inside WSL), 3. `yue2 doctor` and the weights, 4. Start the server, API, Config (env vars, all optional), If Ubuntu's first-run user setup hangs, Instrumentals (+4 more)

### Community 184 - "engine_api.py"
Cohesion: 0.18
Nodes (5): Engine, Generated, What the job worker needs from an engine. Torch-free, so the API, the queue and, lyrics(), Protocol

### Community 185 - "Mulakai"
Cohesion: 0.17
Nodes (12): Configuration, Design, Development, Licence, Mulakai, Repository layout, Requirements, Running it (+4 more)

### Community 186 - "SongEngine"
Cohesion: 0.17
Nodes (6): offline, start, yue, acestepHealth, engineHealth, SongEngine

### Community 187 - "run_job"
Cohesion: 0.23
Nodes (7): _error(), Exception, JobStore, The single inference thread: loads the pipeline once, then runs queued jobs one, run_job(), _save(), Worker

### Community 188 - "GenerateRequest"
Cohesion: 0.18
Nodes (6): BaseModel, GenerateRequest, POST /v1/jobs body. Field names are heartlib's own, so Mulakai's engines/heartm, GenerateRequest, The POST /v1/jobs body, validated before anything reaches the pipeline., yue2-serve's body, minus `n` (one take per job) and `abc` (score editing     is

### Community 189 - "CustomSelect.tsx"
Cohesion: 0.36
Nodes (6): INFER_METHOD_OPTIONS, CustomSelect(), Props, InfoTooltip(), Props, Slider()

### Community 190 - "engineGenJobs.test.ts"
Cohesion: 0.18
Nodes (7): EngineJobState, client, DONE, engine, fields, readMeta, RUNNING

### Community 191 - "abcMeta.ts"
Cohesion: 0.38
Nodes (9): headerFields(), MAJOR, METERS, MINOR, MODES, parseKey(), parseMeter(), parseTempo() (+1 more)

### Community 192 - "yue2.ts"
Cohesion: 0.29
Nodes (7): buildYue2Request(), chooseSeed(), METER_TEXT, meterText(), styleHints(), YUE2_CAPABILITIES, yue2Engine

### Community 193 - "heartmula-server"
Cohesion: 0.22
Nodes (8): API, Config (env vars), GPU: one model at a time (read this), heartmula-server, Run, Setup (native Windows), Tests, WSL2 fallback

### Community 194 - "test_store_and_worker.py"
Cohesion: 0.28
Nodes (6): Clock, test_a_cancel_that_races_completion_wins(), test_idempotency_keys_expire_with_their_job(), test_progress_is_a_per_stage_fraction(), test_purge_orphans_only_touches_job_directories(), test_sweep_drops_expired_jobs_and_their_artifacts()

### Community 195 - "README.md"
Cohesion: 0.25
Nodes (3): Keeping them current, Licence, Vendored ACE-Step 1.5 documentation

### Community 196 - "generationStore.ts"
Cohesion: 0.29
Nodes (7): Props, GenerationJob, GenStage, launch(), OtherLock, pollJob(), SetState

### Community 197 - "🟠 Correctness"
Cohesion: 0.29
Nodes (7): 10. Abort/persist race reverses an abort silently, 5. Dead controls presented as live, 6. Library search race, 7. Add Layer bounce: volume index misalignment, 8. Adapter reconcile race during ACE-Step splits, 9. Repaint crossfade only clamped in the UI handler, 🟠 Correctness

### Community 198 - "uvr-server"
Cohesion: 0.29
Nodes (6): Config (env vars), Endpoints, Run, Setup (native Windows), Tests, uvr-server

### Community 199 - "generationStore.test.ts"
Cohesion: 0.33
Nodes (5): activeGeneration, generate, generateWithEngine, jobStatus, params

### Community 200 - "Color tokens"
Cohesion: 0.33
Nodes (6): Acid — "what makes something happen?" (commit actions), Carbon — "the world" (structure), Color tokens, Lilac — "what did the AI make before?" (versions / history / AI markers), Rust — "what's wrong?" (errors / warnings / trash / destructive), Sky — "what am I pointing at?" (selection / scope)

### Community 201 - "YuE2 Melody Covers via SheetSage2 (planned 2026-09-30)"
Cohesion: 0.33
Nodes (6): Decisions, File-level plan, Open questions, Rollout, What SheetSage2 is, YuE2 Melody Covers via SheetSage2 (planned 2026-09-30)

### Community 203 - "🟡 Resource leaks / unbounded growth"
Cohesion: 0.40
Nodes (5): 11. Job registries never evict, 12. WebGL context leak in `ShaderCanvas`, 13. `generationStore.pollJob` has no cancellation, 14. Misc leaks, 🟡 Resource leaks / unbounded growth

### Community 204 - "config.py"
Cohesion: 0.67
Nodes (3): from_env(), Settings, read once from the environment., Settings

### Community 205 - "Upstream Sync: `complete`/`lego` Skip the LM (planned + implemented 2026-09-30)"
Cohesion: 0.50
Nodes (4): Decisions, File-level plan, Open questions, Upstream Sync: `complete`/`lego` Skip the LM (planned + implemented 2026-09-30)

### Community 206 - "UVR Separator: Roformer Vocals for SPLIT (planned + implemented 2026-09-30)"
Cohesion: 0.50
Nodes (4): Decisions, File-level plan (as built), Open questions, UVR Separator: Roformer Vocals for SPLIT (planned + implemented 2026-09-30)

### Community 207 - "COVER and ARRANGE Reference Audio: No Influence Sliders (planned + implemented 2026-09-30)"
Cohesion: 0.67
Nodes (3): COVER and ARRANGE Reference Audio: No Influence Sliders (planned + implemented 2026-09-30), Decisions, File-level plan

### Community 208 - "Text2music Reference Audio: Style Influence Only (planned + implemented 2026-09-30)"
Cohesion: 0.67
Nodes (3): Decisions, File-level plan, Text2music Reference Audio: Style Influence Only (planned + implemented 2026-09-30)

## Knowledge Gaps
- **665 isolated node(s):** `$schema`, `plugins`, `react/rules-of-hooks`, `react/only-export-components`, `name` (+660 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **77 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `JobStore` connect `JobStore` to `engine_api.py`, `worker.py`, `test_store_and_worker.py`, `main.py`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Why does `CreateArrangeTab()` connect `Red Lines (Never Do)` to `Voice Picker & Management`, `CreateView.tsx`, `FakeAudio`, `MoveToEditorAction.tsx`, `CreateView.tsx`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Why does `reextractStem()` connect `Playback Mix Engine` to `FakeAudio`, `Advanced Generation Settings`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **What connects `$schema`, `plugins`, `react/rules-of-hooks` to the rest of the system?**
  _711 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Backend Generation & Job Services` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `App Shell & Library UI` be split into smaller, more focused modules?**
  _Cohesion score 0.1225071225071225 - nodes in this community are weakly interconnected._
- **Should `Core Song/Layer/Version API` be split into smaller, more focused modules?**
  _Cohesion score 0.07706766917293233 - nodes in this community are weakly interconnected._