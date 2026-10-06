"""ABC score -> Standard MIDI File (type 1), standard library only.

Reads the native two-voice YuE2 dialect through upstream's `parse_abc`, so a
score that the score agent accepts converts, and anything else fails with the
same `AbcError` (decision 0002: only yue-server reads ABC). Track 0 carries
tempo, meter and key changes; Vocal and Ins get a track and a channel each.
Chord symbols are not rendered: they are labels, not sounding notes.
"""
from __future__ import annotations

import math
import struct
import sys
from fractions import Fraction
from pathlib import Path

UPSTREAM = str(Path(__file__).parent / "upstream")
if UPSTREAM not in sys.path:
    sys.path.insert(0, UPSTREAM)
from abc_tools import KEYS, VOICES, parse_abc  # noqa: E402  (vendored; needs the path above)

BASE_TICKS = 480
MAX_TICKS = 0x7FFF  # the SMF header's ticks-per-quarter is 15 bits
VELOCITY = 90


def _varlen(value: int) -> bytes:
    out = [value & 0x7F]
    value >>= 7
    while value:
        out.append(0x80 | (value & 0x7F))
        value >>= 7
    return bytes(reversed(out))


def _track(events: list[tuple[int, int, bytes]]) -> bytes:
    """(tick, order, message) -> an MTrk chunk; lower order first on a tie."""
    body = bytearray()
    now = 0
    for tick, _, message in sorted(events, key=lambda e: (e[0], e[1])):
        body += _varlen(tick - now) + message
        now = tick
    body += b"\x00\xff\x2f\x00"  # end of track
    return b"MTrk" + struct.pack(">I", len(body)) + bytes(body)


def _meta(kind: int, data: bytes) -> bytes:
    return bytes([0xFF, kind]) + _varlen(len(data)) + data


def _name(text: str) -> bytes:
    return _meta(0x03, text.encode())


def _ticks_per_quarter(times: list[Fraction]) -> int:
    """The smallest multiple of 480 that puts every onset on a whole tick."""
    tpq = BASE_TICKS
    for t in times:
        tpq = tpq * t.denominator // math.gcd(tpq, t.denominator)
    if tpq > MAX_TICKS:
        raise ValueError(f"score is too finely divided for MIDI ({tpq} ticks per quarter)")
    return tpq


def _conductor(score, tick) -> bytes:
    voice = score.voices[VOICES[0]]
    events = [(0, 0, _name("Conductor")),
              (0, 1, _meta(0x51, (60_000_000 // score.bpm).to_bytes(3, "big")))]
    meter = None
    for start, _, bar_meter in voice.bars:
        if bar_meter != meter:
            n, d = bar_meter
            events.append((tick(start), 2, _meta(0x58, bytes([n, d.bit_length() - 1, 24, 8]))))
            meter = bar_meter
    key = None
    for start, name in voice.keys:
        if name != key:
            sharps = KEYS[name]
            minor = 1 if name.endswith("m") else 0
            events.append((tick(start), 3, _meta(0x59, struct.pack(">bB", sharps, minor))))
            key = name
    return _track(events)


def _voice_track(name: str, channel: int, notes, tick) -> bytes:
    events = [(0, 0, _name(name))]
    for onset, pitch, duration in notes:
        events.append((tick(onset), 2, bytes([0x90 | channel, pitch, VELOCITY])))
        events.append((tick(onset + duration), 1, bytes([0x80 | channel, pitch, 0])))
    return _track(events)


def abc_to_midi(abc: str) -> bytes:
    """Convert a native two-voice ABC score to SMF bytes. Raises `AbcError`
    for a score the parser rejects."""
    score = parse_abc(abc)
    times = [t for v in score.voices.values() for onset, _, dur in v.notes for t in (onset, dur)]
    tpq = _ticks_per_quarter(times)

    def tick(quarters: Fraction) -> int:
        return int(quarters * tpq)

    tracks = [_conductor(score, tick)]
    tracks += [_voice_track(name, channel, score.voices[name].notes, tick)
               for channel, name in enumerate(VOICES)]
    header = b"MThd" + struct.pack(">IHHH", 6, 1, len(tracks), tpq)
    return header + b"".join(tracks)


def abc_file_to_midi(source: str | Path, target: str | Path | None = None) -> Path:
    """Write `source`.abc as a .mid next to it (or at `target`); return the path."""
    source = Path(source)
    target = Path(target) if target else source.with_suffix(".mid")
    target.write_bytes(abc_to_midi(source.read_text(encoding="utf-8")))
    return target


if __name__ == "__main__":
    for arg in sys.argv[1:]:
        print(abc_file_to_midi(arg))
