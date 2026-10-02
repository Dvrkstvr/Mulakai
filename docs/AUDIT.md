# Mulakai — Code Audit

> Snapshot taken 2026-07-31, superseding the 2026-07-08 audit. Type-checks pass on
> client + server; all tests green (client 152, server 219) at snapshot time.
> These are logic, security, and consistency issues that tooling doesn't catch.
> Ordered by severity. Line references were accurate at snapshot time — re-verify before fixing.

## Fixed since the 2026-07-08 audit

- Editor job polling died after the first progress tick (every repaint/add-layer/
  remaster stuck "running" forever in the UI) — PR #18.
- Server bound all interfaces with no auth; now `127.0.0.1` by default (`HOST` to
  override) — PR #19 (was #1).
- Voice/cover-art uploads accepted any extension into the same-origin static dir
  (stored XSS via `.html`); now allowlisted like `songImport.ts` — PR #19.
- Trash sweep: unhandled `fs.rm` rejection could crash the process on Windows
  (EBUSY on an in-use file); cover-art files were orphaned forever — PR #19 (was #5).
- Add Layer ignored a pinned seed; multipart booleans decoded `"false"` as true —
  PRs #19 + #21 (was #2/#3/#4).
- The `output` format/rate/depth block was dropped on **every** generate path
  (`output` was never in `GEN_FIELDS`) and multipart-mangled to `"[object Object]"`
  elsewhere; now JSON-encoded client-side and parsed server-side — PR #21.
- No timeout on any ACE-Step fetch: a hung socket held the global genLock forever.
  Now `AbortSignal.timeout` everywhere + 3-strike poll tolerance — PR #22.
- Demucs/UVR RE-EXTRACT rewrote every stem file, including ones already claimed as
  versions. Stem files are now append-only (unique names), a re-extract keeps only its
  own stem and reads the split's original source, and unclaimed files are deleted on
  supersede/cancel — PR #81 (was #2).
- Follow-up to #2: a split left open when its tab closed kept its job in memory and its
  unclaimed stems in `audioDir` forever, and a restart stranded them. Idle splits (no
  poll, claim or RE-EXTRACT for an hour) are now cancelled, and boot sweeps stem files
  no version points at — PR #96.
- Every other job registry (`jobRegistry.ts`, scratch splits) grew for the life of the
  process, and remaster results / scratch stems in OS temp outlived their jobs. Settled
  jobs are now evicted after an hour unread (scratch splits after 24 hours) with their
  files, stale temp entries are swept, and the job pollers stop on a 404 — PR #104
  (was #11, and #13's 404 half).
- `generationStore` kept polling a generation it no longer tracked (dismissed while
  running), and StrictMode's double `hydrate()` polled an adopted job twice. The loop
  now stops once the store drops its job, one loop per job — PR #106 (was #13).
- `ShaderCanvas` never released its WebGL context, so remounted AI shader surfaces
  piled up toward the browser's ~16-context cap until they went black. Each surface
  now releases its context (`loseContext`) on unmount and failure, on a fresh canvas
  per mount — PR #108 (was #12).
- Playback never ended: no `onended` on any source, so the Editor stayed "playing"
  with `currentTime()` growing past the song forever. The longest layer's end now
  stops the engine at the duration (play again restarts from 0), guarded by a
  per-start generation token so manual pause/seek/restart/reload can't trip it —
  PR #85 (was #1).
- demucs-server ran each split inside `async def`, so `/health` read the service as
  down mid-job, and every split's files stayed on disk forever. `/split` now runs in
  the threadpool, failed splits remove their job dir, and each stem is deleted once
  downloaded or swept after a TTL; uvr-server had the same leak — PR #80 (was #3).
- No Playwright e2e existed. `e2e/` now runs PLAN.md Phase 10's golden path
  (generate → repaint → add layer → revert → export) through the real client and
  server against a fake ACE-Step, on a throwaway data dir (`npm run test:e2e`) —
  PR #87 (was #19).
- Editor failures were silent: a failed song load sat on "Loading…" forever, and lane
  rename/volume/mute/solo, REVERT and the song detail rail's saves dropped their
  errors. Each now shows a rust `.error` line (RETRY for a load or refresh), and a
  volume drag sends one PATCH at a time, latest value wins — PR #83 (was #4).
- COVER sent only `model` + `audio_cover_strength`: the rail's STEPS/GUIDANCE/SEED/
  advanced knobs did nothing, and covers ignored the Settings output format. Now
  sent via `coverParams()`, with the rail gated on the tab's model — PR #95 (was #5).
- Library search raced: each keystroke fired its own `listSongs` and the last response
  to land won, so a slow "co" could replace "copper". Every song-list load now goes
  through one loader that applies only the newest response and reads the query and
  folder at fire time; search is debounced 250 ms — PR #93 (was #6).
- Add Layer's bounce read each layer's volume by position from an unfiltered list, so a
  layer with no active version shifted every later layer onto its neighbour's volume.
  `audibleTakes()` keeps each layer with its version; Add Layer, REMASTER and COVER's
  library source share it — PR #99 (was #7).
- Eight non-test modules were over AGENTS.md's 200-LOC hard cap (`acestep.ts` 539,
  `settings.ts` 329, `Editor.tsx` 320, `App.tsx` 317, `routes/generate.ts` 298,
  `jobs.ts` 283, `stemSplit.ts` 282, `repaintJobs.ts` 235). Each was split by
  responsibility with no behaviour change; none is over the cap now — PRs #71–#75,
  #77, #82, and #81 for `stemSplit.ts` (was #18).
