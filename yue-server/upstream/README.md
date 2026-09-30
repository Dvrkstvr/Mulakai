# Vendored: YuE2 instrumental score tools

Copied unmodified from `skills/yue2-music/instrumental/scripts/` in
https://github.com/multimodal-art-projection/YuE at commit
`72272f907522dcca2e97c848d6c8f0d343999183`. MIT licensed (see `LICENSE`);
standard library only.

| File | What it does |
| --- | --- |
| `instrumentalize.py` | `convert_score`: moves every `Vocal` note of a native YuE2 score to `Ins`, and checks the move note for note |
| `abc_tools.py` | `parse_abc`: the native two-voice ABC dialect parser |
| `compile_score.py` | `compile_events`: writes events back out as native ABC |
| `common.py` | small helpers the three import |

**Do not edit these files.** They import each other by bare module name, so
`../instrumental.py` puts this folder on `sys.path`. To update, copy the
files from a newer upstream commit, update the hash above, and rerun
`python -m pytest`.
