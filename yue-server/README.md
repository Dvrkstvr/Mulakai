# yue-server

Thin HTTP wrapper around the official [YuE2](https://github.com/multimodal-art-projection/YuE)
pipeline, so Mulakai can use YuE2 as an optional **first-take engine** on
Create › PROMPT (see `PLAN.md`, "Multiple Song-Creation Engines"). YuE2 may
also re-render a song it made from an edited copy of that song's score (the
SCORE verb, `PLAN.md`'s "Score Agent"); every audio edit (repaint, Add Layer,
extract, remaster) still runs on ACE-Step.

It runs **inside WSL2**, not on native Windows: on Windows YuE2's acoustic
stage falls back to the MATH attention kernel (~6x slower, ~7 GB more VRAM;
upstream issue #209). In WSL2 it gets FlashAttention and CUDA graphs.

Measured on an RTX 4080 16 GB (2026-09-30): a ~3-minute song takes ~95 s
(RTF 0.54), peaks at ~8.1 GiB in PyTorch (~10.2 GB on the card including the
desktop) and does not spill. Numbers and logs: `PLAN.md`, "YuE2 spike results".

## 1. WSL2 + Ubuntu 24.04

In an **admin** PowerShell:

```powershell
wsl --install --no-distribution   # enables WSL + Virtual Machine Platform
```

**Reboot now.** A distro installed before this reboot never registers. Then:

```powershell
wsl --install -d Ubuntu-24.04
```

No Linux NVIDIA driver is needed; the Windows driver provides CUDA inside
WSL. Check with `wsl -d Ubuntu-24.04 -- nvidia-smi`.

### If Ubuntu's first-run user setup hangs

On the spike machine the "create a default UNIX user" prompt hung and locked
up all of WSL, including `wsl --shutdown`. The fix is to stop the WSL service
and create the user as root instead:

```powershell
# admin PowerShell
Stop-Service WSLService -Force
wsl -d Ubuntu-24.04 -u root
```

Then, inside that root shell (replace `you` with your user name):

```bash
adduser you
usermod -aG sudo you
printf '[boot]\nsystemd=true\n\n[user]\ndefault=you\n' > /etc/wsl.conf
exit
```

and `wsl --terminate Ubuntu-24.04` from PowerShell. The next `wsl -d
Ubuntu-24.04` logs in as that user.

## 2. The venv (inside WSL)

YuE2 pins Python 3.12 and torch 2.10.0, which conflict with ACE-Step's and
HeartMuLa's stacks, so it gets its own venv. Keep it on the Linux filesystem
(`~`), not under `/mnt/`.

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh     # then open a new shell
mkdir -p ~/yue2 && cd ~/yue2
uv venv --python 3.12 .venv
source .venv/bin/activate
uv pip install -r /mnt/e/repos/Mulakai/yue-server/requirements.txt
```

`requirements.txt` installs `yue2-infer` from upstream at the pinned commit
(0.1.6), plus FastAPI, uvicorn and scipy (the chat's splice). YuE code is
never copied into this repo. An existing venv gets scipy with
`~/yue2/.venv/bin/pip install scipy==1.18.0`.

## 3. `yue2 doctor` and the weights

```bash
yue2 doctor                   # dependencies + GPU (expects BF16, CC >= 8.0)
yue2 doctor --verify-hashes   # downloads and hash-checks the weights (~7.8 GB)
```

The weights land in the Hugging Face cache (`~/.cache/huggingface/hub`).

## 4. Start the server

`start-all.bat` does this for you: when it finds `~/yue2/.venv` in the
`Ubuntu-24.04` distro (override with `YUE_VENV` / `YUE_DISTRO`), it starts
the server as below and sets `YUE_API_URL` for Mulakai's server.

To run it yourself: WSL does not start on its own, so launch the server from Windows through
`wsl.exe` (a terminal, a shortcut, or a Task Scheduler startup task). The
server process keeps the distro running; closing it lets WSL shut down.

```bat
wsl.exe -d Ubuntu-24.04 --exec bash -lc "cd /mnt/e/repos/Mulakai/yue-server && YUE_DATA_DIR=~/yue-data ~/yue2/.venv/bin/python main.py"
```

(Works from cmd and PowerShell; adjust the `/mnt/e/...` path to your
checkout.) Add `YUE_API_KEY=<secret>` before `~/yue2/...` to require a bearer
key.
Startup verifies the weight hashes (~6 s) and then reports ready; the model
itself is read from disk on the first job (~3 s) and parked in system RAM
after every job, including cancelled and failed ones. Between jobs the
server holds only its CUDA context (~0.8 GB on the card).

Point Mulakai's server at it (Windows side):

```bat
set YUE_API_URL=http://127.0.0.1:8004
set YUE_API_KEY=<secret>          & REM only if you set one above
```

Use `127.0.0.1`, not `localhost`: WSL's NAT-mode forwarding is IPv4-only, so
`[::1]` does not answer, and `localhost` may resolve to it.

**ACE-Step must run with `ACESTEP_OFFLOAD_TO_CPU=true`** whenever an engine
is configured. A YuE2 job needs ~9 GiB free; ACE-Step idles at ~0.5 GB with
offload on and holds far more with it off.

### Recommended: NVIDIA "Prefer No Sysmem Fallback"

On Windows, when a CUDA allocation goes over the card's memory, the driver
spills into shared system RAM instead of failing, which shows up as a silent,
severe slowdown. Setting **NVIDIA Control Panel → Manage 3D settings → CUDA –
Sysmem Fallback Policy → Prefer No Sysmem Fallback** makes a real overrun
fail loudly as an `out_of_memory` job instead. YuE2 already caps its own
PyTorch allocations at the card total minus 2 GiB; the setting guards the
case where something else holds VRAM at the same time. It is a system
setting: Mulakai and this server document it and never change it.

## 5. Covers: SheetSage2 (optional)

YuE2 covers a song by its melody: [SheetSage2](https://huggingface.co/m-a-p/SheetSage2)
transcribes the source into a score, and YuE2 sings that score in a new
style (`PLAN.md`, "YuE2 Melody Covers via SheetSage2"). SheetSage2 pins
Python 3.11, torch 2.8 and NumPy 1.24, which clash with YuE2's venv, so it
gets its own. yue-server runs it as a subprocess, one job at a time on the
same worker, so it never shares the GPU with a song.

Inside WSL (FFmpeg 6.1 comes with Ubuntu 24.04: `sudo apt install ffmpeg`):

```bash
mkdir -p ~/sheetsage2 && cd ~/sheetsage2
uv venv --python 3.11 .venv
uv pip install --python .venv/bin/python huggingface-hub==0.36.0
.venv/bin/huggingface-cli download m-a-p/SheetSage2   --revision cafc0df1021e14f49e928c4b345f5959d414ef64 --local-dir SheetSage2
uv pip install --python .venv/bin/python torch==2.8.0 torchaudio==2.8.0   --index-url https://download.pytorch.org/whl/cu126
uv pip install --python .venv/bin/python -r SheetSage2/requirements.txt
.venv/bin/python SheetSage2/setup_render.py   # the piano preview's renderer
```

- **No Hugging Face login is needed.** The first transcription fetches
  SheetSage2's MERT-v2-FullSong parent (`d8ba1c74…`) into the HF cache.
- **The revision is pinned** because SheetSage2 loads with
  `trust_remote_code`: the pin is what makes that code the reviewed code.
  `cafc0df1` is what the cover spike ran.
- **The piano preview renderer:** without `setup_render.py`, a
  transcription still returns its score, with a warning and no preview.
  On a minimal Ubuntu, use `setup_render.py --with-deps`.

Then start yue-server with the two paths (`start-all.bat` does this when
`~/sheetsage2/.venv` exists; override with `YUE_SHEETSAGE_HOME`):

```bash
YUE_SHEETSAGE_PYTHON=~/sheetsage2/.venv/bin/python YUE_SHEETSAGE_DIR=~/sheetsage2/SheetSage2   YUE_DATA_DIR=~/yue-data ~/yue2/.venv/bin/python main.py
```

`GET /v1/transcriptions/health` answers 200 once both are found. Measured
on the 4080: 6–12 s per song, about 3.7 GB on the card.

## Config (env vars, all optional)

| Variable | Default | Meaning |
| --- | --- | --- |
| `YUE_API_KEY` | empty | Bearer key for `/v1/*`. Empty = no auth. Health routes are always open. |
| `YUE_HOST` / `YUE_PORT` | `127.0.0.1` / `8004` | Bind address. `127.0.0.1` inside WSL is reachable from Windows. |
| `YUE_DATA_DIR` | `./data` | Job artifacts. Prefer a Linux path such as `~/yue-data`. |
| `YUE_RETENTION_HOURS` | `24` | Finished jobs and their files are deleted after this. |
| `YUE_MAX_PENDING` | `4` | Queued + running jobs before `POST /v1/jobs` returns 429. |
| `YUE_MODEL` / `YUE_VAE` | `m-a-p/YuE2-3B` / `m-a-p/YuE2-Vae` | HF repo ids or local paths. |
| `YUE_BUDGET_GIB` | `24` | yue2's `--budget`. PyTorch is capped at min(budget, card) − 2 GiB. |
| `YUE_QUANTIZATION` | `none` | `fp8` exists but is **not recommended**: it disables CUDA graphs, runs 4.6x slower on the 4080, saves ~0.2 GiB and changes the song for a given seed. |
| `YUE_OFFLOAD_AR` | off | yue2's `--offload-ar`. Measured to change nothing at 16 GB (the peak is in the semantic stage). |
| `YUE_SHEETSAGE_PYTHON` / `YUE_SHEETSAGE_DIR` | empty | SheetSage2's venv Python and its snapshot folder (holding `infer.py`). Either empty = no transcription (section 5). |
| `YUE_MAX_UPLOAD_MB` | `300` | Largest audio `POST /v1/transcriptions` accepts (a library WAV is about 23 MB a minute). Keep it at least Mulakai's `COVER_MAX_UPLOAD_MB`, which forwards the source here. |

## API

The shared engine contract (`PLAN.md`, design point 3): YuE2-Turbo's
`yue2-serve` job API, so Mulakai's one engine client talks to either.

- `POST /v1/jobs` — body `{style, lyrics, seed, cot?, cfg_scale?, id?, abc?}`.
  `seed` is **required** (YuE's own default is a fixed 831001). `cot` is
  `full` (default) / `melody` / `off`; `cfg_scale` 0–20. Unknown fields →
  422. Mulakai sends its own job id as the **`Idempotency-Key`** header: it
  is logged and echoed as `idempotency_key`, and resubmitting the same key
  with the same body returns the original job (200) instead of starting a
  second song; the same key with a different body is a 409. For
  compatibility, a filename-safe body `id` (echoed as `request_id`) and an
  `X-Admission-Id` header (echoed as `admission_id`) are also accepted.
  → **202** with the job record and `Location: /v1/jobs/{id}`; 503 while the
  pipeline is loading or failed to load; 429 when the queue is full.
  - `abc` is a supplied score, for a cover. It is at most 64 KB, and `cot`
    must be `melody` or `full`.
  - It must be in YuE2's native two-voice ABC (the `Vocal` / `Ins` voices
    SheetSage2 and YuE2 write) and within the 4096-token planning budget.
    Otherwise it is a 422.
  - With `cot=melody`, its chord symbols are stripped first, since YuE2
    doesn't strip them itself.
  - Tags-only lyrics with a score make an instrumental cover: the score's
    `Vocal` notes move to `Ins` (see Instrumentals).
- `GET /v1/jobs/{id}` — the job record (below).
- `POST /v1/jobs/{id}/cancel` — returns the job record. A queued job is
  cancelled at once; a running one at the next token, ODE step or stage
  boundary. Cancelling a finished job changes nothing.
- `GET /v1/jobs/{id}/audio` — `audio/flac`, 48 kHz stereo, 24-bit. 409 unless
  the job is `succeeded` or `truncated`.
- `GET /v1/jobs/{id}/score` — the ABC score plan (`text/plain`). 404 when
  there is none (`cot=off`).
- **Transcriptions** (section 5): SheetSage2 reads a song's melody into a
  score. They use the same auth, queue, retention and `Idempotency-Key`
  replay as `/v1/jobs`. A record has `kind: "transcription"`, where a
  song's has `kind: "song"`, and has no `seed`, `tokens` or `request_id`.
  Each route family 404s the other kind's ids.
  - `POST /v1/transcriptions` takes a multipart `audio` field and an
    optional `chords` form field (`true`/`false`, default `false`; anything
    else is 422). It returns **202** with the record and `Location`. 400 for
    empty audio, 413 over `YUE_MAX_UPLOAD_MB`, 503 when transcription isn't
    available. A replayed `Idempotency-Key` with another `chords` is 409.
    - Default (Guided Create's COVER): `infer.py --melody-only
      --render-audio`, a melody-only score with a piano preview.
    - `chords: true` (a chat reading, D-131): neither flag, so SheetSage2
      writes its chord labels as chord symbols in the `Vocal` voice and
      renders no preview (`preview_url` null, no warning). A song where
      SheetSage2 hears no chord gets none.
  - `GET /v1/transcriptions/{id}`: the record. `stage` is `transcribing`,
    and `progress` is the fraction of SheetSage2's windows.
  - `POST /v1/transcriptions/{id}/cancel` kills the SheetSage2 process.
  - `GET /v1/transcriptions/{id}/score`: the score in both voices, as
    `text/plain`; chord symbols only when `chords` was true.
  - `GET /v1/transcriptions/{id}/preview`: SheetSage2's piano rendering of
    it, as `audio/wav`. 404 when the render failed or `chords` was true.
  - `GET /v1/transcriptions/{id}/grid` (chat C1, D-174): a `chords: true`
    run's downbeat grid from SheetSage2's `downbeat.lab` / `chord.lab`, in
    the server's `grid_v: 1` sidecar shape `{grid_v, source: "tracked",
    downbeats, chords: [[t0, t1, label]], duration}`, so one run gives a
    version both its transcribed score and its bar grid. 409 until the job
    has succeeded; 404 `detail.code: "no_grid"` for a melody-only run or
    labs that do not make a valid grid.
  - `result` on success has `score_url`, `chords` (as requested),
    `preview_url` (or null),
    `warnings` (SheetSage2's own, plus a render failure), `measures`,
    `vocal_notes`, `instrumental_notes`, `duration_seconds`,
    `section_starts` and `timing`.
  - `section_starts` lists the score's `% label` sections in order as
    `{label, bar, seconds}`, with `bar` 0-based.
    - `seconds` is that bar's downbeat in SheetSage2's `downbeat.lab`, not
      the score's tempo grid, which can run a bar late.
    - A section past the last downbeat is extrapolated on the tempo grid.
    - It is null when there are no downbeats or no sections; the
      transcription still succeeds.
    - Mulakai's READ LYRICS places the words it reads by these times (see
      `sections.py`).
  - `error` codes: `no_score` (SheetSage2 ran but built no score) and
    `transcription_failed`, each with the last lines of its output.
- `GET /v1/transcriptions/health` needs no auth. It returns 200
  `{"status": "ready"}`, else 503 with `status` `not_configured`,
  `missing_files` (with `detail`), or the worker's `loading` / `failed`.
- **Splices** (chat C0b, D-107, docs/decisions/0005): keep the old take
  outside an edit instead of keeping a whole re-render. SP-4's A3 method
  (`pipeline/spikes/SP-4-keep-unchanged/RESULT.md`), with the owner's
  listen applied (D-147, D-150, D-154). Same auth, queue, retention, upload
  sweep and `Idempotency-Key` replay as transcriptions; `kind: "splice"`.
  It runs on the worker thread, so never beside a YuE2 render. Needs
  `scipy` in the venv (`requirements.txt`).
  - `POST /v1/splices`, multipart: `audio` = the current version's audio
    (WAV read directly, anything else through ffmpeg; 48 kHz float32
    stereo inside), `spec` = JSON:
    `{op, base_abc, render_job?, edited_abc?, base_grid?}`.
    - `op` is the plan's one op. `REHARMONIZE` (`from_bar`, `to_bar`,
      1-based) needs `render_job`, the id of this server's song job that
      rendered the edited score; its audio never leaves the server.
      `REPEAT` / `CUT` (`section`, `label`, as `/v1/scores/read` lists them)
      use the base audio alone, no render. Any other op is a 422 (the
      server renders the whole song for it).
    - `edited_abc` defaults to the render job's score; `base_grid` is the
      server's cached `grid_v: 1` grid, so SheetSage2 runs on the base only
      when it is missing.
    - 422 for a bad spec, an op outside the score or a section label that
      does not match; 409 when `render_job` is not rendered yet.
  - `GET /v1/splices/{id}`: `stage` is `decoding`, `tracking_base`,
    `tracking_render` (SheetSage2 downbeats; `progress` its windows),
    `splicing`, `checking`. `POST /v1/splices/{id}/cancel` stops it at the
    next step and deletes its files.
  - `result.verdict` is `ok` or `rerender`, with `reason` and `detail`:
    `meter` (not 4/4 throughout), `no_grid`, `render_truncated` (the new
    take ends inside the span), `not_aligned` (no groove to snap a join to,
    D-109), `level_step` (a REPEAT whose copy seam steps more than 4 dB).
    On `rerender` the server keeps its whole re-render (REHARMONIZE, D-101)
    or renders the edited score (REPEAT, CUT).
  - An `ok` result has `audio_url` (`GET .../audio`, a float32 WAV),
    `bars` (1-based, inclusive), `joins_s`, `crossfade_s`, `snap` (per
    join: `delta_ms`, `applied`, `corr`), `gain_db` (REHARMONIZE: `in`,
    `out` and one value per bar, the level match held over the whole span),
    `level_step_db` (REPEAT), `gap_shift_s` (CUT: the join moved into a gap
    in the voice band), `seams` (LUFS step and its excess over the base's
    own step), `null_test` (`samples`, `different`: always 0, else the job
    fails `null_test_failed`), `length_diff_s`, `parts`, `base_points_s`,
    `edges`.
  - `grid_urls`: `GET .../grid/base`, `.../grid/render`, `.../grid/out`
    (the spliced version's grid, its pieces' downbeats moved into place).
  - `error` codes: `render_unavailable`, `audio_unreadable`,
    `null_test_failed`, `splice_failed`.
  - `python splice_check.py <base> <saved> <result.json>` re-checks a saved
    library file (CP-C0): null test and the LUFS excess at each join.
- `POST /v1/scores/measure` — body `{abc}` → `{budget, header, sections:
  [{name, tokens}]}`: a cover score's size in the planner's tokens, against
  the 4096-token budget a supplied score must fit. The score is prepared as
  `POST /v1/jobs` prepares it (a bad one is the same 422). `header` is
  everything before the first `% name` line, and each section is its block.
  The counts add up to the whole score's, so a client can sum any cut of
  whole sections. 503 until the worker is ready.
- `POST /v1/scores/bars` (chat C1, D-174) — body `{abc, grid}` (a
  `grid_v: 1` grid: a transcription's `/grid`, a splice's `grid_urls`, or the
  server's cached sidecar) → `{offset, starts, end, agreement, bars}`: score
  bar `i` (0-based) starts at `starts[i]` s, `end` is the song's end, `bars`
  the score's bar count. It is the splice's own fit (`splice_grid.fit`: the
  integer `offset` -4..4 whose chord roots best agree over every bar, a take
  tracked at half bars thinned first), so the chat's strip and a splice
  cannot disagree. `agreement` is that fit's root agreement, null when the
  score has no chords. CPU only. 422 `detail.code` `bad_grid` or
  `bad_score` (not a native two-voice score, or no bars).
- `POST /v1/scores/apply` takes the op `WRITE_PHRASE` (F-026) as well as
  `SET_TEMPO`, `REHARMONIZE` and `EDIT_STYLE`:
  `{op: "WRITE_PHRASE", start_bar >= 1, instrument (1-40 chars), bars: [[{pitch,
  beats}, ...], ...]}`, 1-8 bars of 1-16 notes. `pitch` matches
  `^(?:z|(?:\^|_|=)?[A-Ga-g](?:,{1,2}|'{1,2})?)$` (ABC, but each note
  stands alone: a plain letter is always the key signature's note, `^ _ =`
  mark that note only; code writes the key's accidental or `=` where an
  earlier one in the bar would carry onto a plain letter; `z` is a
  rest); `beats` is one of 0.5, 1, 1.5, 2, 3, 4 quarter notes. An ABC string
  anywhere in `bars` is a 422 ("ABC strings are not accepted"), as is any
  other shape error. Code writes the ABC into the Ins voice (score units, tied
  pieces where one length cannot hold a note, a tie into the phrase undone)
  and appends `instrument` to the reply's `style` after all ops, unless the
  style already names it. Refusals, same reply shape as the other ops:
  - `verdicts[i].reason` (op not applied): `the Vocal sings in bars 11-12;
    free: 1-10, 47-65` (runs of at least N free bars, or `no N bars in a
    row`); `bar 3 of the phrase (score bar 59) sums to 3.5 beats, the meter
    needs 4 (too short by 0.5)` (every bad bar, joined with `; `); `a 4-bar
    phrase at bar 63 runs past the last bar (65)`; `a 0.5-beat note does not
    fit the score's unit L:1/4`.
  - `checks.problems` (applied, plan not ok): `WRITE_PHRASE bars 57-60:` +
    `the phrase has 3 notes; write at least 4` / `the phrase uses 2 distinct
    pitches; use at least 3` / `5 of 13 notes (38%) are in the key Dm; keep
    at least 70% in the key` / `the same bar is written 4 times; vary the
    bars` (the sanity gates, only once the edit parsed and compare held), or
    `the Ins note at bar N changes pitch once the tie into it is cut; end the
    phrase a bar earlier or later`. With a phrase, compare checks the Vocal
    only. Fixtures: `tests/data/contract/apply-write-phrase*.json`.
- `POST /v1/scores/apply` also takes `lyrics` (optional, the song's lyrics
  as sent to `/v1/jobs`) and the section ops `REPEAT` and `CUT` (F-030) and
  `REWRITE_LYRICS` (F-031). The reply always has `lyrics` (the edited
  lyrics; exactly the request's when no op changed them, null when none were
  sent), `changed.lyrics`, and `sections`: `[{index, label, from_bar,
  to_bar, seconds}]` of the edited score, each section's length as YuE2
  plays it, for a hint like "cut the outro 0:08 to fit" (null when the
  edited score does not parse).
  - `{op: "REPEAT" | "CUT", section >= 1, label (1-40 chars)}`: `section`
    is `/v1/scores/read`'s `facts.sections[].index` (the bar map's `S<n>`),
    `label` its label as a cross-check (case, `[ ]` and `:` ignored).
  - `{op: "REWRITE_LYRICS", block >= 1, tag (0-60 chars), occurrence >= 1,
    lines: [1-32 strings of at most 200 chars]}`: `block` is
    `facts.lyric_blocks[].index`; `tag` and `occurrence` are the cross-check
    (`"chorus"` or `"[Chorus]"`; a block's kind is its tag's first word, so
    `[Verse 2]` is verse 2).
  - Numbers always mean the score and lyrics as read. A plan runs in this
    order, whatever the order of `ops`: the bar ops (SET_TEMPO,
    REHARMONIZE, EDIT_STYLE, WRITE_PHRASE) in plan order, then the
    REWRITE_LYRICS, then REPEAT/CUT from the last section to the first,
    then TRANSPOSE (below) last of all. Verdicts stay in plan order.
  - REPEAT copies the section's bars in every voice right after it, with its
    `% label` comment, never with repeat signs; CUT removes both. A
    repeated section ends un-tied (original and copy) and so does the
    section before a cut; a meter or key the section changes is restated
    after the seam. Code writes all of it; checks then allow exactly that
    bar-count change and nothing else.
  - Lyrics follow by one rule: the k-th section of a kind sings the k-th
    block of that kind. REPEAT copies that block after it, CUT removes it;
    a section with no block, or a block with no section (an extra second
    `[Chorus]`, a `[Pre-Chorus]`), is left alone. Then every matched
    block's tag is rewritten from its section, as instrumentals write tags
    (`% pre-chorus` → `[Pre-Chorus]`, so `[Verse 1]` becomes `[Verse]`).
    The verdict's `note` says what happened: `lyric block 3 [Chorus] is
    repeated with it; block 5 [Chorus] matches no chorus in the score and
    stays as it is`, or `no lyric block is tagged for this outro, so none
    is cut`.
  - REWRITE_LYRICS's verdict carries `diff: {block, tag, occurrence, old,
    new}`; tags are not rewritten unless a section op also applied.
  - `verdicts[i].reason` (op not applied): `section 9 does not exist
    (sections: 1 intro, 2 verse, 3 chorus, 4 outro)`; `section 2 is verse,
    not chorus; chorus is section 3` (or `there is no bridge section (...)`);
    `section 2 has no bars`; `section 1 has no '% label' comment; only
    labelled sections can be repeated or cut`; `section 3 is already cut
    by op 1; a plan either repeats a section or cuts it` (or `already
    repeated`); `cutting section 4 would leave no music; keep at least one
    section`; `the request has no lyrics; REPEAT moves them with the score,
    so send them ("" for none)`; and for REWRITE_LYRICS: `the request has
    no lyrics to rewrite`, `the lyrics have no blocks`, `lyric block 9 does
    not exist (blocks 1-7)`, `block 3 is [Chorus] occurrence 1, not chorus
    2; chorus 2 is block 5` (or `there is no bridge 2`), `block 1 [Intro:
    Piano] has no lyric lines to rewrite (a tag only)`, `block 5 [Chorus]
    has 4 lines; 3 given. Keep the line count so the melody still fits`,
    `line 2 contains the tag [Chorus]; write lyric text only, code writes
    the tags`, `line 1 is empty or has a line break; give one lyric line
    per entry`, `block 5 is already rewritten by op 1`.
  - `checks.problems` (applied, plan not ok): `the first note of bar 3
    changes pitch once the tie into it is cut; the section before it ends
    on a tied note spelled by the tie`, and, as guards that should never
    fire, `the sections are ...; expected ...`, `the score has N bars; the
    section ops should leave M (from K)`, `bar N does not match the bar it
    comes from`. Fixtures: `tests/data/contract/apply-repeat*.json`,
    `apply-cut*.json`, `apply-rewrite-lyrics*.json`.
- `POST /v1/scores/apply` also takes `TRANSPOSE` (F-029): `{op: "TRANSPOSE",
  semitones: -11..11}` (an integer; negative is down). Every note of both
  voices moves by exactly `semitones`, every `K:` line (header, group,
  inline `[K:]`) names the moved key (one of upstream's 30 names, the one
  with fewer accidentals: `F#` over `Gb`, `Db` over `C#`), and chord roots
  and slash basses follow (`"Gm/Bb"` down a tone is `"Fm/Ab"`). Notes are
  respelled in the new key with the fewest accidental marks; rhythm, bars,
  ties and section comments are untouched. TRANSPOSE runs last, after every
  other op of the plan (the section ops and REWRITE_LYRICS included)
  whatever its place in `ops`, so those are written in the old key, the one
  `/v1/scores/read`'s bar map shows; it never touches the lyrics. If the style names a key
  (`F minor`, `Bb major`: a capital letter, optional `#`/`b`, then `major`
  or `minor`), each such name becomes the score's new key (`C minor`), the
  way SET_TEMPO keeps the style's bpm with `Q:`; a style without one is left
  alone. Bounds and refusals:
  - `|semitones| >= 12` or a non-integer is a 422 (schema bound), so a
    shift never leaves the 30-name key table.
  - `verdicts[i].reason` (op not applied): `semitones is 0, which changes
    nothing; give -11..-1 (down) or 1..11 (up)`; `only one TRANSPOSE per
    plan; give the whole shift in one op (-11..11)` (every TRANSPOSE after
    the first); `a note would move to MIDI pitch -1, outside 0-127;
    transpose the other way`.
  - `checks`: compare runs against the score the other ops left, moved by
    `semitones`
    (pitches, chords by pitch class, and `K:` names), so a wrong pitch is a
    `differences` line and a wrong key `TRANSPOSE -2: the K: lines name Dm,
    expected Cm`. Fixtures: `tests/data/contract/apply-transpose*.json`
    (`apply-transpose-sections` with REPEAT and REWRITE_LYRICS).
- `GET /health/ready` — 200 `{"status": "ready"}`, else 503 with
  `"loading"` or `"failed"`. `GET /health/live` — 200 `{"status": "alive"}`.

HTTP errors use FastAPI's `{"detail": ...}` body (a string, or a list for 422).

Job record:

```json
{
  "id": "…32 hex…", "kind": "song", "idempotency_key": "<mulakai job id>", "admission_id": null,
  "request_id": null, "seed": 20260930,
  "status": "running", "stage": "synthesis", "progress": 0.41,
  "tokens": {"abc": 1673, "semantic": 4442},
  "created_at": 0.0, "updated_at": 0.0, "started_at": 0.0, "finished_at": null,
  "cancel_requested": false, "result": null, "error": null
}
```

- `status`: `queued | running | succeeded | truncated | failed | cancelled`.
  `truncated` means the score or the semantic tokens hit their generation
  limit; the audio is kept and downloadable.
- `stage`: `queued → planning → semantic → synthesis → decode → saving →
  finished` (the same names as `yue2-serve`).
- `progress`: the fraction of the **current stage**, when its total is known:
  ODE steps in `synthesis`, VAE chunks in `decode`. `null` in `planning` and
  `semantic`, which have no known length (the token limit is a cap, not a
  target); watch `tokens` there instead. Most of `decode` is the pipeline
  moving the model to system RAM (~1–5 s) before the chunks start, so its
  fraction jumps late.
- `result` (on success): `audio_url`, `score_url` (or null), `audio_seconds`,
  `sample_rate`, `truncated: {abc, semantic}`, `timing` (seconds per stage).
- `error` (on failure): `{code, message}` with code `invalid_generation`
  (the request could not be generated), `out_of_memory`, or
  `inference_failed`. Details are in the server log.

Jobs live in memory: restarting the server forgets them and deletes their
leftover files.

### Instrumentals

YuE2 has no instrumental flag. Empty `lyrics` are accepted, but the score
planner still writes a vocal melody for them, so expect wordless singing.

For an instrumental, send **only section tags** as lyrics (`[Intro]`,
`[Verse]`, `[Chorus]`, `[Outro]`, one per line) and a `cot` other than
`off`. With an `abc` (an instrumental cover), the supplied score is
converted instead of a planned one. Start `style` with "Instrumental" and end it with "no vocals, no
singing, no choir, no spoken words". The server then runs upstream's
instrumental workflow (`skills/yue2-music/instrumental` in the YuE repo):

1. YuE2 plans a score as usual.
2. Every `Vocal` note moves to the `Ins` voice (`upstream/instrumentalize.py`,
   vendored unmodified). Chords, meter, key, tempo and sections stay.
3. The song is generated from that score, with its own section tags as
   lyrics: `cot` is `full` if the score has chords, else `melody`.

`score.abc` is the converted score and `planned.abc` the one YuE2 planned.
`result.json` gains `instrumental` (`vocal_notes_moved`, `ins_notes_trimmed`)
and its `request` is the final one, with the converted score. If the plan
can't be converted (truncated, outside the native dialect, or over 4096 ABC
tokens), the job uses the unconverted plan and `instrumental.reason` says
why. A `yue2-serve` backend has no such step: it plans once.

## Tests

The tests use a fake pipeline and need no GPU, torch or yue2:

```bash
pip install -r requirements-test.txt
python -m pytest
```

## License

The wrapper is part of Mulakai. `yue2-infer` code is Apache-2.0. **The YuE2
weights are CC BY-NC 4.0 plus a creator permission**: individuals may use them
and monetize the outputs; companies need a license from the authors. Check
the current terms in the upstream `MODEL_LICENSE` before any commercial use.
SheetSage2's weights are CC BY-NC 4.0 as well. Its renderer's FluidR3 piano
samples are CC BY 3.0 US. Whether you may cover a given song is up to you, as
with ACE-Step's COVER.
