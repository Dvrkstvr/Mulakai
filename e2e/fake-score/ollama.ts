/**
 * A stand-in for the score planner's Ollama (F-028), mirroring server/test-fakes/fakeOllama.ts:
 * the OpenAI-compatible `POST /v1/chat/completions` (a chat loads the model), `GET /api/tags`,
 * `GET /api/ps` (lists the loaded model with its context length, what contextGuard reads) and
 * `POST /api/generate {keep_alive: 0}` (the unload of that model: the next `/api/ps` no longer lists it). No
 * model, no GPU. LD (D-233): the planner and the German lyrics model (LYRICS_MODEL_DE, gemma4) are both pulled;
 * a lyrics call (its system prompt is the server's lyricsPrompt) answers from `lyrics`, not `replies`.
 *
 * Ours, not Ollama's:
 *   POST /__fake/planner {replies?, lyrics?, down?, hold?}  `replies`: the content of successive chat answers (the
 *        last one repeats), or `{hang: true}` to never answer (CANCEL while planning); `lyrics`: the same for
 *        lyrics calls (chatReplies' sp5Turn splits a recorded recipe into both); `down`: every
 *        Ollama route drops the connection, as a stopped Ollama would refuse it (PLANNER OFFLINE,
 *        ASSISTANT OFF); `hold`: chat calls wait unanswered until it is set false again (THINKING)
 *   GET  /__fake/planner                    what was asked so far (a chat's last message as `prompt`, its
 *        `model`), and what is loaded (the first resident model, or null)
 */
import http from 'node:http';

const MODEL = process.env.LLM_MODEL || 'qwen3:14b';
const LYRICS_MODEL = process.env.LYRICS_MODEL_DE || 'gemma4:26b-a4b-it-q4_K_M';
const PULLED = [MODEL, LYRICS_MODEL];
const CONTEXT_LENGTH = 16_384;

type Reply = string | { hang: true };

interface Seen { method: string; path: string; model?: string; keepAlive?: unknown; prompt?: string; at: number }

export function startFakeOllama(port: number): http.Server {
  let replies: Reply[] = [];
  let lyrics: Reply[] = [];
  let down = false;
  let hold = false;
  let held: Array<() => void> = [];
  /** Resident models; an unloading one leaves on the next `/api/ps`. */
  const resident = new Set<string>();
  const unloading = new Set<string>();
  const loaded = () => [...resident][0] ?? null;
  const seen: Seen[] = [];
  const isLyrics = (messages: unknown) => Array.isArray(messages) && String(messages[0]?.content ?? '').startsWith('You write song lyrics');

  /** About what a tokenizer gives for the prompt: contextGuard refuses a count that looks cut. */
  const promptTokens = (messages: unknown) =>
    Math.ceil((Array.isArray(messages) ? messages : []).reduce((n: number, m: { content?: unknown }) => n + String(m?.content ?? '').length, 0) / 4);

  function chat(body: Record<string, unknown>, send: (s: number, b: unknown) => void): void {
    const model = String(body.model ?? '');
    if (!PULLED.includes(model)) return send(404, { error: { message: `model "${model}" not found, try pulling it first` } });
    resident.add(model);
    unloading.delete(model);
    const queue = isLyrics(body.messages) ? lyrics : replies;
    const reply = (queue.length > 1 ? queue.shift() : queue[0]) ?? '{"ops":[]}';
    if (typeof reply !== 'string') return; // hang: the socket stays open until the caller aborts
    send(200, {
      id: 'chatcmpl-fake', object: 'chat.completion', model,
      choices: [{ index: 0, message: { role: 'assistant', content: reply }, finish_reason: 'stop' }],
      usage: { prompt_tokens: promptTokens(body.messages), completion_tokens: 40, total_tokens: promptTokens(body.messages) + 40 },
    });
  }

  const server = http.createServer((req, res) => {
    let raw = '';
    req.setEncoding('utf8');
    req.on('data', (c: string) => { raw += c; });
    req.on('end', () => {
      const send = (status: number, body: unknown) => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(body));
      };
      const method = req.method ?? 'GET';
      const path = (req.url ?? '').split('?')[0];
      const body = (raw ? JSON.parse(raw) : {}) as Record<string, unknown>;
      if (path === '/__fake/planner') {
        if (method === 'POST') {
          if (Array.isArray(body.replies)) replies = body.replies as Reply[];
          if (Array.isArray(body.lyrics)) lyrics = body.lyrics as Reply[];
          if (typeof body.down === 'boolean') down = body.down;
          if (typeof body.hold === 'boolean') hold = body.hold;
          if (!hold) for (const answer of held.splice(0)) answer();
          return send(200, { down, hold, replies: replies.length });
        }
        return send(200, { down, hold, loaded: loaded(), seen });
      }
      const messages = Array.isArray(body.messages) ? body.messages as Array<{ content?: unknown }> : [];
      const prompt = path === '/v1/chat/completions' ? String(messages.at(-1)?.content ?? '') : undefined;
      const model = typeof body.model === 'string' ? { model: body.model } : {};
      seen.push({ method, path, ...model, ...(path === '/api/generate' ? { keepAlive: body.keep_alive } : {}), ...(prompt === undefined ? {} : { prompt }), at: Date.now() });
      if (down) return void req.socket.destroy();
      if (method === 'GET' && path === '/api/tags') return send(200, { models: PULLED.map((name) => ({ name, model: name })) });
      if (method === 'GET' && path === '/api/ps') {
        for (const name of unloading) resident.delete(name);
        unloading.clear();
        const models = [...resident].map((name) => ({ name, model: name, size_vram: 11_670_000_000, context_length: CONTEXT_LENGTH }));
        return send(200, { models });
      }
      if (method === 'POST' && path === '/api/generate') {
        if (body.keep_alive === 0 && resident.has(String(body.model))) unloading.add(String(body.model));
        return send(200, { model: body.model, created_at: new Date().toISOString(), response: '', done: true, done_reason: 'unload' });
      }
      if (method === 'POST' && path === '/v1/chat/completions') {
        // Held: answered on release, unless the caller gave up (CANCEL) in between.
        if (hold) {
          if (PULLED.includes(String(body.model))) resident.add(String(body.model)); // Ollama loads the model on receipt, before it answers
          return void held.push(() => { if (!res.writableEnded && !req.socket.destroyed) chat(body, send); });
        }
        return chat(body, send);
      }
      send(404, { error: 'not found' });
    });
  });
  server.listen(port, '127.0.0.1', () => console.log(`fake Ollama on http://127.0.0.1:${port}`));
  return server;
}
