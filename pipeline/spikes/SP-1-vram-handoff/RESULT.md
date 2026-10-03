# SP-1 · VRAM hand-off (R-003, R-019)

Run 2026-10-03, RTX 4080 16 GB (16,376 MiB), Windows 11 + WSL2 Ubuntu-24.04, Ollama 0.32.15, yue-server (YuE2-3B, bf16, torch backend, default budget), ACE-Step 1.5 `acestep-api` with the three start-all.bat offload flags.

## Question

Can a local planner LLM on the 16 GB card be loaded, used for one plan call, unloaded with a confirmed release, and have YuE2 render at its normal speed right after with no shared-memory spill; and does a score near the 4,096-token budget stay under 14 GiB peak and untruncated?

## Criterion (from risks.md SP-1, unchanged)

1. VRAM back within 0.3 GB of baseline <= 5 s after the unload ack.
2. YuE2 semantic tokens/s >= 85 right after the hand-off (spike baseline 94-95). A supplied score skips YuE2's plan stage ("Using provided score", `planning_seconds` 0.001, 0 abc tokens), so only the semantic stage has a rate to measure.
3. No growth in shared GPU memory.
4. Near-budget render: peak <= 14 GiB and untruncated.

## Verdict

- **Hand-off (criteria 1-3, R-003): proven.** Unload is confirmed in ~0.1 s, VRAM is back at baseline in the same ~0.1 s, YuE2 then runs as fast as it does with no planner in the same epoch, shared memory does not grow. D-011 stands.
- **Near-budget (criterion 4, R-019): peak passes, "untruncated at ~4,096 tokens" is disproven.** A 4,055-token score renders at an 11.4 GB card peak (well under 14 GiB) but hits YuE2's 9,000-semantic-token cap (360 s) and is returned `truncated`. The binding limit is song duration (about 2,900 score tokens for this style), not the 4,096-token planning budget.
- Overall: `proven` for the question as asked about the hand-off; R-019's budget claim is `disproven` and needs a duration-based limit (below).

Evidence level: *seen running*, on the real platform (real card, real WSL2 yue-server, real Ollama). The NVIDIA "Sysmem Fallback Policy" was not toggled (system setting, off limits); the policy that was active is unknown.

## Setup (exact)

- Planner: **`qwen3:14b`**, Ollama library (ollama.com/library/qwen3), digest `bdbd181c33f2`, 9,276,198,565 bytes on disk (9.3 GB), Q4_K_M, 14.8B parameters, dense, 40 layers, 8 KV heads. Chosen as the current dense ~14B instruct-capable tag; alternatives seen, not pulled: `ministral-3:14b` (9.1 GB), `phi4`. One download only (user-approved, ~9 GB). It stays in the user's Ollama store; remove with `ollama rm qwen3:14b`.
- Ollama: the user's server on :11434 was left untouched and idle. I ran my own `ollama serve` on 127.0.0.1:11435 with `OLLAMA_CONTEXT_LENGTH=16384` (same model store), stopped at the end. `/api/ps` reported `context_length: 16384`.
- Planner footprint at ctx 16384 (flash attention off, default KV type): 41/41 layers on GPU, weights 8,423 MiB + KV 2,560 MiB + compute ~150 MiB; `/api/ps` `size_vram` 10.87 GiB. Card total with desktop and yue context: 13.2-14.0 GiB (13,507 / 14,361 MiB), i.e. ~2 GiB headroom. A larger context or model would not fit.
- Planner call: real library score `2c944049` (1,472 YuE tokens, a 176.6 s song) + its stored style and lyrics + condensed dialect rules + the request "jazz chords in the chorus, 88 BPM, add a 4-bar sax phrase after it", via `/v1/chat/completions` with a strict JSON-schema `response_format`, `reasoning_effort: "none"`. 2,448 prompt tokens, 292 completion tokens, valid JSON (SET_TEMPO 88, REHARMONIZE chorus, WRITE_PHRASE).
- YuE2 job: `POST /v1/jobs` with the same song's stored style, lyrics, seed, the sidecar `.abc` as `abc`, `cot` full. 4,416 semantic tokens, 176.6 s audio, same job every time.
- Logs: `nvidia-smi.log` (`-lms 250`, 9.5k lines, from 12:38), `vram_ndr.csv` (NVML, 50 ms, last run only), `shared_gpu.csv` (Windows "GPU Adapter Memory" Shared/Dedicated usage, 1 Hz; the NVIDIA adapter is luid `0x00012d2d`), `events.log` (timestamped steps), `results.json` (every number below), `shared_gpu_summary.txt`.

