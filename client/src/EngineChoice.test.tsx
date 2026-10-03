import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { EngineChoice } from './EngineChoice';

const choices = [
  { id: 'acestep' as const, label: 'ACE-STEP', configured: true, ready: true, coverReady: true },
  { id: 'yue2' as const, label: 'YUE2', configured: true, ready: true, coverReady: true },
];
const render = (lockedBy?: string | null) => renderToStaticMarkup(
  <EngineChoice choices={choices} value="yue2" onPick={() => {}} reasonFor={() => ''} lockedBy={lockedBy} />,
);
const disabledTabs = (html: string) => (html.match(/<button[^>]*disabled/g) ?? []).length;

describe('EngineChoice lock', () => {
  it('leaves every engine pickable with nothing reading the source', () => {
    const html = render();
    expect(disabledTabs(html)).toBe(0);
    expect(html).not.toContain('is locked');
  });

  it('shows ACE-STEP fixed, with nothing to pick, until an extra engine can take the job', () => {
    const html = renderToStaticMarkup(<EngineChoice choices={[]} value="acestep" onPick={() => {}} reasonFor={() => ''} />);
    expect(html).toContain('ACE-STEP');
    expect(html).not.toContain('<button');
  });

  it('disables every engine and says which job holds the choice', () => {
    const html = render('TRANSCRIBE');
    expect(disabledTabs(html)).toBe(2);
    expect(html).toContain('ENGINE is locked while TRANSCRIBE runs');
  });
});
