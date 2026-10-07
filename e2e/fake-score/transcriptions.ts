/**
 * The fake yue-server's `/v1/transcriptions` (chat C1, CL-8b): the chords run a version's analysis makes for its
 * downbeat grid. Replays yue-server's recorded `transcription-chords-done` (submit, settled record, score) and, as
 * the run's grid, `transcription-grid-contract`: one downbeat per bar of the contract song, so `/v1/scores/bars`
 * (`scores-bars-contract`) gives the chat strip 65 bars to mark. Mirrors server/test-fakes/fakeYueTranscribe.ts (e2e
 * imports nothing from server/). A submit whose form differs from the recording gets a 500 naming it.
 */
import { contract, same } from './contracts.js';

type Send = (status: number, body: unknown, type?: string) => void;

interface TranscriptionFixture {
  request: { form: Record<string, string> };
  response: { status: number; body: Record<string, unknown> & { id: string } };
  final: { status: number; body: Record<string, unknown> };
  score: string | null;
}

/** A multipart form's text fields (the file part is skipped). */
function formFields(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of raw.matchAll(/name="([^"]+)"\r\n\r\n([^\r]*)\r\n/g)) out[m[1]] = m[2];
  return out;
}

/** True when it answered. Multipart: call it before the JSON parse. */
export function transcriptionRoute(method: string, route: string, raw: string, send: Send): boolean {
  const m = /^\/v1\/transcriptions(?:\/([^/]+)(?:\/(score|cancel|grid))?)?$/.exec(route);
  if (!m) return false;
  const [, id, sub] = m;
  if (id === 'health') return (send(200, { ok: true }), true);
  const fx = contract('transcription-chords-done') as unknown as TranscriptionFixture;
  if (!id && method === 'POST') {
    const form = formFields(raw);
    if (!same(fx.request.form, form)) return (send(500, { detail: `fake yue-server: no recorded transcription for form ${JSON.stringify(form)}` }), true);
    return (send(fx.response.status, fx.response.body), true);
  }
  if (id !== fx.response.body.id) return (send(404, { detail: 'Job not found' }), true);
  if (sub === 'cancel') return (send(200, { ...fx.final.body, status: 'cancelled' }), true);
  if (sub === 'grid') {
    const grid = contract('transcription-grid-contract');
    return (send(grid.response.status, grid.response.body), true);
  }
  if (sub === 'score') return (fx.score === null ? send(404, { detail: 'Artifact not found' }) : send(200, fx.score, 'text/plain'), true);
  return (send(fx.final.status, fx.final.body), true);
}
