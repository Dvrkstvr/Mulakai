# 0009 · A saved version is read by the reference-reading job, and "this" is a referent

Date: 2026-10-07 · Status: accepted (assumed by the architect, D-171..D-175) · Source: D-089, D-090, F-052..F-055

## Context

C1 has to keep words, a score with sections and a bar grid current for every version the chat plays (D-089), so the
section strip, the mark and the turn's song state match what plays; and it has to send a marked part of the song with
a turn without ever sending bars that no longer mean what the person marked (D-090, CS-11). C3 already reads a
reference with one queued job (docs/decisions/0008); C0b already caches a version's downbeat grid for the splice; the
score agent already has a "this" for the dock (`planReferent`: a picked section or lyric line, with stale handling).
APPLY's re-check refused when any non-SCORE job was queued on the song (Q-038 #4), which a reading after every save
would trip every time.

## Decision

- **One job, the reading's.** After a save on a song with a chat thread, one `transcribe`-kind job (label `chat
  analysis`) runs WORDS > SCORE > SECTIONS in one slot, reusing `readingSteps` for words and score; SECTIONS uses the
  cached grid, else the same SheetSage2 run's grid, and yue-server's `POST /v1/scores/bars` (the splice's fit) for bar
  start times. The result is `versions.analysis_json` (`analysis_v: 1`); timings go to `versions.word_timings`, the
  grid to the existing grid sidecar. One pending job per song; it reads the newest playable version when it starts.
- **Never in a commit's way.** `pendingEdit` names only edit kinds, so a reading never stales a plan; FIFO puts a
  commit or a turn behind a running reading.
- **"This" is one concept.** The mark is a `range` referent beside `section` and `line`, resolved by the server at
  SEND and at the turn's start with one bar-movement rule (`barShift`); a stale mark is refused, never remapped.

## Alternatives

- **A new `analyze` queue kind.** Clearer in Activity; a change to two kind unions, and `genQueue.ts` is at its cap.
- **Hooking every version insert (six sites).** Exact, but six owners to touch and keep in step; the settle event
  catches every GPU path in one place, and the thread GET catches imports and old songs.
- **Bar times in TypeScript.** Would read ABC outside yue-server (decisions/0002) and could disagree with the splice.
- **A chat-only mark module.** Two "this" implementations (dock and chat) with two stale rules.

## Consequences

- Every save on a chat song costs 0-60 s of queued GPU time ahead of the next message (R-032), and lyrics-server's
  model may stay on the GPU (R-031); both are measured in CP-C1 with a fallback (WORDS leaves the automatic reading).
- The splice reads the cached grid that the reading wrote instead of tracking at APPLY time.
- C6's Editor-first selection becomes a `range` referent with seconds and no snapping, not a new mechanism.
