# CP1 · headless live run after W2 (2026-10-03)

Branch `feat/score-w2-plan` (W1 routes + W2 planner, plan job, hand-off, all committed). RTX 4080 16 GB, Windows 11 + WSL2 Ubuntu-24.04.
Evidence level: *seen running* on the real card, with real Ollama, real yue-server and the real Mulakai server code.

**Verdict: CP1 passes. The stop rule does not trigger** (hand-off 0.14 s max against a 5 s line, YuE2 90.4 tok/s min against 80, plan p50 6.5 s
against 60). One finding needs a decision before F-025's chord check means anything (Q-034, below): the planner "jazzed" the chorus by keeping
every root and adding 7ths plus an inversion bass, so root agreement cannot tell the new chords from the old ones.

## Setup (exact)

| process | how | notes |
|---|---|---|
| Ollama (planner) | second `ollama serve`, `OLLAMA_HOST=127.0.0.1:11435`, `OLLAMA_CONTEXT_LENGTH=16384`, `qwen3:14b` (already pulled) | the user's :11434 was not touched (`/api/ps` empty before and after) |
| CP1 proxy | `scoreCp1Lib.ts` on 127.0.0.1:11436, forwards to :11435 | the server's `LLM_API_URL`; times every planner call, the unload ack and the server's own `/api/ps` polls; keeps no prompt text |
| yue-server | WSL2, `YUE_DATA_DIR=~/yue-data ~/yue2/.venv/bin/python main.py`, :8004 | ready in ~6 s |
| Mulakai server | `node --import tsx src/index.ts`, `PORT=3201`, `DATA_DIR=<scratchpad>/cp1/data`, `YUE_API_URL=…8004`, `LLM_API_URL=…11436`, `ACESTEP_API_URL=…:9` (dead port, so it never reaches the user's ACE-Step) | `DATA_DIR` = a throwaway copy: DB via the SQLite backup API, audio copied (2.6 GB). The live library was only read (D-040). |
| GPU log | `nvidia-smi --query-gpu=timestamp,memory.used,utilization.gpu -lms 250` | `nvidia-smi.csv` (1,943 rows) |

The user's dev stack was up and idle the whole time (node :3001, ACE-Step :8001, Vite :5173; card at 1.7 GB). The script checked
`:3001/api/generate/active` before every plan and render and saw `{"active":null}` each time. Nothing of theirs was stopped.
GPU window: services up 22:33:57, run 22:34:47–22:43:15, services stopped ~22:45, SheetSage2 analysis after that; ~17 min in all.

Command: `cd server && npx tsx scripts/scoreCp1.ts --server http://127.0.0.1:3201 --data <copy> --yue http://127.0.0.1:8004
--ollama http://127.0.0.1:11435 --proxy-port 11436 --out ../pipeline/cp1/raw --songs 29f8457d-…,a69541f2-…,ecf8eb5a-… --render tempo,jazz`,
then `cp1_analyze.py` in WSL with `~/sheetsage2/.venv/bin/python`.

Songs: the three eligible 4/4 YuE2 text2music songs (SP-3's A and C, plus `ecf8eb5a`): `29f8457d` (87 BPM, 65 bars), `a69541f2` (85 BPM,
77 bars), `ecf8eb5a` (95 BPM, 64 bars). The two 2/4 songs were skipped because the median-bar-length tempo check is 4/4 only (SP-3 method).
Order per song: plan "set it to 88 BPM" → render → plan "jazz chords in the chorus" → render. So each render follows a hand-off directly,
and each jazz plan reads the tempo render's version, as the real flow would after `done` (that also exercises eligibility on a score version).

## Render step (CP1-only code; W4 has no route yet)

Following architecture.md's F-023 plan: the plan's ops (GET `/score/plan`, the edited ABC is not served) are re-applied through yue-server's
`/v1/scores/apply` (deterministic, the same call `planJob` made; style, seconds and tokens matched the stored plan 6/6). Then `POST /v1/jobs`
`{abc: edited, cot: 'full', style: edited, lyrics: as stored, seed: the base's}`. The result is written into the throwaway DB: sidecar first,
then an active base version with `score_v: 1, engine: 'yue2', task_type: 'score', cp1: true`, plus song bpm. yue-server sent back the supplied score
byte for byte (6/6), and the server accepted each CP1 version as eligible for the next plan (3/3).

## Plans (6/6 valid on the first attempt)

| # | song | request | wall (POST → settled) | planner call | prompt / completion tok | ops | unload ack → `/api/ps` empty | VRAM before → after unload (MiB) | peak (MiB) |
|---|---|---|---|---|---|---|---|---|---|
| 0 | 29f8457d | 88 BPM | **6.1 s (cold)** | 5.8 s | 2,047 / 17 | SET_TEMPO 88 | 109 ms | 1,714 → 1,710 | 13,114 |
| 1 | 29f8457d | jazz | 9.7 s | 9.3 s | 2,045 / 405 | REHARMONIZE 47–62 | 107 ms | 2,373 → 2,373 | 13,785 |
| 2 | a69541f2 | 88 BPM | 3.7 s | 3.5 s | 2,327 / 17 | SET_TEMPO 88 | 122 ms | 2,477 → 2,477 | 13,880 |
| 3 | a69541f2 | jazz | 13.7 s | 13.5 s | 2,324 / 631 | REHARMONIZE ×3: 15–22, 36–43, 53–60 | 140 ms | 2,479 → 2,479 | 13,882 |
| 4 | ecf8eb5a | 88 BPM | 3.4 s | 3.1 s | 2,005 / 17 | SET_TEMPO 88 | 123 ms | 2,545 → 2,545 | 13,948 |
| 5 | ecf8eb5a | jazz | 6.9 s | 6.6 s | 2,003 / 214 | REHARMONIZE 23–30 | 123 ms | 2,539 → 2,539 | 13,942 |

- Attempts 1 in all 6; every op verdict ok; checks ok; no `check failed`, no retry, no context refusal. p50 6.5 s, max 13.7 s.
- "Cold" = the first plan after Ollama started (model read from disk). Every plan reloads the model because each one ends with an unload, so
  "warm" means the OS file cache is warm: tempo plans 3.4–3.7 s warm against 6.1 s cold. Jazz plans cost more for their completion length (214–631 tokens).
- The unload ack came back in 1–2 ms. The server's own first poll after it was already empty (107–140 ms), and the script's independent
  100 ms poller agreed within 1 ms. VRAM was back to the pre-plan reading at the first sample after "empty", 0–4 MiB off.
- `/api/ps` while loaded: `context_length` 16384, `size_vram` = `size` = 11.67 GB (no CPU spill), card peak 13.1–13.9 GB.
- The baseline rose about 660 MiB after the first render (yue-server's CUDA context, as SP-1 saw). Each plan is compared with the reading just before it.

## Renders (6, YuE2, cot full)

| song | plan | wall | semantic tok | **tok/s** | est s (plan) | actual s | Δ | truncated | Q: | tempo from median bar | Δ |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 29f8457d | 88 BPM | 76 s | 4,370 | **90.4** | 177.3 | 174.8 | −1.4% | no | 88 | 87.91 | −0.10% |
| 29f8457d | jazz | 72 s | 4,398 | 97.0 | 177.3 | 175.9 | −0.8% | no | 88 | 87.59 | −0.46% |
| a69541f2 | 88 BPM | 86 s | 5,179 | 94.3 | 210.0 | 207.1 | −1.4% | no | 88 | 87.91 | −0.10% |
| a69541f2 | jazz | 84 s | 5,189 | 94.4 | 210.0 | 207.5 | −1.2% | no | 88 | 87.91 | −0.10% |
| ecf8eb5a | 88 BPM | 68 s | 4,267 | 96.7 | 174.5 | 170.6 | −2.2% | no | 88 | 87.91 | −0.10% |
| ecf8eb5a | jazz | 68 s | 4,269 | 96.2 | 174.5 | 170.7 | −2.2% | no | 88 | 87.91 | −0.10% |

- tok/s = `tokens.semantic / timing.semantic_seconds` from the yue job. `planning_seconds` 0.001 and abc tokens 0 everywhere: the supplied score was used, with no re-plan.
- The duration estimate runs 0.8–2.2% long, the same constant shortfall SP-3 saw (~1.3%). Card peak while rendering: 10.7–11.2 GB.
- SheetSage2 counted the same bars as the score (65/77/64; one render 66 vs 65, a pickup) and transcribed `Q:` 88 for all six.

## Chords on the reharmonized bars (reported, not pass/fail)

The SP-3 method: SheetSage2 per-bar majority chord, offset fitted on the unedited bars only (it came out 0 everywhere), and chance = the same
chords at every other offset at least 4 bars away. Each jazz render's base is the tempo render (same seed, same notes, only the chords differ),
so "did the audio chord move" can be compared directly.

| song (bars) | root vs NEW | root vs OLD | chance root mean / p95 (SP-3: 0.07–0.21 / 0.25–0.38) | tones NEW / OLD (Jaccard) | chance tones | audio chord changed vs base render: edited / unedited bars |
|---|---|---|---|---|---|---|
| 29f8457d (16) | 0.00 | 0.00 | 0.41 / 0.81 | 0.71 / 0.60 | 0.62 | **100% / 2%** |
| a69541f2 (24) | 0.25 | 0.25 | 0.24 / 0.80 | 0.73 / 0.60 | 0.38 | **100% / 0%** |
| ecf8eb5a (8) | 0.75 | 0.75 | 0.26 / 1.00 | 0.81 / 0.85 | 0.36 | **50% / 2%** |

- **The planner changed no roots** (Q-034). All three jazz plans rewrote the chorus as the same roots with 7ths and a first-inversion bass:
  Dm → Dm7/F, Bb → Bb7/D or Bbmaj7/D, F → Fmaj7/A, C → Cm7/E (`29f8457d`, `a69541f2`) or Cm7/Eb (`ecf8eb5a`). Root agreement "vs NEW" therefore
  equals "vs OLD" by construction and says nothing about adherence. Chance is also high here, because these choruses repeat 2–4 chords.
- **The render did follow the edit.** On the edited bars the transcribed chord changed from the base render's in 100% / 100% / 50% of bars,
  against 0–2% on the unedited bars. YuE2 played the inversion bass, which SheetSage2 reads as the root (Dm7/F → `F:maj`, Bbmaj7/D → `D:min`),
  and the quality change C → Cm7 came out as `Eb:maj6`, which has Cm7's notes. Chord-tone agreement moved toward the new chords on two songs
  (0.71 vs 0.60, 0.73 vs 0.60). On `ecf8eb5a` it did not (0.81 vs 0.85): only the F and C bars moved there; Dm7/F and Bb7/D stayed `D:min` / `Bb:maj`.
- Musical note for the owed listen: `Cm7/E` (two songs) puts a bass note outside the chord against the key's major C. The validator accepts it,
  since any root is allowed as a bass. Whether it sounds wrong is a listen item (Q-034).

## F-017 #5: the score routes during a live YuE2 job

24 calls (12 `/v1/scores/read` + 12 `/v1/scores/apply`), two pairs per render, all in the semantic stage (300+ and 2,000+ tokens in):
**10–22 ms each, HTTP 200, nvidia-smi before = after (0 MiB delta) on all 24.** yue-server logged 6 "Loading model" lines for 6 jobs, so no call
loaded a model. tok/s of the probed renders: 90–97 (no slowdown).

## Criteria

| criterion | verdict | evidence |
|---|---|---|
| Stop rule: hand-off ≤ 5 s | **pass** | 107–140 ms ack → `/api/ps` empty |
| Stop rule: YuE2 ≥ 80 tok/s | **pass** | 90.4–97.0 |
| Stop rule: plan p50 ≤ 60 s | **pass** | p50 6.5 s, max 13.7 s, cold 6.1 s |
| F-019 #2 (live, 3 songs × 2 requests, valid within 3 attempts) | **pass** | 6/6 on the first attempt; SP-2 saw 97% / 100% |
| F-020 #2 (`/api/ps` empty ≤ 5 s; VRAM within 0.3 GB of pre-plan; next render ≥ 80 tok/s) | **pass** | 107–140 ms; 0–4 MiB; 90.4–97.0 |
| F-017 #5 (routes during a YuE2 job: < 1 s, no model load, within 50 MB) | **pass** | 10–22 ms; 0 MiB; 6 loads for 6 jobs |
| F-025 #1 (CP1 script runs request → plan → apply → render → new version, log under pipeline/) | **pass** | 6 versions written to the throwaway copy; this file + `cp1-summary.json` |
| F-025 #3 measured: tempo within 4% of `Q:` | **pass** | −0.10% to −0.46% |
| F-025 #3 measured: estimate vs actual, truncated | logged | −0.8% to −2.2%; truncated 0/6 |
| F-025 #3 measured: root agreement vs chance | logged, **uninformative** (Q-034) | no roots changed; audio chord changed on 100/100/50% of edited bars vs 0–2% unedited |
| F-025 #2, #4, #5 (in-app run, ACE-Step loaded/after-generation repeats, the user's A/B) | not in CP1 | W5 |

## Files

- `server/scripts/scoreCp1.ts`, `server/scripts/scoreCp1Lib.ts`: the CP1 driver and its CP1-only helpers (proxy, sampler, render, version write).
- `pipeline/cp1/cp1_analyze.py`: SheetSage2 tempo/chord analysis (imports SP-3's `analyze.py`).
- `pipeline/cp1/cp1-summary.json`: every number above. No lyrics or style text: ops without style, booleans for style checks.
- `pipeline/cp1/nvidia-smi.csv`: the GPU trace.
- `pipeline/cp1/raw/` (gitignored: holds library style text and server logs): `log.json` (full run, proxy events, 100 ms `/api/ps` trace),
  `run.log`, `analysis.json` (per-bar chords), `analyze.out`, `yue-server.log`, `server-3201.log`, `ollama-11435.log`.
- Renders for the owed A/B listen are in the throwaway copy, not in the repo:
  `%TEMP%/claude/E--repos-Mulakai/<session>/scratchpad/cp1/data/audio/` (`29ffdc2f`, `b718d942`, `b9fc9d21`, `1536cde2`, `97460aba`, `650c45f1` `.flac`).
  The scratchpad can be cleared, so copy them out if the listen should use these takes.

Stopped at the end: yue-server (WSL pid 296), the Mulakai server on :3201, Ollama :11435, the proxy, and the sampler. `/api/ps` was empty
on :11435 before the stop and is empty on :11434. Card back to 1,722 MiB.
