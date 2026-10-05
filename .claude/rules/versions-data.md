---
paths:
  - "server/src/db/**"
  - "server/src/services/versionFiles.ts"
  - "server/src/services/songPersist.ts"
  - "server/src/services/score/scoreVersion.ts"
  - "server/src/services/score/scoreSource.ts"
  - "server/src/routes/versions.ts"
---

# Versions and stored data

- Schema changes are additive: new columns via `ensureColumn` in
  `db/index.ts`; never rewrite or drop a column in place.
- Score versions are ordinary `versions` rows whose `params_json` carries
  `score_v` (D-037). An additive field needs no bump (readers treat a
  missing field as absent). A shape change bumps `score_v`, the reader
  handles both shapes, and a Vitest named for the trap proves it.
- First-take params have no `score_v`; the same resolver reads them.
- Each version may have a `${versionId}.abc` sidecar in `audioDir`,
  deleted with the version (`versionFiles.ts`).
- For a score version the sidecar is load-bearing: write it before the
  version row; a failed write fails the render and leaves no version
  (D-038). First takes keep their best-effort write.
- Every change of the active base version (activate, and deleting the
  active one) restores the song's bpm, key, meter and length through
  `restoreScoreMeta` (D-053 e); deleting falls back before the row goes.
