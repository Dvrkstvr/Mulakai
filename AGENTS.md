# AGENTS.md — Mulakai Development Rules

> All AI agents MUST follow this file AND `CLAUDE.md`.
> See `PLAN.md` for the grand goal, scope, and phased plan — read it first.

## Scope Discipline

This project is intentionally slim: generate a song with ACE-Step 1.5, then
repaint sections and layer new instruments/vocals directly on it, with full
version history. It is explicitly **not**:
- a multitrack arrangement DAW (no placing/arranging multiple distinct songs
  together — one song open at a time),
- `ACE-Step-DAW`'s full feature set (no VST3/WAM, no MPE, no MIDI editor, no
  synth engines, no Strudel, no collaboration, no plugin host, no desktop
  packaging),
- `ace-step-ui`'s social/account layer (no usernames, profiles, sharing,
  following, playlists) or its video generator.

Before adding a feature, check `PLAN.md`'s phase list — if it's not there,
raise it as a scope question rather than building it.

## Design System (mandatory for all UI work)

`docs/design/DESIGN.md` is the single source of truth for the UI. Hard rules:

- Zero border radius; parallelograms for choices, hexagons for transport,
  diamonds for slider thumbs; 1px hairlines.
- One semantic job per color: acid `#D4FF00` commit actions only, sky
  `#30BCED` selection/scope only, lilac `#7B4B94` versions/history only,
  rust `#CC3F0C` errors/warnings/trash only, carbon `#1C1D21` structure.
  Never overload a hue with a second meaning.
- Desktop-only layout — no responsive/mobile breakpoints.
- Every generative/destructive action states its consequence inline before
  commit (e.g. "result will be saved as vocals v3").

UI PRs that deviate from DESIGN.md must update DESIGN.md in the same PR (as
its own commit) or be rejected.

## Module Size Policy

- Target: `<=150` LOC per module. Hard cap: `200` LOC.
- If a module would exceed the cap: split by responsibility first, or justify
  the exception in the PR with a concrete follow-up split plan.
- This is a direct lesson from `ACE-Step-DAW`'s `projectStore.ts` (10,803
  LOC) — do not repeat that mistake here.

## Spec-Driven Development

Non-trivial features (anything touching 3+ files) get an OpenSpec proposal
before code:

```bash
/opsx:propose "feature-name"   # Create proposal + specs + design + tasks
/opsx:explore                  # Browse existing specs
/opsx:apply                    # Implement tasks from a change
/opsx:archive                  # Archive completed change into specs/
```

- Specs live in `openspec/specs/` (tracked in git).
- Proposals live in `openspec/changes/` (working directory).
- Use Given/When/Then scenarios and RFC 2119 keywords (MUST/SHALL).

## Git Workflow

- `main` — stable, PR-merge only, never push directly.
- Branches: `feat/xxx`, `fix/xxx`, `test/xxx`.
- Commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`.
- One problem per PR. No drive-by refactors or formatting sweeps.

## Testing

- Vitest for store/engine unit tests — required for every behavior change.
- Playwright for one golden-path e2e per phase (generate → arrange → mix →
  export, and edge cases as phases add them).
- Run the test suite before every commit. Don't self-assess — treat a green
  test run as the bar, not your own read of the diff.
- Browser-test UI changes manually (start the dev server, exercise the
  golden path) before calling work done — type-checks alone don't verify UX.

## Code Style

- TypeScript strict; no untyped `any` without justification.
- Comments only where intent is non-obvious (hidden constraint, workaround,
  surprising behavior) — never restating what the code already says.
- Feature-gate WIP/unstable flows; don't expose "coming soon" as usable.

## Red Lines

- Never push directly to `main`.
- Never merge without tests passing.
- Never add DAW features outside the locked scope in `PLAN.md` without
  raising it as a scope question first.
- Never modify `ACE-Step-1.5` — it's an external dependency, reached only via
  `ACESTEP_API_URL`.
