import struct
import threading

import pytest

from abc_tools import AbcError
from conftest import NATIVE
from score_midi import abc_file_to_midi, abc_to_midi


def read_varlen(data, i):
    value = 0
    while True:
        byte = data[i]
        i += 1
        value = (value << 7) | (byte & 0x7F)
        if not byte & 0x80:
            return value, i


def read_midi(data):
    """(format, ticks per quarter, [[(tick, message bytes)] per track])."""
    assert data[:4] == b"MThd"
    fmt, count, tpq = struct.unpack(">HHH", data[8:14])
    tracks, i = [], 14
    for _ in range(count):
        assert data[i:i + 4] == b"MTrk"
        (length,) = struct.unpack(">I", data[i + 4:i + 8])
        body, i, j, tick, events = data[i + 8:i + 8 + length], i + 8 + length, 0, 0, []
        while j < len(body):
            delta, j = read_varlen(body, j)
            tick += delta
            if body[j] == 0xFF:
                size, k = read_varlen(body, j + 2)
                events.append((tick, body[j:k + size]))
                j = k + size
            else:
                events.append((tick, body[j:j + 3]))
                j += 3
        tracks.append(events)
    return fmt, tpq, tracks


def notes(track, tpq):
    """(onset quarters, pitch, duration quarters) from note on/off pairs."""
    on, out = {}, []
    for tick, msg in track:
        if msg[0] & 0xF0 == 0x90:
            on[msg[1]] = tick
        elif msg[0] & 0xF0 == 0x80:
            start = on.pop(msg[1])
            out.append((start / tpq, msg[1], (tick - start) / tpq))
    return sorted(out)


def test_native_score_becomes_a_three_track_file_with_both_voices():
    fmt, tpq, tracks = read_midi(abc_to_midi(NATIVE))
    assert (fmt, len(tracks)) == (1, 3)
    conductor = [msg for _, msg in tracks[0]]
    assert bytes([0xFF, 0x51, 3]) + (60_000_000 // 88).to_bytes(3, "big") in conductor
    assert bytes([0xFF, 0x58, 4, 4, 2, 24, 8]) in conductor  # 4/4
    assert bytes([0xFF, 0x59, 2, 1, 0]) in conductor  # G major: one sharp
    # Ins, bar 1: G8 B8 d8 B8 at L:1/32 are quarter notes.
    assert [n for n in notes(tracks[2], tpq) if n[0] < 4] == [
        (0.0, 67, 1.0), (1.0, 71, 1.0), (2.0, 74, 1.0), (3.0, 71, 1.0)]
    # Vocal, bar 3: F16 in G is F#, then G16.
    assert [n for n in notes(tracks[1], tpq) if n[0] >= 8] == [(8.0, 66, 2.0), (10.0, 67, 2.0)]


def test_note_off_comes_before_a_note_on_at_the_same_tick():
    _, _, tracks = read_midi(abc_to_midi(NATIVE))
    at_one = [msg[0] & 0xF0 for tick, msg in tracks[2] if tick == 480 and msg[0] != 0xFF]
    assert at_one == [0x80, 0x90]


def test_a_rejected_score_raises_the_parser_error():
    with pytest.raises(AbcError):
        abc_to_midi("X:1\nK:C\n|C8|\n")


def test_file_conversion_writes_a_mid_next_to_the_abc(tmp_path):
    source = tmp_path / "song.abc"
    source.write_text(NATIVE, encoding="utf-8")
    target = abc_file_to_midi(source)
    assert target == tmp_path / "song.mid"
    assert target.read_bytes() == abc_to_midi(NATIVE)


def test_route_returns_the_midi_file(make_client):
    reply = make_client().post("/v1/scores/midi", json={"abc": NATIVE})
    assert reply.status_code == 200
    assert reply.headers["content-type"] == "audio/midi"
    assert reply.content == abc_to_midi(NATIVE)


def test_route_refuses_a_bad_score_with_the_parsers_reason(make_client):
    reply = make_client().post("/v1/scores/midi", json={"abc": "X:1\nK:C\n|C8|\n"})
    assert reply.status_code == 422
    assert reply.json()["detail"] == "Incomplete native two-voice ABC"


def test_route_needs_no_worker_but_does_need_the_token(make_client):
    loading = threading.Event()
    client = make_client(factory=lambda: loading.wait(5), api_key="secret")
    assert client.post("/v1/scores/midi", json={"abc": NATIVE}).status_code == 401
    reply = client.post("/v1/scores/midi", json={"abc": NATIVE}, headers={"Authorization": "Bearer secret"})
    loading.set()
    assert reply.status_code == 200
