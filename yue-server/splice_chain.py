"""The chained splice's pure parts (F-069, D-263/D-264). The server decides the
steps (`chat/spliceSteps.ts`: which ops, merges, the 2-4 limit, the order);
this module only checks the list it sends and maps bars, never re-plans.

Every step's span is in the base score's bars (plan ops are numbered on the
score as read, D-066 b), and the steps run last bar first, so a step never
moves the bars of a step still to come. A REHARMONIZE step splices from the
render of the full edited score, where every CUT or REPEAT section *before*
it (lower bars) has already removed or added its bars: its span in the
render is its base span shifted by those sections' lengths. The edited
score's bar count must be the base's plus the repeats minus the cuts, or the
render is not the plan's score and nothing is mapped.
"""
from __future__ import annotations

MIN_STEPS, MAX_STEPS = 2, 4
SHIFT = {"CUT": -1, "REPEAT": 1, "REHARMONIZE": 0}


class ChainError(ValueError):
    pass


def _kind(step: dict) -> str:
    return step["op"]["op"]


def validate(steps: list[dict]) -> None:
    """2-4 steps, last bar first, no two spans sharing a bar. `span` is 0-based [start, end)."""
    if not MIN_STEPS <= len(steps) <= MAX_STEPS:
        raise ChainError(f"a chain has {MIN_STEPS}-{MAX_STEPS} steps, not {len(steps)}")
    for k in range(1, len(steps)):
        (s0, e0), (s1, e1) = steps[k - 1]["span"], steps[k]["span"]
        if s1 >= s0:
            raise ChainError(f"steps must run last bar first: step {k + 1} (bar {s1 + 1}) "
                             f"does not start before step {k} (bar {s0 + 1})")
        if e1 > s0:
            raise ChainError(f"steps {k} and {k + 1} overlap (bars {s0 + 1}-{min(e0, e1)})")


def _shift_before(steps: list[dict], bar: int) -> int:
    """Bars added (+) or removed (-) in the edited score by section ops that end at or before `bar`."""
    return sum(SHIFT[_kind(st)] * (st["span"][1] - st["span"][0]) for st in steps if st["span"][1] <= bar)


def map_spans(steps: list[dict], n_base: int, n_edited: int) -> list[tuple[int, int] | None]:
    """Each REHARMONIZE step's span in the edited score's bars (0-based [start, end)); None for the others."""
    expected = n_base + _shift_before(steps, n_base)
    if expected != n_edited:
        raise ChainError(f"the edited score has {n_edited} bars, not the {expected} the steps make "
                         f"from the current version's {n_base}")
    mapped = []
    for st in steps:
        s, e = st["span"]
        if _kind(st) != "REHARMONIZE":
            mapped.append(None)
            continue
        shift = _shift_before(steps, s)
        mapped.append((s + shift, e + shift))
    return mapped


def fit_bars(mapped: list, k: int, n_edited: int) -> tuple[list[int], list[int]]:
    """The edited bars the render's grid is fitted on for step k, before and after its span:
    every bar outside every mapped span (an edit must not buy its own alignment)."""
    spans = [m for m in mapped if m is not None]
    outside = [b for b in range(n_edited) if not any(s <= b < e for s, e in spans)]
    s, e = mapped[k]
    return [b for b in outside if b < s], [b for b in outside if b >= e]
