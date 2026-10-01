import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { LyricsReading, Transcription } from './api';

const readLyrics = vi.fn();
const jobStatus = vi.fn();
vi.mock('./api', () => ({
  api: {
    readLyrics: (...a: unknown[]) => readLyrics(...a),
    jobStatus: (...a: unknown[]) => jobStatus(...a),
  },
}));

const { useReadLyricsStore } = await import('./readLyricsStore');
const { POLL_MS } = await import('./transcribeStore');
const { useCreateDraftStore } = await import('./createDraftStore');

const ABC = 'X:1\nT:\nM:4/4\nL:1/16\nQ:1/4=75\nK:Fm\n% intro\nV: Vocal\nZ|\n% verse\nV: Vocal\nZ|\n% chorus\nV: Vocal\nZ|\n';
const T = {
  score: ABC, sectionStarts: [{ label: 'intro', bar: 0, seconds: 0 }, { label: 'verse', bar: 1, seconds: 3 }, { label: 'chorus', bar: 2, seconds: 6 }],
} as Transcription;
const line = (text: string, at: number) => ({ text, start: at, end: at + 1, words: [{ text, start: at, end: at + 1 }] });
const READING: LyricsReading = {
  language: 'en', sourceLabel: 'Ellies City 2', segments: [line('Midnight city', 3.5), line('In the shadows', 6.5)],
};
const src = new Blob(['audio']);
const draft = () => useCreateDraftStore.getState();

function withScore(dropped?: number[]) {
  draft().patchAudio({ yueScore: { abc: ABC, source: 'Ellies City 2', transcription: T, previewJobId: 'tr-1', dropped } });
}

async function finish(reading: LyricsReading = READING) {
  jobStatus.mockResolvedValueOnce({ status: 'running' }).mockResolvedValueOnce({ status: 'done', lyrics: reading });
  const run = useReadLyricsStore.getState().start(src, 'Ellies City 2', '', ['en', 'zh']);
  await vi.advanceTimersByTimeAsync(POLL_MS * 2);
  await run;
}

beforeEach(() => {
  vi.useFakeTimers();
  useReadLyricsStore.getState().reset();
  useCreateDraftStore.getState().load({ genType: 'audio', source: 'library', selectedSongId: 'song-1', coverEngine: 'yue2' });
  readLyrics.mockReset().mockResolvedValue({ jobId: 'ly-1' });
  jobStatus.mockReset();
});
afterEach(() => vi.useRealTimers());

describe('readLyricsStore', () => {
  it('reads the source and places the words under the sections they were sung in', async () => {
    withScore();
    await finish();
    expect(readLyrics).toHaveBeenCalledWith(src, 'Ellies City 2', '');
    expect(draft().lyrics).toBe('[Intro]\n\n[Verse]\nMidnight city\n\n[Chorus]\nIn the shadows');
    expect(useReadLyricsStore.getState()).toMatchObject({ stage: 'idle', placed: draft().lyrics, outcome: { lines: 2, placed: true } });
  });

  it('passes VOCAL LANGUAGE and fills an AUTO one only with a language the engine sings', async () => {
    draft().patch({ vocalLanguage: 'de' });
    jobStatus.mockResolvedValueOnce({ status: 'done', lyrics: READING });
    const run = useReadLyricsStore.getState().start(src, 'x', 'de', ['en']);
    await vi.advanceTimersByTimeAsync(POLL_MS);
    await run;
    expect(readLyrics).toHaveBeenLastCalledWith(src, 'x', 'de');
    expect(draft().vocalLanguage).toBe('de');

    draft().patch({ vocalLanguage: '' });
    await finish();
    expect(draft().vocalLanguage).toBe('en');
    draft().patch({ vocalLanguage: '' });
    await finish({ ...READING, language: 'ja' });
    expect(draft().vocalLanguage).toBe('');
  });

  it('never forces a language it filled in itself, and takes back a wrong guess', async () => {
    await finish(); // heard EN: AUTO VOCAL LANGUAGE becomes EN
    expect(draft().vocalLanguage).toBe('en');
    jobStatus.mockResolvedValueOnce({ status: 'done', lyrics: { ...READING, language: 'de' } });
    const run = useReadLyricsStore.getState().start(src, 'x', 'en', ['en', 'zh']);
    await vi.advanceTimersByTimeAsync(POLL_MS);
    await run;
    expect(readLyrics).toHaveBeenLastCalledWith(src, 'x', ''); // auto-detect again, not a forced EN
    expect(draft().vocalLanguage).toBe(''); // DE isn't sung: the EN guess goes back to AUTO

    draft().patch({ vocalLanguage: 'en' }); // the user's own choice is forced
    jobStatus.mockResolvedValueOnce({ status: 'done', lyrics: READING });
    const mine = useReadLyricsStore.getState().start(src, 'x', 'en', ['en', 'zh']);
    await vi.advanceTimersByTimeAsync(POLL_MS);
    await mine;
    expect(readLyrics).toHaveBeenLastCalledWith(src, 'x', 'en');
  });

  it('follows the score while LYRICS are untouched, and stops once they are edited', async () => {
    await finish(); // no score yet: untagged lines
    expect(draft().lyrics).toBe('Midnight city\nIn the shadows');

    withScore(); // TRANSCRIBE lands
    useReadLyricsStore.getState().follow();
    expect(draft().lyrics).toContain('[Verse]\nMidnight city');

    withScore([2]); // CHORUS left out
    useReadLyricsStore.getState().follow();
    expect(draft().lyrics).toBe('[Intro]\n\n[Verse]\nMidnight city');
    expect(useReadLyricsStore.getState().outcome).toMatchObject({ lines: 1, leftOut: 1 });

    draft().patch({ lyrics: '[Verse]\nMidnight city, my edit' });
    withScore();
    useReadLyricsStore.getState().follow();
    expect(draft().lyrics).toBe('[Verse]\nMidnight city, my edit');
  });

  it("drops a reading for a source that was picked away from", async () => {
    withScore();
    jobStatus.mockResolvedValueOnce({ status: 'done', lyrics: READING });
    const run = useReadLyricsStore.getState().start(src, 'x', '', 'any');
    draft().patchAudio({ selectedSongId: 'song-2' });
    await vi.advanceTimersByTimeAsync(POLL_MS);
    await run;
    expect(draft().lyrics).toBe('');
    expect(useReadLyricsStore.getState()).toMatchObject({ stage: 'idle', reading: null });

    await finish();
    draft().patchAudio({ selectedSongId: 'song-3' });
    useReadLyricsStore.getState().follow();
    expect(useReadLyricsStore.getState().reading).toBeNull();
  });

  it('reports a failed read and keeps polling through a network hiccup', async () => {
    jobStatus.mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce({ status: 'failed', error: 'lyrics-server transcribe -> CUDA out of memory' });
    const run = useReadLyricsStore.getState().start(src, 'x', '', 'any');
    await vi.advanceTimersByTimeAsync(POLL_MS * 2);
    await run;
    expect(useReadLyricsStore.getState()).toMatchObject({ stage: 'failed', error: 'lyrics-server transcribe -> CUDA out of memory' });

    readLyrics.mockRejectedValueOnce(new Error('a generation is already in progress'));
    await useReadLyricsStore.getState().start(src, 'x', '', 'any');
    expect(useReadLyricsStore.getState().error).toBe('a generation is already in progress');
  });
});
