---
paths:
  - "client/src/**/*.ts"
---

# Client (TypeScript)

- `client/src/` stays flat: no subfolder layering (`api/` and `mix/` are
  the existing exceptions).
- Zustand stores, one per concern: `generationStore`, `editorJobStore`,
  `createDraftStore`, `addLayerStore`, `voiceStore`, `adapterStore`,
  `apiStatusStore`, `queueStore`, `activityStore`, `settingsStore` (with
  `settings*.ts`), and the others named `*Store.ts`.
- Server calls go through `api/` (`api/index.ts` and its per-area files).
- Playback is `mix/` (`playbackEngine`, `bounceMix`, `decodeLayers`).
- The job kind union in `api/types.ts` forces a label in
  `activityRunning.ts`'s `RUNNING_LABEL`; add both together.
- Pure logic (reducers, copy builders) gets Vitest tests; components are
  browser-checked.
