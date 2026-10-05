"""F-030 REPEAT / CUT on the score (score_sections.py, score_section_check.py
via score_plan.py): literal copies, the seam un-tied (f3e3bfdc), meters
restated (3820c535), numbers that always mean the score as read, refusals
with reasons, and checks that allow exactly the bar-count change."""
from __future__ import annotations

import copy

import pytest

from score_fixtures import CHORDS, METER, PARSEABLE, library
from score_model import Doc
from score_plan import apply_plan, check_plan
from score_sections import section_seconds
from abc_tools import parse_abc
from score_section_check import check_sections

SEAM = library("f3e3bfdc")  # intro, verse, chorus (bars 19-27, its last Vocal note tied on), verse, ...


def rep(section, label):
    return {"op": "REPEAT", "section": section, "label": label}


def cut(section, label):
    return {"op": "CUT", "section": section, "label": label}


def run(abc, ops, lyrics=""):
    out = apply_plan(abc, "", lyrics, ops)
    return out, check_plan(abc, out, ops)


def labels(abc):
    return [s["label"] for s in Doc(abc).sections]


def last_note(doc, n, voice):
    return [e for e in doc.bar(n, voice) if e[0] == "note"][-1]


@pytest.mark.parametrize("short_id", PARSEABLE)
def test_every_section_of_every_library_score_repeats_and_cuts_into_a_score_upstream_accepts(short_id):
    abc = library(short_id)
    for index, label, first, last in Doc(abc).section_ranges():
        for op, change in [(rep(index, label), last - first + 1), (cut(index, label), first - last - 1)]:
            out, checks = run(abc, [op])
            assert [v["ok"] for v in out["verdicts"]] == [True], (index, op, out["verdicts"])
            assert checks == {"ok": True, "problems": [], "differences": []}, (index, op)
            assert Doc(out["abc"]).nbars() == Doc(abc).nbars() + change
            assert Doc(out["abc"]).text() == out["abc"]  # round trip: the edited score parses back the same


def test_repeat_copies_the_chorus_literally_right_after_itself_with_its_comment():
    out, _ = run(CHORDS, [rep(3, "chorus")])
    before, after = Doc(CHORDS), Doc(out["abc"])
    assert labels(out["abc"]) == ["intro", "verse", "chorus", "chorus", "outro"]
    assert out["abc"].count("% chorus") == 2 and "::" not in out["abc"] and ":|" not in out["abc"]
    for n in range(47, 63):  # 2c944049's chorus is bars 47-62; its copy is 63-78
        for voice in ("Vocal", "Ins"):
            assert after.bar(n + 16, voice) == after.bar(n, voice) == before.bar(n, voice)
    assert [after.bar(n, "Ins") for n in range(79, 82)] == [before.bar(n, "Ins") for n in range(63, 66)]


def test_repeat_unties_the_seam_that_made_a_naive_copy_invalid_in_f3e3bfdc():
    doc = Doc(SEAM)
    assert last_note(doc, 27, "Vocal")[5] == "-"  # the chorus's last note is tied into the next verse
    naive = copy.deepcopy(doc)
    naive.sections.insert(3, copy.deepcopy(naive.sections[2]))
    with pytest.raises(ValueError, match="tie changes pitch"):
        parse_abc(naive.text())
    out, checks = run(SEAM, [rep(3, "chorus")])
    after = Doc(out["abc"])
    assert checks["ok"] and last_note(after, 27, "Vocal")[5] == "" and last_note(after, 36, "Vocal")[5] == ""
    assert after.bar(28, "Vocal") == doc.bar(19, "Vocal") and after.bar(37, "Vocal") == doc.bar(28, "Vocal")


def test_a_cut_unties_the_bar_before_it_too():
    out, checks = run(SEAM, [cut(4, "verse")])  # the chorus's tie ran into the cut verse
    assert checks["ok"] and last_note(Doc(out["abc"]), 27, "Vocal")[5] == ""
    assert labels(out["abc"]) == ["intro", "verse", "chorus", "chorus", "bridge", "chorus", "outro"]