- An ACE-Step split's four concurrent stems each reconciled the LoRA adapter unsynchronized,
  so a not-yet-applied adapter got four overlapping `lora/load` + `lora/scale` sequences.
  Every reconcile (and `registerAdapter`) now runs through one queue; the first applies,
  the rest find it applied — PR #102 (was #8).
- An ABORT that landed while a finished job's result was being saved was reversed: `poll()`
  set `done` once the save returned. The job now stays aborted, says the result was saved,
  and keeps its `songId`; an abort then a failed save keeps "Aborted" — PR #107 (was #10).

## 🔴 High — broken or data-risky behavior

### 1. ~~Playback never ends~~ — fixed, PR #85
`client/src/mix/playbackEngine.ts` — no `onended` on any `AudioBufferSourceNode`;
after the last buffer plays out, `playing` stays true and `currentTime()` grows past
`duration` forever. Play button shows pause forever; elapsed readout runs on.
- **Fix:** arm `onended` on the longest source (or compare `currentTime() >= duration`)
  and flip to stopped. Add the missing playbackEngine test.

### 2. ~~Demucs re-extract silently overwrites already-claimed stems~~ — fixed, PR #81
`server/src/services/stemSplit.ts` — `reextractStem('demucs')` re-runs the full
4-stem pass with deterministic `${job.id}-${kind}.${ext}` filenames, clobbering the
on-disk audio of stems already claimed as versions. The doc comment ("keeps only
this stem's output") describes behavior the code doesn't implement. Unclaimed stem
files are also never deleted (`cancelSplit` only drops the in-memory job).
- **Follow-up (PR #96):** splits abandoned without a cancel (tab closed, server
  restart) still leaked their stems; now evicted after an hour idle, and swept at boot.

### 3. ~~demucs-server blocks its event loop and leaks disk~~ — fixed, PR #80
`/split` is now a sync `def` (threadpool, one at a time); failed splits remove
their job dir; each stem is deleted once downloaded, unfetched ones are swept
after `DEMUCS_RESULT_TTL`. uvr-server had the same disk leak; fixed there too.

`demucs-server/main.py` — `demucs.separate.main(...)` runs inside `async def`,
freezing the loop for the whole split (so `/health` reports the service down
mid-job); no try/finally around the split (a corrupt upload leaks the source file
and job dir); `DATA_DIR/<job_id>/` is never cleaned up — four float32 WAVs per
split retained forever, publicly served.
- **Fix:** make handlers sync `def` (FastAPI threadpool), add try/finally cleanup,
  add a TTL sweep or delete-after-claim.

### 4. ~~Silent failures across the Editor~~ — fixed, PR #83
- `client/src/Editor.tsx` — `reload()` is `catch(() => {})`: a failed song load is a
  permanent "Loading…" spinner with no error and no way out but Back.
- `client/src/LayerLane.tsx` — rename/volume/mute/solo PATCHes have no catch;
  volume drag fires a PATCH + full `songDetail` reload per tick.
- `client/src/VersionHistory.tsx` / `SongDetailRail.tsx` — revert and rename/
  comment/folder-move failures are invisible.
- **Fix:** route these through an error surface (rust inline text per DESIGN.md).

## 🟠 Correctness

### 5. ~~Dead controls presented as live~~ — fixed, PR #95
COVER now sends the rail's STEPS/GUIDANCE/SEED/DiT knobs, the `output` block and the
`wav32` master, and the rail drops its duplicate DIT MODEL there. The ARRANGE
influence half was fixed earlier (`referenceInfluence.ts`).

- `client/src/CreateAudioTab.tsx` — cover generation sends only `model` +
  `audio_cover_strength`; the STEPS/GUIDANCE/SEED/advanced panel rendered on that
  tab has zero effect.
- `client/src/CreateArrangeTab.tsx` + `ReferenceAudioPicker.tsx` — AUDIO/STYLE
  INFLUENCE sliders don't apply to `complete` (only the stored voice defaults do),
  but the hint text claims they do.

### 6. ~~Library search race~~ — fixed, PR #93
`client/src/App.tsx` — one un-guarded `listSongs` per keystroke; a slow early
response can overwrite results for a newer query. Debounce + drop stale responses.

### 7. ~~Add Layer bounce: volume index misalignment~~ — fixed, PR #99
`client/src/AddLayerTrigger.tsx` — `audible` filters layers without an active
version, then indexes volumes via the *unfiltered* `activeLayers(layers)[i]`;
neighbors' volumes shift when the lists diverge. (`RemasterAction.tsx` and
`CreateAudioTab.tsx` do the same op correctly with `{layer, version}` pairs.)

