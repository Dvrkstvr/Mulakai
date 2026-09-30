# Graph Report - festive-yonath-b4b377  (2026-09-30)

## Corpus Check
- 301 files · ~202,044 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1999 nodes · 4158 edges · 214 communities (133 shown, 81 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 186 edges (avg confidence: 0.74)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ec848a72`
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
- test_api.py
- YuePipeline
- engineSettings.ts
- engineGenJobs.ts
- arrange
- registry.ts
- Multiple Song-Creation Engines (planned 2026-09-30)
- heartmula.ts
- yue2.ts
- run_job
- test_store_and_worker.py
- useEngineCaps.ts
- fit_to_ceiling
- Mulakai
- SongEngine
- yue-server
- engineGenJobs.test.ts
- abcMeta.ts
- README.md
- FORGE — LoRA/LoKr Training & Dataset Studio (planning doc, not yet implemented)
- heartmula-server
- generationStore.ts
- conftest.py
- main.py
- FakePipeline
- YuE2 Melody Covers via SheetSage2 (planned 2026-09-30)
- generationStore.test.ts
- LibraryToolbar.tsx
- Color tokens
- engineClient.test.ts
- AutoTextarea.tsx
- Motion
- ShaderCanvas.tsx
- config.py
- Upstream Sync: `complete`/`lego` Skip the LM (planned + implemented 2026-09-30)
- apiStatusStore.ts
- COVER and ARRANGE Reference Audio: No Influence Sliders (planned + implemented 2026-09-30)
- Text2music Reference Audio: Style Influence Only (planned + implemented 2026-09-30)
- YuE2: Align With Upstream's `yue2-music` Skill (planned 2026-09-30)
- README.md

## God Nodes (most connected - your core abstractions)
1. `Mulakai — Project Plan` - 42 edges
2. `api` - 36 edges
3. `useSettings` - 30 edges
4. `releaseGenLock()` - 25 edges
5. `useCreateDraftStore` - 23 edges
6. `acquireGenLock()` - 23 edges
7. `FakePipeline` - 23 edges
8. `JobStore` - 22 edges
9. `config` - 22 edges
10. `JobStore` - 22 edges

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

## Communities (214 total, 81 thin omitted)

### Community 0 - "Backend Generation & Job Services"
Cohesion: 0.20
Nodes (19): message(), syncWarning(), getModelGeneration(), loadLora(), loraStatus, setLoraScale(), unloadLora(), Adapter (+11 more)

### Community 1 - "Editor UI Components"
Cohesion: 0.13
Nodes (19): RefineResult, Props, RefineRail(), SongFields, Props, ResizeHandle(), Props, ScrollArea() (+11 more)

### Community 2 - "App Shell & Library UI"
Cohesion: 0.32
Nodes (6): CreateView(), ForgeStub(), Props, HeaderSlotContext, useHeaderSlot(), SettingsView()

### Community 3 - "Project Docs & Design Concepts"
Cohesion: 0.22
Nodes (9): AGENTS.md — Mulakai Development Rules, Code Style, Design System (mandatory for all UI work), Git Workflow, Module Size Policy, Red Lines, Scope Discipline, Spec-Driven Development (+1 more)

### Community 4 - "Core Song/Layer/Version API"
Cohesion: 0.07
Nodes (42): config, __dirname, db, app, adaptersRouter, foldersRouter, generateRouter, layersRouter (+34 more)

### Community 5 - "Lyrics & Export Panel"
Cohesion: 0.05
Nodes (39): 1. Reference Audio: Global Acoustic Feature Control, 2. Source Audio: Semantic Structure Control, 3. Source Audio Context-Based Control: Local Completion and Modification, 4. Base Model Advanced Audio Control Tasks, About Audio Control: Controlling Sound with Sound, About Caption: The Most Important Input, About Lyrics: The Temporal Script, About Music Metadata: Optional Fine Control (+31 more)

### Community 6 - "API Client & Create Flow"
Cohesion: 0.16
Nodes (16): buildTagGuide(), clean(), Cluster, clusterByKeyword(), clusterByPrefix(), clusterBySuffix(), finalizeClusters(), INSTRUMENT_BUCKETS (+8 more)

### Community 7 - "Server Package Config"
Cohesion: 0.07
Nodes (32): Engine, Generated, JobCancelled, What the job worker needs from an engine. Torch-free, so the API, the queue and, Raised inside a job when its cancel flag is seen., drop_kv_caches(), HeartMulaEngine, park() (+24 more)

### Community 8 - "Client Package Config"
Cohesion: 0.09
Nodes (38): BaseModel, Fraction, GenerateRequest, POST /v1/jobs body. Field names are heartlib's own, so Mulakai's engines/heartm, ValueError, GenerateRequest, yue2-serve's body, minus `n` (one take per job) and `abc` (score editing     is, AbcError (+30 more)

### Community 9 - "Voice Picker & Management"
Cohesion: 0.13
Nodes (21): LyricLine, SongDetail, Editor(), fmt(), Props, ExportPanel(), Props, LyricsBlock (+13 more)

### Community 10 - "Playback Mix Engine"
Cohesion: 0.08
Nodes (44): STEM_KINDS, upload, queryResult(), AudioFormat, BitDepth, clampDepth(), DEFAULT_OUTPUT, DEPTHS_BY_FORMAT (+36 more)

### Community 11 - "Client TSConfig (app)"
Cohesion: 0.10
Nodes (19): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+11 more)

### Community 12 - "Advanced Generation Settings"
Cohesion: 0.25
Nodes (33): audioFileExt(), downloadAudio(), releaseTask(), persistNewLayer(), startAddLayer(), startCompleteGeneration(), startCoverGeneration(), acquireGenLock() (+25 more)

### Community 13 - "AI Thinking & Create View"
Cohesion: 0.16
Nodes (17): main(), lyricTagsRouter, extractTags(), FreshTagEntry, getProbeState(), getStoredTags(), loadStore(), LyricTagRecord (+9 more)

### Community 14 - "Song Detail & Refine Rail"
Cohesion: 0.07
Nodes (27): 10. Abort/persist race reverses an abort silently, 11. Job registries never evict, 12. WebGL context leak in `ShaderCanvas`, 13. `generationStore.pollJob` has no cancellation, 14. Misc leaks, 15. UX inconsistencies, 16. Shader palette violation, 17. Server-side polish (+19 more)

### Community 15 - "Client TSConfig (node)"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 16 - "Add-Layer & Mix Bounce"
Cohesion: 0.23
Nodes (10): Dropzone(), Props, Props, ReferenceAudioPicker(), influenceHint(), pct(), ReferenceTaskType, showsStyleInfluence() (+2 more)

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
Cohesion: 0.33
Nodes (5): health(), Thin HTTP wrapper around Demucs (https://github.com/adefossez/demucs) so Mulakai, split(), Request, UploadFile

### Community 24 - "FileTags Test Suite"
Cohesion: 0.33
Nodes (5): createFromPath, fakeFile, fakeId3Tag, fakeTag, idSettings

### Community 25 - "Player & Mix Polish (Plan)"
Cohesion: 0.20
Nodes (10): App model — a flat set of top-level views, one page, Audio preview module (added 2026-07-29), Copy rules, Design language in one sentence, Interaction rhythm, Mulakai — Design System, Reference mockups, Shape grammar (+2 more)

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
Nodes (23): AnalyzeAudioButton(), Props, api, TaskType, CreateArrangeTab(), CreateAudioTab(), GenerateButton(), Props (+15 more)

### Community 49 - "SettingsPanel.tsx"
Cohesion: 0.19
Nodes (10): ApiError, StemKind, StemResult, ArrangeMethod, EditorJobState, Props, ScratchSplitPicker(), Props (+2 more)

### Community 50 - "Claude Commands"
Cohesion: 0.20
Nodes (9): 12.1 API Definition, 12.2 Response Example, 12. Health Check, 2. Response Format, 3. Task Status Description, ACE-Step API Client Documentation, Best Practices, Error Handling (+1 more)

### Community 58 - "FORGE — LoRA/LoKr Training & Dataset Studio (planning doc, not yet implemented)"
Cohesion: 0.11
Nodes (17): Exception, IdempotencyConflict, JobStore, QueueFull, In-memory job table and FIFO queue.  Snapshots mirror YuE2-Turbo's yue2-serve, Forget finished jobs older than the cutoff; returns their ids., Returns (snapshot, created). A repeated key with the same request is a, Block for the next queued job, mark it running, return (id, request). (+9 more)

### Community 59 - "4. Create Generation Task"
Cohesion: 0.25
Nodes (8): 4.1 API Definition, 4.2 Request Parameters, 4.3 Response Example, 4.4 Usage Examples (cURL), 4. Create Generation Task, Method A: JSON Request (application/json), Method B: File Upload (multipart/form-data), Parameter Naming Convention

### Community 60 - "lyricSections.ts"
Cohesion: 0.11
Nodes (22): BOOLEAN_FIELDS, GEN_FIELDS, labelOnlyReferenceMeta(), NUMERIC_FIELDS, pickMultipartParams(), pickParams(), upload, createRandomSample() (+14 more)

### Community 61 - "CreateView.tsx"
Cohesion: 0.21
Nodes (21): AddLayerDraft, useAddLayerDraft, AddLayerTrigger(), myEditorJob(), useEditorJobStore, GeneratingCard(), STAGE_LABEL, EDITOR_STAGE_LABEL (+13 more)

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
Cohesion: 0.06
Nodes (54): AdvancedGenSettings(), ForgeSection(), AudioFormat, BitDepth, clampDepth(), depthLabel(), DEPTHS_BY_FORMAT, FORMATS (+46 more)

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
Cohesion: 0.07
Nodes (26): author, dependencies, better-sqlite3, express, multer, node-taglib-sharp, description, devDependencies (+18 more)

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
Cohesion: 0.13
Nodes (25): EngineCapabilities, CreatePromptTab(), durationReadout(), Engine, GatedField, languageOptions(), liveLanguage(), pickerEngines() (+17 more)

### Community 134 - "settings.ts"
Cohesion: 0.14
Nodes (19): CarriedPromptNote(), MEANING, ClearDraftButton(), GEN_TYPE_LABEL, GenType, Source, ARRANGE, ArrangeSource (+11 more)

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
Cohesion: 0.38
Nodes (6): activeLayers(), DecodedLayer, LayerAudioInput, EngineLayerState, audibleStructureKey(), usePlaybackEngine()

### Community 139 - "Add Layer Lyrics (implemented 2026-07-08)"
Cohesion: 0.50
Nodes (4): Add Layer Lyrics (implemented 2026-07-08), Decisions, File-level plan, Model restriction (confirmed, no code change)

### Community 140 - "Universal Advanced Settings (Repaint + Add Layer) (implemented 2026-07-08)"
Cohesion: 0.67
Nodes (3): Decisions, File-level plan, Universal Advanced Settings (Repaint + Add Layer) (implemented 2026-07-08)

### Community 141 - "Create AUDIO/ARRANGE Flows — `cover` and `complete` (implemented 2026-07-07)"
Cohesion: 0.08
Nodes (24): dependencies, framer-motion, react, react-dom, zustand, devDependencies, oxlint, @types/node (+16 more)

### Community 142 - "backfillGenTask.test.ts"
Cohesion: 0.09
Nodes (27): Props, AIGeneratingBackground(), AIGeneratingBackgroundProps, useWaveVeil(), Layer, Version, jobStatus, repaint (+19 more)

### Community 143 - "api.ts"
Cohesion: 0.50
Nodes (4): Decisions, File-level plan, Import a Song (planned 2026-07-30), Open questions

### Community 145 - "Create Draft Persistence + Origin-Aware Reuse (planned 2026-07-30)"
Cohesion: 0.11
Nodes (11): IdempotencyConflict, JobStore, Path, QueueFull, In-memory job table and FIFO queue for yue-server.  The job record mirrors YuE, Drop finished jobs (and their artifacts) older than the retention window., Delete artifact directories left by a previous run (jobs are not persisted)., Returns (job, created). A repeated Idempotency-Key with the same body         r (+3 more)

### Community 146 - "FakeAudio"
Cohesion: 0.21
Nodes (5): createPreviewPlayback(), PreviewAudioElement, FakeAudio, make(), useMainTransportGuard()

### Community 148 - "MoveToEditorAction.tsx"
Cohesion: 0.16
Nodes (14): Voice, readDuration(), MoveToEditorAction(), Nav, NavigationContext, useNavigation(), ImportDraft, importFields() (+6 more)

### Community 149 - "AdaptersSection.tsx"
Cohesion: 0.24
Nodes (8): fmt(), Player(), Props, COLORS, PlayerWaveform(), Props, Props, VolumeSlider()

### Community 150 - "SettingsView.tsx"
Cohesion: 0.13
Nodes (23): Folder, FolderScope, Song, App(), View, CreateBar(), Props, createCoverDraft() (+15 more)

### Community 151 - "Waveform.tsx"
Cohesion: 0.18
Nodes (12): AudioPreview(), fmtTime(), Props, AudioPreviewPopover(), Props, PlaybackApi, PreviewPlayback, PreviewSnapshot (+4 more)

### Community 152 - "generationStore.ts"
Cohesion: 0.37
Nodes (9): ActiveAdapterNote(), AdapterAddForm(), AdaptersSection(), AdapterStrength(), activeAdapter(), adapterConsequence(), AdapterState, useAdapterStore (+1 more)

### Community 153 - "adapters.test.ts"
Cohesion: 0.11
Nodes (14): create_app(), Engine, FastAPI, Settings, Thin HTTP wrapper around HeartMuLa (https://github.com/HeartMuLa/heartlib) so M, test_classify(), classify(), Engine (+6 more)

### Community 154 - "inferenceSteps.ts"
Cohesion: 0.09
Nodes (27): analyzeAudio(), call(), Envelope, fetchWithTimeout(), formatInput(), FormatInputParams, FormatInputResult, initModel() (+19 more)

### Community 155 - "adapterStore.test.ts"
Cohesion: 0.21
Nodes (14): INFER_METHOD_OPTIONS, CustomSelect(), Props, aceOnlyNote(), COT_OPTIONS, EngineGenSettings(), SLIDERS, InfoTooltip() (+6 more)

### Community 156 - "apiStatusStore.ts"
Cohesion: 0.67
Nodes (3): useApiStatusStore, Header(), Props

### Community 158 - "voiceStore.test.ts"
Cohesion: 0.16
Nodes (15): editorApi, EngineControl, generationApi, appendParams(), json(), libraryApi, managementApi, AdapterList (+7 more)

### Community 159 - "Adapter Loading (LoRA/LoKr) at Inference (planned 2026-07-31)"
Cohesion: 0.33
Nodes (6): Adapter Loading (LoRA/LoKr) at Inference (planned 2026-07-31), Decisions, File-level plan, Open questions, Rollout, Verified against ACE-Step source, 2026-07-31

### Community 160 - "adapters.test.ts"
Cohesion: 0.33
Nodes (4): loadLora, loraStatus, setLoraScale, unloadLora

### Community 161 - "SectionStrip.tsx"
Cohesion: 0.14
Nodes (11): remasterRouter, upload, songLayersRouter, upload, EngineId, GenKind, GenLockError, GenLockInfo (+3 more)

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
Cohesion: 0.29
Nodes (5): deleteAdapter, listAdapters, registerAdapter, setActiveAdapter, setAdapterScale

### Community 169 - "waveformPeaks.ts"
Cohesion: 0.38
Nodes (3): createPeaksLoader(), loader, PeaksDecoder

### Community 171 - "ExportPanel.tsx"
Cohesion: 0.20
Nodes (19): make_client(), A fake of the yue_pipeline.YuePipeline adapter, so tests run without torch, yue, wait_for(), wait_terminal(), test_admission_id_header_is_recorded(), test_bearer_key_guards_jobs_but_not_health(), test_cot_off_has_no_score(), test_empty_lyrics_are_accepted() (+11 more)

### Community 173 - "test_api.py"
Cohesion: 0.26
Nodes (16): FakeEngine, Stands in for HeartMulaEngine: no torch, no GPU. `gate` lets a test hold     a, make_client(), test_a_value_naming_a_file_is_refused(), test_bearer_key_is_enforced_only_when_set(), test_cancel_while_running(), test_failures_carry_a_code_and_message(), test_happy_path_returns_a_flac_within_full_scale() (+8 more)

### Community 174 - "YuePipeline"
Cohesion: 0.13
Nodes (7): Settings, Adapter over the official YuE2 pipeline (`yue2-infer`, installed into this venv, Forwards to the pipeline's stage reporter and mirrors update() calls., Move weights to system RAM and hand the cached VRAM back., _StageTap, _tapped(), YuePipeline

### Community 175 - "engineSettings.ts"
Cohesion: 0.16
Nodes (16): enginePromptParams(), PromptIntent, DRAFT, HEARTMULA, SEED, YUE2, AUTO_CONTROLS, ControlRange (+8 more)

### Community 176 - "engineGenJobs.ts"
Cohesion: 0.38
Nodes (14): cancel(), EngineTarget, errorMessage(), failure(), fetchAudio(), fetchScore(), headers(), health() (+6 more)

### Community 177 - "arrange"
Cohesion: 0.23
Nodes (14): arrange(), is_instrumental(), Upstream's instrumental workflow (PLAN.md "YuE2: Align With Upstream's `yue2-mu, Upstream's rule: lyrics that are only section tags. Empty lyrics don't     coun, `% pre-chorus` → `[Pre-Chorus]`, as upstream's `lyric_tags` writes them., Returns (plan, request, record) to generate from. record is None when the     r, section_tags(), noop() (+6 more)

### Community 178 - "registry.ts"
Cohesion: 0.20
Nodes (12): COT_VALUES, enginesRouter, NUMBER_FIELDS, pickCreateFields(), STRING_FIELDS, ACESTEP_CAPABILITIES, EngineInfo, EXTRA_ENGINES (+4 more)

### Community 179 - "Multiple Song-Creation Engines (planned 2026-09-30)"
Cohesion: 0.14
Nodes (14): Engine: HeartMuLa (ships second), Engine picker UI decisions (2026-09-30, `feat/engine-picker-ui`), Engine: YuE2 (ships first), File-level plan, Framework decisions (2026-09-30, `feat/engine-framework`), General engine design (decided once, shared by every engine), heartmula-server decisions (2026-09-30), HeartMuLa spike results (2026-09-30) (+6 more)

### Community 180 - "heartmula.ts"
Cohesion: 0.22
Nodes (12): captionToTags(), CFG, clamp(), heartmula, HEARTMULA_CAPABILITIES, isSet(), MAX_LENGTH_MS, NO_META (+4 more)

### Community 181 - "yue2.ts"
Cohesion: 0.22
Nodes (10): buildYue2Request(), chooseSeed(), INSTRUMENTAL_CONDITIONS, instrumentalStyle(), LANGUAGE_NAMES, METER_TEXT, meterText(), styleHints() (+2 more)

### Community 182 - "run_job"
Cohesion: 0.19
Nodes (9): test_the_job_saves_the_converted_score_the_planned_one_and_the_record(), test_progress_is_a_per_stage_fraction(), _error(), Exception, JobStore, The single inference thread: loads the pipeline once, then runs queued jobs one, run_job(), _save() (+1 more)

### Community 183 - "test_store_and_worker.py"
Cohesion: 0.23
Nodes (8): _flag(), Environment configuration for yue-server. Every knob is optional; the defaults, Settings, Clock, test_idempotency_keys_expire_with_their_job(), test_settings_defaults_match_the_spike(), test_settings_read_the_environment(), test_sweep_drops_expired_jobs_and_their_artifacts()

### Community 184 - "useEngineCaps.ts"
Cohesion: 0.35
Nodes (9): EngineId, EngineInfo, ENGINE_NOTES, EnginesSection(), status(), EngineState, extraEngine(), useEngineStore (+1 more)

### Community 185 - "fit_to_ceiling"
Cohesion: 0.26
Nodes (10): fit_to_ceiling(), Path, Write the engine's float audio as a lossless FLAC master.  HeartMuLa's float p, Return (audio, gain_db). Only ever turns down, never up., write_flac(), test_audio_within_the_ceiling_is_untouched(), test_non_finite_samples_are_rejected(), test_over_full_scale_is_turned_down_to_the_ceiling() (+2 more)

### Community 186 - "Mulakai"
Cohesion: 0.17
Nodes (12): Configuration, Design, Development, Licence, Mulakai, Repository layout, Requirements, Running it (+4 more)

### Community 187 - "SongEngine"
Cohesion: 0.17
Nodes (6): offline, start, yue, acestepHealth, engineHealth, SongEngine

### Community 188 - "yue-server"
Cohesion: 0.17
Nodes (12): 1. WSL2 + Ubuntu 24.04, 2. The venv (inside WSL), 3. `yue2 doctor` and the weights, 4. Start the server, API, Config (env vars, all optional), If Ubuntu's first-run user setup hangs, Instrumentals (+4 more)

### Community 189 - "engineGenJobs.test.ts"
Cohesion: 0.18
Nodes (7): EngineJobState, client, DONE, engine, fields, readMeta, RUNNING

### Community 190 - "abcMeta.ts"
Cohesion: 0.38
Nodes (9): headerFields(), MAJOR, METERS, MINOR, MODES, parseKey(), parseMeter(), parseTempo() (+1 more)

### Community 191 - "README.md"
Cohesion: 0.22
Nodes (3): Keeping them current, Licence, Vendored ACE-Step 1.5 documentation

### Community 192 - "FORGE — LoRA/LoKr Training & Dataset Studio (planning doc, not yet implemented)"
Cohesion: 0.22
Nodes (8): Data model, Decisions locked in (from discussion, 2026-07-04), FORGE — LoRA/LoKr Training & Dataset Studio (planning doc, not yet implemented), Open questions for `/opsx:explore` when this starts, Phased plan, What ACE-Step 1.5 already gives us (verified 2026-07-04, native REST — no Gradio), What ace-step-ui-main's training UI is worth borrowing (checked 2026-07-04), Why this exists, and why it's separate

### Community 193 - "heartmula-server"
Cohesion: 0.22
Nodes (8): API, Config (env vars), GPU: one model at a time (read this), heartmula-server, Run, Setup (native Windows), Tests, WSL2 fallback

### Community 194 - "generationStore.ts"
Cohesion: 0.29
Nodes (7): Props, GenerationJob, GenStage, launch(), OtherLock, pollJob(), SetState

### Community 195 - "conftest.py"
Cohesion: 0.29
Nodes (6): lyrics(), RuntimeError, OutOfMemoryError, Stands in for torch.OutOfMemoryError, which the worker matches by name., test_queue_full_is_429(), test_worker_keeps_serving_after_a_failure()

### Community 196 - "main.py"
Cohesion: 0.36
Nodes (6): create_app(), main(), FastAPI, Settings, Thin HTTP wrapper around the official YuE2 pipeline (https://github.com/multimo, The POST /v1/jobs body, validated before anything reaches the pipeline.

### Community 198 - "YuE2 Melody Covers via SheetSage2 (planned 2026-09-30)"
Cohesion: 0.29
Nodes (7): Decisions, File-level plan, Open questions, Rollout, Upstream skill-doc review (2026-09-30), What SheetSage2 is, YuE2 Melody Covers via SheetSage2 (planned 2026-09-30)

### Community 199 - "generationStore.test.ts"
Cohesion: 0.33
Nodes (5): activeGeneration, generate, generateWithEngine, jobStatus, params

### Community 200 - "LibraryToolbar.tsx"
Cohesion: 0.33
Nodes (5): LibraryFilter, LibrarySort, LibraryToolbar(), Props, SORT_OPTIONS

### Community 201 - "Color tokens"
Cohesion: 0.33
Nodes (6): Acid — "what makes something happen?" (commit actions), Carbon — "the world" (structure), Color tokens, Lilac — "what did the AI make before?" (versions / history / AI markers), Rust — "what's wrong?" (errors / warnings / trash / destructive), Sky — "what am I pointing at?" (selection / scope)

### Community 203 - "AutoTextarea.tsx"
Cohesion: 0.50
Nodes (3): AutoTextarea(), Props, Props

### Community 204 - "Motion"
Cohesion: 0.40
Nodes (5): AI states — the one exception to "one hue, one job", Interactive feedback, Motion, Persistent header, View transitions

### Community 205 - "ShaderCanvas.tsx"
Cohesion: 0.83
Nodes (3): compile(), createProgram(), ShaderCanvas()

### Community 206 - "config.py"
Cohesion: 0.67
Nodes (3): from_env(), Settings, read once from the environment., Settings

### Community 207 - "Upstream Sync: `complete`/`lego` Skip the LM (planned + implemented 2026-09-30)"
Cohesion: 0.50
Nodes (4): Decisions, File-level plan, Open questions, Upstream Sync: `complete`/`lego` Skip the LM (planned + implemented 2026-09-30)

### Community 209 - "COVER and ARRANGE Reference Audio: No Influence Sliders (planned + implemented 2026-09-30)"
Cohesion: 0.67
Nodes (3): COVER and ARRANGE Reference Audio: No Influence Sliders (planned + implemented 2026-09-30), Decisions, File-level plan

### Community 210 - "Text2music Reference Audio: Style Influence Only (planned + implemented 2026-09-30)"
Cohesion: 0.67
Nodes (3): Decisions, File-level plan, Text2music Reference Audio: Style Influence Only (planned + implemented 2026-09-30)

### Community 211 - "YuE2: Align With Upstream's `yue2-music` Skill (planned 2026-09-30)"
Cohesion: 0.67
Nodes (3): Decisions, File-level plan, YuE2: Align With Upstream's `yue2-music` Skill (planned 2026-09-30)

## Knowledge Gaps
- **663 isolated node(s):** `$schema`, `plugins`, `react/rules-of-hooks`, `react/only-export-components`, `name` (+658 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **81 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AddLayerTrigger()` connect `CreateView.tsx` to `FakeAudio`, `conftest.py`, `settings.ts`, `AIGeneratingBackground.tsx`, `backfillGenTask.test.ts`, `Red Lines (Never Do)`, `MoveToEditorAction.tsx`?**
  _High betweenness centrality (0.124) - this node is a cross-community bridge._
- **Why does `lyrics()` connect `conftest.py` to `CreateView.tsx`?**
  _High betweenness centrality (0.123) - this node is a cross-community bridge._
- **Why does `reextractStem()` connect `Playback Mix Engine` to `FakeAudio`, `Advanced Generation Settings`?**
  _High betweenness centrality (0.080) - this node is a cross-community bridge._
- **What connects `$schema`, `plugins`, `react/rules-of-hooks` to the rest of the system?**
  _708 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Editor UI Components` be split into smaller, more focused modules?**
  _Cohesion score 0.13230769230769232 - nodes in this community are weakly interconnected._
- **Should `Core Song/Layer/Version API` be split into smaller, more focused modules?**
  _Cohesion score 0.07350608143839238 - nodes in this community are weakly interconnected._
- **Should `Lyrics & Export Panel` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._