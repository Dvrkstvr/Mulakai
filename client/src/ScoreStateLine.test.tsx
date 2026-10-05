/** CHECK FAILED with the cut hint (F-030 #2, mockup frame 11): FILL types the hint's words into the
 * request and nothing else (Q-048: no plan, no job). */
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ScoreStateLine } from './ScoreStateLine';
import { fillRequest } from './scoreCopy';
import { scoreVerb } from './scoreVerb';
import { INITIAL_SCORE, type ScorePhase } from './scoreVerbTypes';

const HINT = 'estimated 367 s: over the 360 s limit; cut the outro 0:11 to fit (section 4), or at least 68 BPM fits';
const failed = (reasons: string[]): ScorePhase => ({ kind: 'checkFailed', reasons });
const text = (html: string) => html.replace(/<[^>]+>/g, '|').replace(/\|+/g, '|');

/** The buttons in a rendered tree, found without a DOM. */
function buttons(node: ReactNode): ReactElement<{ onClick: () => void }>[] {
  if (Array.isArray(node)) return node.flatMap(buttons);
  if (!isValidElement<{ children?: ReactNode }>(node)) return [];
  const own = node.type === 'button' ? [node as ReactElement<{ onClick: () => void }>] : [];
  return [...own, ...buttons(node.props.children)];
}

const line = (phase: ScorePhase, onFill = vi.fn(), onPlanAgain = vi.fn()) =>
  ({ el: ScoreStateLine({ phase, onRecheck: vi.fn(), onPlanAgain, onRetryRender: vi.fn(), onFill }), onFill, onPlanAgain });

describe('ScoreStateLine: CHECK FAILED with the cut hint', () => {
  it('shows the hint as a title and a body, then FILL with the words it types', () => {
    const html = renderToStaticMarkup(line(failed([HINT])).el);
    expect(text(html)).toContain('|CHECK FAILED|OVER THE 360 s LIMIT BY 7 s| · est 367 s · cut the outro 0:11 to fit (section 4) · or at least 68 BPM fits|');
    expect(text(html)).toContain('|FILL “cut the outro”|');
    expect(html).toContain('class="score-error"');
  });

  it('FILL hands over the words and starts nothing', () => {
    const { el, onFill, onPlanAgain } = line(failed(['the Vocal sings in bars 11-12', HINT]));
    const [fill] = buttons(el);
    fill.props.onClick();
    expect(onFill).toHaveBeenCalledWith('cut the outro');
    expect(onPlanAgain).not.toHaveBeenCalled();
    // The dock dispatches it as an edit: the request changes, the phase does not.
    const state = { ...INITIAL_SCORE, phase: failed([HINT]), request: 'play the last chorus three times' };
    const next = scoreVerb(state, { type: 'edit', request: fillRequest(state.request, 'cut the outro') });
    expect(next.request).toBe('play the last chorus three times, cut the outro');
    expect(next.phase).toEqual(state.phase);
  });

  it('has no FILL when no section is named; other reasons stay plain lines', () => {
    const plain = 'estimated 458 s: over the 360 s limit; at least 112 BPM fits';
    const html = renderToStaticMarkup(line(failed([plain])).el);
    expect(html).not.toContain('FILL');
    expect(text(html)).toContain(`|${plain}|`);
    expect(buttons(line(failed([plain])).el)).toHaveLength(0);
  });
});
