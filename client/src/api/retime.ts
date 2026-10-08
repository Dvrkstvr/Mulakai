/** Re-time slice (PLAN.md "Re-time a Transcription", F-091): is a transcription's kept reading still here, and
 * its score rebuilt at half time, double time or a named BPM. The server keeps the files (D-207); yue-server
 * rebuilds (decision 0002). */
import { ApiError } from './http';

export type RetimeMode = 'half' | 'double' | 'bpm';

export interface RetimeResult {
  abc: string;
  measures: number;
  bpm: number | null;
  readBpm: number;
  vocalNotes: number;
  insNotes: number;
  notes: number;
  /** Notes the slower grid cannot hold (D-210): said before the person commits. */
  droppedNotes: number;
  warnings: string[];
}

/** A refused re-time: `code` is the server's (`no_bundle`, `out_of_range`, `retime_refused`, ...). */
export class RetimeError extends ApiError {
  code: string;
  constructor(message: string, status: number, code: string) {
    super(message, status);
    this.code = code;
  }
}

export const retimeApi = {
  /** False once the kept files are gone (then RE-TIME offers TRANSCRIBE AGAIN). */
  notationKept: async (notationId: string): Promise<boolean> =>
    (await fetch(`/api/scores/notation/${encodeURIComponent(notationId)}`)).ok,

  retimeScore: async (notationId: string, mode: RetimeMode, bpm: number | null): Promise<RetimeResult> => {
    const res = await fetch('/api/scores/retime', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notationId, mode, ...(bpm !== null ? { bpm } : {}) }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
      throw new RetimeError(body.error ?? `HTTP ${res.status}`, res.status, body.code ?? 'retime_failed');
    }
    return res.json() as Promise<RetimeResult>;
  },
};
