/**
 * A stand-in for ACE-Step 1.5's native API, just wide enough for the golden path: every route
 * server/src/services/acestep.ts calls answers in ACE-Step's own `{data, code, error}` envelope,
 * and every task finishes a moment later with a canned tone. Nothing touches a GPU.
 *
 * GET /__fake/tasks is ours, not ACE-Step's: the spec reads it to check what actually went over
 * the wire (e.g. that a repaint carried the selected region). POST /__fake/hold `{ hold }` is
 * ours too: while held, every task keeps reporting "running", so a spec can queue a second job
 * behind it (PLAN.md "UI Redesign", S4).
 */
import http from 'node:http';
import { toneWav } from './wav.js';

const PORT = Number(process.env.FAKE_ACESTEP_PORT ?? 8101);
/** Every take is this long, whatever was asked for — the spec's region maths relies on it. */
const DURATION_SEC = Number(process.env.FAKE_ACESTEP_DURATION ?? 12);
/** How long a task reports "running" before it completes, so progress polling is exercised. */
const PENDING_MS = Number(process.env.FAKE_ACESTEP_PENDING_MS ?? 400);

const MODELS = [
  { name: 'acestep-v15-turbo', supported_task_types: ['text2music', 'repaint', 'cover'] },
  { name: 'acestep-v15-base', supported_task_types: ['text2music', 'repaint', 'cover', 'lego', 'extract', 'complete'] },
];

interface FakeTask {
  id: string;
  params: Record<string, string>;
  hadSrcAudio: boolean;
  createdAt: number;
  freqHz: number;
}

const tasks = new Map<string, FakeTask>();
let held = false;

function send(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

const ok = (res: http.ServerResponse, data: unknown) => send(res, 200, { data, code: 200, error: null });

async function readBody(req: http.IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

/** release_task arrives as JSON, or as multipart when a source/reference file rides along. */
async function readParams(req: http.IncomingMessage): Promise<{ params: Record<string, string>; hadSrcAudio: boolean }> {
  const raw = await readBody(req);
  const type = req.headers['content-type'] ?? '';
  if (!type.startsWith('multipart/form-data')) {
    const json = raw.length ? (JSON.parse(raw.toString('utf8')) as Record<string, unknown>) : {};
    return { params: Object.fromEntries(Object.entries(json).map(([k, v]) => [k, String(v)])), hadSrcAudio: false };
  }
  const form = await new Response(new Uint8Array(raw), { headers: { 'Content-Type': type } }).formData();
  const params: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === 'string') params[k] = v;
  return { params, hadSrcAudio: form.has('src_audio') };
}

function resultFor(task: FakeTask) {
  return {
    file: `/v1/audio?path=${encodeURIComponent(`/fake/${task.id}.wav`)}`,
    status: 1,
    prompt: task.params.prompt ?? '',
    lyrics: task.params.lyrics ?? '',
    metas: { bpm: 120, duration: DURATION_SEC, keyscale: 'C major', timesignature: '4' },
    seed_value: String(1000 + tasks.size),
    dit_model: task.params.model || 'acestep-v15-base',
  };
}

function queryRow(id: string) {
  const task = tasks.get(id);
  if (!task) return { task_id: id, status: 2, result: '' };
  const elapsed = Date.now() - task.createdAt;
  if (held || elapsed < PENDING_MS) {
    const progress = Math.min(elapsed / PENDING_MS, 0.99);
    return { task_id: id, status: 0, result: JSON.stringify([{ progress, stage: 'running' }]), progress_text: 'fake' };
  }
  return { task_id: id, status: 1, result: JSON.stringify([resultFor(task)]) };
}

async function route(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`);
  const key = `${req.method} ${url.pathname}`;
  switch (key) {
    case 'GET /health':
      return send(res, 200, { status: 'ok' });
    case 'GET /v1/model_inventory':
      return ok(res, { models: MODELS, lm_models: [], default_model: 'acestep-v15-base' });
    case 'POST /v1/init':
    case 'POST /v1/lora/load':
    case 'POST /v1/lora/unload':
    case 'POST /v1/lora/toggle':
    case 'POST /v1/lora/scale':
      await readBody(req);
      return ok(res, {});
    case 'GET /v1/lora/status':
      return ok(res, { lora_loaded: false, use_lora: false, lora_scale: 1, adapter_type: null });
    case 'POST /release_task': {
      const { params, hadSrcAudio } = await readParams(req);
      const id = `fake-${tasks.size + 1}`;
      // A distinct pitch per task, so each version's audio is distinguishable.
      tasks.set(id, { id, params, hadSrcAudio, createdAt: Date.now(), freqHz: 220 + 55 * tasks.size });
      return ok(res, { task_id: id, status: 'queued' });
    }
    case 'POST /query_result': {
      const body = JSON.parse((await readBody(req)).toString('utf8')) as { task_id_list?: string[] };
      return ok(res, (body.task_id_list ?? []).map(queryRow));
    }
    case 'GET /v1/audio': {
      const id = /\/fake\/(.+)\.wav$/.exec(url.searchParams.get('path') ?? '')?.[1];
      const task = id ? tasks.get(id) : undefined;
      if (!task) return send(res, 404, { detail: 'no such audio' });
      res.writeHead(200, { 'Content-Type': 'audio/wav' });
      return void res.end(toneWav(DURATION_SEC, task.freqHz));
    }
    case 'POST /lyric_timestamp':
      // No artifact sidecar — the same answer ACE-Step gives an instrumental, which callers treat as "no timestamps".
      await readBody(req);
      return send(res, 404, { detail: 'no artifact sidecar' });
    case 'POST /format_input': {
      const body = JSON.parse((await readBody(req)).toString('utf8')) as { prompt?: string; lyrics?: string };
      return ok(res, { caption: body.prompt ?? '', lyrics: body.lyrics ?? '' });
    }
    case 'POST /v1/create_sample':
    case 'POST /create_random_sample': {
      // The library's quick-create box goes through here before the Create screen opens.
      const body = JSON.parse((await readBody(req)).toString('utf8')) as { query?: string };
      return ok(res, {
        caption: body.query ?? 'fake caption', lyrics: '[verse]\nfake words', bpm: 120,
        keyscale: 'C major', timesignature: '4', duration: DURATION_SEC, vocal_language: 'en', language: 'en',
      });
    }
    case 'POST /__fake/hold': {
      const body = JSON.parse((await readBody(req)).toString('utf8') || '{}') as { hold?: boolean };
      held = !!body.hold;
      return send(res, 200, { held });
    }
    case 'GET /__fake/tasks':
      return send(res, 200, [...tasks.values()].map(({ id, params, hadSrcAudio }) => ({ id, params, hadSrcAudio })));
    default:
      await readBody(req);
      return send(res, 404, { detail: `fake ACE-Step has no route for ${key}` });
  }
}

http
  .createServer((req, res) => {
    route(req, res).catch((err: unknown) => send(res, 500, { detail: String(err) }));
  })
  .listen(PORT, '127.0.0.1', () => console.log(`fake ACE-Step on http://127.0.0.1:${PORT}`));
