/** `shown.lyrics` in the analysis view (F-056, D-217): computed from the shown reading and that version's own
 * stored lyrics, the current take's or the older dim one's; an input without lyrics still gets a panel. */
import { describe, it, expect } from 'vitest';
import { contract } from '../../../test-fakes/fakeYue.js';
import { analysisView, type ViewInput } from './analysisView.js';
import type { VersionAnalysis } from './analysisTypes.js';
import type { ScoreFacts } from '../score/planTypes.js';

const read = contract('read-sections');
const lyrics = read.request.body.lyrics as string;
const facts = read.response.body.facts as ScoreFacts;
const starts = Array.from({ length: 65 }, (_, i) => i * 2);
const analysis = (versionId: string): VersionAnalysis => ({
  analysis_v: 1, versionId, readAt: '2026-10-08T10:00:00.000Z',
  plan: { words: 'skip', score: 'own', sections: 'cached' },
  words: { notRead: 'LYRICS_API_URL is not set' },
  score: { abc: 'X:1', source: 'own', chords: true, facts, warnings: [], measure: null },
  bars: { source: 'cached', offset: 0, starts, end: 130, agreement: 1 },
});
const base = (over: Partial<ViewInput> = {}): ViewInput => ({
  songId: 's1', playable: { id: 'v2', number: 2 }, current: null, currentWords: null,
  older: null, olderShift: { moved: false }, parent: null, job: null, ...over,
});

describe('analysisView · shown.lyrics', () => {
  it("the current take's panel from its own stored lyrics and style", () => {
    const v = analysisView(base({ current: analysis('v2'), currentText: { lyrics, style: 'dark pop' } }));
    expect(v.shown?.lyrics).toMatchObject({ source: 'blocks', text: lyrics, facts: { bpm: 87, key: 'Dm', style: 'dark pop' } });
    expect(v.shown?.lyrics?.sections.map((s) => [s.strip, s.block, s.lines.length])).toEqual([[1, 1, 1], [2, 2, 8], [3, 3, 4], [4, 7, 8]]);
  });

  it("an older dim reading's panel uses the older version's lyrics, not the current take's", () => {
    const v = analysisView(base({
      current: null, currentText: { lyrics: 'not these', style: null },
      older: { versionId: 'v1', number: 1, analysis: analysis('v1'), words: null, text: { lyrics, style: 'old style' } },
    }));
    expect(v.shown).toMatchObject({ versionId: 'v1', mode: 'dim', lyrics: { source: 'blocks', facts: { style: 'old style' } } });
  });

  it('no stored text given: the panel says the lyrics are not stored, the sections still listed', () => {
    const v = analysisView(base({ current: analysis('v2') }));
    expect(v.shown?.lyrics).toMatchObject({ source: 'none', note: expect.stringMatching(/not stored/), facts: { style: null } });
    expect(v.shown?.lyrics?.sections).toHaveLength(4);
  });
});
