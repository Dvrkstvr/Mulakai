"""GET /v1/transcriptions/{id}/grid (chat C1, D-174): a chords run's downbeat
grid (downbeat.lab, chord.lab, result.json through splice_grid.read_grid), in
the server's `grid_v: 1` sidecar shape, so one SheetSage2 run gives a version
its transcribed score and its bar grid. Records the transcription-grid-*
contract fixtures the server's fake yue replays (D-039)."""
import json

import contract_song
from conftest import wait_for
from contract import DIR
from test_transcription import sheetsage, transcribe, wait_done  # noqa: F401 (fixture)
from test_transcription_chords import submit

CHORD_LAB = "0.5\t2.5\tA:min\n2.5\t8.2\tC:maj\n"


def chords_run(client, mode="ok", chord_lab=CHORD_LAB):
    done = wait_done(client, submit(client, mode, "true").json()["id"])
    if chord_lab is not None and done["status"] == "succeeded":
        # tests/fake_infer.py writes no chord.lab; SheetSage2's chords run does (splice_grid.track reads it)
        (client.app.state.store.artifact_dir(done["id"]) / "chord.lab").write_text(chord_lab, encoding="utf-8")
    return done


def grid_of(client, job_id):
    return client.get(f"/v1/transcriptions/{job_id}/grid")


def _contract(record: bool, name: str, job_id: str, reply) -> None:
    path = f"/v1/transcriptions/{job_id}/grid"
    entry = {"name": name, "request": {"method": "GET", "path": path.replace(job_id, "tr-0001")},
             "response": {"status": reply.status_code, "body": reply.json()}}
    file = DIR / f"{name}.json"
    if record:
        with file.open("w", encoding="utf-8", newline="\n") as handle:
            handle.write(json.dumps(entry, indent=1, ensure_ascii=False) + "\n")
        return
    hint = "run `python -m pytest --record-contract` and commit the result"
    assert file.is_file(), f"no contract fixture {file.name}; {hint}"
    assert json.loads(file.read_text(encoding="utf-8")) == entry, f"{file.name} is stale; {hint}"


def test_a_chords_run_answers_its_grid_in_the_sidecar_shape(make_client, sheetsage, record_contract):
    client = make_client(**sheetsage)
    done = chords_run(client)
    reply = grid_of(client, done["id"])
    assert reply.status_code == 200
    assert reply.json() == {"grid_v": 1, "source": "tracked", "downbeats": [0.5, 2.5],
                            "chords": [[0.5, 2.5, "A:min"], [2.5, 8.2, "C:maj"]], "duration": 8.2}
    _contract(record_contract, "transcription-grid-ok", done["id"], reply)


def test_a_chords_run_of_the_contract_song_answers_one_downbeat_per_bar(make_client, sheetsage, record_contract):
    """The chat e2e's take of the contract song (CL-8b): its grid gives the strip 65 bars to mark."""
    client = make_client(**sheetsage)
    down, chords, end = contract_song.labs()
    done = chords_run(client, chord_lab=chords)
    out = client.app.state.store.artifact_dir(done["id"])
    (out / "downbeat.lab").write_text(down, encoding="utf-8")
    report = json.loads((out / "result.json").read_text(encoding="utf-8"))
    (out / "result.json").write_text(json.dumps({**report, "duration_seconds": end}), encoding="utf-8")
    reply = grid_of(client, done["id"])
    assert reply.status_code == 200 and reply.json() == contract_song.grid()
    _contract(record_contract, "transcription-grid-contract", done["id"], reply)


def test_a_melody_only_run_has_no_grid(make_client, sheetsage, record_contract):
    client = make_client(**sheetsage)
    done = wait_done(client, transcribe(client, "ok").json()["id"])
    reply = grid_of(client, done["id"])
    assert reply.status_code == 404 and reply.json()["detail"]["code"] == "no_grid"
    _contract(record_contract, "transcription-grid-melody-only", done["id"], reply)


def test_a_chords_run_without_usable_labs_has_no_grid(make_client, sheetsage):
    client = make_client(**sheetsage)
    missing = chords_run(client, chord_lab=None)
    assert grid_of(client, missing["id"]).json()["detail"]["code"] == "no_grid"
    backwards = chords_run(client, chord_lab="2.5\t0.5\tA:min\n")
    reply = grid_of(client, backwards["id"])
    assert reply.status_code == 404 and reply.json()["detail"]["code"] == "no_grid"


def test_a_failed_or_running_job_has_no_grid_yet(make_client, sheetsage):
    client = make_client(**sheetsage)
    failed = wait_done(client, submit(client, "no_score", "true").json()["id"])
    assert failed["status"] == "failed" and grid_of(client, failed["id"]).status_code == 409
    running = submit(client, "hang", "true").json()["id"]
    wait_for(lambda: client.get(f"/v1/transcriptions/{running}").json()["status"] == "running")
    assert grid_of(client, running).status_code == 409
    client.post(f"/v1/transcriptions/{running}/cancel")
    wait_done(client, running)


def test_an_unknown_or_song_id_is_404(make_client, sheetsage):
    client = make_client(**sheetsage)
    reply = grid_of(client, "0" * 32)
    assert reply.status_code == 404 and reply.json()["detail"] == "Transcription not found"


def test_grid_needs_the_bearer_token(make_client, sheetsage):
    client = make_client(api_key="secret", **sheetsage)
    assert grid_of(client, "0" * 32).status_code == 401
