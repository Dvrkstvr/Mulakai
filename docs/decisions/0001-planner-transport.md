# 0001 · Planner transport: OpenAI-compatible chat plus Ollama-native control

Date: 2026-10-03 · Status: accepted · Source: D-002, D-012 (`pipeline/decisions.md`),
PLAN.md "Score Agent"

## Context

The score agent asks a local LLM for a plan: a list of score operations
that must match a strict shape. The planner shares a 16 GB card with YuE2
and ACE-Step, so Mulakai must also be able to unload it, confirm the
release and check its context size. The app already reaches each backend
through one URL setting (`ACESTEP_API_URL`, `YUE_API_URL`).

## Decision

- Plans: `POST {LLM_API_URL}/v1/chat/completions` (OpenAI-compatible), with
  `response_format: {type: "json_schema", strict: true}` built per song,
  `reasoning_effort: "none"` and the model from `LLM_MODEL` (default
  `qwen3:14b`).
- Control: Ollama-native endpoints, because Ollama's `/v1` endpoint cannot
  set `keep_alive` or the context size (docs.ollama.com/api/openai-compatibility,
  read 2026-10-03): `GET /api/tags` (model present), `GET /api/ps`
  (`context_length`, loaded models), `POST /api/generate {model,
  keep_alive: 0}` (unload).
- Ollama is the supported server. A server without `/api/ps` is reported
  as "not an Ollama server: the GPU hand-off can't be confirmed".

## Alternatives

- Ollama native `/api/chat` only: works, but ties the plan call to one
  vendor for no gain.
- llama.cpp's router first: no confirmed-unload story on this machine yet.
- A bespoke planner process: one more service to install and keep alive.

## Consequences

- Thinking-mode output is off by contract: with it on, SP-1's planner spent
  1,500 tokens reasoning, returned empty content and took 71 s.
- The Ollama server needs `OLLAMA_CONTEXT_LENGTH=16384`; a shorter context
  truncates the prompt silently, so `contextGuard` refuses it.
- Revisit if the user runs llama.cpp, or a chosen model is not served by
  Ollama.
