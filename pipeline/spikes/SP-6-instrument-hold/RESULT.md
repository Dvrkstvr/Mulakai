# SP-6 · Instrument hold in a re-sung span (R-030, D-170)

Run 2026-10-07 on the real machine (RTX 4080 16 GB, Windows 11 + WSL2): the worktree's yue-server (`/v1/jobs` then `/v1/splices`, same two calls as the app) on scratch port 8064 with `~/yue2/.venv`, YuE2-3B, SheetSage2 for the grids; later the plain `yue2` pipeline in the same venv with yue-server stopped (the GPU is never shared). No planner (the plans' ABC is reused: `/v1/scores/apply` on v1's score with the C0b pair's op reproduces each stored v2 score byte for byte). Labels: *seen running* unless marked. Audio and per-arm outputs: `E:\ai\tmp\sp6\out\<song>\<arm>\` (2.2 GB, delete when done). Nothing in app source or ACE-Step touched.

## Question

Can a chat REHARMONIZE re-render keep v1's instruments inside the re-sung span (the owner heard TB-303 bass -> jazz bass, mellower lead, different drums)?

## Criterion

Given: proven if some arm holds instruments by the numbers (timbre distance to v1 inside the span clearly below arm A's on >= 2 of 3 songs) while the chords still change; disproven if no prompt-only arm moves the numbers and no audio reference exists. The ear decides finally. How I measured (`analyze.py`, `analyze2.py`): the span is the splice's joins (v1 time), shrunk 0.5 s from each crossfade; timbre distance = mean-MFCC distance (c1-c19, 40-band mel) and long-term-spectrum distance (RMS dB over 1/3-octave bands, level-normalised) of the arm's span against v1's same seconds; also centroid and sub-bass / low-mid band shares in the CSV-like tables below; chords = SheetSage2's chord rows of the output (the estimate the splice already uses) and an own triad-template chroma estimate per bar, against the plan's new roots and the base's old roots. Null test: the job's own (0 different samples on all 25 outputs) plus a recomputation of the head.

## Verdict

- **Prompt-only arms B, C, D (and B+D): disproven.** None is below A on 2 of 3 songs: B 1/3 (MFCC) 0/3 (LTAS), C 0/3 and 0/3, D 1/3 and 1/3, BD 1/3 and 1/3; on Funky they are 1.0-4.1x worse than A. They scatter like re-rolls (a plain different seed, arm S, sits at span MFCC 8.4 / 2.3 / 5.7).
- **E, audio reference to YuE2: no** (file evidence below).
- **A new arm F, not in the brief: proven on the machine half.** Force v1's semantic tokens up to the span's first bar as an in-context prefix, then let the model continue under the edited score: span distance to v1 is clearly below A on **3 of 3** songs (MFCC x0.45 / 0.39 / 0.85, LTAS x0.70 / 0.54 / 0.40; with the instruments-first style, FB: x0.64 / 0.35 / 0.63 and x0.72 / 0.95 / 0.44) and the chords still change on Gertar and Funky (SheetSage's chord root equals the new plan's on 6 of 6 and 7 of 7 root-changed bars) but **not on Acid** (the edit disappears: 0 of 12 bars differ from v1; A itself only moves 67% of them). Strictly by the pass line: Gertar and Funky pass both halves, Acid passes timbre only. **Overall: `proven` for the token-prefix route, owner's ear owed (listen pack on :8079); `disproven` for every prompt-only change.** F needs a change in yue-server's adapter (a private upstream member) and per-version token storage: a build decision, not a prompt tweak.

## Evidence

### Arms and what they sent (all: v1's seed, cot full, v1's lyrics, the plan's edited ABC; the splice spec is identical across arms)

| arm | what changes against today's request |
|---|---|
| Z | control: v1's own unedited score, no edit (shows what a re-render does by itself) |
| A | today's request (style unchanged by the op). Reproduces the owner's v2 sample for sample on Acid and Gertar, and on Funky except 20 clipped samples: the drift is reproduced |
| B | instrument words moved to the front, stated plainly; v1's other style words kept; no genre words from the request. Acid `tb 303 acid bassline, 808 drum machine, synth lead, acid house, energetic, 128 bpm, F Major, 4/4 time`; Gertar (prose style, words taken from it and the stored caption) `clean fingerpicked acoustic guitar, subtle bassline, simple drum machine beat, atmospheric synth pads, earnest female vocal, intimate, melancholic, somber singer-songwriter piece, 176 bpm, D major, 6/8 time`; Funky `saxophone, funky plucked bass guitar, funky jazz, energetic, male vocals, English, 120 bpm, Bb major, 4/4 time` |
| C | B plus `same instrumentation as the original` before the bpm/key/time tail (the style field takes it: renders succeed, not truncated) |
| D | diagnostic: the same roots as triads (`maj`/`m`, no 7th, maj7, m7b5) in the span, today's style |
| BD | D's score with B's style |
| S | Z with seed + 1 (a plain re-roll, no edit): the yardstick for "different performance" |
| V | v1's own first-generation request (no `abc`) |
| F / FB | tokens of v1's performance (the unedited score through the plain pipeline call) up to the span's first bar forced into the prompt, the AR continues under the edited score; F with today's style, FB with B's style |
| P | Acid only: the edited score through the plain pipeline call, without yue-server's instrumental conversion |

### Timbre distance to v1 inside the span (lower = closer; `results.md`, `results2.md`)

| arm | Acid MFCC (xA) | Gertar MFCC (xA) | Funky MFCC (xA) | songs below A, MFCC / LTAS |
|---|---|---|---|---|
| A | 3.82 | 5.27 | 1.79 | - |
| B | 5.09 (1.33) | 2.32 (0.44) | 4.19 (2.34) | 1/3 / 0/3 |
| C | 5.94 (1.56) | 6.99 (1.33) | 4.58 (2.55) | 0/3 / 0/3 |
| D | 5.09 (1.33) | 3.11 (0.59) | 6.28 (3.50) | 1/3 / 1/3 |
| BD | 5.88 (1.54) | 3.94 (0.75) | 7.31 (4.08) | 1/3 / 1/3 |
| **F** | **1.74 (0.45)** | **2.06 (0.39)** | **1.52 (0.85)** | **3/3 / 3/3** |
| **FB** | **2.45 (0.64)** | **1.87 (0.35)** | **1.13 (0.63)** | **3/3 / 3/3** |
| S (seed + 1, no edit) | 8.36 | 2.27 | 5.71 | calibration |

LTAS distance (dB) A / F / FB: Acid 2.02 / 1.41 / 1.45, Gertar 3.18 / 1.72 / 3.01, Funky 2.77 / 1.11 / 1.22. Whole-song MFCC to v1 (Z, V, A, F, FB): Gertar 0.00, 0.00, 4.94, 1.30, 1.35; Funky 0.00, -, 2.68, 1.68, 1.20; Acid 6.24, 6.24, 5.12, 2.25, 0.93 (F's whole-song figures include the forced prefix, so the span figures above are the measure). Band shares: on Gertar A moves the span's sub-bass -1.3 dB and low-mids +0.9 dB against v1, F -1.6 / +0.9 (same size: the band shares do not separate the arms; MFCC and LTAS do). Centroid shifts are 60-210 Hz in every arm and not diagnostic.

### The chords still change? (SheetSage2 chord roots in the span vs v1, bars where the plan moves the root)

| arm | Acid: root = new plan / differs from v1 | Gertar | Funky |
|---|---|---|---|
| A | 0.42 / 0.67 | 1.00 / 1.00 | 1.00 / 1.00 |
| B, D | 0.67, 0.42 / 0.67 | 1.00 / 1.00 | 0.14, 0.71 / 1.00 |
| F | 0.17 / **0.00** | 1.00 / 1.00 | 1.00 / 1.00 |
| FB | 0.00 / **0.08** | 1.00 / 1.00 | 1.00 / 1.00 |

The own triad estimate agrees in direction (Funky F: root = new 0.71, A 0.57; Acid F and FB: differs from v1 on 0 and 1 of 12 bars). SheetSage2 on a TB-303 ostinato is weak (A's own Acid number is 0.42), so Acid's chord half is the least certain; it is also the one the forced prefix visibly loses.

### What this says about the cause (R-030's hypothesis is not supported)

- **Chord vocabulary is not the pull.** D (triads, same roots) is no closer to v1 than A (2 of 3 songs worse) and B (instruments named first) is not either. The re-sung span's instruments change because *any* change in the prompt prefix re-rolls the whole sampling path: A's whole-song distance to v1 on Gertar (4.94) is larger than a different seed's (S 2.63), although only eight bars of chord symbols differ.
- **A render with the same prompt is v1, exactly.** Z and V on Gertar equal v1 to the sample (0.0 max difference); Z on Funky too; for those two songs the in-process pipeline also reproduces the server's render to the sample (Zcheck). So the hold is a prompt-prefix problem, and v1's own semantic tokens are recoverable by re-running v1's request on this machine (25 tokens/s of audio: 5,371 tokens for Gertar's 215 s).
- **Acid is a special case on top.** Its v1 (made 21:14 on 2026-09-30) predates yue-server's instrumental conversion (`instrumental.py`, commit 4f590d4, 22:26 +0200 the same day). The server now rewrites `[instrumental]` lyrics to the score's section tags before the render, so even the unedited score (Z, V) re-renders 6.24 MFCC away from v1 (A is 5.12), and the plain path with the edited score (P) comes back 94 s long (v1 is 78.9 s) and 8.5 away. The pipeline called directly with v1's own request and unedited score is bit-identical to v1 (Zcheck): so the Acid drift the owner heard is partly the legacy-instrumental re-render path, and only forced tokens hold it.

### E: can YuE2 take a v1 clip as a reference? No (seen in upstream files, `~/yue2/repo` = YuE `18a07bb`, yue2-infer 0.1.6)

- `skills/yue2-music/references/generation-and-covers.md:17`: the song request accepts `style`, `lyrics`, `cot`, `seed`, `abc`, `cfg_scale`, `id`; "There is no request field for `reference_audio`, `phonemes`, `bpm`, `negative_prompt`, an edit interval or a reference singer". `:121`: "YuE2 has no direct audio-upload argument in this interface. Its VAE encoder is not a substitute for melody transcription." `docs/editing.md`: "Editing renders a new complete recording. Matching the unchanged score does not guarantee identical singing, timbre, or waveform outside the edit."
- `src/yue2/protocol.py` `SongRequest` has exactly those fields; `token_prefixes` builds the prompt from the instruction, `[Tags]` style, `[Lyrics]` and the ABC only; the VAE is used decoder-only. There is no audio-to-semantic-token encoder in the package.
- What exists instead is a token-level hook: the AR stage is a language model over a prefix, and `pipeline._generate(prefix, ...)` will continue any prefix. `generate_semantic` refuses a prefix that differs from the plan's (`pipeline.py:271-283`), so forcing tokens needs the private `_generate` (arm F's script, `forced_prefix.py`, 60 lines, a throwaway outside app code).

### Surprises that cost real time or will matter in the build

1. **The splice has no length gate.** `splice_reharmonize` takes the new take's own span, so a render whose chorus runs short shortens the saved song and shifts every later bar: verdict `ok` with the output **7.53 s shorter (Acid Z), 7.56 s (Acid F), 4.02 s (Funky B)**, 1.89 s (Acid P), against F-047's "length may differ by under 0.25 s" (it is only reported, `length_diff_s`). 4 of 25 outputs here; the 4 C0b songs were all under 0.02 s. The null test still passes (the base's own samples are kept), so nothing flags it. Needs a gate (`rerender` when |diff| > 0.25 s) before F-047 can be trusted; recorded as R-033.
2. **Funky B (instruments first) changed the tempo**: the 8-bar chorus took 12.0 s instead of 16.0 s and the whole render ran 154.8 s instead of 159.3 s. The style words move timing, not only timbre.
3. Prompts are not noise-free in a good way: the 5 server arms per song gave 5 different performances; the metrics are per-song scattered, not monotone in the prompt change.
4. A second source of drift that is not the edit: re-rendering a legacy instrumental through today's conversion path.

## What the real build should copy

1. **Do not spend more on prompt words.** Styles already name instruments; moving them first, adding a keep line or softening chords moves the span no closer to v1 (0-1 of 3 songs). Leave the style as the app sends it.
2. **Keep each render's semantic tokens** (a few thousand integers, about 20 KB for a 3.5 min song; `SemanticResult.tokens` from `generate_semantic`) as a sidecar next to the version's `.abc`, and render a REHARMONIZE with v1's tokens up to the span's first bar forced after the prompt (`prefix = plan.prefix + [t + CODEC_OFFSET ...]`, `max_tokens` reduced by the forced count so the 9,000 cap still holds, then `SemanticResult(plan, forced + generated)` into `synthesize` and `decode`). Reference: `forced_prefix.py` (arm F, 25 tokens/s, cut at `round(25 * span_start_s)`); it uses the private `_generate`, so yue-server's adapter must pin it (yue_pipeline.py already uses `_status` / `_model` privately). Cost: the same AR + NAR as a normal render (the forced tokens only lengthen the prompt); stopping generation at the span end plus a bar would save time but was not tried (my 97-148 s per arm in `logs/fp.clean.log` include recomputing the base's tokens first).
3. **For versions made before tokens are stored**, regenerate v1's tokens by re-running v1's own request (bit-exact for Gertar, Funky) only when the same render path still applies; legacy instrumentals (Acid) cannot be rebuilt through the server's instrumental conversion and have no token sidecar: say so on the edit card ("instruments may change") instead of promising "the rest sounds the same".
4. **Instrumentals**: the forced prefix loses the chord change on Acid (0 of 12 bars differ from v1): a drone/ostinato track follows its own context. Treat instrumental REHARMONIZE as "instruments hold OR chords change" until an ear check says otherwise, or fall back to whole re-render for it.
5. Fix the length gate (surprise 1) in the same change: forced-prefix takes can also run short (Acid F).
6. Reuse the measures: `analyze.py` (span MFCC / LTAS vs v1, SheetSage chord roots, triad template) and `results.md`; the listen page template `listen_template.html` + `build_listen.py` (blind multi-candidate, same-position switch).

## Owed

The owner's ear on `E:\ai\tmp\sp6-listen\` (page http://localhost:8079/index.html, 3 songs, 5-6 blind versions each plus v1): do F and FB keep the instruments inside the shaded bars where A does not, and do the chords still change. Not measured: vocals (words and voice colour in Gertar and Funky: Whisper WER on the span, or the ear), the join audibility of F's splice (null test 0 on every output; the seams' LUFS step beyond the base's own is 0.01-0.54 dB for F and FB), the time saved by stopping generation at the span end. Excluded from the pack because their splice shortened the song: Acid F, Funky B.

## Files

`prep.py` (inputs from the C0b scratch library and the app's `/v1/scores/apply`), `run.py` / `run2.py` (jobs + splices; run2 adds Z splice, S, V), `forced_prefix.py` (F, FB), `plain_arm.py` (P), `splice_forced.py` (yue-server's own splice code run in process on F, FB, P), `analyze.py` / `analyze2.py` (+ `results*.md`, `results*.json`), `build_listen.py` + `listen_template.html`, `logs/`. Restart the listen page: `cd E:\ai\tmp\sp6-listen && node serve.mjs 8079` then http://localhost:8079/index.html.
