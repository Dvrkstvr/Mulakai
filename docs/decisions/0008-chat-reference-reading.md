# 0008 · A reference song is read by one queued job and kept as a copy with the thread

Date: 2026-10-07 · Status: accepted (assumed by the architect, D-126, D-127) · Source: D-084, D-102, F-061, F-062

## Context

C3 (reference songs) needs words, a score with sections, and caption/tempo/key from a dropped file or a library song,
then a cover or a new song built on them. Three local services already do each part for Guided Create's COVER, each as
its own queued job: `transcribe` (yue-server SheetSage2), `lyrics` (lyrics-server), `analyze` (ACE-Step ANALYZE AUDIO).
The 16 GB card holds one model at a time; the chat planner unloads before every other job (D-011). The reference must stay
with the song as its source (D-084) and go when the song is permanently deleted (D-102), but a draft thread has no song.

## Decision

- **One job, one slot.** READ queues one `transcribe`-kind job (label `chat reading`) that runs a pure reading plan
  (WORDS > SCORE > CAPTION) inside its slot and writes one versioned `Reading` (`reading_v: 1`). A source that already
  knows a part skips the service: a YuE2 library song reads its own score and words with no GPU. A part that fails is
  recorded as `not read: <why>`. The job starts only with no planner model loaded (`chat/gpuGuard.ts`).
- **A copy per thread.** `chat_references` rows hang off the chat thread (FK cascade) with a copy of the audio in
  `audioDir/references/`; library picks are copied too, with a snapshot of the song's own score, words and caption. The
  thread becomes the song's thread at CREATE, so the reference goes with the song without a second link.

## Alternatives

- **Chain the three existing jobs.** No new job body, but three queue entries and three job ids for one card, other jobs
  can slip in between, and a cancel has to chase three jobs.
- **A new `reading` queue kind.** Clearer in Activity, but a two-union change (`genQueue.ts` is 190 of 200 lines, and the
  client's kind union); `transcribe` already names the GPU-heavy step and is what Activity shows today.
- **Keep only a link to the library song.** Deleting or editing that song would change or lose the reference; uploads
  need storage anyway.
- **Store references on the song.** A draft thread has no song yet; the thread already cascades from the song.

## Consequences

- C1's analyze-after-every-save job (F-052) reuses `Reading`, `readingPlan` and `readingSteps` for versions instead of
  writing a second reader.
- Files are removed by an orphan sweep (start, trash sweep, NEW CHAT), not by a per-delete hook.
- Whether a reading leaves ACE-Step's or lyrics-server's models on the GPU before the next turn is measured in CP-C3
  (R-028); the caption step is the first thing to drop if it does.
