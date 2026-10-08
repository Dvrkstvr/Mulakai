/** The Create card renders from props alone: its two lines, and TO CREATE as its only action. */
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CreateCardView } from './CreateCard';

type Btn = ReactElement<{ onClick: () => void; children: ReactElement<{ children: string }> }>;
function buttons(node: ReactNode): Btn[] {
  if (Array.isArray(node)) return node.flatMap(buttons);
  if (!isValidElement<{ children?: ReactNode }>(node)) return [];
  return [...(node.type === 'button' ? [node as Btn] : []), ...buttons(node.props.children)];
}

describe('CreateCardView', () => {
  it('a draft: DRAFT, the title, its fact tags, and TO CREATE as the only button', () => {
    const onOpen = vi.fn();
    const el = CreateCardView({ label: 'DRAFT', title: 'Dream pop', facts: ['143 BPM', 'A MINOR'], onOpen });
    const html = renderToStaticMarkup(el);
    expect(html).toMatch(/^<div class="cc">.*DRAFT.*Dream pop.*<span>143 BPM<\/span><span>A MINOR<\/span>/);
    expect(buttons(el).map((b) => b.props.children.props.children)).toEqual(['TO CREATE ▸']);
    buttons(el)[0].props.onClick();
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it('thinking: the AI shader and a note instead of tags', () => {
    const html = renderToStaticMarkup(CreateCardView({ label: 'THINKING', title: 'idea', note: 'writing…', ai: true, onOpen: vi.fn() }));
    expect(html).toMatch(/^<div class="cc ai">/);
    expect(html).toContain('<div class="cc-note">writing…</div>');
    expect(html).not.toContain('cc-facts');
  });

  it('failed: rust, with what went wrong', () => {
    const html = renderToStaticMarkup(CreateCardView({ label: "COULDN'T WRITE", title: 'idea', note: 'x · RETRY in Create', failed: true, onOpen: vi.fn() }));
    expect(html).toMatch(/^<div class="cc failed">/);
  });
});
