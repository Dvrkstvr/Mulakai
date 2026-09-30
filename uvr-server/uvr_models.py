"""
Model-lookup workarounds for uvr-headless-runner 1.1.0 (pinned in README.md;
re-check both on any upgrade):

- Roformer models by registry name. The UVR GUI merges UVR's online
  hash -> config table (MDX_MODEL_DATA_URL) into its local one, and that table
  is where Roformer checkpoints are marked `is_roformer` with their YAML
  config. The runner never fetches it, so it treats them as plain MDX-Net and
  fails with KeyError 'hyper_parameters'. We look the checkpoint's hash up
  there ourselves and hand the entry over as `model_json_path`.
- Demucs v4 by name on first download. `resolve_model_path` then returns the
  `.th` weights, not the `{name}.yaml` bag Demucs loads by. Looking the name up
  again once the files exist finds the yaml.
"""
import json
import urllib.request
from pathlib import Path
from typing import Callable, Optional

MDX_MODEL_DATA_URL = (
    "https://raw.githubusercontent.com/TRvlvr/application_data/main/mdx_model_data/model_data_new.json"
)


def _fetch_json(url: str) -> dict:
    with urllib.request.urlopen(url, timeout=30) as res:
        return json.load(res)


def mdx_config_json(
    model_hash: str, cache_dir: Path, fetch: Callable[[str], dict] = _fetch_json
) -> Optional[Path]:
    """The upstream config entry for `model_hash`, cached as a JSON file the
    runner accepts as `model_json_path`. None when upstream has no entry; the
    runner's own lookups then apply."""
    target = cache_dir / f"{model_hash}.json"
    if target.is_file():
        return target
    entry = fetch(MDX_MODEL_DATA_URL).get(model_hash)
    if entry is None:
        return None
    cache_dir.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(entry), encoding="utf-8")
    return target


def demucs_model_path(
    name: str,
    find: Callable[[str], Optional[str]],
    resolve: Callable[..., str],
) -> str:
    """`find` is the runner's find_demucs_model_path, `resolve` its
    resolve_model_path (which downloads)."""
    path = find(name)
    if path is None:
        resolve(name, verbose=False)
        path = find(name)
    if path is None:
        raise FileNotFoundError(f"Demucs model not found after download: {name}")
    return path
