import { describe, it, expect, afterEach } from 'vitest';
import { startFakeOllama, type FakeOllama } from '../../../test-fakes/fakeOllama.js';
import { askPlanner, CallCut } from './plannerClient.js';
import { buildOpSchema } from './opSchema.js';
import type { ScoreFacts } from './planTypes.js';

let fake: FakeOllama;
afterEach(async () => { await fake?.close(); });

const facts: ScoreFacts = {
  header: { meter: '4/4', unit: '1/32', bpm: 87, key: 'Dm', bars: 65, seconds: 179.3, units_per_quarter: 8 },
  key_notes: '', sections: [], lyric_blocks: [], bar_map: [],
};
const messages = [{ role: 'system' as const, content: 'rules' }, { role: 'user' as const, content: 'song' }];

describe('askPlanner (F-019 #1)', () => {
  it("sends a strict per-song JSON schema, reasoning_effort 'none' and the model to /v1/chat/completions", async () => {
    fake = await startFakeOllama();
    fake.chats.push({ content: '{"ops":[{"op":"SET_TEMPO","bpm":88}]}', promptTokens: 2448 });
    const schema = buildOpSchema(facts);
    const reply = await askPlanner({ url: fake.url, model: 'qwen3:14b' }, messages, schema, { timeoutMs: 5000 });
    expect(reply).toEqual({ content: '{"ops":[{"op":"SET_TEMPO","bpm":88}]}', promptTokens: 2448 });
    const sent = fake.requests.find((r) => r.path === '/v1/chat/completions');
    expect(sent?.body).toMatchObject({
      model: 'qwen3:14b', messages, stream: false, reasoning_effort: 'none',
      response_format: { type: 'json_schema', json_schema: { name: 'ops', strict: true, schema } },
    });
    expect(JSON.stringify(sent?.body)).toContain('"maximum":65');
  });

  it('sends temperature 0.3 and max_tokens 2000 by default, a caller\'s max_tokens when given (a chat turn that may edit: 4000, SP-5)', async () => {
    fake = await startFakeOllama();
    fake.chats.push({ content: '{}', promptTokens: 10 }, { content: '{}', promptTokens: 10 });
    await askPlanner({ url: fake.url, model: 'qwen3:14b' }, messages, {}, { timeoutMs: 5000 });
    await askPlanner({ url: fake.url, model: 'qwen3:14b' }, messages, {}, { timeoutMs: 5000, maxTokens: 4000 });
    const sent = fake.requests.filter((r) => r.path === '/v1/chat/completions').map((r) => r.body);
    expect(sent).toMatchObject([{ temperature: 0.3, max_tokens: 2000 }, { temperature: 0.3, max_tokens: 4000 }]);
  });

  it('reports a missing usage as null prompt tokens', async () => {
    fake = await startFakeOllama();
    fake.chats.push({ content: '{}', promptTokens: null });
    expect((await askPlanner({ url: fake.url, model: 'qwen3:14b' }, messages, {}, { timeoutMs: 5000 })).promptTokens).toBeNull();
  });

  it('names a model that is not pulled, HTTP errors, timeouts and a cancel', async () => {
    fake = await startFakeOllama({ models: ['other'] });
    const t = { url: fake.url, model: 'qwen3:14b' };
    await expect(askPlanner(t, messages, {}, { timeoutMs: 5000 })).rejects.toThrow("planner model qwen3:14b not found: run 'ollama pull qwen3:14b'");
    fake.opts.models = ['qwen3:14b'];
    fake.chats.push({ status: 500 });
    await expect(askPlanner(t, messages, {}, { timeoutMs: 5000 })).rejects.toThrow('planner -> HTTP 500');
    fake.chats[0] = { hang: true };
    await expect(askPlanner(t, messages, {}, { timeoutMs: 50 })).rejects.toThrow('planner -> no answer within 0s');
    const cancel = new AbortController();
    setTimeout(() => cancel.abort(), 20);
    await expect(askPlanner(t, messages, {}, { timeoutMs: 5000, signal: cancel.signal })).rejects.toThrow('planner call cancelled');
  });

  it('F-095: a timeout or a cancel is a CallCut (the model may still be generating); a reply cut at max_tokens carries cutAt', async () => {
    fake = await startFakeOllama();
    const t = { url: fake.url, model: 'qwen3:14b' };
    fake.chats.push({ hang: true });
    const timedOut = await askPlanner(t, messages, {}, { timeoutMs: 50 }).catch((e: unknown) => e);
    expect(timedOut).toBeInstanceOf(CallCut);
    expect(timedOut).toMatchObject({ model: 'qwen3:14b', why: 'timed out after 0 s' });
    const cancel = new AbortController();
    setTimeout(() => cancel.abort(), 20);
    expect(await askPlanner(t, messages, {}, { timeoutMs: 5000, signal: cancel.signal }).catch((e: unknown) => e)).toMatchObject({ why: 'cancelled' });
    fake.chats[0] = { content: '{"sections": [', finishReason: 'length' };
    expect(await askPlanner(t, messages, {}, { timeoutMs: 5000, maxTokens: 1200 })).toMatchObject({ content: '{"sections": [', cutAt: 1200 });
    fake.chats[0] = { content: '{}' };
    expect(await askPlanner(t, messages, {}, { timeoutMs: 5000 })).not.toHaveProperty('cutAt');
  });
});
