"""POST /v1/jobs body. Field names are heartlib's own, so Mulakai's
engines/heartmula.ts `toRequest` is the only place that renames anything.
None = the engine's default (Mulakai's AUTO)."""
import os

from pydantic import BaseModel, ConfigDict, Field, field_validator

AUTO_MAX_AUDIO_LENGTH_MS = 240_000  # heartlib CLI default; the pipeline's 120 s cut songs short in the spike


class GenerateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)

    tags: str = Field(default="", max_length=2000)  # comma-separated, no spaces: "piano,happy,wedding"
    lyrics: str = Field(min_length=1, max_length=16000)
    max_audio_length_ms: int = Field(default=AUTO_MAX_AUDIO_LENGTH_MS, ge=10_000, le=360_000, strict=True)
    cfg_scale: float | None = Field(default=None, ge=1.0, le=10.0)
    temperature: float | None = Field(default=None, gt=0.0, le=2.0)
    topk: int | None = Field(default=None, ge=1, le=1000, strict=True)

    @field_validator("lyrics")
    @classmethod
    def lyrics_not_blank(cls, value: str) -> str:
        # heartlib indexes the first lyric token, so empty lyrics crash the LM stage.
        if not value.strip():
            raise ValueError("lyrics must not be blank (HeartMuLa has no instrumental mode)")
        return value

    @field_validator("tags", "lyrics")
    @classmethod
    def not_a_file_path(cls, value: str) -> str:
        # heartlib's preprocess reads the value as a file when it names one on
        # this machine, which would let a request sing any readable file.
        if value and os.path.isfile(value):
            raise ValueError("must be text, not a path to a file")
        return value
