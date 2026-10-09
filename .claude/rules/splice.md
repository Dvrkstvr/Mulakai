---
paths:
  - "yue-server/splice_*.py"
  - "yue-server/tests/test_splice_*.py"
  - "server/src/services/chat/*plice*.ts"
  - "server/src/services/chat/gridCache.ts"
---

# Splice (SP-4's A3)

Source: `pipeline/spikes/SP-4-keep-unchanged/RESULT.md` "What the real build
should copy"; placement: docs/decisions/0005.

- The splice runs on yue-server (`/v1/splices`); it reads ABC, so it stays
  next to the score parser (docs/decisions/0002).
- Cut at the span's first/last downbeat (grid fitted on unedited bars), snap
  by the 40-5000 Hz onset-pattern lag (corr ≥ 0.15, cap 80 ms), 1-beat
  equal-power crossfade centred on the cut; the new span's gain is held per
  bar to the base (D-147: a two-end ramp left song A's chorus 1-2 dB loud).
  Level matching is not optional.
- Every base sample outside the crossfades must equal the base (null test on
  the written file). No usable groove at both joins = `not_aligned` (D-109).
- 48 kHz float32 stereo throughout; the server transcodes the result.
- Spliced (D-154, `spliceEligibility`): REHARMONIZE (render + splice), CUT
  and REPEAT (audio only, no render) on 4/4 songs with chords. REPEAT with a
  seam step over 4.0 dB, and every `not_aligned`, answers `rerender`; a
  REPEAT of the last section is never spliced (its last bar is the ending,
  D-213). REWRITE LYRICS, WRITE PHRASE and everything else re-render the
  whole song (D-150: the new take's voice is heard).
- Several spans (C4, D-263..D-267): the server's pure `spliceSteps.ts` alone
  decides the steps (merge, 2-4 limit, last bar first); yue-server validates
  and maps bars (`splice_chain.py`), never re-plans. One job, one render at
  most; any step not `ok` = `rerender` for the whole plan, never a partial file.
- Tests: synthetic audio + SP-4's recorded lab rows; never real model calls.
