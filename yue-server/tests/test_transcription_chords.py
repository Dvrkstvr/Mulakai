"""A transcription with `chords` (D-131): a chat reading asks for chord symbols
and needs no piano preview; the default stays Guided Create's melody-only
COVER. Also records the transcription contract fixtures the server's fake yue
replays (D-039): `python -m pytest --record-contract` rewrites them."""
import json
import re
from pathlib import Path

import pytest

from conftest import wait_for
from test_transcription import sheetsage, transcribe, wait_done  # noqa: F401 (fixture)

CONTRACT = Path(__file__).parent / "data" / "contract"
VOLATILE = ("created_at", "updated_at", "started_at", "finished_at")


def submit(client, mode: str, chords: str | None, key: str | None = None):
    data = {} if chords is None else {"chords": chords}
    headers = {"Idempotency-Key": key} if key else {}
    return client.post("/v1/transcriptions", files={"audio": ("song.mp3", mode.encode(), "audio/mpeg")},
                       data=data, headers=headers)


def test_by_default_a_transcription_stays_melody_only_with_a_preview(make_client, sheetsage):
    client = make_client(**sheetsage)
    done = wait_done(client, transcribe(client, "ok").json()["id"])
    assert done["status"] == "succeeded" and done["result"]["chords"] is False
    assert '"' not in client.get(done["result"]["score_url"]).text
    assert done["result"]["preview_url"] is not None


def test_chords_keep_chord_symbols_and_skip_the_piano_preview(make_client, sheetsage):
    client = make_client(**sheetsage)
    done = wait_done(client, submit(client, "ok", "true").json()["id"])
    result = done["result"]
    assert done["status"] == "succeeded" and result["chords"] is True
    assert '"Am"C8|' in client.get(result["score_url"]).text
    assert result["preview_url"] is None
    assert not any("piano" in warning for warning in result["warnings"])
    assert result["section_starts"] == [{"label": "verse", "bar": 0, "seconds": 0.5}]
    assert client.get(f"/v1/transcriptions/{done['id']}/preview").status_code == 404


def test_chords_false_is_the_default(make_client, sheetsage):
    client = make_client(**sheetsage)
    done = wait_done(client, submit(client, "ok", "false").json()["id"])
    assert done["result"]["chords"] is False and done["result"]["preview_url"] is not None


def test_a_bad_chords_value_is_422(make_client, sheetsage):
    assert submit(make_client(**sheetsage), "ok", "maybe").status_code == 422


def test_a_replayed_key_with_other_chords_is_a_conflict(make_client, sheetsage):
    client = make_client(**sheetsage)
    first = submit(client, "ok", "true", key="reading-1")
    assert submit(client, "ok", "true", key="reading-1").json()["id"] == first.json()["id"]
    assert submit(client, "ok", None, key="reading-1").status_code == 409


def _stable(record: dict, job_id: str) -> dict:
    """The record with its random id and clock values pinned, so a fixture is
    byte-stable between runs."""
    text = json.dumps(record).replace(job_id, "tr-0001")
    stable = json.loads(text)
    stable.update({key: 1.0 for key in VOLATILE if stable.get(key) is not None})
    if (stable.get("result") or {}).get("timing"):
        stable["result"]["timing"] = {"total_seconds": 1.0}
    return stable


def _contract(record: bool, name: str, form: dict, submitted, final: dict, score: str | None = None) -> None:
    """`final` is the record the fake answers once done (or held); `score` is
    what GET .../score serves."""
    job_id = submitted.json()["id"]
    entry = {"name": name,
             "request": {"method": "POST", "path": "/v1/transcriptions", "form": form, "file": "audio"},
             "response": {"status": submitted.status_code, "body": _stable(submitted.json(), job_id)},
             "final": {"status": 200, "body": _stable(final, job_id)}, "score": score}
    file = CONTRACT / f"{name}.json"
    if record:
        with file.open("w", encoding="utf-8", newline="\n") as handle:
            handle.write(json.dumps(entry, indent=1, ensure_ascii=False) + "\n")
        return
    hint = "run `python -m pytest --record-contract` and commit the result"
    assert file.is_file(), f"no contract fixture {file.name}; {hint}"
    assert json.loads(file.read_text(encoding="utf-8")) == entry, f"{file.name} is stale; {hint}"


@pytest.mark.parametrize("name, mode", [
    ("transcription-chords-done", "ok"),
    ("transcription-chords-failed", "no_score"),
])
def test_contract_finished(make_client, sheetsage, record_contract, name, mode):
    client = make_client(**sheetsage)
    submitted = submit(client, mode, "true")
    final = wait_done(client, submitted.json()["id"])
    score = client.get(final["result"]["score_url"]).text if final["result"] else None
    _contract(record_contract, name, {"chords": "true"}, submitted, final, score)


def test_contract_hold(make_client, sheetsage, record_contract):
    """A reading still transcribing: the fake's `hold` state."""
    client = make_client(**sheetsage)
    submitted = submit(client, "hang", "true")
    job_id = submitted.json()["id"]
    running = wait_for(lambda: (j := client.get(f"/v1/transcriptions/{job_id}").json())["progress"] == 0.0 and j)
    client.post(f"/v1/transcriptions/{job_id}/cancel")
    assert re.fullmatch(r"[0-9a-f]{32}", job_id)
    _contract(record_contract, "transcription-hold", {"chords": "true"}, submitted, running)
    wait_done(client, job_id)
