import numpy as np
import pytest
import soundfile as sf

from chain import run_chain
from conftest import FakeRunners, write_tone


def split(tmp_path, runners):
    src = tmp_path / "source.mp3"
    src.write_bytes(b"x")
    return run_chain(src, tmp_path, "vocal-model", "demucs-model", runners.mdx, runners.demucs)


def level(path):
    data, _ = sf.read(str(path), dtype="float32")
    return pytest.approx(float(data.mean()))


def test_runs_vocal_model_on_the_mix_then_demucs_on_its_instrumental(tmp_path, runners):
    split(tmp_path, runners)

    (first, mdx), (second, demucs) = runners.calls
    assert (first, second) == ("mdx", "demucs")
    assert mdx["model_path"] == "vocal-model"
    assert mdx["audio_file"] == str(tmp_path / "source.mp3")
    assert demucs["model_path"] == "demucs-model"
    assert demucs["audio_file"] == str(tmp_path / "vocal-pass" / "mix_(Instrumental).wav")
    assert mdx["wav_type_set"] == demucs["wav_type_set"] == "FLOAT"


def test_maps_outputs_to_stem_kinds(tmp_path, runners):
    stems = split(tmp_path, runners)

    assert set(stems) == {"vocals", "drums", "bass", "other"}
    assert stems["vocals"].name == "mix_(Vocals).wav"
    assert level(stems["vocals"]) == 0.1
    assert level(stems["drums"]) == 0.01
    assert level(stems["bass"]) == 0.02


def test_folds_demucs_vocals_into_other(tmp_path, runners):
    stems = split(tmp_path, runners)

    assert level(stems["other"]) == 0.03 + 0.04
    assert sf.info(str(stems["other"])).subtype == "FLOAT"


@pytest.mark.parametrize("missing", ["Instrumental", "Drums", "Vocals"])
def test_missing_output_fails_loudly(tmp_path, missing):
    with pytest.raises(RuntimeError, match=missing):
        split(tmp_path, FakeRunners(skip={missing}))


def test_mix_into_tolerates_a_length_mismatch(tmp_path):
    from chain import mix_into

    a, b = tmp_path / "a.wav", tmp_path / "b.wav"
    write_tone(a, 0.1)
    sf.write(str(b), np.full((10, 2), 0.5, dtype="float32"), 44100, subtype="FLOAT")
    mix_into(a, b)

    data, _ = sf.read(str(a), dtype="float32")
    assert data[0, 0] == pytest.approx(0.6)
    assert data[-1, 0] == pytest.approx(0.1)
