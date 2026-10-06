/** The stored Reading (reading_v 1) read from raw blobs, its facts and the cover verdict (F-061, F-063/F-064, D-135). */
import { describe, it, expect } from 'vitest';
import { coverVerdict, readReading, readingFacts, type Reading } from './reading.js';

const FACTS = {
  header: { meter: '4/4', unit: '1/8', bpm: 96, key: 'Am', bars: 24, seconds: 60, units_per_quarter: 2 },
  key_notes: 'A B C D E F G',
  sections: [
    { index: 0, label: 'verse', from_bar: 1, to_bar: 8 },
    { index: 1, label: 'chorus', from_bar: 9, to_bar: 16 },
    { index: 2, label: 'verse', from_bar: 17, to_bar: 24 },
  ],
  lyric_blocks: [],
  bar_map: [],
};

function reading(over: Partial<Reading> = {}): Reading {
  return {
    reading_v: 1, readAt: '2026-10-07T10:00:00Z', seconds: 200, readTo: 200, cut: false,
    plan: { words: 'service', score: 'service', caption: 'service' },
    words: { language: 'de', lines: ['Hey du', 'was ist los'], instrumental: false },
    score: { abc: 'X:1\nK:Am\n', source: 'transcribed', chords: true, facts: FACTS, warnings: [], measure: { budget: 4096, header: 73, sections: [{ name: 'verse', tokens: 400 }, { name: 'chorus', tokens: 300 }] } },
    caption: { caption: 'driving synthwave, analog bass', bpm: 120, key: 'D minor', meter: '4/4' },
    ...over,
  };
}

describe('readReading (raw blob in, versions-data.md)', () => {
  it('a v1 blob round-trips', () => {
    const r = reading();
    expect(readReading(JSON.stringify(r))).toEqual({ reading: r, note: null });
  });

  it('nothing stored: not read yet, no note', () => {
    expect(readReading(null)).toEqual({ reading: null, note: null });
    expect(readReading('')).toEqual({ reading: null, note: null });
  });

  it('unreadable JSON or an unknown reading_v: null and "read again", never a crash', () => {
    expect(readReading('{nope')).toEqual({ reading: null, note: expect.stringContaining('read again') });
    expect(readReading(JSON.stringify({ ...reading(), reading_v: 2 }))).toEqual({ reading: null, note: expect.stringContaining('read again') });
    expect(readReading(JSON.stringify({ words: {} }))).toEqual({ reading: null, note: expect.stringContaining('read again') });
  });

  it('a malformed part reads as not read, the other parts stay', () => {
    const raw = { ...reading(), words: { lines: 'oops' }, caption: { notRead: 'ACE-Step is not running' } };
    const { reading: r } = readReading(JSON.stringify(raw));
    expect(r?.words).toEqual({ notRead: 'the stored words are not readable: read again' });
    expect(r?.caption).toEqual({ notRead: 'ACE-Step is not running' });
    expect(r?.score).toEqual(reading().score);
  });
});

describe('readingFacts (D-135: ACE-Step first, then the score header)', () => {
  it('tempo, key and meter from the caption, structure from the score, keys in draft spelling', () => {
    expect(readingFacts(reading())).toEqual({
      bpm: 120, key: 'Dm', meter: '4/4', structure: ['verse', 'chorus', 'verse'],
      instrumentation: 'driving synthwave, analog bass', instrumental: false,
      sources: { bpm: 'caption', key: 'caption', meter: 'caption', structure: 'score' }, missing: [],
    });
  });

  it('caption not read: everything from the score header', () => {
    const f = readingFacts(reading({ caption: { notRead: 'ACE-Step is not running' } }));
    expect(f).toMatchObject({ bpm: 96, key: 'Am', meter: '4/4', instrumentation: null, missing: [] });
    expect(f.sources).toEqual({ bpm: 'score', key: 'score', meter: 'score', structure: 'score' });
  });

  it("prefer 'score' (a cover sings the score's own) ignores the caption's tempo and key", () => {
    expect(readingFacts(reading(), 'score')).toMatchObject({ bpm: 96, key: 'Am', sources: { bpm: 'score', key: 'score' } });
  });

  it('nothing to read: every value missing, never guessed', () => {
    const f = readingFacts(reading({ score: { notRead: 'yue-server is not running' }, caption: { notRead: 'x' }, words: { notRead: 'y' } }));
    expect(f).toMatchObject({ bpm: null, key: null, meter: null, structure: [], instrumental: null });
    expect(f.missing).toEqual(['bpm', 'key', 'meter', 'structure']);
  });

  it('a key or meter outside the draft lists is missing, not passed on', () => {
    const f = readingFacts(reading({ caption: { caption: 'x', bpm: 300, key: 'D dorian', meter: '5/4' }, score: { notRead: 'x' } }));
    expect(f).toMatchObject({ bpm: null, key: null, meter: null });
    expect(f.missing).toEqual(['bpm', 'key', 'meter', 'structure']);
  });

  it('an instrumental says so', () => {
    expect(readingFacts(reading({ words: { language: null, lines: [], instrumental: true } })).instrumental).toBe(true);
  });
});

describe('coverVerdict (F-063)', () => {
  it('ok when the score was read and fits the planner budget', () => {
    expect(coverVerdict(reading())).toEqual({ ok: true });
  });

  it('ok with no measure (a backend that cannot say; GENERATE checks again)', () => {
    const r = reading();
    expect(coverVerdict({ ...r, score: { ...(r.score as object), measure: null } as Reading['score'] })).toEqual({ ok: true });
  });

  it('the score not read: not possible, with why', () => {
    expect(coverVerdict(reading({ score: { notRead: 'yue-server is not running' } }))).toEqual({ ok: false, reason: 'the score was not read: yue-server is not running' });
  });

  it('a score that does not parse: not possible', () => {
    const r = reading();
    expect(coverVerdict({ ...r, score: { ...(r.score as object), facts: null } as Reading['score'] })).toMatchObject({ ok: false, reason: expect.stringContaining('does not parse') });
  });

  it('over the budget: not possible, with the count', () => {
    const r = reading();
    const measure = { budget: 4096, header: 73, sections: [{ name: 'intro', tokens: 2000 }, { name: 'outro', tokens: 2100 }] };
    expect(coverVerdict({ ...r, score: { ...(r.score as object), measure } as Reading['score'] })).toEqual({ ok: false, reason: 'the score is 4,173 of 4,096 tokens, too long for YuE2 to cover' });
  });
});
