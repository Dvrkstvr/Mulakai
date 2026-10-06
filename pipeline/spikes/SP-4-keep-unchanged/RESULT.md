# SP-4 · Keep the unchanged parts of a song through an edit (R-024)

Run 2026-10-06 on the real machine (RTX 4080 16 GB, Windows 11 + WSL2): YuE2-3B through the worktree yue-server (`:8044`, same job API as the app), ACE-Step 1.5 (`acestep-api` `:8051`, turbo, 8 steps), SheetSage2 for downbeats/chords/melody, faster-whisper large-v3 for words. Evidence level: *seen running* unless marked *seen in code* / *inferred* / *unverified*. One engine on the GPU at a time (checked with `nvidia-smi`); every process I started is stopped. Scripts and raw numbers are in this folder; audio is git-ignored.

## Question

Can an edit to one part of a song leave every other bar sounding the same as before, with the edited part as good as a full re-render and the joins not audible? Which way of doing it is good enough to build the chat on?

## Criterion (SPIKE.md pass bar) and how I read it

An approach passes for a kind of edit when, on at least 3 of 4 songs: (1) the unchanged region equals the base, (2) the edited span keeps the full re-render's adherence within 5 points, (3) downbeat error at most 20 ms and LUFS step at most 1 dB at every seam, and (4) in the user's listen the join is not found in at least 4 of 5 pairs. **(4) is OWED to the user; everything below is the machine half.** Readings I had to choose (the plan was not exact about them):

- **(1)** sample-exact outside the crossfade windows, and I report how many seconds of base audio the crossfades touch (0.63-0.70 s for a 1-beat crossfade at 2 seams).
- **(2)** fraction metrics (chord roots on the edited bars, Ins-phrase F1, copy-vs-first-chorus F1): result >= re-render - 0.05. REWRITE LYRICS: Whisper WER on the edited chorus (span +-0.5 s) <= re-render WER + 0.05.
- **(3) downbeat error.** A cut at SheetSage2 downbeats is only as good as the tracker, so I measure (a) the **raw misalignment** a plain downbeat cut would have (lag of the 40-5000 Hz onset pattern 8 beats before vs after the join, normalised cross-correlation, 5 ms frames), then snap the cut by that lag (cap 80 ms, needs correlation >= 0.15), and (b) a **verification** on the output with an independent band (2-12 kHz). Where the check has no usable groove (correlation < 0.25 or lag at the +-150 ms search limit) the seam is "unresolved", never "ok". Floor of the check on the untouched base: median |lag| 3-62 ms, p95 110-150 ms per song, so it cannot prove 20 ms everywhere.
- **(3) LUFS.** Short-term (3 s before vs after the seam, BS.1770 K-weighting, no gating). Read literally the 1 dB bar cannot hold where an edit starts at a section boundary, because the *base* already steps there (song A: +5.4 dB; p95 of the base's bar-line steps is 3.3-4.9 dB). So I give both the literal step and the **excess over the base's own step at the same place**; structure seams (REPEAT/CUT) have no base counterpart and are given raw.
- **Songs.** A Purple Shinings (4/4, 87 BPM, 65 bars), B Romantica (Latin pop, 93 BPM, 2/4 header with a 4/4 body, 63 bars), C Gertar (German, 85 BPM, 77 bars), D Carinito (95 BPM, 64 bars): the M2 listen songs plus Purple Shinings; B stands in for the "2/4" slot. **No 3/4 song was tested.** Base = the library's active version; controls = full re-renders of the edited score (SP-3's b/d/e renders for A-C, 11 new YuE2 jobs for the rest, 44-92 s each, none truncated).
- **Edits.** REHARMONIZE the first chorus (8 bars), WRITE PHRASE (4 bars, tenor sax over rests), REWRITE LYRICS (first chorus, same line count), REPEAT the first chorus, CUT one verse (song A: its only verse, 36 bars). New scores come from the app's own `/v1/scores/apply` route for the new renders (D, and every lyrics/cut), SP-3's hand-made scores for A-C reharmonize/phrase/repeat.

