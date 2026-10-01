import sys
import threading
from concurrent.futures import ThreadPoolExecutor

from fastapi.testclient import TestClient

from api import create_app

STEMS = ("vocals", "drums", "bass", "other")


def fake_separate(src, job_dir):
    """Writes what demucs.separate.main() would: job_dir/<model>/<stem>.wav."""
    assert src.is_file()
    out = job_dir / "htdemucs"
    out.mkdir()
    for stem in STEMS:
        (out / f"{stem}.wav").write_bytes(stem.encode())
    return {stem: out / f"{stem}.wav" for stem in STEMS}


def client_for(tmp_path, separate=fake_separate):
    return TestClient(create_app(separate, tmp_path, "htdemucs"))


def post(client):
    return client.post("/split", files={"audio": ("song.mp3", b"fake", "audio/mpeg")})


def test_health_names_the_model(tmp_path):
    assert client_for(tmp_path).get("/health").json() == {"ok": True, "model": "htdemucs"}


def test_split_returns_downloadable_urls_for_every_stem(tmp_path):
    client = client_for(tmp_path)
    stems = post(client).json()["stems"]

    assert set(stems) == set(STEMS)
    for kind, url in stems.items():
        assert url.startswith("http://testserver/audio/")
        assert url.endswith(f"/htdemucs/{kind}.wav")
        res = client.get(url)
        assert res.status_code == 200
        assert res.content == kind.encode()


def test_source_is_removed_once_separated(tmp_path):
    post(client_for(tmp_path))
    assert not any(p.name.startswith("source") for p in tmp_path.rglob("*"))


def test_downloading_every_stem_leaves_the_data_dir_empty(tmp_path):
    client = client_for(tmp_path)
    for url in post(client).json()["stems"].values():
        assert client.get(url).status_code == 200
    assert list(tmp_path.iterdir()) == []


def test_undecodable_upload_is_a_500_and_leaves_nothing_behind(tmp_path):
    def exits(src, job_dir):
        (job_dir / "htdemucs").mkdir()
        sys.exit(1)  # what demucs.separate.main() does on a file it can't load

    res = post(client_for(tmp_path, exits))
    assert res.status_code == 500
    assert "separation failed" in res.json()["detail"]
    assert list(tmp_path.iterdir()) == []


def test_no_stems_is_a_500(tmp_path):
    res = post(client_for(tmp_path, lambda src, job_dir: {}))
    assert res.status_code == 500
    assert list(tmp_path.iterdir()) == []


def test_health_answers_while_a_split_runs(tmp_path):
    started, release = threading.Event(), threading.Event()

    def slow(src, job_dir):
        started.set()
        assert release.wait(10)
        return fake_separate(src, job_dir)

    with client_for(tmp_path, slow) as client, ThreadPoolExecutor(2) as pool:
        pending = pool.submit(post, client)
        try:
            assert started.wait(10)
            # A blocked event loop would hang this, so it gets a deadline.
            assert pool.submit(client.get, "/health").result(5).status_code == 200
        finally:
            release.set()
        assert pending.result(10).status_code == 200
