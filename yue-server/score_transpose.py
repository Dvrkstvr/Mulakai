"""TRANSPOSE (F-029): every pitch of both voices moves by exactly n semitones
(-11..11 by the route's schema, 0 refused), every K: line (header, group,
inline [K:]) names the moved key, chord roots and slash basses follow. Old
pitches are replayed as upstream's parse_bar reads them (accidentals last to
the bar's end by letter, a [K:] resets them, a tie keeps its pitch across
the bar line); each new one is spelled in the new key: the key's own note
plain, else one accidental, flat or sharp as the old note was (else as the
key leans), marked only where the accidental in force for the letter is not
the one wanted (spell_bar's rule; spell_bar itself keeps every accidental
given, this writes the fewest). The new key is the one of upstream's 30
names (KEYS) on the moved tonic with the fewest accidentals (F# over Gb).
score_plan.py runs TRANSPOSE after every other op of the plan, so they are
written in the key the bar map shows; the style's "X minor" names the new key.
"""
from __future__ import annotations

import copy
import re

import scores  # noqa: F401  (puts the vendored upstream/ on sys.path)
from abc_tools import KEYS, NATURAL, PITCH_NAME, VOICES, key_accidentals
from score_bars import FULL_REST
from score_model import Doc, OpError
from score_roots import pitch_class

_ALTER = {"=": 0, "_": -1, "__": -2, "^": 1, "^^": 2}
_MARK = {1: "^", -1: "_", 0: "="}
_SIGN = {1: "#", -1: "b", 0: ""}
_CHORD = re.compile(f"({PITCH_NAME})(.*?)(?:/({PITCH_NAME}))?")
_ODD_ROOTS = {("C", -1), ("F", -1), ("E", 1), ("B", 1)}  # Cb Fb E# B#: not chord-root names
STYLE_KEY = re.compile(r"\b[A-G][#b]?\s+(?i:major|minor)\b")


def _tonic(key: str) -> int:
    return pitch_class(key.removesuffix("m"))


def new_key(key: str, n: int) -> str:
    """`key` moved n semitones, as one of upstream's 30 key names."""
    if key not in KEYS:
        raise OpError(f"the key {key} is not one of upstream's 30 key names, so it cannot be transposed")
    minor, tonic = key.endswith("m"), (_tonic(key) + n) % 12
    names = [k for k in KEYS if k.endswith("m") == minor and _tonic(k) == tonic]
    if not names:
        raise OpError(f"no key name for {key} moved {n:+d} semitones in upstream's 30 key names")
    return min(names, key=lambda k: (abs(KEYS[k]), KEYS[k] < 0))


def _sign(value: int) -> int:
    return (value > 0) - (value < 0)


def _spell(pc: int, key: str, hint: int, roots: bool = False) -> tuple[str, int]:
    """(letter, alteration) for pitch class `pc` in `key`: the key's own note,
    else a natural, else the accidental the old note had (`hint`), else the
    one the key leans to (sharps for C and Am)."""
    signature, lean = key_accidentals(key), hint or _sign(KEYS[key]) or 1
    options = [(letter, alt) for letter in NATURAL for alt in (-1, 0, 1)
               if (NATURAL[letter] + alt) % 12 == pc and not (roots and (letter, alt) in _ODD_ROOTS)]
    return min(options, key=lambda o: (o[1] != signature[o[0]], abs(o[1]), o[1] != lean))


def _note(pitch: int, key: str, hint: int) -> tuple[str, int, str, str]:
    """(letter, alteration, ABC letter, octave marks) for a MIDI pitch in `key`."""
    letter, alt = _spell(pitch % 12, key, hint)
    octave = (pitch - alt - 60 - NATURAL[letter]) // 12
    return (letter, alt) + ((letter, "," * -octave) if octave <= 0 else (letter.lower(), "'" * (octave - 1)))


def _chord(text: str, n: int, key: str) -> str:
    def move(name: str) -> str:
        letter, alt = _spell((pitch_class(name) + n) % 12, key, _sign(name.count("#") - name[1:].count("b")), True)
        return letter + _SIGN[alt]
    root, quality, bass = _CHORD.fullmatch(text).groups()
    return move(root) + quality + (f"/{move(bass)}" if bass else "")


class _Voice:
    """One voice's walk through the score: the old key and an open tie."""

    def __init__(self, key: str, n: int):
        self.key, self.n, self.tied = key, n, None

    def bar(self, events: list) -> None:
        """Rewrite one bar's events in place; `old` and `new` are the accidentals
        in force by letter (upstream's `local`), each reset at a [K:]."""
        old, new = {}, key_accidentals(new_key(self.key, self.n))
        for e in events:
            if e[0] == "key":
                self.key, e[1] = e[1], new_key(e[1], self.n)
                old, new = {}, key_accidentals(e[1])
            elif e[0] == "chord":
                e[1] = _chord(e[1], self.n, new_key(self.key, self.n))
            elif e[2] != "z":
                letter = e[2].upper()
                written = 60 + NATURAL[letter] + (12 if e[2].islower() else 0) + 12 * (e[3].count("'") - e[3].count(","))
                alt = _ALTER[e[1]] if e[1] else old.get(letter, key_accidentals(self.key)[letter])
                if e[1]:
                    old[letter] = alt
                was, hint = self.tied or (written + alt, _sign(alt))  # a tied note keeps its pitch and spelling
                pitch = was + self.n
                if not 0 <= pitch <= 127:
                    raise OpError(f"a note would move to MIDI pitch {pitch}, outside 0-127; transpose the other way")
                self.tied = (was, hint) if e[5] else None
                name, want, e[2], e[3] = _note(pitch, new_key(self.key, self.n), hint)
                e[1] = "" if new[name] == want else _MARK[want]
                new[name] = want


def transpose(doc: Doc, style: str, op: dict) -> str:
    """Move the whole score by op["semitones"]; the style is synced by apply_ops."""
    n = op["semitones"]
    if n == 0:
        raise OpError("semitones is 0, which changes nothing; give -11..-1 (down) or 1..11 (up)")
    start = doc.key
    for name in VOICES:
        walk = _Voice(start, n)
        for group in (g for section in doc.sections for g in section["groups"]):
            line = group[name]
            for i, field in enumerate(line["pre"]):
                if field.startswith("K:"):
                    walk.key, line["pre"][i] = field[2:], "K:" + new_key(field[2:], n)
            for events in line["bars"]:
                if events != FULL_REST:
                    walk.bar(events)
                    line["dirty"] = True
    doc.header[7] = "K:" + new_key(start, n)
    return style


def sync_style_key(style: str, key: str) -> str:
    """Every "X major" / "X minor" in the style names `key` (a K: name)."""
    name = f"{key[:-1]} minor" if key.endswith("m") else f"{key} major"
    return STYLE_KEY.sub(name, style)


def chord_class(text: str) -> tuple:
    """A chord symbol by pitch class (Db7 == C#7), for comparing chords."""
    root, quality, bass = _CHORD.fullmatch(text).groups()
    return pitch_class(root), quality, pitch_class(bass) if bass else None


def shifted(score, n: int):
    """Upstream's parsed `score` as a TRANSPOSE by n should leave it, for check_edit."""
    out = copy.deepcopy(score)
    for voice in out.voices.values():
        voice.notes = [[onset, pitch + n, length] for onset, pitch, length in voice.notes]
        voice.chords = [(onset, _chord(text, n, "C")) for onset, text in voice.chords]
        voice.keys = [(onset, new_key(key, n)) for onset, key in voice.keys]
    return out