## Verdicts (machine half)

| candidate | edit kind | verdict | why, in numbers |
|---|---|---|---|
| **A, plain splice** (A1 1-beat / A2 1-bar crossfade) | all local | **disproven as sufficient** | 11 of 24 (A1) and 10 of 24 (A2) seams step more than 1 dB beyond the base's own step, max 5.4 dB: the new take sits 3.7-6.0 dB off the old audio at one end of the span in 3 of 12 edits (2.6 dB in 2 more) |
| **A3, splice + level match** (1-beat equal-power crossfade centred on the downbeat, cut snapped to the groove, linear-in-dB gain ramp over the new span matched to the old audio at both ends) | REHARMONIZE | **proven (machine), 4/4 songs** | span chord roots equal the re-render on all 4 (1.00 / 0.375 / 1.00 / 0.875, the re-render's own numbers); seams within 0.6 dB of the base's step; 0 differing samples |
| | WRITE PHRASE | **proven (machine), 3/4** | Ins F1 vs the written notes -4.9 / +8.9 / +14.2 / +5.6 points vs the re-render; song A's exit seam is 1.3 dB beyond the base (fails the 1 dB excess clause) |
| | REWRITE LYRICS | **inconclusive** | Whisper WER on the new chorus vs the re-render: B +2.6 pt, C 0.0, D +5.3 pt (misses by 0.3 pt); song A cannot be read (Whisper WER 1.0 even on the *original* chorus) |
| **B, splice + ACE-Step repaint** of a 3 s window on each seam | local | **disproven (machine) as an improvement over A3** | worse than A3 on span adherence in 8 of 11 measurable cases (chord roots down to 0.125 from 0.375-1.0, phrase F1 -23 points, B-lyrics WER 0.13 -> 0.32); seam level step beyond the base median 0.16 -> 1.5 dB; repainted windows median 1.8 dB quieter, two A windows -7.8 and -13.4 dB; balanced and conservative differ little |
| | REPEAT / CUT seam | **inconclusive** | REPEAT copy-vs-first F1 falls on 3 of 4 (song A 0.93 -> 0.53); CUT unchanged on every measure |
| **C, audio-only REPEAT / CUT** | both | plumbing **proven**, acceptability **inconclusive (ear)** | 0 differing samples; copy-vs-first F1 0.93 / 0.99 / 0.96 / 0.99 vs the re-render 0.97 / 1.00 / 0.95 / 0.99 (within 5 pt on 4/4); no YuE2 render at all (0.2 s of CPU). Level step at the seam: REPEAT +8.5 / -0.1 / +3.5 / -0.3 dB, CUT +0.8 / -1.9 / +3.4 / -1.1 dB: the section-to-section change of the song itself (literal 1 dB met by 2/4 and 1/4) |
| **D, YuE2 forced-prefix** | - | **inconclusive: not run** | gated on A/B failing the machine half for local edits; A3 did not. Revisit only if the owed listen finds the A3 joins |

Machine-only reading of the pass bar: **no candidate passes the literal 1 dB clause** (A3 literal: 0/4 reharm, 1/4 phrase, 0/4 lyrics) because the base's own section steps are larger than 1 dB. With the "excess over the base" reading A3 passes reharm 4/4, phrase 3/4, lyrics 3/4 if song A is counted as unmeasured rather than failed (2/3 measurable). The seam-timing clause is met where it can be checked (below) and unresolvable elsewhere.

## Evidence

### What "the rest moves" costs today (the control)

For each full re-render (today's behaviour), every *unedited* bar compared with the same bar of the base (`results/drift_loudness.json`): 21-87% of bars (median over 12 re-renders 46%) differ by more than 1 dB in loudness, p95 of |delta| is 1.6-7.0 dB, the spectral centroid moves by a median 180-1080 Hz. The splice keeps these at exactly 0 outside the crossfades. Melody F1 hides most of it: transcribing *bit-identical* audio after the file length changed (so the transcriber's chunking shifts) already gives 0.96-0.998, against 0.92-0.986 for the re-renders, so SP-3's "2-10% of notes move" is partly the transcriber; the audible drift is level and brightness.

### Tables (from `results.json`, also `results/tables.md`)

Seam cells: `raw X ms` = what a cut at the tracker's downbeats would have been off by (before the snap); `ok / unres.` = the independent check after the snap (no seam failed; 14 ok, 18 unresolved among the 32 real seams); `LUFS` = literal 3 s step in dB, `ex` = beyond the base's own step.


**Candidate A (A3: 1-beat equal-power crossfade, groove-snapped cuts, level-matched span) on local edits**

| edit | song | span metric: result vs full re-render | rest of song (melody F1, result vs control) | seam 1 | seam 2 | base audio changed |
|---|---|---|---|---|---|---|
| reharm | A Purple Shinings | 1.000 vs 1.000 (+0.0 pt) | 0.964 vs 0.938 | raw -4 ms / ok / LUFS +5.8 (ex +0.4) | raw +1 ms / ok / LUFS +1.1 (ex +0.6) | 0.69 s |
| reharm | B Romantica | 0.375 vs 0.375 (+0.0 pt) | 0.992 vs 0.942 | raw -5 ms / ok / LUFS +4.1 (ex +0.1) | raw +12 ms / unres. / LUFS -2.4 (ex +0.4) | 0.64 s |
| reharm | C Gertar | 1.000 vs 1.000 (+0.0 pt) | 0.995 vs 0.977 | raw +7 ms / unres. / LUFS +1.2 (ex -0.0) | raw -10 ms / ok / LUFS +1.9 (ex -0.1) | 0.70 s |
| reharm | D Carinito | 0.875 vs 0.875 (+0.0 pt) | 0.986 vs 0.953 | raw -2 ms / unres. / LUFS +3.7 (ex -0.1) | raw -9 ms / unres. / LUFS -2.6 (ex +0.2) | 0.63 s |
| phrase | A Purple Shinings | 0.878 vs 0.927 (-4.9 pt) | 0.966 vs 0.924 | raw -8 ms / ok / LUFS +1.0 (ex +0.4) | raw +5 ms / ok / LUFS +1.8 (ex +1.3) | 0.69 s |
| phrase | B Romantica | 0.889 vs 0.800 (+8.9 pt) | 0.994 vs 0.960 | raw -39 ms / unres. / LUFS -0.8 (ex +0.1) | raw +58 ms / unres. / LUFS +0.4 (ex -0.0) | 0.64 s |
| phrase | C Gertar | 0.952 vs 0.811 (+14.2 pt) | 0.998 vs 0.986 | raw -9 ms / unres. / LUFS +2.3 (ex +0.3) | raw -9 ms / unres. / LUFS +3.4 (ex +0.1) | 0.70 s |
| phrase | D Carinito | 0.556 vs 0.500 (+5.6 pt) | 0.991 vs 0.933 | raw +2 ms / unres. / LUFS -0.2 (ex -0.2) | raw -7 ms / unres. / LUFS -2.9 (ex -0.3) | 0.63 s |
| lyrics | A Purple Shinings | 0.950 vs 0.950 (+0.0 pt) | 0.975 vs 0.958 | raw +4 ms / ok / LUFS +5.3 (ex -0.1) | raw +18 ms / unres. / LUFS -1.4 (ex -0.1) | 0.69 s |
| lyrics | B Romantica | 0.132 vs 0.105 (+2.6 pt) | 0.993 vs 0.961 | raw -8 ms / ok / LUFS +3.8 (ex -0.2) | raw +12 ms / unres. / LUFS -3.0 (ex -0.1) | 0.64 s |
| lyrics | C Gertar | 0.750 vs 0.750 (+0.0 pt) | 0.997 vs 0.981 | raw +2 ms / unres. / LUFS +0.9 (ex -0.2) | raw -10 ms / unres. / LUFS +1.7 (ex -0.3) | 0.70 s |
| lyrics | D Carinito | 0.211 vs 0.158 (+5.3 pt) | 0.988 vs 0.956 | raw -3 ms / unres. / LUFS +3.8 (ex -0.1) | raw -9 ms / unres. / LUFS -2.6 (ex +0.2) | 0.63 s |

**Candidate C (audio-only REPEAT / CUT, 1-beat crossfade, groove-snapped cut) on structural edits**

| edit | song | span metric: result vs full re-render | rest of song (melody F1, result vs control) | seam 1 | seam 2 | base audio changed |
|---|---|---|---|---|---|---|
| repeat | A Purple Shinings | 0.929 vs 0.966 (-3.7 pt) | 0.967 vs 0.926 | raw -10 ms / ok / LUFS +8.5 (ex --) | (none) | 0.69 s |
| repeat | B Romantica | 0.992 vs 1.000 (-0.8 pt) | 0.988 vs 0.960 | raw -50 ms / ok / LUFS -0.1 (ex --) | (none) | 0.64 s |
| repeat | C Gertar | 0.958 vs 0.950 (+0.8 pt) | 0.992 vs 0.981 | raw +0 ms / unres. / LUFS +3.5 (ex --) | (none) | 0.70 s |
| repeat | D Carinito | 0.991 vs 0.992 (-0.0 pt) | 0.985 vs 0.943 | raw -8 ms / ok / LUFS -0.3 (ex --) | (none) | 0.63 s |
| cut | A Purple Shinings | 1.000 vs 1.000 (+0.0 pt) | 0.800 vs 0.701 | raw -3 ms / ok / LUFS +0.8 (ex --) | (none) | 0.69 s |
| cut | B Romantica | 1.000 vs 1.000 (+0.0 pt) | 0.983 vs 0.966 | raw -64 ms / ok / LUFS -1.9 (ex --) | (none) | 0.64 s |
| cut | C Gertar | 1.000 vs 1.000 (+0.0 pt) | 0.994 vs 0.960 | raw +3 ms / unres. / LUFS +3.4 (ex --) | (none) | 0.70 s |
| cut | D Carinito | 1.000 vs 1.000 (+0.0 pt) | 0.995 vs 0.954 | raw +2 ms / ok / LUFS -1.1 (ex --) | (none) | 0.63 s |

**Candidate B (A3 or C1 + ACE-Step repaint of a 3 s window on each real seam), balanced vs conservative, against the unhealed splice**

| edit | song | span metric: A3/C1 | bal | con | window loudness change in dB per window (bal , con) | worst seam LUFS step beyond the base (structure: raw step): A3/C1 -> bal -> con |
|---|---|---|---|---|---|---|
| reharm | A Purple Shinings | 1.000 | 0.875 | 0.875 | +0.2/-7.8 , -1.1/-8.0 | 0.6 -> 3.1 -> 2.9 |
| reharm | B Romantica | 0.375 | 0.125 | 0.125 | -2.2/-1.9 , -3.0/-2.3 | 0.4 -> 0.1 -> 0.2 |
| reharm | C Gertar | 1.000 | 0.875 | 0.875 | -2.7/-1.0 , -2.7/-1.2 | 0.1 -> 3.1 -> 3.2 |
| reharm | D Carinito | 0.875 | 0.875 | 0.875 | -3.1/-0.2 , -3.2/-0.3 | 0.2 -> 4.6 -> 4.7 |
| phrase | A Purple Shinings | 0.878 | 0.850 | 0.850 | -2.2/-13.4 , -2.8/-14.7 | 1.3 -> 1.6 -> 1.6 |
| phrase | B Romantica | 0.889 | 0.769 | 0.750 | -1.9/-0.7 , -2.0/-0.8 | 0.1 -> 3.2 -> 3.3 |
| phrase | C Gertar | 0.952 | 0.718 | 0.718 | -1.9/-1.2 , -1.4/-1.1 | 0.3 -> 0.8 -> 0.9 |
| phrase | D Carinito | 0.556 | 0.645 | 0.645 | -2.9/-2.2 , -2.9/-3.4 | 0.3 -> 0.4 -> 0.1 |
| lyrics | A Purple Shinings | 0.950 | 1.000 | 1.000 | -0.9/-4.5 , -2.4/-6.6 | 0.1 -> 2.7 -> 2.8 |
| lyrics | B Romantica | 0.132 | 0.316 | 0.211 | -1.6/-0.4 , -1.7/-0.5 | 0.2 -> 1.5 -> 1.6 |
| lyrics | C Gertar | 0.750 | 0.958 | 0.833 | -2.5/-1.6 , -2.5/-2.0 | 0.3 -> 1.2 -> 1.2 |
| lyrics | D Carinito | 0.211 | 0.158 | 0.211 | -3.6/-0.6 , -3.9/-0.6 | 0.2 -> 5.8 -> 7.2 |
| repeat | A Purple Shinings | 0.929 | 0.534 | 0.523 | -4.3 , -5.6 | 8.5 -> 7.9 -> 8.0 |
| repeat | B Romantica | 0.992 | 0.992 | 0.992 | -1.7 , -1.5 | 0.1 -> 0.1 -> 0.0 |
| repeat | C Gertar | 0.958 | 0.920 | 0.920 | -2.8 , -3.1 | 3.5 -> 2.9 -> 2.9 |
| repeat | D Carinito | 0.991 | 0.934 | 0.934 | -0.9 , -0.7 | 0.3 -> 0.4 -> 0.4 |
| cut | A Purple Shinings | 1.000 | 1.000 | 1.000 | -1.5 , -2.1 | 0.8 -> 1.3 -> 1.6 |
| cut | B Romantica | 1.000 | 1.000 | 1.000 | -0.8 , -0.8 | 1.9 -> 1.9 -> 2.1 |
| cut | C Gertar | 1.000 | 1.000 | 1.000 | -1.7 , -2.0 | 3.4 -> 2.3 -> 2.1 |
| cut | D Carinito | 1.000 | 1.000 | 1.000 | -0.4 , -0.3 | 1.1 -> 1.3 -> 1.3 |

### The other numbers

- **Null test.** 52 splices, 385,648,194 base-derived samples compared with the base, 0 different (outside the half-crossfade of each join). Healed files: ACE-Step peak-normalises its whole output to -1 dBFS (gain 0.79-0.95 here), clips its input at full scale (song A's library audio peaks at 1.27) and trims to whole latent frames (-1,590 samples on a 3-minute song); after undoing the gain and restoring the tail, 0 samples differ outside the windows except where the input exceeded full scale (checked: no other sample differs).
- **Tracker error.** SheetSage2 downbeats look quantised to 20 ms (*inferred*: the median bar lengths are 2.76 / 2.56 / 2.82 s). Raw misalignment of a plain downbeat cut (23 seams with a resolvable pattern): median 8 ms, 3 of 23 above 20 ms (all song B: -39 ms at the phrase entry, -50 ms at the REPEAT seam, -64 ms at the CUT seam; the +58 ms at the phrase exit had correlation 0.20 and is not counted), all corrected by the snap. Independent check after the snap: 14 seams within 20 ms, 0 outside, 18 unresolved (weak groove in the 2-12 kHz band: sparse outros, humming, acoustic guitar).
- **Level.** Seam LUFS excess over the base (24 local seams): A1 median 0.89 dB (max 5.4, 54% within 1 dB), A2 0.72 (max 4.1, 58%), **A3 0.16 (max 1.3, 96%)**, B-balanced 1.48 (max 5.8, 38%), B-conservative 1.50 (max 7.2, 38%).
- **Words at the cuts** (Whisper word times, +-30 ms margin; indicative, Whisper is good to 50-100 ms): of 36 cut points, 14 have no word crossing the cut, 7 have a word held across it on one side, 15 on both sides (7 the same word, i.e. a syllable the new take also holds; 8 different words, a likely audible stutter). So a downbeat-aligned cut lands inside a sung word in about 4 of 10 cases; this is the first thing to listen for.
- **REWRITE LYRICS words** (Whisper WER of the edited chorus vs the new lines; `results.json: whisper_wer_first_chorus`): re-render / A3 / balanced / conservative: B 0.105 / 0.132 / 0.316 / 0.211, C 0.750 / 0.750 / 0.958 / 0.833, D 0.158 / 0.211 / 0.158 / 0.211; A unreadable (WER 1.0 even for the original chorus). The new words reach the audio in B and D (WER against the *old* lines 0.85 and 0.91); song C's re-render itself scores only 0.75, so the German lines are weak or Whisper misses them; the splice neither adds to nor removes from that.
- **Cost, extra seconds on top of the full render YuE2 does today (44-92 s).** A: SheetSage2 on the new render for its downbeats, median 16.7 s (8-19 s; the base's grid is computed once per version and cached) + splice 0.2 s median / 0.33 s max on the CPU. B: A + one ACE-Step repaint per seam window, median 10.6 s balanced / 12.6 s conservative (max 21 / 27 s, includes uploading the 65-80 MB song and downloading it), 2 windows per local edit, plus swapping the GPU from YuE2 to ACE-Step and back (not timed). C: no YuE2 render at all (saves 44-92 s) + 0.2 s splice with the base grid cached; +11-13 s if the seam is repainted.

## What the real build should copy

1. **Local edits (REHARMONIZE, WRITE PHRASE, REWRITE LYRICS, EDIT STYLE on a section): render the edited score as today, then splice A3.** Keep each version's SheetSage2 downbeats fitted to its score on unedited bars (SP-3 `analyze.py`); cut at the edited span's first and last downbeat; snap the cut by the 40-5000 Hz onset-pattern lag between the two sides (cap 80 ms); 1-beat equal-power crossfade centred on the cut; linear-in-dB gain ramp across the new span matched (3 s K-weighted windows) to the old audio at both ends; keep the old file's samples everywhere else. The version row should store the changed bar span, the two join times and the gain ramp, and the label should say which bars changed. Reference code: `sp4lib.py` (`assemble`, `lufs`, `pattern_lag`), `splice_all.py` (`snap`, the A3 branch).
2. **REPEAT / CUT: do not call YuE2.** Copy / remove the bars of the base audio with the same cut logic; the YuE2 render disappears (44-92 s saved), the score/lyrics edit stays as the record. Keep a "re-render the whole song" action next to it for when the seam is heard.
3. **Do not use ACE-Step repaint to heal seams by default (B).** It rewrites the first/last bar of the edit and the words, comes back quieter, and does not reduce the level step. If it is offered at all, as an explicit "smooth this join" action, undo its side effects: it peak-normalises its output to -1 dBFS (restore the gain), trims to latent frames (restore the tail), and clips its input at full scale.
4. **Level-matching is not optional.** A plain splice leaves 3.7-6.0 dB steps in 3 of 12 edits.
5. **Use `acestep-api`, not `acestep --enable-api`, for anything that uploads audio** (see surprises).
6. A downbeat-aligned cut can land inside a held word (4 of 10 cut points here): if the ear finds it, move the cut to the nearest Whisper word gap within a quarter bar before building anything else.

## Surprises

- **The ACE-Step launcher named in CLAUDE.md does not repaint.** `uv run acestep --port ... --enable-api` serves a simplified `/release_task` (`acestep/ui/gradio/api/api_routes.py:366-540`, *seen in code*) that builds `GenerationParams` without `src_audio` or `repainting_start/end`, and a multipart request with `batch_size=1` (a string on the wire) returns HTTP 500 `'str' object cannot be interpreted as an integer` (*seen running*). `uv run acestep-api` (`acestep.api_server`) accepts `src_audio` and repaints (10-21 s per 3 s window). Mulakai's `releaseTask` posts exactly that multipart (`server/src/services/acestep/tasks.ts:21-40`), so the app's repaint/cover paths would fail against the launcher; whether the user's own `:8001` instance is the launcher is *unverified*. Worth checking before anything leans on "repaint is already wired".
- **Repaint overwrites what it should protect.** A 3 s window centred on a seam covers 1.5 s of the edited bars; on an 8-bar reharmonization that costs one chord bar (-12.5 points), on a 4-bar phrase most of the first/last bar. The window comes back more than 1 dB quieter in 69% (balanced) / 78% (conservative) of cases. The tracker also invented a downbeat in the repainted reharmonization of song A, a sign the groove was disturbed.
- **Most of the "re-render drift" in melody F1 is transcriber noise** (identical audio, shifted chunking: 0.96-0.998). The measurable drift is loudness and brightness.
- **The new take is not level-matched to the old one**: 3.7-6.0 dB off at one end of the span in 3 of 12 edits, and its span length differs from the old one's by up to 0.2 s (song B: +150-200 ms over 8 bars, a 0.9% slower take).
- **Whisper cannot check REWRITE LYRICS on every song**: the dream-pop vocal of song A reads as WER 1.0 even for the unchanged chorus, and German song C stays at 0.75 on its own re-render.
- **Infrastructure.** `acestep-api` exited twice (code 5, no traceback) after about 7 minutes of back-to-back calls, and once the WSL VM stopped and failed to restart for a moment ("Failed to create the swap disk ... insufficient system resources"; C: had 114 GB free, RAM 100 GB free; cause unknown). The heal driver is resumable (one result file per job), which is what let it finish; anything real needs the same.

## Limits

Four songs, one seed and one edit position each, one transcriber for the adherence numbers (its own floor shown above), Whisper times good to 50-100 ms, the verification band left 18 of 32 real seams unresolved, the 2/4-header song B has mixed meters and gave the largest tracker errors, no 3/4 song, EDIT STYLE and global edits not tested, candidate D not run, and none of this says how a join *sounds*.

## OWED to the user

`listen/index.html`: **20 required pairs** (4 songs x REHARMONIZE, REWRITE LYRICS, WRITE PHRASE with the A3 splice; REPEAT and CUT with C) plus **8 optional extras** (21-26 healed variants, 27-28 the full re-render for comparison). Serve the folder (`npx http-server . -p 8077`, open http://localhost:8077/index.html; Python's http.server cannot seek). Per pair, blind (A/B order shuffled, the edited bars shaded on both timelines, seams shown only after "reveal"): which one has a join and at which bar; whether the rest sounds like the original; whether the edit came through. "copy answers" / "download answers.json" export them (`desc`, `candidate`, `edited_is`, `join_in`, `join_bar`, `rest_same`, `edit_came_through`). The ear clause needs the join *not* found in 4 of 5 pairs per kind; the informative pairs are those where a word is held across the cut (`results/words_at_cuts.json`) and REPEAT on song A (+8.5 dB step).

## Files

`SPIKE.md` (plan) · `RESULT.md` · `results.json` (everything, per song / edit / variant, plus `verdicts`) · `results/` (`splice_*.json`, `measure_*.json`, `heal_*.json`, `healpost_*.json`, `asr.json`, `words_at_cuts.json`, `drift_loudness.json`, `aggregate.json`, `tables.md`) · scripts in run order: `prep_facts.py`, `build_jobs.py`, `run_renders.py`, `splice_all.py`, `transcribe_outs.py`, `make_heal_jobs.py`, `heal.py`, `post_heal.py`, `make_asr_jobs.py`, `asr_spans.py`, `measure.py`, `words_at_cuts.py`, `drift_loudness.py`, `summarize.py`, `aggregate.py`, `finalize.py`, `make_tables.py`, `build_listen.py` (+ `sp4lib.py`, `check_heal.py`, `check_listen.mjs`, `listen_template.html`) · big temp data in `E:\ai\tmp\sp4` (`out/`, `heal_raw/`, `heal/`).
