/**
 * ✦ HELP (PLAN.md "Editor Redesign", the field helper): `POST /api/assist` queues one help call and answers its job id;
 * the client polls `GET /api/generate/:jobId` like every other job and reads `assist.suggestions`. `GET /health` says
 * whether help can run at all (a local LLM is configured), so the Editor shows ✦ HELP only then.
 */
import { Router } from 'express';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { QueueFullError } from '../services/genQueue.js';
import { startAssist } from '../services/assist/assistJob.js';
import type { AssistKind, AssistRequest } from '../services/assist/assistPrompt.js';

export const assistRouter = Router();

const KINDS: AssistKind[] = ['layer', 'repaint', 'lyrics'];
/** Long enough for a whole song's words; the prompt stays far below any context. */
const MAX_TEXT = 6000;

const str = (v: unknown, max = 400) => (typeof v === 'string' ? v.slice(0, max) : '');

/** The request, or why it is refused. */
export function parseAssist(body: unknown): AssistRequest | string {
  const b = (body ?? {}) as Record<string, unknown>;
  if (!KINDS.includes(b.kind as AssistKind)) return `kind must be one of ${KINDS.join(', ')}`;
  if (typeof b.songId !== 'string' || !b.songId) return 'songId is required';
  if (typeof b.current === 'string' && b.current.length > MAX_TEXT) return `the text is over ${MAX_TEXT} characters`;
  return {
    kind: b.kind as AssistKind,
    songId: b.songId,
    caption: str(b.caption, 600),
    bpm: typeof b.bpm === 'number' && Number.isFinite(b.bpm) ? b.bpm : null,
    key: typeof b.key === 'string' && b.key ? b.key.slice(0, 40) : null,
    layers: Array.isArray(b.layers) ? b.layers.filter((l): l is string => typeof l === 'string').slice(0, 20).map((l) => l.slice(0, 60)) : [],
    layer: str(b.layer, 60),
    part: str(b.part, 120),
    current: str(b.current, MAX_TEXT),
    ask: str(b.ask, 300),
    language: typeof b.language === 'string' && /^[a-z]{2,3}$/.test(b.language) ? b.language : null,
  };
}

assistRouter.get('/health', (_req, res) => {
  res.json({ available: Boolean(config.llmUrl) });
});

assistRouter.post('/', (req, res) => {
  if (!config.llmUrl) return res.status(503).json({ error: 'help needs a local LLM: set LLM_API_URL' });
  const parsed = parseAssist(req.body);
  if (typeof parsed === 'string') return res.status(400).json({ error: parsed });
  if (!db.prepare('SELECT 1 FROM songs WHERE id = ?').get(parsed.songId)) return res.status(404).json({ error: 'unknown song' });
  try {
    res.status(202).json({ jobId: startAssist(parsed).id });
  } catch (err) {
    if (err instanceof QueueFullError) return res.status(409).json({ error: err.message });
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
