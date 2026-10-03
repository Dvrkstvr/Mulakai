/**
 * A scriptable Ollama for tests (architecture.md "Seams", D-039): node http on an ephemeral
 * port, serving what the planner path calls — `/v1/chat/completions`, `/api/tags`, `/api/ps`
 * and `POST /api/generate {keep_alive: 0}`. A chat call loads the model; an unload empties
 * `/api/ps` after `listedPolls` more polls (or never, with `neverUnloads`). `notOllama` makes
 * every `/api/*` route 404, as an OpenAI-compatible server that is not Ollama would.
 */
import http from 'node:http';

export interface ChatScript {
  /** The assistant message content (JSON text for a plan). */
  content?: string;
  promptTokens?: number | null;
  /** An HTTP error instead of a reply. */
  status?: number;
  /** Never answer (for timeouts / aborts). */
  hang?: boolean;
}

export interface FakeOllamaOptions {
  models?: string[];
  contextLength?: number;
  listedPolls?: number;
  neverUnloads?: boolean;
  notOllama?: boolean;
}

export interface FakeOllama {
  url: string;
  opts: FakeOllamaOptions;
  /** Replies for successive chat calls; the last one repeats. */
  chats: ChatScript[];
  /** Every request seen, in order. */
  requests: Array<{ method: string; path: string; body: unknown; at: number }>;
  loaded: string | null;
  psPolls: () => number[];
  close: () => Promise<void>;
}

export async function startFakeOllama(opts: FakeOllamaOptions = {}): Promise<FakeOllama> {
  let pollsLeft = -1;
  const fake: FakeOllama = {
    url: '', opts, chats: [], requests: [], loaded: null,
    psPolls: () => fake.requests.filter((r) => r.path === '/api/ps').map((r) => r.at),
    close: () => new Promise((resolve) => { server.closeAllConnections(); server.close(() => resolve()); }),
  };
  const send = (res: http.ServerResponse, status: number, body: unknown) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  };
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      const body = raw ? JSON.parse(raw) as Record<string, unknown> : null;
      const path = (req.url ?? '').split('?')[0];
      fake.requests.push({ method: req.method ?? '', path, body, at: Date.now() });
      if (path.startsWith('/api/') && opts.notOllama) return send(res, 404, { error: 'not found' });
      if (path === '/api/tags') return send(res, 200, { models: (opts.models ?? ['qwen3:14b']).map((name) => ({ name, model: name })) });
      if (path === '/api/ps') {
        if (pollsLeft === 0) fake.loaded = null;
        else if (pollsLeft > 0) pollsLeft -= 1;
        const models = fake.loaded ? [{ name: fake.loaded, model: fake.loaded, size_vram: 11_670_000_000, context_length: opts.contextLength ?? 16384 }] : [];
        return send(res, 200, { models });
      }
      if (path === '/api/generate' && req.method === 'POST') {
        if (body?.keep_alive === 0 && !opts.neverUnloads) pollsLeft = opts.listedPolls ?? 0;
        return send(res, 200, { model: body?.model, done: true, done_reason: 'unload' });
      }
      if (path === '/v1/chat/completions' && req.method === 'POST') {
        const script = (fake.chats.length > 1 ? fake.chats.shift() : fake.chats[0]) ?? { content: '{"ops":[]}' };
        if (script.hang) return undefined;
        const model = String(body?.model ?? '');
        if (!(opts.models ?? ['qwen3:14b']).includes(model)) return send(res, 404, { error: { message: `model "${model}" not found, try pulling it first` } });
        if (script.status) return send(res, script.status, { error: { message: 'scripted failure' } });
        fake.loaded = model;
        pollsLeft = -1;
        const usage = script.promptTokens === null ? undefined : { prompt_tokens: script.promptTokens ?? 2000, completion_tokens: 40 };
        return send(res, 200, { choices: [{ index: 0, message: { role: 'assistant', content: script.content ?? '' } }], ...(usage ? { usage } : {}) });
      }
      send(res, 404, { error: 'not found' });
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  fake.url = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
  return fake;
}
