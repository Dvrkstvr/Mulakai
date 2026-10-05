"""A plan's ops, run so every number means what /read showed the planner:
the bar ops (score_ops.py) first, in plan order; then REWRITE_LYRICS on the
lyrics as read; then REPEAT/CUT from the last section to the first
(score_sections.py), each lyric block following its section, and once any
of them applied, the tags rewritten from the edited score (score_lyrics.py,
R-018). Each op is tried on a copy and kept only when it applies; verdicts
come back in plan order, a section op's with a `note` (what its lyric block
did) and a REWRITE_LYRICS's with a `diff`. Lyrics are optional: the bar ops
pass them through as sent, and the ops that need them refuse without them.
"""
from __future__ import annotations

import copy

from score_check import check_edit
from score_lyrics import join_blocks, parse_blocks, retag, rewrite_lyrics
from score_model import Doc, OpError
from score_ops import apply_ops
from score_section_check import check_sections
from score_sections import SECTION_OPS, apply_section_op, labels, ordered, refusals

LATE_OPS = (*SECTION_OPS, "REWRITE_LYRICS")


def _verdict(index: int, op: dict) -> dict:
    return {"index": index, "op": op["op"], "ok": False, "reason": None}


def _rewrite(blocks, plan: list[tuple[int, dict]], verdicts: dict) -> bool:
    done: dict[int, int] = {}
    for index, op in plan:
        verdict = verdicts[index] = _verdict(index, op)
        try:
            if blocks is None:
                raise OpError("the request has no lyrics to rewrite")
            if op["block"] in done:
                raise OpError(f"block {op['block']} is already rewritten by op {done[op['block']]}")
            verdict["diff"] = rewrite_lyrics(blocks, op)
        except OpError as error:
            verdict["reason"] = str(error)
            continue
        verdict["ok"], done[op["block"]] = True, index
    return bool(done)


def apply_plan(abc: str, style: str, lyrics: str | None, ops: list[dict]) -> dict:
    """{abc, style, lyrics, verdicts, mid}; `mid` is the score after the bar ops."""
    plan = list(enumerate(ops, 1))
    early = [(i, op) for i, op in plan if op["op"] not in LATE_OPS]
    out = apply_ops(abc, style, [op for _, op in early])
    verdicts = {}
    for (index, _), verdict in zip(early, out["verdicts"]):
        verdicts[index] = {**verdict, "index": index}
    blocks = parse_blocks(lyrics) if lyrics is not None else None
    touched = _rewrite(blocks, [(i, op) for i, op in plan if op["op"] == "REWRITE_LYRICS"], verdicts)
    doc, moved = Doc(out["abc"]), False
    sections = [(i, op) for i, op in plan if op["op"] in SECTION_OPS]
    refused = refusals(doc, sections)
    for index, op in sections:
        verdicts[index] = _verdict(index, op)
        if blocks is None:
            refused[index] = f"the request has no lyrics; {op['op']} moves them with the score, so send them (\"\" for none)"
        verdicts[index]["reason"] = refused.get(index)
    for index, op in ordered([(i, op) for i, op in sections if i not in refused]):
        trial, trial_blocks = copy.deepcopy(doc), copy.deepcopy(blocks)
        try:
            verdicts[index]["note"] = apply_section_op(trial, trial_blocks, op)
        except OpError as error:
            verdicts[index]["reason"] = str(error)
            continue
        doc, blocks, moved, verdicts[index]["ok"] = trial, trial_blocks, True, True
    if moved:
        retag(blocks, labels(doc))
    return {"abc": doc.text() if moved else out["abc"], "style": out["style"],
            "lyrics": join_blocks(blocks) if touched or moved else lyrics,
            "verdicts": [verdicts[i] for i in sorted(verdicts)], "mid": out["abc"]}


def check_plan(abc: str, out: dict, ops: list[dict]) -> dict:
    """{ok, problems, differences}: the bar ops' checks (score_check.py) on
    the score they left, then the section ops' (score_section_check.py)."""
    applied = [op for op, verdict in zip(ops, out["verdicts"]) if verdict["ok"]]
    bars = check_edit(abc, out["mid"], [op for op in applied if op["op"] not in LATE_OPS])
    moved = check_sections(out["mid"], out["abc"], [op for op in applied if op["op"] in SECTION_OPS])
    return {"ok": bars["ok"] and moved["ok"], "problems": bars["problems"] + moved["problems"],
            "differences": bars["differences"]}
