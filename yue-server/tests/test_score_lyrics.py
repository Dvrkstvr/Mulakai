"""F-030's lyric half and F-031 REWRITE_LYRICS (score_lyrics.py via
score_plan.py): blocks follow their sections, tags are rewritten from the
edited score (R-018, upstream's rule), the rule for unmatched sections and
extra blocks is reported in the op's note, and a rewrite keeps the line
count, writes no tags and returns its diff."""
from __future__ import annotations

import pytest

from instrumental import section_tags
from lyric_fixtures import LYRICS_2C, LYRICS_38, LYRICS_84
from score_fixtures import CHORDS, METER, PARSEABLE, library
from score_lyrics import block_facts, pairs, parse_blocks, section_tag
from score_model import Doc
from score_plan import apply_plan, check_plan
from score_sections import labels


def run(abc, lyrics, ops):
    out = apply_plan(abc, "", lyrics, ops)
    assert check_plan(abc, out, ops)["ok"]
    return out


def tags(lyrics):
    return [b["tag"] for b in parse_blocks(lyrics)]


def rewrite(block, tag, occurrence, lines):
    return {"op": "REWRITE_LYRICS", "block": block, "tag": tag, "occurrence": occurrence, "lines": lines}


@pytest.mark.parametrize("short_id", PARSEABLE)
def test_the_tag_rule_is_instrumentals(short_id):
    abc = library(short_id)
    assert section_tags(abc) == "\n\n".join(section_tag(label) for label in labels(Doc(abc))) + "\n"


def test_blocks_pair_with_sections_by_kind_and_order():
    # 2c944049: intro, verse, chorus, outro against 7 blocks; [Verse 2], the second [Chorus], [Bridge] are extra.
    assert pairs(labels(Doc(CHORDS)), parse_blocks(LYRICS_2C)) == {0: 0, 1: 1, 2: 2, 3: 6}
    # 3820c535: [Pre-Chorus] is extra; "[Instrumental Outro]" is not an outro, so the outro has no block.
    assert pairs(labels(Doc(METER)), parse_blocks(LYRICS_38)) == {0: 0, 1: 1, 2: 3, 3: 4, 4: 5}
    facts = block_facts(LYRICS_38)
    assert [(f["index"], f["tag"], f["occurrence"], f["lines"]) for f in facts][2:6] == [
        (3, "[Pre-Chorus]", 1, 8), (4, "[Chorus]", 1, 8), (5, "[Verse 2]", 2, 13), (6, "[Chorus]", 2, 8)]


def test_repeat_copies_the_chorus_block_and_says_what_happened_to_the_extra_one():
    out = run(CHORDS, LYRICS_2C, [{"op": "REPEAT", "section": 3, "label": "chorus"}])
    assert out["verdicts"][0]["note"] == ("lyric block 3 [Chorus] is repeated with it; block 5 [Chorus] matches no "
                                          "chorus in the score and stays as it is")
    blocks = parse_blocks(out["lyrics"])
    assert tags(out["lyrics"]) == ["[Intro]", "[Verse]", "[Chorus]", "[Chorus]", "[Verse 2]", "[Chorus]", "[Bridge]",
                                   "[Outro]"]
    assert blocks[3]["lines"] == blocks[2]["lines"] == parse_blocks(LYRICS_2C)[2]["lines"]


def test_cut_removes_the_block_and_the_tags_follow_the_edited_score():
    out = run(CHORDS, LYRICS_2C, [{"op": "CUT", "section": 4, "label": "outro"}])
    assert out["verdicts"][0]["note"] == "lyric block 7 [Outro] is cut with it"
    assert tags(out["lyrics"]) == ["[Intro]", "[Verse]", "[Chorus]", "[Verse 2]", "[Chorus]", "[Bridge]"]


def test_a_section_with_no_block_keeps_the_lyrics_and_says_so():
    out = run(METER, LYRICS_38, [{"op": "CUT", "section": 6, "label": "outro"}])
    assert out["verdicts"][0]["note"] == "no lyric block is tagged for this outro, so none is cut"
    assert tags(out["lyrics"]) == ["[Intro]", "[Verse]", "[Pre-Chorus]", "[Chorus]", "[Verse]", "[Chorus]",
                                   "[Instrumental Outro]"]
    out = run(library("84a51811"), LYRICS_84, [{"op": "REPEAT", "section": 6, "label": "interlude"}])
    assert out["verdicts"][0]["note"] == "no lyric block is tagged for this interlude, so none is repeated"
    assert len(parse_blocks(out["lyrics"])) == len(parse_blocks(LYRICS_84))


