"""D-055: a REHARMONIZE changes the harmony, not only the chord colour. The
M0 A/B heard the chord edit only 2 of 4 times because every plan kept every
old root and added 7ths or slash basses. So in every 2-bar window of the op
(a last odd bar is its own window) at least one new chord's root must differ
from the old chord sounding at that bar and beat. The old chord is the last
symbol at or before that point, carried across bars without one; roots
compare by pitch class (Db == C#). A range with no old chord sounding is not
checked. The refusal gives the planner numbers, as SP-2 found retries need.
"""
from __future__ import annotations

import re
from fractions import Fraction

from score_bars import chord_offsets
from score_model import Doc

ROOT = re.compile(r"[A-G](?:bb|##|b|#)?")
NATURAL = dict(zip("CDEFGAB", (0, 2, 4, 5, 7, 9, 11)))


def pitch_class(root: str) -> int:
    return (NATURAL[root[0]] + root.count("#") - root[1:].count("b")) % 12


def same_root(a: str, b: str) -> bool:
    return pitch_class(a) == pitch_class(b)


def _old_chords(doc: Doc) -> list[tuple[int, Fraction, str]]:
    """(bar, beat, root) of every Vocal chord symbol in score order."""
    per_quarter = doc.units_per_quarter()
    return [(n, offset / per_quarter + 1, ROOT.match(text).group())
            for n in range(1, doc.nbars() + 1) for offset, text in chord_offsets(doc.bar(n, "Vocal"))]


def _sounding(old: list[tuple[int, Fraction, str]], bar: int, beat: int) -> str | None:
    roots = [root for b, t, root in old if (b, t) <= (bar, beat)]
    return roots[-1] if roots else None


def _window_text(first: int, last: int) -> str:
    return f"{first}-{last}" if last > first else f"{first}"


def kept_roots(doc: Doc, op: dict) -> str | None:
    """The refusal for a REHARMONIZE `op` on the score `doc` (before the edit)
    that keeps every old root in some 2-bar window, else None."""
    first, last = op["from_bar"], op["to_bar"]
    old = _old_chords(doc)
    by_bar: dict[int, list[bool]] = {}  # bar -> one "kept the old root" per new chord
    for chord in op["chords"]:
        before = _sounding(old, chord["bar"], chord["beat"])
        by_bar.setdefault(chord["bar"], []).append(before is not None and same_root(before, chord["root"]))
    if not any(_sounding(old, c["bar"], c["beat"]) for c in op["chords"]):
        return None
    kept = [n for n in range(first, last + 1) if by_bar.get(n) and all(by_bar[n])]
    windows = [(a, min(a + 1, last)) for a in range(first, last + 1, 2)]
    still = [w for w in windows if all(n in kept for n in range(w[0], w[1] + 1))]
    if not still:
        return None
    named = ", ".join(_window_text(*w) for w in still)
    where = f"bar {named} keeps" if len(still) == 1 and still[0][0] == still[0][1] else f"bars {named} keep"
    return (f"REHARMONIZE {first}-{last} keeps the old root in {len(kept)} of {last - first + 1} bars; "
            f"change the root in at least one chord per 2 bars ({where} every root; "
            "a 7th or a slash bass on the same root does not count)")
