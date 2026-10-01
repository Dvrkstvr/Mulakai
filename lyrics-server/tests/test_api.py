import pytest
from fastapi.testclient import TestClient

from api import create_app


def seg(text, start):
    return {"text": text, "start": start, "end": start + 2, "words": []}


@pytest.fixture
def calls():
    return []


def client_for(calls, segments=None, error=None):
    def transcribe(path, language):
        calls.append((path, path.exists(), path.read_bytes(), language))
        if error:
            raise error
        return {"language": language or "en", "segments": segments or [seg("Midnight city", 12.0)]}

    return TestClient(create_app(transcribe, "large-v3"))


def post(client, **data):
    return client.post("/transcribe", files={"audio": ("song.mp3", b"fake", "audio/mpeg")}, data=data)


def test_health_names_the_model_without_running_a_job(calls):
    client = client_for(calls)
    assert client.get("/health").json() == {"ok": True, "backend": "faster-whisper", "model": "large-v3"}
    assert calls == []


def test_transcribe_hands_over_the_upload_and_returns_segments(calls):
    res = post(client_for(calls))

    assert res.status_code == 200
    assert res.json() == {"language": "en", "segments": [seg("Midnight city", 12.0)]}
    path, existed, data, language = calls[0]
    assert existed and data == b"fake" and path.suffix == ".mp3"
    assert language is None
    assert not path.exists()


def test_language_is_passed_when_given(calls):
    post(client_for(calls), language=" de ")
    assert calls[0][3] == "de"


def test_hallucinated_segments_are_dropped(calls):
    segments = [seg("Midnight city", 12.0), seg("Thanks for watching!", 20.0), seg("Thank you.", 40.0)]
    res = post(client_for(calls, segments=segments))
    assert [s["text"] for s in res.json()["segments"]] == ["Midnight city"]


def test_failed_job_is_a_500_and_removes_the_upload(calls):
    res = post(client_for(calls, error=RuntimeError("CUDA out of memory")))

    assert res.status_code == 500
    assert "CUDA out of memory" in res.json()["detail"]
    assert not calls[0][0].exists()
