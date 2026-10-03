# 0003 · WRITE PHRASE takes notes with beats; code writes the ABC

Date: 2026-10-03 · Status: accepted (ships in M1) · Source: D-005, D-017,
D-018, SP-2 (`pipeline/spikes/SP-2-planner-quality/RESULT.md`)

## Context

WRITE PHRASE asks the planner for new melody bars (e.g. a 4-bar sax
phrase). Each bar must sum to the meter exactly, or YuE2's score is
invalid. REHARMONIZE has the same risk on a smaller scale (chord names).

## Decision

- WRITE PHRASE's schema is a phrase of `{pitch, beats}` notes; code turns
  it into ABC and owns units, ties and bar sums.
- REHARMONIZE takes a chord as `root` + `quality` enums, never a free
  chord string.

## Evidence (SP-2, 2026-10-03, real library scores, upstream validator)

| Shape | qwen3:14b valid in ≤ 3 tries | gemma4 26B-A4B |
|---|---|---|
| free ABC bar strings | 8/18 = 44% | 16/18 = 89% (Wilson low 67%) |
| `{pitch, beats}` notes | 18/18 = 100% | 17/18 = 94% |

## Alternatives

- Free ABC bar strings: fails D-013's 70% line on the default model.
- A GBNF grammar: not tried; the transport takes a JSON schema
  (docs/decisions/0001), and the beat arithmetic would still sit in the
  model.

## Consequences

- The model does the music and code does the arithmetic.
- Valid is not musical: the phrases that pass are plain. The user's listen
  is owed; if they are not musical, WRITE PHRASE ships labelled
  EXPERIMENTAL.
