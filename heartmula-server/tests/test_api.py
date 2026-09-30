import time
from dataclasses import replace

import pytest
import soundfile as sf
from fastapi.testclient import TestClient

import config
from conftest import FakeEngine
from main import create_app


def make_client(tmp_path, engine=None, **overrides):
    settings = replace(config.Settings(), data_dir=tmp_path / "data", **overrides)
    return TestClient(create_app(engine or FakeEngine(), settings))


def wait_ready(client):
    for _ in range(200):
        if client.get("/health/ready").status_code == 200:
            return
        time.sleep(0.01)
    raise AssertionError("never became ready")


def wait_terminal(client, job_id, headers=None):
    for _ in range(500):
        job = client.get(f"/v1/jobs/{job_id}", headers=headers).json()
        if job["status"] in ("succeeded", "truncated", "failed", "cancelled"):
            return job
        time.sleep(0.01)
    raise AssertionError(f"job stuck: {job}")


def test_happy_path_returns_a_flac_within_full_scale(tmp_path, lyrics):
    engine = FakeEngine(peak=1.3)
    with make_client(tmp_path, engine) as client:
        wait_ready(client)
        res = client.post("/v1/jobs", json={"tags": "piano,happy", "lyrics": lyrics})
        assert res.status_code == 202
        job = res.json()
        assert job["status"] == "queued" and res.headers["location"] == f"/v1/jobs/{job['id']}"
        done = wait_terminal(client, job["id"])
        assert done["status"] == "succeeded" and done["stage"] == "finished"
        assert done["result"]["audio_url"] == f"/v1/jobs/{job['id']}/audio"
        assert done["result"]["sample_rate"] == 48_000 and done["result"]["gain_db"] < 0
        audio = client.get(done["result"]["audio_url"])
        assert audio.status_code == 200 and audio.headers["content-type"] == "audio/flac"
        path = tmp_path / "out.flac"
        path.write_bytes(audio.content)
        data, rate = sf.read(str(path))
        assert rate == 48_000 and data.shape[1] == 2 and abs(data).max() <= 1.0
        assert engine.requests[0]["max_audio_length_ms"] == 240_000  # AUTO cap
        assert engine.cleanups == 1


def test_hitting_the_cap_reports_truncated(tmp_path, lyrics):
    with make_client(tmp_path, FakeEngine(truncated=True)) as client:
        wait_ready(client)
        done = wait_terminal(client, client.post("/v1/jobs", json={"lyrics": lyrics}).json()["id"])
        assert done["status"] == "truncated" and done["result"]["truncated"] is True
        assert client.get(f"/v1/jobs/{done['id']}/audio").status_code == 200


def test_cancel_while_running(tmp_path, lyrics):
    engine = FakeEngine(gated=True)
    with make_client(tmp_path, engine) as client:
        wait_ready(client)
        job_id = client.post("/v1/jobs", json={"lyrics": lyrics}).json()["id"]
        assert engine.entered.wait(2)
        running = client.get(f"/v1/jobs/{job_id}").json()
        assert running["status"] == "running" and running["stage"] == "generating"
        assert client.post(f"/v1/jobs/{job_id}/cancel").json()["cancel_requested"] is True
        engine.gate.set()
        done = wait_terminal(client, job_id)
        assert done["status"] == "cancelled" and done["error"] is None
        assert client.get(f"/v1/jobs/{job_id}/audio").status_code == 409
        assert not (tmp_path / "data" / job_id).exists()


def test_failures_carry_a_code_and_message(tmp_path, lyrics):
    oom = type("OutOfMemoryError", (RuntimeError,), {})("CUDA out of memory")
    with make_client(tmp_path, FakeEngine(error=oom)) as client:
        wait_ready(client)
        done = wait_terminal(client, client.post("/v1/jobs", json={"lyrics": lyrics}).json()["id"])
        assert done["status"] == "failed" and done["error"]["code"] == "out_of_memory"
        assert "ACESTEP_OFFLOAD_TO_CPU" in done["error"]["message"]


def test_bearer_key_is_enforced_only_when_set(tmp_path, lyrics):
    with make_client(tmp_path, api_key="s3cret") as client:
        wait_ready(client)
        assert client.get("/health/ready").status_code == 200  # health stays open
        assert client.post("/v1/jobs", json={"lyrics": lyrics}).status_code == 401
        wrong = {"Authorization": "Bearer nope"}
        assert client.post("/v1/jobs", json={"lyrics": lyrics}, headers=wrong).status_code == 401
        auth = {"Authorization": "Bearer s3cret"}
        res = client.post("/v1/jobs", json={"lyrics": lyrics}, headers=auth)
        assert res.status_code == 202
        assert wait_terminal(client, res.json()["id"], auth)["status"] == "succeeded"


def test_health_reports_a_failed_load(tmp_path, lyrics):
    with make_client(tmp_path, FakeEngine(fail_load=FileNotFoundError("no ckpt"))) as client:
        for _ in range(200):
            res = client.get("/health/ready")
            if res.json()["status"] == "failed":
                break
            time.sleep(0.01)
        assert res.status_code == 503 and "no ckpt" in res.json()["error"]
        assert client.post("/v1/jobs", json={"lyrics": lyrics}).status_code == 503


@pytest.mark.parametrize("body", [
    {"lyrics": "   "},
    {"lyrics": "x", "seed": 1},
    {"lyrics": "x", "max_audio_length_ms": 999_999},
    {"lyrics": "x", "cfg_scale": 0.5},
    {"tags": "x"},
])
def test_invalid_requests_are_422(tmp_path, body):
    with make_client(tmp_path) as client:
        wait_ready(client)
        assert client.post("/v1/jobs", json=body).status_code == 422


def test_a_value_naming_a_file_is_refused(tmp_path):
    # heartlib would otherwise read that file and sing it.
    with make_client(tmp_path) as client:
        wait_ready(client)
        assert client.post("/v1/jobs", json={"lyrics": __file__}).status_code == 422
        assert client.post("/v1/jobs", json={"lyrics": "la", "tags": __file__}).status_code == 422


def test_stale_job_folders_are_cleared_at_startup(tmp_path):
    stale, keep = tmp_path / "data" / ("a" * 32), tmp_path / "data" / "notes"
    stale.mkdir(parents=True)
    keep.mkdir()
    with make_client(tmp_path) as client:
        wait_ready(client)
    assert not stale.exists() and keep.exists()


def test_unknown_job_and_no_score_route(tmp_path):
    with make_client(tmp_path) as client:
        assert client.get("/v1/jobs/nope").status_code == 404
        assert client.post("/v1/jobs/nope/cancel").status_code == 404
        assert client.get("/v1/jobs/nope/audio").status_code == 404
        assert client.get("/v1/jobs/nope/score").status_code == 404
