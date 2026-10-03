# SP-3 · cot=full audible adherence (R-013, R-014, residue of R-010)

Run 2026-10-03, RTX 4080 16 GB, Windows 11 + WSL2 Ubuntu-24.04, real yue-server (YuE2-3B, bf16, default budget, seed = the library version's own seed), SheetSage2 (`~/sheetsage2`, full task: melody + chords + beats) for re-transcription. Evidence level: *seen running*, on the real model. Two runners: the first rendered 18 variants and wrote the analysis; this run (D-016) added the cot=melody control renders, re-ran the analysis over all 21 renders and checked the listen page.

## Question

When YuE2 is given a hand-edited, validated ABC score with `cot` full (no LLM in the loop, so only YuE2 is measured), does the render audibly follow the edit: new chords on reharmonized bars, new `Q:` tempo, a repeated chorus, a written `Ins` phrase; while melody outside the edit stays put; and how much does an unchanged score drift on re-render?

## Criterion (risks.md SP-3, unchanged)

(b) edited-bar chord agreement clearly above chance and not below unedited-bar agreement; (c) tempo within 4% of the new `Q:`; (d) section count matches; (e) `Ins` notes present in the phrase window; melody F1 outside edits >= 0.9; and the user hears the change in >= 4 of 5 owed A/B pairs (**OWED**, below). (a) measures drift (R-014).

## Verdicts

| risk | verdict | one line |
| --- | --- | --- |
| R-013 audible adherence | **proven on the machine side, qualified on harmony; user listen OWED** | tempo, repeat and `Ins` phrase pass cleanly; harmony roots followed on 2 of 3 songs (all 8 bars), 3 of 8 on the third, chord quality not resolvable; cot=melody control shows the harmony adherence is caused by `cot` full |
| R-014 re-render drift | **proven (measured): small, non-zero** | unchanged score re-render: chord roots 98-100% of score, melody F1 0.92-0.985 vs the original render; outside an edit melody F1 vs the unchanged re-render 0.90-0.98 |
| R-010 residue (render path audio) | **proven** | `cot` full + edited `abc` renders with no re-planning (0 abc tokens), no `truncated`, no 422, in 21 of 21 jobs |

Strict reading of (b): met at root level for songs A and C (edited 1.00 vs unedited 1.00), **not met for song B** (0.375 vs 0.98, though above chance), and not met at root+quality level anywhere (0.75 / 0.375 / 0.625 vs ~1.0), because SheetSage2 labels dominant 7ths and half-diminished as minor/triad and the intended qualities cannot be told apart by it. So the harmony clause holds in "the root moves where asked, usually", not "the chord is exactly as written". The fallback text for REHARMONIZE ("a request to YuE2, not a guarantee") stays right.

## Evidence

Renders: 3 songs x variants `a0` (original request, exact), `a` (unchanged score, normalized lyric tags), `b` (8 bars of the first chorus reharmonized, cot full), `bm` (same score as `b` but `cot` melody = control), `c` (`Q:` +15% + style text), `d` (first chorus repeated, lyrics block repeated), `e` (4-bar tenor-sax phrase in `Ins` over `Vocal` rests, "tenor saxophone" in style). 21 jobs, all `succeeded`, none truncated; 65-100 s each (B_bm 295 s, C_bm 646 s: the card was shared with something else at that time, inferred). Semantic tokens 3,934-5,898 (cap 9,000). Songs: A `2c944049` 87 BPM 4/4 65 bars; B `3820c535` 93 BPM 2/4 63 bars; C `c8144c53` 85 BPM 4/4 77 bars. Raw numbers: `results.json`, `logs/analyze.out`, `logs/run_renders.log`; scores in `scores/`, job bodies in `jobs/`, edit windows in `edits.json`. Alignment: audio bar j <-> score bar j-o, o chosen on unedited bars only; chance = same edited-bar chords vs every other bar offset (>= 4 bars away), mean and p95.

### (b) Chord adherence on reharmonized bars (cot=full, `b`) vs the control (`bm`, cot=melody)

| song | unedited root | edited root (b) | chance root mean / p95 | edited root vs OLD chords (b) | `bm` edited root vs NEW | `bm` edited root vs OLD |
| --- | --- | --- | --- | --- | --- | --- |
| A | 1.00 | **1.00** (8/8) | 0.21 / 0.375 | 0.00 | 0.375 | 0.00 |
| B | 0.98 | **0.375** (3/8) | 0.09 / 0.25 | 0.50 | 0.00 | **1.00** |
| C | 1.00 | **1.00** (8/8) | 0.07 / 0.27 | 0.00 | 0.00 | **1.00** |

- The unchanged render's own chords on those bars match the OLD chords 8/8 and the NEW ones 0/8 (all three songs): the model really re-harmonizes; this is not the transcriber agreeing with anything.
- Control: with `cot` melody (chords stripped by yue-server), B and C reproduce the *original* harmony on every edited bar (same seed + same melody), i.e. the new chords reach the audio only through `cot` full. A's control drifts to other chords (Bb maj7 where the original had Dm), matching neither, and its whole-song agreement with the sidecar chords falls to 0.57: `cot` melody leaves harmony free.
- Quality: root+quality 0.75 / 0.375 / 0.625; chord-tone Jaccard on edited bars 0.76 / 0.64 / 0.71 vs chance 0.41 / 0.34 / 0.33 (p95 0.52 / 0.44 / 0.45). Dominant sevenths come back as minor triads (A7 -> `A:min`) and Em7b5 as `E:hdim7` / `E:dim`; whether that is the transcriber or the model is not separable here.
- B (2/4, bar-aligned worst): only 3 of 8 bars took the new root; bars 23, 24, 27, 28 kept the old chord. Two-bar chord changes in a short meter look weaker than one per bar in 4/4 (inferred from one song).

### (c) Tempo (variant `c`, `Q:` +15%)

| song | new Q | SheetSage2 `Q:` | tempo from median bar length | from duration |
| --- | --- | --- | --- | --- |
| A | 100 | 100 | 100.0 (0.0%) | +1.4% |
| B | 107 | 107 | 107.1 (+0.1%) | +1.2% |
| C | 98 | 98 | 98.0 (0.0%) | +1.3% |

All within 4%. The same ~1.3% duration shortfall appears in the unchanged render, so it is a constant, not a tempo error. Audio bar count equals the score's or is off by one (A `b`/`c`/`e`: 66 vs 65; B `e`: 62 vs 63; pickup/transcriber).

### (d) Repeat (variant `d`) / section count

Audio bar count equals score bar count exactly (A 81/81, B 71/71, C 85/85); duration -3.2% / -0.6% / -1.7% of nominal (A's repeat is the shortest, still fine). The repeated chorus is a faithful copy: melody F1 of copy vs first chorus 0.97 / 0.99 / 0.95; added-bar chord roots 1.00 on all three. **Measurement note:** SheetSage2's `structure.lab` section count does not track the score at all (unedited `a0`: 13 sections for a 6-section score in B, 5 for 4 in A), so "section count matches" is judged by bar count and chorus-copy similarity, not by structure labels.

### (e) `Ins` phrase (variant `e`)

Instrumental-stream notes in the 4-bar window: 20 / 23 / 16 (+5 on the vocal stream in C). Pitch-folded F1 vs the written phrase: **0.93 / 0.80 / 0.81** (both streams for C: 0.95); chance (same phrase against other 4-bar windows) mean 0.10 / 0.02 / 0.01, p95 0.21 / 0.14 / 0.03; F1 vs the OLD `Ins` content 0.13 / 0.09 / 0.06. Exact-octave F1 is lower in A (0.68): SheetSage2 transcribes the sax an octave off. Phrase present and recognisably the written notes in 3 of 3. The instrument is not verified: SheetSage2 gives pitches, not timbre. "Tenor sax" is a **listen item**.

### Melody outside the edit (>= 0.9)

F1 vs the score outside the edit window, exact / octave-folded: `b` 0.90 / 0.92, 0.95 / 0.95, 0.87 / 0.98; `c` 0.79 / 0.93, 0.96 / 0.96, 0.88 / 0.96; `d` 0.93 / 0.93, 0.96 / 0.96, 0.88 / 0.98; `e` 0.69 / 0.92, 0.95 / 0.97, 0.88 / 0.98. Folded >= 0.92 everywhere (min 0.904 vs the unchanged re-render); exact < 0.9 in C (also 0.88 for the unedited original: a transcriber octave habit) and in A `c`/`e` (0.79, 0.69: a real octave shift of part of the melody in the transcription, not seen in A `b`/`d`). Pass at folded level and relative to the unchanged render (0.94-0.98); fails exact in 4 of 12 (octave placement, flagged).

### (a) Drift (R-014)

- `a0` (the original request exactly) transcribes byte-identically to the library original (chord.lab and melody MIDI identical for A, B, C): same request + same seed is deterministic.
- `a` differs from `a0` only by lyric tag normalization (`[Verse 1]` -> `[Verse]`, `[Intro: Piano]` -> `[Intro]`), and that alone changes the take: melody F1 vs `a0` (folded) 0.92 / 0.96 / 0.99, instrumental stream down to 0.88 in A; chord roots vs score 1.00 / 0.98 / 1.00; duration within +/-0.8 s.
- Outside an edit window, melody vs the unchanged re-render (folded): `b` 0.91 / 0.94 / 0.97, `e` 0.90 / 0.95 / 0.98, `d` 0.92 / 0.95 / 0.97 (after shifting for the added bars). So: edits change untouched bars a little (melody mostly kept, ~2-10% of notes move), never byte-for-byte.

## OWED: user listen (does the user hear the change in >= 4 of 5 pairs?)

`listen/index.html` (open from disk; 12 pairs: reharmonize, tempo, repeat, write-phrase for each of A, B, C). Each pair is the original library render vs the render from the edited score (same seed), A/B order shuffled, answer clearly / slightly / no, then press reveal; a tally is at the top. Criterion: change heard in >= 4 of 5 pairs; the reharmonize pairs for B (`B_b`, only 3 of 8 bars moved) and the sax pairs (`A_e`, `B_e`, `C_e`: is it a saxophone?) are the informative ones. Rebuild with `peek2.sh` (needs ffmpeg + the sheetsage2 venv). Until the user answers, the "audible" half of R-013 stays owed. The same pipeline feeds SP-2's owed WRITE PHRASE musicality check (`*_e` pairs).

## What the real build should copy

- Request builder for score ops: `abc` = the edited native-dialect score, `cot` = `full`, original seed, style text and lyrics from the version row; lyrics section tags taken from the score's `% section` comments (R-018). Confirmed working: yue-server logs "Using provided score", `abc` tokens 0, no replan. Do not reuse `buildYue2CoverRequest`'s `cot: 'melody'` for harmony ops (control: chords then reach the audio only by luck).
- Copy `analyze.py`'s checks as the post-render "did it take?" report: per-edit-window root agreement vs the same chords at other offsets, bar count vs score, `Q:` from median bar length, melody F1 outside the window (fold octaves). Use bar-length tempo, not `structure.lab` or duration.
- Consequence lines: SET TEMPO and REPEAT are reliable ("will be about `Q:`; whole song re-renders"); WRITE PHRASE notes arrive but the instrument is a request; REHARMONIZE roots usually move, qualities (7ths, half-diminished) may come back as plain triads. Keep the pre-edit version one click away and offer the A/B.
- Duration guard (R-019): the repeated-chorus renders added 8-16 bars (+22% length in A, +14% in B, +10% in C) and stayed under 6,000 semantic tokens, untruncated; the guard still needs the duration estimate for longer songs.

## Surprises

- Same request + same seed reproduces the original render exactly; changing only `[Verse 1]` to `[Verse]` changes the take by 2-8% of notes. Any silent lyric-tag cleanup is itself a drift source.
- With `cot` melody, same melody + same seed returns the old harmony bar for bar in B and C (and different, unrelated chords in A), so "melody control" is deterministic only on harmony the first time.
- The reharmonized chords were applied as sevenths/half-dims that the transcriber cannot confirm; root agreement is the only reliable measure with SheetSage2.
- SheetSage2's section structure is useless for section-count checks.
- Slow renders (295 s, 646 s) for two control jobs: the GPU was shared at the time (inferred); nothing to do with the score.

## Limits

Three songs, one hand-made reharmonization each (8 bars, jazz-ish substitutions not guaranteed musical), one seed each, one transcriber with its own error (about 0.88-0.98 against the score on unchanged renders). No LLM-authored scores (SP-2). Everything started for this run (yue-server on 127.0.0.1:8004 in WSL) has been stopped.
