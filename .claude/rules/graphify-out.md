---
paths:
  - "graphify-out/**"
---

# graphify-out (generated)

- Never hand-edit; run `graphify update .` (AST-only, no API cost).
- `.gitattributes` gives `graphify-out/**` `merge=ours`: a local merge
  keeps this branch's graph files instead of conflicting on them. Each
  clone needs it defined once: `git config merge.ours.driver true`
  (without it, those files conflict as before).
- The kept side is stale for whatever was merged in, so run
  `graphify update .` after every merge.
- GitHub ignores custom merge drivers: a PR whose only overlap with `main`
  is the graph still shows as conflicting until someone merges `main` into
  it locally.
