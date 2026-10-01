from sections import bar_seconds, read_downbeats, section_bars, section_starts

HEADER = """X:1
T:
M:4/4
L:1/16
Q:1/4=75
V: Vocal clef=treble name="Vocal Melody" snm="Vocal"
V: Ins clef=treble name="Ins Melody" snm="Inst."
K:Fm
"""
# The opening of the spike's Ellies City 2 score: intro 4 bars, verse 8, chorus.
ELLIES = HEADER + """% intro
V: Vocal
Z3|z8c2e2f2g2|
V: Ins
c12A3A|G4G4z4G4|c12A3A|G4G4z8|
% verse
V: Vocal
g3e3c2z8|z8c2e2f2g2|g3e3c2z8|z4c2e2f2g2f2g2|
V: Ins
Z4|
V: Vocal
a3b3g4z6|z8c2e2f2g2|g3e3c4z6|z2c2c2e2b2a2g2f2|
V: Ins
Z4|
% chorus
V: Vocal
a12z4|
V: Ins
Z|
"""
DOWNBEATS = [0.01 + 3.2 * i for i in range(13)]


def test_counts_bars_from_the_vocal_lines_with_rests_expanded():
    assert section_bars(ELLIES) == [("intro", 0), ("verse", 4), ("chorus", 12)]


def test_starts_come_from_the_downbeats_not_the_tempo_grid():
    # A first downbeat on a 0.35 s fragment, as in the spike's Purple Shinings.
    downbeats = [0.01, 0.36] + [0.36 + 3.2 * i for i in range(1, 12)]
    assert section_starts(ELLIES, downbeats) == [
        {"label": "intro", "bar": 0, "seconds": 0.01},
        {"label": "verse", "bar": 4, "seconds": 9.96},
        {"label": "chorus", "bar": 12, "seconds": 35.56},
    ]


def test_comments_in_a_row_share_a_start():
    abc = HEADER + "% intro\n% verse\nV: Vocal\nZ2|\nV: Ins\nZ2|\n% chorus\nV: Vocal\nZ|\nV: Ins\nZ|\n"
    assert [(s["label"], s["bar"]) for s in section_starts(abc, DOWNBEATS)] == [("intro", 0), ("verse", 0), ("chorus", 2)]


def test_a_section_past_the_last_downbeat_is_extrapolated_on_the_tempo_grid():
    assert bar_seconds(ELLIES) == 3.2
    starts = section_starts(ELLIES, DOWNBEATS[:10])
    assert starts[-1] == {"label": "chorus", "bar": 12, "seconds": round(DOWNBEATS[9] + 3 * 3.2, 2)}


def test_nothing_to_anchor_is_none():
    assert section_starts(ELLIES, []) is None
    assert section_starts(HEADER + "V: Vocal\nZ|\nV: Ins\nZ|\n", DOWNBEATS) is None
    no_tempo = ELLIES.replace("Q:1/4=75\n", "")
    assert section_starts(no_tempo, DOWNBEATS[:5]) is None


def test_read_downbeats_tolerates_missing_and_broken_files(tmp_path):
    lab = tmp_path / "downbeat.lab"
    assert read_downbeats(lab) == []
    lab.write_text("0.01\n3.23\t1\n\n6.43\n", encoding="utf-8")
    assert read_downbeats(lab) == [0.01, 3.23, 6.43]
    lab.write_text("0.01\nnot a time\n", encoding="utf-8")
    assert read_downbeats(lab) == []
