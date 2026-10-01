# Graph Report - distracted-ishizaka-a19a35  (2026-10-02)

## Corpus Check
- 378 files · ~255,471 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2583 nodes · 5386 edges · 273 communities (160 shown, 113 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 174 edges (avg confidence: 0.73)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `164e0915`
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
- stemSplit.reextract.test.ts
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
- engines.test.ts
- 🟠 Correctness
- uvr-server
- generationStore.test.ts
- Color tokens
- YuE2 Melody Covers via SheetSage2 (planned 2026-09-30)
- engineClient.test.ts
- registry.test.ts
- uvr-server
- Upstream Sync: `complete`/`lego` Skip the LM (planned + implemented 2026-09-30)
- UVR Separator: Roformer Vocals for SPLIT (planned + implemented 2026-09-30)
- COVER and ARRANGE Reference Audio: No Influence Sliders (planned + implemented 2026-09-30)
- Text2music Reference Audio: Style Influence Only (planned + implemented 2026-09-30)
- RE-EXTRACT Never Touches a Claimed Stem (planned 2026-10-02)
- transcribeStore.test.ts
- 13. Environment Variables
- Cover Lyrics From the Recording (planned 2026-10-01)
- voiceStore.test.ts
- editorJobStore.test.ts
- Motion
- 5. Batch Query Task Results
- 6. Format Input
- 7. Get Random Sample
- ANALYZE AUDIO on COVER · YUE2 (planned 2026-10-01)
- YuE2 Covers: Pick the Score's Sections (planned 2026-10-01)
- 10. Server Statistics
- 11. Download Audio Files
- Mulakai — UX & Visual Polish Notes
- Vendored ACE-Step 1.5 documentation
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
- UploadFile
- FastAPI
- Path
- Runner
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
- UploadFile
- Exception
- JobStore
- Settings

## God Nodes (most connected - your core abstractions)
1. `Mulakai — Project Plan` - 52 edges
2. `api` - 42 edges
3. `useCreateDraftStore` - 40 edges
4. `useSettings` - 32 edges
5. `releaseGenLock()` - 29 edges
6. `isGenerating()` - 28 edges
7. `config` - 28 edges
8. `acquireGenLock()` - 27 edges
9. `FakePipeline` - 26 edges
10. `useGenerationStore` - 25 edges

## Surprising Connections (you probably didn't know these)
- `AddLayerTrigger()` --indirect_call--> `lyrics()`  [INFERRED]
  client/src/AddLayerTrigger.tsx → heartmula-server/tests/conftest.py
- `test_a_chordless_plan_is_generated_with_cot_melody()` --references--> `NATIVE`  [EXTRACTED]
  yue-server/tests/test_instrumental.py → client/src/abcFacts.test.ts
- `useAnalyzeSourceAudio()` --indirect_call--> `result()`  [INFERRED]
  client/src/useAnalyzeSourceAudio.ts → server/src/services/lyricTimestamps.test.ts
- `Clock` --uses--> `JobStore`  [INFERRED]
  yue-server/tests/test_store_and_worker.py → heartmula-server/jobs.py
- `test_a_failed_job_still_frees_the_model()` --calls--> `run()`  [INFERRED]
  lyrics-server/tests/test_asr.py → heartmula-server/tests/test_engine.py

## Import Cycles
- None detected.

## Communities (273 total, 113 thin omitted)

### Community 0 - "Backend Generation & Job Services"
Cohesion: 0.10
Nodes (35): message(), syncWarning(), analyzeAudio(), call(), Envelope, fetchWithTimeout(), formatInput(), FormatInputParams (+27 more)

### Community 1 - "Editor UI Components"
Cohesion: 0.20
Nodes (13): Props, RefineRail(), SongFields, AUTO_OPTION, KNOWN_TIME_SIGNATURES, KNOWN_VOCAL_LANGUAGES, TIME_SIGNATURES, timeSignatureLabel() (+5 more)

### Community 2 - "App Shell & Library UI"
Cohesion: 0.12
Nodes (19): App(), View, createCoverDraft(), draftHasIntent(), AUDIO, ForgeStub(), Props, HeaderSlotContext (+11 more)

### Community 3 - "Project Docs & Design Concepts"
Cohesion: 0.08
Nodes (44): prepare_score(), Checks a supplied score (a cover's `abc`) before it is queued, so a bad one is, The score to generate from: validated, and chord-free for `melody`., The header (everything before the first `% name` line) and each section's     b, ScoreError, split_sections(), POST /v1/scores/measure and the section split behind it (PLAN.md, "YuE2 Covers:, test_a_score_without_sections_is_all_header() (+36 more)

### Community 4 - "Core Song/Layer/Version API"
Cohesion: 0.07
Nodes (44): config, __dirname, db, app, adaptersRouter, enginesRouter, foldersRouter, generateRouter (+36 more)

### Community 5 - "Lyrics & Export Panel"
Cohesion: 0.27
Nodes (12): StemResult, AddLayerJob, EditorJob, JobBase, RegenerateJob, RemasterJob, RepaintJob, RetakeJob (+4 more)

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
Cohesion: 0.11
Nodes (25): LyricLine, SongDetail, CreateView(), Editor(), fmt(), Props, ExportPanel(), Props (+17 more)

### Community 10 - "Playback Mix Engine"
Cohesion: 0.08
Nodes (47): STEM_KINDS, upload, queryResult(), AudioFormat, BitDepth, clampDepth(), DEFAULT_OUTPUT, DEPTHS_BY_FORMAT (+39 more)

### Community 11 - "Client TSConfig (app)"
Cohesion: 0.08
Nodes (31): Any, create_app(), HTTP layer, built around an injected transcriber so tests need no model. Speaks, dominant_language(), make_transcriber(), faster-whisper with the settings PLAN.md's "Cover lyrics spike results" picked, The language most sung words are in: each 30 s window holding words votes its de, The model is loaded per job and freed afterwards, handing its VRAM back     to (+23 more)

### Community 12 - "Advanced Generation Settings"
Cohesion: 0.15
Nodes (49): audioFileExt(), downloadAudio(), rawPathFromAudioUrl(), releaseTask(), ReleaseTaskParams, TaskResult, persistNewLayer(), startAddLayer() (+41 more)

### Community 13 - "AI Thinking & Create View"
Cohesion: 0.15
Nodes (20): main(), lyricTagsRouter, createRandomSample(), createSampleFromQuery(), extractTags(), FreshTagEntry, getProbeState(), getStoredTags() (+12 more)

### Community 14 - "Song Detail & Refine Rail"
Cohesion: 0.20
Nodes (22): fitLyricsToSections(), hasWords(), scoreSections(), sectionOutline(), SCORE, UNSUNG, wordBlocks(), keptTokens() (+14 more)

### Community 15 - "Client TSConfig (node)"
Cohesion: 0.21
Nodes (11): FakeRunners, Stands in for run_mdx_headless / run_demucs_headless: records each call     and, runners(), write_tone(), level(), split(), test_folds_demucs_vocals_into_other(), test_maps_outputs_to_stem_kinds() (+3 more)

### Community 16 - "Add-Layer & Mix Bounce"
Cohesion: 0.13
Nodes (27): asTagList(), CAP, captionToStyleTags(), Found, headKind(), Kind, modifiersBefore(), NOT_STYLE (+19 more)

### Community 17 - "Settings Store"
Cohesion: 0.08
Nodes (13): _flag(), Environment configuration for yue-server. Every knob is optional; the defaults, Settings, Adapter over the official YuE2 pipeline (`yue2-infer`, installed into this venv, Forwards to the pipeline's stage reporter and mirrors update() calls., _StageTap, _tapped(), YuePipeline (+5 more)

### Community 18 - "Server TSConfig"
Cohesion: 0.10
Nodes (14): IdempotencyConflict, JobStore, QueueFull, In-memory job table and FIFO queue for yue-server.  The job record mirrors YuE, Drop finished jobs (and their artifacts) older than the retention window., Delete artifact directories left by a previous run (jobs are not persisted)., Returns (job, created). A repeated Idempotency-Key with the same body         r, None for an unknown id, or one of another kind when `kind` is given. (+6 more)

### Community 19 - "Icon Sprite Assets"
Cohesion: 0.48
Nodes (7): Bluesky Icon (butterfly logo, social link), Discord Icon (game controller/mask logo, social link), Documentation Icon (book with folded corner, docs link), GitHub Icon (Octocat cat logo, source-code link), Social Icon (person silhouette with star badge, community link), icons.svg Sprite Sheet, X (Twitter) Icon (stylized X logo, social link)

### Community 20 - "Core Domain Entities (Plan)"
Cohesion: 0.07
Nodes (28): ACE-Step Integration (verified against docs/en/API.md + INFERENCE.md, 2026-07-02), Add Layer: Forced batch_size 1 + Track-Type Picker (implemented 2026-07-10), Architecture, Architecture, Create AUDIO/ARRANGE Flows — `cover` and `complete` (implemented 2026-07-07), Create Draft Persistence + Origin-Aware Reuse (planned 2026-07-30), Custom Player Controls (planned 2026-07-02, then implemented), Decisions Locked In (+20 more)

### Community 21 - "Tech Stack & Structure Docs"
Cohesion: 0.07
Nodes (28): 10. Abort/persist race reverses an abort silently, 11. Job registries never evict, 12. WebGL context leak in `ShaderCanvas`, 13. `generationStore.pollJob` has no cancellation, 14. Misc leaks, 15. UX inconsistencies, 16. Shader palette violation, 17. Server-side polish (+20 more)

### Community 22 - "Client Lint Config"
Cohesion: 0.24
Nodes (7): coversApi, editorApi, EngineControl, generationApi, ApiError, appendParams(), json()

### Community 23 - "Demucs Stem-Split Server"
Cohesion: 0.09
Nodes (21): Acid — "what makes something happen?" (commit actions), AI states — the one exception to "one hue, one job", App model — a flat set of top-level views, one page, Audio preview module (added 2026-07-29), Carbon — "the world" (structure), Color tokens, Copy rules, Design language in one sentence (+13 more)

### Community 24 - "FileTags Test Suite"
Cohesion: 0.33
Nodes (5): createFromPath, fakeFile, fakeId3Tag, fakeTag, idSettings

### Community 25 - "Player & Mix Polish (Plan)"
Cohesion: 0.17
Nodes (10): applyDrag(), DragMode, hitTestRegion(), COLORS, CURSOR, Props, Waveform(), createPeaksLoader() (+2 more)

### Community 28 - "Client TSConfig Root"
Cohesion: 0.18
Nodes (17): A SheetSage2 snapshot whose infer.py is tests/fake_infer.py., sheetsage(), test_a_failed_render_still_returns_the_score(), test_a_replayed_key_returns_the_same_transcription(), test_a_supplied_score_is_checked_and_stripped_for_melody(), test_a_transcription_serves_its_score_preview_and_facts(), test_an_instrumental_cover_moves_the_supplied_melody_to_ins(), test_cancel_kills_a_running_transcription() (+9 more)

### Community 32 - "Jobs Service Test Suite"
Cohesion: 0.26
Nodes (12): AUTO_STEPS, autoSteps(), ditModelDescription(), guidanceEffective(), hasToken(), lmModelDescription(), modelFamily, stepsMax() (+4 more)

### Community 39 - "Human-Centered Design Philosophy"
Cohesion: 0.07
Nodes (26): author, dependencies, better-sqlite3, express, multer, node-taglib-sharp, description, devDependencies (+18 more)

### Community 47 - "Git Workflow Rules"
Cohesion: 0.10
Nodes (19): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+11 more)

### Community 48 - "Red Lines (Never Do)"
Cohesion: 0.16
Nodes (28): AutoReadFacts, shouldAutoRead(), base, CoverSourceState, sourceLockedBy(), fromFile, transcribed, upload() (+20 more)

### Community 49 - "SettingsPanel.tsx"
Cohesion: 0.15
Nodes (15): ClearDraftButton(), CoverScore, CreateBar(), Props, CreateDraft, GenType, ARRANGE, ArrangeSource (+7 more)

### Community 50 - "Claude Commands"
Cohesion: 0.08
Nodes (24): dependencies, framer-motion, react, react-dom, zustand, devDependencies, oxlint, @types/node (+16 more)

### Community 58 - "FORGE — LoRA/LoKr Training & Dataset Studio (planning doc, not yet implemented)"
Cohesion: 0.11
Nodes (34): EngineId, EngineInfo, CreatePromptTab(), coverEngines(), coverUnavailableReason(), durationReadout(), Engine, GatedField (+26 more)

### Community 59 - "4. Create Generation Task"
Cohesion: 0.13
Nodes (23): Thin HTTP wrapper around Demucs (https://github.com/adefossez/demucs) so Mulakai, split(), from_env(), Settings, read once from the environment., Settings, FakeEngine, lyrics(), Stands in for HeartMulaEngine: no torch, no GPU. `gate` lets a test hold     a (+15 more)

### Community 60 - "lyricSections.ts"
Cohesion: 0.11
Nodes (18): BOOLEAN_FIELDS, GEN_FIELDS, labelOnlyReferenceMeta(), NUMERIC_FIELDS, pickMultipartParams(), pickParams(), upload, health() (+10 more)

### Community 61 - "CreateView.tsx"
Cohesion: 0.16
Nodes (36): ActiveAdapterNote(), AddLayerDraft, useAddLayerDraft, AddLayerTrigger(), Version, isEditorBusy(), myEditorJob(), errMsg() (+28 more)

### Community 62 - "demucs-server"
Cohesion: 0.22
Nodes (10): Props, STAGE_LABEL, adoptLock(), coverLocked(), GenerationJob, GenStage, launch(), OtherLock (+2 more)

### Community 63 - "13. Environment Variables"
Cohesion: 0.08
Nodes (14): FakePipeline, test_happy_path_serves_flac_score_and_result(), test_idempotency_key_replays_the_original_job(), test_truncated_job_keeps_its_audio(), test_the_job_saves_the_converted_score_the_planned_one_and_the_record(), test_classify(), OutOfMemoryError, Stands in for torch.OutOfMemoryError, which the worker matches by name. (+6 more)

### Community 64 - "Mulakai — UX & Visual Polish Notes"
Cohesion: 0.11
Nodes (17): Config (env vars), demucs-server, Endpoints, Run, Setup, Configuration, Design, Development (+9 more)

### Community 65 - "FakeAudio"
Cohesion: 0.12
Nodes (28): AudioFormat, BitDepth, clampDepth(), depthLabel(), DEPTHS_BY_FORMAT, FORMATS, maxDepth(), MP3_BITRATES (+20 more)

### Community 66 - "lyricTags.ts"
Cohesion: 0.40
Nodes (4): INLINE_TAGS, LYRIC_TAGS, LyricTag, SECTION_TAGS

### Community 67 - "5. Batch Query Task Results"
Cohesion: 0.15
Nodes (14): ScoreSize, api, RefineResult, AnalyzeSource, AnalyzeState, fillable(), IDLE, measured (+6 more)

### Community 68 - "6. Format Input"
Cohesion: 0.21
Nodes (9): PlaybackApi, fmt(), Player(), Props, COLORS, PlayerWaveform(), Props, Props (+1 more)

### Community 69 - "7. Get Random Sample"
Cohesion: 0.26
Nodes (7): ForgeSection(), daysLeft(), fmtBytes(), LibraryMaintenanceSection(), LyricTagGuideSection(), LyricTagsSection(), Props

### Community 70 - "9. Initialize or Switch Models"
Cohesion: 0.15
Nodes (15): lyricsRouter, receiveSource(), upload, LyricSegment, lyricsHealth(), LyricsReading, LyricWord, num() (+7 more)

### Community 71 - "genLock.ts"
Cohesion: 0.15
Nodes (12): bar_seconds(), Each score section's start in seconds, for placing read lyrics by time (PLAN.md, (label, 0-based first bar) for each `% label` comment, in score order., One bar on the score's tempo grid, for sections past the last downbeat., downbeat.lab's first column; empty when the file is missing or unreadable., [{label, bar, seconds}] per section, or None when there is nothing to anchor it, read_downbeats(), section_bars() (+4 more)

### Community 72 - "React + TypeScript + Vite"
Cohesion: 0.10
Nodes (11): create_app(), main(), Thin HTTP wrapper around the official YuE2 pipeline (https://github.com/multimo, add_transcription_routes(), The /v1/transcriptions routes: SheetSage2 reads a source song's melody into a s, _error(), The single inference thread: loads the pipeline once, then runs queued jobs one, run_job() (+3 more)

### Community 73 - "10. Server Statistics"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 74 - "11. Download Audio Files"
Cohesion: 0.23
Nodes (14): arrange(), is_instrumental(), Upstream's instrumental workflow (PLAN.md "YuE2: Align With Upstream's `yue2-mu, Upstream's rule: lyrics that are only section tags. Empty lyrics don't     coun, `% pre-chorus` → `[Pre-Chorus]`, as upstream's `lyric_tags` writes them., Returns (plan, request, record) to generate from. record is None when the     r, section_tags(), noop() (+6 more)

### Community 75 - "8. List Available Models"
Cohesion: 0.13
Nodes (11): coverReady, engines, fetchTranscriptionPreview, jobs, measureScore, noCover, startEngineGeneration, startTranscription (+3 more)

### Community 77 - "1. Authentication"
Cohesion: 0.36
Nodes (6): readDuration(), MoveToEditorAction(), useNavigation(), ImportDraft, importFields(), EMPTY

### Community 78 - "Training API"
Cohesion: 0.18
Nodes (12): Song, GEN_TYPE_LABEL, reusePromptDraft(), taskToGenType(), Dropzone(), Props, ReusedSourceNote(), fmtDuration() (+4 more)

### Community 133 - "Waveform.tsx"
Cohesion: 0.21
Nodes (9): HTTP layer, built around injected runners so tests need no torch. Speaks the co, mix_into(), output_path(), The two-pass split behind /split. See PLAN.md "UVR Separator: Roformer Vocals f, Where uvr-headless-runner writes a stem: `{base}_({Stem}).wav`., Add `extra` into `target` in place, keeping float32 WAV., Separate `src` into Mulakai's four StemKinds, as float32 WAVs under `out_dir`., _require() (+1 more)

### Community 134 - "settings.ts"
Cohesion: 0.15
Nodes (19): AdvancedGenSettings(), INFER_METHOD_OPTIONS, CustomSelect(), Props, InfoTooltip(), Props, ReferenceAudioPicker(), influenceHint() (+11 more)

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
Cohesion: 0.08
Nodes (11): PlaybackEngine, contexts, ctxNow(), durations, Engine, FakeContext, FakeSource, flushEnded() (+3 more)

### Community 139 - "Add Layer Lyrics (implemented 2026-07-08)"
Cohesion: 0.50
Nodes (4): Add Layer Lyrics (implemented 2026-07-08), Decisions, File-level plan, Model restriction (confirmed, no code change)

### Community 140 - "Universal Advanced Settings (Repaint + Add Layer) (implemented 2026-07-08)"
Cohesion: 0.67
Nodes (3): Decisions, File-level plan, Universal Advanced Settings (Repaint + Add Layer) (implemented 2026-07-08)

### Community 141 - "Create AUDIO/ARRANGE Flows — `cover` and `complete` (implemented 2026-07-07)"
Cohesion: 0.42
Nodes (8): AdapterAddForm(), AdaptersSection(), AdapterStrength(), activeAdapter(), adapterConsequence(), AdapterState, useAdapterStore, Adapter

### Community 142 - "backfillGenTask.test.ts"
Cohesion: 0.38
Nodes (6): activeLayers(), DecodedLayer, LayerAudioInput, EngineLayerState, audibleStructureKey(), usePlaybackEngine()

### Community 143 - "api.ts"
Cohesion: 0.50
Nodes (4): Decisions, File-level plan, Import a Song (planned 2026-07-30), Open questions

### Community 145 - "Create Draft Persistence + Origin-Aware Reuse (planned 2026-07-30)"
Cohesion: 0.13
Nodes (26): EngineCapabilities, aceOnlyNote(), COT_OPTIONS, EngineGenSettings(), SLIDERS, coverParams(), enginePromptParams(), PromptIntent (+18 more)

### Community 146 - "FakeAudio"
Cohesion: 0.23
Nodes (4): createPreviewPlayback(), PreviewAudioElement, FakeAudio, make()

### Community 147 - "waveformPeaks.ts"
Cohesion: 0.13
Nodes (13): fit_to_ceiling(), Write the engine's float audio as a lossless FLAC master.  HeartMuLa's float p, Return (audio, gain_db). Only ever turns down, never up., write_flac(), test_audio_within_the_ceiling_is_untouched(), test_non_finite_samples_are_rejected(), test_over_full_scale_is_turned_down_to_the_ceiling(), test_write_flac_is_24_bit_stereo_without_clipping() (+5 more)

### Community 148 - "MoveToEditorAction.tsx"
Cohesion: 0.40
Nodes (5): Browser check (2026-10-02), COVER's Source Holds Still While a Job Reads It (planned 2026-10-02), Decisions, File-level plan, Open questions

### Community 149 - "AdaptersSection.tsx"
Cohesion: 0.13
Nodes (19): JobCancelled, Raised inside a job when its cancel flag is seen., HeartMulaEngine, Attn, Backbone, FakeCodec, FakeLM, FakePipe (+11 more)

### Community 150 - "SettingsView.tsx"
Cohesion: 0.15
Nodes (17): StemKind, AudioPreview(), fmtTime(), Props, AudioPreviewPopover(), Props, ArrangeMethod, PreviewPlayback (+9 more)

### Community 151 - "Waveform.tsx"
Cohesion: 0.44
Nodes (8): client_for(), post(), seg(), test_failed_job_is_a_500_and_removes_the_upload(), test_hallucinated_segments_are_dropped(), test_health_names_the_model_without_running_a_job(), test_language_is_passed_when_given(), test_transcribe_hands_over_the_upload_and_returns_segments()

### Community 152 - "generationStore.ts"
Cohesion: 0.11
Nodes (7): Only meaningful once ready; the submit routes return 503 before that., The score's size in the planner's tokens; None until the pipeline is loaded., Worker, JobStore, Forget finished jobs older than the cutoff; returns their ids., Block for the next queued job, mark it running, return (id, request)., Record the outcome. A cancel that arrived mid-job wins; returns the final status

### Community 153 - "adapters.test.ts"
Cohesion: 0.25
Nodes (11): Transcription, barSeconds(), CoverScoreLike, lineTime(), placeReading(), sectionAt(), sectionBarCounts(), sectionTimes (+3 more)

### Community 154 - "inferenceSteps.ts"
Cohesion: 0.22
Nodes (8): EMPTY, OutputMetadataSection(), create(), loadLora, patch(), post(), setLoraScale, unloadLora

### Community 155 - "adapterStore.test.ts"
Cohesion: 0.36
Nodes (7): ACESTEP_CAPABILITIES, coverReady(), EngineInfo, EXTRA_ENGINES, listEngines(), EngineCapabilities, transcriptionHealth()

### Community 156 - "apiStatusStore.ts"
Cohesion: 0.25
Nodes (5): callOrder, initModel, queryResult, reconcileAdapter, releaseTask

### Community 157 - "lyricSections.ts"
Cohesion: 0.20
Nodes (9): AGENTS.md — Mulakai Development Rules, Code Style, Design System (mandatory for all UI work), Git Workflow, Module Size Policy, Red Lines, Scope Discipline, Spec-Driven Development (+1 more)

### Community 158 - "voiceStore.test.ts"
Cohesion: 0.25
Nodes (9): managementApi, AdapterList, LyricTagProbeStatus, ModelInfo, ModelInventory, OutputMetadata, TaskType, Voice (+1 more)

### Community 159 - "Adapter Loading (LoRA/LoKr) at Inference (planned 2026-07-31)"
Cohesion: 0.33
Nodes (6): Adapter Loading (LoRA/LoKr) at Inference (planned 2026-07-31), Decisions, File-level plan, Open questions, Rollout, Verified against ACE-Step source, 2026-07-31

### Community 160 - "adapters.test.ts"
Cohesion: 0.33
Nodes (4): loadLora, loraStatus, setLoraScale, unloadLora

### Community 161 - "SectionStrip.tsx"
Cohesion: 0.14
Nodes (13): 1. WSL2 + Ubuntu 24.04, 2. The venv (inside WSL), 3. `yue2 doctor` and the weights, 4. Start the server, 5. Covers: SheetSage2 (optional), API, Config (env vars, all optional), If Ubuntu's first-run user setup hangs (+5 more)

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
Cohesion: 0.15
Nodes (10): _collect(), _kill(), SheetSage2 transcription, the second job kind (PLAN.md, "yue-server transcripti, ('ready' | 'not_configured' | 'missing_files', detail)., Transcribe into `out`; returns the result facts plus `preview` (bool)., _read(), run_transcription(), Transcriber (+2 more)

### Community 169 - "waveformPeaks.ts"
Cohesion: 0.50
Nodes (4): 11.1 API Definition, 11.2 Request Parameters, 11.3 Usage Example, 11. Download Audio Files

### Community 171 - "ExportPanel.tsx"
Cohesion: 0.13
Nodes (12): Engine, Generated, What the job worker needs from an engine. Torch-free, so the API, the queue and, drop_kv_caches(), park(), _raise_if(), HeartMuLa behind the worker's Engine interface, with RAM parking.  Both models, torchtune 0.4's setup_cache skips any layer whose cache already exists,     so (+4 more)

### Community 173 - "JobStore"
Cohesion: 0.15
Nodes (12): compilerOptions, esModuleInterop, module, moduleResolution, outDir, rootDir, skipLibCheck, strict (+4 more)

### Community 174 - "registry.ts"
Cohesion: 0.06
Nodes (35): COT_VALUES, NUMBER_FIELDS, pickCreateFields(), STRING_FIELDS, coverEngine(), coversRouter, PREVIEW_HEADERS, receiveSource() (+27 more)

### Community 175 - "engineGenJobs.ts"
Cohesion: 0.24
Nodes (23): cancel(), EngineTarget, errorMessage(), failure(), fetchAudio(), fetchScore(), headers(), health() (+15 more)

### Community 176 - "CreateView.tsx"
Cohesion: 0.15
Nodes (20): AnalyzeAudioButton(), Props, AutoTextarea(), Props, CarriedPromptNote(), MEANING, CreateArrangeTab(), CreateAudioTab() (+12 more)

### Community 177 - "stemSplit.reextract.test.ts"
Cohesion: 0.29
Nodes (3): idle(), settledSplit(), StemKind

### Community 178 - "JobCancelled"
Cohesion: 0.29
Nodes (6): 2. Response Format, 3. Task Status Description, ACE-Step API Client Documentation, Best Practices, Error Handling, Table of Contents

### Community 179 - "Multiple Song-Creation Engines (planned 2026-09-30)"
Cohesion: 0.14
Nodes (14): Engine: HeartMuLa (ships second), Engine picker UI decisions (2026-09-30, `feat/engine-picker-ui`), Engine: YuE2 (ships first), File-level plan, Framework decisions (2026-09-30, `feat/engine-framework`), General engine design (decided once, shared by every engine), heartmula-server decisions (2026-09-30), HeartMuLa spike results (2026-09-30) (+6 more)

### Community 180 - "heartmula.ts"
Cohesion: 0.22
Nodes (12): captionToTags(), CFG, clamp(), heartmula, HEARTMULA_CAPABILITIES, isSet(), MAX_LENGTH_MS, NO_META (+4 more)

### Community 181 - "test_engine.py"
Cohesion: 0.44
Nodes (7): abcFacts, barsOf(), header(), keyOf(), MODES, tempoOf(), NATIVE

### Community 182 - "main.py"
Cohesion: 0.29
Nodes (5): TranscriptionState, client, engine, FACTS, source

### Community 183 - "yue-server"
Cohesion: 0.43
Nodes (5): libraryApi, Folder, FolderScope, FolderRail(), Props

### Community 184 - "engine_api.py"
Cohesion: 0.33
Nodes (6): lyricsApi, LyricSegment, LyricsReading, LyricWord, Placement, ReadLyricsState

### Community 185 - "Mulakai"
Cohesion: 0.20
Nodes (7): cancelSplit, jobStatus, repaint, repaintParams, settled, splitStatus, startSplit

### Community 186 - "SongEngine"
Cohesion: 0.67
Nodes (3): A Failed Generation Blocks Nothing (planned 2026-10-01), Decisions, File-level plan

### Community 187 - "run_job"
Cohesion: 0.22
Nodes (7): draft(), jobStatus, READING, readLyrics, src, T, withScore()

### Community 188 - "GenerateRequest"
Cohesion: 0.11
Nodes (10): BaseModel, GenerateRequest, The POST /v1/jobs body, validated before anything reaches the pipeline., yue2-serve's body, minus `n` (one take per job), plus a tolerated `id`     (Mul, add_score_routes(), MeasureRequest, POST /v1/scores/measure: a cover's score in the planner's tokens, per section,, Move weights to system RAM and hand the cached VRAM back. (+2 more)

### Community 189 - "CustomSelect.tsx"
Cohesion: 0.22
Nodes (8): Commands, Design System, graphify, Mulakai — Agent Instructions, Project Structure, Reference Projects (do not modify), Spec-Driven Development, Tech Stack

### Community 190 - "engineGenJobs.test.ts"
Cohesion: 0.18
Nodes (7): EngineJobState, client, DONE, engine, fields, readMeta, RUNNING

### Community 191 - "abcMeta.ts"
Cohesion: 0.36
Nodes (9): headerFields(), MAJOR, METERS, MINOR, MODES, parseKey(), parseMeter(), parseTempo() (+1 more)

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
Cohesion: 0.43
Nodes (5): ActiveGeneration, ApiStatusState, useApiStatusStore, Header(), Props

### Community 197 - "🟠 Correctness"
Cohesion: 0.25
Nodes (8): 4.1 API Definition, 4.2 Request Parameters, 4.3 Response Example, 4.4 Usage Examples (cURL), 4. Create Generation Task, Method A: JSON Request (application/json), Method B: File Upload (multipart/form-data), Parameter Naming Convention

### Community 198 - "uvr-server"
Cohesion: 0.29
Nodes (5): deleteAdapter, listAdapters, registerAdapter, setActiveAdapter, setAdapterScale

### Community 199 - "generationStore.test.ts"
Cohesion: 0.25
Nodes (7): activeGeneration, coverWithEngine, generate, generateFromAudio, generateWithEngine, jobStatus, params

### Community 200 - "Color tokens"
Cohesion: 0.29
Nodes (6): Config (env vars), Endpoints, lyrics-server, Run, Setup (native Windows), Tests

### Community 201 - "YuE2 Melody Covers via SheetSage2 (planned 2026-09-30)"
Cohesion: 0.18
Nodes (11): Client cover decisions (2026-10-01, `feat/yue-cover-ui`), Cover spike results (2026-09-30), Decisions, File-level plan, Mulakai server cover decisions (2026-10-01, `feat/yue-cover-server`), Open questions, Rollout, Upstream skill-doc review (2026-09-30) (+3 more)

### Community 204 - "uvr-server"
Cohesion: 0.29
Nodes (6): Config (env vars), Endpoints, Run, Setup (native Windows), Tests, uvr-server

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

### Community 210 - "RE-EXTRACT Never Touches a Claimed Stem (planned 2026-10-02)"
Cohesion: 0.50
Nodes (4): Browser check (2026-10-02), Decisions, File-level plan, RE-EXTRACT Never Touches a Claimed Stem (planned 2026-10-02)

### Community 211 - "transcribeStore.test.ts"
Cohesion: 0.33
Nodes (6): jobStatus, land(), src, T, tick(), transcribe

### Community 212 - "13. Environment Variables"
Cohesion: 0.33
Nodes (6): 13. Environment Variables, Cache Configuration, LM Configuration, Model Configuration, Queue Configuration, Server Configuration

### Community 213 - "Cover Lyrics From the Recording (planned 2026-10-01)"
Cohesion: 0.17
Nodes (12): Cover Lyrics From the Recording (planned 2026-10-01), Cover lyrics spike results (2026-10-01), Decisions (proposed; the spike confirms or changes them), File-level plan, lyrics-server contract (PR 1, 2026-10-01), Mulakai server for READ LYRICS (PR 2, 2026-10-01), Open questions, READ LYRICS browser check (2026-10-01) (+4 more)

### Community 215 - "editorJobStore.test.ts"
Cohesion: 0.33
Nodes (3): jobStatus, repaint, retakeVersion

### Community 216 - "Motion"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 217 - "5. Batch Query Task Results"
Cohesion: 0.14
Nodes (11): Reads the words sung in a song (PLAN.md "Cover Lyrics From the Recording"): fas, post(), setup(), test_failed_split_is_a_500_and_still_frees_the_gpu(), test_split_keeps_only_the_served_stems(), test_split_returns_downloadable_urls_for_all_four_stems(), 5.1 API Definition, 5.2 Request Parameters (+3 more)

### Community 218 - "6. Format Input"
Cohesion: 0.40
Nodes (5): 6.1 API Definition, 6.2 Request Parameters, 6.3 Response Example, 6.4 Usage Example, 6. Format Input

### Community 219 - "7. Get Random Sample"
Cohesion: 0.40
Nodes (5): 7.1 API Definition, 7.2 Request Parameters, 7.3 Response Example, 7.4 Usage Example, 7. Get Random Sample

### Community 221 - "ANALYZE AUDIO on COVER · YUE2 (planned 2026-10-01)"
Cohesion: 0.40
Nodes (5): ANALYZE AUDIO on COVER · YUE2 (planned 2026-10-01), Browser check (2026-10-01), Decisions, File-level plan, Open questions

### Community 222 - "YuE2 Covers: Pick the Score's Sections (planned 2026-10-01)"
Cohesion: 0.40
Nodes (5): Browser check (2026-10-01), Decisions, File-level plan, Open questions, YuE2 Covers: Pick the Score's Sections (planned 2026-10-01)

### Community 223 - "10. Server Statistics"
Cohesion: 0.50
Nodes (4): 10.1 API Definition, 10.2 Response Example, 10.3 Usage Example, 10. Server Statistics

### Community 224 - "11. Download Audio Files"
Cohesion: 0.14
Nodes (16): Thin HTTP wrapper around uvr-headless-runner (https://github.com/chyinan/uvr-he, _run_demucs(), _run_mdx(), Fetch, test_demucs_looks_again_after_download(), test_demucs_still_missing_after_download_raises(), test_demucs_uses_an_installed_model_without_resolving(), test_reuses_the_cached_entry() (+8 more)

### Community 225 - "Mulakai — UX & Visual Polish Notes"
Cohesion: 0.33
Nodes (5): Mulakai — UX & Visual Polish Notes, Proposed next passes (not yet done), The core loop today, Visual polish applied this pass (`index.css`), Workflow observations → improvements

### Community 226 - "Vendored ACE-Step 1.5 documentation"
Cohesion: 0.50
Nodes (3): Keeping them current, Licence, Vendored ACE-Step 1.5 documentation

### Community 228 - "ShaderCanvas.tsx"
Cohesion: 0.11
Nodes (23): Props, AIGeneratingBackground(), AIGeneratingBackgroundProps, useWaveVeil(), Layer, LayerLane(), Props, LayerStack() (+15 more)

### Community 230 - "Training API"
Cohesion: 0.67
Nodes (3): LoKr Training, LoRA Training, Training API

### Community 231 - "YuE2: Align With Upstream's `yue2-music` Skill (planned 2026-09-30)"
Cohesion: 0.67
Nodes (3): Decisions, File-level plan, YuE2: Align With Upstream's `yue2-music` Skill (planned 2026-09-30)

### Community 232 - "fake_infer.py"
Cohesion: 0.50
Nodes (3): Expanding the Oxlint configuration, React Compiler, React + TypeScript + Vite

### Community 233 - "README.md"
Cohesion: 0.50
Nodes (4): 8.1 API Definition, 8.2 Response Example, 8.3 Usage Example, 8. List Available Models

### Community 242 - "READ LYRICS With TRANSCRIBE for Uploads (planned 2026-10-01)"
Cohesion: 0.50
Nodes (4): Browser check (2026-10-01), Decisions, Files, READ LYRICS With TRANSCRIBE for Uploads (planned 2026-10-01)

### Community 246 - "12. Health Check"
Cohesion: 0.67
Nodes (3): 12.1 API Definition, 12.2 Response Example, 12. Health Check

### Community 247 - "1. Authentication"
Cohesion: 0.67
Nodes (3): 1. Authentication, Authentication Methods, Configuring API Key

### Community 248 - "A Failed Editor Job Blocks Nothing (planned 2026-10-01)"
Cohesion: 0.67
Nodes (3): A Failed Editor Job Blocks Nothing (planned 2026-10-01), Decisions, File-level plan

### Community 249 - "A Settled Split Blocks Nothing (planned 2026-10-01)"
Cohesion: 0.67
Nodes (3): A Settled Split Blocks Nothing (planned 2026-10-01), Decisions, File-level plan

## Knowledge Gaps
- **784 isolated node(s):** `$schema`, `plugins`, `react/rules-of-hooks`, `react/only-export-components`, `name` (+779 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **113 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useAnalyzeSourceAudio()` connect `Red Lines (Never Do)` to `CreateView.tsx`, `5. Batch Query Task Results`, `Advanced Generation Settings`?**
  _High betweenness centrality (0.110) - this node is a cross-community bridge._
- **Why does `result()` connect `Advanced Generation Settings` to `Red Lines (Never Do)`?**
  _High betweenness centrality (0.110) - this node is a cross-community bridge._
- **Why does `AddLayerTrigger()` connect `CreateView.tsx` to `FakeAudio`, `ShaderCanvas.tsx`, `backfillGenTask.test.ts`, `CreateView.tsx`, `Create Draft Persistence + Origin-Aware Reuse (planned 2026-07-30)`, `4. Create Generation Task`?**
  _High betweenness centrality (0.083) - this node is a cross-community bridge._
- **What connects `$schema`, `plugins`, `react/rules-of-hooks` to the rest of the system?**
  _862 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Backend Generation & Job Services` be split into smaller, more focused modules?**
  _Cohesion score 0.1039136302294197 - nodes in this community are weakly interconnected._
- **Should `App Shell & Library UI` be split into smaller, more focused modules?**
  _Cohesion score 0.12 - nodes in this community are weakly interconnected._
- **Should `Project Docs & Design Concepts` be split into smaller, more focused modules?**
  _Cohesion score 0.0783744557329463 - nodes in this community are weakly interconnected._