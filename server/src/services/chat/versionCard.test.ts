/** The version card's data (F-048 #1, F-047 #3 edge, D-101): pure. */
import { describe, it, expect } from 'vitest';
import { fallbackReason, versionCard, versionCardText, withPrevious } from './versionCard.js';

const spliced = {
  splice_v: 1 as const, kind: 'reharmonize' as const, bars: [25, 32] as [number, number], joins_s: [60, 80], crossfade_s: [0.3, 0.3],
  gain_db: null, snap_ms: [12, -4], length_diff_s: 0.04, null_test: { samples: 9, different: 0 },
};
const saved = { number: 2, seconds: 192.04, label: 'score edit · REHARMONIZE 25–32 · bars 25–32 spliced', truncated: false };
const v1 = { versionId: 'v1', number: 1 };

describe('versionCard', () => {
  it('a splice: the bars that changed, the length difference, the version before it for A/B', () => {
    const card = versionCard({ ...saved, splice: spliced }, v1);
    expect(card).toEqual({
      seconds: 192.04, label: saved.label, number: 2, truncated: false, whole: false,
      splice: { kind: 'reharmonize', bars: [25, 32], lengthDiffS: 0.04 }, fallback: null, previous: v1,
    });
    expect(versionCardText(card)).toBe('Saved as v2: bars 25-32 changed, the rest is v1\'s audio.');
  });

  it('a CUT and a REPEAT say what they did to the bars', () => {
    expect(versionCardText(versionCard({ ...saved, splice: { ...spliced, kind: 'cut', bars: [57, 64] } }, v1)))
      .toBe('Saved as v2: bars 57-64 removed, the rest is v1\'s audio. Bars after the cut are earlier.');
    expect(versionCardText(versionCard({ ...saved, splice: { ...spliced, kind: 'repeat', bars: [9, 16] } }, v1)))
      .toBe('Saved as v2: bars 9-16 repeated, the rest is v1\'s audio. Bars after the copy are later.');
  });

  it('a whole-song edit, as the card said', () => {
    const card = versionCard({ ...saved, label: 'score edit · REWRITE LYRICS [Verse] #2' }, v1);
    expect(card).toMatchObject({ whole: true, splice: null, fallback: null });
    expect(versionCardText(card)).toBe('Saved as v2: the whole song was re-rendered, every bar sounds different from v1.');
  });

  it('a fallback is said, never a silent splice (D-101, D-109); a truncated render says TRUNCATED (D-025)', () => {
    const card = versionCard({ ...saved, splice: { splice_v: 1, fallback: 'the join could not be aligned' } }, v1);
    expect(card).toMatchObject({ whole: true, splice: null, fallback: 'the join could not be aligned' });
    expect(versionCardText(card)).toBe('Saved as v2, as the whole re-render: the join could not be aligned. Every bar sounds different from v1, not only the ones you asked for.');
    const short = versionCard({ ...saved, truncated: true, splice: { splice_v: 1, fallback: 'the render stopped early' } }, v1);
    expect(versionCardText(short)).toBe('Saved as v2, TRUNCATED: the render stopped early, so the whole short render was saved. v1 is the full-length take.');
  });

  it('no version before it (or it was deleted): no A/B (F-048 edge)', () => {
    const card = versionCard({ ...saved, splice: spliced }, v1);
    expect(withPrevious(card, () => true).previous).toEqual(v1);
    expect(withPrevious(card, () => false).previous).toBeNull();
    expect(versionCard({ ...saved, splice: spliced }, null).previous).toBeNull();
    expect(versionCardText(versionCard({ ...saved, splice: spliced }, null))).toBe('Saved as v2: bars 25-32 changed, the rest is the old audio.');
  });
});

describe('versionCard for a chain (C4, F-069, D-266)', () => {
  const row = (kind: 'reharmonize' | 'cut' | 'repeat', bars: [number, number]) => ({ ...spliced, kind, bars });
  const chain = {
    splice_v: 2 as const, kind: 'several' as const, bars: [9, 48] as [number, number], joins_s: [16.2, 24.2, 80.2], length_diff_s: -16,
    null_test: { samples: 30, different: 0 }, steps: [row('reharmonize', [41, 48]), row('cut', [25, 32]), row('reharmonize', [9, 16])],
  };

  it('names every span in reading order, with what each did; the rest is the version before it', () => {
    const card = versionCard({ ...saved, splice: chain }, v1);
    expect(card).toMatchObject({ whole: false, fallback: null, splice: { kind: 'several', bars: [9, 48], lengthDiffS: -16,
      steps: [{ kind: 'reharmonize', bars: [9, 16] }, { kind: 'cut', bars: [25, 32] }, { kind: 'reharmonize', bars: [41, 48] }] } });
    expect(versionCardText(card)).toBe("Saved as v2: bars 9-16 changed, bars 25-32 removed, bars 41-48 changed, the rest is v1's audio. Bars after the cut are earlier.");
  });

  it('a cut and a copy both say their bars move', () => {
    const card = versionCard({ ...saved, splice: { ...chain, steps: [row('repeat', [17, 24]), row('cut', [1, 8])] } }, null);
    expect(versionCardText(card)).toBe('Saved as v2: bars 1-8 removed, bars 17-24 repeated, the rest is the old audio. Bars after the cut are earlier. Bars after the copy are later.');
  });

  it('an unknown splice_v reads as the label only: no splice details, no claim of a whole render', () => {
    const card = versionCard({ ...saved, splice: { splice_v: 3, kind: 'later' } as never }, v1);
    expect(card).toMatchObject({ whole: false, splice: null, fallback: null });
    expect(versionCardText(card)).toBe('Saved as v2.');
  });
});

describe('fallbackReason', () => {
  it('not aligned reads as the label D-101 names; other reasons are yue-server\'s own words', () => {
    expect(fallbackReason({ reason: 'not_aligned', detail: 'no usable groove at either join' })).toBe('the join could not be aligned');
    expect(fallbackReason({ reason: 'level_step', detail: 'the copy\'s seam steps +10.4 dB' })).toBe('the copy\'s seam steps +10.4 dB');
    expect(fallbackReason({ reason: 'no_grid', detail: null })).toBe('no_grid');
  });
});
