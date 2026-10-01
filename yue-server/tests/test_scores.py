"""POST /v1/scores/measure and the section split behind it (PLAN.md, "YuE2
Covers: Pick the Score's Sections")."""
from __future__ import annotations

import threading

from conftest import NATIVE
from scores import prepare_score, split_sections


def test_split_sections_keeps_every_byte_in_order():
    header, sections = split_sections(NATIVE)
    assert header.startswith("X:1\n") and header.endswith("K:G\n")
    assert [name for name, _ in sections] == ["intro", "pre-chorus"]
    assert header + "".join(body for _, body in sections) == NATIVE
    assert all(body.startswith(f"% {name}\n") for name, body in sections)


def test_a_score_without_sections_is_all_header():
    assert split_sections("X:1\nK:C\n|C4|\n") == ("X:1\nK:C\n|C4|\n", [])


def test_measure_counts_the_prepared_score_per_section(make_client):
    client = make_client()
    reply = client.post("/v1/scores/measure", json={"abc": NATIVE})
    assert reply.status_code == 200
    body = reply.json()
    prepared = prepare_score(NATIVE, "melody")  # chord symbols stripped, as /v1/jobs does
    assert '"G"' not in prepared
    assert body["budget"] == 4096
    assert [s["name"] for s in body["sections"]] == ["intro", "pre-chorus"]
    assert body["header"] + sum(s["tokens"] for s in body["sections"]) == len(prepared)


def test_measure_rejects_a_bad_score_and_waits_for_the_worker(make_client):
    client = make_client()
    assert client.post("/v1/scores/measure", json={"abc": "not a score"}).status_code == 422
    assert client.post("/v1/scores/measure", json={"abc": ""}).status_code == 422

    loading = threading.Event()
    blocked = make_client(factory=lambda: loading.wait(5))
    reply = blocked.post("/v1/scores/measure", json={"abc": NATIVE})
    loading.set()
    assert reply.status_code == 503


def test_measure_needs_the_bearer_token(make_client):
    client = make_client(api_key="secret")
    assert client.post("/v1/scores/measure", json={"abc": NATIVE}).status_code == 401
    ok = client.post("/v1/scores/measure", json={"abc": NATIVE}, headers={"Authorization": "Bearer secret"})
    assert ok.status_code == 200
