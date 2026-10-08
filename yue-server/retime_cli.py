"""Rebuild a transcription's score with a corrected beat list (SP-8), run by
retimer.py with SheetSage2's own python, so SheetSage2's builder and its pinned
numpy/pretty_midi do the work and yue-server's venv needs neither:

    <sheetsage python> retime_cli.py <sheetsage dir> <work dir> <half|double|bpm> <bpm|-> <0|1 melody only>

<work dir>/notation holds the five saved files (song_melody.mid, song_beats.txt,
song_chords.txt, song_keys.txt, song_structures.txt); they are rewritten in place.
Prints one JSON line: {abc, notes, kept, dropped, stretched, diagnostics}, or
{error} with exit code 2 when the rebuild refuses the grid.
"""
from __future__ import annotations

import importlib
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from retime_beats import read_rows, transform, write_rows  # noqa: E402
from retime_fit import fit_midi  # noqa: E402


def rebuild(sheetsage_dir: Path, work: Path, mode: str, bpm: float | None, melody_only: bool) -> dict:
    sys.path.insert(0, str(sheetsage_dir.parent))  # SheetSage2 is a package (relative imports)
    notation = importlib.import_module(f"{sheetsage_dir.name}.notation_sheetsage2")
    folder = work / "notation"
    beats = folder / "song_beats.txt"
    rows = transform(read_rows(beats.read_text(encoding="utf-8")), mode, bpm)
    beats.write_text(write_rows(rows), encoding="utf-8", newline="\n")
    melody = folder / "song_melody.mid"
    fit = fit_midi(melody, melody, [r[0] for r in rows], notation.SUBBEAT_DIVISION)
    abc, score, *_ = notation.generate_abc_from_exports(melody, meter_conflict="infer", melody_only=melody_only)
    return {"abc": abc, "notes": fit.notes, "kept": fit.kept, "dropped": fit.dropped,
            "stretched": fit.stretched, "diagnostics": [str(d) for d in getattr(score, "diagnostics", [])][:5]}


def main(argv: list[str]) -> int:
    sheetsage_dir, work, mode, bpm, melody_only = argv
    try:
        out = rebuild(Path(sheetsage_dir), Path(work), mode, None if bpm == "-" else float(bpm), melody_only == "1")
    except Exception as error:  # SheetSage2's own refusals (AbcRebuildError, MelodyVoiceError, ...) too
        print(json.dumps({"error": f"{type(error).__name__}: {error}"}))
        return 2
    print(json.dumps(out))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