def test_repeating_with_a_pre_chorus_copies_only_the_chorus():
    out = run(METER, LYRICS_38, [{"op": "REPEAT", "section": 3, "label": "chorus"}])
    assert out["verdicts"][0]["note"] == "lyric block 4 [Chorus] is repeated with it"
    assert tags(out["lyrics"])[2:6] == ["[Pre-Chorus]", "[Chorus]", "[Chorus]", "[Verse]"]


def test_bar_ops_pass_the_lyrics_through_byte_for_byte():
    lyrics = LYRICS_2C.replace("\n", "\r\n").replace("[Verse 1]", "[Verse 1]  ")
    out = apply_plan(CHORDS, "", lyrics, [{"op": "SET_TEMPO", "bpm": 90}])
    assert out["lyrics"] == lyrics and apply_plan(CHORDS, "", None, [{"op": "SET_TEMPO", "bpm": 90}])["lyrics"] is None


def test_rewrite_lyrics_replaces_one_block_and_returns_the_diff():
    new = ["paper boats", "on a silver tide", "we never sank", "we only drifted"]
    out = run(CHORDS, LYRICS_2C, [rewrite(5, "[Chorus]", 2, new)])
    assert out["verdicts"][0]["diff"] == {"block": 5, "tag": "[Chorus]", "occurrence": 2,
                                          "old": [f"chorus 5 line {k}" for k in range(1, 5)], "new": new}
    blocks, before = parse_blocks(out["lyrics"]), parse_blocks(LYRICS_2C)
    assert blocks[4]["lines"] == new and [b for i, b in enumerate(blocks) if i != 4] == [
        b for i, b in enumerate(before) if i != 4]  # no section op: the tags stay as written
    assert out["abc"] == CHORDS


def test_a_rewritten_chorus_is_the_one_a_repeat_copies():
    new = ["one", "two", "three", "four"]
    out = run(CHORDS, LYRICS_2C, [{"op": "REPEAT", "section": 3, "label": "chorus"}, rewrite(3, "chorus", 1, new)])
    assert [b["lines"] for b in parse_blocks(out["lyrics"])[2:4]] == [new, new]


@pytest.mark.parametrize("lyrics,ops,reason", [
    (None, [rewrite(3, "chorus", 1, ["a"])], "the request has no lyrics to rewrite"),
    ("", [rewrite(1, "chorus", 1, ["a"])], "the lyrics have no blocks"),
    (LYRICS_2C, [rewrite(9, "chorus", 1, ["a"])], "lyric block 9 does not exist (blocks 1-7)"),
    (LYRICS_2C, [rewrite(3, "chorus", 2, ["a"] * 4)], "block 3 is [Chorus] occurrence 1, not chorus 2; "
                                                      "chorus 2 is block 5"),
    (LYRICS_2C, [rewrite(6, "bridge", 2, ["a"] * 2)], "block 6 is [Bridge] occurrence 1, not bridge 2; "
                                                      "there is no bridge 2"),
    (LYRICS_38, [rewrite(1, "[Intro: Piano]", 1, ["a"])],
     "block 1 [Intro: Piano] has no lyric lines to rewrite (a tag only)"),
    (LYRICS_2C, [rewrite(5, "chorus", 2, ["a"] * 3)],
     "block 5 [Chorus] has 4 lines; 3 given. Keep the line count so the melody still fits"),
    (LYRICS_2C, [rewrite(5, "chorus", 2, ["a", "[Chorus] b", "c", "d"])],
     "line 2 contains the tag [Chorus]; write lyric text only, code writes the tags"),
    (LYRICS_2C, [rewrite(5, "chorus", 2, ["  ", "b", "c", "d"])],
     "line 1 is empty or has a line break; give one lyric line per entry"),
    (LYRICS_2C, [rewrite(5, "chorus", 2, ["a\nb", "b", "c", "d"])],
     "line 1 is empty or has a line break; give one lyric line per entry"),
    (LYRICS_2C, [rewrite(5, "chorus", 2, ["a"] * 4), rewrite(5, "chorus", 2, ["b"] * 4)],
     "block 5 is already rewritten by op 1"),
])
def test_rewrite_lyrics_refusals(lyrics, ops, reason):
    out = apply_plan(CHORDS, "", lyrics, ops)
    assert out["verdicts"][-1] == {"index": len(ops), "op": "REWRITE_LYRICS", "ok": False, "reason": reason}
    if len(ops) == 1:
        assert out["lyrics"] == lyrics
