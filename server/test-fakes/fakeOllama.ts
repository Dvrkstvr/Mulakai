/**
 * A scriptable Ollama for tests (architecture.md "Seams", D-039): node http on an ephemeral
 * port, serving what the planner path calls — `/v1/chat/completions`, `/api/tags`, `/api/ps`
 * and `POST /api/generate {keep_alive: 0}`. A chat call loads its model (several may be resident, as on
 * Ollama); an unload drops the named model from `/api/ps` after `listedPolls` more polls (or never, with
 * `neverUnloads`). `notOllama` makes every `/api/*` route 404, as an OpenAI-compatible server that is not
 * Ollama would. A lyrics call (LD, its system prompt is lyricsPrompt's) answers from `lyrics`, else with
 * chatScripts' `autoLyrics` for the asked language and section count.
 */
import http from 'node:http';
import { autoLyrics } from './chatScripts.js';
import { contract } from './fakeYue.js';

/** The yue-server contract fixtures a scripted WRITE_PHRASE plan replays (F-026). */
export const PHRASE_FIXTURES = ['apply-write-phrase', 'apply-write-phrase-compound', 'apply-write-phrase-beat-sum',
  'apply-write-phrase-sanity', 'apply-write-phrase-vocal-sings'] as const;

/** A planner reply holding exactly the ops a recorded apply fixture sent, so fakeYue has its answer:
 * `phrasePlan('apply-write-phrase-vocal-sings')` is a phrase over bars where the Vocal sings. */
export function phrasePlan(fixture: (typeof PHRASE_FIXTURES)[number]): ChatScript {
  return { content: JSON.stringify({ ops: (contract(fixture).request.body as { ops: unknown[] }).ops }) };
}

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
  /** Replies for successive lyrics calls (the last one repeats); empty = autoLyrics. */
  lyrics: ChatScript[];
  /** Every request seen, in order; an `/api/ps` poll with the models it listed. */
  requests: Array<{ method: string; path: string; body: unknown; at: number; listed?: string[] }>;
  /** The first resident model, or null when `/api/ps` would list nothing; set = only that one resident. */
  loaded: string | null;
  /** Every resident model, in load order. */
  resident: () => string[];
  psPolls: () => number[];
  close: () => Promise<void>;
}

/** A lyrics call (LD): its system prompt is lyricsPrompt's. */
export const isLyricsCall = (body: unknown): boolean =>
  String((body as { messages?: Array<{ content?: string }> } | null)?.messages?.[0]?.content ?? '').startsWith('You write song lyrics');

export async function startFakeOllama(opts: FakeOllamaOptions = {}): Promise<FakeOllama> {
  /** Resident model -> polls left before an asked unload empties it (-1: not asked to unload). */
  const resident = new Map<string, number>();
  const fake: FakeOllama = {
    url: '', opts, chats: [], lyrics: [], requests: [],
    get loaded() { return [...resident.keys()][0] ?? null; },
    set loaded(model: string | null) { resident.clear(); if (model) resident.set(model, -1); },
    resident: () => [...resident.keys()],
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
        for (const [name, left] of resident) {
          if (left === 0) resident.delete(name);
          else if (left > 0) resident.set(name, left - 1);
        }
        fake.requests.at(-1)!.listed = [...resident.keys()];
        const models = [...resident.keys()].map((name) => ({ name, model: name, size_vram: 11_670_000_000, context_length: opts.contextLength ?? 16384 }));
        return send(res, 200, { models });
      }
      if (path === '/api/generate' && req.method === 'POST') {
        const name = String(body?.model ?? '');
        if (body?.keep_alive === 0 && !opts.neverUnloads && resident.has(name)) resident.set(name, opts.listedPolls ?? 0);
        return send(res, 200, { model: body?.model, done: true, done_reason: 'unload' });
      }
      if (path === '/v1/chat/completions' && req.method === 'POST') {
        const messages = (body?.messages ?? []) as Array<{ content?: string }>;
        const lyricsCall = isLyricsCall(body);
        const queue = lyricsCall ? fake.lyrics : fake.chats;
        const script = (queue.length > 1 ? queue.shift() : queue[0])
          ?? (lyricsCall ? autoLyrics(messages, body?.response_format) : { content: '{"ops":[]}' });
        if (script.hang) return undefined;
        const model = String(body?.model ?? '');
        if (!(opts.models ?? ['qwen3:14b']).includes(model)) return send(res, 404, { error: { message: `model "${model}" not found, try pulling it first` } });
        if (script.status) return send(res, script.status, { error: { message: 'scripted failure' } });
        resident.set(model, -1);
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
