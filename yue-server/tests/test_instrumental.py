import json

from conftest import NATIVE, FakePipeline
from instrumental import arrange, is_instrumental, section_tags
from jobs import JobStore
from worker import run_job

TAGS = "[Intro]\n\n[Verse]\n\n[Chorus]\n"
REQUEST = {"style": "Instrumental, lo-fi", "lyrics": TAGS, "seed": 3}


def noop(*_args):
    return False


def test_only_tags_only_lyrics_are_instrumental():
    assert is_instrumental(REQUEST)
    assert is_instrumental({**REQUEST, "lyrics": " [Intro] \n\n[Outro]", "cot": "melody"})
    assert not is_instrumental({**REQUEST, "lyrics": "[Verse]\nsalt on the window"})
    assert not is_instrumental({**REQUEST, "lyrics": "  \n"})  # empty sings wordlessly
    assert not is_instrumental({**REQUEST, "cot": "off"})  # no score to convert
    assert is_instrumental({**REQUEST, "abc": NATIVE})  # an instrumental cover converts it too


def test_section_tags_come_from_the_score_comments():
    assert section_tags(NATIVE) == "[Intro]\n\n[Pre-Chorus]\n"
    assert section_tags("X:1\nK:C\n|C8|\n") == ""


def test_arrange_moves_every_vocal_note_and_generates_from_that_score():
    pipe = FakePipeline(score=NATIVE)
    plan = pipe.plan(REQUEST, cancelled=noop, on_token=noop)
    converted, final, record = arrange(pipe, REQUEST, plan, cancelled=noop, on_token=noop)
    assert final["cot"] == "full" and final["lyrics"] == "[Intro]\n\n[Pre-Chorus]\n"
    assert final["abc"] == converted.abc and pipe.requests[-1] == final
    assert '"Gmaj7"z16"Am7"z16|"D7"z16"G"z16|' in final["abc"]  # Vocal keeps only chords
    assert "B8d8c8A8|F16G16|" in final["abc"]  # its melody now plays on Ins
    assert record == {"converted": True, "vocal_notes_moved": 6, "ins_notes_trimmed": 1, "planned_abc": NATIVE}


def test_a_chordless_plan_is_generated_with_cot_melody():
    chordless = NATIVE.replace('"G"', "").replace('"Gmaj7"', "").replace('"Am7"', "").replace('"D7"', "")
    pipe = FakePipeline(score=chordless)
    plan = pipe.plan(REQUEST, cancelled=noop, on_token=noop)
    assert arrange(pipe, REQUEST, plan, cancelled=noop, on_token=noop)[1]["cot"] == "melody"


def test_arrange_keeps_the_plan_when_it_cannot_convert():
    cases = [(FakePipeline(), "native two-voice"),  # not the native dialect
             (FakePipeline(score=NATIVE, truncated=(True, False)), "truncated"),
             (FakePipeline(score=NATIVE, fits=False), "planning budget")]
    for pipe, reason in cases:
        plan = pipe.plan(REQUEST, cancelled=noop, on_token=noop)
        kept, request, record = arrange(pipe, REQUEST, plan, cancelled=noop, on_token=noop)
        assert kept is plan and request is REQUEST and len(pipe.requests) == 1
        assert record["converted"] is False and reason in record["reason"]


def test_a_sung_request_is_left_alone():
    pipe = FakePipeline(score=NATIVE)
    sung = {**REQUEST, "lyrics": "[Verse]\nla la"}
    plan = pipe.plan(sung, cancelled=noop, on_token=noop)
    assert arrange(pipe, sung, plan, cancelled=noop, on_token=noop) == (plan, sung, None)


def test_the_job_saves_the_converted_score_the_planned_one_and_the_record(tmp_path):
    store = JobStore(tmp_path, 4, 3600)
    job_id = store.submit(REQUEST)[0]["id"]
    store.claim(timeout=1)
    run_job(FakePipeline(score=NATIVE), store, job_id, REQUEST)
    out = tmp_path / job_id
    assert store.get(job_id)["status"] == "succeeded"
    assert (out / "planned.abc").read_text(encoding="utf-8") == NATIVE
    result = json.loads((out / "result.json").read_text(encoding="utf-8"))
    assert result["instrumental"] == {"converted": True, "vocal_notes_moved": 6, "ins_notes_trimmed": 1}
    assert result["request"]["abc"] == (out / "score.abc").read_text(encoding="utf-8") != NATIVE
