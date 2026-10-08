/** Covers slice: YuE2 melody covers (PLAN.md "YuE2 Melody Covers via SheetSage2") — TRANSCRIBE a
 * source into a score, its piano preview, COVER from a score, and a cover's stored score. The
 * jobs poll through generation.ts's `jobStatus` like every other job. */
import { json } from './http';
import type { EngineId } from './engineTypes';

/** What a finished TRANSCRIBE job carries (`GET /api/generate/:jobId`'s `transcription`). */
export interface Transcription {
  score: string;
  sourceLabel: string;
  warnings: string[];
  measures: number | null;
  vocalNotes: number | null;
  instrumentalNotes: number | null;
  durationSeconds: number | null;
  hasPreview: boolean;
  /** Where each score section starts in the source, from its downbeats; null when the engine
   * sent none (READ LYRICS then falls back to the score's tempo grid). */
  sectionStarts: { label: string; bar: number; seconds: number }[] | null;
  /** The kept notation files a re-time rebuilds from (D-207); null when none were kept, absent from an older server. */
  notationId?: string | null;
}

/** A cover score's planner tokens: the header and each `% name` section, which add up to the
 * whole (PLAN.md "YuE2 Covers: Pick the Score's Sections"). */
export interface ScoreSize {
  budget: number;
  header: number;
  sections: { name: string; tokens: number }[];
}

export const coversApi = {
  transcribe: (engine: EngineId, srcAudio: Blob, sourceLabel: string): Promise<{ jobId: string }> => {
    const form = new FormData();
    form.append('src_audio', srcAudio, 'source.wav');
    form.append('source_label', sourceLabel);
    return fetch(`/api/engines/${engine}/transcribe`, { method: 'POST', body: form }).then((r) => json<{ jobId: string }>(r));
  },

  /** Streamed from the engine, so it seeks; gone once the engine's retention window passes. */
  transcriptionPreviewUrl: (engine: EngineId, jobId: string): string => `/api/engines/${engine}/transcribe/${jobId}/preview`,

  /** A melody cover from `abc`, saved as a new song. Same Create field names as generateWithEngine. */
  coverWithEngine: (engine: EngineId, params: Record<string, unknown>): Promise<{ jobId: string }> =>
    fetch(`/api/engines/${engine}/cover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    }).then((r) => json<{ jobId: string }>(r)),

  /** The score a cover was made from, for REUSE PROMPT; null when the song isn't one. */
  coverSourceScore: async (engine: EngineId, songId: string): Promise<string | null> => {
    const res = await fetch(`/api/engines/${engine}/covers/${songId}/score`);
    return res.ok ? res.text() : null;
  },

  /** The score's size in the planner's tokens, per section; null when the engine can't say. */
  scoreSize: async (engine: EngineId, abc: string): Promise<ScoreSize | null> => {
    const res = await fetch(`/api/engines/${engine}/score-size`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ abc }),
    });
    return res.status === 204 ? null : json<ScoreSize>(res);
  },
};
