import { describe, it, expect } from 'vitest';
import { sourceLockedBy, withSourceChange, type CoverScore } from './coverDraft';
import type { Source } from './createDraft';

const transcribed: CoverScore = {
  abc: 'X:1\n', source: 'take.wav', previewJobId: 'j1',
  transcription: { score: 'X:1\n', sourceLabel: 'take.wav' } as CoverScore['transcription'],
};
const fromFile: CoverScore = { abc: 'X:1\n', source: 'fixed.abc', transcription: null, previewJobId: null };
const wav = (name = 'take.wav', lastModified = 1) => new File(['abc'], name, { lastModified });
const upload = (yueScore: CoverScore | null) =>
  ({ source: 'upload' as Source, selectedSongId: null as string | null, uploadFile: wav() as File | null, yueScore });

describe('withSourceChange', () => {
  it('keeps a transcribed score when the same file is picked again', () => {
    const a = upload(transcribed);
    const again = wav();
    expect(again).not.toBe(a.uploadFile);
    const next = withSourceChange(a, { uploadFile: again });
    expect(next.yueScore).toBe(transcribed);
    expect(next.uploadFile).toBe(again);
  });

  it('drops a transcribed score for another file, another song or the other tab', () => {
    expect(withSourceChange(upload(transcribed), { uploadFile: wav('other.wav') }).yueScore).toBeNull();
    expect(withSourceChange(upload(transcribed), { uploadFile: wav('take.wav', 2) }).yueScore).toBeNull();
    expect(withSourceChange(upload(transcribed), { source: 'library' }).yueScore).toBeNull();
    const lib = { source: 'library' as Source, selectedSongId: 's1' as string | null, uploadFile: null, yueScore: transcribed };
    expect(withSourceChange(lib, { selectedSongId: 's2' }).yueScore).toBeNull();
    expect(withSourceChange(lib, { selectedSongId: 's1' }).yueScore).toBe(transcribed);
  });

  it('keeps a score from a file or a reused cover, and a score patched in with the change', () => {
    expect(withSourceChange(upload(fromFile), { uploadFile: wav('other.wav') }).yueScore).toBe(fromFile);
    expect(withSourceChange(upload(transcribed), { uploadFile: wav('other.wav'), yueScore: fromFile }).yueScore).toBe(fromFile);
  });
});

describe('sourceLockedBy', () => {
  const idle = { transcribing: false, reading: false, analyzing: false, generating: false };

  it('is null with nothing reading the source', () => {
    expect(sourceLockedBy(idle)).toBeNull();
  });

  it('names the job holding the source', () => {
    expect(sourceLockedBy({ ...idle, transcribing: true, reading: true })).toBe('TRANSCRIBE');
    expect(sourceLockedBy({ ...idle, reading: true, analyzing: true })).toBe('READ LYRICS');
    expect(sourceLockedBy({ ...idle, analyzing: true, generating: true })).toBe('ANALYZE AUDIO');
    expect(sourceLockedBy({ ...idle, generating: true })).toBe('a generation');
  });
});