## Evidence

### Steps 2-3: hand-off (planner on, unload, YuE2 immediately)

| run | planner call (cold load incl.) | card peak, planner loaded | unload ack | `/api/ps` empty | VRAM within 0.3 GB of pre-call baseline | YuE2 semantic tok/s (timing / live) | YuE2 card peak |
| --- | --- | --- | --- | --- | --- | --- | --- |
| handoff | 7.9 s | 14,361 MiB | 1 ms | ack+0.10 s | ack+0.10 s | 92.8 / 95.1 | 11,513 MiB |
| handoff2 | 8.4 s | 13,507 MiB | 16 ms | ack+0.11 s | ack+0.11 s | 86.7 / 88.9 | 10,641 MiB |
| handoff3 | 8.4 s | 13,622 MiB | 1 ms | ack+0.10 s | ack+0.10 s | 87.1 / 88.9 | 10,652 MiB |

- Unload call: `POST /api/generate {"model":"qwen3:14b","keep_alive":0}`; it returns in 1-20 ms (before the unload finishes), so the confirmation is the poll of `GET /api/ps` every 250 ms (first poll already empty) plus VRAM. No wait or sleep was needed anywhere.
- Controls (YuE2 alone, planner never loaded, same epoch): `control` 94.2 / 96.3 tok/s (matches the 94-95 spike baseline); `control2` 86.4 / 89.0. The runs after 13:00 are ~8% slower with or without a planner (see Surprises), so the hand-off adds nothing measurable: handoff 92.8 vs control 94.2; handoff2/3 86.7/87.1 vs control2 86.4. Criterion 2 (>= 85) holds in every run, thinly in the 13:00+ epoch (live rate 88.9).
- Shared GPU memory (NVIDIA adapter, MB, `shared_gpu_summary.txt`): baseline ~330 (or ~225 after the 13:00 restart); transiently +0.5-0.9 GB while the planner loads (max 863, 795, 798); back to baseline within 10 s of the unload; during the YuE2 job after the hand-off the max was 395, 264, 264 (noise, no growth). Pass.
- After a YuE2 job, idle VRAM sits ~0.3-0.6 GB above the pre-job idle (yue-server CUDA context, seen 2,215 -> 2,552-3,003 MiB). Idle baseline drifted 0.95-3.0 GB over the session with the desktop apps, so the real build must compare against a baseline taken just before the planner call, not a constant.

### Step 4: negative control (planner left loaded, `keep_alive` 5 m, then YuE2)

| run | YuE2 outcome | semantic tok/s (timing / live) | card peak | shared GPU memory | unload + back to baseline |
| --- | --- | --- | --- | --- | --- |
| negative | succeeded, 75.6 s | 86.8 / 90.6 (control 94.2 / 96.3) | 16,128 MiB of 16,376 | 1,257 max (planner alone ~863) | 0.39 s |
| negative2 | succeeded, 85.0 s | 76.2 / 80.1 (control2 86.4 / 89.0) | 16,081 MiB | 1,231 max | 0.38 s |

