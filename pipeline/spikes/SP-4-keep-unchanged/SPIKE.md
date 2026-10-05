# SP-4 · Keep the unchanged parts of a song through an edit (R-024)

Planned 2026-10-05, not run. Throwaway code goes in this folder; the result goes in `RESULT.md` beside this file.
Why now: D-079 makes the chat the default way to create and edit songs. A chat only converges if each turn changes
what was asked and keeps the rest. Today every SCORE apply re-renders the whole song on YuE2, and the rest moves:
the M2 listen heard the untouched part of a song turn "more energetic" after a lyric rewrite, and a repeat seam was
audible (D-077, Q-053).

## Question

Can an edit to one part of a song leave every other bar sounding the same as before, with the edited part as good as a
full re-render and the joins not audible? Which way of doing it is good enough to build the chat on?

## What we already know (research 2026-10-05, evidence in brackets)

- **YuE2 cannot do it natively.** One AR stream of codec tokens for the whole song (max 9,000, 25 Hz), then a
  non-causal flow-matching decoder over the whole chunk with noise drawn once for the full length
  (yue2 `pipeline.py:255-304`, `nar.py:45-46,143-164`). Upstream says so: it "does not expose waveform inpainting or
  guarantee an identical performance outside the edited bars" (`skills/yue2-music/references/editing-workflows.md:3`).
- **Re-render drift is measured.** An unchanged score re-rendered with the same seed keeps melody F1 0.92-0.98; outside
  an edit 2-10% of notes move (SP-3 `RESULT.md`). The same request and seed reproduce byte-identical output, so a base
  song's tokens can be rebuilt with one re-render (SP-3).
- **YuE2 keeps time.** Bar tempo within 0.1% of `Q:`, audio a constant ~1.3% shorter than bars x meter / Q, bar count
  sometimes off by one (pickup). Bar boundaries in seconds need an anchor: SheetSage2 downbeats with an integer offset
  fitted on unchanged bars (SP-3 `analyze.py`, `verify/M2/m2_analyze.py:63`), not `Q:` arithmetic alone.
- **ACE-Step repaint keeps the rest sample-exact.** Outside [start, end] the original waveform is spliced back after
  decode, with a latent crossfade (13 frames) and a 0.025 s waveform crossfade in the default `balanced` mode
  (ACE-Step `generate_music.py:26-48,443-456`). Mulakai already calls it (`repaintJobs.ts`), including repaint with
  edited lyrics on the base layer (`repaintVersion.ts:57-59`). It does not read ABC, so it cannot follow a chord or
  phrase edit.
- **Nothing is kept from a render today** beyond `audio.flac`, `score.abc`, `planned.abc`, `result.json`
  (yue-server `worker.py:128-152`); upstream's `save_artifacts` (semantic tokens, latents) is unused.
- **Building blocks in Mulakai:** stems (demucs-server, uvr-server), word timestamps (lyrics-server), bar ranges per
  section (`score_facts.py`), ffmpeg (transcode only; no splice or crossfade code on the server yet).

## Edits split three ways (this decides which approach can apply)

| Kind | Ops | What "keep the rest" can mean |
|---|---|---|
| Local | REHARMONIZE, WRITE PHRASE, REWRITE LYRICS, EDIT STYLE on a section | the audio outside the edited bars stays identical |
| Structural | REPEAT, CUT | the base audio is rearranged; no new music is needed at all |
| Global | SET TEMPO, TRANSPOSE, whole-song style | every bar changes by definition; the goal is "same performance, moved" (out of scope here, see below) |

## Candidates, in the order the spike runs them

**A · Bar-aligned splice.** Render the edited score on YuE2 as today; keep the base audio outside the edited bar span,
take the new render inside it, crossfade at the span's first and last downbeat. Known: time holds, alignment code
exists. Unknown: whether the new take's mix, loudness and mood drift make the joins audible.

**B · Splice, then heal the seams with ACE-Step repaint.** Take A's result and repaint a window of about 1 bar centred on
each seam (`balanced`, then `conservative`), with the spliced audio as source. Known: repaint leaves everything outside
the window untouched, and it is already wired. Unknown: whether it blends two takes with different timbre without
smearing harmony or words.

