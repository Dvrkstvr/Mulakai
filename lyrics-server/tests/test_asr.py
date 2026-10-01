from types import SimpleNamespace as NS

import pytest

from asr import SAMPLE_RATE, SETTINGS, dominant_language, make_transcriber

SECOND = SAMPLE_RATE


def word(text, start, end):
    return NS(word=f" {text}", start=start, end=end)


class FakeModel:
    """Stands in for faster_whisper.WhisperModel: records each call, yields
    segments lazily like the real one, and detects languages per window from
    `languages` (in window order)."""

    def __init__(self, log, segments=None, languages=("de",)):
        self.log = log
        self.segments = segments if segments is not None else [
            NS(text=" Midnight city ", start=12.3456, end=14.0, words=[word("Midnight", 12.3456, 13.0), word("city", 13.0, 14.0)]),
            NS(text=" streets", start=14.0, end=15.5, words=None),
        ]
        self.languages = list(languages)

    def transcribe(self, path, **kwargs):
        self.log.append(("transcribe", path, kwargs))

        def segments():
            self.log.append(("decoded",))
            yield from self.segments

        return segments(), NS(language="en")

    def detect_language(self, audio):
        self.log.append(("detect", len(audio)))
        return self.languages.pop(0), 0.9, []

    def __del__(self):
        self.log.append(("freed",))


@pytest.fixture
def log():
    return []


def transcriber(log, **model):
    def load():
        log.append(("loaded",))
        return FakeModel(log, **model)

    return make_transcriber(load, lambda path: [0.0] * (75 * SECOND))


def test_returns_rounded_segments_and_words(log, tmp_path):
    result = transcriber(log)(tmp_path / "a.wav", "en")

    assert result == {"language": "en", "segments": [
        {"text": "Midnight city", "start": 12.35, "end": 14.0, "words": [
            {"text": "Midnight", "start": 12.35, "end": 13.0}, {"text": "city", "start": 13.0, "end": 14.0}]},
        {"text": "streets", "start": 14.0, "end": 15.5, "words": []},
    ]}


def test_a_given_language_is_forced_and_reported_without_detecting(log, tmp_path):
    result = transcriber(log)(tmp_path / "a.wav", "de")

    _, path, kwargs = log[1]
    assert path == str(tmp_path / "a.wav")
    assert kwargs == {"language": "de", "multilingual": False, **SETTINGS}
    assert kwargs["condition_on_previous_text"] is False and kwargs["word_timestamps"] is True
    assert result["language"] == "de"
    assert not any(entry[0] == "detect" for entry in log)


def test_auto_transcribes_multilingual_and_reports_the_language_most_words_are_in(log, tmp_path):
    segments = [
        NS(text=" Thanks for watching!", start=1.0, end=3.0, words=[word(w, 1.0, 3.0) for w in "Thanks for watching".split()]),
        NS(text=" Hey du", start=35.0, end=36.0, words=[word("Hey", 35.0, 35.5), word("du", 35.5, 36.0)]),
        NS(text=" was ist los", start=40.0, end=42.0, words=[word(w, 40.0, 42.0) for w in "was ist los".split()]),
        NS(text=" one", start=65.0, end=66.0, words=[word("one", 65.0, 66.0)]),
    ]
    # Windows 0-30 s (only a stock line: no vote), 30-60 s (5 words) and 60-75 s (1 word).
    result = transcriber(log, segments=segments, languages=["de", "en"])(tmp_path / "a.wav", None)

    assert log[1][2]["language"] is None and log[1][2]["multilingual"] is True
    assert [entry[1] for entry in log if entry[0] == "detect"] == [30 * SECOND, 15 * SECOND]
    assert result["language"] == "de"


def test_falls_back_to_whispers_own_guess_when_nothing_was_sung(log, tmp_path):
    result = transcriber(log, segments=[])(tmp_path / "a.wav", None)
    assert result == {"language": "en", "segments": []}


def test_dominant_language_weighs_windows_by_their_words():
    model = FakeModel([], languages=["en", "de"])
    segs = [{"text": "a", "words": [{"start": 1, "end": 2}]},
            {"text": "b c d", "words": [{"start": 31, "end": 32}] * 3}]
    assert dominant_language(model, [0.0] * (60 * SECOND), segs) == "de"


def test_loads_per_job_and_frees_after_decoding(log, tmp_path):
    run = transcriber(log)
    run(tmp_path / "a.wav", None)
    run(tmp_path / "b.wav", "en")

    kinds = [entry[0] for entry in log]
    assert kinds == ["loaded", "transcribe", "decoded", "detect", "freed", "loaded", "transcribe", "decoded", "freed"]


def test_a_failed_job_still_frees_the_model(log, tmp_path):
    class Broken(FakeModel):
        def transcribe(self, path, **kwargs):
            raise RuntimeError("cuDNN missing")

    run = make_transcriber(lambda: Broken(log), lambda path: [])
    with pytest.raises(RuntimeError, match="cuDNN"):
        run(tmp_path / "a.wav", None)
    assert log == [("freed",)]
