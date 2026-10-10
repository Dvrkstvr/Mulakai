/** ✦ HELP (PLAN.md "Editor Redesign", the field helper): ask the local LLM for suggestions for one field. The job polls
 * through `/api/generate/:jobId` like every other job and carries `assist.suggestions` once done. */
import { json } from './http';

export type AssistKind = 'layer' | 'repaint' | 'lyrics';

export interface AssistBody {
  kind: AssistKind;
  songId: string;
  caption: string;
  bpm: number | null;
  key: string | null;
  layers: string[];
  layer: string;
  part: string;
  current: string;
  ask: string;
  language?: string | null;
}

export interface Suggestion { text: string; why: string }

export interface AssistStatus {
  status: 'queued' | 'loading' | 'running' | 'done' | 'failed';
  queuePosition?: number;
  error?: string;
  cancelled?: boolean;
  assist?: { suggestions: Suggestion[] };
}

export const assistApi = {
  health: (): Promise<{ available: boolean }> => fetch('/api/assist/health').then((r) => json(r)),
  ask: (body: AssistBody): Promise<{ jobId: string }> =>
    fetch('/api/assist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => json(r)),
  status: (jobId: string): Promise<AssistStatus> => fetch(`/api/generate/${jobId}`).then((r) => json(r)),
  cancel: (jobId: string): Promise<unknown> => fetch(`/api/generate/${jobId}/cancel`, { method: 'POST' }).then(() => undefined),
};
