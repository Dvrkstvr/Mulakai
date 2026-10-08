"""Re-time a transcription (PLAN.md "Re-time a Transcription", F-090).

GET /v1/transcriptions/{id}/notation: the saved files a rebuild needs (24 KB),
for the Mulakai server to keep (D-207); yue-server forgets jobs after 24 h.
POST /v1/scores/retime: those files plus HALF, DOUBLE or a BPM -> the rebuilt
score, checked as POST /v1/jobs checks a supplied score. CPU only (retimer.py).
Notes the slower grid cannot hold are counted in `dropped_notes` (D-210).
`downbeats` are the corrected beat list's bar starts (the same pure transform the
rebuild runs), so a chat reading times its re-timed bars on them (RT-5, F-092).
"""
from __future__ import annotations

import base64
import binascii
import re
from typing import Literal

from fastapi import Depends, FastAPI, HTTPException
from pydantic import BaseModel, Field

from retime_beats import BeatError, read_bpm, read_rows, transform
from retime_keep import KeepError, keep_sections_like
from retimer import FILES, RetimeError
from scores import ScoreError, parse_abc, prepare_score

MIN_BPM, MAX_BPM = 40, 240  # Q-129
TEMPO = re.compile(r"^Q:\s*1/4\s*=\s*(\d+(?:\.\d+)?)", re.M)


class RetimeRequest(BaseModel):
    files: dict[str, str] = Field(description="file name -> base64, as /notation returns them")
    mode: Literal["half", "double", "bpm"]
    bpm: float | None = None
    melody_only: bool = True
    keep_like: str | None = Field(default=None, max_length=65536,
                                  description="keep only this score's sections, by name in order (RT-4)")


def _fail(status: int, code: str, message: str):
    raise HTTPException(status, {"code": code, "message": message})


def _decode(files: dict[str, str]) -> dict[str, bytes]:
    out = {}
    for name in FILES:
        if name in files:
            try:
                out[name] = base64.b64decode(files[name], validate=True)
            except (binascii.Error, ValueError):
                _fail(422, "bad_bundle", f"{name} is not base64")
            if len(out[name]) > 512 * 1024:
                _fail(422, "bad_bundle", f"{name} is over 512 KB")
    return out


def _target_bpm(read: float, mode: str, bpm: float | None) -> float:
    target = {"half": read / 2, "double": read * 2}.get(mode, bpm)
    if target is None:
        _fail(422, "bad_request", "mode bpm needs a bpm")
    if not MIN_BPM <= round(target) <= MAX_BPM:
        _fail(422, "out_of_range", f"{round(target)} BPM is outside {MIN_BPM}-{MAX_BPM}")
    return target


def _facts(abc: str) -> dict:
    score = parse_abc(abc)
    voices = score.voices
    tempo = TEMPO.search(abc)
    vocal, ins = voices.get("Vocal"), voices.get("Ins")
    return {"measures": max((len(v.bars) for v in voices.values()), default=0),
            "bpm": float(tempo[1]) if tempo else None,
            "vocal_notes": len(vocal.notes) if vocal else 0, "ins_notes": len(ins.notes) if ins else 0}


def add_retime_routes(app: FastAPI, store, retimer, authorize) -> None:
    @app.get("/v1/transcriptions/{job_id}/notation", dependencies=[Depends(authorize)])
    def notation(job_id: str):
        job = store.get(job_id, kind="transcription")
        if job is None:
            raise HTTPException(404, "Job not found")
        if job["status"] != "succeeded":
            raise HTTPException(409, "Artifact is not available for this job state")
        folder = store.artifact_dir(job_id) / "notation"
        if not all((folder / name).is_file() for name in FILES):
            _fail(404, "no_bundle", "this transcription kept no notation files")
        return {"files": {name: base64.b64encode((folder / name).read_bytes()).decode("ascii") for name in FILES},
                "chords": bool((job.get("result") or {}).get("chords"))}

    @app.post("/v1/scores/retime", dependencies=[Depends(authorize)])
    def retime(request: RetimeRequest):
        status, detail = retimer.status()
        if status != "ready":
            raise HTTPException(503, f"Re-time is not available: {status}. {detail}".strip())
        files = _decode(request.files)
        if "song_beats.txt" not in files:
            _fail(422, "no_bundle", "the saved transcription has no beat list")
        try:
            read = read_bpm(read_rows(files["song_beats.txt"].decode("utf-8")))
        except (BeatError, UnicodeDecodeError, ValueError) as error:
            _fail(422, "bad_bundle", f"the beat list cannot be read: {error}")
        target = _target_bpm(read, request.mode, request.bpm)
        bpm = target if request.mode == "bpm" else None
        downbeats = [round(row[0], 4) for row in transform(read_rows(files["song_beats.txt"].decode("utf-8")),
                                                          request.mode, bpm) if row[1] == 1]
        try:
            out = retimer.run(files, request.mode, bpm, request.melody_only)
        except RetimeError as error:
            _fail(502 if error.code == "retime_failed" else 422, error.code, str(error))
        left_out: list[str] = []
        if request.keep_like:
            try:
                out["abc"], left_out = keep_sections_like(out["abc"], request.keep_like)
            except KeepError as error:
                _fail(422, "retime_refused", str(error))
        try:
            prepare_score(out["abc"], "melody")
            facts = _facts(out["abc"])
        except (ScoreError, ValueError, KeyError) as error:
            _fail(422, "retime_refused", f"the rebuilt score does not parse: {error}")
        return {"abc": out["abc"], **facts, "read_bpm": round(read, 1), "notes": out["notes"],
                "dropped_notes": out["dropped"], "stretched_notes": out["stretched"],
                "left_out": left_out, "downbeats": downbeats, "warnings": out.get("diagnostics", [])}
