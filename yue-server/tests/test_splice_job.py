"""A chained splice (spec `steps`, F-069) end to end on the fake pipeline: one
job splices 2-4 spans last bar first and answers one verdict; a step that is
not `ok` ends the whole plan `rerender` with no audio; a cancel between steps
leaves nothing. Records the chain contract fixtures the server's fake replays
(D-039): `python -m pytest --record-contract`."""
import json
import threading

import numpy as np
import pytest

import splice_chain_job
import splice_harness
from conftest import wait_for
from splice_check import check_chain, main as check_main
from splice_dsp import SR
from splice_fixtures import CHORDS, groove, grid, score, wav_bytes
from splice_harness import (BARS, BASE, BASE_ABC, BEAT, LEAD, contract, done, read_wav, splice,  # noqa: F401
                            splicer, tracker)

def reharm(first: int, last: int) -> dict:
    return {"op": {"op": "REHARMONIZE", "from_bar": first, "to_bar": last, "chords": []}}


def sec(op: str, number: int, label: str) -> dict:
    return {"op": {"op": op, "section": number, "label": label}}


def chain(steps: list, job: str | None = None, edited: str | None = None, cached: bool = True) -> dict:
    spec = {"steps": steps, "base_abc": BASE_ABC}
    if job:
        spec.update(render_job=job, edited_abc=edited)
    if cached:
        spec["base_grid"] = grid(BARS, BEAT, LEAD, len(BASE) / SR)
    return spec


def take(monkeypatch, client, tracker, bars: int, changed: range, sections) -> tuple[str, str]:
    """A render of an edited score of `bars` bars whose chords change on `changed`: (job id, its score)."""
    def chord(i, k):
        return ("Dm", "D:min")[k] if i in changed else CHORDS[i % 4][k]
    abc = score(bars, 120, chord_of=lambda i: chord(i, 0), sections=sections)
    audio = groove(bars, BEAT, lead=LEAD + 0.03)  # the render sits 30 ms later than its grid says
    tracker.add(wav_bytes(audio), grid(bars, BEAT, LEAD, len(audio) / SR, chord_of=lambda i: chord(i, 1)))
    monkeypatch.setattr(splice_harness, "NEW", audio)
    job = client.post("/v1/jobs", json={"style": "pop", "lyrics": "", "seed": 1, "abc": abc}).json()
    wait_for(lambda: client.get(f"/v1/jobs/{job['id']}").json()["status"] == "succeeded")
    return job["id"], abc


def stable_steps(final: dict) -> dict:
    """The harness rounds the top-level sample count (platform float rounding); the steps' too."""
    final = json.loads(json.dumps(final))
    for row in final["result"]["steps"]:
        if row["null_test"]:
            row["null_test"]["samples"] = round(row["null_test"]["samples"], -4)
    return final


def bar_chord(out_grid: dict, bar: int) -> str:
    t = out_grid["downbeats"][bar] + 0.5
    return next(label for a, b, label in out_grid["chords"] if a <= t < b)


def test_a_reharmonize_and_a_cut_save_one_spliced_file(splicer, tracker, monkeypatch, tmp_path, record_contract):
    client = splicer(tracker)
    job, edited = take(monkeypatch, client, tracker, 16, range(10, 14), [("verse", 0), ("verse", 8)])
    spec = chain([reharm(19, 22), sec("CUT", 2, "chorus")], job, edited, cached=False)
    submitted = splice(client, spec)
    final = done(client, submitted.json()["id"])
    result = final["result"]
    assert final["status"] == "succeeded", final["error"]
    assert (result["verdict"], result["kind"], result["bars"], result["step"]) == ("ok", "several", [9, 22], None)
    assert [(r["kind"], r["bars"], r["verdict"]) for r in result["steps"]] == [
        ("REHARMONIZE", [19, 22], "ok"), ("CUT", [9, 16], "ok")]
    assert result["null_test"]["different"] == 0 and result["length_diff_s"] == pytest.approx(-16.0, abs=0.1)
    assert len(result["joins_s"]) == 3 and result["joins_s"][0] == pytest.approx(LEAD + 20, abs=0.1)
    audio = read_wav(client.get(result["audio_url"]).content)
    assert len(audio) / SR == pytest.approx(result["audio_seconds"], abs=1e-3)
    out = client.get(result["grid_urls"]["out"]).json()
    assert len(out["downbeats"]) == 16  # the cut chorus's 8 bars are gone
    assert [bar_chord(out, b) for b in range(8, 16)] == [CHORDS[b % 4][1] if not 10 <= b < 14 else "D:min"
                                                         for b in range(8, 16)]
    report = check_chain(audio, BASE, result)  # the saved file against the ORIGINAL base (D-267)
    assert report["null_test"]["different"] == 0 and report["null_test"]["samples"] > len(audio) - 10 * SR  # all but the 8 s re-sung span and 3 crossfades
    assert all(abs(s["lufs_step_excess"]) < 1.0 for s in report["seams"] if s["lufs_step_excess"] is not None)
    files = {"base.wav": wav_bytes(BASE), "saved.wav": wav_bytes(audio), "result.json": json.dumps(final).encode()}
    for name, data in files.items():
        (tmp_path / name).write_bytes(data)
    assert check_main(["--chain", *(str(tmp_path / n) for n in files)]) == 0
    contract(record_contract, "splice-chain-ok", spec, submitted, stable_steps(final), {job: "job-0001"})


