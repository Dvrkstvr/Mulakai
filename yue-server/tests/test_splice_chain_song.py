"""The e2e's chained splice (CK-5, F-069): the contract song (CHORDS + LYRICS, the score every e2e take
stores) planned as REHARMONIZE bar 43 + CUT the chorus, recorded end to end so e2e/fake-score replays a
real apply and a real chain verdict for the exact spec the server sends (D-039). Synthetic audio at the
song's tempo, its grid's chords read from the score. `python -m pytest --record-contract` rewrites them."""
import pytest

import splice_harness
from conftest import wait_for
from contract import check_contract
from score_fixtures import CHORDS, LYRICS, STYLE
from splice_dsp import SR
from splice_fixtures import grid, groove, wav_bytes
from splice_grid import score_bars
from splice_harness import contract, done, splice, splicer, tracker  # noqa: F401
from test_score_edit_routes import REHARM

CUT_CHORUS = {"op": "CUT", "section": 3, "label": "chorus"}
APPLY = {"abc": CHORDS, "style": STYLE, "lyrics": LYRICS, "ops": [REHARM, CUT_CHORUS]}
LEAD = 0.25


def song_grid(abc: str, audio, beat: float, lead: float) -> dict:
    chords = score_bars(abc).chords
    return grid(len(chords), beat, lead, len(audio) / SR, chord_of=lambda i: chords[i] or "N")


def test_the_contract_song_reharmonized_and_cut_splices_in_two_steps(make_client, splicer, tracker, monkeypatch,
                                                                      record_contract):
    applied = make_client().post("/v1/scores/apply", json=APPLY)
    assert applied.status_code == 200 and all(v["ok"] for v in applied.json()["verdicts"])
    check_contract(record_contract, "apply-chain-song", "/v1/scores/apply", APPLY, applied)
    edited = applied.json()["abc"]
    base_bars, edited_bars = score_bars(CHORDS), score_bars(edited)
    assert (len(base_bars.chords), len(edited_bars.chords)) == (65, 49)
    beat = 60 / base_bars.bpm
    base = groove(65, beat, lead=LEAD)
    new = groove(49, beat, lead=LEAD + 0.03)  # the render sits 30 ms later than its grid says
    tracker.add(wav_bytes(base), song_grid(CHORDS, base, beat, LEAD))
    tracker.add(wav_bytes(new), song_grid(edited, new, beat, LEAD))
    monkeypatch.setattr(splice_harness, "NEW", new)
    client = splicer(tracker)
    job = client.post("/v1/jobs", json={"style": STYLE, "lyrics": "", "seed": 1, "abc": edited}).json()
    wait_for(lambda: client.get(f"/v1/jobs/{job['id']}").json()["status"] == "succeeded")
    # The server's spec v2: the card's steps last bar first, the render, the plan's edited score; no cached grid.
    spec = {"steps": [{"op": CUT_CHORUS}, {"op": REHARM}], "base_abc": CHORDS, "render_job": job["id"], "edited_abc": edited}
    submitted = splice(client, spec, wav_bytes(base))
    final = done(client, submitted.json()["id"])
    result = final["result"]
    assert final["status"] == "succeeded", final["error"]
    assert (result["verdict"], result["kind"], result["bars"]) == ("ok", "several", [43, 62])
    assert [(r["kind"], r["bars"], r["verdict"]) for r in result["steps"]] == [("CUT", [47, 62], "ok"),
                                                                             ("REHARMONIZE", [43, 43], "ok")]
    assert result["null_test"]["different"] == 0
    assert result["length_diff_s"] == pytest.approx(-16 * 4 * beat, abs=0.1)
    stable = {**final, "result": {**result, "steps": [{**r, "null_test": r["null_test"] and {
        **r["null_test"], "samples": round(r["null_test"]["samples"], -4)}} for r in result["steps"]]}}
    contract(record_contract, "splice-chain-song", spec, submitted, stable, {job["id"]: "job-0001"})
