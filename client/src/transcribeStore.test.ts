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
  durationSeconds: 6, hasPreview: true, sectionStarts: [{ label: 'intro', bar: 0, seconds: 0 }, { label: 'verse', bar: 1, seconds: 3.2 }],
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

  it("fits lyrics ANALYZE AUDIO wrote to the score's sections, unless they were edited since", async () => {
    const described = '[Verse 1]\nNeon in the rain';
    useCreateDraftStore.getState().patch({ lyrics: described });
    useTranscribeStore.setState({ analyzedLyrics: described });
    jobStatus.mockResolvedValue({ status: 'done', transcription: T });
    let run = useTranscribeStore.getState().start('yue2', src, 'x', 'seed');
    await tick();
    await run;
    expect(useCreateDraftStore.getState().lyrics).toBe('[Intro]\n\n[Verse]\nNeon in the rain');
    expect(useTranscribeStore.getState().analyzedLyrics).toBeNull();

    useCreateDraftStore.getState().patch({ lyrics: 'edited words' });
    useTranscribeStore.setState({ analyzedLyrics: described });
    run = useTranscribeStore.getState().start('yue2', src, 'x', 'seed');
    await tick();
    await run;
    expect(useCreateDraftStore.getState().lyrics).toBe('edited words');
  });

  it('drops the result when the source was changed meanwhile', async () => {
    jobStatus.mockResolvedValue({ status: 'done', transcription: T });
    const run = useTranscribeStore.getState().start('yue2', src, 'x', '');
    useCreateDraftStore.getState().patchAudio({ selectedSongId: 'song-2' });
    await tick();
    expect(await run).toBe(false);
    expect(useCreateDraftStore.getState().audio.yueScore).toBeNull();
  });

  describe('says whether LYRICS hold none of the user words once the score lands', () => {
    async function land(seed: string): Promise<boolean> {
      jobStatus.mockResolvedValue({ status: 'done', transcription: T });
      const run = useTranscribeStore.getState().start('yue2', src, 'x', seed);
      await tick();
      return run;
    }

    it('open over empty LYRICS that get only the outline', async () => {
      expect(await land('')).toBe(true);
      expect(useCreateDraftStore.getState().lyrics).toBe('[Intro]\n\n[Verse]');
    });

    it('open over words ANALYZE AUDIO wrote and nobody touched', async () => {
      const described = 'Neon in the rain';
      useCreateDraftStore.getState().patch({ lyrics: described });
      useTranscribeStore.setState({ analyzedLyrics: described });
      expect(await land('')).toBe(true);
    });

    it('open over typed tags with no words', async () => {
      useCreateDraftStore.getState().patch({ lyrics: '[Verse]\n\n[Chorus]' });
      expect(await land('')).toBe(true);
    });

    it('closed over typed words, or a library song seeded with its own', async () => {
      useCreateDraftStore.getState().patch({ lyrics: 'my words' });
      expect(await land('')).toBe(false);
      useCreateDraftStore.getState().patch({ lyrics: '' });
      expect(await land('Midnight city')).toBe(false);
    });

    it('closed when the job fails', async () => {
      jobStatus.mockResolvedValue({ status: 'failed', error: 'no score' });
      const run = useTranscribeStore.getState().start('yue2', src, 'x', '');
      await tick();
      expect(await run).toBe(false);
    });
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
