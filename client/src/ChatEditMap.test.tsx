/** The bar map in the edit card (F-060, chat-converge.html 4a-4d): bands, edited cells, the hovered row lit, a whole-song
 * op hatched, a CUT band hatched grey; at the card's 730 px before it is measured. */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { BarMap } from './api/chatConverge';
import { ChatBarMap } from './ChatEditMap';

const S200 = Array.from({ length: 13 }, (_, i) => ({ label: i ? 'part' : 'intro', occurrence: i || 1, from: i * 16 + 1, to: Math.min(200, i * 16 + 16) }))
  .concat([{ label: 'outro', occurrence: 1, from: 209 - 8, to: 200 }]);
const map = (ops: BarMap['ops'], bars = 200, sections = S200): BarMap => ({ bars, sections, ops });
const html = (m: BarMap, hover: number | null = null, cuts: Array<[number, number]> = []) =>
  renderToStaticMarkup(<ChatBarMap map={m} hover={hover} cuts={cuts} caption="CAPTION" />);

describe('ChatBarMap', () => {
  it('200 bars: one row of bands, cells at 3.65 px a bar, ruler ticks, the caption', () => {
    const out = html(map([{ spans: [[97, 100]], whole: false }, { spans: [[141, 156]], whole: false }]));
    expect(out).toContain('data-bars="200"');
    expect(out).toContain('class="e" style="left:350.4px;width:14.6px"'); // bars 97-100 at 730/200 = 3.65 px
    expect(out).toContain('class="e" style="left:511px;width:58.4px"');
    expect(out).toMatch(/<em style="left:0px">1<\/em>/);
    expect(out).toContain('CAPTION');
    expect(out).not.toContain('lit');
  });

  it('a hovered row lights only its bars, solid sky', () => {
    const out = html(map([{ spans: [[97, 100]], whole: false }, { spans: [[141, 156]], whole: false }]), 1);
    expect(out).toContain('class="e lit" data-bars="141-156"');
    expect(out).not.toContain('data-bars="97-100"');
  });

  it('a whole-song op hatches the track; hovered, the hatch lights', () => {
    const ops = [{ spans: [[49, 56]] as Array<[number, number]>, whole: false }, { spans: [], whole: true }];
    expect(html(map(ops, 80, []))).toContain('<b class="wh"></b>');
    expect(html(map(ops, 80, []), 1)).toContain('<b class="wh lit"></b>');
  });

  it("a CUT section's band is hatched grey", () => {
    const sections = [{ label: 'verse', occurrence: 1, from: 1, to: 72 }, { label: 'outro', occurrence: 1, from: 73, to: 80 }];
    const out = html(map([{ spans: [[73, 80]], whole: false }], 80, sections), null, [[73, 80]]);
    expect(out).toMatch(/title="OUTRO · 73–80" class="cu"/);
    expect(out).toMatch(/title="VERSE · 1–72" style/);
  });
});
