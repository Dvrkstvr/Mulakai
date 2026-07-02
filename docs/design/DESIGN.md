# Mulakai — Design System

Single source of truth for the UI. Every screen and component builds against
this document. Desktop-only: fixed dense layout, no responsive/mobile mode,
keyboard-first.

## Design language in one sentence

Simplistic and bold: sharp geometry (parallelograms and hexagons, zero border
radius), slim 1px lines, heavy uppercase labels, near-black carbon canvas,
five colors with one semantic job each.

---

## Color tokens

Each hue answers exactly one question. Never overload a hue with a second
meaning — if a sixth concept appears, add a color instead.

### Carbon — "the world" (structure)

| Token             | Hex       | Use |
|-------------------|-----------|-----|
| `carbon-canvas`   | `#1C1D21` | App background |
| `carbon-panel`    | `#202127` | Lifted panels (rails, cards, input surfaces) |
| `carbon-raised`   | `#26272D` | Second lift (inactive section-strip segments, chips) |
| `carbon-line`     | `#33343B` | Default 1px hairline |
| `carbon-line-hi`  | `#4E4F58` | Emphasized border (interactive outlines) |
| `wave-idle`       | `#55565F` | Unselected waveform bars |
| `text-hi`         | `#ECECEC` | Primary text |
| `text-mid`        | `#9A9AA3` | Secondary text |
| `text-low`        | `#6E6E78` | Muted/disabled text, idle icons |
| `text-ghost`      | `#55555C` | Faintest hints |

### Acid — "what makes something happen?" (commit actions)

| Token         | Hex       | Use |
|---------------|-----------|-----|
| `acid`        | `#D4FF00` | Play/send hexagons, generate/repaint buttons, active toolbar tab, primary CTA fills and outlines |
| `on-acid`     | `#1C1D21` | Text/icons on acid fills |

Rules: acid is *only* for actions that start or commit something. Never for
state, selection, decoration, or status. At most one filled acid CTA per
view region; sibling actions in the same group use acid outline + acid text.

### Sky — "what am I pointing at?" (selection / scope)

| Token        | Hex       | Use |
|--------------|-----------|-----|
| `sky`        | `#30BCED` | Selected waveform bars + selection edge lines, active section segment, scope chip fill, playhead |
| `on-sky`     | `#0C2530` | Text on sky fills |
| `sky-tint`   | `#153543` | Selection region background wash on waveforms |

Rule: selection must read as one continuous color everywhere it is echoed —
waveform region, section strip, scope chip in the prompt bar.

### Lilac — "what did the AI make before?" (versions / history / AI markers)

| Token         | Hex       | Use |
|---------------|-----------|-----|
| `lilac`       | `#7B4B94` | Borders/fills for version rail current item, A/B + Fork buttons, version badges |
| `lilac-text`  | `#A97FC1` | Lilac-meaning text on carbon (the raw hue is too dark for text) |
| `lilac-tint`  | `#2A2133` | Background wash for current-version row, badge fills |

### Rust — "what's wrong?" (errors / warnings / trash / destructive)

| Token        | Hex       | Use |
|--------------|-----------|-----|
| `rust`       | `#CC3F0C` | Borders of warning banners/toasts, trash section border, destructive confirm buttons |
| `rust-text`  | `#E8703F` | Headline text/icons in rust contexts |
| `rust-body`  | `#C9906F` | Body text in rust contexts |
| `rust-tint`  | `#2A1712` | Warning/toast background |
| `rust-tint-2`| `#241512` | Trash section background |

---

## Shape grammar

- **Border radius: 0 everywhere.** No exceptions.
- **Hairlines**: 1px solid, `carbon-line` default, `carbon-line-hi` for
  interactive outlines, semantic color for semantic containers.
- **Parallelogram** (skew −10°): the shape of *choices* — buttons, tabs,
  chips, badges, scope chips. Two recipes:
  - Transform: `transform: skewX(-10deg)` on the box with inner
    `transform: skewX(10deg)` counter-skew on the label.
  - Clip-path (when transform would misalign layout, e.g. section strip,
    tag chips): `clip-path: polygon(Npx 0, 100% 0, calc(100% - Npx) 100%, 0 100%)`
    with N ≈ 4–14px scaled to element height.
- **Hexagon**: the shape of *transport/commit* — play buttons and the
  prompt-send button only. Always acid-filled.
  `clip-path: polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%)`
