from pathlib import Path

import pytest

from conftest import FakePipeline
from jobs import JobStore
from settings import Settings
from worker import run_job

REQUEST = {"style": "pop", "lyrics": "", "seed": 1}


class Clock:
    def __init__(self):
        self.now = 1000.0

    def __call__(self):
        return self.now


def test_progress_is_a_per_stage_fraction(tmp_path):
    store = JobStore(tmp_path, 4, 3600)
    job_id = store.submit(REQUEST)[0]["id"]
    store.claim(timeout=1)
    seen = []

    class Recording(FakePipeline):
        def plan(self, request, **kw):
            seen.append(("plan", store.get(job_id)["stage"], store.get(job_id)["progress"]))
            return super().plan(request, **kw)

        def synthesize(self, semantic, *, cancelled, on_progress):
            def record(done, total):
                on_progress(done, total)
                job = store.get(job_id)
                seen.append(("synth", job["stage"], job["progress"]))
            return super().synthesize(semantic, cancelled=cancelled, on_progress=record)

        def decode(self, latents, *, on_progress):
            seen.append(("decode", store.get(job_id)["stage"], store.get(job_id)["progress"]))
            return super().decode(latents, on_progress=on_progress)

    run_job(Recording(), store, job_id, REQUEST)
    assert seen == [("plan", "planning", None), ("synth", "synthesis", 0.25),
                    ("synth", "synthesis", 1.0), ("decode", "decode", None)]
    job = store.get(job_id)
    assert job["status"] == "succeeded" and job["progress"] is None
    assert (tmp_path / job_id / "result.json").is_file()


def test_sweep_drops_expired_jobs_and_their_artifacts(tmp_path):
    clock = Clock()
    store = JobStore(tmp_path, 4, 60, clock=clock)
    job_id = store.submit(REQUEST)[0]["id"]
    store.claim(timeout=1)
    store.artifact_dir(job_id).mkdir()
    store.finish(job_id, "failed", error={"code": "x", "message": "y"})
    clock.now += 59
    store.sweep()
    assert store.get(job_id) is not None
    clock.now += 2
    store.sweep()
    assert store.get(job_id) is None and not store.artifact_dir(job_id).exists()


def test_a_cancel_that_races_completion_wins(tmp_path):
    store = JobStore(tmp_path, 4, 3600)
    job_id = store.submit(REQUEST)[0]["id"]
    store.claim(timeout=1)
    store.cancel(job_id)
    store.finish(job_id, "succeeded", result={"audio_url": "x"})
    job = store.get(job_id)
    assert job["status"] == "cancelled" and job["result"] is None


def test_purge_orphans_only_touches_job_directories(tmp_path):
    (tmp_path / ("a" * 32)).mkdir()
    (tmp_path / "keep-me").mkdir()
    (tmp_path / ("g" * 32)).mkdir()  # 32 chars but not hex
    (tmp_path / ("b" * 32 + ".txt")).write_text("a file, not a job directory")
    JobStore(tmp_path, 4, 3600).purge_orphans()
    assert sorted(p.name for p in tmp_path.iterdir()) == sorted(["keep-me", "g" * 32, "b" * 32 + ".txt"])


def test_settings_defaults_match_the_spike():
    s = Settings.from_env({})
    assert (s.host, s.port, s.api_key) == ("127.0.0.1", 8004, "")
    assert (s.quantization, s.offload_ar, s.budget_gib) == ("none", False, 24.0)


def test_settings_read_the_environment():
    s = Settings.from_env({"YUE_API_KEY": "k", "YUE_PORT": "9000", "YUE_OFFLOAD_AR": "true",
                           "YUE_QUANTIZATION": "fp8", "YUE_DATA_DIR": "/tmp/yue"})
    assert (s.api_key, s.port, s.offload_ar, s.quantization) == ("k", 9000, True, "fp8")
    assert s.data_dir == Path("/tmp/yue")
    with pytest.raises(ValueError):
        Settings.from_env({"YUE_QUANTIZATION": "int4"})


def test_idempotency_keys_expire_with_their_job(tmp_path):
    clock = Clock()
    store = JobStore(tmp_path, 4, 60, clock=clock)
    job, created = store.submit(REQUEST, idempotency_key="k")
    assert created and store.submit(REQUEST, idempotency_key="k") == (store.get(job["id"]), False)
    store.claim(timeout=1)
    store.finish(job["id"], "cancelled")
    clock.now += 61
    store.sweep()
    again, created = store.submit(REQUEST, idempotency_key="k")
    assert created and again["id"] != job["id"]
