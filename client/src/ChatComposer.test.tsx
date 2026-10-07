/** The composer (D-095, TU-3, TU-5, TU-9): the outline text button SEND ↵, off while a turn is open. */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ChatComposer } from './ChatComposer';
import { INITIAL_TURN, type TurnState } from './chatTurn';

const html = (turn: Partial<TurnState>, assistantOn = true, committing = false) => renderToStaticMarkup(
  <ChatComposer turn={{ ...INITIAL_TURN, ...turn }} assistantOn={assistantOn} committing={committing} onType={vi.fn()} onSend={vi.fn()} />,
);

describe('ChatComposer', () => {
  it('SEND ↵ is a text button, never a play glyph; live once text is typed', () => {
    const out = html({ text: 'a slow Spanish ballad' });
    expect(out).toMatch(/<button type="button" class="chat-send"><span>SEND ↵<\/span>/);
    expect(out).not.toMatch(/[▶❚]/);
  });
  it('nothing typed: SEND off', () => expect(html({})).toMatch(/class="chat-send" disabled=""/));
  it('a turn open: SEND off, the typed text stays, the reason above the input', () => {
    const out = html({ text: 'make the chorus shorter', phase: { kind: 'queued', ahead: 2 } });
    expect(out).toMatch(/class="chat-send" disabled=""/);
    expect(out).toContain('make the chorus shorter');
    expect(out).toContain('SEND waits until the assistant answers');
  });
  it('a take rendering: SEND stays live and says the message waits for v1', () => {
    const out = html({ text: 'darker' }, true, true);
    expect(out).toContain('WAITING FOR v1');
    expect(out).not.toMatch(/class="chat-send" disabled/);
  });
  it('an APPLY running on a song: the wait names the version it saves (CB-5)', () => {
    const out = renderToStaticMarkup(
      <ChatComposer turn={{ ...INITIAL_TURN, text: 'x' }} assistantOn committing waitingLine="WAITING FOR v2 · a message sent now is read after v2 is saved" onType={vi.fn()} onSend={vi.fn()} />,
    );
    expect(out).toContain('WAITING FOR v2');
    expect(out).not.toContain('WAITING FOR v1');
  });
  it('assistant off: the field and SEND are off, the placeholder points at RETRY and the form', () => {
    const out = html({ text: 'x' }, false);
    expect(out).toContain('Assistant off · RETRY above, or use the form');
    expect(out).toMatch(/class="chat-send" disabled=""/);
  });
  it('a refused SEND: a rust line, the text kept', () => {
    expect(html({ text: 'x', error: 'HTTP 503' })).toContain('NOT SENT');
  });
});