def test_a_meter_the_section_changes_is_restated_after_the_seam():
    # 3820c535: the header says M:2/4 and the intro's second group switches to M:4/4.
    out, checks = run(METER, [rep(1, "intro")])
    assert checks["ok"] and out["abc"].split("% intro")[2].split("V: Ins")[0] == "\nV: Vocal\nM:2/4\nZ2|\n"
    out, checks = run(METER, [cut(1, "intro")])
    assert checks["ok"] and out["abc"].split("% verse")[1].startswith("\nV: Vocal\nM:4/4\n")
    assert parse_abc(out["abc"]).voices["Vocal"].bars[0][2] == (4, 4)


def test_numbers_mean_the_score_as_read_and_bar_ops_run_first():
    chorus = {"op": "REHARMONIZE", "from_bar": 47, "to_bar": 47, "chords": [
        {"bar": 47, "beat": 1, "root": "G", "quality": "m7"}]}
    ops = [rep(3, "chorus"), cut(4, "outro"), chorus, rep(1, "intro")]
    out, checks = run(CHORDS, ops)
    assert [v["ok"] for v in out["verdicts"]] == [True] * 4 and [v["index"] for v in out["verdicts"]] == [1, 2, 3, 4]
    assert checks == {"ok": True, "problems": [], "differences": []}
    assert labels(out["abc"]) == ["intro", "intro", "verse", "chorus", "chorus"]
    after = Doc(out["abc"])  # the intro (bars 1-10) doubled: the chorus starts at 57, its copy at 73
    assert after.bar(57, "Vocal")[0] == after.bar(73, "Vocal")[0] == ["chord", "Gm7"]
    twice, _ = run(CHORDS, [rep(3, "chorus"), rep(3, "chorus")])
    assert labels(twice["abc"]).count("chorus") == 3


@pytest.mark.parametrize("ops,reason", [
    ([rep(9, "chorus")], "section 9 does not exist (sections: 1 intro, 2 verse, 3 chorus, 4 outro)"),
    ([rep(2, "chorus")], "section 2 is verse, not chorus; chorus is section 3"),
    ([cut(3, "bridge")], "section 3 is chorus, not bridge; there is no bridge section "
                         "(1 intro, 2 verse, 3 chorus, 4 outro)"),
    ([cut(3, "chorus"), rep(3, "chorus")], "section 3 is already cut by op 1; a plan either repeats a section or cuts it"),
    ([rep(3, "chorus"), cut(3, "chorus")],
     "section 3 is already repeated by op 1; a plan either repeats a section or cuts it"),
    ([cut(1, "intro"), cut(2, "verse"), cut(3, "chorus"), cut(4, "outro")],
     "cutting section 4 would leave no music; keep at least one section"),
])
def test_refusals_name_the_reason_and_leave_the_score_alone(ops, reason):
    out, checks = run(CHORDS, ops)
    assert out["verdicts"][-1] == {"index": len(ops), "op": ops[-1]["op"], "ok": False, "reason": reason}
    sizes = [10, 36, 16, 3]  # 2c944049's sections
    assert checks["ok"] and Doc(out["abc"]).nbars() == Doc(CHORDS).nbars() + sum(
        sizes[o["section"] - 1] * (1 if o["op"] == "REPEAT" else -1) for o, v in zip(ops, out["verdicts"]) if v["ok"])


def test_section_ops_without_lyrics_refuse():
    out, _ = run(CHORDS, [rep(3, "chorus")], lyrics=None)
    assert out["verdicts"][0]["reason"] == ('the request has no lyrics; REPEAT moves them with the score, '
                                            'so send them ("" for none)')
    assert out["abc"] == CHORDS and out["lyrics"] is None


def test_the_label_check_ignores_case_and_brackets():
    out, _ = run(CHORDS, [rep(3, "[Chorus]")])
    assert out["verdicts"][0]["ok"]


