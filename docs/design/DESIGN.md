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
waveform region, section strip, scope chip in the prompt bar. The layer
stack's focused row is the same concept applied to "which layer" instead of
"which time range" — it uses sky (left-border accent + `sky-tint`
background), not lilac, because focus is scope/targeting, not a version/
history marker. Create's ENGINE choice is sky for the same reason: picking
an engine targets where the request goes, while GENERATE (acid) commits it.

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
- **Diamond**: scrub/volume thumbs — the shared stack-scrub timeline
  playhead, and the Player/layer-lane volume sliders.
  `clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%)` on a 10px square,
  riding a 2px track (`carbon-line-hi` track, semantic color for filled part).
- **Parallelogram fader** (`Slider.tsx`, used for STEPS/GUIDANCE/VARIANCE in
  the settings panels): not a reskinned native thumb — three plain divs
  (`.pgram-track`/`.pgram-fill`/`.pgram-handle`) layered under a fully
  transparent native `<input type="range">` (kept for real drag/keyboard/
  touch/a11y; the divs are purely decorative). Track and fill are `1px
  dashed`/solid parallelograms sharing `transform: skewX(-10deg)`; the
  handle is a second, wider (~18px) and shorter parallelogram with the same
  skew, notched flush against the fill's edge. All three layers must share
  the same skew angle *and* the same vertical center — skewX's shift is a
  function of distance from an element's own center, so two independently-
  skewed pieces only mesh with no gap if their centers line up (same
  mechanism as the "Connected button groups" recipe below). The fill/handle
  boundary is computed as `calc(pct * (100% - handle-width))`, reserving the
  handle's own width as travel margin so it can never clip past either end
  of the track — a plain `left: pct%` will let a fixed-width handle overflow
  at 0%/100%.
- **Section strip**: horizontal row of clip-path parallelograms, 3px gaps,
  flex-weighted by section length; active section = sky fill.
- **Waveform**: sharp vertical bars (no rounded caps), `wave-idle` at rest,
  `sky` inside a selection over a `sky-tint` wash, 0.4px sky edge lines at
  selection boundaries.

## Audio preview module (added 2026-07-29)

One rule: **if the UI shows an audio file, it is previewable in place.**
Songs, voice clips, uploaded references, stems, versions, remaster results —
all use the same module (`AudioPreview.tsx`), in one of three densities:

- **Inline** (default — any host row with ≥240px free width): 20px acid
  play/pause hexagon + `PlayerWaveform` (h22–30 per surface) + mono
  `m:ss / m:ss` readout. Waveform click = seek (works before metadata via
  fraction-based seek). No volume, no stop.
