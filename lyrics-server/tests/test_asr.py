from types import SimpleNamespace as NS

import pytest

from asr import SETTINGS, make_transcriber


class FakeModel:
    """Stands in for faster_whisper.WhisperModel: records each call and
    yields segments lazily, like the real one."""

    def __init__(self, log):
        self.log = log

    def transcribe(self, path, **kwargs):
        self.log.append(("transcribe", path, kwargs))

        def segments():
            self.log.append(("decoded",))
            yield NS(text=" Midnight city ", start=12.3456, end=14.0, words=[
                NS(word=" Midnight", start=12.3456, end=13.0), NS(word=" city", start=13.0, end=14.0)])
            yield NS(text=" streets", start=14.0, end=15.5, words=None)

        return segments(), NS(language="en")

    def __del__(self):
        self.log.append(("freed",))


@pytest.fixture
def log():
    return []


def transcriber(log):
    def load():
        log.append(("loaded",))
        return FakeModel(log)

    return make_transcriber(load)


def test_returns_rounded_segments_and_words(log, tmp_path):
    result = transcriber(log)(tmp_path / "a.wav", None)

    assert result == {"language": "en", "segments": [
        {"text": "Midnight city", "start": 12.35, "end": 14.0, "words": [
            {"text": "Midnight", "start": 12.35, "end": 13.0}, {"text": "city", "start": 13.0, "end": 14.0}]},
        {"text": "streets", "start": 14.0, "end": 15.5, "words": []},
    ]}


def test_uses_the_spike_settings_and_the_given_language(log, tmp_path):
    transcriber(log)(tmp_path / "a.wav", "de")

    _, path, kwargs = log[1]
    assert path == str(tmp_path / "a.wav")
    assert kwargs == {"language": "de", **SETTINGS}
    assert kwargs["condition_on_previous_text"] is False and kwargs["word_timestamps"] is True


def test_loads_per_job_and_frees_after_decoding(log, tmp_path):
    run = transcriber(log)
    run(tmp_path / "a.wav", None)
    run(tmp_path / "b.wav", None)

    kinds = [entry[0] for entry in log]
    assert kinds == ["loaded", "transcribe", "decoded", "freed"] * 2


def test_a_failed_job_still_frees_the_model(log, tmp_path):
    class Broken(FakeModel):
        def transcribe(self, path, **kwargs):
            raise RuntimeError("cuDNN missing")

    run = make_transcriber(lambda: Broken(log))
    with pytest.raises(RuntimeError, match="cuDNN"):
        run(tmp_path / "a.wav", None)
    assert log == [("freed",)]
