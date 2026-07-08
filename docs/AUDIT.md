# Mulakai — Code Audit

> Snapshot taken 2026-07-08. Type-checks pass on client + server; all 127 tests green.
> These are logic, security, and consistency issues that tooling doesn't catch.
> Ordered by severity. Line references were accurate at snapshot time — re-verify before fixing.

## 🔴 Security

### 1. Server binds to all interfaces, not localhost — with no auth
`server/src/index.ts:33` — `app.listen(config.port, …)` omits the host, so Node binds to
`::`/`0.0.0.0` (all interfaces), while the log claims `http://127.0.0.1`. With zero auth, any
LAN host can list/delete songs, upload files, and trigger GPU generation. `/audio` static mount
(`index.ts:28`) exposes every stored file.
- **Fix:** `app.listen(config.port, '127.0.0.1', …)`. Env-gate any wider bind only if truly needed.

## 🟠 Correctness

### 2. Add Layer silently ignores a user-pinned seed
`server/src/routes/songLayers.ts:32-33` reads `use_random_seed` from **multipart** form-data (the
string `"false"`) but compares `use_random_seed === false` — always false, so `use_random_seed:false`
and the explicit `seed` are dropped. Add Layer always uses a random seed. The pattern was copied from
`layers.ts:73-74` (repaint), a **JSON** route where the boolean comparison is valid.
- **Fix:** `const fixed = String(use_random_seed) === 'false';` and gate on `fixed`, or run the body
  through the same coercion `generate.ts` uses.

### 3. Boolean form fields decoded with `Boolean(string)`
`songLayers.ts:27-28` — `Boolean(thinking)` / `Boolean(use_format)` on multipart strings.
`Boolean("false") === true`. Latent today (client's `addLayerParams` doesn't send these) but a landmine.
- **Fix:** `String(thinking) === 'true'`.

### 4. Booleans reach ACE-Step as strings only on the multipart path
`pickMultipartParams` (`generate.ts:48-53`) coerces numeric fields but leaves
`thinking`/`use_format`/`use_random_seed` as strings; `releaseTask`'s FormData branch
(`acestep.ts:251-253`) sends them via `String(v)`. Plain JSON generate sends real booleans; a generate
*with reference-audio upload* sends `"false"`/`"true"`.
- **Fix:** coerce the boolean fields in the multipart path before submitting.

## 🟡 Resource leaks

### 5. Cover-art files orphaned on permanent deletion
`trashSweep.ts:9-21` `deleteSongsPermanently` unlinks version `audio_file` but never the song's
`cover_art_file`. Every trashed song with cover art leaks its image (and inflates the storage stat).
- **Fix:** also select + `fs.rm` `cover_art_file` in the same loop.

### 6. WebGL context leak / exhaustion in `ShaderCanvas`
`client/src/ShaderCanvas.tsx:105` creates one `webgl2` context per instance; cleanup (`:142`) deletes the
program but never calls `loseContext()`. Each AI toggle + the new `AiEnhanceBadge` mount their own canvas;
browsers cap ~16 contexts, so repeated AI-ENHANCE toggling can hit "oldest context lost" and blank the shader.
- **Fix:** on cleanup `gl.getExtension('WEBGL_lose_context')?.loseContext()`. For the tiny badge, prefer a
  shared context or a CSS gradient over a full fragment shader per pill.

### 7. Split poll never terminates
`editorJobStore.ts:157-180` polls `splitStatus` every 2s indefinitely, exiting only via `cancelSplit`/
supersession. A finished-but-not-cancelled split keeps polling for the life of the page.
- **Fix:** stop on `status === 'done'`; re-arm only when a re-extract is actually triggered.

## 🔵 Inconsistencies

### 8. Shader introduces a non-palette color while its comment claims it doesn't
Working-tree change `ShaderCanvas.tsx:63` renamed `carbon` → `amber = vec3(0.233,0.160,0.75)`, which is a
blue-violet (≈ rgb 59,41,191), not amber and not a locked hue. The comment above still claims no new colors,
and AGENTS.md/DESIGN.md forbid new hues.
- **Fix:** use a locked token, or add the accent to DESIGN.md in the same change and name it correctly.

### 9. `schema.ts` no longer describes a fresh DB
Base `songs` DDL (`schema.ts:3-15`) omits `comment`/`genre`/`album`/`cover_art_file`; they exist only via
`db/index.ts:21-24` `ensureColumn`.
- **Fix:** add columns to `CREATE TABLE`; keep `ensureColumn` for migrating old DBs only.

### 10. `TaskType` unions differ client vs server
Client `api.ts:39` has `'cover-nofsq'`; server `acestep.ts:4` doesn't.
- **Fix:** one canonical list / shared constant, or drop the unused member.

### 11. Module-size policy stated but widely exceeded
AGENTS.md sets 150 LOC target / 200 hard cap; 13 non-test modules exceed 200 (`api.ts` 462,
`acestep.ts` 386, `CreateView.tsx` 314, `Editor.tsx` 284, `stemSplit.ts` 270, `jobs.ts` 238, `App.tsx` 235, …).
- **Fix:** split the largest, or amend the policy to acknowledge legitimate exceptions so doc + code agree.

## ⚪ Minor / polish

### 12. "Storage" stat counts everything in `audioDir`
`songs.ts:44-56` sums all files (incl. voices, cover art) but presents it as song storage. Relabel or scope.

### 13. Probe failure loop has no backoff
`lyricTagProbe.ts:141-164` spins with no delay on the error path; instant connection refusals burn all 10
retries in a tight loop. Add a short sleep on catch.

### 14. Popover position computed once, ignores scroll/resize
`LyricTagGuidePopover.tsx:30-33` reads `getBoundingClientRect()` at render with a hardcoded 460px width;
scrolling while open strands the flyout. Recompute on scroll/resize or anchor to the button.

---

**Suggested first PR:** #1, #2, #3, #5 — all server-side, low-risk, small, with existing test patterns.
