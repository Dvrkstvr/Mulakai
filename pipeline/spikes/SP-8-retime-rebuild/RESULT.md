# SP-8 · Re-time a transcription by correcting saved beats and rebuilding (R-038)

**Question.** Can a transcription with a wrong beat (half/double time, wrong BPM) be fixed by correcting SheetSage2's saved
beat list and rebuilding the ABC from the same saved outputs, CPU only, in seconds, no model re-run?

**Criterion** (given, made explicit): for half / double / named-BPM, on >= 2 real outputs, in melody-only and chords modes:
ABC builds without error; passes yue-server's own validation (`scores.prepare_score` = vendored `abc_tools.parse_abc`);
bar count moves as expected (half, double, ratio); melody note count roughly preserved (>= ~90%); `Q:` matches the new
tempo; chords and `% section` labels survive; wall time well under 10 s.

## Verdict
| mode | verdict | note |
|---|---|---|
| DOUBLE (insert midpoints) | **proven** | 4/4 songs, 0 notes lost, bars exactly x2, chords and sections intact, ~15-25 ms |
| HALF (keep every 2nd beat) | **partly** | builds and validates 4/4, bars exactly /2, but the builder's fixed 4-subbeats-per-beat grid drops 9% (ellies), 13% (purple), 26% (B_d), 19% (eventide Ins) of notes shorter than one coarse subbeat. Needs a MIDI repair pass (below) and the dropped count surfaced |
| BPM grid (named BPM) | **partly** | builds, validates, Q and bar ratio exact. A grid at or above detected tempo loses 0-3% of notes; a slower one (x2/3) loses 5-24%, same cause as half. Single first-downbeat anchor is enough; re-anchoring at structure boundaries is worse (below) |

R-038 overall: **partly proven**. The method works with no model re-run, in ~15 ms from a 24 KB bundle; the one real
defect is note loss on slower grids, fixable in our own pre-pass. Not disproven; feasibility stays green.

## Evidence (all *seen running*: SheetSage2 venv python 3.11, WSL Ubuntu-24.04, real outputs, no GPU, no yue-server)
Inputs (copies in WSL `~/sp8/<name>/notation`): `ellies` 4/4, 176 beats, 75 BPM; `purple` 4/4, 1/8 lead-in row, 87 BPM;
`eventide` 2/4, 65 BPM (melody lands in the Ins voice); `B_d` (SP-4, 179 s) 4/4, 1/8 lead-in row, 93.7 BPM.
Run: `bash run.sh ellies purple eventide B_d` -> `out_all.txt` (one JSON line per variant x mode); `python summ.py` prints the table;
`chk.sh` compares chord/section sequences.
- Identity: the `melody_only=True` rebuild of the *unchanged* files is byte-identical to the saved `score.abc` (all four). The saved
  bundle is a faithful source, and these fixtures were melody-only runs.
- Wall time of `generate_abc_from_exports`: 7-25 ms (B_d, the longest, 14-25 ms). melody_only on/off makes no difference.
- Bars (same in both modes): ellies 44 -> half 22 / double 88; purple 65 -> 33 / 129; eventide 80 -> 40 / 160; B_d 71 -> 36 / 140.
  Q: 75 -> 37 / 150, 87 -> 44 / 174, 65 -> 33 / 130, 93 -> 47 / 186 (rounded to int).
- BPM grid, ellies: detected 75, x2/3 = 50 -> 29 bars (44 x 0.67), `Q:1/4=50`; round 80 -> 47 bars (44 x 80/75), `Q:1/4=80`.
  A grid at the exact detected mean BPM reproduces the base bar and note counts (all four).
- Chords: the de-duplicated chord-symbol sequence equals the unchanged rebuild's for every variant (similarity 1.00; ellies 60,
  purple 35, eventide 62, B_d 72 runs). Raw `"chord"` count grows with bar count (symbols repeat per bar): expected.
  Sections `% intro % verse % chorus % verse % chorus % outro` keep count and order.
- yue-server validation: every successful build passes `prepare_score(abc, "melody")`.
- Bundle `generate_abc_from_exports` reads: `song_melody.mid` 3.5-4 KB, `song_beats.txt` 3.5-5 KB, `song_chords.txt` ~1.4 KB,
  `song_keys.txt` 32 B, `song_structures.txt` 0.3 KB. **Whole notation/ dir: 24 KB on disk (about 9 KB of bytes).**
  Melody-only mode still needs the chord/key files to exist (`preflight_exports`) but ignores their content.