- **Micro** (rows narrower than the threshold): the 18px hexagon alone;
  clicking opens a fixed 240px anchored popover (name · waveform h30 · time
  · ✕) and starts playback immediately. ✕ or outside click closes it and
  stops playback. One popover open at a time. (Lands with its first
  consumer — Create's voice picker.)
- **Full**: the Library footer `Player` (adds volume + DOWNLOAD) — the
  parent form the smaller sizes derive from, not a special case.

Color contract: play is always an **acid** hexagon (commit: "start sound");
playhead/played-position is always **sky**; idle bars `wave-idle`. A version
row keeps its lilac identity — only the play control is acid.

Exclusivity: all previews share one playback slot (`previewPlayback.ts`) —
starting any preview stops the previous one and pauses the main transport
(footer/editor engine); starting the main transport stops the preview and
closes any popover. Previews are auditions, not a second mixer.

## Typography

- **Two voices only**:
  - *Structure* (labels, buttons, headings, badges): 700 weight, UPPERCASE,
    letter-spacing 1–3px (wider as size grows). Sizes: 10px micro-labels,
    11px controls, 16–17px titles, 20px page headings.
  - *Content* (song titles in lists get 700 but sentence case; body,
    metadata, prompts, lyrics): 400 weight, sentence case, 11–13px.
- Lyrics/structure tags render in monospace.
- Minimum font size 10px (dense desktop UI); prefer 11px+.

## App model — a flat set of top-level views, one page

Single-page app. Top-level state is a flat, enumerable set of full-takeover
views — no nested pages, no stacked modals. The set is allowed to grow as the
app grows (Mulakai is built iteratively); adding a view is a normal addition
to the pattern below, not an exception to a fixed count. Each view:

- is reached from exactly one nav entry point (a header icon, a card action,
  a bar button — never a modal stack),
- owns the full content area below the persistent header,
- shares the header (brand/status/back) and the core shape grammar (zero
  radius, parallelograms/hexagons, five-hue semantics) by default.

A view may opt out of the shared shape grammar only when it is a deliberate,
documented exception (see FORGE below) — not a default escape hatch. That
exception still needs its own short design doc plus a one-line pointer added
here, per `AGENTS.md`'s "UI PRs that deviate from DESIGN.md" rule.

Library, Create, and Editor are the three core views (the creative loop this
app exists for). Anything added alongside them (e.g. FORGE, see
`FORGE_PLAN.md`) is a peer view under the same pattern, not a special case
requiring its own justification against a screen-count rule.

1. **Library** (home) — full width is browsing surface; a right-hand detail
   rail opens only once a song is selected (see below), it does not reserve
   space up front.
   - Header: brand + model status badge only. No search, no form — kept clean
     since neither acts on the header itself.
   - **Create bar**: one slim row below the header — a single "what do you
     want to make?" prompt input + acid CREATE button (parallelogram) that
     navigates to the Create takeover (see below). This replaces the old
     inline create form that used to live in Library.
   - **Browse toolbar**: search input, SORT select (newest/oldest/title/
     favorites), and filter chips (ALL/FAVORITES — acid-outlined
     parallelograms, active = acid-filled) — grouped together directly above
     the list, not in the header, since they act on the list.
   - Flat song list (title · lilac version badge · duration · heart ·
     dislike — no per-card waveform: the footer player is the Library's one
     song-playback surface, see the audio preview module's exclusivity
     rules), rendered as a **fluid multi-column grid** (fixed
     ~410px card width, `auto-fill` column count) rather than one full-bleed
     column — wider screens show more of the library at once, cards
     themselves never stretch. Favorites card row pinned top and rust trash
     strip docked bottom are future work, same anatomy as list cards.
     Global error toasts (rust) appear in the header row.
   - **Song detail rail**: clicking a card's title (not `EDIT`) selects that
     song — sky border + `sky-tint` background on the card, same idiom as
     the Editor's focused layer — and opens a persistent right-hand rail
     (carbon-panel surface, 1px border, ~300px, same anatomy as Editor's
     version rail / Create's refine rail). `EDIT` still opens the full
     Editor directly and is unaffected by selection. The card grid's
     `auto-fill` columns reflow narrower automatically once the rail claims
     width — no separate narrow-layout rule needed, same trick as Create's
     `with-rail` column. The rail shows the song's caption, a METADATA block
     (GENERATED WITH, then BPM/KEY-SCALE/TIME SIGNATURE/DURATION, same labels
     as Create's SONG DETAILS; GENERATED WITH names the engine too when an
     extra engine made the first take — `PROMPT · YUE2`), and LYRICS, plus two quick actions: **REUSE
     PROMPT** (acid-filled, the one primary commit action) opens Create
     prefilled with this song's prompt/lyrics/metadata, **on the generation
     tab that made it** — a cover's prompt describes a change to a source
     track, so replaying it in PROMPT (from-scratch) reads as nonsense.
     GENERATED WITH names that tab (PROMPT/COVER/ARRANGE) so the action's
     destination is visible before the click, and a consequence line under
     the two actions states it in words. For COVER/ARRANGE origins the
     source track can't come along (uploads aren't kept, library mixes are
     bounced on demand), so the reopened tab states the gap inline and waits
     for a source rather than looking ready to generate.
     Reuse restores the song's **reference audio** too — the saved voice it
     was conditioned on plus the audio/style influences it was rendered at —
     since the conditioning is the part hardest to re-guess from the result.
     A stored label that no longer resolves to a saved voice (deleted, or a
     one-off uploaded clip that was never saved) is stated in a rust
     `.warn-note` on the REFERENCE AUDIO control rather than quietly
     generating unconditioned; it clears as soon as any reference is picked.
     **CREATE COVER FROM AUDIO** (acid-outline, sibling per the
     one-filled-acid-CTA rule) opens Create's A SONG I HAVE → FROM LIBRARY path with
     this song preselected — it is the action that seeds a source, which is
     why REUSE PROMPT never quietly does so, and it carries no voice either.
2. **Create** — its own takeover screen, reached from Library's create bar.
   Header stays back/brand/status only (same as Editor's — the header is a
   single persistent element and doesn't carry per-screen content).
   **Guided Create** (2026-10-03, PLAN.md "S2 — Guided Create"; mockup
   `GuidedCreate.dc.html`). One scrolling page, centered at ~1140px — a
   prompt/lyrics editor doesn't get more usable by being 3x wider, so extra
   viewport width is margin here, unlike Editor's waveform. Top to bottom:
   - **Title row**: the song title as a plain input ("New song"
     placeholder, 20px, 700, sentence case — it's content), the consequence
     line ("will appear in **Demos** once generated", or "in your library"),
     and **CLEAR DRAFT** right-aligned.
   - **START FROM** — three wide clip-path parallelogram cards, one per
     flow: **AN IDEA** (text2music: "Describe it in words and get a full
     song"), **A SONG I HAVE** (cover: "Remake a song from your library or a
     file"), **ONE TRACK** (complete: "Build a full arrangement around a
     single part"). The picked card is **sky** (sky edge, `sky-tint` fill,
     sky title), not acid: picking one targets which flow the draft feeds and
     commits nothing. A fresh Create opens on AN IDEA; REUSE PROMPT lands on
     the card that made the song. The three are **renderings of one draft,
     not three separate forms**: title, prompt, lyrics and song details are
     shared and survive a card switch, and each card's own
     source/model/variance choices survive it too, so nothing typed or
     picked is lost by looking at another card. The draft also survives
     leaving Create and coming back within a session; it does not survive a
     reload. Because a prompt means a different thing per card (a whole song
     / a change to a source / an accompaniment), text written under another
     card is marked with a carried-over hint under the field ("Carried over
     from AN IDEA — …"), which clears once it's edited here. There is
     deliberately **no "copy this field to that card" control** — that only
     exists when the cards hold separate state, and they don't.
   - Below the cards, two columns: the flow's **numbered steps** (fluid,
     ~800px) and its **RECIPE card** (300px, sticky so the commit stays in
     view while the steps scroll).
   - **Steps**: each is a row with a small clip-path parallelogram number
     (`text-hi` fill for steps the flow needs, `carbon-raised` for optional
     ones), an uppercase label, optional `text-mid` sub copy and
     right-aligned actions on the label row, then its fields.
   - **CLEAR DRAFT**: one button for the whole draft rather than a
     per-field "clear prompt": with the fields shared, clearing one would
     leave the rest of a half-abandoned draft to hunt down. Quiet outline
     until armed — a two-step confirm (`CLEAR ALL? CONFIRM` plus a line
     naming what goes) that turns rust only on the second press, matching
     the Library's delete confirms; rust marks the moment something is about
     to be destroyed, not a button that merely could. It clears the title,
     the shared fields, every card's source, and the reference audio (a
     voice left selected would keep conditioning an emptied draft), but
     **not** the destination folder or the recipe's generation settings —
     the folder came from where you were in the Library, and those settings
     are app preferences shared with the Editor's repaint/add-layer flows.
     Hidden-by-disabled when there's nothing to clear; a folder-name title
     suggestion doesn't count as something to clear, since it's offered,
     not typed.
   - **RECIPE card** (carbon-panel, 1px hairline), top to bottom:
     - **ENGINE** (see below) and a `text-mid` note on what that engine does
       with this card ("full control · reference voice · editable
       afterwards", "arranging always runs on ACE-Step").
     - **QUALITY**: DRAFT / BALANCED / BEST as a connected group of skewed
       chips, the picked one sky-filled (a choice of how, not a commit),
       with a hint naming the steps it sends ("12 steps · slower, finer
       detail"). Presets resolve to diffusion steps at submit by the run
       model's family (turbo 4 / AUTO / 12, SFT 24 / AUTO / 80, base 16 /
       AUTO / 64); BALANCED sends nothing, leaving AUTO to the server.
       Moving STEPS in TUNE lights no chip ("custom steps, set in TUNE").
       On an extra engine it reads N/A with "YUE2 has no step control".
     - **VOICE**: the reference audio as one bordered line (preview
       hexagon, "Mara · saved voice" / "clip.wav · uploaded clip" / "none")
       with a quiet CHANGE that opens the full reference picker in place. A
       reused song whose voice is missing opens it by itself, since its
       warning lives there. N/A ("none · YUE2 has no reference voice") on an
       engine without one.
     - **TAKES** fader on AN IDEA · ACE-STEP; N/A elsewhere (covers and
       arrangements make one take).
     - **Takes about** / **Lands in** label-value rows: the wait is the
       rolling mean of the last five real generations of this kind (task,
       engine, model family, quality), so the row is **hidden until one has
       finished** — never an invented number. An engine cover still missing
       its score reads "a few min · 3 steps" (TRANSCRIBE, READ LYRICS, the
       cover). Lands in is the destination folder, read-only.
     - **TUNE ▸**: everything the old left settings panel held for the
       flow, collapsed to one `text-low` line — "model, steps, guidance, seed
       · all default", or just the non-defaults ("acestep-v15-xl-sft · 40
       steps · seed 12"). See "Side panels" below for what it holds.
     - The commit: the card's **one filled acid button** (GENERATE /
       GENERATE COVER / ARRANGE), with its consequence copy, blockers and
       a failed submit's RETRY under it.
     WRITE FOR ME's preview takes the recipe's slot while open, with
     `← RECIPE` to go back (the rail-swap idiom).
     - *AN IDEA*: **1 DESCRIBE IT** — description field, FEELING LUCKY
       (lilac, two-step once the draft holds anything), and a lilac helper
       line on AI ENHANCE: the LM derives the generation parameters
       (bpm/key/structure) from the prompt — lilac because it's describing
       AI-derived behavior, not a live selection. **2 LYRICS** — the mono
       lyrics editor with **WRITE FOR ME** (the LM rewrite with a per-field
       preview, formerly REFINE INPUT), TAG GUIDE and **INSTRUMENTAL** on
       the label row. INSTRUMENTAL is a setting, so it lights sky (not acid)
       while LYRICS hold `[Instrumental]`; it never replaces typed words, so
       it waits for an empty box. The Quick Start reveal covers steps 1–2.
       **3 DETAILS** (optional · AUTO lets the planner decide) — BPM,
       DURATION, KEY / SCALE, TIME SIGNATURE, VOCAL LANGUAGE.
     - **ENGINE** (AN IDEA and A SONG I HAVE): which model makes the song's
       first take — ACE-STEP, or an optional extra engine (YuE2, HeartMuLa)
       whose server is configured. One sky parallelogram per engine,
       ACE-STEP first, active = sky fill with `on-sky` text. Until some
       extra engine is configured the row is a single fixed ACE-STEP chip
       with nothing to pick, and ONE TRACK always shows it that way. An
       engine that is configured but unreachable is
       disabled with its reason as a line under the row; if the *selected*
       engine can't take a job, a `.warn-note` says so and GENERATE is off.
       The choice is part of the draft (REUSE PROMPT restores it, CLEAR
       DRAFT resets it), never a sticky preference.
       - **A SONG I HAVE has its own ENGINE row** (added 2026-10-01): ACE-STEP
         plus any engine that can sing a score and whose transcriber answers
         (YuE2 with SheetSage2). It is kept separate from AN IDEA's, so
         picking YUE2 for a cover never changes what AN IDEA generates on,
         and it has the same fixed-ACE-STEP-until-available rule. TUNE
         follows it; on a cover, COT is replaced by a one-line hint, because
         a cover always follows its score's melody.
         It **holds still** (added 2026-10-02) while a job whose result
         lands in that engine's draft runs: TRANSCRIBE, READ LYRICS (with
         their PREPARING SOURCE step) or ANALYZE AUDIO on YUE2, ANALYZE
         AUDIO on ACE-STEP. Every engine tab is disabled, the selected one
         included, and a hint under the row says why, in SOURCE's words:
         "ENGINE is locked while TRANSCRIBE runs — its result belongs to
         this engine's cover". A generation doesn't lock it; its result is
         a library song, not the draft.
       - ONE TRACK is always ACE-Step, and so is every later edit.
       - **Descriptor-driven N/A**: each engine publishes what it can take;
         a control it can't stays **in place**, disabled, with an `N/A`
         readout (the same idiom as GUIDANCE on a Turbo model) and one reason
         line under DETAILS (e.g. "DURATION — YUE2 sets the length from
         the song it plans"). Controls are never hidden, so switching engines
         doesn't reflow the form. A reinterpreted control keeps working and
         says how (HeartMuLa's DURATION reads `MAX 120s`; YuE2's BPM/KEY/TIME
         SIGNATURE are "sent as style text, a hint rather than a guarantee").
       - TUNE swaps ACE-Step's model/LM/steps/guidance/advanced block for
         the engine's own controls (CFG, TEMPERATURE, TOP-K as `Slider.tsx`
         faders where 0 = AUTO; COT as a select), the shared RANDOM SEED/SEED
         pair (or a locked "not reproducible" SEED row for an engine without
         one), and one line naming the ACE-Step settings that don't apply;
         QUALITY and VOICE read N/A in place.
       - GENERATE states the engine's consequence line underneath (e.g.
         "YuE2 · no duration control, no reference voice, no section strip ·
         ~95 s per 3-minute song on an RTX 4080 · later edits use
         ACE-Step"), per the copy rule below.
     - *A SONG I HAVE* (cover): **1 PICK THE SONG** — the SOURCE choice
       (UPLOAD / FROM LIBRARY, tab idiom). FROM LIBRARY shows a searchable
       mini song-picker; the selected song uses **sky** (selection/scope —
       same concept as focusing a layer in the Editor), not lilac. MOVE TO
       EDITOR sits under an upload. **2 WHAT CHANGES?** — a description
       field for the requested change, VARIANCE, and ANALYZE AUDIO.
       **3 LYRICS** — the LYRICS + SONG DETAILS block (see below); GENERATE
       COVER is the recipe's commit. The card's own MODEL picker
       (cover-capable models only) is the cover's model, so in TUNE it
       replaces DIT MODEL and gates STEPS, GUIDANCE and ADVANCED, and
       QUALITY resolves on it; STEPS, GUIDANCE, SEED and the DiT knobs are
       sent with the cover. A model list that is loading, failed or empty
       says so beside the commit, since TUNE starts collapsed. The LM
       controls are hidden since `cover` skips the LM planner, same as
       Editor's repaint mode (`API.md` §4.2).
       The SOURCE picker **holds still** here too (added 2026-10-02), the
       same way as on YUE2 below: while ANALYZE AUDIO or a generation
       (GENERATE COVER's submit included) runs, with the same disabled
       tabs, drop zone and rows and the same reason line.
       - *A SONG I HAVE on an engine (YUE2)*: a melody cover sung from a
         score. The flow is SOURCE → TRANSCRIBE → review → GENERATE COVER.
         Step 1 holds everything that describes the source: the SOURCE
         picker, TRANSCRIBE / READ LYRICS / USE .ABC FILE, the score review
         and SECTIONS. Step 2 is the description and ANALYZE AUDIO; step 3 is
         LYRICS (with FIT TO SCORE on the label row, and "read from the
         recording · edit freely" while they hold what READ LYRICS wrote) and
         VOCAL LANGUAGE.
         - The SOURCE picker is unchanged, except that it **holds still**
           (added 2026-10-02) while a job reads the source: TRANSCRIBE, READ
           LYRICS (with their PREPARING SOURCE step), ANALYZE AUDIO or a
           generation. Its tabs, drop zone and library rows are disabled
           (`text-low`, no acid hover); search and row previews stay live. A
           hint under SOURCE says why: "SOURCE is locked while TRANSCRIBE
           runs — its result belongs to this source". Another job's server
           lock doesn't lock it. **TRANSCRIBE** is an acid
           *outline*, because GENERATE COVER stays the one filled acid CTA.
           While it runs it reads `TRANSCRIBING… n%`, with no shader: the AI
           shimmer stays on GENERATE / REPAINT. Beside it, **USE .ABC FILE**
           (a quiet outline) swaps in a score corrected elsewhere, which is
           the only way to fix its notes. Mulakai has no note editor; it can
           only leave whole sections out (SECTIONS, below).
         - The **score review** is a carbon panel. Its facts sit in the same
           label/value grid idiom as SONG DETAILS: tempo, key, meter, bars,
           length, and sung/played note counts. SheetSage2's warnings come
           as a `.warn-note`, then the piano preview (inline `AudioPreview`),
           then the ABC behind a collapsed SHOW SCORE disclosure.
         - **SECTIONS** (added 2026-10-01) sits under the facts: the score's
           `% name` sections as the Editor's **section strip**
           (clip-path parallelograms, 3px gaps), flex-weighted by each
           section's planner tokens. Kept sections are **sky**, since they
           are the scope of what will be sung; a left-out one is
           `carbon-raised` with its name struck through. A click leaves a
           section out or puts it back, and the last kept one can't go.
           The label row reads `3,469 / 4,096 TOKENS`, rust-text while the
           cut is over YuE2's planning budget, with a `.warn-note` under
           the strip naming the longest sections. GENERATE COVER is off
           until it fits. A hint names what's left out (and that the piano
           preview still plays the whole transcription), and GENERATE's
           consequence line gains "· leaves out OUTRO". The facts and SHOW
           SCORE describe the cut. This is the only score editing here:
           whole sections, never notes.
         - The facts replace BPM / KEY / TIME SIGNATURE / DURATION, which a
           score fixes. VOCAL LANGUAGE stays.
         - LYRICS carry a **FIT TO SCORE** quiet outline, which re-tags the
           words onto the score's sections. A hint names those sections.
           Lyrics that are only tags, or empty, make an instrumental cover,
           and the consequence line under GENERATE COVER says so.
         - **ANALYZE AUDIO** (added 2026-10-01) sits under PROMPT, above
           LYRICS, the same button and place as on ACE-STEP. It runs with
           COVER's ACE-Step model and fills only the fields a score leaves
           open: an empty (or carried-over) PROMPT gets ACE-Step's
           description **rewritten as YuE2 style tags** (voice, genre, mood,
           instruments; no tempo, key or language), wordless LYRICS get the
           words it heard (fitted to the score's sections), and an AUTO VOCAL
           LANGUAGE gets its language (a heard language the engine doesn't
           sing is named in a `.warn-note` instead). BPM / KEY / DURATION
           are never written. Its consequence line says the lyrics are *described,
           not transcribed*; after a run, a line says what was filled and a
           collapsed SHOW DESCRIPTION block (same idiom as SHOW SCORE) keeps
           the full prose, so a dropped phrase can be put back by hand.
         - **READ LYRICS** (added 2026-10-01) reads the words *sung* in the
           source into LYRICS. ANALYZE AUDIO only describes them.
           - **Place:** an acid *outline* in the score-actions row, between
             TRANSCRIBE and USE .ABC FILE. It is live once a source is
             picked, before any score.
           - **Shown only when set up:** it doesn't render at all unless the
             server has a lyrics reader configured (the no-row-until-available
             rule). One that is configured but not answering leaves it
             disabled, with a reason line.
           - **While running:** it reads `READING LYRICS…`, plain like
             TRANSCRIBE, and the two disable each other.
           - **Consequence line:** "READ LYRICS reads the words sung in the
             source into LYRICS · placed under the score's sections by when
             they're sung · about 10 seconds · nothing is saved to your
             library".
           - **Placement:** each line goes under the section it was sung in.
             Lines in sections left out of the strip are dropped, and the
             outcome line counts them.
           - **Following the score:** while LYRICS still hold exactly what it
             wrote, they follow TRANSCRIBE AGAIN and the strip's toggles with
             no new read. An edit makes them the user's.
           - **Replacing typed words:** LYRICS holding the user's own words
             are replaced only after the FEELING LUCKY two-step. The button
             arms as `REPLACE LYRICS? CONFIRM`, with a hint naming what goes.
           - **With TRANSCRIBE, for an upload** (added 2026-10-01): once the
             score lands, READ LYRICS runs by itself when LYRICS hold none of
             the user's words (empty, the outline, or ANALYZE AUDIO's
             untouched guess). It never runs twice for one source. The button
             reads `READING LYRICS…` as for a click. TRANSCRIBE's consequence
             line says so up front: "· then READ LYRICS reads its words into
             LYRICS, unless they hold yours". There is no new control; the
             button stays for a re-read.
           - **Warnings:** each is a `.warn-note`, a state to resolve, not a
             failed click.
             - A score without downbeat times (a file, a reused cover) gets
               its sections timed on the tempo grid.
             - A heard language the engine doesn't sing is named, as with
               ANALYZE AUDIO.
     - *ONE TRACK* (arrange): same shape as A SONG I HAVE but for `complete`
       — **1 YOUR TRACK** with the source choice on its label row (UPLOAD A
       TRACK / PULL ONE FROM A SONG, the latter reusing
       `ScratchSplitPicker`'s stem picker), **2 DESCRIBE THE BAND AROUND
       IT** (description, FEELING LUCKY, ANALYZE AUDIO), **3 LYRICS +
       DETAILS**, then ARRANGE on the recipe. Its own MODEL (Base models
       only) replaces DIT MODEL in TUNE and is what runs. Unlike a cover,
       `complete` doesn't skip the LM planner, so AI ENHANCE stays live in
       TUNE; THINKING MODE is hidden (the in-generation LM is skipped).
     - **LYRICS + SONG DETAILS** (A SONG I HAVE / ONE TRACK only — AN IDEA
       has its own LYRICS and DETAILS steps): once a source is picked and the
       description field is still empty, ACE-Step's `/v1/analyze_audio`
       ("describe this audio for me") runs automatically and fills in
       caption→description, lyrics, and any of BPM/DURATION/KEY-SCALE it
       infers — a small "analyzing source audio…" line appears while it
       runs. It never overwrites text the user already typed; all fields
       stay plain editable inputs afterward, same BPM/DURATION/KEY-SCALE
       trio as AN IDEA's DETAILS.
3. **Editor** (the heart) — layout: a fixed-width **left settings panel** and
     fixed-width **right version-history rail** flank a fluid center column
     (timeline, layer stack, transport, prompt bar). The center column is the
     only element that grows or shrinks with the viewport — the app has no
     `max-width` cap on any screen, Library included (its card grid's
     `auto-fill` columns are what absorb the extra width instead). Extra
     width on wider screens is never wasted whitespace: it becomes more
     visible timeline per lane (denser, more legible waveform) and the
     version rail gets a little more room per card (params, not just a
     name), while the side panels stay put — control/version cards have a
     natural comfortable size and gain nothing from stretching. None of the
     three columns stretch to fill the viewport's *height* either — each
     sizes to its own content (settings controls, title/repaint bar/layer
     list, version history), so a short layer list or history list never
     leaves a dead gap under a tall bordered card. The layer list caps at
     `55vh` and scrolls internally past that instead of growing the page.
   - Header (full width, persistent across all three screens): back-to-
     library, brand wordmark, model status badge only. Song title, time/
     bpm/key metadata, and EXPORT live in the center column and right rail
     respectively (see below) — the header stays free of anything scoped to
     "this song," so it doesn't need to re-render per-song content.
   - Left column (~210–240px, permanent, fixed width): a **lyrics panel**
     stacked above the repaint settings panel (see below). Read-only by
     default (plain text, tag lines in the structure typography voice);
     unlocks into an editable textarea only while the current selection is
     exactly one whole section (see Section strip below) on the base layer —
     editing at any finer/coarser granularity isn't meaningful, since repaint
     only re-renders the selected region regardless of what surrounding text
     says. Selecting a section always highlights (locked) or native-selects
     (unlocked) its matching lyrics block, so the two stay visually in sync.
     Edited lyrics are sent as repaint conditioning and become the song's
     canonical lyrics on success; reverting to an older version restores that
     version's own lyrics alongside its audio (same "current" idiom as audio
     history — see Lilac below).
     - **Timing** (added 2026-10-02): opening a song whose base version
       hasn't been read reads it in the background (a genLock job, shown in
       the header). While it runs, the panel label reads `LYRICS · TIMING…`,
       the suffix in `text-low`. It stays plain, like TRANSCRIBE: reading
       words isn't generating. A failed read shows a `.warn-note` under the
       label, "couldn't time these lyrics" with RETRY, and the reason on one
       ellipsized line (full text on hover). Nothing else is blocked.
     - **Lines** (added 2026-10-02): once read, a line that was heard is
       clickable in the read-only view. Click selects when it's sung as the
       region, shift-click extends from the last clicked line, and
       double-click also moves the playhead to the line's start (the same
       rhythm as the section strip). A line under the 3 s repaint minimum
       is widened evenly to 3 s, so one line is always repaintable. The
       clicked lines echo the selection in sky: `sky-tint` with a 2px sky
       inset edge, one level below the active block's treatment, and only
       while the selection is still what they made. Hover is
       `carbon-raised`, never sky (sky means selected, not pointed at). A
       line that wasn't heard is `text-low`, with "not heard in this take"
       on hover. Tag lines aren't clickable. Selecting lines doesn't unlock
       editing; that still takes one whole section.
   - Left settings panel (~210–240px, see below): repaint parameters.
     Permanent, fixed width.
   - **Title row**: song title (bold, 16px) + time/bpm/key/layer-count
     metadata, directly above the shared scrub timeline — the one place this
     information lives now that the header doesn't carry it.
   - **Load failure**: a song that fails to load shows a rust `.error` line
     ("couldn't load this song — why · RETRY") where the editor would be,
     never an endless "Loading…". A failed refresh of a loaded song (after a
     mute, a revert, a claimed stem) keeps the song on screen and shows the
     same line, "couldn't refresh this song", above the title row. A lane
     control or a history action that fails shows its own `.error` line in
     the lane or the rail ("couldn't mute — why").
     A lookup a control gates on (which models support Add Layer, Remaster,
     Cover or Arrange, which split backends are up, the voice list, the
     model list in Settings and the DIT/LM selects, the saved voices in
     Settings > Voices and the Library rail's reference voice) that fails
     shows its own `.error` line with RETRY in place of "checking…"
     ("couldn't check models for Add Layer — why · RETRY"), in the Editor,
     Create, Settings and the Library alike. "No model supports…", "not
     configured", "no models reported" and "No saved voices yet." appear
     only when the server said so. A choice that needs no list (AUTO,
     NONE, UPLOAD) stays usable meanwhile. A model lookup still waiting
     after 60s says why in its gray `.meta` line ("checking available
     models… ACE-Step is taking a while to answer, it may be busy
     generating"); it isn't an error, so it isn't rust.
     The split backend picker checks each backend on its own: an ACE-Step
     that couldn't be asked gets its own `.error` line with RETRY
     ("couldn't check ACE-Step — why · RETRY") while the split-service tab
     stays pickable. That tab is labelled for the service answering at
     `DEMUCS_API_URL`: UVR (uvr-server) or DEMUCS (demucs-server, and the
     slot's name when nothing answers). Its title names that service, or
     says whether the URL is unset or set but not answering.
   - **Layer stack (`LayerStack.tsx` + `LayerLane.tsx`)**: a DAW-style
     multi-lane waveform view, the editor's primary waveform surface.
     `Timeline.tsx` (the shared scrub strip) and the lane grid share one
     bordered surface (`.stack-scrub`) so a single playhead line can run
     through both — see below. Implemented as one CSS Flexbox column
     (`.lane-grid`): each lane stacks a control bar above its own waveform,
     both spanning the same x-axis (no left-column offset), so the shared
     playhead's `left` is a plain percentage of the stack's width:
     - Each layer gets one **lane**: a control bar (inline-editable
       uppercase name, volume slider, MUTE/SOLO toggles — muted reads
       rust-text/rust-border) directly above its waveform.
     - **Every lane renders its full waveform, focused or not** — the stack
       is deliberately a dense wall of tooling rather than collapsing
       unfocused layers to a one-line summary. Only the **focused** lane is
       interactive (drag-to-select a region, double-click-seek); other
       lanes render the same `Waveform.tsx` component in its non-interactive
       mode (idle-grey bars only, no selection wash, click/double-click
       focuses instead of seeking or selecting).
     - Focus uses the sky idiom: left-border accent + sky-tint background on
       both the control bar and waveform of the focused lane (same concept
       as `.version.current`'s lilac accent, but sky — see the Sky section
       below). Focusing re-targets the shared transport, prompt-bar, and
       version-history to that layer.
     - The timeline itself (`Timeline.tsx`) is a ruler, not just start/end
       labels: ticks + `mm:ss` labels at a "nice" interval (5/10/15/30/60…
       seconds, auto-picked so ~5–10 ticks span any song length) run along
       the scrub track, in addition to the live playhead/duration readout
       above it.
     - **One continuous playhead line** (`.stack-playhead`) spans from the
       scrub timeline's baseline through every lane below it, with a diamond
       thumb marking the top — it reads as a single scrub control for the
       whole stack, not a separate timeline thumb plus a disconnected
       per-lane line. Note: this reflects a single `playhead` time value
       from whichever layer's audio is currently loaded — it is a visual
       "these lanes play together" cue, not yet real synchronized
       multi-layer audio playback (that engine is future work).
     - Lane height ~56–64px. Lane dividers are a single `border-bottom` per
       element (never a top border stacked against a neighbor's bottom
       border) so boundaries stay one crisp hairline, not a doubled/thick
       line — the outer box edge comes from `.stack-scrub`'s own border.
     - A trailing **"+ ADD LAYER" row** stays compact (icon + label only)
       until hovered or focused (`:hover`, `:focus-within`), at which point
       it expands in place to the full form (prompt, DIT MODEL, submit) —
       keeps the stack from defaulting to an always-open form.
   - **Shared transport**: `Player.tsx` sits below the lane stack in its
     **minimal** mode — play/pause hexagon + stop only, no time/volume/
     download — driving/reflecting whichever layer is focused. Time already
     lives in the stack-scrub timeline above, and per-layer downloads live
     in the Export rail view (see below), so the transport itself stays
     down to the two controls that are genuinely transport, not duplicated
     elsewhere. The Library footer player keeps the full control set (time,
     volume, download) — `minimal` is Editor-only.
   - Section strip: parallelogram segments (Intro/Verse/…) derived from
     lyric-aligned timestamps, flex-weighted by section length; click = select
     that section as the region; active (selected) = sky. Double-click also
     moves the playhead to the section's start, for quick preview. The times
     come from lyrics-server's reading of the base version, aligned to the
     song's LYRICS, or from ACE-Step's own stored timings when there is no
     good reading (added 2026-10-02, PLAN.md "Editor Word Timestamps"). So
     engine songs, imports and repaints get a strip too.
   - Prompt bar: sky scope chip mirroring current selection, free-text
     instruction, acid REPAINT REGION action.
   - **Right rail** (~260–320px, carbon-panel surface, 1px border): persistent,
     not stacked under the prompt bar. Putting it here (instead of at the
     bottom of the vertical flow) keeps it on screen while repainting even on
     shorter (1080p) displays, where vertical space is the tighter resource.
     Two views share the slot, toggled in place (no navigation):
     - **History** (default, lilac accents): current version gets a
       lilac-tint card + lilac border; every entry gets SEL (set that
       version's region as the current selection), ALT (regenerate as an
       untracked alternate), and X (two-step rust delete-confirm); inactive
       versions additionally get REVERT, which also selects that version's
       region (reverting to a version implies you're about to work on it
       again, so there's no reason to make that a second click). Each
       entry's actions render as one connected button group (see "Connected
       button groups" under Side panels). Branches A/B + Fork are future
       work.
     - **Export**: reached via an EXPORT button docked under the history
       list; swaps the rail to a per-layer stem list (name + DOWNLOAD),
       with a "← HISTORY" link back. A composited master-mix export is still
       an open question (see `PLAN.md`'s Export phase note) — stems are the
       current answer, not a placeholder for it.
4. **Settings** — a 4th peer screen (locked 2026-07-06), reached via a
   SETTINGS chip in Library's toolbar row (alongside ALL/FAVORITES, not the
   header — it acts on app-level config, not "this song"). Calm, table-like
   layout: a single centered column (~640px, same `.create-content`-style
   card idiom) of stacked `.settings-card` sections, each a carbon-panel
   card with a `.section-label` heading — no side panels, no waveform, no
   acid/sky/lilac scope-vs-commit rhythm (nothing here is a generative
   action). Sections, top to bottom:
   - **Models**: DIT/LM model inventory (from `/v1/models`) with a SET
     DEFAULT action per model — literally the same `gen.model`/`gen.lmModel`
     Create's TUNE already persists, surfaced here so it's
     reachable without opening Create. Read/select only — ACE-Step's API
     has no download/update-model endpoint, so this is not a model manager.
   - **Engines** (added 2026-09-30): read-only, one row per optional
     first-take engine with its status (READY / NOT CONFIGURED /
     UNREACHABLE, same `.health` pill as MODELS) and the env var that
     enables it — engines are configured on the server, so this card
     reports and points rather than edits. An engine's license caveat is
     stated here once (YuE2's CC BY-NC 4.0, and SheetSage2's). An engine
     that can cover gets a COVERS line under its row: READY, or NOT SET UP
     plus what its server needs (same `.health` pill). While any engine is configured,
     a `.warn-note` reminds you to run ACE-Step with
     `ACESTEP_OFFLOAD_TO_CPU=true` — a standing reminder, since Mulakai can't
     read ACE-Step's startup settings.
   - **Adapters** (added 2026-07-31): registered LoRA/LoKr adapters with a
     SELECT action per row and a NONE row at the top, plus a STRENGTH slider
     for whichever is active. Deliberately the same row + `mk-badge`
     (ACTIVE) idiom as Models directly above it — both answer "pick one of
     these, it applies next time you generate" — with the delete arming into
     a rust two-step confirm like the rest of the app. One selection is
     app-wide, not per-flow, because ACE-Step's adapter state is global
     (`/release_task` takes no adapter parameter), and the card states that
     reach inline: "…applies to every generation, repaint, layer and
     remaster until you select NONE". A recorded-but-not-yet-applied
     selection shows a `.warn-note`, since claiming an adapter that isn't
     loaded would be a lie. Training is out of scope here — see
     `FORGE_PLAN.md`.
   - **Playback & Export**: default volume-on-load, default Remaster/export
     audio format, default Remaster diffusion steps (1–200, ACE-Step's
     documented Base-model ceiling — not a bitrate/sample-rate control,
     since ACE-Step exposes neither).
   - **Voices**: the voice-library upload/rename/delete surface, relocated
     here from Create's `VoicePicker` (which is select-only now, with a
     MANAGE VOICES link that navigates here instead of expanding inline).
   - **Library Maintenance**: storage-used/song-count/trash-count stats,
     the trashed-song list with RESTORE per row, and an EMPTY TRASH NOW
     action (two-step confirm, rust) that bypasses the normal 7-day sweep.
   - **Forge (experimental)**: a toggle that reveals FORGE's header icon
     (see FORGE_PLAN.md) — off by default per `AGENTS.md`'s "unfinished/WIP
     UI must not be exposed as usable" rule.
   - **Output file metadata** (added 2026-07-06, at the very bottom): default
     Artist/Encoder plus an ID3 version choice (v2.3/v2.4), stamped onto every
     generated file's tags. Genre/Album/cover-art and Comment are per-song
     instead (revised 2026-07-06) — they vary per song rather than being
     sensible global defaults — and live in `SongDetailRail.tsx` (Library's
     song detail rail), grouped directly under the CREATE COVER FROM AUDIO
     button.

### Side panels (Create + Editor)

**Persistent left settings panel** (~210–240px, carbon-panel surface, 1px
border) holds generation/repaint parameters — it does NOT slide in
per-action, so power controls are always visible without a selection. The
**Editor** additionally has the persistent right version-history rail
described above; **Create** has no right panel. Neither side panel scales
with viewport width — see the Editor layout note above.

- **Generate mode is gone from the side** (2026-10-03): Create has no left
  panel. Its settings live in the RECIPE card's **TUNE ▸** disclosure (see
  Create), collapsed to a one-line summary of the non-defaults. Open, it
  holds DIT MODEL (or, on A SONG I HAVE / ONE TRACK, that card's own MODEL,
  which gates the rest), LM MODEL + THINKING MODE + AI ENHANCE (hidden on A
  SONG I HAVE, since `cover` skips the LM planner the same way repaint does;
  THINKING hidden on ONE TRACK), STEPS + GUIDANCE faders, RANDOM SEED with a
  seed field when off, and ADVANCED. STEPS reads the QUALITY preset's count
  ("BEST · 12") until moved; moving it makes QUALITY custom. TAKES and the
  reference audio moved to the recipe itself (TAKES, VOICE).
- **Repaint mode**: DIT MODEL select, VARIANCE slider (the same
  `Slider.tsx` parallelogram fader as STEPS/GUIDANCE, passing a `color`
  prop that swaps the fill/handle live to sky/acid/rust depending on which
  third of the 0–100 range the value sits in, plus a dynamic label/note
  reading SUBTLE, BALANCED, or BOLD), STEPS + GUIDANCE sliders, RANDOM SEED
  toggle + seed field. No LM MODEL or MODE segmented control here: ACE-Step
  skips the LM planner for repaint entirely (docs/ace-step-1.5/API.md#4.2),
  and the mode presets were replaced by the self-explanatory VARIANCE scale.
  The prompt bar (`RepaintBar.tsx`) additionally has a CROSSFADE stepper next
  to its scope chip — seconds of waveform-level splice crossfade at the
  region boundary (0 = hard cut), clamped to half the selected region,
  reusing the same plain numeric-input styling as KEY/SCALE/TIMESTEPS.
- Controls: `Slider.tsx` parallelogram faders (see "Parallelogram fader"
  under Shape grammar) for STEPS/GUIDANCE/VARIANCE, acid-when-on toggles
  (parallelogram knob). Slider readouts in acid, except VARIANCE whose
  readout and note follow its own risk-scale color. Settings persist across
  sessions (localStorage).
- **Connected button groups**: where multiple actions act on the same
  target (a lane's MUTE/SOLO, a version's REVERT/SEL/ALT/X), the buttons
  share one skewed row — `transform: skewX(-10deg)` per button (label
  counter-skewed) with `margin-left: -1px` so adjacent borders merge into a
  single shared hairline — rather than reading as separate loose buttons.

### Interaction rhythm

The whole app is a two-step loop: **target** (sky) → **commit** (acid).
Select where, then say what. Every commit produces a new version (lilac) and
never destroys the old one.

- Quick path: select region → type in prompt bar → REPAINT REGION.
- Control path: adjust the always-visible left settings panel (mode, variance,
  steps, guidance, seed) before committing — no per-action sheet.
- Empty selection = whole song scope.
- Actions always state the version they will create before commit.

## Motion

The app is otherwise static chrome — motion is reserved for moments that
mean something: a view changed, a selection formed, a commit fired, the AI
is working. Default feel: **snappy and purposeful**, not playful — 150–300ms,
`easeOut`, no spring/bounce/elastic. The one deliberate exception is AI-in-
progress states (see "AI states" below), which are allowed to feel alive.

### Persistent header

The header (brand + model status) is a single persistent element, not
re-mounted per view — it never fades with the rest of the screen. The
`MULAKAI` wordmark uses a shared `layoutId` so it glides (not cuts) between
its Library position (left, standalone) and its Editor/Create position
(left, beside the back button/title), while the model status badge stays
in place at the right. Only the content *below* the header crossfades on
view change.

**Model status badge** (2026-10-02): one hairline rectangle at the header's
right — a square dot, `MODELS`, and a summary: `N READY`, `N DOWN`,
`ACE-STEP OFFLINE` (outranks any count: every edit runs on it), `ACE-STEP
BUSY` (silent mid-job — it answers nothing while generating — so not an
outage), or `CHECKING…`. Hovering or focusing it opens a popover (carbon-
raised, `line-hi` hairline, anchored under its right edge) with one row per
model or service: ACE-Step, each extra engine plus its cover model, the
Demucs/UVR slot and ACE-Step extract for stem splits, and the lyrics reader
— name, what the app uses it for, and its state, with a SETTINGS › link at
the foot. States: READY/ONLINE in `text-hi` (filled dot), BUSY in
`text-mid` (slow-pulsing dot), UNREACHABLE/OFFLINE in rust (filled rust
dot; a down service also turns the badge rust), NOT CONFIGURED / NOT SET UP
in `text-ghost` (hollow dot). Not configured is a setup choice, not a
fault, so it never counts as down. No acid here: acid means "commit", and a
healthy model isn't an action.

### View transitions

- **Library ↔ Create/Editor**: content fades + slides horizontally (already
  implemented) while the header persists per above.
- **Entering Create or Editor specifically** (not Library — it's the neutral
  home screen): content gets one extra "materialize" beat on entry only,
  never on exit — a thin sky/acid scanline sweeps once across the screen as
  the content fades/staggers in center-out, ~200–300ms. This marks these two
  as the "working" screens, distinct from Library's plain browsing surface.
- **Version rail entries**: new version cards slide in from the top with a
  brief lilac glow (not a plain slide) — lilac already means "the AI made
  this," so its arrival should read as an event.
- **Section-strip / selection**: the sky-tint wash expands from the drag
  point on region select rather than snapping in; the section-strip's active
  sky fill slides between segments on change rather than swapping instantly.
- **Playhead**: linear CSS transition between updates instead of a per-frame
  snap, so playback reads as continuous motion.
- **Toasts**: rust warning/error toasts slide in as a skewed parallelogram
  (matching the shape grammar), not a plain fade. A *standing* warning — one
  describing a state the user still has to resolve, not an action that just
  failed — uses `.warn-note` instead: same rust hue, 1px left hairline, no
  entrance animation, since it wasn't triggered by the last click and
  animating it would claim otherwise.
- **Status blips**: the model status badge's dot pulses once whenever its
  overall state flips (ready/busy/down), so the change isn't silent.
- **Commit actions**: GENERATE / REPAINT REGION give a brief acid glow/scale
  flash at the moment of commit, echoing "this just started something."

### Interactive feedback

Steady-state controls are static, but *interaction* with them isn't silent —
every shared control answers a hover, a press, and a keyboard focus, so the UI
reads as responsive without becoming busy. One consistent recipe (see the
"Interactive feedback" block at the end of `index.css`), all transform-free so
it never disturbs a skewed CTA or framer-motion's own transform:

- **Hover**: plain outlined buttons brighten their hairline + text
  (`carbon-line-hi`); acid CTAs get a soft acid bloom (`box-shadow`)
  telegraphing "this commits something"; a card in the Library grid lifts on a
  low shadow; contextual glyphs preview their meaning (play → acid, trash →
  rust, empty heart → acid).
- **Press** (`:active`): a uniform `filter: brightness(0.9)` dip — one cue that
  is safe on skewed and framer-driven buttons alike (no scale/translate that
  would drop a skew).
- **Focus** (`:focus-visible`): a 1px **sky** ring (`outline`, 2px offset) on
  every real control, and a sky border on a focused text field — "what am I
  pointing at?" applied to keyboard navigation, per the keyboard-first rule.

Timing is the shared `--ease`/`--dur` tokens (150ms, easeOut, no bounce).
Range sliders opt out of the focus ring (they paint their own), and everything
here collapses under `prefers-reduced-motion: reduce`.

### AI states — the one exception to "one hue, one job"

Moments where the AI is actively working (generating, repainting, LM
"thinking") are allowed to blend lilac/sky/acid together — this is a scoped,
deliberate exception to the single-hue rule above, not a loosening of it.

**Implementation**: a recolored WebGL2 shader
(`ShaderCanvas.tsx`, ported from [shadertoy.com/view/DdcfzH](https://www.shadertoy.com/view/DdcfzH),
its stock palette swapped for acid/sky/lilac/carbon) replaces what used to be
a CSS gradient sweep — a slow rotating noise-warped blend of the four hues,
animated per-frame, `prefers-reduced-motion`-aware (freezes to a static
frame). `AIGeneratingBackground.tsx` wraps it as an absolutely-positioned
fill for a parent with `position: relative`; call sites mount it only while
`active` (a job's `loading`/`running` stage, a toggle's `checked` state).

**Progress veil**: `AIGeneratingBackground` takes an optional `progress`
(0-1). When a call site has real per-job progress (ACE-Step's `/query_result`
now surfaces this — see PLAN.md's "Real per-job progress" workstream), it
covers the shader from `progress*100%` to the right edge with a `carbon`,
~70%-opaque veil, so the unveiled left portion reads as "how far along this
is" — still texture, not a literal progress bar. Omitting `progress` (the
default) renders the plain full shader, unchanged from before; several call
sites (e.g. Create's brief pre-jobId "STARTING…" state) still do this since
no progress fraction exists yet at that point. An extra engine's job (e.g.
YuE2) reports a fraction of its *current stage* rather than of the whole job,
so its card names the stage and that stage's share ("synthesizing audio
41%") and shows the plain shader — a veil that swept back to empty at every
stage would claim the job was going backwards.

**Size rule — background fill vs. thick border**: the shader reads as
texture, not as legible surface for text sitting on top of it. Apply it
differently depending on how much of the element it would cover:

- **Bigger elements** (a card, a full-width button, a waveform/lane
  region) — the shader fills the **entire background**, with foreground
  content (labels, timers) layered above it at `z-index: 1`. Example:
  `GeneratingCard.tsx`'s pinned library row — `AIGeneratingBackground` fills
  the whole card while `STAGE_LABEL`/elapsed-time text sits on top. Also
  used this way by `RepaintBar.tsx`'s REPAINT REGION button while running,
  `LayerLane.tsx`'s focused-lane "processing" overlay, and
  `ThinkingWipe.tsx`'s full-block Quick Start reveal.
- **Smaller elements** (a toggle, a chip, a badge) — full-fill would drown
  the label in motion at that size, so the shader renders as a **thick
  border** instead: the shader canvas fills the element's box, but the
  interior is inset with `carbon` so only a ring of the animated shader
  shows around the edge, label unobstructed. `Toggle.tsx`'s
  `.toggle-shader-mask` (3px inset over the canvas) and `.ai-badge`'s
  `.ai-badge-mask` (2px inset, shared via `AiEnhanceBadge` in `Toggle.tsx`
  so Create's field badge and the settings-panel toggle stay visually
  identical) both use this pattern — mask element painted after the canvas
  in DOM order (no `z-index` needed within the same stacking context), with
  the label/dot bumped above both via their own `z-index`.

Applies **only** to: the GENERATE / REPAINT REGION button and the waveform
region it targets while a job is in flight; the "processing" placeholder
over a waveform/lane awaiting AI output; the `AI ENHANCE` and `THINKING
MODE` toggles while active; Create's Quick Start reveal (the library create
bar's typed idea expanded into a full draft — the PROMPT/LYRICS block
shimmers solid while the LM works, then wipes away left-to-right in one
sweep as the result types in underneath, `ThinkingWipe.tsx` /
`useThinkingQuery.ts`); and COVER/ARRANGE's ANALYZE AUDIO button while
ACE-Step's LM describes the source (`AnalyzeAudioButton.tsx`, on every
engine — it has worn the shader since it was added, and is listed here
now so the list is complete). TRANSCRIBE and READ LYRICS stay plain: SheetSage2 reads
notes and lyrics-server reads words; neither describes or generates.

Nowhere else. Steady-state UI (idle buttons, static panels, non-AI toggles)
keeps the strict one-hue-per-job rule — if a future feature wants to reuse
this shimmer outside these cases, that's a scope question, not a default.

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
