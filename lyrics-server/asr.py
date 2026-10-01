"""
faster-whisper with the settings PLAN.md's "Cover lyrics spike results"
picked for sung words: beam 5, no conditioning on the previous text (with it,
large-v3 loops on sung repeats), word timings, no VAD (it drops whispered
singing and most of a mix).

Without a given language it transcribes multilingual, detecting the language
of every 30 s window: Whisper otherwise takes the first window's language for
the whole song, and on a German song with an English-sounding intro it then
*translated* the German verses into English (PLAN.md "READ LYRICS on COVER ·
YUE2", browser check).
"""
import collections
import gc
from pathlib import Path
from typing import Any, Callable, Optional, Sequence

from hallucinations import drop_hallucinations

SETTINGS = {"beam_size": 5, "condition_on_previous_text": False, "word_timestamps": True, "vad_filter": False}
SAMPLE_RATE = 16000
WINDOW = 30 * SAMPLE_RATE


def _t(seconds: float) -> float:
    return round(float(seconds), 2)


def _segment(seg: Any) -> dict:
    return {
        "text": seg.text.strip(),
        "start": _t(seg.start),
        "end": _t(seg.end),
        "words": [{"text": w.word.strip(), "start": _t(w.start), "end": _t(w.end)} for w in (seg.words or [])],
    }


def dominant_language(model: Any, audio: Sequence[float], segments: list[dict]) -> Optional[str]:
    """The language most sung words are in: each 30 s window holding words votes its detected
    language, weighted by its word count. Stock subtitle lines don't vote; they are what
    Whisper writes over the instrumental windows, in English."""
    votes: collections.Counter[str] = collections.Counter()
    words = [(w["start"] + w["end"]) / 2 for s in drop_hallucinations(segments) for w in s["words"]]
    for start in range(0, len(audio), WINDOW):
        lo, hi = start / SAMPLE_RATE, (start + WINDOW) / SAMPLE_RATE
        count = sum(1 for mid in words if lo <= mid < hi)
        if count:
            language, _probability, _all = model.detect_language(audio=audio[start:start + WINDOW])
            votes[language] += count
    return votes.most_common(1)[0][0] if votes else None


def make_transcriber(
    load_model: Callable[[], Any], load_audio: Callable[[Path], Sequence[float]],
) -> Callable[[Path, Optional[str]], dict]:
    """The model is loaded per job and freed afterwards, handing its VRAM back
    to ACE-Step and the engines between jobs. `load_audio` gives 16 kHz mono."""

    def transcribe(path: Path, language: Optional[str]) -> dict:
        model = load_model()
        try:
            segments, info = model.transcribe(str(path), language=language, multilingual=language is None, **SETTINGS)
            # A lazy generator: decoding happens here, so it must finish before the model goes.
            out = [_segment(s) for s in segments]
            heard = language or dominant_language(model, load_audio(path), out) or info.language
        finally:
            del model
            gc.collect()
        return {"language": heard, "segments": out}

    return transcribe
