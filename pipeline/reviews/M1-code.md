# M1 review, lens: code

Range: `git diff f7512cd...origin/main` (origin/main 38f022d = #131 W6, #132 W7, #133 W9, #134 W8 + D-060 follow-up).
Read: scope M1, F-026..F-028 acceptance, D-056..D-060, Q-038..Q-040, `pipeline/verify/M1/m1-verify.md`, M0-code.md (Q-038's
nits are not repeated), CLAUDE.md invariants, `.claude/rules/score-server.md`, all new/changed `yue-server/score_*.py`,
`server/src/services/score/*`, the client dock/copy files and `e2e/fake-score`. Evidence: *seen in code* unless stated; I ran
one probe against `git archive origin/main` yue-server in the scratchpad (finding 1). The suites were not re-run.

No blocking finding. Invariants hold in this range: the planner/YuE2 hand-off in `planJob.ts` is unchanged (`phraseBarsOf` and the
schema are built inside the `try`; `release()` still runs in `finally`), and TypeScript still never reads or writes ABC (the new TS
files only read yue-server's `bar_map` text and write `{pitch, beats}` JSON; `freeRuns` parses the `V:rest` column, not ABC).

## Findings

### 1. should · W7 (#132) · `yue-server/score_phrase.py:46-56` (`note_events`) · an in-bar accidental carries onto the next plain letter, so the phrase sounds a different pitch than the planner wrote, and no gate sees it
The planner prompt (`plannerRules.ts`) says "write plain letters; only use ^ _ = for a chromatic note", i.e. a plain letter means the key
signature's note. ABC (and upstream's `parse_bar`, `abc_tools.py:121-131`: `local[letter]` propagates "by letter, across octaves" until the
bar ends) makes a plain letter after `^F` in the same bar still F#. `note_events` emits the planner's string unchanged and the module
docstring says "code owns the ABC". Input/state (seen running, 2c944049's score, key Dm, `L:1/32`): phrase bar `[^F 1, G 1, F 1, A 1]`
applies with `ok: true`, writes `^F8G8F8A8`, and upstream parses the third note as MIDI 66 (F#), not 65 (F); `check_edit` returns
`{ok: true, problems: [], differences: []}`. The plan passes, the user is told nothing, and YuE2 is asked for a chromatic note the planner
did not intend (and the in-key gate counts the F# as out of key, so a clean-looking phrase can also fail 70% for a reason the planner
cannot see). Same for `^f` then `F`. Fix: in `write_phrase`, track the alteration in force per letter through the bar (as `parse_bar` does)
and, where a plain letter would inherit one that differs from the key signature's, emit `=` (or the key's accidental, e.g. `_B` in a flat
key); reset at each bar and at an inline `[K:]`. Add a pytest named for the trap (`^F G F` in Dm).

### 2. nit · W7 · `yue-server/score_phrase.py:112` (`add_instrument`) · a substring match decides the instrument is already in the style
`name.lower() in style.lower()`: instrument "organ" with style "organic folk, 90 bpm" (or "bass" inside "bassline", "sax" inside
"saxophone" where the planner meant a different part) is not appended, so YuE2 never hears the instrument the phrase is written for,
and the review row (`phraseDetail`, same substring rule on the client) shows no "style +" so it is consistent but silent. Fix: match on
word boundaries (`re.search(rf"\b{re.escape(name)}\b", style, re.I)`), on both sides (`scoreCopy.ts:names`).

### 3. nit · W8 (#134) · `server/src/services/score/phraseSchema.ts:6-14` vs `yue-server/score_phrase.py:23-27` · PITCH, BEATS, 8 bars, 16 notes, 40 chars live twice and only one side is pinned
The TS test "PITCH and BEATS match yue-server" pins literals on the TS side only; no pytest pins the Python literals (grep of
`yue-server/tests` finds none). If yue-server's route narrows a bound (say a pitch form or a length), the server still sends it, the
route answers 422 for the whole apply (not a per-op verdict), and `yueScoreApply` treats a 422 as "the base score is not valid".
The README documents the shared values; a cross-check would catch drift. Fix: one test on either side that loads the other's constants
(e.g. a server test reading `yue-server/tests/data/contract/apply-write-phrase*.json` notes through `phraseProblems`, plus a pytest
asserting `PITCH`/`BEATS` literals equal the README/TS ones).

### 4. nit · W9 (#133) · `e2e/playwright.config.ts` (`chromium` project's server env) · the golden-path server does not blank `LLM_API_URL`
Its siblings (`YUE_API_URL`, `HEARTMULA_API_URL`, `DEMUCS_API_URL`, `LYRICS_API_URL`) are set to `''` so a developer's shell cannot leak
in; `LLM_API_URL` is not. A shell with it set shows the SCORE tab and calls a real planner status check from the golden path, against
F-028 #3 ("does not set LLM_API_URL"). CI is unaffected. Fix: add `LLM_API_URL: ''` to that env block (the m1-verify note says the same).

## Checked, no finding
- F-026 #1 (shape): `bars` is exactly N arrays of `{pitch, beats}` in the strict schema, ABC strings refused in TS (`phraseProblems`) and in
  pydantic (`_no_abc`); code writes units, ties and bar sums (`note_events`, `_problems`), rests are split not tied. Constants match today.
- F-026 #2/#5: `_problems` refuses any phrase bar where the Vocal has a note and names the free runs (`_free_runs` and TS `freeRuns` give the
  same `a-b` lists for the same bar map; the regex matches `bar_map`'s `| V:rest |` column); the instrument is appended after all ops, once.
- F-026 #4: gates run only after parse, compare, tempo, harmony and seam checks pass (SP-2's order); beat sums carry numbers. `phrase_gates`
  cannot raise on a missing key (`Voice.keys` starts with `(0, key)`, `abc_tools.py:173`). `seam_kept` handles `note is None`.
- `check_edit` compares the Vocal only when a phrase applied; Ins outside the window can change only through `_untie_into`, which
  `seam_kept` covers. Refused ops are excluded from `check_edit` by the route, so a refused phrase does not relax the other ops' checks.
- D-060: `refusals` gets one entry per failed attempt, so `attempt i+1 refused` indexes correctly; a pass on attempt n carries n-1 lines;
  `withLimits` only drops NO_CHANGE when an op was refused, `ok` is already false from yue-server in that case.
- F-027: `editConsequence` is the one place the clause is built; REPAINT, ADD LAYER, the stem claim row and DockCommit all use it; absent
  on `hidden`/`ineligible`, and the state reloads on any layer/version change (`scoreSongKey`) so the clause goes after the first repaint.
  The only gap is the first moment before the status loads (INITIAL is `hidden`); recorded by the verifier, not a finding.
- F-028: golden-path project ignores `score.spec.ts`; the score project has its own server, data dir, ports; fakes replay yue-server's
  recorded contracts, and an unrecorded body returns 500 naming it (no invented replies).
- Module sizes: every new code file is under 200 lines (largest `scoreCopy.ts` 140, `planJob.ts` 134).
- `phraseBarsOf` regexes: tried a long hyphen run after "4 bars" (n up to 40), no backtracking cost; a request over REQUEST_MAX (500) is refused
  before it. D-059's "a sax bit for 2 bars gets 4" is the recorded risk, not re-reported.
