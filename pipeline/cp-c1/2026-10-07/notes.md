# CP-C1 notes (2026-10-07)

Code: branch `test/chat-cp1` = `origin/feat/chat-cl5-mark` a27c4b5 (CL-4 + CL-5 + main) + the CP-C1 script. Everything *seen running* unless marked.

## Stack (all mine, all stopped afterwards; the owner's :3001 / :5173 / :8001 / :8005 / :11434 untouched)

- Mulakai server :3221 (`tsx src/index.ts` from this worktree), `DATA_DIR` = a copy of the owner's `server/data` (db via SQLite backup, 4.5 GB) under `E:\ai\tmp\cp-c1`, `ACESTEP_API_URL` a dead port (:8299).
- Ollama 0.32.15 :11535 (`OLLAMA_MODELS=E:\ai\ollama\models`, `OLLAMA_CONTEXT_LENGTH=16384`, qwen3:14b), the script's recording proxy :11536 (`LLM_API_URL`).
- yue-server :8224 in WSL Ubuntu-24.04 from this worktree's `yue-server/` with SheetSage2, `YUE_DATA_DIR=~/yue-data-cp1` (917 MB, deleted).
- lyrics-server :8235 from this worktree's `lyrics-server/` with the main checkout's venv and `LYRICS_MODEL_DIR` (large-v3, cuda float16).
- After: ports 3221 / 8224 / 8235 / 11535 / 11536 not listening, VRAM 1559 MiB, `E:\ai\tmp\cp-c1` deleted.

## Runs

1. `chatCp1.ts --yue2 Cariñito,Gertar,Acid Houzzzz --trans Ellies City 2,purple trails,Unmoving` (17:13-17:26 UTC).
2. `chatCp1.ts --merge --marks "Gertar:one@5/4,cross@4/2"` (17:27-17:28): Acid Houzzzz's strip stayed hatched, so its two marks
   could not be built and were sent without one (recorded as `no-mark`); two more marks on Gertar make 10 real marked turns
   (5 one-section, 3 across two sections, 2 seconds only). Run 2 overwrote `nvidia-smi.csv` (bug fixed in the script since;
   the file left is run 2's, renamed `nvidia-smi.run2.csv`). Run 1's VRAM numbers survive in results.json (`mibPeak`,
   `mibEnd`, `vramBeforeMiB`); Ollama `/api/ps` samples of both runs are in `ollamaPs`.
- Before run 1 I opened two songs outside the set to learn the wire shapes (warm-up, not in the evidence): Purple Shinings
  (YuE2, 177 s) analysis about 35 s; eventide (ACE-Step, 147 s) about 80 s (WORDS about 65 s) with bars "unreadable reply".

## Findings

1. **Seconds-only marks are not bounded (2 of 2 planned outside the mark: the STOP).** Seen in code: `markBlock.ts:61`
   sends bars only when the mark carries them (D-179), and its MARK lines say "the bars of this version were not read" even
   when the version's bar times *are* read; the schema then has no `barRange`. Seen running: Cariñito 1:59-2:18 (bars 48-55)
   -> REHARMONIZE 25-30; Gertar 1:59-2:24 (bars 44-52) -> REHARMONIZE 15-22: the planner fell back to "the first chorus".
   All 8 marks with bars stayed inside (8 of 8, 6 edit cards, 2 failed plans with no card). Smallest fix (inferred): in
   `markAt`/`markBlock`, when the playable version has bar times, snap a seconds-only mark to the bars it covers and
   bound the plan like a bar mark; with no bar times, name the sections nearest the seconds from the score's own section
   timing, or refuse an edit plan for a time-only mark.
2. **yue-server `/v1/scores/bars` can answer starts the TS client rejects** -> `bars: "YUE2 bar times -> unreadable reply"`,
   strip hatched, no bars to mark, every turn on that song is unmarked. Seen on Acid Houzzzz (YuE2, 79 s; v1, v2 and v3) and
   eventide (ACE-Step). Reproduced on eventide: `offset: -1`, `starts` 80 values with duplicates (bar 1 and 2 both 1.85 s,
   bars 43-80 all 147.0 = the end: the score has more bars than the audio). `yueScoreBars.ts` requires strictly increasing
   starts, so the whole reply is dropped. Cause on Acid Houzzzz inferred to be the same (not reproduced).
3. **Per-section line counts are 0** on every strip section (YuE2 and transcribed) while the reading's total `lines` is
   35 / 12; seen in the analysis view. F-053 / CL-8a will show "0 lines" per section unless fixed.
4. **Q-070, section names on transcribed songs:** real names, not PART n. Ellies City 2: intro, verse, chorus, verse,
   chorus, outro (44 bars, seconds read). purple trails: intro, verse, chorus, verse, chorus, outro (72 bars). Unmoving:
   intro, verse, chorus, verse, chorus, interlude, outro (62 bars). But a turn asking "which sections does this song have"
   answered all three with the same invented list (Intro, Verse, Pre-Chorus, Chorus, Bridge, Outro at bars 1/13/25/37...),
   not the reading's sections: the transcribed reading does not reach the planner's song state, or is ignored.
5. **Turn latency after an analysis:** p50 11.9 s over 8 turns (the stop-line measure), but that includes 3 short "say"
   turns on transcribed songs (5 s). The 5 YuE2 edit turns after an analysis ran 11.9-29.1 s, p50 20.6 s, driven by planner
   retries (2-3 calls each, "keeps the old root" refusals), not by VRAM: the planner was 10.9 of 10.9 GiB on the GPU in all
   20 turns. R-031 did not happen: lyrics-server frees its model per job (seen in code `lyrics-server/asr.py`; VRAM back
   to 1.8-2.8 GB after every analysis that was not followed by a queued turn).
6. **R-032 queue cost:** an analysis of a spliced YuE2 version runs WORDS only (10-18 s; sections from the cached grid);
   an APPLY pressed during it waited 18.0 s and 15.3 s, never refused (D-188 holds), and started as the analysis ended
   (0.0 s gap). A turn sent at once after a save waited 11.4 s / 16.6 s behind that save's analysis. First analyses of a
   v1 (WORDS + tracking the beat) 28-30 s; transcribed songs (WORDS + SheetSage2) 19-22 s. Slowest 30.3 s.
7. Gertar's first edit turn ("give the first chorus jazz chords") failed after 3 attempts (the same planner refusal C0b saw),
   so Gertar had no APPLY; the APPLY-behind-analysis check ran on Cariñito and Acid Houzzzz (2 of 2 passed).