This did **not** reproduce the documented stall (PLAN.md: 9 tok/s, never finished, with ACE-Step resident). Here co-residency cost ~10% speed, filled the card to 98%, and added ~0.4 GB of shared memory. Why it survived is inferred, not shown: the planner's weights were idle, so the driver could demote them while YuE2 allocated. Not a licence to co-reside: the card was full, it fails below ~11 GB of resident planner headroom, and it was run under whatever sysmem policy was active (unknown; "once per sysmem policy" not done, the policy is a system setting I do not change). The design (unload first) is still right and costs ~0.1 s.

### Step 5: CPU-only planner (feeds Q-012)

`POST /api/chat` with `options.num_gpu 0`, `num_ctx 16384`, `think:false`, `keep_alive 0`, same prompt and schema: **98.7 s** wall (load 4.3 s, prompt eval 2,448 tokens in 34.6 s = 71 tok/s, generation 292 tokens in 59.7 s = 4.9 tok/s), valid JSON, VRAM rose only ~0.3 GB (2,551 -> 2,848 MiB, CUDA context). Same plan on the GPU: 7.9-8.6 s including a cold load, i.e. CPU is ~12x slower and over D-013's 60 s p50 line for this one short plan. 127 GB RAM was free, so this is the fast end of CPU planning. (An earlier CPU run without `think:false` spent all 1,500 tokens thinking, 331 s, invalid JSON; see Surprises.)

### Step 6: near-budget renders (planner not loaded)

Scores built by repeating a real score's first chorus (`c8144c53`, 1,780 tokens) and repeating the lyrics' first `[Chorus]` to match; tokens counted with chords kept using YuE2's own tokenizer (`count_tokens.py`; `build_near_budget.py`). Files: `near_2700.abc`, `near_3300.abc`, `near_budget.abc`.

| score tokens (chords kept) | result | semantic tokens | audio | card peak | semantic tok/s (timing) |
| --- | --- | --- | --- | --- | --- |
| 2,655 | `succeeded`, untruncated | 8,188 | 327.5 s | 11,372 MiB (11.1 GiB) | 79.8 |
| 3,180 | **`truncated`** (semantic) | 9,000 (cap) | 360.0 s | 11,510 MiB | 79.9 |
| 4,055 | **`truncated`** (semantic) | 9,000 (cap) | 360.0 s | 11,412 MiB | 73.5 |

- Peak: ~11.4 GB on the card including ~1.3-2.2 GB of desktop/other, so ~9.5-10 GB for YuE2. Far under 14 GiB. The 14.08 GiB max-context peak from PLAN.md did not appear.
- Truncation is at `max_tokens` 9000 (360 s at 25 Hz), not at the plan budget. Semantic tokens per score token: 3.08 here, 3.0 for `2c944049` (4,416/1,472); library durations give 2.3-3.0 (`84a51811` 2,880 tokens -> 264.7 s; `3820c535` 1,485 -> 157.6 s; `c8144c53` 1,780 -> 214.8 s). So ~2,900 tokens is the ceiling for dense material and ~3,900 for sparse, and it depends on bar count x tempo, not tokens.
- The longest library sidecar (`0a7cff01`, 342.6 s song) is exactly 4,096 tokens and **fails validation** ("group 60, Ins: expected V: Ins", 422 from `POST /v1/jobs`): it is the planner's own output cut at its 4,096-token generation cap. Seen in data; I did not render it.
- A first near-budget attempt was killed by an external stop of the whole dev stack (below); the rerun above is the valid one.

## What the real build should copy

