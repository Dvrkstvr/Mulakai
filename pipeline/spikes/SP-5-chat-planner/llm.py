"""Ollama client for SP-5 (the planner's call shape: /v1/chat/completions, strict json_schema, reasoning_effort none) plus the
hand-off (unload via /api/generate keep_alive 0, poll /api/ps until empty). Throwaway; mirrors plannerClient.ts / ollamaControl.ts."""
from __future__ import annotations

import os
import time

import requests

URL = os.environ.get("LLM_URL", "http://127.0.0.1:11435")
MODEL = os.environ.get("LLM_MODEL", "qwen3:14b")
TEMPERATURE = float(os.environ.get("SP5_TEMP", "0.3"))
MAX_TOKENS = int(os.environ.get("SP5_MAX_TOKENS", "2000"))


def chat(messages, schema, seed=None, model=None, temperature=None, max_tokens=None, timeout=300):
    body = {
        "model": model or MODEL, "messages": messages, "stream": False,
        "temperature": TEMPERATURE if temperature is None else temperature,
        "max_tokens": max_tokens or MAX_TOKENS, "reasoning_effort": "none",
    }
    if schema is not None:
        body["response_format"] = {"type": "json_schema", "json_schema": {"name": "turn", "strict": True, "schema": schema}}
    if seed is not None:
        body["seed"] = seed
    t0 = time.time()
    r = requests.post(f"{URL}/v1/chat/completions", json=body, timeout=timeout)
    wall = time.time() - t0
    if r.status_code != 200:
        raise RuntimeError(f"HTTP {r.status_code}: {r.text[:300]}")
    j = r.json()
    ch = j["choices"][0]
    return {"content": ch["message"].get("content") or "", "finish": ch.get("finish_reason"),
            "prompt_tokens": j["usage"]["prompt_tokens"], "completion_tokens": j["usage"]["completion_tokens"], "wall": wall}


def ps():
    return requests.get(f"{URL}/api/ps", timeout=5).json().get("models", [])


def unload(model=None):
    requests.post(f"{URL}/api/generate", json={"model": model or MODEL, "keep_alive": 0}, timeout=15)


def release(model=None, bound=10.0, interval=0.1):
    """The hand-off: unload, then poll /api/ps until empty. Returns (ms to empty, polls, ok)."""
    t0 = time.time()
    try:
        unload(model)
    except Exception:
        pass
    polls = 0
    while True:
        polls += 1
        if not ps():
            return round((time.time() - t0) * 1000), polls, True
        if time.time() - t0 > bound:
            return round((time.time() - t0) * 1000), polls, False
        time.sleep(interval)
