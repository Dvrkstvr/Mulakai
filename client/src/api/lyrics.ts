/** READ LYRICS slice (PLAN.md "Cover Lyrics From the Recording"): read the words sung in a
 * cover's source. The job polls through generation.ts's `jobStatus` like every other job. */
import { json } from './http';

export interface LyricWord {
  text: string;
  start: number;
  end: number;
}

/** One line as the reader heard it, with each word's timing. */
export interface LyricSegment extends LyricWord {
  words: LyricWord[];
}

/** A reading as lyrics-server returns it. A version's stored one (`Version.wordTimings`)
 * times the Editor's lyric lines (PLAN.md "Editor Word Timestamps"). */
export interface WordTimings {
  language: string;
  segments: LyricSegment[];
}

/** What a finished READ LYRICS job carries (`GET /api/generate/:jobId`'s `lyrics`). */
export interface LyricsReading extends WordTimings {
  sourceLabel: string;
}

export const lyricsApi = {
  /** `language` '' = auto-detect. */
  readLyrics: (srcAudio: Blob, sourceLabel: string, language: string): Promise<{ jobId: string }> => {
    const form = new FormData();
    form.append('src_audio', srcAudio, 'source.wav');
    form.append('source_label', sourceLabel);
    form.append('language', language);
    return fetch('/api/lyrics/transcribe', { method: 'POST', body: form }).then((r) => json<{ jobId: string }>(r));
  },

  /** configured = the server has a lyrics-server URL; ready = it answers. */
  lyricsHealth: (): Promise<{ configured: boolean; ready: boolean }> =>
    fetch('/api/lyrics/health').then((r) => json<{ configured: boolean; ready: boolean }>(r)),
};
