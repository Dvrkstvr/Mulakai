# Graph Report - .  (2026-07-08)

## Corpus Check
- 156 files · ~80,075 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 751 nodes · 1740 edges · 58 communities (36 shown, 22 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 17 edges (avg confidence: 0.79)
- Token cost: 231,822 input · 0 output

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
- Testing Rules
- Claude Commands
- Favicon Brand Icon
- Format-Input API Endpoint
- Models List API Endpoint

## God Nodes (most connected - your core abstractions)
1. `api` - 26 edges
2. `useSettings` - 24 edges
3. `releaseGenLock()` - 23 edges
4. `acquireGenLock()` - 21 edges
5. `useGenerationStore` - 19 edges
6. `compilerOptions` - 18 edges
7. `releaseTask()` - 18 edges
8. `useVoiceStore` - 17 edges
9. `ensureModelLoaded()` - 17 edges
10. `PlaybackEngine` - 16 edges

## Surprising Connections (you probably didn't know these)
- `ACE-Step Dataset API surface` --references--> `Training API (/v1/training/start, /start_lokr)`  [AMBIGUOUS]
  FORGE_PLAN.md → docs/ace-step-1.5/API.md
- `Design System Mandate` --references--> `Color Tokens (one hue, one job)`  [EXTRACTED]
  AGENTS.md → docs/design/DESIGN.md
- `React + TypeScript + Vite template` --conceptually_related_to--> `Mulakai Tech Stack`  [INFERRED]
  client/README.md → CLAUDE.md
- `Reference Projects (do not modify)` --conceptually_related_to--> `ACE-Step Integration (native FastAPI)`  [INFERRED]
  CLAUDE.md → PLAN.md
- `ACE-Step Adapter (LoRA) API surface` --conceptually_related_to--> `POST /v1/init (model lifecycle)`  [INFERRED]
  FORGE_PLAN.md → docs/ace-step-1.5/API.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **ACE-Step task-type system (spec + guide + Mulakai mapping)** — plan_task_type_mapping, docs_ace_step_1_5_guide_lego_task, docs_ace_step_1_5_guide_source_audio_repaint, docs_ace_step_1_5_guide_complete_task, docs_ace_step_1_5_api_release_task [INFERRED 0.85]
- **One-hue-one-job semantic color system** — docs_design_design_acid, docs_design_design_sky, docs_design_design_lilac, docs_design_design_rust [EXTRACTED 1.00]
- **FORGE feature-gated-hidden-by-default pattern** — forge_plan_forge, plan_settings_screen, agents_code_style [INFERRED 0.85]

## Communities (58 total, 22 thin omitted)

### Community 0 - "Backend Generation & Job Services"
Cohesion: 0.06
Nodes (102): GEN_FIELDS, NUMERIC_FIELDS, pickMultipartParams(), pickParams(), upload, upload, upload, splitRouter (+94 more)

### Community 1 - "Editor UI Components"
Cohesion: 0.05
Nodes (61): Props, Layer, StemResult, AddLayerJob, EditorJob, EditorJobState, errMsg(), JobBase (+53 more)

### Community 2 - "App Shell & Library UI"
Cohesion: 0.06
Nodes (37): ActiveGeneration, OutputMetadata, ApiStatusState, useApiStatusStore, App(), View, createCoverDraft(), reusePromptDraft() (+29 more)

### Community 3 - "Project Docs & Design Concepts"
Cohesion: 0.05
Nodes (46): Code Style & Feature Gating, Design System Mandate, Module Size Policy, Reference Projects (do not modify), Demucs (stem separation model), demucs-server (HTTP wrapper), demucs-server Python dependencies, POST /query_result (+38 more)

### Community 4 - "Core Song/Layer/Version API"
Cohesion: 0.10
Nodes (29): config, __dirname, db, app, generateRouter, layersRouter, outputMetadataRouter, remasterRouter (+21 more)

### Community 5 - "Lyrics & Export Panel"
Cohesion: 0.11
Nodes (24): LyricLine, SongDetail, Editor(), fmt(), Props, ExportPanel(), Props, LyricsBlock (+16 more)

### Community 6 - "API Client & Create Flow"
Cohesion: 0.12
Nodes (21): api, ApiError, ModelInfo, Song, StemKind, TaskType, Version, ArrangeSource (+13 more)

### Community 7 - "Server Package Config"
Cohesion: 0.08
Nodes (25): author, dependencies, better-sqlite3, express, multer, node-taglib-sharp, description, devDependencies (+17 more)

### Community 8 - "Client Package Config"
Cohesion: 0.08
Nodes (24): dependencies, framer-motion, react, react-dom, zustand, devDependencies, oxlint, @types/node (+16 more)

### Community 9 - "Voice Picker & Management"
Cohesion: 0.16
Nodes (16): Voice, CustomSelect(), Props, InfoTooltip(), useNavigation(), Props, ReferenceAudioPicker(), RefMode (+8 more)

### Community 10 - "Playback Mix Engine"
Cohesion: 0.16
Nodes (6): DecodedLayer, LayerAudioInput, EngineLayerState, PlaybackEngine, audibleStructureKey(), usePlaybackEngine()

### Community 11 - "Client TSConfig (app)"
Cohesion: 0.10
Nodes (19): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+11 more)

