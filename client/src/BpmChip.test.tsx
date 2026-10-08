/** BPM… as its own input (D-211; design/retime.html A′1-A′5). The behaviour is bpmField's (retimeRules.test.ts). */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { BpmChip } from './BpmChip';

const draw = (state: Parameters<typeof BpmChip>[0]['state']) => renderToStaticMarkup(<BpmChip state={state} dispatch={vi.fn()} />);

describe('BpmChip', () => {
  it('is a choice chip until clicked, and names a locked BPM in sky', () => {
    expect(draw({ kind: 'chip' })).toMatch(/class="tab dock-chip".*BPM…/);
    expect(draw({ kind: 'locked', bpm: 92 })).toMatch(/class="tab dock-chip active".*92 BPM/);
  });

  it('open: a focused field in its place with only an enter icon, no text (owner)', () => {
    const out = draw({ kind: 'open', text: '92', why: null });
    expect(out).toContain('value="92"');
    expect(out).toMatch(/autofocus/i);
    expect(out).toMatch(/class="bpm-enter"[^>]*>↵<\/button>/);
    expect(out).not.toMatch(/ENTER</);
  });

  it('turns rust when Enter was refused', () => {
    expect(draw({ kind: 'open', text: '300', why: '300 BPM IS OUTSIDE 40–240' })).toContain('class="bpm-field bad"');
  });
});
