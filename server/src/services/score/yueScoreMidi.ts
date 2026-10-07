/**
 * yue-server's `POST /v1/scores/midi` (PLAN.md "Export a Score as MIDI"): a native two-voice
 * score as a type-1 MIDI file. A score upstream's parser refuses is a 422 there, thrown here as
 * ScoreMidiRefused with the parser's reason; anything else is the engine's failure.
 */
import { request, failure, headers, type EngineTarget } from '../engineClient.js';
import { yue2Engine } from '../engines/yue2.js';

/** CPU-only, like a read. */
const MIDI_TIMEOUT_MS = 30_000;

export class ScoreMidiRefused extends Error {}

export async function scoreToMidi(abc: string, target: EngineTarget = yue2Engine): Promise<Buffer> {
  if (!target.url) throw new Error(`${target.label} is not set up (YUE_API_URL)`);
  const res = await request(target, '/v1/scores/midi', {
    method: 'POST',
    headers: headers(target, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ abc }),
  }, 'score midi', MIDI_TIMEOUT_MS);
  if (res.status === 422) {
    const body = (await res.json().catch(() => ({}))) as { detail?: unknown };
    throw new ScoreMidiRefused(typeof body.detail === 'string' ? body.detail : 'not a YuE2 score');
  }
  if (!res.ok) throw await failure(target, 'score midi', res);
  return Buffer.from(await res.arrayBuffer());
}
