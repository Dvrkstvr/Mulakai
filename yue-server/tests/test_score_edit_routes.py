"""POST /v1/scores/read and /v1/scores/apply (F-017): tokens with chords
kept, CPU only while a YuE2 job runs, the tokenizer lock (D-042), and the
contract fixtures the TypeScript fake replays (D-039)."""
from __future__ import annotations

import ast
import threading
import time
from pathlib import Path

import pytest

from conftest import BODY, FakePipeline, wait_for, wait_terminal
from contract import check_contract
from score_fixtures import BROKEN, CHORDS, LYRICS, RECOLOURED, RECOLOURED_TEXT, STYLE, library
from scores import strip_chords

TEMPO = {"op": "SET_TEMPO", "bpm": 88}
REHARM = {"op": "REHARMONIZE", "from_bar": 43, "to_bar": 43, "chords": [
    {"bar": 43, "beat": 1, "root": "G", "quality": "m7"}, {"bar": 43, "beat": 4, "root": "A", "quality": "7"}]}
STYLE_OP = {"op": "EDIT_STYLE", "style": "jazz trio, brushed drums, 120 bpm"}
CHORUS = {"op": "REHARMONIZE", "from_bar": 47, "to_bar": 50, "chords": [
    {"bar": b, "beat": 1, "root": r, "quality": q}
    for b, r, q in [(47, "D", "m7"), (48, "G", "7"), (49, "Bb", "maj7"), (50, "A", "7sus4")]]}
OVERFULL = CHORDS.replace("D4A4f4A4e4A4e4A4|", "D4A4f4A4e4A4e4A4A4|", 1)
SCORE_MODULES = ["score_model", "score_ops", "score_check", "score_roots", "score_facts", "score_edit_routes",
                 "score_phrase", "score_phrase_gates"]

CONTRACT = [
    ("read-ok", "/v1/scores/read", {"abc": CHORDS, "lyrics": LYRICS}),
    ("read-invalid-sidecar", "/v1/scores/read", {"abc": BROKEN}),
    ("read-overfull-bar", "/v1/scores/read", {"abc": OVERFULL}),
    ("apply-set-tempo", "/v1/scores/apply", {"abc": CHORDS, "style": STYLE, "ops": [TEMPO]}),
    ("apply-reharmonize", "/v1/scores/apply", {"abc": CHORDS, "style": STYLE, "ops": [REHARM]}),
    ("apply-edit-style", "/v1/scores/apply", {"abc": CHORDS, "style": STYLE, "ops": [STYLE_OP]}),
    ("apply-compound", "/v1/scores/apply", {"abc": CHORDS, "style": STYLE, "ops": [TEMPO, CHORUS, STYLE_OP]}),
    ("apply-bar-out-of-range", "/v1/scores/apply", {"abc": CHORDS, "style": STYLE, "ops": [
        TEMPO, {**REHARM, "from_bar": 999, "to_bar": 999, "chords": [{**REHARM["chords"][0], "bar": 999}]}]}),
    ("apply-reharmonize-same-roots", "/v1/scores/apply", {"abc": CHORDS, "style": STYLE, "ops": [RECOLOURED]}),
    ("apply-slow-cover", "/v1/scores/apply", {"abc": library("2a8cc1ca"), "style": "rock, 145 bpm", "ops": [TEMPO]}),
]


@pytest.mark.parametrize("name,path,body", CONTRACT, ids=[c[0] for c in CONTRACT])
def test_contract_replies(name, path, body, make_client, record_contract):
    reply = make_client().post(path, json=body)
    assert reply.status_code == 200
    check_contract(record_contract, name, path, body, reply)


def test_read_reports_verdict_facts_seconds_and_tokens_with_chords_kept(make_client):
    client = make_client()
    body = client.post("/v1/scores/read", json={"abc": CHORDS, "lyrics": LYRICS}).json()
    assert body["ok"] and body["error"] is None and body["chords_present"] is True
    assert (body["bpm"], body["seconds"]) == (87, 179.3)
    assert body["facts"]["header"]["bars"] == 65
    assert body["tokens"] == len(CHORDS)  # the fake counts one token per character
    measured = client.post("/v1/scores/measure", json={"abc": CHORDS}).json()
    stripped = measured["header"] + sum(s["tokens"] for s in measured["sections"])
    assert stripped == len(strip_chords(CHORDS)) < body["tokens"]


def test_apply_returns_the_edit_its_checks_and_what_changed(make_client):
    body = make_client().post("/v1/scores/apply", json={
        "abc": CHORDS, "style": STYLE, "ops": [TEMPO, CHORUS, STYLE_OP]}).json()
    assert body["ok"] and [v["ok"] for v in body["verdicts"]] == [True, True, True]
    assert body["checks"] == {"ok": True, "problems": [], "differences": []}
    assert body["style"] == "jazz trio, brushed drums, 88 bpm"
    assert body["changed"] == {"abc": True, "style": True}
    assert (body["bpm"], body["seconds"]) == (88, round(260 * 60 / 88, 1))
    assert body["tokens"] == len(body["abc"]) and body["chords_present"] is True
    failed = make_client().post("/v1/scores/apply", json=CONTRACT[7][2]).json()
    assert failed["ok"] is False and failed["verdicts"][1]["reason"] == "bars 999-999 are outside the score (1-65)"


