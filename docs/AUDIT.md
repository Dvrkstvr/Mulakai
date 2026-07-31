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

## 🔴 High — broken or data-risky behavior

### 1. Playback never ends
`client/src/mix/playbackEngine.ts` — no `onended` on any `AudioBufferSourceNode`;
after the last buffer plays out, `playing` stays true and `currentTime()` grows past
`duration` forever. Play button shows pause forever; elapsed readout runs on.
- **Fix:** arm `onended` on the longest source (or compare `currentTime() >= duration`)
  and flip to stopped. Add the missing playbackEngine test.

### 2. Demucs re-extract silently overwrites already-claimed stems
`server/src/services/stemSplit.ts` — `reextractStem('demucs')` re-runs the full
4-stem pass with deterministic `${job.id}-${kind}.${ext}` filenames, clobbering the
on-disk audio of stems already claimed as versions. The doc comment ("keeps only
this stem's output") describes behavior the code doesn't implement. Unclaimed stem
files are also never deleted (`cancelSplit` only drops the in-memory job).

### 3. demucs-server blocks its event loop and leaks disk
`demucs-server/main.py` — `demucs.separate.main(...)` runs inside `async def`,
freezing the loop for the whole split (so `/health` reports the service down
mid-job); no try/finally around the split (a corrupt upload leaks the source file
and job dir); `DATA_DIR/<job_id>/` is never cleaned up — four float32 WAVs per
split retained forever, publicly served.
- **Fix:** make handlers sync `def` (FastAPI threadpool), add try/finally cleanup,
  add a TTL sweep or delete-after-claim.

### 4. Silent failures across the Editor
- `client/src/Editor.tsx` — `reload()` is `catch(() => {})`: a failed song load is a
  permanent "Loading…" spinner with no error and no way out but Back.
- `client/src/LayerLane.tsx` — rename/volume/mute/solo PATCHes have no catch;
  volume drag fires a PATCH + full `songDetail` reload per tick.
- `client/src/VersionHistory.tsx` / `SongDetailRail.tsx` — revert and rename/
  comment/folder-move failures are invisible.
- **Fix:** route these through an error surface (rust inline text per DESIGN.md).

## 🟠 Correctness

### 5. Dead controls presented as live
- `client/src/CreateAudioTab.tsx` — cover generation sends only `model` +
  `audio_cover_strength`; the STEPS/GUIDANCE/SEED/advanced panel rendered on that
  tab has zero effect.
- `client/src/CreateArrangeTab.tsx` + `ReferenceAudioPicker.tsx` — AUDIO/STYLE
  INFLUENCE sliders don't apply to `complete` (only the stored voice defaults do),
  but the hint text claims they do.

### 6. Library search race
`client/src/App.tsx` — one un-guarded `listSongs` per keystroke; a slow early
response can overwrite results for a newer query. Debounce + drop stale responses.

### 7. Add Layer bounce: volume index misalignment
`client/src/AddLayerTrigger.tsx` — `audible` filters layers without an active
version, then indexes volumes via the *unfiltered* `activeLayers(layers)[i]`;
neighbors' volumes shift when the lists diverge. (`RemasterAction.tsx` and
`CreateAudioTab.tsx` do the same op correctly with `{layer, version}` pairs.)

### 8. Adapter reconcile race during ACE-Step splits
`server/src/services/stemSplit.ts` fans out four concurrent `runAcestepStem`
calls; each runs `reconcileAdapter()`'s unsynchronized read-check-write —
overlapping `lora/load`/`lora/scale` sequences can reach ACE-Step.

### 9. Repaint crossfade only clamped in the UI handler
`client/src/RepaintBar.tsx` / `settings.ts` — a persisted `crossfadeSec` larger
than the current region's max is displayed and submitted as-is. Clamp at submit.

### 10. Abort/persist race reverses an abort silently
`server/src/services/jobs.ts` — `abortJob` during an in-flight `onSuccess` marks
the job failed, then `poll` overwrites to done. Outcome is harmless (song exists)
but the abort is silently undone.

## 🟡 Resource leaks / unbounded growth

### 11. Job registries never evict
`server/src/services/jobs.ts` / `stemSplit.ts` — `jobs.set(...)` has no paired
delete; every job for the life of the process accumulates.

### 12. WebGL context leak in `ShaderCanvas`
`client/src/ShaderCanvas.tsx` — cleanup never calls
`WEBGL_lose_context.loseContext()`; repeated AI-state mounts accumulate toward the
browser's ~16-context cap, after which shader surfaces go black.

### 13. `generationStore.pollJob` has no cancellation
Keeps hitting `/api/generate/:id` every 2s after `dismiss()` until the server says
done/failed. Similarly `editorJobStore`'s single-job poll has no 404 exit (the
split poll has one).

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

### 18. Module-size hard cap (AGENTS.md: 200 LOC) — current violations
Non-test modules over the cap at snapshot time:
`client/src/api.ts` 601 · `server/src/services/acestep.ts` 522 ·
`client/src/settings.ts` 329 · `client/src/Editor.tsx` 318 ·
`client/src/App.tsx` 318 · `server/src/services/jobs.ts` 289 ·
`server/src/services/stemSplit.ts` 282 · `server/src/routes/generate.ts` 270 ·
`server/src/services/repaintJobs.ts` 246 · `client/src/generationStore.ts` 217.
(`client/src/index.css` is 3,615 lines — same lesson, outside the letter of the
policy.) An `api.ts` split is in progress; the rest need split plans or explicit
justifications per AGENTS.md.

### 19. No Playwright e2e exists
AGENTS.md requires one golden-path e2e per phase; none is set up (no dependency,
no config, no `test:e2e` script).

### 20. Untested critical modules
`server/src/routes/`: songs (main flows beyond cover-art), layers, remaster,
lyricTags, outputMetadata. `server/src/services/`: lyricTagProbe,
referenceAudioResolve. `client/src`: `mix/playbackEngine.ts`,
`usePlaybackEngine.ts`, `generationStore.ts`, `apiStatusStore.ts`,
`remasterResult.ts`.

---

**Suggested next PRs:** #1 (playback end — small, user-visible), #2 (stem
overwrite — data loss), #4 (silent editor failures), #3 (demucs-server hygiene).
