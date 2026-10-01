import pytest
from fastapi.testclient import TestClient

from api import create_app
from conftest import FakeRunners

STEMS = {"vocals", "drums", "bass", "other"}


@pytest.fixture
def setup(tmp_path):
    runners = FakeRunners()
    freed = []
    app = create_app(runners.mdx, runners.demucs, lambda: freed.append(1), tmp_path, "vox", "htdemucs")
    return TestClient(app), runners, freed, tmp_path


def post(client):
    return client.post("/split", files={"audio": ("song.flac", b"fake", "audio/flac")})


def test_health_names_both_models(setup):
    client, *_ = setup
    assert client.get("/health").json() == {
        "ok": True, "backend": "uvr", "model": "vox", "demucs_model": "htdemucs",
    }


def test_split_returns_downloadable_urls_for_all_four_stems(setup):
    client, runners, freed, _ = setup
    res = post(client)

    assert res.status_code == 200
    stems = res.json()["stems"]
    assert set(stems) == STEMS
    for url in stems.values():
        assert url.startswith("http://testserver/audio/")
        assert client.get(url).status_code == 200
    assert runners.calls[0][1]["audio_file"].endswith("source.flac")
    assert freed == [1]


def test_split_keeps_only_the_served_stems(setup):
    client, _, _, data_dir = setup
    post(client)

    names = sorted(p.name for p in data_dir.rglob("*") if p.is_file())
    assert names == ["inst_(Bass).wav", "inst_(Drums).wav", "inst_(Other).wav", "mix_(Vocals).wav"]


def test_failed_split_is_a_500_and_still_frees_the_gpu(tmp_path):
    freed = []

    def broken(**_):
        raise KeyError("hyper_parameters")

    app = create_app(broken, broken, lambda: freed.append(1), tmp_path, "vox", "htdemucs")
    res = post(TestClient(app))

    assert res.status_code == 500
    assert "hyper_parameters" in res.json()["detail"]
    assert freed == [1]
    assert not any(p.name.startswith("source") for p in tmp_path.rglob("*"))
