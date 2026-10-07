"""POST /v1/scores/bars (chat C1, D-174): a score's bar start times on a take's
downbeat grid, through the splice's own fit (splice_grid.fit), so the chat's
strip and the splice cannot disagree on where a bar starts. CPU only. Records
the scores-bars-* contract fixtures the server's fake yue replays (D-039)."""
from pathlib import Path

import pytest

from conftest import FakePipeline
from contract import check_contract
from score_bar_times import audio_starts
from splice_fixtures import CHORDS, grid, score
from scores import strip_chords
from splice_grid import Fit, fit, read_grid

PATH = "/v1/scores/bars"
SPLICE = Path(__file__).parent / "data" / "splice"
EIGHT = score(8, 120, sections=[("verse", 0), ("chorus", 4)])

CONTRACT = [
    ("scores-bars-ok", {"abc": EIGHT, "grid": grid(8, 0.5, lead=0.3)}),
    # the tracker heard a one-bar count-in: score bar 1 is the audio's second downbeat
    ("scores-bars-pickup", {"abc": EIGHT, "grid": grid(9, 0.5, lead=0.3, chord_of=lambda i: (
        "N" if i == 0 else ["C:maj", "A:min", "F:maj", "G:maj"][(i - 1) % 4]))}),
    ("scores-bars-bad-grid", {"abc": EIGHT, "grid": {"grid_v": 1, "downbeats": [2.0, 1.0], "chords": [],
                                                     "duration": 3.0}}),
    ("scores-bars-bad-score", {"abc": "X:1\nK:C\n|C8|\n", "grid": grid(8, 0.5)}),
]


@pytest.mark.parametrize("name,body", CONTRACT, ids=[c[0] for c in CONTRACT])
def test_contract_replies(name, body, make_client, record_contract):
    reply = make_client().post(PATH, json=body)
    assert reply.status_code == (422 if "bad" in name else 200)
    check_contract(record_contract, name, PATH, body, reply)


def test_bar_starts_are_the_grids_downbeats_with_the_song_end(make_client):
    reply = make_client().post(PATH, json={"abc": EIGHT, "grid": grid(8, 0.5, lead=0.3, duration=17.0)})
    assert reply.status_code == 200
    body = reply.json()
    assert body == {"offset": 0, "starts": [0.3, 2.3, 4.3, 6.3, 8.3, 10.3, 12.3, 14.3], "end": 17.0,
                    "agreement": 1.0, "bars": 8}


def test_a_count_in_shifts_the_bars_by_the_fitted_offset(make_client):
    body = make_client().post(PATH, json=CONTRACT[1][1]).json()
    assert body["offset"] == 1 and body["bars"] == 8
    assert body["starts"][0] == 2.3 and body["starts"][-1] == 16.3


@pytest.mark.parametrize("take", ["A_orig", "C_b"])
def test_a_recorded_take_gets_the_splices_own_bar_times(take, make_client):
    abc = (SPLICE / take / "score.abc").read_text(encoding="utf-8")
    g = read_grid(SPLICE / take)
    body = make_client().post(PATH, json={"abc": abc, "grid": g}).json()
    f = fit(g, abc)
    assert body["bars"] == f.bars and body["offset"] == f.offset
    assert body["starts"] == [round(f.t(i), 4) for i in range(f.bars)]
    assert body["end"] == round(f.t(f.bars), 4)
    assert body["agreement"] == pytest.approx(f.root, abs=1e-4)


def test_a_grid_with_no_chords_heard_agrees_nowhere(make_client):
    body = make_client().post(PATH, json={"abc": EIGHT, "grid": grid(8, 0.5, chord_of=lambda i: "N")}).json()
    assert body["agreement"] == 0.0 and body["offset"] == 0 and len(body["starts"]) == 8


def test_a_score_with_no_chords_has_null_agreement_not_nan(make_client):
    body = make_client().post(PATH, json={"abc": strip_chords(EIGHT), "grid": grid(8, 0.5)}).json()
    assert body["agreement"] is None and body["offset"] == 0 and len(body["starts"]) == 8


@pytest.mark.parametrize("change", [
    lambda b: b.pop("grid"),
    lambda b: b.update(abc=""),
    lambda b: b.update(extra=1),
    lambda b: b["grid"].update(grid_v=2),
    lambda b: b["grid"].pop("duration"),
])
def test_a_malformed_request_is_422(change, make_client):
    body = {"abc": EIGHT, "grid": grid(8, 0.5)}
    change(body)
    assert make_client().post(PATH, json=body).status_code == 422


def test_bars_needs_the_bearer_token(make_client):
    client = make_client(api_key="secret")
    body = {"abc": EIGHT, "grid": grid(8, 0.5)}
    assert client.post(PATH, json=body).status_code == 401
    assert client.post(PATH, json=body, headers={"Authorization": "Bearer secret"}).status_code == 200


def test_bars_never_touches_the_gpu_path(make_client):
    pipe = FakePipeline()
    make_client(pipe).post(PATH, json={"abc": EIGHT, "grid": grid(8, 0.5)})
    assert pipe.requests == []


# Q-120 (CP-C1, eventide and Acid Houzzzz): the fit's offset may put score bar 1 before the first downbeat, and a
# score may have more bars than the audio. Recorded on eventide: offset -1, bars 1 and 2 both at 1.85 s, bars 43-80
# all at the song's end (147.0), so the server rejected the whole reply. This grid has eventide's shape: 41 downbeats
# from 1.85 s, every 3.45 s, under an 80-bar score, its chords one bar late (offset -1).
EVENTIDE_SCORE = score(80, 120)
EVENTIDE_GRID = grid(41, 3.45 / 4, lead=1.85, duration=147.0, chord_of=lambda i: CHORDS[(i + 1) % 4][1])


def test_eventide_bar_starts_strictly_increase_and_stop_at_the_audio(make_client):
    body = make_client().post(PATH, json={"abc": EVENTIDE_SCORE, "grid": EVENTIDE_GRID}).json()
    starts = body["starts"]
    assert body["offset"] == -1 and body["bars"] == 80 and body["end"] == 147.0
    assert all(b > a for a, b in zip(starts, starts[1:])) and starts[-1] < body["end"]
    # bar 1 is the audio's first seconds (a bar back from the first downbeat, clamped at 0); bar 2 the first downbeat
    assert starts[:3] == [0.0, 1.85, 5.3]
    # bars 43-80 lie past the last downbeat: not in the audio, so not timed (the splice puts them at the end too)
    assert len(starts) == 42 and starts[-1] == EVENTIDE_GRID["downbeats"][-1]


def test_bars_before_the_audio_share_its_first_seconds(make_client):
    # offset -2 on a take whose first downbeat is at 1.0 s: bars 1 and 2 would both start before 0
    g = grid(10, 0.5, lead=1.0, chord_of=lambda i: CHORDS[(i + 2) % 4][1])
    body = make_client().post(PATH, json={"abc": score(8, 120), "grid": g}).json()
    assert body["offset"] == -2
    assert body["starts"][:3] == [0.0, 0.5, 1.0]
    assert all(b > a for a, b in zip(body["starts"], body["starts"][1:]))


def test_in_range_bar_starts_are_the_fits_own():
    f = fit(EVENTIDE_GRID, EVENTIDE_SCORE)
    starts, end = audio_starts(f)
    assert starts[1:] == [round(f.t(i), 4) for i in range(1, 42)] and end == round(f.t(f.bars), 4)


def test_no_bar_in_the_audio_times_nothing():
    assert audio_starts(Fit([0.0, 2.0], 2.5, 4, False, float("nan"), 1, 0.5)) == ([], 2.5)
