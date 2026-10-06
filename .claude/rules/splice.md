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
  equal-power crossfade centred on the cut, linear-in-dB gain ramp matched
  over 3 s at both ends. Level matching is not optional.
- Every base sample outside the crossfades must equal the base (null test on
  the written file). No usable groove at both joins = `not_aligned` (D-109).
- 48 kHz float32 stereo throughout; the server transcodes the result.
- Only single-REHARMONIZE plans on 4/4 songs are spliced in C0
  (`spliceEligibility`); everything else re-renders the whole song.
- Tests: synthetic audio + SP-4's recorded lab rows; never real model calls.
