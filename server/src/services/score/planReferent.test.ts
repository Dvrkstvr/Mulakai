import { describe, it, expect } from 'vitest';
import { parseReferent, referentLines, resolveReferent, staleMessage } from './planReferent.js';
import type { ScoreFacts, StaleReferent } from './planTypes.js';

const sections = (...spec: Array<[string, number, number]>) => spec.map(([label, from_bar, to_bar], i) => ({ index: i + 1, label, from_bar, to_bar }));
const facts = (s = sections(['intro', 1, 4], ['verse', 5, 12], ['chorus', 13, 20], ['verse', 21, 28], ['chorus', 29, 36], ['outro', 37, 40])): ScoreFacts => ({
  header: { meter: '4/4', unit: '1/32', bpm: 87, key: 'Dm', bars: 40, seconds: 110, units_per_quarter: 8 },
  key_notes: 'D E F G A Bb C',
  sections: s,
  lyric_blocks: [
    { index: 1, tag: '[Verse 1]', occurrence: 1, lines: 4, first_line: 'walking out' },
    { index: 2, tag: '[Chorus]', occurrence: 1, lines: 4, first_line: 'hold the light' },
    { index: 3, tag: '[Verse 2]', occurrence: 2, lines: 4, first_line: 'paper boats' },
    { index: 4, tag: '[Chorus]', occurrence: 2, lines: 4, first_line: 'hold the light' },
    { index: 5, tag: '[Bridge]', occurrence: 1, lines: 2, first_line: 'no bridge in the score' },
  ],
  bar_map: [],
});
// After a render that repeated CHORUS 1 (mockup frame 4): CHORUS 2 moved from bars 29-36 to 37-44.
const repeated = facts(sections(['intro', 1, 4], ['verse', 5, 12], ['chorus', 13, 20], ['chorus', 21, 28], ['verse', 29, 36], ['chorus', 37, 44], ['outro', 45, 48]));
// After a render that cut CHORUS 1: CHORUS 2 is now the only chorus, bars 21-28.
const cutFirst = facts(sections(['intro', 1, 4], ['verse', 5, 12], ['verse', 13, 20], ['chorus', 21, 28], ['outro', 29, 32]));
const CHORUS_2 = { kind: 'section', section: 5, label: 'chorus', occurrence: 2, of: 2, bars: [29, 36] } as const;
const staleOf = (r: ReturnType<typeof resolveReferent>): StaleReferent => { if (r.ok) throw new Error('not stale'); return r.stale; };

describe('parseReferent', () => {
  it('reads no pick as the whole song (F-032 #2)', () => {
    expect(parseReferent(undefined)).toEqual({ ok: true, referent: null });
    expect(parseReferent(null)).toEqual({ ok: true, referent: null });
  });

  it('keeps only the fields of a section or a line pick', () => {
    expect(parseReferent({ ...CHORUS_2, extra: 1 })).toEqual({ ok: true, referent: CHORUS_2 });
    expect(parseReferent({ kind: 'line', block: 4, tag: '[Chorus]', occurrence: 2, line: 3, text: '  hold   on  ' }))
      .toEqual({ ok: true, referent: { kind: 'line', block: 4, tag: '[Chorus]', occurrence: 2, line: 3, text: 'hold on' } });
  });

  it('refuses a malformed pick with a reason', () => {
    for (const bad of [{ kind: 'bar', bar: 3 }, { ...CHORUS_2, bars: [36, 29] }, { ...CHORUS_2, occurrence: 0 }, { ...CHORUS_2, of: 1 },
      { kind: 'line', block: 4, tag: '[Chorus]', occurrence: 2, line: 0 }, 'chorus', [CHORUS_2]]) {
      expect(parseReferent(bad)).toMatchObject({ ok: false, error: expect.any(String) });
    }
  });
});

