"""The splice request (`spec`, a JSON form field of POST /v1/splices), checked
before it is queued so a bad one is a 422 rather than a failed job.

    {"op": {"op": "REHARMONIZE", "from_bar": 25, "to_bar": 32, ...}   (bars 1-based, inclusive)
         | {"op": "REPEAT" | "CUT", "section": 3, "label": "chorus"},  (as /v1/scores/read lists sections)
     "base_abc": "<the base version's score>",
     "render_job": "<yue job id of the edited score's render>",        (REHARMONIZE only)
     "edited_abc": "<the plan's edited score>",                        (optional; else the render's score)
     "base_grid": {"grid_v": 1, ...}}                                  (optional; the server's cached grid)

Spec v2, a chain (F-069): `steps` = [{"op": {...}}, ...] in place of `op`
(never both), 2-4 of them, last bar first, no two sharing a bar
(splice_chain.validate); `render_job` is needed when any step is a
REHARMONIZE, and `edited_abc` is then the full edited score (every step's op
applied), which the chain maps REHARMONIZE spans into.

Only these three ops are spliced (D-154): REWRITE LYRICS, WRITE PHRASE and
every other edit render the whole song on the server's existing path.
"""
from __future__ import annotations

from score_model import Doc
from splice_chain import ChainError, validate
from splice_grid import GridError, score_bars, validate_grid

SPLICED = ("REHARMONIZE", "REPEAT", "CUT")
RENDERED = {"succeeded", "truncated"}


class SpecError(ValueError):
    def __init__(self, message: str, status: int = 422):
        super().__init__(message)
        self.status = status


def _score(abc, name: str) -> Doc:
    if not isinstance(abc, str) or not abc.strip():
        raise SpecError(f"{name} must be a score")
    try:
        score_bars(abc)
        return Doc(abc)
    except (ValueError, IndexError) as error:
        raise SpecError(f"{name} is not a native two-voice score: {error}") from None


def _int(op: dict, key: str) -> int:
    value = op.get(key)
    if not isinstance(value, int) or isinstance(value, bool):
        raise SpecError(f"op.{key} must be a whole number")
    return value


def span(op: dict, doc: Doc) -> tuple[int, int]:
    """The op's bars as a 0-based [start, end) range of the base score."""
    if op["op"] == "REHARMONIZE":
        first, last = _int(op, "from_bar"), _int(op, "to_bar")
        if not 1 <= first <= last <= doc.nbars():
            raise SpecError(f"bars {first}-{last} are not inside the score's {doc.nbars()} bars")
        return first - 1, last
    number, label = _int(op, "section"), str(op.get("label", "")).strip().strip("[]:").strip().lower()
    for index, name, first, last in doc.section_ranges():
        if index == number:
            if name.lower() != label:
                raise SpecError(f"section {number} is {name}, not {label or 'unlabelled'}")
            return first - 1, last
    raise SpecError(f"section {number} does not exist")


def _op(op) -> dict:
    if not isinstance(op, dict) or op.get("op") not in SPLICED:
        name = op.get("op") if isinstance(op, dict) else op
        raise SpecError(f"{name} is not spliced; the server renders the whole song for it")
    return op


def _steps(spec: dict, base: Doc) -> list[dict]:
    """Spec v2: `steps` = [{"op": {...}}, ...], last bar first (F-069, D-263)."""
    if not isinstance(spec["steps"], list) or not all(isinstance(st, dict) for st in spec["steps"]):
        raise SpecError("steps must be a list of {op}")
    steps = []
    for k, st in enumerate(spec["steps"], 1):
        op = _op(st.get("op"))
        try:
            steps.append({"op": op, "span": list(span(op, base))})
        except SpecError as error:
            raise SpecError(f"step {k}: {error}") from None
    try:
        validate(steps)
    except ChainError as error:
        raise SpecError(str(error)) from None
    return steps


def check_spec(spec, store) -> dict:
    if not isinstance(spec, dict) or ("op" in spec) == ("steps" in spec) or (
            "op" in spec and not isinstance(spec["op"], dict)):
        raise SpecError("spec must be a JSON object with an op or with steps (never both)")
    base = _score(spec.get("base_abc"), "base_abc")
    checked = {"base_abc": spec["base_abc"]}
    if "steps" in spec:
        checked["steps"] = _steps(spec, base)
        kinds = {st["op"]["op"] for st in checked["steps"]}
    else:
        op = _op(spec["op"])
        start, end = span(op, base)
        checked.update(op=op, span=[start, end])
        kinds = {op["op"]}
    if spec.get("base_grid") is not None:
        try:
            checked["base_grid"] = validate_grid(spec["base_grid"])
        except GridError as error:
            raise SpecError(f"base_grid: {error}") from None
    if "REHARMONIZE" in kinds:
        job_id = spec.get("render_job")
        job = store.get(job_id, kind="song") if isinstance(job_id, str) else None
        if job is None:
            raise SpecError("render_job must name a yue render job of this server")
        if job["status"] not in RENDERED:
            raise SpecError(f"render job {job_id} is {job['status']}, not rendered", status=409)
        checked["render_job"] = job_id
        if spec.get("edited_abc") is not None:
            _score(spec["edited_abc"], "edited_abc")
            checked["edited_abc"] = spec["edited_abc"]
    return checked
