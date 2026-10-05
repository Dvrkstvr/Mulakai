"""POST /v1/scores/read and POST /v1/scores/apply: the score agent's CPU-only
routes (docs/decisions/0002). Mulakai's server asks `read` whether a song's
score can be edited and what the planner should be told, and `apply` to run
a plan's ops and check the result. Neither touches the pipeline's GPU path:
the only worker call is the tokenizer (under its lock, D-042), and tokens
are null until the worker has loaded. Tokens are counted with chord symbols
kept, as a `cot: full` render sends the score (unlike /v1/scores/measure).
WRITE_PHRASE's contract (op shape, refusals) is in README "Score routes".
"""
from __future__ import annotations

from typing import Annotated, Literal, Union

from fastapi import Depends, FastAPI, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator

from score_check import check_edit, verdict
from score_facts import read_facts, seconds
from score_ops import QUALITIES, ROOTS, apply_ops
from score_phrase import BEATS, MAX_BARS, MAX_NOTES, PITCH
from scores import parse_abc

Root = Literal[ROOTS]


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Chord(Strict):
    bar: int = Field(ge=1)
    beat: int = Field(ge=1, le=12)
    root: Root
    quality: Literal[QUALITIES]
    bass: Root | None = None


class SetTempo(Strict):
    op: Literal["SET_TEMPO"]
    bpm: int = Field(ge=40, le=240)


class Reharmonize(Strict):
    op: Literal["REHARMONIZE"]
    from_bar: int = Field(ge=1)
    to_bar: int = Field(ge=1)
    chords: list[Chord] = Field(min_length=1, max_length=96)


class EditStyle(Strict):
    op: Literal["EDIT_STYLE"]
    style: str = Field(min_length=1, max_length=1000)


class Note(Strict):
    pitch: str = Field(pattern=PITCH)
    beats: float

    @field_validator("beats")
    @classmethod
    def _beats(cls, value: float) -> float:
        if value not in BEATS:
            raise ValueError("beats must be one of " + ", ".join(f"{b:g}" for b in BEATS))
        return value


class WritePhrase(Strict):
    op: Literal["WRITE_PHRASE"]
    start_bar: int = Field(ge=1)
    instrument: str = Field(min_length=1, max_length=40)
    bars: list[Annotated[list[Note], Field(min_length=1, max_length=MAX_NOTES)]] = Field(
        min_length=1, max_length=MAX_BARS)

    @field_validator("bars", mode="before")
    @classmethod
    def _no_abc(cls, value):
        if isinstance(value, str) or (isinstance(value, list) and any(isinstance(b, str) for b in value)):
            raise ValueError("bars are arrays of {pitch, beats} notes; ABC strings are not accepted")
        return value


Op = Annotated[Union[SetTempo, Reharmonize, EditStyle, WritePhrase], Field(discriminator="op")]


class ReadRequest(Strict):
    abc: str = Field(min_length=1, max_length=65536)
    lyrics: str = Field(default="", max_length=65536)


class ApplyRequest(Strict):
    abc: str = Field(min_length=1, max_length=65536)
    style: str = Field(default="", max_length=2000)
    ops: list[Op] = Field(min_length=1, max_length=6)


def _parsed(abc: str):
    try:
        return parse_abc(abc)
    except ValueError:  # reported in checks.problems
        return None


def add_score_edit_routes(app: FastAPI, worker, authorize) -> None:
    @app.post("/v1/scores/read", dependencies=[Depends(authorize)])
    def read(request: ReadRequest):
        result = verdict(request.abc)
        facts = read_facts(request.abc, request.lyrics) if result["ok"] else None
        return {**result,
                "bpm": facts["header"]["bpm"] if facts else None,
                "seconds": facts["header"]["seconds"] if facts else None,
                "tokens": worker.count_tokens(request.abc) if facts else None,
                "facts": facts}

    @app.post("/v1/scores/apply", dependencies=[Depends(authorize)])
    def apply(request: ApplyRequest):
        base = verdict(request.abc)
        if not base["ok"]:
            raise HTTPException(422, f"Not a score in YuE2's native two-voice ABC: {base['error']}")
        ops = [op.model_dump(exclude_none=True) for op in request.ops]
        out = apply_ops(request.abc, request.style, ops)
        checks = check_edit(request.abc, out["abc"], [op for op, v in zip(ops, out["verdicts"]) if v["ok"]])
        after = _parsed(out["abc"])
        return {"ok": checks["ok"] and all(v["ok"] for v in out["verdicts"]), **out, "checks": checks,
                "changed": {"abc": out["abc"] != request.abc, "style": out["style"] != request.style},
                "chords_present": bool(after.voices["Vocal"].chords) if after else None,
                "bpm": after.bpm if after else None,
                "seconds": seconds(after) if after else None,
                "tokens": worker.count_tokens(out["abc"])}
