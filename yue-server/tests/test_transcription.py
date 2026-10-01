import shutil
import sys
import time
from pathlib import Path

import pytest

from conftest import BODY, NATIVE, FakePipeline, wait_for

TERMINAL = {"succeeded", "failed", "cancelled"}


@pytest.fixture
def sheetsage(tmp_path):
    """A SheetSage2 snapshot whose infer.py is tests/fake_infer.py."""
    snapshot = tmp_path / "SheetSage2"
    snapshot.mkdir()
    shutil.copy(Path(__file__).parent / "fake_infer.py", snapshot / "infer.py")
    (snapshot / "model.safetensors").write_bytes(b"")
    return {"sheetsage_python": sys.executable, "sheetsage_dir": str(snapshot)}


def transcribe(client, mode: str, key: str | None = None, name="song.mp3"):
    headers = {"Idempotency-Key": key} if key else {}
    return client.post("/v1/transcriptions", files={"audio": (name, mode.encode(), "audio/mpeg")},
                       headers=headers)


def wait_done(client, job_id):
    return wait_for(lambda: (j := client.get(f"/v1/transcriptions/{job_id}").json())["status"] in TERMINAL and j,
                    timeout=20)


def test_health_says_why_transcription_is_unavailable(make_client, sheetsage):
    health = make_client().get("/v1/transcriptions/health")
    assert health.status_code == 503 and health.json()["status"] == "not_configured"
    (Path(sheetsage["sheetsage_dir"]) / "model.safetensors").unlink()
    health = make_client(**sheetsage).get("/v1/transcriptions/health")
    assert health.status_code == 503 and health.json()["status"] == "missing_files"
    assert "model.safetensors" in health.json()["detail"]
    assert transcribe(make_client(), "ok").status_code == 503


def test_a_transcription_serves_its_score_preview_and_facts(make_client, sheetsage):
    client = make_client(**sheetsage)
    assert client.get("/v1/transcriptions/health").json() == {"status": "ready"}
    response = transcribe(client, "ok")
    assert response.status_code == 202
    job = response.json()
    assert job["kind"] == "transcription" and "seed" not in job and "tokens" not in job
    assert response.headers["location"] == f"/v1/transcriptions/{job['id']}"

    done = wait_done(client, job["id"])
    assert done["status"] == "succeeded"
    result = done["result"]
    assert result["score_url"] == f"/v1/transcriptions/{job['id']}/score"
    assert result["preview_url"] == f"/v1/transcriptions/{job['id']}/preview"
    assert result["warnings"] == ["short clip"] and result["measures"] == 3
    assert (result["vocal_notes"], result["instrumental_notes"], result["duration_seconds"]) == (6, 5, 8.2)
    assert result["section_starts"] == [{"label": "verse", "bar": 0, "seconds": 0.5}]
    assert client.get(result["score_url"]).text.startswith("X:1")
    preview = client.get(result["preview_url"])
    assert preview.headers["content-type"] == "audio/wav" and preview.content == b"RIFF-fake"
    # Each route family keeps to its own kind.
    assert client.get(f"/v1/jobs/{job['id']}").status_code == 404
    assert client.post(f"/v1/jobs/{job['id']}/cancel").status_code == 404
    song = client.post("/v1/jobs", json=BODY).json()
    assert client.get(f"/v1/transcriptions/{song['id']}").status_code == 404


def test_a_failed_render_still_returns_the_score(make_client, sheetsage):
    client = make_client(**sheetsage)
    done = wait_done(client, transcribe(client, "render_fail").json()["id"])
    assert done["status"] == "succeeded" and done["result"]["preview_url"] is None
    assert "No piano preview: Could not start the renderer" in done["result"]["warnings"]
    assert client.get(f"/v1/transcriptions/{done['id']}/preview").status_code == 404


@pytest.mark.parametrize("mode, code, message", [
    ("no_score", "no_score", "no beats decoded"),
    ("crash", "transcription_failed", "CUDA out of memory"),
])
def test_failures_say_what_sheetsage2_said(make_client, sheetsage, mode, code, message):
    client = make_client(**sheetsage)
    done = wait_done(client, transcribe(client, mode).json()["id"])
    assert done["status"] == "failed" and done["error"]["code"] == code
    assert message in done["error"]["message"]
    assert client.get(f"/v1/transcriptions/{done['id']}/score").status_code == 409


def test_cancel_kills_a_running_transcription(make_client, sheetsage):
    client = make_client(**sheetsage)
    job_id = transcribe(client, "hang").json()["id"]
    wait_for(lambda: client.get(f"/v1/transcriptions/{job_id}").json()["progress"] == 0.0)
    started = time.monotonic()
    assert client.post(f"/v1/transcriptions/{job_id}/cancel").json()["cancel_requested"]
    assert wait_done(client, job_id)["status"] == "cancelled"
    assert time.monotonic() - started < 10  # killed, not waited out (the fake sleeps 60 s)


def test_a_replayed_key_returns_the_same_transcription(make_client, sheetsage):
    client = make_client(**sheetsage)
    first = transcribe(client, "ok", key="mulakai-7")
    again = transcribe(client, "ok", key="mulakai-7")
    assert (first.status_code, again.status_code) == (202, 200) and again.json()["id"] == first.json()["id"]
    assert transcribe(client, "crash", key="mulakai-7").status_code == 409


def test_uploads_must_be_non_empty_and_under_the_limit(make_client, sheetsage):
    client = make_client(**sheetsage, max_upload_mb=0.000001)
    assert transcribe(client, "").status_code == 400
    assert transcribe(client, "ok").status_code == 413


def test_a_supplied_score_is_checked_and_stripped_for_melody(make_client):
    pipe = FakePipeline()
    client = make_client(pipe)
    job = client.post("/v1/jobs", json={**BODY, "abc": NATIVE, "cot": "melody"})
    assert job.status_code == 202
    wait_for(lambda: pipe.requests)
    sent = pipe.requests[0]["abc"]
    assert '"G"' not in sent and '"Gmaj7"' not in sent and "B8d8c8A8" in sent  # chords gone, notes kept
    full = make_client(FakePipeline())
    assert full.post("/v1/jobs", json={**BODY, "abc": NATIVE, "cot": "full"}).status_code == 202
    over = make_client(FakePipeline(fits=False))
    response = over.post("/v1/jobs", json={**BODY, "abc": NATIVE, "cot": "melody"})
    assert response.status_code == 422 and "4096-token" in response.json()["detail"]


def test_an_instrumental_cover_moves_the_supplied_melody_to_ins(make_client):
    pipe = FakePipeline()
    client = make_client(pipe)
    body = {**BODY, "lyrics": "[Intro]\n\n[Verse]\n", "abc": NATIVE, "cot": "melody"}
    assert client.post("/v1/jobs", json=body).status_code == 202
    wait_for(lambda: len(pipe.requests) == 2)
    final = pipe.requests[1]
    assert final["cot"] == "melody" and final["lyrics"] == "[Intro]\n\n[Pre-Chorus]\n"
    assert "B8d8c8A8|F16G16|" in final["abc"]  # the vocal melody, now on Ins
