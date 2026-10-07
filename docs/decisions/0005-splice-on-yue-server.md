# 0005 · The chat's splice runs on yue-server as a `splice` job

Date: 2026-10-06 · Status: accepted (assumed by the architect, D-107) · Source: SP-4 RESULT, D-080, D-098, F-047

## Context

C0 splices a single-REHARMONIZE edit into the current version (SP-4's A3: groove-snapped downbeat cut, 1-beat
equal-power crossfade, level-matched span). It needs: downbeats and chord rows of the base and of the new render
(SheetSage2), the score's per-bar chords and bar count of both scores to fit bar → seconds on the unedited bars, and
numpy/scipy DSP (K-weighted LUFS, STFT onset envelopes, cross-correlation, crossfades).

## Decision

A `splice` job kind on yue-server (`/v1/splices`, same auth, queue, Idempotency-Key and upload sweep as
`/v1/transcriptions`), ported from SP-4's `sp4lib.py` / `splice_all.py` into `splice_dsp.py`, `splice_grid.py`,
`splice_plan.py`, `splice_job.py`, `splice_routes.py`. The server's `chat/spliceRenderJob.ts` holds one `scoreRender`
GPU slot for render + grids + splice, uploads the base audio, names the YuE2 render by its job id (its audio never leaves
yue-server), passes the cached base grid (`${versionId}.grid.json` sidecar), and saves the result like any render. When
the join cannot be aligned the whole render is saved, labelled (D-101). `scipy==1.18.0` joins yue-server's requirements
(numpy ≥ 2.0, Python ≥ 3.12; the yue2 venv has numpy 2.2.6).

## Alternatives

- **In the Mulakai server (TypeScript + ffmpeg).** The grid fit reads ABC (per-bar chords), which decisions/0002 keeps on
  yue-server; the DSP would be re-implemented in TS with no numpy and no test lineage to SP-4's numbers.
- **A separate splice process in the SheetSage2 venv** (it has numpy 1.24 and scipy 1.13). One more process to start,
  configure and fake, and the score fit would still need yue-server's parser across a process boundary.
- **A subprocess of yue-server in the SheetSage2 venv**, like `infer.py`. Avoids touching the yue2 venv, but splits the
  splice across a CLI contract and two interpreters for code that is pure numpy.

## Consequences

- yue-server gains scipy in the yue2 venv (a setup step: `~/yue2/.venv/bin/pip install scipy==1.18.0`) and in
  `requirements-test.txt`; the pytest suite still runs on Windows with no GPU (synthetic audio + SP-4's recorded lab rows).
- The splice is exact on the float32 output; the saved file keeps it for WAV/FLAC library formats, not MP3.
- C1's analyze job will write the same grid sidecar, so the cache is not thrown away.
- Revisit if the owner's listen rejects A3 (F-047 is re-cut) or if YuE2 and SheetSage2 cannot share the card.
