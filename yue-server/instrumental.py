"""Upstream's instrumental workflow (PLAN.md "YuE2: Align With Upstream's
`yue2-music` Skill", decision 1). YuE2 has no instrumental flag, and its
planner can write a vocal melody even for tags-only lyrics. So after planning,
every Vocal note moves to the Ins voice and the song is generated from that
score, with the score's own section tags as lyrics: nothing is left to sing.

The conversion is upstream's `convert_score`, vendored unmodified in
upstream/. If it can't run, the job keeps the unconverted plan (the old
behaviour) and the reason goes into result.json.
"""
from __future__ import annotations

import logging
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "upstream"))
from abc_tools import parse_abc  # noqa: E402  (vendored; needs the path above)
from instrumentalize import convert_score  # noqa: E402

log = logging.getLogger("yue-server")

TAG_LINE = re.compile(r"^\[[^\]\n]+\]$")


def is_instrumental(request: dict) -> bool:
    """Upstream's rule: lyrics that are only section tags. Empty lyrics don't
    count: the planner sings those wordlessly, which a caller may want."""
    if request.get("abc") or request.get("cot") == "off":
        return False
    lines = [line.strip() for line in request["lyrics"].splitlines() if line.strip()]
    return bool(lines) and all(TAG_LINE.match(line) for line in lines)


def section_tags(abc: str) -> str:
    """`% pre-chorus` → `[Pre-Chorus]`, as upstream's `lyric_tags` writes them."""
    labels = [line[2:] for line in abc.splitlines() if line.startswith("% ")]
    return "\n\n".join(f"[{label.title()}]" for label in labels) + ("\n" if labels else "")


def arrange(pipe, request: dict, plan, *, cancelled, on_token):
    """Returns (plan, request, record) to generate from. record is None when the
    request isn't an instrumental; `planned_abc` in it is the score before the move."""
    if not is_instrumental(request):
        return plan, request, None
    try:
        if plan.truncated or not plan.abc:
            raise ValueError("the planned score is empty or truncated")
        abc, check = convert_score(plan.abc)
        if not pipe.fits_plan_budget(abc):
            raise ValueError("the converted score is over the ABC planning budget")
    except (ValueError, KeyError, TypeError) as error:
        log.warning("instrumental conversion skipped: %s: %s", type(error).__name__, error)
        return plan, request, {"converted": False, "reason": f"{type(error).__name__}: {error}"}
    final = {**request, "abc": abc, "cot": "full" if parse_abc(abc).voices["Vocal"].chords else "melody",
             "lyrics": section_tags(abc) or request["lyrics"]}
    # An external score skips the planner, so this call only tokenizes it.
    converted = pipe.plan(final, cancelled=cancelled, on_token=on_token)
    record = {"converted": True, "vocal_notes_moved": check["vocal_notes_before"],
              "ins_notes_trimmed": len(check["affected_ins_notes"]), "planned_abc": plan.abc}
    return converted, final, record