def test_apply_refuses_a_reharmonize_that_keeps_every_old_root_with_numbers_the_planner_can_use(make_client):
    body = make_client().post("/v1/scores/apply", json={"abc": CHORDS, "style": STYLE, "ops": [RECOLOURED]}).json()
    assert body["ok"] is False and body["verdicts"][0]["ok"] is True
    assert body["checks"] == {"ok": False, "problems": [RECOLOURED_TEXT], "differences": []}


@pytest.mark.parametrize("change", [
    {"ops": []}, {"ops": [TEMPO] * 7}, {"ops": [{"op": "TRANSPOSE", "semitones": 2}]},
    {"ops": [{"op": "SET_TEMPO", "bpm": 300}]}, {"ops": [{**TEMPO, "extra": 1}]},
    {"ops": [{**REHARM, "chords": [{**REHARM["chords"][0], "quality": "maj9"}]}]},
    {"ops": [{**REHARM, "chords": [{**REHARM["chords"][0], "root": "H"}]}]},
    {"abc": "X:1"}, {"abc": BROKEN},
])
def test_apply_rejects_a_malformed_request(change, make_client):
    reply = make_client().post("/v1/scores/apply", json={"abc": CHORDS, "style": STYLE, "ops": [TEMPO], **change})
    assert reply.status_code == 422


def test_the_routes_need_the_bearer_token(make_client):
    client = make_client(api_key="secret")
    assert client.post("/v1/scores/read", json={"abc": CHORDS}).status_code == 401
    assert client.post("/v1/scores/apply", json={"abc": CHORDS, "ops": [TEMPO]}).status_code == 401
    ok = client.post("/v1/scores/read", json={"abc": CHORDS}, headers={"Authorization": "Bearer secret"})
    assert ok.status_code == 200


def test_tokens_are_null_while_the_worker_loads_and_the_rest_still_answers(make_client):
    loading = threading.Event()
    client = make_client(factory=lambda: loading.wait(5))
    read = client.post("/v1/scores/read", json={"abc": CHORDS}).json()
    applied = client.post("/v1/scores/apply", json={"abc": CHORDS, "style": STYLE, "ops": [TEMPO]}).json()
    loading.set()
    assert read["ok"] and read["tokens"] is None and read["seconds"] == 179.3
    assert applied["ok"] and applied["tokens"] is None


def test_while_a_yue2_job_runs_each_route_answers_in_under_a_second_and_loads_no_model(make_client):
    pipe = FakePipeline(gate=threading.Event())
    client = make_client(pipe)
    job = client.post("/v1/jobs", json=BODY).json()
    wait_for(lambda: client.get(f"/v1/jobs/{job['id']}").json()["stage"] == "semantic")
    for path, body in [("/v1/scores/read", {"abc": CHORDS, "lyrics": LYRICS}),
                       ("/v1/scores/apply", {"abc": CHORDS, "style": STYLE, "ops": [TEMPO, CHORUS, STYLE_OP]})]:
        started = time.monotonic()
        assert client.post(path, json=body).status_code == 200
        assert time.monotonic() - started < 1
    assert len(pipe.requests) == 1 and pipe.parked == 0  # plan() ran for the job only; nothing parked
    pipe.gate.set()
    assert wait_terminal(client, job["id"])["status"] == "succeeded"


@pytest.mark.parametrize("module", SCORE_MODULES)
def test_score_modules_import_nothing_from_the_model_or_pipeline(module):
    tree = ast.parse((Path(__file__).parent.parent / f"{module}.py").read_text(encoding="utf-8"))
    imported = {alias.name.split(".")[0] for node in ast.walk(tree) if isinstance(node, ast.Import)
                for alias in node.names}
    imported |= {node.module.split(".")[0] for node in ast.walk(tree)
                 if isinstance(node, ast.ImportFrom) and node.module}
    assert not imported & {"torch", "yue2", "yue_pipeline", "worker", "jobs", "transcriber", "instrumental"}


def test_two_threads_counting_tokens_take_turns(make_client):
    class Tracking(FakePipeline):
        inside = peak = 0

        def count_tokens(self, abc):
            self.inside += 1
            self.peak = max(self.peak, self.inside)
            time.sleep(0.05)
            self.inside -= 1
            return len(abc)

    pipe = Tracking()
    worker = make_client(pipe).app.state.worker
    threads = [threading.Thread(target=worker.count_tokens, args=(CHORDS,)) for _ in range(3)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    assert pipe.peak == 1
