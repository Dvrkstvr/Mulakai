/** The stale selection (F-032 edge, M2-4, frame 4): a rejected row, the rust line, USE BARS and WHOLE SCORE. */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ScoreReferent } from './api';
import { ScoreStaleSelection } from './ScoreStaleSelection';

const CHORUS2: ScoreReferent = { kind: 'section', section: 5, label: 'chorus', occurrence: 2, of: 3, bars: [29, 36] };
const text = (html: string) => html.replace(/<[^>]+>/g, '|').replace(/\|+/g, '|');

describe('ScoreStaleSelection', () => {
  it('draws the rejected row and offers USE BARS where it is now', () => {
    const stale = { picked: CHORUS2, now: { ...CHORUS2, section: 6, bars: [37, 44] as [number, number] }, reason: 'chorus #2 was bars 29-36 and is now bars 37-44' };
    const html = renderToStaticMarkup(<ScoreStaleSelection stale={stale} onUse={vi.fn()} onWhole={vi.fn()} />);
    expect(text(html)).toContain('|✕|THIS|CHORUS 2 · not planned: the selection is stale|');
    expect(text(html)).toContain('|STALE SELECTION| · you picked CHORUS 2, bars 29–36 · chorus #2 was bars 29-36 and is now bars 37-44 · Nothing was applied.|USE BARS 37–44|WHOLE SCORE|');
    expect(html).toContain('class="score-op no"');
  });
  it('a pick that is gone offers only WHOLE SCORE', () => {
    const html = renderToStaticMarkup(<ScoreStaleSelection stale={{ picked: CHORUS2, now: null, reason: 'gone' }} onUse={vi.fn()} onWhole={vi.fn()} />);
    expect(html).not.toContain('USE');
    expect(text(html)).toContain('|WHOLE SCORE|');
  });
});
