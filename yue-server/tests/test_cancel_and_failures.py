import threading

import pytest

from conftest import BODY, FakePipeline, wait_for, wait_terminal


class OutOfMemoryError(RuntimeError):
    """Stands in for torch.OutOfMemoryError, which the worker matches by name."""


def test_cancel_while_running_parks_before_reporting(make_client):
    gate = threading.Event()
    seen = []
    pipe = FakePipeline(gate=gate)
    client = make_client(pipe)
    job_id = client.post("/v1/jobs", json=BODY).json()["id"]
    pipe.on_park = lambda: seen.append(client.get(f"/v1/jobs/{job_id}").json()["status"])
    wait_for(lambda: client.get(f"/v1/jobs/{job_id}").json()["stage"] == "semantic")

    cancelled = client.post(f"/v1/jobs/{job_id}/cancel").json()
    assert cancelled["cancel_requested"] is True
    job = wait_terminal(client, job_id)
    assert job["status"] == "cancelled" and job["result"] is None
    assert seen == ["running"]  # parked while still running, then marked terminal
    assert client.get(f"/v1/jobs/{job_id}/audio").status_code == 409


def test_cancel_queued_job_never_reaches_the_pipeline(make_client):
    gate = threading.Event()
    pipe = FakePipeline(gate=gate)
    client = make_client(pipe)
    first = client.post("/v1/jobs", json=BODY).json()["id"]
    second = client.post("/v1/jobs", json={**BODY, "seed": 8}).json()["id"]
    assert client.post(f"/v1/jobs/{second}/cancel").json()["status"] == "cancelled"
    gate.set()
    assert wait_terminal(client, first)["status"] == "succeeded"
    assert [r["seed"] for r in pipe.requests] == [7]


def test_cancel_of_a_finished_job_changes_nothing(make_client):
    client = make_client()
    job_id = client.post("/v1/jobs", json=BODY).json()["id"]
    wait_terminal(client, job_id)
    job = client.post(f"/v1/jobs/{job_id}/cancel").json()
    assert job["status"] == "succeeded" and job["cancel_requested"] is False


def test_queue_full_is_429(make_client):
    client = make_client(FakePipeline(gate=threading.Event()), max_pending=2)
    assert client.post("/v1/jobs", json=BODY).status_code == 202
    assert client.post("/v1/jobs", json=BODY).status_code == 202
    response = client.post("/v1/jobs", json=BODY)
    assert response.status_code == 429 and response.headers["retry-after"] == "5"


@pytest.mark.parametrize("error, code", [
    (ValueError("Prefix + generation budget exceeds context"), "invalid_generation"),
    (RuntimeError("CUDA error: unspecified launch failure"), "inference_failed"),
    (OutOfMemoryError("CUDA out of memory"), "out_of_memory"),
])
def test_failures_carry_a_code_and_still_park(make_client, error, code):
    pipe = FakePipeline(error=error)
    client = make_client(pipe)
    job = wait_terminal(client, client.post("/v1/jobs", json=BODY).json()["id"])
    assert job["status"] == "failed" and job["result"] is None
    assert job["error"]["code"] == code
    assert str(error) in job["error"]["message"]
    assert pipe.parked == 1
    assert client.get(f"/v1/jobs/{job['id']}/audio").status_code == 409


def test_worker_keeps_serving_after_a_failure(make_client):
    pipe = FakePipeline(error=RuntimeError("boom"))
    client = make_client(pipe)
    assert wait_terminal(client, client.post("/v1/jobs", json=BODY).json()["id"])["status"] == "failed"
    pipe.error = None
    assert wait_terminal(client, client.post("/v1/jobs", json=BODY).json()["id"])["status"] == "succeeded"
