"""Contract fixtures (D-039): each score-route request and the reply pytest
saw, saved under tests/data/contract/ for the server's TypeScript fake yue
to replay, so the fake cannot drift from the real route. A normal run checks
the saved reply still matches; `python -m pytest --record-contract` rewrites
them. Never edit them by hand."""
from __future__ import annotations

import json
from pathlib import Path

DIR = Path(__file__).parent / "data" / "contract"


def check_contract(record: bool, name: str, path: str, body: dict, reply) -> None:
    entry = {"name": name,
             "request": {"method": "POST", "path": path, "body": body},
             "response": {"status": reply.status_code, "body": reply.json()}}
    file = DIR / f"{name}.json"
    if record:
        DIR.mkdir(parents=True, exist_ok=True)
        with file.open("w", encoding="utf-8", newline="\n") as handle:
            handle.write(json.dumps(entry, indent=1, ensure_ascii=False) + "\n")
        return
    hint = "run `python -m pytest --record-contract` and commit the result"
    assert file.is_file(), f"no contract fixture {file.name}; {hint}"
    assert json.loads(file.read_text(encoding="utf-8")) == entry, f"{file.name} is stale; {hint}"
