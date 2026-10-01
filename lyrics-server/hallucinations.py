"""
Whisper writes stock video-subtitle lines over instrumental stretches
("Thanks for watching!", "Untertitelung des ZDF, 2020"). The spike saw 1-3
per song, mostly over the closing instrumental (PLAN.md "Cover lyrics spike
results"). Whole segments are dropped; real lyrics never get cut mid-line.
"""
import re

# Never lyrics: dropped wherever a segment contains one.
ALWAYS = (
    "thanks for watching", "thank you for watching", "for listening",
    "subscribe", "untertitel", "subtitles by",
)
# Dropped when they are the whole segment: subtitle cues ("... Musik ...") and stock lines
# Whisper writes over instrumental stretches (a live READ LYRICS run had four).
WHOLE = {"music", "musik", "applause", "applaus", "we ll be right back"}
# Could be sung, so dropped only in the trailing run after the last real line.
TAIL = {"thank you", "thanks", "thank you very much", "danke", "vielen dank", "bis zum nächsten mal"}


def _norm(text: str) -> str:
    return " ".join(re.sub(r"[^\w\s]|_", " ", text.lower()).split())


def _stock(text: str) -> bool:
    words = _norm(text)
    return not re.search(r"[^\W\d_]", words) or words in WHOLE or any(p in words for p in ALWAYS)


def drop_hallucinations(segments: list[dict]) -> list[dict]:
    kept = [s for s in segments if not _stock(s["text"])]
    while kept and _norm(kept[-1]["text"]) in TAIL:
        kept.pop()
    return kept