## Beat-transform rules that worked (`retime.py`)
Rows are `time, beat_in_bar, numerator, denominator`. `renumber()` cycles beat_in_bar 1..numerator and restarts when the meter changes.
- **Lead-in stub**: a leading row whose meter differs from the song's main meter (purple, B_d: `1/8`) is kept untouched, never halved,
  never given a midpoint. (A midpoint after it inherited 1/8 and flipped the header to `M:1/8` with 130 bars: fixed by skipping.)
- **HALF**: keep the lead-in rows, then every 2nd beat starting at the first detected downbeat (pre-downbeat beats phase-aligned to it);
  renumber with the same meter. Every other old downbeat stays a downbeat.
- **DOUBLE**: insert the midpoint between every consecutive same-meter pair; none after the last beat; renumber.
- **BPM**: lead-in kept; beats at t0 + k*60/BPM from the first detected downbeat t0 to the last detected beat; renumber from 1.
  Re-anchoring at each structure start (`anchors="struct"`) adds odd bars ("inferred 1/4 / 2/4 from downbeat span", +3 bars on ellies, B_d
  header flips to 2/4) with no gain: **use the single first-downbeat anchor.**
- **MIDI repair (required for half and slower grids)**: `fit_midi()` snaps notes to the 4-per-beat grid exactly as `_notes_to_arr` does,
  stretches a note that collapses to zero length to one subbeat, drops it if the next subbeat is taken, truncates an earlier note on
  overlap, and writes the copied `song_melody.mid`. Without it the builder **raises** `MelodyVoiceError: ... cannot be represented on
  the decoded subbeat grid` (ellies half and x2/3 failed this way first).

## The call
```python
# <dir> = copy of the saved notation/ dir with song_beats.txt rewritten and song_melody.mid passed through fit_midi()
abc, score, _ = generate_abc_from_exports(<dir>/"song_melody.mid", meter_conflict="infer",
                                          melody_only=<True for covers, False for chat readings>)
prepare_score(abc, "melody")   # yue-server's own validation
```
`generate_abc_from_data(...)` takes the parsed arrays and would avoid the temp dir; not tried.

## Failure modes / surprises
- Note loss on slower grids is inherent to `SUBBEAT_DIVISION = 4`: slowing the tempo makes short notes shorter than one subbeat.
  `SUBBEAT_DIVISION = 8` is not a free knob: tried by monkeypatch, every variant fails with `AbcRebuildError: measure 0 ... duration 32
  does not match meter duration 16` (ABC unit length is tied to 4). A finer half-time grid would be a SheetSage2 change.
- Header `M:` is the first measure's meter: B_d is `M:2/4` in the *original* `score.abc` too (pickup), so 2/4 vs 4/4 flips on B_d across
  variants are pickup inference, not breakage. Bar counts are still right.
- Detected beats follow the audio (B_d: gaps 0.64-0.66 s, 1.4 s cumulative deviation from a constant grid at the median gap). A typed BPM
  slightly off the true one drifts; half/double keep the detected jitter and are the safer fixes. Offer x2 and /2 first, a typed BPM second.
- Chord symbols re-snap slightly when the grid changes (purple `bpm_mean`, chords mode, raw count 86 vs 64, same sequence). Cosmetic.
- Not tested: 3/4 or 6/8 songs, a mid-song meter change, a listen-back of a re-timed score (the ear is the owner's, R-039 territory).

## What the real build should copy
1. Mulakai server keeps each transcription's `notation/` bundle (24 KB) plus `result.json`/`score.abc`, so re-time works after yue-server's 24 h sweep.
2. A CPU-only yue-server route (e.g. `POST /v1/scores/retime {bundle, mode: half|double|bpm, bpm?, melody_only}`) built from `retime.py`'s
   `renumber / lead_in / half / double / regular / fit_midi` and the call above; it returns `{abc, measures, vocal_notes, ins_notes,
   dropped_notes, bpm}` and runs without the worker, like `/v1/scores/midi`.
3. Show `dropped_notes` / total before commit; warn above about 10%.
4. Keep `meter_conflict="infer"`, the lead-in stub rule and the single anchor; no structure re-anchoring.
5. Stay at the beat-file layer, not ABC reshaping: decision 0002 holds, no TypeScript port.
