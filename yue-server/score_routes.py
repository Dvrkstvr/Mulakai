"""POST /v1/scores/measure: a cover's score in the planner's tokens, per section,
so Mulakai can show what fits YuE2's 4096-token budget and let the user leave
sections out before GENERATE (PLAN.md, "YuE2 Covers: Pick the Score's
Sections"). The score is prepared exactly as POST /v1/jobs prepares it.

Section counts add up to the whole score's: the tokenizer never joins text
across a line break, and every section starts on its own line.
"""
from __future__ import annotations

from fastapi import Depends, FastAPI, HTTPException
from pydantic import BaseModel, Field

from scores import ScoreError, prepare_score, split_sections
from yue_pipeline import PLAN_TOKEN_BUDGET


class MeasureRequest(BaseModel):
    abc: str = Field(min_length=1, max_length=65536)


def add_score_routes(app: FastAPI, worker, authorize) -> None:
    @app.post("/v1/scores/measure", dependencies=[Depends(authorize)])
    def measure(request: MeasureRequest):
        if worker.state != "ready":
            raise HTTPException(503, "Inference worker is not ready", headers={"Retry-After": "5"})
        try:
            abc = prepare_score(request.abc, "melody")
        except ScoreError as error:
            raise HTTPException(422, str(error)) from None
        header, sections = split_sections(abc)
        return {
            "budget": PLAN_TOKEN_BUDGET,
            "header": worker.count_tokens(header) if header else 0,
            "sections": [{"name": name, "tokens": worker.count_tokens(body)} for name, body in sections],
        }
