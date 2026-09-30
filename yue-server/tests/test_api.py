import threading

import pytest

from conftest import ABC, BODY, FakePipeline, wait_for, wait_terminal


def test_happy_path_serves_flac_score_and_result(make_client):
    pipe = FakePipeline()
    client = make_client(pipe)
    response = client.post("/v1/jobs", json={**BODY, "id": "mulakai-job-1", "cfg_scale": 3.5})
    assert response.status_code == 202
    job = response.json()
    assert response.headers["location"] == f"/v1/jobs/{job['id']}"
    assert job["status"] == "queued" and job["seed"] == 7 and job["request_id"] == "mulakai-job-1"

    done = wait_terminal(client, job["id"])
    assert done["status"] == "succeeded" and done["stage"] == "finished"
    assert done["tokens"] == {"abc": 3, "semantic": 5}
    result = done["result"]
    assert result["audio_url"] == f"/v1/jobs/{job['id']}/audio"
    assert result["score_url"] == f"/v1/jobs/{job['id']}/score"
    assert result["audio_seconds"] == 2 and result["sample_rate"] == 48000
    assert result["truncated"] == {"abc": False, "semantic": False}
    assert {"planning_seconds", "semantic_seconds", "synthesis_seconds", "decode_seconds",
            "total_seconds"} <= result["timing"].keys()
    assert pipe.requests == [{**BODY, "id": "mulakai-job-1", "cfg_scale": 3.5, "cot": "full"}]
    assert pipe.parked == 1

    audio = client.get(result["audio_url"])
    assert audio.status_code == 200 and audio.headers["content-type"] == "audio/flac"
    assert audio.content == b"fLaC-fake"
    assert client.get(result["score_url"]).text == ABC


def test_truncated_job_keeps_its_audio(make_client):
    client = make_client(FakePipeline(truncated=(False, True)))
    job = wait_terminal(client, client.post("/v1/jobs", json=BODY).json()["id"])
    assert job["status"] == "truncated"
    assert job["result"]["truncated"] == {"abc": False, "semantic": True}
    assert client.get(job["result"]["audio_url"]).status_code == 200


def test_cot_off_has_no_score(make_client):
    client = make_client()
    job = wait_terminal(client, client.post("/v1/jobs", json={**BODY, "cot": "off"}).json()["id"])
    assert job["result"]["score_url"] is None
    assert client.get(f"/v1/jobs/{job['id']}/score").status_code == 404


@pytest.mark.parametrize("change", [
    {"seed": None},                      # seed is required, never defaulted to 831001
    {"seed": "7"},
    {"seed": -1},
    {"style": "   "},
    {"cfg_scale": 20.5},
    {"cot": "auto"},
    {"abc": "X:1"},                      # score editing is out of scope
    {"n": 2},
    {"id": "../escape"},
])
def test_invalid_requests_are_422(make_client, change):
    client = make_client()
    body = {**BODY, **change}
    body = {k: v for k, v in body.items() if v is not None}
    assert client.post("/v1/jobs", json=body).status_code == 422


def test_empty_lyrics_are_accepted(make_client):
    client = make_client()
    job = wait_terminal(client, client.post("/v1/jobs", json={**BODY, "lyrics": ""}).json()["id"])
    assert job["status"] == "succeeded"


def test_bearer_key_guards_jobs_but_not_health(make_client):
    client = make_client(api_key="s3cret-key")
    assert client.get("/health/ready").status_code == 200
    assert client.post("/v1/jobs", json=BODY).status_code == 401
    wrong = {"Authorization": "Bearer nope"}
    assert client.post("/v1/jobs", json=BODY, headers=wrong).status_code == 401
    good = {"Authorization": "Bearer s3cret-key"}
    job = client.post("/v1/jobs", json=BODY, headers=good).json()
    assert client.get(f"/v1/jobs/{job['id']}").status_code == 401
    assert wait_terminal(client, job["id"], good)["status"] == "succeeded"


def test_admission_id_header_is_recorded(make_client):
    client = make_client()
    job = client.post("/v1/jobs", json=BODY, headers={"X-Admission-Id": "gen-42"}).json()
    assert job["admission_id"] == "gen-42"


def test_health_reports_loading_then_failed(make_client):
    release = threading.Event()

    def factory():
        release.wait(5)
        raise RuntimeError("weights missing")

    client = make_client(factory=factory)
    assert client.get("/health/ready").json() == {"status": "loading"}
    assert client.post("/v1/jobs", json=BODY).status_code == 503
    release.set()
    wait_for(lambda: client.get("/health/ready").json() == {"status": "failed"})
    assert client.get("/health/ready").status_code == 503
    assert client.get("/health/live").json() == {"status": "alive"}


def test_unknown_job_is_404(make_client):
    client = make_client()
    for method, path in [("get", "/v1/jobs/nope"), ("post", "/v1/jobs/nope/cancel"),
                         ("get", "/v1/jobs/nope/audio"), ("get", "/v1/jobs/nope/score")]:
        assert getattr(client, method)(path).status_code == 404
