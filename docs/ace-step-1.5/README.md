# Vendored ACE-Step 1.5 documentation

Nothing in this folder is Mulakai's work. These are copies of ACE-Step's own
documentation, kept here because Mulakai's source cites them by section — a
comment reading `docs/ace-step-1.5/API.md#4.2` is only useful if the file it
names is actually in the tree.

| File | Copied from `ace-step/ACE-Step-1.5` |
| ---- | ----------------------------------- |
| `API.md` | `.claude/skills/acestep-docs/api/API.md` |
| `GUIDE.md` | `.claude/skills/acestep-docs/getting-started/Tutorial.md` |
| `Tutorial.md` | `.claude/skills/acestep-docs/getting-started/Tutorial.md` |

`GUIDE.md` and `Tutorial.md` are two snapshots of the *same* upstream document,
taken at different times — 2 July and 11 July 2026. Keeping both is a
historical accident, not a decision; if you are reading for current behaviour,
read `Tutorial.md`.

## Licence

Upstream is <https://github.com/ace-step/ACE-Step-1.5>, MIT licensed,
Copyright (c) 2026 ACEStep. That licence is reproduced verbatim in `LICENSE`
in this folder and is what governs these three files. Mulakai's own MIT licence
at the repository root explicitly does not extend here — Mulakai cannot
sublicense someone else's writing, and does not try to.

## Keeping them current

All three lag upstream, which has moved on since they were taken. They are a
reference for what the code was written against, not a mirror. If a claim in
here disagrees with the running ACE-Step server, the server is right.

To refresh one, copy the upstream file over it and re-add the attribution
header at the top. Do not hand-edit the prose: a locally edited copy of someone
else's document is the one thing this folder is arranged to avoid.
