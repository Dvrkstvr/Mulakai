"""The POST /v1/jobs body, validated before anything reaches the pipeline."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class GenerateRequest(BaseModel):
    """yue2-serve's body, minus `n` (one take per job), plus a tolerated `id`
    (Mulakai sends its job id as the Idempotency-Key header instead, which
    yue2-serve also accepts). `seed` is required: YuE's default is a fixed
    831001, so omitting it would silently repeat the same song. `abc` is a
    supplied score, for covers only; scores.py checks it further before it
    is queued (PLAN.md, "yue-server transcription decisions")."""
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    style: str = Field(min_length=1, max_length=2000)
    lyrics: str = Field(max_length=16000)
    cot: Literal["full", "melody", "off"] = "full"
    seed: int = Field(ge=0, lt=2**63, strict=True)
    cfg_scale: float | None = Field(default=None, ge=0, le=20)
    id: str | None = Field(default=None, pattern=r"^[A-Za-z0-9][A-Za-z0-9_.-]{0,179}$")
    abc: str | None = Field(default=None, min_length=1, max_length=65536)

    @field_validator("style")
    @classmethod
    def nonblank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Text must not be blank")
        return value

    @field_validator("abc")
    @classmethod
    def score_not_blank(cls, value: str | None) -> str | None:
        if value is not None and not value.strip():
            raise ValueError("abc must not be blank")
        return value

    @model_validator(mode="after")
    def score_needs_a_plan_mode(self) -> "GenerateRequest":
        if self.abc is not None and self.cot == "off":
            raise ValueError("cot 'off' generates without a score; use 'melody' or 'full' with abc")
        return self
