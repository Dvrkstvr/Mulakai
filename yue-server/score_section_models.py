"""The op shapes of REPEAT, CUT (F-030) and REWRITE_LYRICS (F-031) on
POST /v1/scores/apply; the contract is in README "API". A section is the
number /read shows (`facts.sections[].index`, the bar map's `S<n>`) with its
label as a cross-check; a lyric block is its number in `facts.lyric_blocks`
with its tag and occurrence as the cross-check."""
from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Repeat(_Strict):
    op: Literal["REPEAT"]
    section: int = Field(ge=1)
    label: str = Field(min_length=1, max_length=40)


class Cut(_Strict):
    op: Literal["CUT"]
    section: int = Field(ge=1)
    label: str = Field(min_length=1, max_length=40)


class RewriteLyrics(_Strict):
    op: Literal["REWRITE_LYRICS"]
    block: int = Field(ge=1)
    tag: str = Field(max_length=60)
    occurrence: int = Field(ge=1)
    lines: list[Annotated[str, Field(max_length=200)]] = Field(min_length=1, max_length=32)
