import base64
import shutil

import pytest

from conftest import FakePipeline
from retime_fit import fit_midi
from retime_fixtures import beats_text, bundle, make_sheetsage, melody_midi
from test_transcription import sheetsage as transcription_snapshot  # noqa: F401  (fixture)
from test_transcription import transcribe, wait_done

pytest.importorskip("pretty_midi")


@pytest.fixture
def retime_client(make_client, tmp_path):
    pipe = FakePipeline()
    client = make_client(pipe, **make_sheetsage(tmp_path))
    client.pipe = pipe
    return client


def post(client, **body):
    return client.post("/v1/scores/retime", json={"files": bundle(), **body})


def test_half_time_halves_the_bars_and_the_tempo_and_counts_dropped_notes(retime_client):
    response = post(retime_client, mode="half")
    assert response.status_code == 200, response.text
    out = response.json()
    assert (out["measures"], out["bpm"], out["read_bpm"]) == (4, 60, 120)
    assert out["notes"] == 256 and out["dropped_notes"] > 0  # 16ths do not fit a 4-per-beat grid at half time
    assert out["warnings"] == ["fake: built"] and out["abc"].startswith("X:1")
    assert retime_client.pipe.requests == []  # CPU only: never the pipeline


def test_double_time_keeps_every_note(retime_client):
    out = post(retime_client, mode="double").json()
    assert (out["measures"], out["bpm"], out["dropped_notes"]) == (16, 240, 0)


def test_a_named_bpm_lays_a_grid_and_keeps_chords_when_asked(retime_client):
    out = post(retime_client, mode="bpm", bpm=90, melody_only=False).json()
    assert out["bpm"] == 90 and '"Am"' in out["abc"]


@pytest.mark.parametrize("body, downbeats", [
    ({"mode": "half"}, [0.0, 4.0, 8.0, 12.0, 16.0]),
    ({"mode": "double"}, [float(t) for t in range(17)]),
    ({"mode": "bpm", "bpm": 60}, [0.0, 4.0, 8.0, 12.0, 16.0]),
])
def test_the_rebuild_names_the_new_downbeats_for_the_bar_times(retime_client, body, downbeats):
    """RT-5 (F-092): a chat reading's bar times are fitted on these, the re-timed grid, not the tracker's."""
    assert post(retime_client, **body).json()["downbeats"] == downbeats


@pytest.mark.parametrize("body, code", [
    ({"mode": "bpm"}, "bad_request"),
    ({"mode": "bpm", "bpm": 300}, "out_of_range"),
    ({"mode": "double", "files": {**bundle(), "song_beats.txt": base64.b64encode(beats_text(step=0.2).encode()).decode()}},
     "out_of_range"),  # 300 -> 600 BPM
    ({"mode": "half", "files": {k: v for k, v in bundle().items() if k != "song_chords.txt"}}, "no_bundle"),
    ({"mode": "half", "files": {**bundle(), "song_keys.txt": "!!"}}, "bad_bundle"),
    ({"mode": "half", "files": bundle(keys="REFUSE")}, "retime_refused"),
])
def test_refusals_name_their_reason(retime_client, body, code):
    response = retime_client.post("/v1/scores/retime", json={"files": bundle(), **body})
    assert response.status_code == 422 and response.json()["detail"]["code"] == code, response.text


def test_retime_says_why_it_is_unavailable(make_client):
    response = make_client().post("/v1/scores/retime", json={"files": bundle(), "mode": "half"})
    assert response.status_code == 503 and "not_configured" in response.json()["detail"]


def test_a_transcription_hands_out_its_notation_files(make_client, transcription_snapshot):
    client = make_client(**transcription_snapshot)
    job = wait_done(client, transcribe(client, "ok").json()["id"])
    out = client.get(f"/v1/transcriptions/{job['id']}/notation").json()
    assert set(out["files"]) == {"song_melody.mid", "song_beats.txt", "song_chords.txt", "song_keys.txt",
                                 "song_structures.txt"}
    assert base64.b64decode(out["files"]["song_beats.txt"]).startswith(b"0.500\t1\t4\t4")
    assert out["chords"] is False
    folder = client.app.state.store.artifact_dir(job["id"]) / "notation"
    shutil.rmtree(folder)
    missing = client.get(f"/v1/transcriptions/{job['id']}/notation")
    assert missing.status_code == 404 and missing.json()["detail"]["code"] == "no_bundle"
    assert client.get("/v1/transcriptions/nope/notation").status_code == 404


def test_fit_stretches_or_drops_what_a_slower_grid_cannot_hold(tmp_path):
    src, dst = tmp_path / "in.mid", tmp_path / "out.mid"
    src.write_bytes(melody_midi(beats=9, per_beat=2))  # 8ths at 120 BPM
    same = fit_midi(src, dst, [i * 0.5 for i in range(9)])
    assert (same.notes, same.kept, same.dropped, same.stretched) == (32, 32, 0, 0)
    slow = fit_midi(src, dst, [i * 2.0 for i in range(3)])  # a quarter of the beats: 16 subbeats in all
    assert slow.notes == 32 and slow.kept + slow.dropped == 32 and slow.dropped > 0
    import pretty_midi
    written = pretty_midi.PrettyMIDI(str(dst))
    for instrument in written.instruments:
        assert all(n.end > n.start for n in instrument.notes)
        assert all(a.end <= b.start + 1e-9 for a, b in zip(instrument.notes, instrument.notes[1:]))


def test_keep_like_keeps_only_the_old_scores_sections(retime_client):
    from retime_keep import KeepError, keep_sections_like
    abc = "X:1\nK:C\n% intro\nA|\n% verse\nB|\n% chorus\nC|\n% verse\nD|\n"
    assert keep_sections_like(abc, "X:1\n% verse\nb|\n% verse\nd|\n") == ("X:1\nK:C\n% verse\nB|\n% verse\nD|\n", ["intro", "chorus"])
    assert keep_sections_like(abc, "X:1\nK:C\nA|\n") == (abc, [])
    with pytest.raises(KeepError):
        keep_sections_like(abc, "X:1\n% bridge\nA|\n")
    out = post(retime_client, mode="half", keep_like="X:1\n% verse\nz|\n").json()
    assert out["left_out"] == [] and "% verse" in out["abc"]
    refused = post(retime_client, mode="half", keep_like="X:1\n% bridge\nz|\n")
    assert refused.status_code == 422 and refused.json()["detail"]["code"] == "retime_refused"
