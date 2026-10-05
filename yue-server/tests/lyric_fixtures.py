"""Lyrics for the section-op tests: the block layout (tags and line counts)
of the library songs whose scores are in score_golden.json, read from the
library on 2026-10-05, with made-up words. They show how blocks and score
sections fail to map one to one (R-018, SP-2)."""
from __future__ import annotations


def lyrics_of(layout: list[tuple[str, int]]) -> str:
    blocks = []
    for number, (tag, count) in enumerate(layout, 1):
        words = tag.strip("[]").split(" ")[0].split(":")[0].lower()
        blocks.append("\n".join([tag] + [f"{words} {number} line {k}" for k in range(1, count + 1)]))
    return "\n\n".join(blocks) + "\n"


# Score: intro, verse, chorus, outro. Lyrics: two verses and two choruses, a bridge.
LYRICS_2C = lyrics_of([("[Intro]", 1), ("[Verse 1]", 8), ("[Chorus]", 4), ("[Verse 2]", 8), ("[Chorus]", 4),
                       ("[Bridge]", 2), ("[Outro]", 8)])
# Score: intro, verse, chorus, verse, chorus, outro. Lyrics: a [Pre-Chorus], an "[Instrumental Outro]".
LYRICS_38 = lyrics_of([("[Intro: Piano]", 0), ("[Verse 1]", 5), ("[Pre-Chorus]", 8), ("[Chorus]", 8),
                       ("[Verse 2]", 13), ("[Chorus]", 8), ("[Instrumental Outro]", 2)])
# Score: intro, verse, chorus, verse, chorus, bridge, chorus, outro.
LYRICS_F3 = lyrics_of([("[Intro - Acoustic Guitar]", 0), ("[Verse 1]", 7), ("[Chorus]", 4), ("[Verse 2]", 8),
                       ("[Chorus]", 4), ("[Bridge]", 4), ("[Outro]", 5),
                       ("[Instrumental Outro - Acoustic Guitar]", 0)])
# Score: intro, verse, chorus, verse, chorus, interlude, bridge, chorus, interlude, outro (no [Interlude] block).
LYRICS_84 = lyrics_of([("[Intro]", 4), ("[Verse 1]", 4), ("[Chorus]", 4), ("[Verse 2]", 10), ("[Chorus]", 4),
                       ("[Instrumental Break - Guitar Solo]", 0), ("[Bridge]", 2), ("[Chorus]", 4), ("[Outro]", 1)])
