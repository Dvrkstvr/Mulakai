"""Keep a re-timed score's sections like the score it replaces (RT-4, D-240): a cover may sing only some of its
transcription's sections (Create's SECTIONS left the rest out), and a re-time from the kept reading brings every
section back. The rebuilt score keeps a section when it is the next of the old score's sections by name, in order,
so the cover sings the same sections at the new tempo. Section blocks are cut whole, as Create's cut is."""
from __future__ import annotations

from scores import split_sections


class KeepError(ValueError):
    pass


def keep_sections_like(abc: str, like: str) -> tuple[str, list[str]]:
    """(the rebuilt score with only `like`'s sections, the names left out). A `like` with no sections keeps all."""
    _, wanted = split_sections(like)
    if not wanted:
        return abc, []
    header, sections = split_sections(abc)
    names = [name for name, _ in wanted]
    kept, left_out, j = [], [], 0
    for name, body in sections:
        if j < len(names) and name == names[j]:
            kept.append(body)
            j += 1
        else:
            left_out.append(name)
    if j < len(names):
        raise KeepError(f"the saved reading has no {names[j]} section where the score has one")
    return header + "".join(kept), left_out
