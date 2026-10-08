import { describe, it, expect } from 'vitest';
import { aceCoverLocks, engineLockedBy, readingAbc, retimeRowKey, sourceLockedBy, withRetime, withSourceChange, withoutRetime, type CoverScore } from './coverDraft';
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

describe('engineLockedBy', () => {
  const idle = { transcribing: false, reading: false, analyzing: false };

  it('is null with nothing reading the source for this engine', () => {
    expect(engineLockedBy(idle)).toBeNull();
  });

  it("names the job whose result lands in this engine's draft, as the source lock does", () => {
    expect(engineLockedBy({ ...idle, transcribing: true, reading: true })).toBe('TRANSCRIBE');
    expect(engineLockedBy({ ...idle, reading: true, analyzing: true })).toBe('READ LYRICS');
    expect(engineLockedBy({ ...idle, analyzing: true })).toBe('ANALYZE AUDIO');
  });
});

describe('aceCoverLocks', () => {
  it('locks nothing while ACE-STEP COVER is idle', () => {
    expect(aceCoverLocks({ analyzing: false, generating: false })).toEqual({ source: null, engine: null });
  });

  it('holds source and engine still while ANALYZE AUDIO runs', () => {
    expect(aceCoverLocks({ analyzing: true, generating: false })).toEqual({ source: 'ANALYZE AUDIO', engine: 'ANALYZE AUDIO' });
  });

  it('holds only the source while a generation runs', () => {
    expect(aceCoverLocks({ analyzing: false, generating: true })).toEqual({ source: 'a generation', engine: null });
  });
});

describe('withRetime / withoutRetime (RE-TIME, F-091)', () => {
  const READ = 'X:1\nQ:1/4=140\nK:C\n% intro\nV: Vocal\nC8|\n% verse\nV: Vocal\nD8|\n';
  const HALF = 'X:1\nQ:1/4=70\nK:C\n% intro\nV: Vocal\nC16|\n% verse\nV: Vocal\nD16|\n';
  const result = (abc: string, over = {}) => ({
    abc, measures: 48, bpm: 70, readBpm: 140, vocalNotes: 1, insNotes: 0, notes: 183, droppedNotes: 16, warnings: [], ...over,
  });
  const score: CoverScore = { ...transcribed, abc: READ, dropped: [1], notationId: 'n1' };

  it('keeps the reading for UNDO and the section picks when the sections carried over', () => {
    const re = withRetime(score, result(HALF), 96);
    expect(re).toMatchObject({ abc: HALF, dropped: [1], notationId: 'n1' });
    expect(re.retime).toEqual({ original: READ, originalDropped: [1], bpm: 70, fromBars: 96, toBars: 48, droppedNotes: 16, notes: 183 });
    expect(readingAbc(re)).toBe(READ);
    expect(withoutRetime(re)).toEqual(score);
  });

  it('a second re-time starts from the reading, never from the first re-time', () => {
    const twice = withRetime(withRetime(score, result(HALF), 96), result(HALF.replace('70', '92'), { bpm: 92 }), 96);
    expect(twice.retime?.original).toBe(READ);
    expect(withoutRetime(twice)).toEqual(score);
  });

  it('drops the section picks when the rebuilt score has other sections', () => {
    expect(withRetime(score, result('X:1\nQ:1/4=70\nK:C\n% intro\nV: Vocal\nC16|\n'), 96).dropped).toBeUndefined();
    expect(withoutRetime(fromFile)).toBe(fromFile);
  });
});

describe('retimeRowKey (F-091 verify: a pick never outlives its score)', () => {
  const READ = 'X:1\nQ:1/4=140\nK:C\n% verse\nV: Vocal\nC8|\n';
  const s: CoverScore = { ...transcribed, abc: READ, notationId: 'n1' };
  const half = { abc: READ.replace('140', '70'), measures: 1, bpm: 70, readBpm: 140, vocalNotes: 1, insNotes: 0, notes: 1, droppedNotes: 0, warnings: [] };

  it('changes when the re-time is applied or undone, the reading changes, or the bundle changes', () => {
    const re = withRetime(s, half, 2);
    expect(retimeRowKey(re)).not.toBe(retimeRowKey(s));
    expect(retimeRowKey(withoutRetime(re))).toBe(retimeRowKey(s));
    expect(retimeRowKey({ ...s, abc: READ.replace('C8', 'D8') })).not.toBe(retimeRowKey(s));
    expect(retimeRowKey({ ...s, notationId: 'n2' })).not.toBe(retimeRowKey(s));
  });

  it('stays put while a section is left out', () => {
    expect(retimeRowKey({ ...s, dropped: [0] })).toBe(retimeRowKey(s));
  });
});
