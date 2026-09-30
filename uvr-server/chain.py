"""
The two-pass split behind /split. See PLAN.md "UVR Separator: Roformer Vocals
for SPLIT".

Roformer vocal models only know two stems (Vocals / Instrumental), so pass 1
takes the vocals from the mix and pass 2 runs Demucs on the instrumental for
drums/bass/other. Whatever Demucs still calls "Vocals" in that instrumental
is mostly vocal-like instruments (leads, pads), about -12 dB on a test mix,
so it is folded into `other` rather than dropped: the four stems then sum
back to the mix.

The runner functions are passed in rather than imported so tests can run
without torch or a GPU.
"""
from pathlib import Path
from typing import Callable, Dict

import soundfile as sf

Runner = Callable[..., object]

MIX_BASE = "mix"
INST_BASE = "inst"
DEMUCS_KINDS = ("drums", "bass", "other")


def output_path(directory: Path, base: str, stem: str) -> Path:
    """Where uvr-headless-runner writes a stem: `{base}_({Stem}).wav`."""
    return directory / f"{base}_({stem}).wav"


def _require(path: Path) -> Path:
    if not path.is_file():
        raise RuntimeError(f"separation produced no {path.name}")
    return path


def mix_into(target: Path, extra: Path) -> None:
    """Add `extra` into `target` in place, keeping float32 WAV."""
    a, sr = sf.read(str(target), dtype="float32", always_2d=True)
    b, _ = sf.read(str(extra), dtype="float32", always_2d=True)
    n = min(len(a), len(b))
    a[:n] += b[:n]
    sf.write(str(target), a, sr, subtype="FLOAT")


def run_chain(
    src: Path,
    out_dir: Path,
    vocal_model: str,
    demucs_model: str,
    run_mdx: Runner,
    run_demucs: Runner,
) -> Dict[str, Path]:
    """Separate `src` into Mulakai's four StemKinds, as float32 WAVs under `out_dir`."""
    vocal_dir = out_dir / "vocal-pass"
    run_mdx(
        model_path=vocal_model,
        audio_file=str(src),
        export_path=str(vocal_dir),
        audio_file_base=MIX_BASE,
        wav_type_set="FLOAT",
        verbose=False,
    )
    stems = {"vocals": _require(output_path(vocal_dir, MIX_BASE, "Vocals"))}
    instrumental = _require(output_path(vocal_dir, MIX_BASE, "Instrumental"))

    demucs_dir = out_dir / "demucs-pass"
    run_demucs(
        model_path=demucs_model,
        audio_file=str(instrumental),
        export_path=str(demucs_dir),
        audio_file_base=INST_BASE,
        wav_type_set="FLOAT",
        verbose=False,
    )
    for kind in DEMUCS_KINDS:
        stems[kind] = _require(output_path(demucs_dir, INST_BASE, kind.capitalize()))
    mix_into(stems["other"], _require(output_path(demucs_dir, INST_BASE, "Vocals")))
    return stems
