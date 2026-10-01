import os

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from job_files import JobFiles

TTL = 60


class Clock:
    def __init__(self):
        self.now = 1_000_000.0

    def __call__(self):
        return self.now


@pytest.fixture
def setup(tmp_path):
    clock = Clock()
    files = JobFiles(tmp_path, TTL, clock)
    app = FastAPI()
    files.mount(app)
    return files, TestClient(app), clock, tmp_path


def finished_job(files, stems=("a", "b")):
    job_dir = files.new_job()
    paths = {}
    for name in stems:
        path = job_dir / "out" / f"{name}.wav"
        path.parent.mkdir(exist_ok=True)
        path.write_bytes(name.encode())
        paths[name] = path
    return job_dir, files.publish(job_dir, paths)


def test_publish_maps_kinds_to_paths_under_the_job(setup):
    files, *_ = setup
    job_dir, rel = finished_job(files)
    assert rel == {"a": f"{job_dir.name}/out/a.wav", "b": f"{job_dir.name}/out/b.wav"}


def test_each_stem_is_served_once_then_deleted(setup):
    files, client, _, _ = setup
    job_dir, rel = finished_job(files)

    res = client.get(f"/audio/{rel['a']}")
    assert res.status_code == 200
    assert res.content == b"a"
    assert not (job_dir / "out" / "a.wav").exists()
    assert (job_dir / "out" / "b.wav").exists()
    assert client.get(f"/audio/{rel['a']}").status_code == 404


def test_last_download_removes_the_job_dir(setup):
    files, client, _, data_dir = setup
    _, rel = finished_job(files)
    for path in rel.values():
        assert client.get(f"/audio/{path}").status_code == 200
    assert list(data_dir.iterdir()) == []


def test_only_published_stems_are_served(setup):
    files, client, _, _ = setup
    job_dir, _ = finished_job(files)
    (job_dir / "secret.txt").write_text("x")
    assert client.get(f"/audio/{job_dir.name}/secret.txt").status_code == 404
    assert files.resolve(job_dir.name, f"../{job_dir.name}/out/a.wav") is None
    assert client.get("/audio/nope/out/a.wav").status_code == 404


def test_discard_removes_a_failed_job(setup):
    files, _, _, data_dir = setup
    job_dir = files.new_job()
    (job_dir / "source.wav").write_bytes(b"x")
    files.discard(job_dir)
    assert list(data_dir.iterdir()) == []


def test_sweep_removes_unfetched_jobs_once_expired(setup):
    files, client, clock, data_dir = setup
    job_dir, rel = finished_job(files)

    clock.now += TTL - 1
    files.sweep()
    assert job_dir.exists()

    clock.now += 2
    files.sweep()
    assert list(data_dir.iterdir()) == []
    assert client.get(f"/audio/{rel['a']}").status_code == 404


def test_sweep_leaves_a_running_job_alone(setup):
    files, _, clock, _ = setup
    job_dir = files.new_job()
    os.utime(job_dir, (0, 0))
    clock.now += TTL * 10
    files.sweep()
    assert job_dir.exists()


def test_sweep_ages_leftovers_from_a_previous_run_by_mtime(setup):
    files, _, clock, data_dir = setup
    old = data_dir / "old-job"
    (old / "htdemucs").mkdir(parents=True)
    (old / "htdemucs" / "vocals.wav").write_bytes(b"x")
    os.utime(old, (clock.now - TTL - 1, clock.now - TTL - 1))
    fresh = data_dir / "fresh-job"
    fresh.mkdir()
    os.utime(fresh, (clock.now, clock.now))

    files.sweep()
    assert not old.exists()
    assert fresh.exists()