**C · Structure edits on audio only.** REPEAT copies the base audio of the section's bars after itself; CUT removes them;
seams healed as in B. No YuE2 render. Known: tempo is constant, so bars line up. Unknown: whether lyrics and phrasing
across the copied seam sound right (a chorus ending into a second chorus start), and whether section-boundary pickups
cut cleanly.

**D · YuE2 forced-prefix continuation (stretch, only if A/B fail on local edits).** Save the base's semantic tokens
(one re-render with the same seed), then call `generate_tokens` with prefix = text + edited ABC + MUSIC_START + base
tokens up to the first edited bar, so YuE2 continues the same performance into the edit; splice the base back after the
edit with A/B. Known: the API accepts any prefix and generation is deterministic. Unknowns: whether the LM follows the
edited ABC after a prefix produced under the old ABC, and the decoder's whole-chunk attention shifting the prefix's
audio anyway. Throwaway WSL script against the installed `yue2` package; never in yue-server for the spike.

Not in the spike: ACE-Step repaint alone as the editor of the span (no score control, lower benchmark quality; it stays
the scalpel), stem-level splicing (separation bleed; revisit only if A-C fail on vocals), training or LoRA on either
engine (D-079).

## Protocol

- **Songs:** the M2 listen songs (Gertar, Romantica, Cariñito) plus one 3/4 or 2/4 song, as library copies on E:
  (`E:\ai\tmp\sp4`). Base = the active version's audio and score.
- **Edits per song:** REHARMONIZE one chorus (8 bars), WRITE PHRASE 4 bars, REWRITE LYRICS one chorus (local, A and B);
  REPEAT the first chorus and CUT one verse (structural, C, compared with M2's full re-renders of the same edits).
- **Variants per edit:** full re-render (today, the control) · A with a 1-beat crossfade · A with a 1-bar crossfade ·
  B balanced · B conservative · C where it applies · D for the REHARMONIZE edit on 2 songs if time allows.
- **Measures (machine):**
  - Unchanged region: null test against the base (sample-exact for A/B/C by construction, measured to prove the
    plumbing); melody F1 and chord roots vs the base for the control.
  - Edited span: melody F1 / chord roots / `Ins` notes / Whisper words vs the edited score, against the full re-render
    (the span must keep at least the control's adherence minus 5 points).
  - Seams: downbeat alignment error (ms), short-term LUFS step and spectral-centroid step across each join.
  - Cost: extra seconds per edit vs a full render.
- **Measures (ear, owed to the user):** a listen page like `verify/M2/listen` (bar timeline, edited bars shaded, jump to
  each seam, same-position A/B switch), blind per pair: "where is the join?" (none / bar n), "the rest sounds like the
  original?" and "the edit came through?".

## Pass bar

An approach passes for a kind of edit when, on at least 3 of 4 songs: the unchanged region is identical to the base
(null test), the edited span keeps the control's adherence within 5 points, downbeat error is at most 20 ms and the
LUFS step at most 1 dB at every seam, and in the user's listen the join is not found (or found only at a guess) in at
least 4 of 5 pairs.

## What the result decides

- A or B passes for local edits → the chat applies local edits as "render, then splice" (B if the raw splice is heard),
  and the version label says which bars changed; a dated PLAN.md section for the splice path and for the chat (Q-054).
- C passes → REPEAT / CUT stop re-rendering at all: instant, no GPU for structure edits.
- Only D works → a deeper YuE2 integration (keeping semantic tokens per version), its own risk and decision record;
  it touches the pinned upstream package's private paths.
- Nothing passes → the chat still works but says every turn re-renders the whole song, and offers "keep the old take
  for these bars" as an explicit splice the user listens to; the global-edit question stays open.

## Out of scope, noted for later

Global edits (tempo, key) that keep "the same performance": no engine here does it; pitch-shift and time-stretch DSP on
the base audio is the obvious thing to try in a later spike (key: formant-preserving shift; tempo: phase-vocoder
stretch), judged by ear.

## Cost

About 2 days on the machine: day 1 splice tooling + A/C on 4 songs; day 2 B (ACE-Step loaded only after YuE2 and the
planner are unloaded, one at a time on the 16 GB card) + D on 2 songs if A/B fall short + the listen page. Owed after:
one user listen (about 20 pairs).
