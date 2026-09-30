import time

import pytest

from jobs import JobStore, QueueFull
from worker import classify


def test_queue_is_fifo_and_bounded():
    store = JobStore(max_pending=2)
    a, b = store.submit({"n": 1}), store.submit({"n": 2})
    with pytest.raises(QueueFull):
        store.submit({"n": 3})
    assert store.claim(timeout=0) == (a["id"], {"n": 1})
    assert store.get(a["id"])["status"] == "running"
    assert store.claim(timeout=0)[0] == b["id"]
    assert store.claim(timeout=0) is None


def test_cancelling_a_queued_job_skips_it():
    store = JobStore(max_pending=4)
    a, b = store.submit({}), store.submit({})
    snap = store.cancel(a["id"])
    assert snap["status"] == "cancelled" and snap["stage"] == "finished"
    assert store.claim(timeout=0)[0] == b["id"]


def test_a_cancel_mid_job_wins_over_success():
    store = JobStore(max_pending=4)
    job_id = store.submit({})["id"]
    store.claim(timeout=0)
    store.cancel(job_id)
    assert store.get(job_id)["status"] == "running"  # running jobs finish their current step
    assert store.finish(job_id, "succeeded", result={"x": 1}) == "cancelled"
    assert store.get(job_id)["result"] is None


def test_cancel_on_a_finished_job_is_a_no_op():
    store = JobStore(max_pending=4)
    job_id = store.submit({})["id"]
    store.claim(timeout=0)
    store.finish(job_id, "succeeded", result={})
    assert store.cancel(job_id)["status"] == "succeeded"
    assert store.cancel_requested(job_id) is False


def test_stage_only_moves_running_jobs():
    store = JobStore(max_pending=4)
    job_id = store.submit({})["id"]
    store.stage(job_id, "generating")
    assert store.get(job_id)["stage"] == "queued"
    store.claim(timeout=0)
    store.stage(job_id, "generating")
    assert store.get(job_id)["stage"] == "generating"


def test_prune_forgets_only_old_finished_jobs():
    store = JobStore(max_pending=4)
    done, live = store.submit({})["id"], store.submit({})["id"]
    store.claim(timeout=0)
    store.finish(done, "failed", error={})
    time.sleep(0.02)
    assert store.prune(older_than_s=0.01) == [done]
    assert store.get(done) is None and store.get(live) is not None


def test_classify():
    assert classify(ValueError("too long"))["code"] == "invalid_generation"
    assert classify(ValueError("too long"))["message"] == "too long"
    assert classify(RuntimeError("boom"))["code"] == "inference_failed"
