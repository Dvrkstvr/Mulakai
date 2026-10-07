/** The chips' confirm flow, clicked without a DOM: CreateBarChips swaps a chip for ChipConfirm while
 * it is asking, so each step is the right view's buttons and the callbacks they fire. */
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CONFIRM_COPY, type GenChip } from './createBarStatus';
import { ChipConfirm, DraftChip, GenerationChip } from './CreateBarChip';

type Btn = ReactElement<{ onClick: () => void; disabled?: boolean; children: ReactElement<{ children: string }> }>;

/** The buttons in a rendered tree, by label, found without a DOM. */
function buttons(node: ReactNode): Btn[] {
  if (Array.isArray(node)) return node.flatMap(buttons);
  if (!isValidElement<{ children?: ReactNode }>(node)) return [];
  const own = node.type === 'button' ? [node as Btn] : [];
  return [...own, ...buttons(node.props.children)];
}
const press = (el: ReactNode, label: string) => {
  const b = buttons(el).find((x) => x.props.children.props.children === label);
  if (!b) throw new Error(`no ${label} button`);
  b.props.onClick();
};
const labels = (el: ReactNode) => buttons(el).map((b) => b.props.children.props.children);

const chip = (over: Partial<GenChip>): GenChip =>
  ({ key: 'k', jobId: 'j', label: 'GENERATING', title: 'Neon Harbor', pct: '42%', veil: 0.42, ai: true, action: 'abort', ...over });

describe('draft chip', () => {
  it('DRAFT, the text, RESUME and CLEAR; RESUME opens Create, CLEAR only asks', () => {
    const onResume = vi.fn(), onAskClear = vi.fn();
    const el = DraftChip({ text: 'lofi beat', onResume, onAskClear });
    expect(renderToStaticMarkup(el)).toContain('<span class="cb-chip-label">DRAFT</span><span class="cb-chip-title" title="lofi beat">lofi beat</span>');
    press(el, 'RESUME');
    expect(onResume).toHaveBeenCalledOnce();
    press(el, 'CLEAR');
    expect(onAskClear).toHaveBeenCalledOnce();
  });
});

describe('ChipConfirm', () => {
  const confirm = () => {
    const onConfirm = vi.fn(), onKeep = vi.fn();
    return { el: ChipConfirm({ copy: CONFIRM_COPY.clear, onConfirm, onKeep }), onConfirm, onKeep };
  };

  it('states the consequence before a rust CLEAR and a quiet KEEP', () => {
    const html = renderToStaticMarkup(confirm().el);
    expect(html).toContain('Clear this draft? Its prompt, lyrics, settings and reference audio are discarded.');
    expect(html).toMatch(/class="cb-chip-btn danger"><span>CLEAR<\/span>.*class="cb-chip-btn" autofocus=""><span>KEEP/);
  });

  it('KEEP cancels without clearing; CLEAR confirms', () => {
    const a = confirm();
    press(a.el, 'KEEP');
    expect(a.onKeep).toHaveBeenCalledOnce();
    expect(a.onConfirm).not.toHaveBeenCalled();
    const b = confirm();
    press(b.el, 'CLEAR');
    expect(b.onConfirm).toHaveBeenCalledOnce();
  });

  it('Escape keeps; other keys do nothing', () => {
    const { el, onKeep } = confirm();
    const onKeyDown = (el as ReactElement<{ onKeyDown: (e: { key: string }) => void }>).props.onKeyDown;
    onKeyDown({ key: 'Enter' });
    expect(onKeep).not.toHaveBeenCalled();
    onKeyDown({ key: 'Escape' });
    expect(onKeep).toHaveBeenCalledOnce();
  });

  it('names what a queued cancel and a running abort cost', () => {
    expect(CONFIRM_COPY.cancel.consequence).toMatch(/nothing is lost/);
    expect(CONFIRM_COPY.abort.consequence).toMatch(/take in progress is lost/);
  });
});

describe('generation chip', () => {
  it('a running chip wears the shader and offers ABORT, which only asks', () => {
    const onAsk = vi.fn();
    const el = GenerationChip({ chip: chip({}), busy: false, onAsk });
    expect(renderToStaticMarkup(el)).toMatch(/^<div class="cb-chip ai"><div style="position:absolute.*GENERATING.*Neon Harbor.*42%/);
    press(el, 'ABORT');
    expect(onAsk).toHaveBeenCalledOnce();
  });

  it('queued: plain, CANCEL; busy reads CANCELLING… and is off', () => {
    const q = chip({ label: 'QUEUED · #1', ai: false, pct: null, action: 'cancel' });
    expect(renderToStaticMarkup(GenerationChip({ chip: q, busy: false, onAsk: vi.fn() }))).toMatch(/^<div class="cb-chip queued"><span/);
    const busy = GenerationChip({ chip: q, busy: true, onAsk: vi.fn() });
    expect(labels(busy)).toEqual(['CANCELLING…']);
    expect(buttons(busy)[0].props.disabled).toBe(true);
    expect(labels(GenerationChip({ chip: chip({}), busy: true, onAsk: vi.fn() }))).toEqual(['ABORTING…']);
  });

  it('no action, no button (a running job that does not hold the lock)', () => {
    expect(labels(GenerationChip({ chip: chip({ action: null }), busy: false, onAsk: vi.fn() }))).toEqual([]);
  });
});
