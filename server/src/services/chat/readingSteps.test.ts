import { describe, it, expect, vi } from 'vitest';
import { runStep, stepText, type StepDeps, type StepInput } from './readingSteps.js';
import type { OwnSnapshot } from './referenceStore.js';
import type { PlanStep } from './readingPlan.js';

const FACTS = {
  header: { meter: '4/4', unit: '1/32', bpm: 96, key: 'Am', bars: 3, seconds: 8, units_per_quarter: 8 },
  key_notes: '', sections: [{ index: 0, label: 'verse', from_bar: 0, to_bar: 2 }], lyric_blocks: [], bar_map: [],
};
const MEASURE = { budget: 6000, header: 40, sections: [{ name: 'verse', tokens: 300 }] };
const OUTCOME = {
  warnings: ['short clip'], measures: 3, vocalNotes: 6, instrumentalNotes: 5, durationSeconds: 8.2, hasPreview: false,
  sectionStarts: null, score: 'X:1\nK:C\n% verse\n"Am"C8|\n', sourceLabel: 'song.mp3',
};

function deps(over: Partial<StepDeps> = {}): StepDeps {
  return {
    lyrics: vi.fn(async () => ({ language: 'en', segments: [{ text: ' Hello there ', start: 0, end: 1, words: [] }, { text: 'again', start: 1, end: 2, words: [] }] })),
    transcribe: vi.fn(async (_a, _f, onProgress) => { onProgress(0.41); return OUTCOME; }),
    readScore: vi.fn(async () => ({ ok: true, error: null, messages: [], chordsPresent: true, bpm: 96, seconds: 8, tokens: 340, facts: FACTS })),
    measure: vi.fn(async () => MEASURE),
    analyze: vi.fn(async () => ({ caption: 'indie pop, female vocal', lyrics: '', bpm: 96, key_scale: 'A minor', time_signature: '4' })),
    ...over,
  };
}
const own: OwnSnapshot = { own_v: 1, abc: 'X:1\nK:D\n', lyrics: '[Verse]\nfirst line\n\nsecond line\n[Chorus]', caption: 'rock', bpm: 140, key: 'D major', meter: '4/4', engine: 'yue2', layers: 1 };

function input(step: PlanStep, notes: string[] = [], part = 'X'): StepInput {
  return { audio: Buffer.from('a'), filename: 'song.mp3', own, step, signal: new AbortController().signal,
    progress: (n) => notes.push(n ? `${part} · ${n}` : part) };
}

describe('stepText (the client reads the step from the progress text)', () => {
  it('starts with WORDS, SCORE or CAPTION, then " · <note>"', () => {
    expect(stepText('words')).toBe('WORDS');
    expect(stepText('score', 'transcribing 41%')).toBe('SCORE · transcribing 41%');
    expect(stepText('caption', 'ACE-Step')).toBe('CAPTION · ACE-Step');
  });
});

describe('WORDS', () => {
  it('reads the sung lines from lyrics-server', async () => {
    expect(await runStep('words', input({ source: 'service' }), deps())).toEqual({ language: 'en', lines: ['Hello there', 'again'], instrumental: false });
  });
  it('an instrumental has no words, and says so', async () => {
    const d = deps({ lyrics: vi.fn(async () => ({ language: '', segments: [] })) });
    expect(await runStep('words', input({ source: 'service' }), d)).toEqual({ language: null, lines: [], instrumental: true });
  });
  it("a library song's own words drop section tags and blank lines", async () => {
    const part = await runStep('words', input({ source: 'own' }), deps());
    expect(part).toMatchObject({ lines: ['first line', 'second line'], instrumental: false });
  });
  it('a failing or unset service is not read with the reason, never empty', async () => {
    const d = deps({ lyrics: vi.fn(async () => { throw new Error('lyrics-server transcribe -> HTTP 500'); }) });
    expect(await runStep('words', input({ source: 'service' }), d)).toEqual({ notRead: 'lyrics-server transcribe -> HTTP 500' });
    expect(await runStep('words', input({ source: 'skip', why: 'LYRICS_API_URL is not set' }), d)).toEqual({ notRead: 'LYRICS_API_URL is not set' });
  });
});