### Community 12 - "Advanced Generation Settings"
Cohesion: 0.22
Nodes (13): AdvancedGenSettings(), INFER_METHOD_OPTIONS, ModelInventory, ditModelDescription(), guidanceEffective(), lmModelDescription(), stepsMax(), ModelsSection() (+5 more)

### Community 13 - "AI Thinking & Create View"
Cohesion: 0.19
Nodes (13): AIGeneratingBackground(), RefineResult, AutoTextarea(), Props, CreateArrangeTab(), CreateView(), genParams(), Props (+5 more)

### Community 14 - "Song Detail & Refine Rail"
Cohesion: 0.20
Nodes (13): Props, RefineRail(), SongFields, fmtDuration(), Props, SongDetailRail(), AUTO_OPTION, KNOWN_TIME_SIGNATURES (+5 more)

### Community 15 - "Client TSConfig (node)"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 16 - "Add-Layer & Mix Bounce"
Cohesion: 0.42
Nodes (11): AddLayerTrigger(), CreateAudioTab(), myEditorJob(), useGenerationStore, activeLayers(), bounceMix(), encodeWav(), decodeLayers() (+3 more)

### Community 17 - "Settings Store"
Cohesion: 0.21
Nodes (10): FORMAT_OPTIONS, PlaybackExportSection(), AddLayerSettings, AudioFormat, ExportSettings, GenSettings, mergeSettings(), RepaintSettings (+2 more)

### Community 18 - "Server TSConfig"
Cohesion: 0.15
Nodes (12): compilerOptions, esModuleInterop, module, moduleResolution, outDir, rootDir, skipLibCheck, strict (+4 more)

### Community 19 - "Icon Sprite Assets"
Cohesion: 0.48
Nodes (7): Bluesky Icon (butterfly logo, social link), Discord Icon (game controller/mask logo, social link), Documentation Icon (book with folded corner, docs link), GitHub Icon (Octocat cat logo, source-code link), Social Icon (person silhouette with star badge, community link), icons.svg Sprite Sheet, X (Twitter) Icon (stylized X logo, social link)

### Community 20 - "Core Domain Entities (Plan)"
Cohesion: 0.33
Nodes (6): Scope Discipline, The Editing Model (layer stack), Grand Goal (slim single-song AI editor), Layer entity, Song entity, Version entity

### Community 21 - "Tech Stack & Structure Docs"
Cohesion: 0.33
Nodes (6): Project Structure, Mulakai Tech Stack, Mulakai client entry (index.html), React + TypeScript + Vite template, Mulakai Architecture (client/server layout), Playback Engine (Web Audio/Tone.js)

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
Cohesion: 0.40
Nodes (5): Shape Grammar (parallelogram/hexagon/diamond), Custom Player Controls, Layer Stack Polish + Live Multi-Layer Playback, mix/playbackEngine.ts, client/src/Player.tsx

## Ambiguous Edges - Review These
- `ACE-Step Dataset API surface` → `Training API (/v1/training/start, /start_lokr)`  [AMBIGUOUS]
  FORGE_PLAN.md · relation: references

## Knowledge Gaps
- **235 isolated node(s):** `$schema`, `plugins`, `react/rules-of-hooks`, `react/only-export-components`, `name` (+230 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **22 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `ACE-Step Dataset API surface` and `Training API (/v1/training/start, /start_lokr)`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **Why does `api` connect `API Client & Create Flow` to `Editor UI Components`, `App Shell & Library UI`, `Lyrics & Export Panel`, `Voice Picker & Management`, `Advanced Generation Settings`, `AI Thinking & Create View`, `Song Detail & Refine Rail`, `Add-Layer & Mix Bounce`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **Why does `useSettings` connect `Settings Store` to `App Shell & Library UI`, `Lyrics & Export Panel`, `API Client & Create Flow`, `Advanced Generation Settings`, `AI Thinking & Create View`, `Add-Layer & Mix Bounce`?**
  _High betweenness centrality (0.008) - this node is a cross-community bridge._
- **What connects `$schema`, `plugins`, `react/rules-of-hooks` to the rest of the system?**
  _241 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Backend Generation & Job Services` be split into smaller, more focused modules?**
  _Cohesion score 0.05619834710743802 - nodes in this community are weakly interconnected._
- **Should `Editor UI Components` be split into smaller, more focused modules?**
  _Cohesion score 0.05063291139240506 - nodes in this community are weakly interconnected._
- **Should `App Shell & Library UI` be split into smaller, more focused modules?**
  _Cohesion score 0.06219426974143955 - nodes in this community are weakly interconnected._