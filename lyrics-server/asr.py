"""
faster-whisper with the settings PLAN.md's "Cover lyrics spike results"
picked for sung words: beam 5, no conditioning on the previous text (with it,
large-v3 loops on sung repeats), word timings, no VAD (it drops whispered
singing and most of a mix).
"""
import gc
from pathlib import Path
from typing import Any, Callable, Optional

SETTINGS = {"beam_size": 5, "condition_on_previous_text": False, "word_timestamps": True, "vad_filter": False}


def _t(seconds: float) -> float:
    return round(float(seconds), 2)


def _segment(seg: Any) -> dict:
    return {
        "text": seg.text.strip(),
        "start": _t(seg.start),
        "end": _t(seg.end),
        "words": [{"text": w.word.strip(), "start": _t(w.start), "end": _t(w.end)} for w in (seg.words or [])],
    }


def make_transcriber(load_model: Callable[[], Any]) -> Callable[[Path, Optional[str]], dict]:
    """The model is loaded per job and freed afterwards, handing its VRAM back
    to ACE-Step and the engines between jobs."""

    def transcribe(path: Path, language: Optional[str]) -> dict:
        model = load_model()
        try:
            segments, info = model.transcribe(str(path), language=language, **SETTINGS)
            # A lazy generator: decoding happens here, so it must finish before the model goes.
            out = [_segment(s) for s in segments]
        finally:
            del model
            gc.collect()
        return {"language": info.language, "segments": out}

    return transcribe