- **Diamond**: slider thumbs.
  `clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%)` on a 10px square,
  riding a 2px track (`carbon-line-hi` track, semantic color for filled part).
- **Section strip**: horizontal row of clip-path parallelograms, 3px gaps,
  flex-weighted by section length; active section = sky fill.
- **Waveform**: sharp vertical bars (no rounded caps), `wave-idle` at rest,
  `sky` inside a selection over a `sky-tint` wash, 0.4px sky edge lines at
  selection boundaries.

## Typography

- **Two voices only**:
  - *Structure* (labels, buttons, headings, badges): 700 weight, UPPERCASE,
    letter-spacing 1–3px (wider as size grows). Sizes: 10px micro-labels,
    11px controls, 16–17px titles, 20px page headings.
  - *Content* (song titles in lists get 700 but sentence case; body,
    metadata, prompts, lyrics): 400 weight, sentence case, 11–13px.
- Lyrics/structure tags render in monospace.
- Minimum font size 10px (dense desktop UI); prefer 11px+.

## App model — three screens, one page

Single-page app with exactly three top-level states. No nested pages, no
stacked modals.

1. **Library** (home) — search bar, favorites card row pinned top, flat song
   list (title · lilac version badge · mini waveform · duration · heart ·
   dislike), rust trash strip docked at the bottom (count + 7-day expiry
   note). Global error toasts (rust) appear in the header row.
2. **Create** — focused takeover with a **left settings panel** (see below)
   beside the create form: title, description field, style tag chips
   (acid-outlined parallelograms), lyrics editor (mono) with instrumental
   toggle, one acid GENERATE bar.
3. **Editor** (the heart) — layout:
   - Header (full width): back-to-library, bold title, time/bpm/key metadata,
     EXPORT (neutral parallelogram).
   - Left settings panel (~210px, see below): repaint parameters. Permanent.
   - Version history (lilac) with REVERT on inactive versions; branches
     A/B + Fork are future work.
   - Canvas: large composite waveform, drag-select regions (sky), playhead.
   - Section strip: parallelogram segments (Intro/Verse/…), click = select
     that section; active = sky. (future work)
   - Layer lanes: one thin waveform lane per layer, right-aligned uppercase
     name, volume + solo icons; muted lane's icon in rust-text. (future work)
   - Prompt bar: sky scope chip mirroring current selection, free-text
     instruction, acid REPAINT REGION action.

### Left settings panel (Create + Editor)

A **persistent left panel** (~210px, carbon-panel surface, 1px border) holds
generation/repaint parameters — it does NOT slide in per-action. This
replaces the earlier right side-sheet concept so power controls are always
visible without a selection.

- **Generate mode**: MODEL select (hidden if the backend lists none),
  THINKING MODE + AI ENHANCE toggles, STEPS + GUIDANCE sliders, RANDOM SEED
  toggle with a seed field when off.
- **Repaint mode**: MODE segmented control (conservative/balanced/aggressive),
  VARIANCE + STEPS + GUIDANCE sliders, RANDOM SEED toggle + seed field.
- Controls: acid-accented range sliders, acid-when-on toggles (parallelogram
  knob), acid-filled active segment in the segmented control. Slider readouts
  in acid. Settings persist across sessions (localStorage).

### Interaction rhythm

The whole app is a two-step loop: **target** (sky) → **commit** (acid).
Select where, then say what. Every commit produces a new version (lilac) and
never destroys the old one.

- Quick path: select region → type in prompt bar → REPAINT REGION.
- Control path: adjust the always-visible left settings panel (mode, variance,
  steps, guidance, seed) before committing — no per-action sheet.
- Empty selection = whole song scope.
- Actions always state the version they will create before commit.

## Copy rules

- Buttons/labels: uppercase, 1–3 words, verb-first for actions.
- Every destructive or generative action states its consequence inline
  ("result will be saved as vocals v3", "deleted after 7 days").
- Errors: what happened + what to do, in rust context, never blocking the
  canvas ("'Copper Sky' failed — CUDA out of memory · RETRY").

## Reference mockups

The approved mockups live in the design-review conversation (2026-07-02):
library, editor default, editor with repaint sheet, create screen, plus the
recolored editor/library establishing the five-color semantics. Recreate any
of them from this document — it is deliberately sufficient to do so.
