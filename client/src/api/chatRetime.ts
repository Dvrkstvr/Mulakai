/** RE-TIME on the chat reading (RT-5, F-092): the server's `routes/chatRetime.ts`. RE-TIME and UNDO answer the new
 * `AnalysisView`; a refusal throws `RetimeError` with the server's code (`no_bundle`, `out_of_range`, ...) or
 * `refused` (a 409: the reading cannot be re-timed as it stands); nothing changed. TRANSCRIBE AGAIN answers the job. */
import type { AnalysisView } from './chatAnalysis';
import { RetimeError } from './retime';

/** RT-6 (F-094): the body of a say whose turn re-timed the playable version's reading (the server's `RetimeDoneBody`).
 * `readAt`: the re-timed reading's stamp; `asReadAt`: the reading as read, which UNDO restores. */
export interface ChatRetimeDoneBody {
  retime: { songId: string; versionId: string; number: number; mode: 'half' | 'double' | 'bpm'; bpm: number; fromBpm: number;
    fromBars: number; toBars: number; droppedNotes: number; notes: number; readAt: string; asReadAt: string };
}

const post = (url: string, body: unknown) =>
  fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

async function answer<T>(res: Response): Promise<T> {
  if (res.ok) return res.json() as Promise<T>;
  const b = (await res.json().catch(() => ({}))) as { code?: unknown; reason?: unknown; error?: unknown };
  const reason = typeof b.reason === 'string' ? b.reason : typeof b.error === 'string' ? b.error : `HTTP ${res.status}`;
  throw new RetimeError(reason, res.status, typeof b.code === 'string' ? b.code : res.status === 409 ? 'refused' : 'retime_failed');
}

const base = (songId: string) => `/api/chat/songs/${encodeURIComponent(songId)}/analysis`;

export const chatRetimeApi = {
  retime: (songId: string, versionId: string, mode: 'half' | 'double' | 'bpm', bpm: number | null) =>
    post(`${base(songId)}/retime`, { versionId, mode, ...(bpm !== null ? { bpm } : {}) }).then((r) => answer<AnalysisView>(r)),
  undo: (songId: string, versionId: string) => post(`${base(songId)}/retime/undo`, { versionId }).then((r) => answer<AnalysisView>(r)),
  again: (songId: string, versionId: string) => post(`${base(songId)}/again`, { versionId }).then((r) => answer<{ jobId: string }>(r)),
};
