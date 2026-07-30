# Graph Report - Mulakai  (2026-07-30)

## Corpus Check
- 201 files · ~123,478 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1220 nodes · 2497 edges · 146 communities (70 shown, 76 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 18 edges (avg confidence: 0.76)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c5c7ec1c`
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

## God Nodes (most connected - your core abstractions)
1. `api` - 33 edges
2. `Mulakai — Project Plan` - 32 edges
3. `useSettings` - 28 edges
4. `releaseGenLock()` - 23 edges
5. `useGenerationStore` - 21 edges
6. `useVoiceStore` - 21 edges
7. `acquireGenLock()` - 21 edges
8. `AddLayerTrigger()` - 18 edges
9. `compilerOptions` - 18 edges
10. `config` - 18 edges

## Surprising Connections (you probably didn't know these)
- `useAnalyzeSourceAudio()` --indirect_call--> `result()`  [INFERRED]
  client/src/useAnalyzeSourceAudio.ts → server/src/services/lyricTimestamps.test.ts
- `Props` --references--> `Layer`  [EXTRACTED]
  client/src/AddLayerTrigger.tsx → client/src/api.ts
- `AddLayerTrigger()` --calls--> `useAddLayerDraft`  [EXTRACTED]
  client/src/AddLayerTrigger.tsx → client/src/addLayerStore.ts
- `AddLayerTrigger()` --calls--> `addLayerParams()`  [EXTRACTED]
  client/src/AddLayerTrigger.tsx → client/src/settings.ts
- `AddLayerTrigger()` --calls--> `useVoiceStore`  [EXTRACTED]
  client/src/AddLayerTrigger.tsx → client/src/voiceStore.ts

## Import Cycles
- None detected.

## Communities (146 total, 76 thin omitted)

### Community 0 - "Backend Generation & Job Services"
Cohesion: 0.12
Nodes (20): analyzeAudio(), call(), Envelope, formatInput(), FormatInputParams, FormatInputResult, health(), initModel() (+12 more)

### Community 1 - "Editor UI Components"
Cohesion: 0.15
Nodes (17): Voice, Dropzone(), Props, PromptGenerateRow(), Props, ReferenceAudioPicker(), genParams(), SongOutputTags() (+9 more)

### Community 2 - "App Shell & Library UI"
Cohesion: 0.07
Nodes (39): Folder, FolderScope, Song, App(), View, CreateBar(), Props, createCoverDraft() (+31 more)

### Community 3 - "Project Docs & Design Concepts"
Cohesion: 0.20
Nodes (9): AGENTS.md — Mulakai Development Rules, Code Style, Design System (mandatory for all UI work), Git Workflow, Module Size Policy, Red Lines, Scope Discipline, Spec-Driven Development (+1 more)

### Community 4 - "Core Song/Layer/Version API"
Cohesion: 0.11
Nodes (22): config, __dirname, db, app, foldersRouter, generateRouter, layersRouter, ALLOWED_EXTS (+14 more)

### Community 5 - "Lyrics & Export Panel"
Cohesion: 0.05
Nodes (39): 1. Reference Audio: Global Acoustic Feature Control, 2. Source Audio: Semantic Structure Control, 3. Source Audio Context-Based Control: Local Completion and Modification, 4. Base Model Advanced Audio Control Tasks, About Audio Control: Controlling Sound with Sound, About Caption: The Most Important Input, About Lyrics: The Temporal Script, About Music Metadata: Optional Fine Control (+31 more)

### Community 6 - "API Client & Create Flow"
Cohesion: 0.07
Nodes (38): ActiveGeneration, api, LyricTag, LyricTagProbeStatus, ModelInfo, ModelInventory, OutputMetadata, TaskType (+30 more)

### Community 7 - "Server Package Config"
Cohesion: 0.07
Nodes (26): author, dependencies, better-sqlite3, express, multer, node-taglib-sharp, description, devDependencies (+18 more)

### Community 8 - "Client Package Config"
Cohesion: 0.08
Nodes (24): dependencies, framer-motion, react, react-dom, zustand, devDependencies, oxlint, @types/node (+16 more)

### Community 9 - "Voice Picker & Management"
Cohesion: 0.18
Nodes (15): RefineResult, Props, RefineRail(), SongFields, AUTO_OPTION, KNOWN_TIME_SIGNATURES, KNOWN_VOCAL_LANGUAGES, TIME_SIGNATURES (+7 more)

### Community 10 - "Playback Mix Engine"
Cohesion: 0.11
Nodes (30): splitRouter, STEM_KINDS, upload, listModels(), queryResult(), discardScratchSplit(), getScratchSplitJob(), jobs (+22 more)

### Community 11 - "Client TSConfig (app)"
Cohesion: 0.10
Nodes (19): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+11 more)

### Community 12 - "Advanced Generation Settings"
Cohesion: 0.25
Nodes (31): audioFileExt(), downloadAudio(), releaseTask(), ReleaseTaskParams, persistNewLayer(), startAddLayer(), startCompleteGeneration(), startCoverGeneration() (+23 more)

### Community 13 - "AI Thinking & Create View"
Cohesion: 0.16
Nodes (17): main(), lyricTagsRouter, extractTags(), FreshTagEntry, getProbeState(), getStoredTags(), loadStore(), LyricTagRecord (+9 more)

### Community 14 - "Song Detail & Refine Rail"
Cohesion: 0.10
Nodes (20): 10. `TaskType` unions differ client vs server, 11. Module-size policy stated but widely exceeded, 12. "Storage" stat counts everything in `audioDir`, 13. Probe failure loop has no backoff, 14. Popover position computed once, ignores scroll/resize, 1. Server binds to all interfaces, not localhost — with no auth, 2. Add Layer silently ignores a user-pinned seed, 3. Boolean form fields decoded with `Boolean(string)` (+12 more)

### Community 15 - "Client TSConfig (node)"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 16 - "Add-Layer & Mix Bounce"
Cohesion: 0.22
Nodes (12): outputMetadataRouter, isWavFooterVersionError(), retagSong(), SongRow, SongTagFields, tagOutputFile(), toTagFields(), writeTagsAtVersion() (+4 more)

### Community 18 - "Server TSConfig"
Cohesion: 0.15
Nodes (12): compilerOptions, esModuleInterop, module, moduleResolution, outDir, rootDir, skipLibCheck, strict (+4 more)

### Community 19 - "Icon Sprite Assets"
Cohesion: 0.48
Nodes (7): Bluesky Icon (butterfly logo, social link), Discord Icon (game controller/mask logo, social link), Documentation Icon (book with folded corner, docs link), GitHub Icon (Octocat cat logo, source-code link), Social Icon (person silhouette with star badge, community link), icons.svg Sprite Sheet, X (Twitter) Icon (stylized X logo, social link)

### Community 20 - "Core Domain Entities (Plan)"
Cohesion: 0.08
Nodes (24): ACE-Step Integration (verified against docs/en/API.md + INFERENCE.md, 2026-07-02), Add Layer: Forced batch_size 1 + Track-Type Picker (implemented 2026-07-10), Architecture, Custom Player Controls (planned 2026-07-02, then implemented), Decisions Locked In, Grand Goal, Layer Stack Polish + Live Multi-Layer Playback (planned 2026-07-02), Lyric Tag Vocabulary Probe (implemented 2026-07-08) (+16 more)

### Community 21 - "Tech Stack & Structure Docs"
Cohesion: 0.22
Nodes (8): Commands, Design System, graphify, Mulakai — Agent Instructions, Project Structure, Reference Projects (do not modify), Spec-Driven Development, Tech Stack

### Community 22 - "Client Lint Config"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 23 - "Demucs Stem-Split Server"
Cohesion: 0.33
Nodes (4): Thin HTTP wrapper around Demucs (https://github.com/adefossez/demucs) so Mulakai, split(), Request, UploadFile

### Community 24 - "FileTags Test Suite"
Cohesion: 0.33
Nodes (5): createFromPath, fakeFile, fakeId3Tag, fakeTag, idSettings

### Community 25 - "Player & Mix Polish (Plan)"
Cohesion: 0.09
Nodes (21): Acid — "what makes something happen?" (commit actions), AI states — the one exception to "one hue, one job", App model — a flat set of top-level views, one page, Audio preview module (added 2026-07-29), Carbon — "the world" (structure), Color tokens, Copy rules, Design language in one sentence (+13 more)

### Community 39 - "Human-Centered Design Philosophy"
Cohesion: 0.05
Nodes (39): 1. Reference Audio: Global Acoustic Feature Control, 2. Source Audio: Semantic Structure Control, 3. Source Audio Context-Based Control: Local Completion and Modification, 4. Base Model Advanced Audio Control Tasks, About Audio Control: Controlling Sound with Sound, About Caption: The Most Important Input, About Lyrics: The Temporal Script, About Music Metadata: Optional Fine Control (+31 more)

### Community 47 - "Git Workflow Rules"
Cohesion: 0.05
Nodes (43): ApiError, StemKind, StemResult, AudioPreview(), fmtTime(), Props, AudioPreviewPopover(), Props (+35 more)

### Community 48 - "Red Lines (Never Do)"
Cohesion: 0.14
Nodes (19): AnalyzeAudioButton(), Props, AutoTextarea(), Props, CarriedPromptNote(), MEANING, CreateArrangeTab(), GenerateButton() (+11 more)

### Community 49 - "SettingsPanel.tsx"
Cohesion: 0.17
Nodes (14): ClearDraftButton(), GenType, Source, ARRANGE, ArrangeSource, AudioMethod, CreateDraftState, INTENT (+6 more)

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
Cohesion: 0.14
Nodes (16): GEN_FIELDS, labelOnlyReferenceMeta(), NUMERIC_FIELDS, pickMultipartParams(), pickParams(), upload, createRandomSample(), createSampleFromQuery() (+8 more)

### Community 61 - "CreateView.tsx"
Cohesion: 0.05
Nodes (82): AddLayerTrigger(), Props, Layer, LyricLine, SongDetail, Version, CreateAudioTab(), CreateView() (+74 more)

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
Cohesion: 0.18
Nodes (12): addLayerParams(), AddLayerSettings, AdvancedSettings, AudioFormat, ditAdvancedParams(), ExportSettings, GenSettings, lmAdvancedParams() (+4 more)

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
Cohesion: 0.20
Nodes (11): remasterRouter, upload, GenKind, GenLockError, GenLockInfo, GenTask, getGenLock(), getActiveGeneration() (+3 more)

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
Cohesion: 0.24
Nodes (9): CreatePromptTab(), Props, SongDetailsFields(), Props, ThinkingWipe(), AiEnhanceBadge(), typewrite(), ThinkingPhase (+1 more)

### Community 134 - "settings.ts"
Cohesion: 0.15
Nodes (20): AddLayerDraft, useAddLayerDraft, AdvancedGenSettings(), INFER_METHOD_OPTIONS, CustomSelect(), Props, InfoTooltip(), ditModelDescription() (+12 more)

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
Cohesion: 0.39
Nodes (6): AIGeneratingBackground(), AIGeneratingBackgroundProps, useWaveVeil(), compile(), createProgram(), ShaderCanvas()

### Community 139 - "Add Layer Lyrics (implemented 2026-07-08)"
Cohesion: 0.50
Nodes (4): Add Layer Lyrics (implemented 2026-07-08), Decisions, File-level plan, Model restriction (confirmed, no code change)

### Community 140 - "Universal Advanced Settings (Repaint + Add Layer) (implemented 2026-07-08)"
Cohesion: 0.67
Nodes (3): Decisions, File-level plan, Universal Advanced Settings (Repaint + Add Layer) (implemented 2026-07-08)

### Community 143 - "api.ts"
Cohesion: 0.50
Nodes (4): Decisions, File-level plan, Import a Song (planned 2026-07-30), Open questions

## Knowledge Gaps
- **506 isolated node(s):** `$schema`, `plugins`, `react/rules-of-hooks`, `react/only-export-components`, `name` (+501 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **76 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `reextractStem()` connect `Playback Mix Engine` to `Advanced Generation Settings`, `Git Workflow Rules`?**
  _High betweenness centrality (0.092) - this node is a cross-community bridge._
- **Why does `CreateArrangeTab()` connect `Red Lines (Never Do)` to `SettingsPanel.tsx`, `CreateView.tsx`, `Editor UI Components`, `Git Workflow Rules`?**
  _High betweenness centrality (0.090) - this node is a cross-community bridge._
- **Why does `useAnalyzeSourceAudio()` connect `Red Lines (Never Do)` to `Advanced Generation Settings`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._
- **What connects `$schema`, `plugins`, `react/rules-of-hooks` to the rest of the system?**
  _509 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Backend Generation & Job Services` be split into smaller, more focused modules?**
  _Cohesion score 0.11688311688311688 - nodes in this community are weakly interconnected._
- **Should `App Shell & Library UI` be split into smaller, more focused modules?**
  _Cohesion score 0.06829573934837092 - nodes in this community are weakly interconnected._
- **Should `Core Song/Layer/Version API` be split into smaller, more focused modules?**
  _Cohesion score 0.11379800853485064 - nodes in this community are weakly interconnected._