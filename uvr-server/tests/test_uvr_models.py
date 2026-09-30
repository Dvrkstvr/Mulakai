import json

import pytest

from uvr_models import MDX_MODEL_DATA_URL, demucs_model_path, mdx_config_json

ROFORMER = {"config_yaml": "model_bs_roformer.yaml", "is_roformer": True}


class Fetch:
    def __init__(self, table):
        self.table, self.urls = table, []

    def __call__(self, url):
        self.urls.append(url)
        return self.table


def test_writes_the_upstream_entry_for_the_hash(tmp_path):
    fetch = Fetch({"abc": ROFORMER})
    path = mdx_config_json("abc", tmp_path / "configs", fetch)

    assert json.loads(path.read_text(encoding="utf-8")) == ROFORMER
    assert fetch.urls == [MDX_MODEL_DATA_URL]


def test_reuses_the_cached_entry(tmp_path):
    fetch = Fetch({"abc": ROFORMER})
    first = mdx_config_json("abc", tmp_path, fetch)
    second = mdx_config_json("abc", tmp_path, fetch)

    assert first == second
    assert len(fetch.urls) == 1


def test_unknown_hash_leaves_it_to_the_runner(tmp_path):
    assert mdx_config_json("nope", tmp_path, Fetch({"abc": ROFORMER})) is None
    assert list(tmp_path.iterdir()) == []


def test_demucs_uses_an_installed_model_without_resolving():
    def resolve(name, **_):
        raise AssertionError("should not download")

    assert demucs_model_path("htdemucs", lambda n: f"/m/{n}.yaml", resolve) == "/m/htdemucs.yaml"


def test_demucs_looks_again_after_download():
    installed = set()

    def find(name):
        return f"/m/{name}.yaml" if name in installed else None

    def resolve(name, **_):
        installed.add(name)
        return "/m/955717e8-8726e21a.th"  # what the runner hands back on first download

    assert demucs_model_path("htdemucs", find, resolve) == "/m/htdemucs.yaml"


def test_demucs_still_missing_after_download_raises():
    with pytest.raises(FileNotFoundError, match="htdemucs"):
        demucs_model_path("htdemucs", lambda n: None, lambda n, **_: "/m/x.th")
