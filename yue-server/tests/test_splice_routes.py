"""POST /v1/splices end to end on the fake pipeline: a REHARMONIZE splice of a
real (fake) render job, REPEAT and CUT on the base alone, the `rerender`
verdicts, failures, cancel, replay and the 422s. Records the contract fixtures
the server's fake yue replays (D-039): `python -m pytest --record-contract`."""
import threading

import numpy as np
import pytest

from conftest import wait_for
from splice_dsp import SR
from splice_fixtures import score, wav_bytes
from splice_harness import (BARS, BASE, BASE_ABC, BEAT, LEAD, SECTIONS, contract, done, read_wav, reharm,  # noqa: F401
                            render, section, splice, splicer, tracker)


def test_a_reharmonize_splices_the_render_into_the_base(splicer, tracker, record_contract):
    client = splicer(tracker)
    job = render(client)
    submitted = splice(client, reharm(job))
    assert submitted.status_code == 202 and submitted.json()["kind"] == "splice"
    final = done(client, submitted.json()["id"])
    result = final["result"]
    assert final["status"] == "succeeded" and result["verdict"] == "ok" and result["bars"] == [9, 16]
    assert result["null_test"]["different"] == 0 and result["null_test"]["samples"] > len(BASE) // 2
    assert [p["source"] for p in result["parts"]] == ["base", "render", "base"]
    assert [round(s["delta_ms"]) for s in result["snap"]] == [30, 30] and len(result["gain_db"]["bars"]) == 8
    assert all(abs(s["lufs_step_excess"]) < 0.5 for s in result["seams"])
    audio = read_wav(client.get(result["audio_url"]).content)
    assert audio.dtype == np.float32 and len(audio) == pytest.approx(len(BASE), abs=0.05 * SR)
    out = client.get(result["grid_urls"]["out"]).json()
    assert out["source"] == "mapped" and len(out["downbeats"]) == BARS
    assert client.get(result["grid_urls"]["base"]).json()["downbeats"][0] == LEAD
    assert len(tracker.calls) == 2
    contract(record_contract, "splice-ok", reharm(job), submitted, final, {job: "job-0001"})


def test_a_repeat_with_a_cached_grid_needs_no_tracker(splicer, tracker):
    client = splicer(tracker)
    final = done(client, splice(client, section("REPEAT", 2, "chorus")).json()["id"])
    result = final["result"]
    assert result["verdict"] == "ok" and result["kind"] == "REPEAT" and result["bars"] == [9, 16]
    assert result["length_diff_s"] == pytest.approx(16.0, abs=0.1) and tracker.calls == []
    assert result["crossfade_s"] == [BEAT, 0.0] and result["null_test"]["different"] == 0


def test_a_cut_removes_the_section(splicer, tracker):
    client = splicer(tracker)
    result = done(client, splice(client, section("CUT", 2, "chorus")).json()["id"])["result"]
    assert result["verdict"] == "ok" and result["length_diff_s"] == pytest.approx(-16.0, abs=0.1)


def test_a_repeat_whose_seam_steps_too_far_says_rerender(splicer, tracker, record_contract):
    loud = BASE.copy()
    loud[int((LEAD + 16) * SR):int((LEAD + 18) * SR)] *= 4  # the chorus's first bar
    client = splicer(tracker)
    spec = section("REPEAT", 2, "chorus")
    submitted = splice(client, spec, wav_bytes(loud))
    final = done(client, submitted.json()["id"])
    result = final["result"]
    assert (result["verdict"], result["reason"], result["audio_url"]) == ("rerender", "level_step", None)
    assert result["level_step_db"] > 4.0 and "re-rendered" in result["detail"]
    assert client.get(f"/v1/splices/{final['id']}/audio").status_code == 404
    assert result["grid_urls"]["base"] is not None
    contract(record_contract, "splice-rerender", spec, submitted, final, {})


@pytest.mark.parametrize("abc, reason", [(score(BARS, 120, meter="3/4", sections=SECTIONS), "meter"),
                                         (BASE_ABC, "no_grid")])
def test_a_song_that_cannot_be_spliced_says_rerender(splicer, abc, reason):
    client = splicer()  # no tracker configured, no cached grid
    spec = {**section("CUT", 2, "chorus", cached=False), "base_abc": abc}
    result = done(client, splice(client, spec).json()["id"])["result"]
    assert (result["verdict"], result["reason"]) == ("rerender", reason)


def test_a_render_whose_audio_is_gone_fails_the_splice(splicer, tracker, record_contract):
    client = splicer(tracker)
    job = render(client)
    (client.app.state.store.artifact_dir(job) / "audio.flac").unlink()
    submitted = splice(client, reharm(job))
    final = done(client, submitted.json()["id"])
    assert final["status"] == "failed" and final["error"]["code"] == "render_unavailable"
    contract(record_contract, "splice-failed", reharm(job), submitted, final, {job: "job-0001"})


def test_a_cancel_while_tracking_stops_the_splice_and_removes_its_files(splicer, tracker, record_contract):
    tracker.hold = threading.Event()
    client = splicer(tracker)
    job = render(client)
    submitted = splice(client, reharm(job))
    job_id = submitted.json()["id"]
    running = wait_for(lambda: (j := client.get(f"/v1/splices/{job_id}").json())["progress"] == 0.5 and j)
    assert running["stage"] == "tracking_base"
    contract(record_contract, "splice-hold", reharm(job), submitted, running, {job: "job-0001"})
    client.post(f"/v1/splices/{job_id}/cancel")
    assert done(client, job_id)["status"] == "cancelled"
    assert not client.app.state.store.artifact_dir(job_id).exists()


def test_a_replayed_key_returns_the_first_splice(splicer, tracker):
    client = splicer(tracker)
    first = splice(client, section("CUT", 2, "chorus"), key="edit-1")
    assert splice(client, section("CUT", 2, "chorus"), key="edit-1").json()["id"] == first.json()["id"]
    assert splice(client, section("REPEAT", 2, "chorus"), key="edit-1").status_code == 409
    done(client, first.json()["id"])
    assert client.get(f"/v1/jobs/{first.json()['id']}").status_code == 404


@pytest.mark.parametrize("spec, status, says", [
    ({"op": {"op": "REWRITE_LYRICS"}, "base_abc": BASE_ABC}, 422, "renders the whole song"),
    ({"op": {"op": "CUT", "section": 2, "label": "verse"}, "base_abc": BASE_ABC}, 422, "is chorus"),
    ({"op": {"op": "CUT", "section": 9, "label": "verse"}, "base_abc": BASE_ABC}, 422, "does not exist"),
    ({"op": {"op": "REHARMONIZE", "from_bar": 20, "to_bar": 30}, "base_abc": BASE_ABC, "render_job": "x"}, 422, "inside"),
    ({"op": {"op": "REHARMONIZE", "from_bar": 9, "to_bar": 16}, "base_abc": BASE_ABC, "render_job": "x"}, 422, "render_job"),
    ({"op": {"op": "CUT", "section": 2, "label": "chorus"}, "base_abc": "not a score"}, 422, "base_abc"),
    ({**section("CUT", 2, "chorus"), "base_grid": {"grid_v": 2}}, 422, "base_grid"),
])
def test_a_bad_spec_is_refused_before_it_is_queued(splicer, spec, status, says):
    reply = splice(splicer(), spec)
    assert reply.status_code == status and says in reply.json()["detail"]


def test_a_spec_that_is_not_json_is_422(splicer):
    client = splicer()
    reply = client.post("/v1/splices", files={"audio": ("b.wav", b"RIFF", "audio/wav")}, data={"spec": "{"})
    assert reply.status_code == 422
