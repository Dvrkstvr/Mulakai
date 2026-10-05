---
paths:
  - "client/src/ActionDock.tsx"
  - "client/src/Dock*.tsx"
  - "client/src/dock*.ts"
  - "client/src/useDockKeys.ts"
  - "client/src/*Score*.tsx"
  - "client/src/score*.ts"
---

# Action Dock

Spec: DESIGN.md "Action dock"; SCORE: `pipeline/design/score-verb.html`
(signed off, D-032) and PLAN.md "Score Agent".

- One filled acid control per dock: the commit. Active tabs and PLAN are
  acid outlines.
- Every commit states its consequence line before it is pressed; queued
  work adds "· starts after n jobs".
- The commit's label never turns into progress; each job is a line under
  it (AI shader while the GPU works on it, dashed and plain while queued).
- The verb list and keys come from `dockVerbs` (SCORE last, key C, only
  when the server says SCORE is not hidden); keys are ignored while a
  field, select or dialog has focus.
- SCORE state changes go only through the `scoreVerb` reducer; SCORE copy
  lives only in `scoreCopy.ts`.
- While SCORE is open, ACE-Step edits that save a version (REPAINT, ADD
  LAYER, a stem claim) end their consequence line with `SCORE_ENDS`
  (F-027, D-058); REMASTER keeps no version and gets none.
- Errors, refusals and TRUNCATED are rust; versions lilac; the chip sky.
