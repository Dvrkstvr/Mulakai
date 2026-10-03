"""A native YuE2 score that upstream's parse_abc has already accepted, held as
header, `% section` blocks, two-voice groups and bars of events
(score_bars.py), so the score ops (score_ops.py) can edit single bars. Music
lines no op touched are written back exactly as read, so an edit changes only
the lines it must. Bars are numbered 1..N over the whole song, per voice, as
upstream counts them.
"""
from __future__ import annotations

import re
from fractions import Fraction

import scores  # noqa: F401  (puts the vendored upstream/ on sys.path)
from abc_tools import VOICES
from score_bars import FULL_REST, decompose, emit_line, parse_bar


class OpError(ValueError):
    """An op that cannot be applied; the message goes back to the planner as is."""


class Doc:
    def __init__(self, text: str):
        self.newline = "\r\n" if "\r\n" in text else "\n"
        self.final_newline = text.endswith("\n")
        lines = text.splitlines()
        self.header = lines[:8]
        self.unit = int(self.header[3].split("/")[1])
        self.sections: list[dict] = []
        meter = {name: self._meter(self.header[2]) for name in VOICES}
        cursor = 8
        while cursor < len(lines):
            if lines[cursor].startswith("% "):
                self.sections.append({"line": lines[cursor], "label": lines[cursor][2:].strip(), "groups": []})
                cursor += 1
                continue
            if not self.sections:
                self.sections.append({"line": None, "label": "untitled", "groups": []})
            group = {}
            for name in VOICES:
                cursor += 1  # the V: line
                pre = []
                while lines[cursor].startswith(("M:", "K:")):
                    pre.append(lines[cursor])
                    if lines[cursor].startswith("M:"):
                        meter[name] = self._meter(lines[cursor])
                    cursor += 1
                raw = lines[cursor]
                bars = []
                for body in raw[:-1].split("|"):
                    rest = re.fullmatch(r"Z([2-4])?", body.strip())
                    bars += [[["Z"]] for _ in range(int(rest.group(1) or 1))] if rest else [parse_bar(body.strip())]
                group[name] = {"pre": pre, "raw": raw, "bars": bars, "dirty": False}
                cursor += 1
            group["meter"] = meter["Vocal"]
            self.sections[-1]["groups"].append(group)

    @staticmethod
    def _meter(line: str) -> tuple[int, int]:
        n, d = line[2:].split("/")
        return int(n), int(d)

    def text(self) -> str:
        out = list(self.header)
        for section in self.sections:
            out += [section["line"]] if section["line"] is not None else []
            for group in section["groups"]:
                for name in VOICES:
                    line = group[name]
                    out += [f"V: {name}", *line["pre"], emit_line(line["bars"]) if line["dirty"] else line["raw"]]
        return self.newline.join(out) + (self.newline if self.final_newline else "")

    @property
    def bpm(self) -> int:
        return int(self.header[4].split("=")[1])

    def set_bpm(self, bpm: int) -> None:
        self.header[4] = f"Q:1/4={bpm}"

    @property
    def key(self) -> str:
        return self.header[7][2:]

    def _refs(self) -> list[tuple[int, dict, int]]:
        return [(si, g, k) for si, s in enumerate(self.sections) for g in s["groups"]
                for k in range(len(g["Vocal"]["bars"]))]

    def nbars(self) -> int:
        return len(self._refs())

    def _ref(self, n: int) -> tuple[int, dict, int]:
        refs = self._refs()
        if not 1 <= n <= len(refs):
            raise OpError(f"bar {n} does not exist (the score has {len(refs)} bars)")
        return refs[n - 1]

    def bar(self, n: int, voice: str) -> list:
        _, group, k = self._ref(n)
        return group[voice]["bars"][k]

    def edit(self, n: int, voice: str) -> list:
        """The bar's events to change in place; a full-bar rest becomes plain rests."""
        _, group, k = self._ref(n)
        group[voice]["dirty"] = True
        events = group[voice]["bars"][k]
        if events == FULL_REST:
            events[:] = [["note", "", "z", "", u, "", str(u)] for u in decompose(self.units_per_bar(n))]
        return events

    def meter(self, n: int) -> tuple[int, int]:
        return self._ref(n)[1]["meter"]

    def units_per_bar(self, n: int) -> int:
        a, b = self.meter(n)
        return int(Fraction(a * self.unit, b))

    def units_per_quarter(self) -> Fraction:
        return Fraction(self.unit, 4)

    def section_ranges(self) -> list[tuple[int, str, int, int]]:
        """(section number, label, first bar, last bar) for each section with bars."""
        out, first = [], 1
        for index, section in enumerate(self.sections, 1):
            count = sum(len(g["Vocal"]["bars"]) for g in section["groups"])
            if count:
                out.append((index, section["label"], first, first + count - 1))
            first += count
        return out
