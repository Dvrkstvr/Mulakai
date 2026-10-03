# SP-2 · local planner quality (R-002; also R-015, R-016)

Run 2026-10-03, RTX 4080 16 GB, Windows 11, Ollama 0.32.15 (own server on :11435, `OLLAMA_CONTEXT_LENGTH=16384`; the user's :11434 left idle and untouched), upstream `abc_tools.py` vendored in `yue-server/upstream/` as the validator. Evidence level unless stated: *seen running* (real models, real library scores, real validator). No YuE2 rendering (not needed; SP-3 already covers what YuE2 does with an edited score).

## Question

Can a local model, behind a JSON-schema op-list contract plus the upstream validator and at most 3 retries, turn plain-language requests into valid, applicable score operations on real YuE2 scores, fast enough (p50 plan <= 60 s)?

## Criterion (D-013, unchanged)

1. Deterministic op lists valid >= 90% on the first try.
2. REHARMONIZE and WRITE PHRASE pass the validator within 3 retries >= 70%.
3. p50 plan <= 60 s.
4. Owed: the user listens to WRITE PHRASE results and says if they are musical (reuses SP-3's `*_e` pairs; I also made cheap audio of the LLM's own phrases, see Owed).

"Valid" = the op list is JSON-schema valid, every op applies (bars/sections/blocks exist), upstream `parse_abc` accepts the edited score, upstream `compare` holds the op's invariants (melody untouched for REHARMONIZE/SET TEMPO, Vocal untouched for WRITE PHRASE), and the 360 s / 4,096-token limits hold (R-019). WRITE PHRASE additionally has three musical sanity gates of my own (>= 4 notes, >= 3 distinct pitches, >= 70% of notes in the key, not one bar repeated four times). "Intent" = the op list does what the request asked (right number, right section, nothing extra); I report it next to validity because a valid but wrong plan is useless.

## Verdict: `proven`, qualified (R-002: hypothesis -> measured; D-005's revisit clause is not triggered)

| D-013 line | qwen3:14b (dense, 100% on GPU) | gemma4 26B-A4B (MoE, 27% of weights on CPU) | result |
| --- | --- | --- | --- |
| 1. deterministic ops (SET TEMPO, TRANSPOSE, REPEAT, REWRITE LYRICS) valid first try >= 90% | 64/66 = 97% (valid and right: 61/66 = 92%) | 62/66 = 94% (valid and right: 94%) | pass, both |
| 2a. REHARMONIZE valid within 3 retries >= 70% | 18/18 = 100% (all first try) | 18/18 = 100% (all first try) | pass, both |
| 2b. WRITE PHRASE, bars as raw ABC strings, within 3 retries >= 70% | 8/18 = 44% (first try 11%) | 16/18 = 89% (first try 44%; Wilson 95% low bound 67%) | **fail** for qwen3, pass (thin) for gemma |
| 2c. WRITE PHRASE, bars as `{pitch, beats}` notes, code writes the ABC (R-002 fallback) | 18/18 = 100% (first try 67%) | 17/18 = 94% (first try 67%) | pass, both |
| 3. p50 plan <= 60 s (model warm) | 1.6 s (p95 14 s, max 22 s) | 1.6 s (p95 12 s, max 17 s) | pass, both; see cold load below |

Compound request (the core promise: tempo + reharmonize + phrase in one sentence, not a D-013 line): ABC phrase 5/14 = 36% (qwen3), 8/14 = 57% (gemma); notes-phrase 12/14 = 86% (qwen3), 14/14 = 100% (gemma).

What this means: the plan contract works on real scores with either model for everything except free-form ABC phrase writing, where a 14B dense model fails the line and a 26B MoE barely clears it. Moving the arithmetic out of the model (phrase as notes with beats; code emits the ABC and owns units, ties and bar sums) fixes it for both models. Valid is not musical: the phrases that pass are plain (stepwise motifs from gemma, arpeggio runs from qwen3). Musicality is unproven and owed to the user.

Caveats: 9 usable library scores (not 20, see Surprises), 2 repetitions per cell (different seeds, same prompts, so the effective n is about 9 per template; the Wilson lower bounds are in the table above and for gemma free-ABC straddle the 70% line); two paraphrases per template; one request wording family. Nothing here says the edited score renders as asked: that is SP-3 (tempo and repeat reliable, harmony and instrument "a request, not a guarantee").

## Models (D-016)

| | qwen3:14b | gemma4:26b-a4b-it-q4_K_M |
| --- | --- | --- |
| source | Ollama library `qwen3:14b`, digest `bdbd181c33f2` (already downloaded in SP-1) | Ollama library `gemma4:26b-a4b-it-q4_K_M`, digest `5571076f3d70`, pulled by me for this spike |
| file | 9,276,198,565 bytes (9.3 GB), Q4_K_M, dense 14.8B | 17,987,581,215 bytes (18.0 GB), Q4_K_M; base model `google/gemma-4-26B-A4B-it` |
| licence | Apache 2.0 (SP-1 note) | Apache 2.0 (embedded licence text via `ollama show --license`, seen; the HF card agrees) |
| architecture | dense | MoE, 25.2B total / 3.8B active, 128 experts (8 active + 1 shared), 256K context, thinking off unless `<|think|>` is in the system prompt (documented, HF card via summarised fetch) |
| picked because | the SP-1 planner | current release (card dated July 2026), instruct-tuned, MoE, 18 GB is inside the 15-20 GB band, Apache 2.0. Rejected: `qwen3.6:35b-a3b` (24 GB), `nemotron-3.5-lightning` 30B-A3B (25 GB), `qwen3-coder:30b` (coder tune), `qwen3.8` (dense 27B only), `gpt-oss:20b` (about 14 GB, under the band) |
| memory at ctx 16,384 | 10.87 GiB, all on GPU; card 12.9 GB used (idle 1.6) | 16.98 GiB, of which 12.35 GiB on GPU (73%), rest in system RAM; card 15.7 GB used (idle 1.7), i.e. ~0.6 GB free |
| speed (native API, 2,490-token plan prompt) | prefill 3,992 tok/s, decode 62.7 tok/s | prefill 2,109 tok/s, decode 57.1 tok/s |
| cold load | 2.5 s (total first reply 2.7 s) | 8.9 s load, 12.4 s first reply with a warm page cache; the very first load from disk was 49.8 s |
| unload (`keep_alive: 0`) | ack 13 ms, `/api/ps` empty 0.22 s, VRAM back 0.25 s | ack 2 ms, empty 0.43 s, VRAM back 0.47 s |

MoE on this machine: Ollama 0.32.15 splits by layers, not by experts (there is no `--n-cpu-moe` equivalent; GitHub issue ollama/ollama#11772 asks for CPU offload of MoE weights, its status not checked), and it "handles it well" here: 57 tok/s decode with 27% of the weights in RAM. I did not try llama.cpp (no binary needed, Ollama was fast enough). The free system RAM at the time was ~54 GB, not the ~200 GB the risk file assumed; the model needed 5 GiB of it. Disk: `C:` was at 95% before the pull; the pull took 18 GB. `ollama rm gemma4:26b-a4b-it-q4_K_M` reclaims it.

Full per-template tables (first-try, within-3-retries, valid+intent, retries used, p50/p95, failure reasons) are in `results/summary.md`; raw per-call records (prompts' token counts, raw replies, errors, timings) in `results/*.jsonl`.

### Per-template, final prompt (v2), both models

| template | n | qwen3 valid 1st | qwen3 <=3 retries | gemma valid 1st | gemma <=3 retries |
| --- | --- | --- | --- | --- | --- |
| T1 SET TEMPO | 18 | 100% | 100% | 100% | 100% |
| T2 TRANSPOSE | 18 | 100% | 100% | 100% | 100% |
| T3 REHARMONIZE 4 bars (jazz) | 18 | 100% | 100% | 100% | 100% |
| T4 REPEAT chorus | 16 | 100% | 100% | 100% | 100% |
| T5 REWRITE LYRICS (first chorus) | 14 | 86% (right block: 64%) | 86% | 71% | 100% |
| T6 WRITE PHRASE, ABC strings | 18 | 11% | 44% | 44% | 89% |
| T6 WRITE PHRASE, notes+beats | 18 | 67% | 100% | 67% | 94% |
| T7 compound, ABC strings | 14 | 21% | 36% | 36% | 57% |
| T7 compound, notes+beats | 14 | 43% | 86% | 43% | 100% |

Infeasible cases skipped because even the reference op list fails the validator: T4 on `691aa438` (367 s > 360 s), T7 on `2a8cc1ca` (458 s) and `691aa438` (562 s) because 88 BPM slows a 145 BPM song past the cap.

## Ablations (each 2 reps over the same scores, same models)

- **Grammar pattern on the ABC bar string.** With `pattern` in the schema (Ollama turns it into a grammar), 0 bars were non-ABC. Without it, 27/268 (qwen3) and 52/220 (gemma) bars used note names like `C#4` or `D5`, which the dialect rejects ("unsupported token"). WRITE PHRASE within 3 retries: qwen3 44% with pattern vs 33% without; gemma 89% vs 50%. So the pattern is worth keeping, but it only fixes syntax, not the unit arithmetic.
- **Chord symbols as free strings vs schema enums** (R-002 fallback 1, "chord-vocabulary violations"): free strings with the native qualities listed in the prompt: qwen3 0 of 132 symbols outside the vocabulary, gemma 4 of 121 (all `Dmin7`); REHARMONIZE 100% (qwen3) and 89% (gemma, the 2 failures were "two chords on the same beat", not vocabulary). With `root` and `quality` as enums vocabulary violations are impossible by construction and gemma was 100%. The enum is cheap insurance, not a necessity for these two models.
- **Prompt v1 -> v2** (qwen3:14b only, `planner_v1.py` and `results/qwen3_14b_v1.jsonl`): v1 had the per-bar unit-sum feedback but no KEY NOTES line, no "vary the bars" advice and no occurrence labels on lyric blocks; WRITE PHRASE within retries was 3/18 = 17%, compound 0/14. v2 added the key's note names, the ban on scale runs and four identical bars, and a second example bar: 44% and 36%. Before the sum feedback existed (an early smoke run), upstream's own message ("event after the measure end") made the model resend the same four bars on all four attempts, so numeric feedback is what makes retries useful.

## The op schema (the spike's proposal for the real build)

One JSON object `{"ops":[...]}`, 1-6 ops, each `{"op": <name>, ...}`, `additionalProperties: false`, sent as `response_format: {type: "json_schema", strict: true}` through `/v1/chat/completions` with `reasoning_effort: "none"`. Bars are numbered 1..N over the whole song (the prompt's BAR MAP shows them), sections 1..K in the order of the `% name` comments, lyric blocks 1..M in the order of the LYRICS text.

| op | fields | applied by code as |
| --- | --- | --- |
| `SET_TEMPO` | `bpm` int 40-240 | rewrite `Q:1/4=`; replace `NNN bpm` in the style text, or append `, NNN bpm` (R-018) |
| `TRANSPOSE` | `semitones` int -11..11 | shift every note and chord, re-spell accidentals for the new key, rewrite every `K:` (header, group lines, inline `[K:]`) |
| `REHARMONIZE` | `from_bar`, `to_bar`, `chords:[{bar, beat, root, quality, bass?}]`; `root` enum of 17 names, `quality` enum of the 15 native qualities (`maj` = no suffix), `beat` int 1-6 in quarter notes | delete the chords in those Vocal bars, insert the new ones at beat offsets, splitting a note or rest with a tie when the beat falls inside it (decomposed into the allowed lengths); rule: a beat-1 chord for every bar in range |
| `REPEAT` | `section` int, `times` 1-3 | copy the section(s) right after it; un-tie the last note at each seam; duplicate the lyric block whose tag matches |
| `CUT` | `section` int | delete the section (implemented, not in a template) |
| `REWRITE_LYRICS` | `block` int, `lines:[string]` | replace the block's lines, rule: same number of lines, no tags |
| `EDIT_STYLE` | `style` string | replace the style text |
| `WRITE_PHRASE` | `start_bar`, `instrument` string, `bars` (exactly N items, N set per request) | write the Ins bars `start_bar..` (overlay, only where the Vocal rests); the instrument name is appended to the style text. `bars` items are either ABC bar strings (pattern `^(?:note)+$`) or, the recommended form, arrays of `{pitch: ABC pitch or z, beats: 0.5/1/1.5/2/3/4}` that code turns into ABC |

Per-request schema tightening is part of the design: the number of phrase bars (`minItems = maxItems`) is set from the request; sections and bars could be bounded the same way (`maximum` = the score's counts).

Validation order (all of it ran in the spike): schema check (own 40-line checker; Ollama's grammar already forced it) -> apply (reference checks, per-op rules, per-bar unit or beat sums with exact numbers) -> upstream `parse_abc` on the result -> upstream `compare` with the op's allowed changes (`allow_tempo_change` for SET TEMPO; Vocal-only for WRITE PHRASE) -> limits (duration from bars x meter / `Q:` <= 360 s; tokens, estimated as 0.8 x chars, not measured with the YuE tokenizer) -> sanity gates for phrases. The 3 retries send the assistant reply back plus a bullet list of the errors.

Planner prompt (about 1.5k tokens of rules plus a per-song block): the rules and op reference; then HEADER (meter, UNIT, tempo, key, bar count, seconds, hard limit), KEY NOTES (the key's seven note names), STYLE, SECTIONS (index, label, bar range), LYRIC BLOCKS (number, tag, occurrence n of this tag, line count, first line), and a BAR MAP with one line per bar `n: Dm@1 A7@3 | V:sung/rest | I:<Ins note count>` plus a line wherever the meter changes ("one bar = 32 units"). The raw score is not shown.

## R-015 · does a score plus rules fit the context? Yes at 16k; and Ollama overflows silently

- Compact bar-map prompt (what I used): 2.0k-4.2k tokens, p50 2.7k (both tokenizers, `usage.prompt_tokens`).
- Raw sidecar + rules + style + lyrics (the alternative): 2.2k-5.4k tokens for the 10 library sidecars (gemma tokenizer; qwen3 2.2k-5.0k); the 4,096-YuE-token one is 5.4k. All fit 16,384 with room for 2,000 output tokens; 3 of 10 raw prompts (4.5k, 4.6k, 5.4k) and the longest bar-map prompts (4.2k) are over Ollama's 4,096 default context.
- Overflow (seen running, gemma4 via `/api/chat`): a 4,511-token prompt with `num_ctx` 2048 or 4096 returned HTTP 200 and a normal reply; the server log said `truncating input prompt limit=1027 prompt=4511 keep=5` (and 2051 for 4096), and `prompt_eval_count` in the response was 1,027 / 2,051. So an overflow keeps the first 5 tokens and the tail, cuts the middle (where the score is), shrinks to about half the context, and tells the client nothing but `prompt_eval_count`. With `num_ctx` 8192 the same prompt passed whole (4,511).
- For the real build: set the context at server start (`OLLAMA_CONTEXT_LENGTH`), preflight `/api/ps` `context_length` >= counted prompt + 2,500, and after every call compare `usage.prompt_tokens` with the expected count (a smaller number means truncation). Do not trust the call to fail.

## R-016 · validator semantics a TypeScript port would have to match

`golden.py` -> `golden.json` / `golden.out.txt`: upstream's verdict (ok or the exact error text, plus bpm, bars, note and chord counts) on the 10 library sidecars and 29 hand-made mutations, as golden cases for a port. Parse time in Python: 2.3-9.4 ms per full score (a yue-server `/v1/scores/check` route would cost one local HTTP round trip per retry; negligible against a 1-5 s model call).

Behaviours the spike hit that a port must reproduce, or deliberately improve:
- Header is exact: `X:1`, blank `T:`, `M:`, `L:1/<2^n>`, `Q:1/4=<int>`, the two exact `V:` definition lines, `K:` from a fixed 30-name table (major and minor only; `K:Ddor` fails).
- Music lines come in groups of 1-4 measures after expanding `Z`/`Z2`-`Z4`; both voices need equal counts per group; a line must end with `|`; empty measures, `||`, `|:` and tuplets fail.
- Durations must be in {1,2,3,4,6,8,12,16,24,32,48} units, so 5 or 27 must be split into tied pieces; ties must join equal pitches, with a special case that an unmarked continuation keeps the tied accidental across a barline; accidentals propagate by letter across octaves within a bar.
- Chord regex: 17 pitch names (with `bb`/`##` accepted) x 15 qualities x optional `/bass`; chords are rejected in Ins (a parse-time rule, not a token rule) and are not compared by `compare` at all; `compare` merges tied notes into one sounding note, so splitting a note with ties is invisible to it. A chord edit needs its own diff (the spike diffed the chord lists outside the edit window).
- Error messages are terse and sometimes unhelpful for a model or a user: an overfull bar says "event after the measure end" or "unsupported duration 27"; an underfull one prints a Fraction ("31/8 quarter notes != meter duration 4"). The spike's per-bar unit sum message is what made retries work, so the port should produce that kind of message.
- Real-data cases a port must handle: meter changes inside a score (`3820c535`: header `M:2/4`, groups `M:4/4`; units per bar 16 then 32), `L:1/16` scores (`83921775`), 168-206-bar covers with no chords at all, and a sidecar that fails the validator (`0a7cff01`, the planner's own output cut at 4,096 tokens: "group 60, Ins: expected V: Ins"), so SCORE eligibility must run `parse_abc` on the sidecar, not just check that a file exists (R-017).
- A REPEAT can make a valid score invalid: a section whose last note is tied into the next section's first note (`f3e3bfdc`) fails with "tie changes pitch" once the section is copied; the applier must un-tie the seam.

Size: the spike's applier and validator wrapper are 553 lines of Python (`score.py`), the whole `abc_tools.py` is 337; a TS port of both is well past the 200-LOC module cap and would need splitting (bar model, ops, transpose, validate). Recommendation stands as the risk file's fallback: a CPU-only yue-server route running upstream `parse_abc` + `compare` (the render depends on yue-server anyway), with the golden cases as its contract tests, and a TS port only if the route proves awkward.

## What the real build should copy

1. The op schema above, built per request, sent as a strict JSON schema through `/v1` with `reasoning_effort: "none"`. Seen working on both models: 0 schema-invalid replies and 0 HTTP errors in all 844 calls (every run, retries included) (anyOf of `const`-tagged objects, enums, number enums, `pattern`, `minItems = maxItems` all honoured).
2. WRITE PHRASE as `{pitch, beats}` notes, not ABC strings; code owns units, ties and bar sums. REHARMONIZE as `{bar, beat, root, quality}` with enums.
3. Retry feedback with exact numbers (per-bar unit/beat sums, bar and block counts, which bar the Vocal sings in); 3 retries. Most first-try failure classes in the tables (bar sums, line counts, beat out of range) are fixed by the feedback; free-ABC compound requests are the exception (gemma still fails 6 of 14).
4. A compact BAR MAP prompt instead of the raw score: shorter than the raw score for most songs and it carries the facts the model needs (global bar numbers, chords by beat, Vocal rests, meter changes, key notes). Pass the user's UI selection (bars, section, lyric block) with the request where there is one: the only intent failures were reference resolution ("first chorus" picked the wrong lyric block: qwen3 got the right block in 9 of 14 plans, gemma in 14 of 14), never arithmetic on deterministic ops.
5. The applier's design (bar-level model of the dialect that round-trips all 9 valid sidecars byte for byte; note splitting with ties; transposition re-spelled so that every pitch is exactly +n and chord roots follow, checked on all 9 scores x 6 intervals: `selftest.py`).
6. Preflight/postflight for the context (R-015), and the unload-then-confirm hand-off from SP-1 (measured again here: 0.25-0.47 s to empty).
7. Run `parse_abc` on the sidecar before offering SCORE, and show the validator's verdict per op in the change list.
8. Model choice: the dense 14B with the notes-format phrase meets every line at 10.9 GiB and leaves ~2 GiB of the card free (hand-off headroom, a 3 s cold load). The 26B MoE is a modest upgrade for free ABC and for resolving "which chorus", at the price of a card that is 96% full, an 18 GB model on a nearly full disk and 12-50 s cold loads. I would default to the 14B and keep the planner model a setting.

## Owed: WRITE PHRASE musicality listen

- SP-3's `*_e` pairs (`spikes/SP-3-cot-full-adherence/listen/index.html`) are hand-written phrases rendered by YuE2; they are what D-013 names.
- Because those are not LLM output, I also rendered 15 LLM-written phrases that passed the validator (5 songs x gemma notes, qwen3 notes, gemma ABC) as a plain synth (bright melody tone over the song's own chords as a soft pad, 8-12 s each, no YuE2): `phrases/index.html` (open from disk). Judge only the tune, not the timbre. My own read, not a substitute: gemma's notes-format phrases are plain stepwise motifs ending on chord tones; qwen3's are mechanical arpeggio sequences. Nothing here establishes that either sounds good.

## Surprises

- The library has 10 `.abc` sidecars, not 20 (the other `.abc` files on disk are test fixtures from fake runs), 9 of which parse; two pairs are the same song twice (`3820c535`/`3c9e79de`, `c8144c53`/`f3e3bfdc`), so about 7 distinct songs. I used all 9; 2 of them are chord-free covers and 1 (`83921775`) is an instrumental.
- A song's style text can disagree with its score: `2c944049`'s stored style says "90 bpm, F minor" and its sidecar is Q:87 in D minor. SET TEMPO's "rewrite the bpm in the style" only helps when the number is there; the key is never rewritten.
- Lyric blocks do not map one-to-one to score sections: `2c944049` has one chorus in the score and two `[Chorus]` blocks in the lyrics; `3820c535` has a `[Pre-Chorus]` block (my first expectation matched it by substring). REPEAT's lyric duplication and REWRITE's addressing need a stated rule (here: by tag, nth occurrence); R-018's "derive tags from the score" and a block-addressed REWRITE are in tension.
- Models copy the example bar from the prompt, and the main failure is arithmetic on 32-unit bars (also qwen3 chromatic runs like `^F8^G8^A8^c8...` that are out of key), not the dialect. A beats-based note list removes most of it.
- A prompt bug of mine ("a second chord goes on beat 3") sent 2/4 songs to an impossible beat; the validator caught it and I fixed the wording for the final runs.
- The 360 s cap bites on planning too: "88 BPM" on a 145 BPM cover makes a 458-562 s song; the validator refuses it with the number, which is the right behaviour but means a plan can be unachievable for a given song.
- Ollama silently truncates an overflowing prompt (R-015).
- gemma4's first load from disk took 50 s versus 12 s once cached; D-011 loads the planner per plan, so the typical cost is the cached one, but the first plan after a reboot is the slow one.
- Ollama loads the 17 GiB model onto the 16 GB card without any warning that the card ends up 96% full; `/api/ps` shows only `size` 16.98 GiB against `size_vram` 12.35 GiB.

## Not covered

- The user's musicality listen (above) and SP-3's A/B listen.
- A larger or different model set (one dense, one MoE only); llama.cpp `--n-cpu-moe`; KV-cache quantisation; thinking mode.
- Token counts with the real YuE tokenizer (the 4,096 check used 0.8 x chars; measured ratios in the library are 0.69-0.80 tokens per char, so the guard is conservative).
- Free-form requests beyond the two paraphrases per template, multi-turn edits, and requests the planner should refuse.

## Re-run

`ollama serve` on :11435 with `OLLAMA_CONTEXT_LENGTH=16384` and both models pulled, then `python run.py <model> <tag> --reps 2` (add `--templates T6,T7 --phrase-format notes`, `--no-pattern`, `--free-chords` for the variants), `python measure.py <model> <tag>`, `python report.py <tags>`, `python selftest.py` (applier round-trip and transpose), `python golden.py`, `python phrase_wav.py <tags>`. Inputs are read-only from `server/data`. Files: `score.py` (dialect model, ops, validation), `planner.py` (schema, prompt, client), `run.py` (cases, checks, loop), `report.py`, `measure.py`, `golden.py`, `phrase_wav.py`; `planner_v1.py` is the first prompt.
