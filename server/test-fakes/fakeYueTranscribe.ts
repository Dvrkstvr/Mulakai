/**
 * fakeYue's `/v1/transcriptions` (CR-0's contract, D-039): replays one of the fixtures yue-server's pytest
 * recorded (`yue-server/tests/data/contract/transcription-*.json`: chords done, chords failed, hold). A submit
 * whose form fields differ from the recording gets a 500 naming that, never an invented reply; a cancel makes
 * the record `cancelled`. `/grid` (chat C1, D-174) answers a recorded grid reply once the record succeeded.
 */
import fs from 'node:fs';
import type http from 'node:http';
import path from 'node:path';

export type TranscriptionName = 'transcription-chords-done' | 'transcription-chords-failed' | 'transcription-hold';

/** A recorded transcription (CR-0's pytest): the submit's form and reply, the record once settled, the score. */
export interface TranscriptionFixture {
  name: string;
  request: { method: string; path: string; form: Record<string, string>; file: string };
  response: { status: number; body: Record<string, unknown> };
  final: { status: number; body: Record<string, unknown> };
  score: string | null;
}

export const loadTranscription = (dir: string, name: TranscriptionName) =>
  JSON.parse(fs.readFileSync(path.join(dir, `${name}.json`), 'utf8')) as TranscriptionFixture;

/** A recorded `GET /v1/transcriptions/{id}/grid` reply (CL-2's pytest): a chords run's grid, or 404 `no_grid`. */
export type GridName = 'transcription-grid-ok' | 'transcription-grid-melody-only';
export interface GridFixture { name: string; request: { method: string; path: string }; response: { status: number; body: unknown } }

export const loadGrid = (dir: string, name: GridName) => JSON.parse(fs.readFileSync(path.join(dir, `${name}.json`), 'utf8')) as GridFixture;

export interface TranscriptionScript {
  fixture: TranscriptionFixture;
  /** What `/grid` answers once the record has succeeded (default: the ok grid). */
  grid?: GridFixture;
  cancelled: Set<string>;
}

type Send = (res: http.ServerResponse, status: number, body: unknown, type?: string) => void;
type Requests = Array<{ method?: string; path: string; body: unknown }>;

/** A multipart form's text fields (the file part is skipped). */
function formFields(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of raw.matchAll(/name="([^"]+)"\r\n\r\n([^\r]*)\r\n/g)) out[m[1]] = m[2];
  return out;
}

/** True when it answered. */
export function transcriptionRoute(
  script: TranscriptionScript, requests: Requests, req: http.IncomingMessage, res: http.ServerResponse, route: string,
  raw: string, send: Send, same: (a: unknown, b: unknown) => boolean,
): boolean {
  const m = /^\/v1\/transcriptions(?:\/([^/]+)(?:\/(score|cancel|grid))?)?$/.exec(route);
  if (!m) return false;
  const [, id, sub] = m;
  const fx = script.fixture;
  const cancelled = script.cancelled;
  if (id === 'health') return (send(res, 200, { ok: true }), true);
  if (!id && req.method === 'POST') {
    const form = formFields(raw);
    requests[requests.length - 1].body = { form };
    if (!same(fx.request.form, form)) return (send(res, 500, { detail: `fakeYue: no recorded transcription for form ${JSON.stringify(form)}` }), true);
    cancelled.delete(String(fx.response.body.id));
    return (send(res, fx.response.status, fx.response.body), true);
  }
  if (id !== fx.response.body.id) return (send(res, 404, { detail: 'Job not found' }), true);
  if (sub === 'cancel') return (cancelled.add(id), send(res, 200, { ...fx.final.body, status: 'cancelled' }), true);
  if (sub === 'grid') {
    if (cancelled.has(id) || fx.final.body.status !== 'succeeded') return (send(res, 409, { detail: 'Artifact is not available for this job state' }), true);
    return (script.grid ? send(res, script.grid.response.status, script.grid.response.body) : send(res, 404, { detail: 'fakeYue: no grid fixture set' }), true);
  }
  if (sub === 'score') return (fx.score === null ? send(res, 404, { detail: 'Artifact not found' }) : send(res, 200, fx.score, 'text/plain'), true);
  return (send(res, fx.final.status, cancelled.has(id) ? { ...fx.final.body, status: 'cancelled', stage: 'cancelled' } : fx.final.body), true);
}
