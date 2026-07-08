# Mulakai — UX & Visual Polish Notes

> 2026-07-08. Companion to `AUDIT.md` (bugs) and `design/DESIGN.md` (the locked
> design system). This is workflow thinking + a changelog of the polish pass.

## The core loop today

`Library (browse) → Create (generate) → Editor (repaint / add layer / split /
versions) → Library`, plus Settings and the AI-shimmer working states. The
interaction spine is **target (sky) → commit (acid) → new version (lilac)**,
never destructive. That spine is sound; most opportunities are about *legibility
and feedback*, not restructuring.

## Workflow observations → improvements

1. **Library cards are text-first, not music-first.** A card shows play · title ·
   2-line caption · EDIT/♥/✕. It doesn't show the things you actually browse by:
   duration, how many versions/layers exist, or *what it sounds like*. DESIGN.md
   already envisions `title · lilac version badge · mini waveform · duration`.
   → Add duration + a lilac version/layer count badge + a mini-waveform thumbnail.
   Turns a text list into a scannable musical shelf. *(Caption hierarchy fixed
   this pass; the richer card is the bigger follow-up.)*

2. **The Editor's target→commit loop is elegant but under-taught.** It is
   deliberately "a dense wall of tooling"; a first-timer may not know to drag-select
   a region then type in the prompt bar. → A one-time coachmark on the focused
   waveform ("drag to select a section to repaint") and a louder empty-scope chip
   ("WHOLE SONG") would raise discoverability without adding chrome permanently.

3. **Blocked-while-generating is communicated as a disabled state.** The single-
   flight `genLock` is correct, but a disabled REPAINT with no reason reads as
   "broken." → Inline "a generation is running — see the library card" on the
   disabled control (the Header abort pill already helps).

4. **Commit moments are visually quiet.** GENERATE / REPAINT fire with no
   punctuation. DESIGN.md#Motion explicitly wants "a brief acid glow/scale flash at
   the moment of commit." → Small JS-triggered flash on submit; the hover bloom
   added this pass is the resting half of that story.

5. **Selection/playback continuity.** DESIGN.md specifies the section-strip's sky
   fill *sliding* between segments, the selection wash *expanding from the drag
   point*, and the playhead using a linear CSS transition so playback reads as
   continuous. → Verify which are live; the playhead transition especially sells
   "this is really playing."

6. **Version rail arrival.** DESIGN.md wants new version cards to slide in with a
   brief lilac glow ("the AI made this" should read as an event). `.version-enter`
   keyframe exists — confirm it fires on every new version, not just first mount.

## Visual polish applied this pass (`index.css`)

All transform-free (colour / border / box-shadow / filter / outline) so nothing
disturbs a skewed CTA or framer-motion's transform on GENERATE/REPAINT. 150ms
easeOut via shared `--ease`/`--dur`; honours `prefers-reduced-motion`.

- **Bug fix:** `.meta` used undefined `var(--text-high)` → fell back to full-white,
  so captions fought titles. Now `text-mid`, 12px. Title bumped to 14px. Clear
  hierarchy (verified: caption `rgb(154,154,163)`, title 14px).
- **Hover:** plain buttons brighten hairline+text; acid CTAs bloom acid; Library
  cards lift on a low shadow; contextual glyphs preview meaning (play → acid,
  trash → rust, empty heart → acid); inactive filter chips fill faintly.
- **Press:** uniform `filter: brightness(0.9)` dip — safe on skewed + framer buttons.
- **Focus (keyboard-first):** 1px **sky** ring on every control; sky border on a
  focused text field. Focus was previously invisible on inputs.
- Removed a leftover `console.log('DEBUG openEditor')` in `App.tsx`.
- Documented the convention in `DESIGN.md#Motion → Interactive feedback`.

## Proposed next passes (not yet done)

- Richer Library card (duration · lilac version badge · mini waveform).
- Commit flash on GENERATE / REPAINT (the DESIGN.md-specified acid glow/scale).
- Audit + finish the specified motion: section-strip slide, selection-wash
  expand-from-drag, playhead linear transition, version-rail lilac arrival.
- Editor first-run coachmarks for the target→commit loop.
