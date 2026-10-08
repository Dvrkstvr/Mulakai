"""Runs retime_cli.py with SheetSage2's python (as transcriber.py runs infer.py):
CPU only, milliseconds of work, so it never takes the worker's queue slot.
The saved files arrive from the caller (the Mulakai server keeps them, D-207),
so a re-time does not depend on yue-server still holding the transcription.
"""
from __future__ import annotations

import json
import subprocess
import tempfile
from pathlib import Path

CLI = Path(__file__).resolve().parent / "retime_cli.py"
FILES = ("song_melody.mid", "song_beats.txt", "song_chords.txt", "song_keys.txt", "song_structures.txt")
TIMEOUT_SECONDS = 60


class RetimeError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


class Retimer:
    def __init__(self, python: str, sheetsage_dir: str):
        self.python, self.dir = python, Path(sheetsage_dir) if sheetsage_dir else None

    def status(self) -> tuple[str, str]:
        """('ready' | 'not_configured' | 'missing_files', detail)."""
        if not self.python or self.dir is None:
            return "not_configured", "YUE_SHEETSAGE_PYTHON and YUE_SHEETSAGE_DIR are not both set"
        needed = [Path(self.python), self.dir / "notation_sheetsage2.py"]
        missing = [str(path) for path in needed if not path.is_file()]
        return ("missing_files", "not found: " + ", ".join(missing)) if missing else ("ready", "")

    def run(self, files: dict[str, bytes], mode: str, bpm: float | None, melody_only: bool) -> dict:
        missing = [name for name in FILES if name not in files]
        if missing:
            raise RetimeError("no_bundle", "the saved transcription is missing " + ", ".join(missing))
        with tempfile.TemporaryDirectory(prefix="retime-") as work:
            folder = Path(work) / "notation"
            folder.mkdir()
            for name in FILES:
                (folder / name).write_bytes(files[name])
            command = [self.python, str(CLI), str(self.dir), work, mode,
                       "-" if bpm is None else repr(float(bpm)), "1" if melody_only else "0"]
            try:
                proc = subprocess.run(command, cwd=self.dir, capture_output=True, text=True,
                                      encoding="utf-8", errors="replace", timeout=TIMEOUT_SECONDS)
            except subprocess.TimeoutExpired:
                raise RetimeError("retime_failed", f"the rebuild took over {TIMEOUT_SECONDS} s") from None
        lines = [line for line in proc.stdout.splitlines() if line.startswith("{")]
        try:
            out = json.loads(lines[-1])
        except (IndexError, json.JSONDecodeError):
            tail = " | ".join((proc.stderr or proc.stdout).strip().splitlines()[-3:])
            raise RetimeError("retime_failed", f"the rebuild exited {proc.returncode}: {tail}") from None
        if "error" in out:
            raise RetimeError("retime_refused", out["error"])
        return out