def test_two_reharmonize_spans_splice_from_one_render(splicer, tracker, monkeypatch):
    client = splicer(tracker)
    job, edited = take(monkeypatch, client, tracker, BARS, set(range(2, 6)) | set(range(16, 20)),
                       splice_harness.SECTIONS)
    result = done(client, splice(client, chain([reharm(17, 20), reharm(3, 6)], job, edited)).json()["id"])["result"]
    assert result["verdict"] == "ok" and abs(result["length_diff_s"]) < 0.05
    assert [round(s["delta_ms"]) for r in result["steps"] for s in r["snap"]] == [30, 30, 30, 30]
    audio = read_wav(client.get(result["audio_url"]).content)
    assert check_chain(audio, BASE, result)["null_test"]["different"] == 0


def test_a_reharmonize_after_a_repeat_splices_from_the_moved_bars(splicer, tracker, monkeypatch):
    client = splicer(tracker)
    job, edited = take(monkeypatch, client, tracker, 32, range(26, 30), [("verse", 0), ("verse", 8), ("chorus", 16),
                                                                        ("verse", 24)])
    result = done(client, splice(client, chain([reharm(19, 22), sec("REPEAT", 1, "verse")], job, edited))
                  .json()["id"])["result"]
    assert result["verdict"] == "ok" and result["length_diff_s"] == pytest.approx(16.0, abs=0.1)
    audio = read_wav(client.get(result["audio_url"]).content)
    assert check_chain(audio, BASE, result)["null_test"]["different"] == 0


def test_a_step_that_says_rerender_ends_the_whole_plan_with_no_audio(splicer, tracker, record_contract):
    loud = BASE.copy()
    loud[int(LEAD * SR):int((LEAD + 2) * SR)] *= 4  # the first verse's first bar: its copy's seam jumps
    client = splicer(tracker)
    spec = chain([sec("CUT", 3, "verse"), sec("REPEAT", 1, "verse")])
    submitted = splice(client, spec, wav_bytes(loud))
    final = done(client, submitted.json()["id"])
    result = final["result"]
    assert (result["verdict"], result["reason"], result["step"], result["audio_url"]) == (
        "rerender", "level_step", 2, None)
    assert [r["verdict"] for r in result["steps"]] == ["ok", "rerender"]
    assert not (client.app.state.store.artifact_dir(final["id"]) / "audio.wav").exists()
    assert client.get(f"/v1/splices/{final['id']}/audio").status_code == 404
    contract(record_contract, "splice-chain-rerender", spec, submitted, stable_steps(final), {})


def test_a_cancel_between_steps_saves_nothing(splicer, tracker, monkeypatch):
    started, proceed, cut = threading.Event(), threading.Event(), splice_chain_job.splice_cut

    def held_cut(*args):
        started.set()
        proceed.wait(5)
        return cut(*args)
    monkeypatch.setattr(splice_chain_job, "splice_cut", held_cut)
    client = splicer(tracker)
    job_id = splice(client, chain([sec("CUT", 3, "verse"), sec("REPEAT", 1, "verse")])).json()["id"]
    assert started.wait(5)
    assert client.get(f"/v1/splices/{job_id}").json()["stage"] == "splicing 1/2"
    client.post(f"/v1/splices/{job_id}/cancel")
    proceed.set()
    assert done(client, job_id)["status"] == "cancelled"
    assert not client.app.state.store.artifact_dir(job_id).exists()


def test_a_cancel_while_tracking_the_base_removes_the_chains_files(splicer, tracker, monkeypatch, record_contract):
    tracker.hold = threading.Event()
    client = splicer(tracker)
    job, edited = take(monkeypatch, client, tracker, 16, range(10, 14), [("verse", 0), ("verse", 8)])
    spec = chain([reharm(19, 22), sec("CUT", 2, "chorus")], job, edited, cached=False)
    submitted = splice(client, spec)
    job_id = submitted.json()["id"]
    running = wait_for(lambda: (j := client.get(f"/v1/splices/{job_id}").json())["progress"] == 0.5 and j)
    assert running["stage"] == "tracking_base"
    contract(record_contract, "splice-chain-hold", spec, submitted, running, {job: "job-0001"})
    client.post(f"/v1/splices/{job_id}/cancel")
    assert done(client, job_id)["status"] == "cancelled"
    assert not client.app.state.store.artifact_dir(job_id).exists()


def test_an_edited_score_that_is_not_the_plans_says_rerender(splicer, tracker, monkeypatch):
    client = splicer(tracker)
    job, edited = take(monkeypatch, client, tracker, BARS, range(18, 22), splice_harness.SECTIONS)  # nothing cut
    result = done(client, splice(client, chain([reharm(19, 22), sec("CUT", 2, "chorus")], job, edited))
                  .json()["id"])["result"]
    assert (result["verdict"], result["reason"], result["step"]) == ("rerender", "bar_map", None)


def test_the_written_file_must_equal_the_spliced_audio(splicer, tracker, monkeypatch):
    real = splice_chain_job.read_audio
    calls = []

    def flipped(path):
        audio = real(path)
        calls.append(path)
        if len(calls) == 2:  # the read-back of audio.wav
            audio = audio.copy()
            audio[SR] += np.float32(0.25)
        return audio
    monkeypatch.setattr(splice_chain_job, "read_audio", flipped)
    client = splicer(tracker)
    final = done(client, splice(client, chain([sec("CUT", 3, "verse"), sec("CUT", 1, "verse")])).json()["id"])
    assert final["status"] == "failed" and final["error"]["code"] == "null_test_failed"
