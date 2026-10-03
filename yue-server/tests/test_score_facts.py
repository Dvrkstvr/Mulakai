"""F-017 #4 (duration) and the planner's facts: header, key notes, sections,
lyric blocks and the SP-2 bar map, on a meter change and an L:1/16 score."""
from __future__ import annotations

from score_facts import read_facts, seconds
from score_fixtures import CHORDS, LYRICS, METER, SIXTEENTH
from scores import parse_abc


def test_duration_is_bars_times_meter_over_q():
    # 2c944049: 65 bars of 4/4 at 87 BPM; 3820c535: 2 bars of 2/4 then 61 of 4/4 at 93.
    assert seconds(parse_abc(CHORDS)) == round(65 * 4 * 60 / 87, 1) == 179.3
    assert seconds(parse_abc(METER)) == round((2 * 2 + 61 * 4) * 60 / 93, 1) == 160.0


def test_header_key_notes_and_sections():
    facts = read_facts(CHORDS, LYRICS)
    assert facts["header"] == {"meter": "4/4", "unit": "1/32", "bpm": 87, "key": "Dm", "bars": 65,
                               "seconds": 179.3, "units_per_quarter": 8}
    assert facts["key_notes"] == "D E F G A Bb C"
    assert facts["sections"] == [
        {"index": 1, "label": "intro", "from_bar": 1, "to_bar": 10},
        {"index": 2, "label": "verse", "from_bar": 11, "to_bar": 46},
        {"index": 3, "label": "chorus", "from_bar": 47, "to_bar": 62},
        {"index": 4, "label": "outro", "from_bar": 63, "to_bar": 65}]


def test_lyric_blocks_are_numbered_with_their_occurrence():
    assert read_facts(CHORDS, LYRICS)["lyric_blocks"] == [
        {"index": 1, "tag": "[Verse]", "occurrence": 1, "lines": 2, "first_line": "walking out"},
        {"index": 2, "tag": "[Chorus]", "occurrence": 1, "lines": 1, "first_line": "hold on"},
        {"index": 3, "tag": "[Chorus]", "occurrence": 2, "lines": 2, "first_line": "hold on"}]
    assert read_facts(CHORDS, "")["lyric_blocks"] == []


def test_the_bar_map_has_one_line_per_bar_in_sp2_format():
    lines = read_facts(CHORDS, LYRICS)["bar_map"]
    assert lines[:3] == ["-- S1 intro --", "(meter M:4/4 from here: one bar = 32 units)", "1: - | V:rest | I:0"]
    assert "2: Dm@4 | V:rest | I:0" in lines and "3: Dm@1 | V:rest | I:8" in lines
    assert "11: Dm@1 | V:sung | I:0" in lines
    assert "-- S3 chorus --" in lines
    assert sum(1 for line in lines if line[0].isdigit()) == 65


def test_the_bar_map_states_each_meter_change_and_sixteenth_beats():
    lines = read_facts(METER, "")["bar_map"]
    assert lines[1] == "(meter M:2/4 from here: one bar = 16 units)"
    assert lines[4] == "(meter M:4/4 from here: one bar = 32 units)" and lines[5].startswith("3: Gm@1 ")
    sixteenth = read_facts(SIXTEENTH, "")
    assert sixteenth["header"]["units_per_quarter"] == 4
    assert "2: F#m@1 E@3 D@4 | V:rest | I:5" in sixteenth["bar_map"]
