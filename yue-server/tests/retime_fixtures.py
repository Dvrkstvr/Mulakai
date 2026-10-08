"""A saved transcription bundle and a fake SheetSage2 package for the re-time tests.

The fake `generate_abc_from_exports` reads the rewritten beat list beside the
melody, so its score's bar count and tempo follow the transform, as the real
builder's do (SP-8); `REFUSE` in song_keys.txt makes it refuse the grid."""
from __future__ import annotations

import base64
import io
from pathlib import Path

FAKE_NOTATION = '''
import statistics
from pathlib import Path

SUBBEAT_DIVISION = 4


class Score:
    diagnostics = ["fake: built"]


def generate_abc_from_exports(melody, meter_conflict="infer", melody_only=False):
    folder = Path(melody).parent
    if "REFUSE" in (folder / "song_keys.txt").read_text():
        raise ValueError("cannot be represented on the decoded subbeat grid")
    rows = [line.split("\\t") for line in (folder / "song_beats.txt").read_text().splitlines() if line.strip()]
    times = [float(r[0]) for r in rows]
    bpm = round(60 / statistics.median(b - a for a, b in zip(times, times[1:])))
    bars = max(1, (len(rows) - 1) // 4)
    chord = "" if melody_only else '"Am"'
    head = ("X:1\\nT:\\nM:4/4\\nL:1/32\\nQ:1/4=%d\\n"
            'V: Vocal clef=treble name="Vocal Melody" snm="Vocal"\\n'
            'V: Ins clef=treble name="Ins Melody" snm="Inst."\\nK:Am\\n%% verse\\n') % bpm
    groups = [min(4, bars - i) for i in range(0, bars, 4)]  # the native format: 1-4 bars per voice line
    abc = head + "".join("V: Vocal\\n" + (chord + "A8c8e8c8|") * n + "\\nV: Ins\\n" + "z32|" * n + "\\n"
                         for n in groups)
    return abc, Score(), None
'''


def make_sheetsage(root: Path) -> dict:
    package = root / "SheetSage2"
    package.mkdir()
    (package / "__init__.py").write_text("")
    (package / "notation_sheetsage2.py").write_text(FAKE_NOTATION)
    return {"sheetsage_python": __import__("sys").executable, "sheetsage_dir": str(package)}


def beats_text(beats=33, step=0.5) -> str:
    return "".join(f"{i * step:.3f}\t{i % 4 + 1}\t4\t4\n" for i in range(beats))


def melody_midi(beats=33, step=0.5, per_beat=4) -> bytes:
    """Notes on every 16th (per_beat=4) of a 4/4 grid: a half-time grid cannot hold them all."""
    import pretty_midi

    midi = pretty_midi.PrettyMIDI()
    for name in ("Vocal", "Ins"):
        instrument = pretty_midi.Instrument(program=0, name=name)
        length = step / per_beat
        for i in range((beats - 1) * per_beat):
            instrument.notes.append(pretty_midi.Note(velocity=90, pitch=60 + i % 12,
                                                     start=i * length, end=(i + 1) * length))
        midi.instruments.append(instrument)
    out = io.BytesIO()
    midi.write(out)
    return out.getvalue()


def bundle(keys="0.0\t16.0\tA:minor\n", per_beat=4) -> dict[str, str]:
    files = {"song_melody.mid": melody_midi(per_beat=per_beat), "song_beats.txt": beats_text().encode(),
             "song_chords.txt": b"0.0\t16.0\tA:min\n", "song_keys.txt": keys.encode(),
             "song_structures.txt": b"0.0\t16.0\tverse\n"}
    return {name: base64.b64encode(data).decode("ascii") for name, data in files.items()}
