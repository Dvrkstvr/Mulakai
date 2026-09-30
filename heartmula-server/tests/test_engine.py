"""HeartMulaEngine's orchestration against a fake heartlib pipeline built from
tiny torch modules. CPU only; the model moves are recorded, not performed."""
import pytest

torch = pytest.importorskip("torch")

from engine import HeartMulaEngine, drop_kv_caches  # noqa: E402
from engine_api import JobCancelled  # noqa: E402

GPU = torch.device("meta")  # stands in for cuda: frames.to() works without a GPU


class Recorded(torch.nn.Module):
    def __init__(self, name, log):
        super().__init__()
        self.name, self.log = name, log

    def to(self, device):  # record instead of moving
        self.log.append((self.name, torch.device(device).type))
        return self


class Attn(torch.nn.Module):
    def __init__(self):
        super().__init__()
        self.kv_cache, self.cache_enabled = None, False


class Backbone(torch.nn.Module):
    max_seq_len = 64

    def __init__(self):
        super().__init__()
        self.attn = Attn()

    def forward(self, x):
        return x


class FakeLM(Recorded):
    def __init__(self, log):
        super().__init__("lm", log)
        self.backbone = Backbone()


class FakeCodec(Recorded):
    def detokenize(self, frames):
        self.log.append(("codec.detokenize", frames.device.type))
        return torch.ones(2, 480 * frames.shape[-1]) * 1.2


class FakePipe:
    def __init__(self, log, eos_after=None, cancel_at=None):
        self._mula, self._codec, self.log = FakeLM(log), FakeCodec("codec", log), log
        self.eos_after, self.cancel_at, self.calls = eos_after, cancel_at, []

    def preprocess(self, inputs, cfg_scale):
        return {"tokens": torch.zeros(2, len(inputs["lyrics"]), 9)}

    def _forward(self, inputs, max_audio_length_ms, temperature, topk, cfg_scale):
        self.calls.append(dict(max_ms=max_audio_length_ms, temperature=temperature, topk=topk, cfg=cfg_scale))
        self._mula.backbone.attn.kv_cache = torch.nn.Linear(1, 1)  # what setup_caches leaves behind
        self._mula.backbone.attn.cache_enabled = True
        steps = max_audio_length_ms // 80
        frames = [torch.zeros(8)]
        for i in range(steps):
            if i == self.cancel_at:
                self.on_cancel()
            self._mula.backbone(torch.zeros(1))
            if i == self.eos_after:
                break
            frames.append(torch.zeros(8))
        return {"frames": torch.stack(frames).T}


def make(eos_after=None, cancel_at=None):
    log = []
    engine = HeartMulaEngine("unused", device="meta")
    engine.pipe = FakePipe(log, eos_after, cancel_at)
    return engine, log


def run(engine, cancelled=lambda: False, **request):
    stages = []
    req = {"tags": "pop", "lyrics": "la la", "max_audio_length_ms": 800, **request}
    return engine.generate(req, stages.append, cancelled), stages


def test_one_model_on_the_gpu_at_a_time_and_both_parked_after():
    engine, log = make(eos_after=3)
    out, stages = run(engine)
    assert log == [("lm", "meta"), ("lm", "cpu"), ("codec", "meta"),
                   ("codec.detokenize", "meta"), ("codec", "cpu")]
    assert stages == ["generating", "decoding"]
    assert out.audio.shape == (480 * 4, 2) and out.sample_rate == 48_000
    assert out.truncated is False


def test_running_to_the_cap_is_truncated():
    engine, _ = make()
    out, _ = run(engine)
    assert out.truncated is True


def test_auto_knobs_get_heartlibs_defaults():
    engine, _ = make(eos_after=0)
    run(engine, cfg_scale=None, temperature=None, topk=None)
    run(engine, cfg_scale=2.0, temperature=0.8, topk=20)
    assert engine.pipe.calls == [dict(max_ms=800, temperature=1.0, topk=50, cfg=1.5),
                                 dict(max_ms=800, temperature=0.8, topk=20, cfg=2.0)]


def test_kv_caches_are_dropped_and_the_cancel_hook_removed_after_the_lm():
    engine, _ = make(eos_after=2)
    run(engine)
    backbone = engine.pipe._mula.backbone
    assert backbone.attn.kv_cache is None and backbone.attn.cache_enabled is False
    assert not backbone._forward_pre_hooks


def test_cancel_stops_the_lm_mid_song_and_still_parks_it():
    engine, log = make(cancel_at=4)
    flag = {"on": False}
    engine.pipe.on_cancel = lambda: flag.update(on=True)
    with pytest.raises(JobCancelled):
        run(engine, cancelled=lambda: flag["on"])
    assert log == [("lm", "meta"), ("lm", "cpu")]  # the codec never came up
    assert not engine.pipe._mula.backbone._forward_pre_hooks


def test_prompt_plus_cap_over_the_context_is_rejected_before_the_gpu():
    engine, log = make()
    with pytest.raises(ValueError, match="context"):
        run(engine, lyrics="x" * 60)  # 60 prompt positions + 10 frames > 64
    assert log == []


@pytest.mark.parametrize("budget,fraction", [(0.0, 14 / 16), (12.0, 0.75), (40.0, 1.0)])
def test_vram_cap_defaults_to_card_total_minus_2_gib(monkeypatch, budget, fraction):
    calls = []
    props = type("Props", (), {"total_memory": 16 * 1024**3})()
    monkeypatch.setattr(torch.cuda, "get_device_properties", lambda _d: props)
    monkeypatch.setattr(torch.cuda, "set_per_process_memory_fraction", lambda f, _d: calls.append(f))
    HeartMulaEngine("unused", device="cuda", vram_budget_gb=budget)._cap_vram()
    HeartMulaEngine("unused", device="cpu", vram_budget_gb=budget)._cap_vram()
    assert calls == [pytest.approx(fraction)]


def test_drop_kv_caches_leaves_cacheless_modules_alone():
    model = torch.nn.Sequential(torch.nn.Linear(1, 1))
    drop_kv_caches(model)
    assert isinstance(model[0], torch.nn.Linear)