def test_the_section_check_finds_a_lost_bar_a_changed_bar_and_a_wrong_order():
    out, _ = run(CHORDS, [rep(3, "chorus")])
    good = out["abc"]
    assert check_sections(CHORDS, good, [rep(3, "chorus")])["ok"]
    assert check_sections(CHORDS, good, [rep(2, "verse")])["problems"][0] == (
        "the sections are intro, verse, chorus, chorus, outro; expected intro, verse, verse, chorus, outro")
    changed = good.replace("% outro", "% outro", 1)
    doc = Doc(changed)
    doc.edit(60, "Ins")[0][2] = "C" if doc.bar(60, "Ins")[0][2] != "C" else "D"
    assert check_sections(CHORDS, doc.text(), [rep(3, "chorus")])["problems"] == [
        "bar 60 does not match the bar it comes from"]
    assert check_sections(CHORDS, CHORDS, [rep(3, "chorus")])["problems"][-1] == (
        "the score has 65 bars; the section ops should leave 81 (from 65)")


TIED_SHARP = "\n".join([
    "X:1", "T:", "M:4/4", "L:1/4", "Q:1/4=90", 'V: Vocal clef=treble name="Vocal Melody" snm="Vocal"',
    'V: Ins clef=treble name="Ins Melody" snm="Inst."', "K:C",
    "% verse", "V: Vocal", '"C"CDE^F-|', "V: Ins", "Z|",
    "% chorus", "V: Vocal", '"C"FGAB|', "V: Ins", "Z|",  # F keeps the tie's sharp: it sounds F#
    "% outro", "V: Vocal", '"C"c4|', "V: Ins", "Z|"]) + "\n"


KEY_CHANGE = TIED_SHARP.replace("CDE^F-|", "CDEF|").replace(
    'V: Vocal\n"C"FGAB|\nV: Ins\nZ|', 'V: Vocal\nK:G\n"G"GABc|\nV: Ins\nK:G\nZ|')  # the outro is read in G


def test_a_section_with_no_bars_or_no_comment_is_refused():
    empty = TIED_SHARP.replace("% verse", "% intro\n% verse")
    assert run(empty, [rep(1, "intro")])[0]["verdicts"][0]["reason"] == "section 1 has no bars"
    bare = TIED_SHARP.replace("% verse\n", "")
    assert run(bare, [cut(1, "untitled")])[0]["verdicts"][0]["reason"] == (
        "section 1 has no '% label' comment; only labelled sections can be repeated or cut")


def test_a_key_the_cut_section_changed_is_restated_for_the_music_after_it():
    out, checks = run(KEY_CHANGE, [cut(2, "chorus")])
    assert checks["ok"] and out["abc"].endswith('% outro\nV: Vocal\nK:G\n"C"c4|\nV: Ins\nK:G\nZ|\n')


@pytest.mark.parametrize("op,bar", [(rep(2, "chorus"), 3), (cut(1, "verse"), 1)])
def test_a_note_that_leaned_on_the_cut_tie_for_its_sharp_is_a_check_problem(op, bar):
    out, checks = run(TIED_SHARP, [op])
    assert out["verdicts"][0]["ok"] and checks["ok"] is False
    assert checks["problems"] == [f"the first note of bar {bar} changes pitch once the tie into it is cut; "
                                  "the section before it ends on a tied note spelled by the tie"]


def test_seconds_per_section_add_up_to_the_song():
    sections = section_seconds(CHORDS)
    assert [(s["index"], s["label"], s["from_bar"], s["to_bar"]) for s in sections] == [
        (1, "intro", 1, 10), (2, "verse", 11, 46), (3, "chorus", 47, 62), (4, "outro", 63, 65)]
    assert sections[3]["seconds"] == round(3 * 4 * 60 / 87, 1) == 8.3
    assert abs(sum(s["seconds"] for s in sections) - 179.3) < 0.2
