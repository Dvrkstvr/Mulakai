"""The /v1/splices test harness: synthetic takes and scores, a fake SheetSage2
tracker keyed by the audio's bytes, a client whose fake renders write real
audio, and the contract-fixture recorder (D-039)."""
import hashlib
import io
import json
from pathlib import Path

import numpy as np
import pytest
from fastapi.testclient import TestClient
from scipy.io import wavfile

from conftest import FakePipeline, wait_for
from main import create_app
from settings import Settings
from splice_dsp import SR
from splice_fixtures import CHORDS, groove, grid, score, wav_bytes
from transcriber import TranscriptionError

CONTRACT = Path(__file__).parent / "data" / "contract"
VOLATILE = ("created_at", "updated_at", "started_at", "finished_at")
TERMINAL = {"succeeded", "failed", "cancelled"}
BEAT, BARS, LEAD = 0.5, 24, 0.25
SECTIONS = [("verse", 0), ("chorus", 8), ("verse", 16)]
BASE_ABC = score(BARS, 120, sections=SECTIONS)
EDITED = lambda i: "Dm" if 8 <= i < 16 else CHORDS[i % 4][0]  # noqa: E731
EDITED_ABC = score(BARS, 120, chord_of=EDITED, sections=SECTIONS)
BASE = groove(BARS, BEAT, lead=LEAD)
NEW = groove(BARS, BEAT, lead=LEAD + 0.03)  # the render sits 30 ms later than its grid says


class FakeTracker:
    """Stands in for SheetSage2: the grid recorded for each audio file's bytes."""
    def __init__(self):
        self.grids, self.calls, self.hold = {}, [], None

    def add(self, audio_bytes: bytes, g: dict):
        self.grids[hashlib.sha256(audio_bytes).hexdigest()] = g

    def __call__(self, source, out, *, cancelled, on_progress):
        self.calls.append(Path(source).name)
        on_progress(0.5)
        while self.hold is not None and not self.hold.wait(0.005):
            if cancelled():
                raise InterruptedError("Cancelled during tracking")
        found = self.grids.get(hashlib.sha256(Path(source).read_bytes()).hexdigest())
        if found is None:
            raise TranscriptionError("transcription_failed", "no beats decoded")
        return found


class AudioPipeline(FakePipeline):
    def save_audio(self, audio, path):
        path.write_bytes(wav_bytes(NEW))


@pytest.fixture
def splicer(tmp_path):
    clients = []

    def make(tracker=None):
        app = create_app(Settings(data_dir=tmp_path / "data"), pipeline_factory=AudioPipeline,
                         splice_tracker=tracker)
        client = TestClient(app)
        client.__enter__()
        clients.append(client)
        wait_for(lambda: client.get("/health/ready").status_code == 200)
        return client

    yield make
    for client in clients:
        client.__exit__(None, None, None)


@pytest.fixture
def tracker():
    t = FakeTracker()
    t.add(wav_bytes(BASE), grid(BARS, BEAT, LEAD, len(BASE) / SR))
    t.add(wav_bytes(NEW), grid(BARS, BEAT, LEAD, len(NEW) / SR,
                               chord_of=lambda i: "D:min" if 8 <= i < 16 else CHORDS[i % 4][1]))
    return t


def render(client) -> str:
    job = client.post("/v1/jobs", json={"style": "pop", "lyrics": "", "seed": 1, "abc": EDITED_ABC}).json()
    return wait_for(lambda: (j := client.get(f"/v1/jobs/{job['id']}").json())["status"] == "succeeded" and j)["id"]


def splice(client, spec: dict, audio: bytes = None, key: str | None = None):
    headers = {"Idempotency-Key": key} if key else {}
    return client.post("/v1/splices", files={"audio": ("base.wav", audio or wav_bytes(BASE), "audio/wav")},
                       data={"spec": json.dumps(spec)}, headers=headers)


def done(client, job_id):
    return wait_for(lambda: (j := client.get(f"/v1/splices/{job_id}").json())["status"] in TERMINAL and j, timeout=30)


def reharm(job: str) -> dict:
    return {"op": {"op": "REHARMONIZE", "from_bar": 9, "to_bar": 16, "chords": []}, "base_abc": BASE_ABC,
            "render_job": job}


def section(op: str, number: int, label: str, cached=True) -> dict:
    spec = {"op": {"op": op, "section": number, "label": label}, "base_abc": BASE_ABC}
    if cached:
        spec["base_grid"] = grid(BARS, BEAT, LEAD, len(BASE) / SR)
    return spec


def read_wav(data: bytes) -> np.ndarray:
    return wavfile.read(io.BytesIO(data))[1]


def _stable(record: dict, ids: dict) -> dict:
    text = json.dumps(record)
    for real, pinned in ids.items():
        text = text.replace(real, pinned)
    stable = json.loads(text, parse_float=lambda v: round(float(v), 1))
    stable.update({key: 1.0 for key in VOLATILE if stable.get(key) is not None})
    result = stable.get("result") or {}
    if result.get("timing"):
        result["timing"] = {"total_seconds": 1.0}
    if result.get("null_test"):  # a sample count can move by one with the platform's float rounding
        result["null_test"]["samples"] = round(result["null_test"]["samples"], -4)
    return stable


def contract(record: bool, name: str, spec: dict, submitted, final: dict, ids: dict) -> None:
    ids = {submitted.json()["id"]: "sp-0001", **ids}
    entry = {"name": name,
             "request": {"method": "POST", "path": "/v1/splices", "form": {"spec": _stable(spec, ids)}, "file": "audio"},
             "response": {"status": submitted.status_code, "body": _stable(submitted.json(), ids)},
             "final": {"status": 200, "body": _stable(final, ids)}}
    file = CONTRACT / f"{name}.json"
    if record:
        with file.open("w", encoding="utf-8", newline="\n") as handle:
            handle.write(json.dumps(entry, indent=1, ensure_ascii=False) + "\n")
        return
    hint = "run `python -m pytest --record-contract` and commit the result"
    assert file.is_file(), f"no contract fixture {file.name}; {hint}"
    assert json.loads(file.read_text(encoding="utf-8")) == entry, f"{file.name} is stale; {hint}"