1. Planner call: `/v1/chat/completions`, strict JSON-schema `response_format`, and for a thinking model (qwen3) `"reasoning_effort": "none"`; otherwise it burns the whole token budget in reasoning and returns empty content.
2. Release: after the last retry, `POST {OLLAMA}/api/generate {"model":M,"keep_alive":0}`, then poll `GET /api/ps` (250 ms) until `models` is empty (took ~0.1 s), keep the GPU slot until then, then submit the render. Optionally read `nvidia-smi`/NVML `memory.used` and compare with a baseline taken before the planner call (not a fixed constant), tolerance 0.3 GB.
3. Context preflight: `/api/ps` returns `context_length` for the loaded model (16384 with `OLLAMA_CONTEXT_LENGTH=16384`); `size_vram` vs `size` tells whether any layers spilled to the CPU (equal here).
4. Planner sizing: qwen3:14b Q4_K_M at 16k context takes ~10.9 GiB; ~2 GiB of the card stays free. Do not raise context or model size without re-measuring.
5. Review limit for REPEAT/WRITE PHRASE: refuse by estimated duration, not only tokens. Hard stop at 360 s (9,000 semantic tokens); warn above ~330 s; compute duration from bars x meter / `Q:` BPM. Keep the 4,096-token check too (it is a separate 422), counted with chords kept. A `truncated` result is a successful job that returns half a song: surface it as a warning, never as DONE.
6. YuE2 rate gate: with a supplied score only the semantic rate exists; use >= 80 tok/s as the alarm line, not 85 (this machine ran 86-95 depending on the day).
7. Keep unloading even though co-residency "worked": it is cheap and the margin of the negative control was not a design margin.

## Surprises

- All dev-stack processes (ACE-Step, node server, yue-server) disappeared together at 12:59:24, mid-run of my first near-budget job. Not a yue crash; an external stop (the user or another session). I restarted only yue-server (as in the README) and ACE-Step (`uv run acestep-api --port 8001` with `ACESTEP_OFFLOAD_TO_CPU`, `ACESTEP_OFFLOAD_DIT_TO_CPU`, `ACESTEP_LM_OFFLOAD_TO_CPU` true, exactly as start-all.bat does), and stopped both when done. The node server (3001) and client were not restarted; they are down.
- The ACE-Step command in the task brief (`uv run acestep ... --enable-api --backend pt`, the Gradio launcher) loads DiT and LM at startup and held ~4.8 GB on the card (5.8 GB total) even with `ACESTEP_OFFLOAD_TO_CPU=true` alone. I stopped it and used `acestep-api`, which idles at ~0 GB (`models_initialized: false`) until the first job. After a real ACE-Step generation the parked footprint (~0.5 GB, documented) was not exercised; it adds to the baseline and does not touch the planner path.
- A thinking model through `/v1` without `reasoning_effort: "none"`: 1,500 completion tokens, empty content, 71 s. Same with native `/api/chat` without `think:false` (331 s on CPU). Relevant to SP-2 and D-012.
- YuE2 ran ~8% slower (94 -> 86-87 tok/s) after the 13:00 yue-server restart, with and without a planner; cause unknown (fresh process, ACE-Step API process present, thermal not indicated: 51 C, 2,535 MHz). The first job after a long idle was also slower (82.7 s vs 72-77 s, 54 s semantic stage) from model load/warmup.
- Loading the planner raises Windows' Shared GPU memory by 0.5-0.9 GB transiently (staging), which returns after unload. A check "shared memory must not grow" must not run while the planner is loading.

## Not covered / owed

- Sysmem Fallback Policy on vs "Prefer No Sysmem Fallback": not toggled. The user would need to flip it in NVIDIA Control Panel and re-run `python run.py negative` and `handoff` to see whether the negative control then fails loudly (`out_of_memory`) instead of passing.
- ACE-Step after a real generation (parked ~0.5 GB) and the real queue (`genLock`/`genQueue`) were not in the loop.
- Planner quality (SP-2), cot=full adherence (SP-3) are other spikes.
- No KV-cache quantisation or flash attention tried; they would shrink the planner footprint.

## Re-run

Needs yue-server on :8004, an Ollama on :11435 with `OLLAMA_CONTEXT_LENGTH=16384` and `qwen3:14b`: `python run.py baseline handoff negative cpu control near_2700 near_3300` (env `KEY=` names a result slot, `NEG_CANCEL_S` caps the negative control). Inputs are rebuilt by `make_inputs.py` and `mk_near_variant.py` from the library in `server/data` (read-only).