describe('resolveReferent', () => {
  it('pins a section that still matches the read (F-032 #1)', () => {
    expect(resolveReferent(CHORUS_2, facts())).toEqual({ ok: true, referent: CHORUS_2 });
  });

  it('calls a moved section stale and names where it is now, counting from the end (Q-043, frame 4)', () => {
    const stale = staleOf(resolveReferent(CHORUS_2, repeated));
    expect(stale).toEqual({ picked: CHORUS_2, reason: 'chorus #2 was bars 29-36 and is now bars 37-44',
      now: { kind: 'section', section: 6, label: 'chorus', occurrence: 3, of: 3, bars: [37, 44] } });
    expect(staleMessage(stale)).toBe('the selection is stale: chorus #2 was bars 29-36 and is now bars 37-44');
    expect(staleOf(resolveReferent(CHORUS_2, cutFirst)).now).toMatchObject({ section: 4, occurrence: 1, of: 1, bars: [21, 28] });
  });

  it('without `of`, finds the same label + occurrence from the start', () => {
    const { of: _of, ...noCount } = CHORUS_2;
    expect(staleOf(resolveReferent(noCount, repeated)).now).toMatchObject({ section: 4, bars: [21, 28] });
  });

  it('calls a section the score no longer has stale with nowhere to go (missing section)', () => {
    const noChorus = facts(sections(['intro', 1, 4], ['verse', 5, 12], ['outro', 13, 16]));
    expect(resolveReferent(CHORUS_2, noChorus)).toEqual({ ok: false, stale: {
      picked: CHORUS_2, now: null, reason: 'chorus #2 (bars 29-36) is no longer in the score',
    } });
  });

  it('pins a lyric line to its block and the section that sings it (Q-045)', () => {
    const line = { kind: 'line', block: 4, tag: '[Chorus]', occurrence: 2, line: 3, text: 'carry me home' } as const;
    expect(resolveReferent(line, facts())).toEqual({ ok: true, referent: { ...line, of: 2, section: 5, label: 'chorus', bars: [29, 36] } });
    const verse = { kind: 'line', block: 3, tag: '[Verse 2]', occurrence: 2, line: 1 } as const;
    expect(resolveReferent(verse, facts())).toMatchObject({ ok: true, referent: { section: 4, label: 'verse', bars: [21, 28], text: null } });
  });

  it('pins a line whose block no section sings without bars', () => {
    const bridge = { kind: 'line', block: 5, tag: '[Bridge]', occurrence: 1, line: 2 } as const;
    expect(resolveReferent(bridge, facts())).toMatchObject({ ok: true, referent: { block: 5, section: null, label: null, bars: null } });
  });

  it('calls a line stale when its block moved, naming the block where the tag + occurrence now is', () => {
    const line = { kind: 'line', block: 2, tag: '[Chorus]', occurrence: 2, line: 1 } as const;
    expect(staleOf(resolveReferent(line, facts()))).toMatchObject({
      reason: '[Chorus] #2 was lyric block 2 and is now block 4', now: { block: 4, line: 1, bars: [29, 36] },
    });
    expect(staleOf(resolveReferent({ ...line, block: 4, line: 9 }, facts()))).toMatchObject({ now: null, reason: '[Chorus] #2 has 4 lines now, not line 9' });
  });
});

describe('referentLines', () => {
  it('says nothing for the whole song (F-032 #2)', () => {
    expect(referentLines(null)).toEqual([]);
  });

  it('tells the planner what "this" means, with the bars (F-032 #1)', () => {
    expect(referentLines({ ...CHORUS_2 })).toEqual([
      'THIS: chorus S5 (chorus #2), bars 29-36. "this", "here" and "it" in the REQUEST mean these bars.',
    ]);
  });

  it('names a picked line, its block and its bars', () => {
    const r = resolveReferent({ kind: 'line', block: 4, tag: '[Chorus]', occurrence: 2, line: 3, text: 'carry me "home"' }, facts());
    expect(r.ok && referentLines(r.referent)).toEqual([
      'THIS: line 3 of lyric block 4 ([Chorus] #2): "carry me \\"home\\"", sung in chorus S5, bars 29-36. '
        + '"this", "here" and "it" in the REQUEST mean this line\'s block and those bars.',
    ]);
    const bridge = resolveReferent({ kind: 'line', block: 5, tag: '[Bridge]', occurrence: 1, line: 1 }, facts());
    expect(bridge.ok && referentLines(bridge.referent)).toEqual([
      'THIS: line 1 of lyric block 5 ([Bridge] #1), sung in no section of the score. "this", "here" and "it" in the REQUEST mean this line\'s block.',
    ]);
  });
});