### 8. ~~Adapter reconcile race during ACE-Step splits~~ — fixed, PR #102
`server/src/services/stemSplit.ts` fans out four concurrent `runAcestepStem`
calls; each runs `reconcileAdapter()`'s unsynchronized read-check-write —
overlapping `lora/load`/`lora/scale` sequences can reach ACE-Step.

### 9. Repaint crossfade only clamped in the UI handler
`client/src/RepaintBar.tsx` / `settings.ts` — a persisted `crossfadeSec` larger
than the current region's max is displayed and submitted as-is. Clamp at submit.

### 10. ~~Abort/persist race reverses an abort silently~~ — fixed, PR #107
`server/src/services/jobs.ts` — `abortJob` during an in-flight `onSuccess` marks
the job failed, then `poll` overwrites to done. Outcome is harmless (song exists)
but the abort is silently undone.

## 🟡 Resource leaks / unbounded growth

### 11. ~~Job registries never evict~~ — fixed, PRs #96 + #104
`server/src/services/jobs.ts` / `stemSplit.ts` — `jobs.set(...)` has no paired
delete; every job for the life of the process accumulates. (`stemSplit.ts` evicts
idle splits since PR #96; `jobRegistry.ts` and scratch splits since PR #104.)

### 12. ~~WebGL context leak in `ShaderCanvas`~~ — fixed, PR #108
`client/src/ShaderCanvas.tsx` — cleanup never calls
`WEBGL_lose_context.loseContext()`; repeated AI-state mounts accumulate toward the
browser's ~16-context cap, after which shader surfaces go black.

### 13. ~~`generationStore.pollJob` has no cancellation~~ — fixed, PRs #104 + #106
Keeps hitting `/api/generate/:id` every 2s after `dismiss()` until the server says
done/failed. Similarly `editorJobStore`'s single-job poll has no 404 exit (the
split poll has one).
- **404 half fixed (PR #104):** every `/api/generate/:id` poller now fails the job on
  a 404.
- **Cancellation fixed (PR #106):** the loop stops once the store no longer tracks its
  job, and a job gets one loop at most.

### 14. Misc leaks
`client/src/audioDuration.ts` — object URL not revoked on the error path.
`client/src/Timeline.tsx` — mid-drag unmount leaves window listeners attached
(then `trackRef.current!` throws per mousemove).

## 🔵 Inconsistencies / polish

### 15. UX inconsistencies
- Library row `✕` trashes in a single click; every other destructive action uses
  the two-step rust confirm.
- Download names hardcode `.wav` (`Editor.tsx`, `App.tsx`) while the default
  output is FLAC; `ExportPanel.tsx` derives the extension correctly.
- `client/src/Waveform.tsx` / `PlayerWaveform.tsx` — no resize handling (blurry
  after column drag/window resize); a 404'd waveform renders permanently blank
  with no retry (`loadPeaks` failure swallowed).
- `LyricTagGuidePopover.tsx` — position computed once; scrolling strands the flyout.

### 16. Shader palette violation
`client/src/ShaderCanvas.tsx` — `amber = vec3(0.233, 0.160, 0.75)` is a
blue-violet, not amber, and not a DESIGN.md hue; the header comment claims the
palette is locked. Use a token or add the accent to DESIGN.md properly.

### 17. Server-side polish
- `duration` can persist as the literal string `"N/A"` (`jobs.ts` `persistSong`;
  the guard exists only in `fetchLyricTimestampsJson`).
- Multi-statement DB writes aren't transactional (`persistSong`, `persistVersion`,
  version activate) — a mid-sequence throw leaves an orphan song or a layer with
  no active version; `db.transaction()` is free. No partial unique index enforces
  "one active version per layer".
- `routes/layers.ts` — `Number('abc')` NaN skips the region check and reaches
  ACE-Step; `routes/songs.ts` LIKE search doesn't escape `%`/`_`.
- `lyricTagProbe.ts` — no backoff on the error path (instant refusals burn all
  retries in a tight loop).
- Storage stat sums everything in `audioDir` (voices, covers) but is presented as
  song storage.
- No `.env` loading (vars must be pre-set in the shell); no Express JSON error
  middleware (default HTML 500s); `fileTags.ts` mutates global
  `Id3v2Settings.defaultVersion`.
- Client `TaskType` union has `'cover-nofsq'`; the server's doesn't.

## ⚪ Process debt

### 18. ~~Module-size hard cap (AGENTS.md: 200 LOC) — current violations~~ — fixed, PRs #71–#75, #77, #81, #82
Recounted 2026-10-02 (`wc -l`, every non-test `.ts`/`.tsx` under `client/src`
and `server/src`; 215 files). Since the 2026-07-31 snapshot `api.ts` (601) was
split into `client/src/api/` (PR #25) and `generationStore.ts` fell to 188.

**Over the 200 hard cap (8)** — each gets a pure `refactor:` PR splitting it by
responsibility (no behaviour change; every resulting file ≤150):

| Module | LOC | PR |
|---|---|---|
| `server/src/services/acestep.ts` | 539 | #74 (merged) |
| `client/src/settings.ts` | 329 | #75 (merged) |
| `client/src/Editor.tsx` | 320 | #82 |
| `client/src/App.tsx` | 317 | #77 (merged) |
| `server/src/routes/generate.ts` | 298 | #72 (merged) |
| `server/src/services/jobs.ts` | 283 | #73 (merged) |
| `server/src/services/stemSplit.ts` | 282 | resolved by #81 (runners moved to `stemRunners.ts`); #76 closed |
| `server/src/services/repaintJobs.ts` | 235 | #71 (merged) |

#72 and #82 were merged with the fixes that touched the same files (#84, #83)
before landing. With #82 in, no non-test module is over the cap: recounted on
main + #82, 266 files, largest 195.

**Over the 150 target, under the cap (27, recounted with #82)** — no action
required by policy; split opportunistically when a feature touches them:
`client/src/Waveform.tsx` 195 · `client/src/generationStore.ts` 188 ·
`client/src/SongDetailRail.tsx` 188 · `server/src/services/lyricTagProbe.ts` 187 ·
`client/src/api/types.ts` 187 · `client/src/CreateArrangeTab.tsx` 182 ·
`client/src/lyricTagGuide.ts` 180 · `client/src/editorJobStore.ts` 179 ·
`client/src/AddLayerTrigger.tsx` 179 · `server/src/services/stemSplit.ts` 178 ·
`client/src/VersionHistory.tsx` 177 · `client/src/SettingsPanel.tsx` 176 ·
`server/src/routes/songs.ts` 175 · `client/src/previewPlayback.ts` 173 ·
`client/src/createDraftStore.ts` 173 · `client/src/LayerLane.tsx` 172 ·
`server/src/services/stemRunners.ts` 171 · `server/src/routes/engineCovers.ts` 168 ·
`client/src/mix/playbackEngine.ts` 167 · `client/src/SplitPanel.tsx` 165 ·
`client/src/lyricTags.ts` 163 · `server/src/services/engineTranscribeClient.ts` 160 ·
`client/src/CreateView.tsx` 160 · `client/src/ScratchSplitPicker.tsx` 159 ·
`client/src/CreateAudioTab.tsx` 156 · `client/src/ShaderCanvas.tsx` 151 ·
`client/src/Editor.tsx` 151.

(`client/src/index.css` — same lesson, outside the letter of the policy and out
of scope here. Vendored third-party code such as `yue-server/upstream/` is not
ours to split.)

### 19. ~~No Playwright e2e exists~~ — fixed, PR #87
AGENTS.md requires one golden-path e2e per phase; none was set up. Now `e2e/`
holds Playwright plus a fake ACE-Step (`e2e/fake-acestep/`), and `npm run
test:e2e` drives PLAN.md Phase 10's path (generate → repaint a region → add a
layer → revert a version → export) through the real client and server on a
throwaway data dir. `.github/workflows/e2e.yml` runs it on every PR into
`main`. Still open: per-phase edge-case specs (PLAN.md "Playwright
Golden-Path E2E", open questions).

### 20. Untested critical modules
`server/src/routes/`: songs (main flows beyond cover-art), layers, remaster,
lyricTags, outputMetadata. `server/src/services/`: lyricTagProbe,
referenceAudioResolve. `client/src`: `mix/playbackEngine.ts`,
`usePlaybackEngine.ts`, `generationStore.ts`, `apiStatusStore.ts`,
`remasterResult.ts`.

---

**Suggested next PRs:** #1 (playback end — small, user-visible), #2 (stem
overwrite — data loss), #4 (silent editor failures), #3 (demucs-server hygiene).
