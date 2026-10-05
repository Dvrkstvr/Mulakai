"""A song's lyrics as blocks, for the score agent (F-030, F-031, R-018).

A block is the text between blank lines; its tag is a `[...]` first line,
and its kind is the tag's first word ([Verse 2] and [Intro - Piano] are a
verse and an intro). Blocks are numbered 1..N as /read's LYRIC BLOCKS show
them, with each one's occurrence among blocks of its kind.

The rule that ties blocks to the score: the k-th `% label` section of a kind
sings the k-th block of that kind. A section with no such block (84a51811's
interludes) has no words of its own; a block with no such section (2c944049's
second [Chorus], 3820c535's [Pre-Chorus]) is extra. REPEAT copies the
section's block right after it, CUT removes it, and neither touches an extra
block or invents one; the op's note says which case it was. After any
section op, every matched block's tag is rewritten from its section's label
by upstream's rule (`section_tag`, also instrumental.py's): the planner never
writes tags. REWRITE_LYRICS replaces one block's lines, same count, no tags.
"""
from __future__ import annotations

import re

from score_model import OpError

TAG = re.compile(r"\[[^\]\n]*\]")


def section_tag(label: str) -> str:
    """`% pre-chorus` -> `[Pre-Chorus]`, as upstream's `lyric_tags` writes it."""
    return f"[{label.title()}]"


def tag_word(tag: str) -> str:
    return tag.lower().split(" ")[0].strip("[]:")


def parse_blocks(lyrics: str) -> list[dict]:
    text = lyrics.replace("\r\n", "\n").strip("\n")
    out = []
    for number, block in enumerate((b for b in re.split(r"\n\s*\n", text) if b.strip()), 1):
        rows = [row.strip() for row in block.split("\n")]
        tag = rows[0] if rows[0].startswith("[") else ""
        out.append({"number": number, "tag": tag, "lines": rows[1:] if tag else rows})
    return out


def join_blocks(blocks: list[dict]) -> str:
    return "\n\n".join("\n".join(([b["tag"]] if b["tag"] else []) + b["lines"]) for b in blocks) + (
        "\n" if blocks else "")


def _occurrence(blocks: list[dict], position: int) -> int:
    word = tag_word(blocks[position]["tag"])
    return sum(1 for b in blocks[:position + 1] if tag_word(b["tag"]) == word)


def block_facts(lyrics: str) -> list[dict]:
    blocks = parse_blocks(lyrics)
    return [{"index": b["number"], "tag": b["tag"], "occurrence": _occurrence(blocks, i), "lines": len(b["lines"]),
             "first_line": b["lines"][0][:50] if b["lines"] else ""} for i, b in enumerate(blocks)]


def pairs(labels: list[str | None], blocks: list[dict]) -> dict[int, int]:
    """{section position: block position} by the rule above; `labels` has None
    for a stretch of bars with no `% label` comment."""
    queues: dict[str, list[int]] = {}
    for j, block in enumerate(blocks):
        queues.setdefault(tag_word(block["tag"]), []).append(j)
    out, seen = {}, {}
    for i, label in enumerate(labels):
        if label is None:
            continue
        word = tag_word(section_tag(label))
        seen[word] = seen.get(word, 0) + 1
        if seen[word] <= len(queues.get(word, [])):
            out[i] = queues[word][seen[word] - 1]
    return out


def _name(block: dict) -> str:
    return f"block {block['number']} {block['tag'] or '(untagged)'}"


def follow(blocks: list[dict], labels: list[str | None], at: int, kind: str) -> str:
    """Repeat or cut the block section `at` sings; returns the op's note."""
    match = pairs(labels, blocks)
    word, verb = tag_word(section_tag(labels[at])), "repeated" if kind == "REPEAT" else "cut"
    extra = [_name(b) for j, b in enumerate(blocks) if tag_word(b["tag"]) == word and j not in match.values()]
    if at in match:
        j = match[at]
        note = f"lyric {_name(blocks[j])} is {verb} with it"
        if kind == "REPEAT":
            blocks.insert(j + 1, dict(blocks[j], lines=list(blocks[j]["lines"])))
        else:
            del blocks[j]
    else:
        note = f"no lyric block is tagged for this {labels[at]}, so none is {verb}"
    if extra:
        one = len(extra) == 1
        note += (f"; {', '.join(extra)} {'matches' if one else 'match'} no {labels[at]} in the score and "
                 f"{'stays as it is' if one else 'stay as they are'}")
    return note


def retag(blocks: list[dict], labels: list[str | None]) -> None:
    for i, j in pairs(labels, blocks).items():
        blocks[j]["tag"] = section_tag(labels[i])


def rewrite_lyrics(blocks: list[dict], op: dict) -> dict:
    """Replace one block's lines; returns {block, tag, occurrence, old, new} for the diff."""
    n, count = op["block"], len(blocks)
    if not 1 <= n <= count:
        raise OpError(f"lyric block {n} does not exist (blocks 1-{count})" if count else "the lyrics have no blocks")
    block, occurrence, want = blocks[n - 1], _occurrence(blocks, n - 1), tag_word(op["tag"])
    if (tag_word(block["tag"]), occurrence) != (want, op["occurrence"]):
        right = next((i for i, b in enumerate(blocks, 1)
                      if tag_word(b["tag"]) == want and _occurrence(blocks, i - 1) == op["occurrence"]), None)
        asked = f"{want or 'untagged'} {op['occurrence']}"
        raise OpError(f"block {n} is {block['tag'] or '(untagged)'} occurrence {occurrence}, not {asked}; "
                      + (f"{asked} is block {right}" if right else f"there is no {asked}"))
    if not block["lines"]:
        raise OpError(f"{_name(block)} has no lyric lines to rewrite (a tag only)")
    lines = [line.strip() for line in op["lines"]]
    if len(lines) != len(block["lines"]):
        raise OpError(f"{_name(block)} has {len(block['lines'])} lines; {len(lines)} given. "
                      "Keep the line count so the melody still fits")
    for k, line in enumerate(lines, 1):
        if not line or "\n" in line or "\r" in line:
            raise OpError(f"line {k} is empty or has a line break; give one lyric line per entry")
        if tag := TAG.search(line):
            raise OpError(f"line {k} contains the tag {tag.group(0)}; write lyric text only, code writes the tags")
    diff = {"block": n, "tag": block["tag"], "occurrence": occurrence, "old": block["lines"], "new": lines}
    block["lines"] = lines
    return diff
