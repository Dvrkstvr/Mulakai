import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { Transcription } from './api';

const transcribe = vi.fn();
const jobStatus = vi.fn();
vi.mock('./api', () => ({
  api: {
    transcribe: (...a: unknown[]) => transcribe(...a),
    jobStatus: (...a: unknown[]) => jobStatus(...a),
  },
}));

const { useTranscribeStore, POLL_MS } = await import('./transcribeStore');
const { useCreateDraftStore } = await import('./createDraftStore');

const SCORE = 'X:1\nK:Fm\n% intro\nV: Vocal\nZ|\n% verse\nV: Vocal\nC8|\n';
const T: Transcription = {
  score: SCORE, sourceLabel: 'Ellies City 2', warnings: [], measures: 2, vocalNotes: 1, instrumentalNotes: 0,
  durationSeconds: 6, hasPreview: true,
};
const src = new Blob(['audio']);

async function tick() {
  await vi.advanceTimersByTimeAsync(POLL_MS);
}

beforeEach(() => {
  vi.useFakeTimers();
  useTranscribeStore.getState().reset();
  useCreateDraftStore.getState().load({ genType: 'audio', source: 'library', selectedSongId: 'song-1', coverEngine: 'yue2' });
  transcribe.mockReset().mockResolvedValue({ jobId: 'tr-1' });
  jobStatus.mockReset();
});
afterEach(() => vi.useRealTimers());

describe('transcribeStore', () => {
  it('puts the score into the draft and seeds empty lyrics fitted to its sections', async () => {
    jobStatus.mockResolvedValueOnce({ status: 'running', progress: 0.5 }).mockResolvedValueOnce({ status: 'done', transcription: T });
    const run = useTranscribeStore.getState().start('yue2', src, 'Ellies City 2', '[Verse 1]\nMidnight city');
    expect(useTranscribeStore.getState().stage).toBe('running');
    await tick();
    expect(useTranscribeStore.getState().progress).toBe(0.5);
    await tick();
    await run;

    expect(transcribe).toHaveBeenCalledWith('yue2', src, 'Ellies City 2');
    expect(useTranscribeStore.getState().stage).toBe('idle');
    const draft = useCreateDraftStore.getState();
    expect(draft.audio.yueScore).toEqual({ abc: SCORE, source: 'Ellies City 2', transcription: T, previewJobId: 'tr-1' });
    expect(draft.lyrics).toBe('[Intro]\n\n[Verse]\nMidnight city');
  });

  it('leaves typed lyrics alone', async () => {
    useCreateDraftStore.getState().patch({ lyrics: 'my words' });
    jobStatus.mockResolvedValue({ status: 'done', transcription: T });
    const run = useTranscribeStore.getState().start('yue2', src, 'x', 'seed');
    await tick();
    await run;
    expect(useCreateDraftStore.getState().lyrics).toBe('my words');
  });

  it('drops the result when the source was changed meanwhile', async () => {
    jobStatus.mockResolvedValue({ status: 'done', transcription: T });
    const run = useTranscribeStore.getState().start('yue2', src, 'x', '');
    useCreateDraftStore.getState().patchAudio({ selectedSongId: 'song-2' });
    await tick();
    await run;
    expect(useCreateDraftStore.getState().audio.yueScore).toBeNull();
  });

  it('reports a failed submit or job, and a new source clears a transcribed score', async () => {
    transcribe.mockRejectedValueOnce(new Error('covers are not set up on YUE2'));
    await useTranscribeStore.getState().start('yue2', src, 'x', '');
    expect(useTranscribeStore.getState()).toMatchObject({ stage: 'failed', error: 'covers are not set up on YUE2' });

    jobStatus.mockResolvedValue({ status: 'failed', error: 'SheetSage2 built no score' });
    const run = useTranscribeStore.getState().start('yue2', src, 'x', '');
    await tick();
    await run;
    expect(useTranscribeStore.getState().error).toBe('SheetSage2 built no score');

    useCreateDraftStore.getState().patchAudio({ yueScore: { abc: SCORE, source: 's', transcription: T, previewJobId: 'j' } });
    useCreateDraftStore.getState().patchAudio({ selectedSongId: 'song-3' });
    expect(useCreateDraftStore.getState().audio.yueScore).toBeNull();
    useCreateDraftStore.getState().patchAudio({ yueScore: { abc: SCORE, source: 'fixed.abc', transcription: null, previewJobId: null } });
    useCreateDraftStore.getState().patchAudio({ selectedSongId: 'song-4' });
    expect(useCreateDraftStore.getState().audio.yueScore?.source).toBe('fixed.abc'); // a file's score isn't tied to the source
  });
});
