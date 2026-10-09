# C4 code review (lens: code) - origin/feat/chat-c4-splice-card vs f3def80

Scope read: spliceSteps/spliceEligibility/spliceSpec/spliceRenderJob/rerenderWhole/versionCard/scoreVersion/barShift (server), splice_chain/_job/_spec/_result/_check/_fit (yue), chatSpliceCopy/chatEditCopy/ChatEditCard/ChatVersionCard/chatRerender (client). Seen in code only; nothing run.

## blocking
none found.

## should
1. yue-server/splice_fit.py:32-38 (R-044, D-277) - a side with fewer than MIN_LEAD (2) fit bars can no longer report its own offset. Input: REHARMONIZE bars 1..N-1 of an N-bar song (post side = the last bar only), and the take sang the span one bar long (post offset = pre offset + 1). Before #282 the post side kept +1, so the 0.25 s length rule sent the plan to a whole-song render. Now post lead is 1 (<2), so it adopts the whole fit, pre and post offsets agree, the span is cut one bar short in the render, and the join lands mid-phrase; only the onset-correlation check (corr >= 0.15) stands between that and a saved seam. Same for a 1-bar pre side. Narrow (spans touching the first/last bar by all but 1 bar) but it is the drift case the split fit exists for. Fix: when a side has under MIN_LEAD bars to judge, keep the larger of the two offsets only if the side is also fit on >= MIN_LEAD bars, else return rerender("no_grid"/"length") instead of silently adopting the other side's offset.

## nit
2. yue-server/splice_result.py:87-92 (chain_ok) - the record's `null_test` is the sum of each step's test against its own input, not the saved file against the original base that F-069 #2 states. The right check exists (splice_check.compose/check_chain, used by CP-C4) but the stored `splice_v: 2` null_test can read 0 while a later step corrupted an earlier step's kept region. Low risk (steps touch disjoint spans, 2 bars apart); note it in the version record doc or compose it in-job.
3. server/src/services/chat/spliceEligibility.ts:35 - empty-plan reason is "the plan makes 0 changes; only a single change can be spliced into the old take"; D-271 (c) records "the plan makes no changes to splice". The "single change" half is now false (2-4 chain). Reword.
4. server/src/services/score/scoreVersion.ts spliceSuffix - one-bar span prints "bars 43-43" (known; client barsOf already says "bar 43").

## checked, no defect
- spliceSteps vs yue splice_chain.validate: server emits strictly descending starts, no shared bar (CUT/REPEAT within 2 bars of anything is refused; touching/overlapping REHARMONIZE merged), so yue's 422s are unreachable from a valid card. Count 2-4 after merge matches both sides.
- Bar mapping: map_spans shifts a REHARMONIZE span by CUTs/REPEATs ending at or before its start (REHARMONIZE shift 0); no section op can sit inside a merged span, so pre/post shifts are equal and the `offset + ms - s` rebase is consistent for both fits. Expected edited bar count is checked before mapping.
- Partial save: one yue job, audio written only after all steps, null-tested in memory; any non-ok step -> chain_rerender, no WAV. APPLY saves once; fallback saves the whole render (reuses the chain's render when there was one). Cancel checked in steps.enter between steps and before "checking"; every exit cancels the yue job.
- Older readers of splice_v 2: versionCard (fallback null, unknown shapes "Saved as vN."), spliceSuffix, barShift (>1 CUT/REPEAT -> UNKNOWN; one CUT + REHARMONIZE falls back to base sections, correct) all tolerate it. rerenderWhole's `spliced()` treats v2 as spliced.
- rerenderWhole: ABC passes through unread (invariant holds); checkRender has no NO_CHANGE check so the no-op plan applies; ops [] -> barShift KEPT (score unchanged), correct.
- Client copy: every kind goes through KINDS/VERB/DID_* maps keyed by the three kinds; kindOf falls back so no "undefined" reaches versionMeta/consequence/strip; splicing stage regex falls back to "N SPANS" text. stripTotal sums every cut/repeat. shiftFoot REPEAT now says "after bar <last>" (old code said from-1, which was wrong).
