"""REPEAT and CUT (F-030): whole `% label` sections of a native score, in
every voice.

A section is addressed as /read shows it, by `facts.sections[].index` (the
bar map's `S<n>`), with its label as a cross-check; numbers always mean the
score as read. A plan's section ops run after its bar ops, from the last
section to the first, so no op moves another's number (score_plan.py).

REPEAT copies the section literally right after itself, `% label` comment
included (upstream's helper rejects repeat signs); CUT removes the section
and its comment. The seam is un-tied (f3e3bfdc): a repeated section ends
un-tied, original and copy alike, and so does the section before a cut. A
meter or key the section changes is restated where the music after the seam
would otherwise read it differently (3820c535's intro goes from 2/4 to 4/4).
"""
from __future__ import annotations

import copy
from fractions import Fraction

import scores  # noqa: F401  (puts the vendored upstream/ on sys.path)
from abc_tools import VOICES
from score_lyrics import follow
from score_model import Doc, OpError

SECTION_OPS = ("REPEAT", "CUT")


def labels(doc: Doc) -> list[str | None]:
    return [s["label"] if s["line"] is not None else None for s in doc.sections]


def _target(doc: Doc, op: dict) -> int:
    n, count = op["section"], len(doc.sections)
    listing = ", ".join(f"{i} {label}" for i, label, _, _ in doc.section_ranges())
    if not 1 <= n <= count:
        raise OpError(f"section {n} does not exist (sections: {listing})")
    section, asked = doc.sections[n - 1], op["label"].strip().strip("[]:").strip().lower()
    if section["line"] is None:
        raise OpError(f"section {n} has no '% label' comment; only labelled sections can be repeated or cut")
    if asked != section["label"].lower():
        same = [str(i) for i, label, _, _ in doc.section_ranges() if label.lower() == asked]
        where = (f"{asked} is section{'s' if len(same) > 1 else ''} {', '.join(same)}" if same
                 else f"there is no {asked} section ({listing})")
        raise OpError(f"section {n} is {section['label']}, not {asked}; {where}")
    if not section["groups"]:
        raise OpError(f"section {n} has no bars")
    return n - 1


def refusals(doc: Doc, ops: list[tuple[int, dict]]) -> dict[int, str]:
    """{op index: reason} for the section ops, checked in plan order on the score as read."""
    out, done = {}, {}
    alive = {i for i, s in enumerate(doc.sections) if s["groups"]}
    for index, op in ops:
        try:
            at = _target(doc, op)
            kind, by = done.get(at, (None, None))
            if kind == "CUT" or (kind and op["op"] == "CUT"):
                raise OpError(f"section {at + 1} is already {'cut' if kind == 'CUT' else 'repeated'} by op {by}; "
                              "a plan either repeats a section or cuts it")
            if op["op"] == "CUT" and alive == {at}:
                raise OpError(f"cutting section {at + 1} would leave no music; keep at least one section")
        except OpError as error:
            out[index] = str(error)
            continue
        done[at] = (op["op"], index)
        if op["op"] == "CUT":
            alive.discard(at)
    return out


def ordered(ops: list) -> list:
    """Section ops (or (index, op) pairs) from the last section to the first."""
    return sorted(ops, key=lambda item: -(item[1] if isinstance(item, tuple) else item)["section"])


def layout(count: int, ops: list[dict]) -> list[int]:
    """The read score's section positions in the edited score's order."""
    order = list(range(count))
    for op in ordered(ops):
        at = op["section"] - 1
        if op["op"] == "REPEAT":
            order.insert(at + 1, order[at])
        else:
            del order[at]
    return order


def _state(doc: Doc, upto: int) -> dict:
    """{voice: {"M": meter, "K": key}} in force where section `upto` starts."""
    state = {name: {"M": doc.header[2][2:], "K": doc.key} for name in VOICES}
    for section in doc.sections[:upto]:
        for group in section["groups"]:
            for name in VOICES:
                for line in group[name]["pre"]:
                    state[name][line[0]] = line[2:]
                for events in group[name]["bars"]:
                    state[name]["K"] = next((e[1] for e in reversed(events) if e[0] == "key"), state[name]["K"])
    return state


def _restate(group: dict, want: dict, have: dict) -> None:
    for name in VOICES:
        pre = group[name]["pre"]
        for field in ("M", "K"):
            if want[name][field] != have[name][field] and not any(p.startswith(field + ":") for p in pre):
                pre.insert(0 if field == "M" else len(pre), f"{field}:{want[name][field]}")


def _untie(section: dict) -> None:
    group = section["groups"][-1]
    for name in VOICES:
        notes = [e for e in group[name]["bars"][-1] if e[0] == "note"]
        if notes and notes[-1][5] == "-":
            notes[-1][5] = ""
            group[name]["dirty"] = True


def apply_section_op(doc: Doc, blocks: list[dict], op: dict) -> str:
    """REPEAT or CUT section op["section"] of `doc` (already checked by
    `refusals`), its lyric block following; returns the op's note."""
    at = op["section"] - 1
    start, end = _state(doc, at), _state(doc, at + 1)
    note = follow(blocks, labels(doc), at, op["op"])
    if op["op"] == "REPEAT":
        _untie(doc.sections[at])
        twin = copy.deepcopy(doc.sections[at])
        _restate(twin["groups"][0], start, end)
        doc.sections.insert(at + 1, twin)
        return note
    del doc.sections[at]
    before = next((s for s in reversed(doc.sections[:at]) if s["groups"]), None)
    after = next((s for s in doc.sections[at:] if s["groups"]), None)
    if before:
        _untie(before)
    if after:
        _restate(after["groups"][0], end, start)
    return note


def section_seconds(abc: str) -> list[dict]:
    """{index, label, from_bar, to_bar, seconds} per section with bars, as YuE2 plays them."""
    doc = Doc(abc)
    quarters = [Fraction(doc.units_per_bar(n)) / doc.units_per_quarter() for n in range(1, doc.nbars() + 1)]
    return [{"index": i, "label": label, "from_bar": a, "to_bar": b,
             "seconds": round(float(sum(quarters[a - 1:b]) * 60 / doc.bpm), 1)}
            for i, label, a, b in doc.section_ranges()]