describe('SCORE', () => {
  it('transcribes with chords, then reads and measures the score; progress names the step', async () => {
    const notes: string[] = [];
    const d = deps();
    const part = await runStep('score', input({ source: 'service' }, notes, 'SCORE'), d);
    expect(part).toEqual({ abc: OUTCOME.score, source: 'transcribed', chords: true, facts: FACTS, warnings: ['short clip'], measure: MEASURE });
    expect(d.readScore).toHaveBeenCalledWith(OUTCOME.score, null);
    expect(notes).toContain('SCORE · transcribing 41%');
    expect(notes.every((n) => n.startsWith('SCORE'))).toBe(true);
  });
  it('a transcribed score keeps its notation id for a re-time (F-092); an own score has none', async () => {
    const kept = deps({ transcribe: vi.fn(async () => ({ ...OUTCOME, notationId: 'n-1' })) });
    expect(await runStep('score', input({ source: 'service' }), kept)).toMatchObject({ notationId: 'n-1' });
    const gone = deps({ transcribe: vi.fn(async () => ({ ...OUTCOME, notationId: null })) });
    expect(await runStep('score', input({ source: 'service' }), gone)).toMatchObject({ notationId: null });
    expect(await runStep('score', input({ source: 'own' }), deps())).not.toHaveProperty('notationId');
  });
  it('reads a library song\'s own score with its words, no transcription', async () => {
    const d = deps();
    const part = await runStep('score', input({ source: 'own' }), d);
    expect(part).toMatchObject({ abc: own.abc, source: 'own' });
    expect(d.transcribe).not.toHaveBeenCalled();
    expect(d.readScore).toHaveBeenCalledWith(own.abc, own.lyrics);
  });
  it('a score that does not parse keeps the ABC, with no facts and the reason as a warning', async () => {
    const d = deps({ readScore: vi.fn(async () => ({ ok: false, error: 'bad bar', messages: ['bar 3 too long'], chordsPresent: null, bpm: null, seconds: null, tokens: null, facts: null })) });
    expect(await runStep('score', input({ source: 'service' }), d)).toMatchObject({ facts: null, chords: null, warnings: ['short clip', 'bad bar', 'bar 3 too long'] });
  });
  it('a read or measure that fails is a warning, not a lost score', async () => {
    const d = deps({ readScore: vi.fn(async () => { throw new Error('down'); }), measure: vi.fn(async () => { throw new Error('gone'); }) });
    expect(await runStep('score', input({ source: 'service' }), d)).toMatchObject({
      facts: null, measure: null, warnings: ['short clip', 'the score was not checked: down', 'the score was not measured: gone'] });
  });
  it('a failed transcription is not read with its reason; an aborted one says cancelled', async () => {
    const failing = deps({ transcribe: vi.fn(async () => { throw new Error('SheetSage2 built no score: no beats decoded'); }) });
    expect(await runStep('score', input({ source: 'service' }), failing)).toEqual({ notRead: 'SheetSage2 built no score: no beats decoded' });
    const aborted = deps({ transcribe: vi.fn(async () => undefined) });
    expect(await runStep('score', input({ source: 'service' }), aborted)).toEqual({ notRead: 'cancelled' });
  });
});

describe('CAPTION', () => {
  it('reads caption, tempo, key and meter from ACE-Step', async () => {
    expect(await runStep('caption', input({ source: 'service' }), deps())).toEqual({ caption: 'indie pop, female vocal', bpm: 96, key: 'A minor', meter: '4' });
  });
  it("uses a library song's own caption without ACE-Step", async () => {
    const d = deps();
    expect(await runStep('caption', input({ source: 'own' }), d)).toEqual({ caption: 'rock', bpm: 140, key: 'D major', meter: '4/4' });
    expect(d.analyze).not.toHaveBeenCalled();
  });
  it('ACE-Step down or saying nothing is not read', async () => {
    expect(await runStep('caption', input({ source: 'skip', why: 'ACE-Step is not running' }), deps())).toEqual({ notRead: 'ACE-Step is not running' });
    const empty = deps({ analyze: vi.fn(async () => ({ caption: ' ', lyrics: '' })) });
    expect(await runStep('caption', input({ source: 'service' }), empty)).toEqual({ notRead: 'ACE-Step described nothing' });
  });
});
