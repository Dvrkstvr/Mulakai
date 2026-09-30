"""SheetSage2 transcription, the second job kind (PLAN.md, "yue-server
transcription decisions"). SheetSage2 pins its own torch/Transformers/NumPy,
so it runs as a subprocess from its own venv: `infer.py <audio> --melody-only
--render-audio`, which keeps both melody voices and drops chord symbols.

Success is decided by the score, not the exit code: a failed piano render
exits 1 but still writes score.abc (the spike hit exactly this).
"""
from __future__ import annotations

import collections
import json
import logging
import os
import re
import signal
import subprocess
import threading
import time
from pathlib import Path

log = logging.getLogger("yue-server")

WINDOW = re.compile(r"^Window (\d+)/(\d+)")
COPIED = ("warnings", "abc_measures", "vocal_notes", "instrumental_notes", "duration_seconds")


class TranscriptionError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


class Transcriber:
    def __init__(self, python: str, sheetsage_dir: str):
        self.python, self.dir = python, Path(sheetsage_dir) if sheetsage_dir else None

    def status(self) -> tuple[str, str]:
        """('ready' | 'not_configured' | 'missing_files', detail)."""
        if not self.python or self.dir is None:
            return "not_configured", "YUE_SHEETSAGE_PYTHON and YUE_SHEETSAGE_DIR are not both set"
        needed = [Path(self.python), self.dir / "infer.py", self.dir / "model.safetensors"]
        missing = [str(path) for path in needed if not path.is_file()]
        return ("missing_files", "not found: " + ", ".join(missing)) if missing else ("ready", "")

    def run(self, source: Path, out: Path, *, cancelled, on_progress) -> dict:
        """Transcribe into `out`; returns the result facts plus `preview` (bool)."""
        command = [self.python, str(self.dir / "infer.py"), str(source), "--output", str(out),
                   "--melody-only", "--render-audio", "--local-files-only"]
        tail: collections.deque[str] = collections.deque(maxlen=12)
        with (out / "sheetsage.log").open("w", encoding="utf-8") as log_file:
            proc = subprocess.Popen(command, cwd=self.dir, stdout=subprocess.PIPE,
                                    stderr=subprocess.STDOUT, text=True, encoding="utf-8",
                                    errors="replace", start_new_session=os.name == "posix")
            reader = threading.Thread(target=_read, args=(proc, log_file, tail, on_progress), daemon=True)
            reader.start()
            while proc.poll() is None:
                if cancelled():
                    _kill(proc)
                    reader.join(5)
                    raise InterruptedError("Cancelled during transcription")
                time.sleep(0.1)
            reader.join(5)
        return _collect(out, proc.returncode, " | ".join(tail))


def _read(proc, log_file, tail, on_progress) -> None:
    for line in proc.stdout:
        log_file.write(line)
        tail.append(line.strip())
        if match := WINDOW.match(line):
            # "Window i/n" is printed as window i starts encoding.
            on_progress((int(match[1]) - 1) / int(match[2]))


def _kill(proc) -> None:
    if os.name == "posix":
        os.killpg(proc.pid, signal.SIGKILL)  # infer.py's own children too
    else:
        proc.kill()
    proc.wait()


def _collect(out: Path, returncode: int, tail: str) -> dict:
    report_path, score = out / "result.json", out / "score.abc"
    report = json.loads(report_path.read_text(encoding="utf-8")) if report_path.is_file() else {}
    if report.get("abc_error"):
        raise TranscriptionError("no_score", f"SheetSage2 built no score: {report['abc_error']}")
    if not score.is_file() or not score.read_text(encoding="utf-8").strip():
        raise TranscriptionError("transcription_failed", f"SheetSage2 exited {returncode}: {tail}")
    facts = {key: report.get(key) for key in COPIED}
    facts["warnings"] = [str(w) for w in facts["warnings"] or []]
    if report.get("render_error"):
        facts["warnings"].append(f"No piano preview: {report['render_error']}")
    facts["preview"] = (out / "piano_mix.wav").is_file()
    if returncode:
        log.warning("SheetSage2 exited %s but wrote a score: %s", returncode, tail)
    return facts


def run_transcription(transcriber: Transcriber, store, job_id: str, request: dict) -> None:
    started = time.monotonic()
    out = store.artifact_dir(job_id)
    out.mkdir(parents=True, exist_ok=True)
    store.progress(job_id, stage="transcribing", progress=None)
    log.info("transcription %s started (%s)", job_id, request["filename"])
    try:
        facts = transcriber.run(Path(request["source"]), out, cancelled=lambda: store.cancelled(job_id),
                                on_progress=lambda fraction: store.progress(job_id, progress=fraction))
        preview = facts.pop("preview")
        result = {"score_url": f"/v1/transcriptions/{job_id}/score",
                  "preview_url": f"/v1/transcriptions/{job_id}/preview" if preview else None,
                  "measures": facts.pop("abc_measures"), **facts,
                  "timing": {"total_seconds": round(time.monotonic() - started, 3)}}
        outcome = ("succeeded", result, None)
    except InterruptedError:
        outcome = ("cancelled", None, None)
    except TranscriptionError as error:
        outcome = ("failed", None, {"code": error.code, "message": str(error)})
    except Exception as error:  # every failure must reach the job record
        log.error("transcription failed", exc_info=error)
        outcome = ("failed", None, {"code": "transcription_failed", "message": f"{type(error).__name__}: {error}"})
    status, result, error = outcome
    log.info("transcription %s %s%s", job_id, status, f": {error['message']}" if error else "")
    store.finish(job_id, status, result=result, error=error)
