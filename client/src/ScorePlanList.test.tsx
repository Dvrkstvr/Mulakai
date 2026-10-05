/** SCORE's change list renders a WRITE PHRASE row like the M0 rows: verdict, name, detail, tag (F-026). */
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ScorePlanList } from './ScorePlanList';
import type { ScoreOp, ScorePlan } from './api';

const BAR = [{ pitch: 'D', beats: 2 }, { pitch: 'F', beats: 2 }];
const PHRASE: ScoreOp = { op: 'WRITE_PHRASE', start_bar: 57, instrument: 'tenor saxophone', bars: [BAR, BAR, BAR, BAR] };
const plan = (ops: ScoreOp[], ok = true): ScorePlan => ({
  id: 'p', songId: 's', baseVersionId: 'v1', request: 'add a 4-bar sax phrase after the chorus', ops,
  verdicts: ops.map((o, i) => ({ index: i + 1, op: o.op, ok, reason: ok ? null : 'the Vocal sings in bars 11-12; free: 1-10, 47-65' })),
  style: ok ? 'dark pop, 88 bpm, tenor saxophone' : 'dark pop, 90 bpm', // a refused phrase appends nothing
  checks: { bars: 65, seconds: 177, tokens: 1825, chordsPresent: true, changed: { abc: true, style: true } }, attempts: 2, refusals: [['op 1 (WRITE_PHRASE): the Vocal sings in bars 20-23; free: 1-10, 47-65']], createdAt: 1,
});
const text = (html: string) => html.replace(/<[^>]+>/g, '|').replace(/\|+/g, '|');

describe('ScorePlanList: WRITE PHRASE row', () => {
  it('shows the phrase with its verdict tick and the request tag', () => {
    const html = renderToStaticMarkup(<ScorePlanList plan={plan([{ op: 'SET_TEMPO', bpm: 88 }, PHRASE])} baseStyle="dark pop, 90 bpm" fromBpm={90} baseVersion={1} />);
    expect(text(html)).toContain('|✓|WRITE PHRASE|tenor saxophone · bars 57–60 · 4 bars · style + tenor saxophone|a request|');
    expect(text(html)).toContain('PLAN · 2 CHANGES · AGAINST BASE v1');
  });

  it('says under the checks which earlier attempt was refused, and why (D-060)', () => {
    const html = renderToStaticMarkup(<ScorePlanList plan={plan([PHRASE])} baseStyle="dark pop" fromBpm={90} baseVersion={1} />);
    expect(text(html)).toContain('|attempt 2 of 3|attempt 1 refused: the Vocal sings in bars 20-23; free: 1-10, 47-65|');
    expect(html).toContain('class="score-refused"');
    const first = renderToStaticMarkup(<ScorePlanList plan={{ ...plan([PHRASE]), attempts: 1, refusals: [] }} baseStyle="dark pop" fromBpm={90} baseVersion={1} />);
    expect(first).not.toContain('refused');
    const dimmed = renderToStaticMarkup(<ScorePlanList plan={plan([PHRASE])} baseStyle="dark pop" fromBpm={90} baseVersion={1} dimmed="replacing" />);
    expect(dimmed).not.toContain('attempt 1 refused');
  });

  it('keeps a refused phrase in the list with its reason and no tag', () => {
    const html = renderToStaticMarkup(<ScorePlanList plan={plan([PHRASE], false)} baseStyle="dark pop" fromBpm={90} baseVersion={1} />);
    expect(html).toContain('class="score-op no"');
    expect(text(html)).toContain('|✕|WRITE PHRASE|tenor saxophone · bars 57–60 · 4 bars · rejected: the Vocal sings in bars 11-12; free: 1-10, 47-65|');
    expect(html).not.toContain('a request');
  });
});
