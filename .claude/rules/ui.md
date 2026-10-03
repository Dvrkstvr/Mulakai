---
paths:
  - "client/src/**/*.tsx"
  - "client/src/**/*.css"
---

# UI

- `docs/design/DESIGN.md` is mandatory reading before any UI change.
- Colors, spacing and type come from the tokens only; zero radius;
  parallelograms for choices, hexagons for transport, diamonds for slider
  thumbs, 1px hairlines.
- One semantic job per hue: acid commit, sky selection/scope, lilac
  versions/history, rust errors/warnings/trash, carbon structure. The AI
  shader is the one exception, and only where DESIGN.md lists it.
- Desktop-only layout; no responsive breakpoints.
- Copy: uppercase 1–3 word verbs on buttons; errors say what happened and
  what to do.
- A change that deviates from DESIGN.md updates it in the same PR, as its
  own commit. Browser-check the change on the dev server before calling it
  done.
