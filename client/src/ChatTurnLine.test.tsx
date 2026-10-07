/** One turn line per state (chat-turn.html frames 1-5, fragment a; TU-1, TU-2). */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ChatTurnLine } from './ChatTurnLine';
import { INITIAL_TURN, type TurnPhase } from './chatTurn';

const html = (phase: TurnPhase, cancelling = false, touchedLine: string | null = null) => renderToStaticMarkup(
  <ChatTurnLine turn={{ ...INITIAL_TURN, phase, cancelling }} touchedLine={touchedLine} onCancel={vi.fn()} onRetry={vi.fn()} onForm={vi.fn()} />,
);

describe('ChatTurnLine', () => {
  it('queued: dashed and plain, the queue in words, what it costs, CANCEL', () => {
    const out = html({ kind: 'queued', ahead: 2 });
    expect(out).toContain('class="chat-job waiting"');
    expect(out).toContain('THINKING · QUEUED · STARTS AFTER 2 JOBS');
    expect(out).toContain('nothing else changes');
    expect(out).toMatch(/<button type="button" class="chat-q"><span>CANCEL/);
  });
  it('thinking: the shader line, the attempt, the refused reason, CANCEL; a field touched since SEND is named', () => {
    const out = html({ kind: 'thinking', attempt: 2, note: 'key “Aminor” is not one of the 30 key names' }, false, 'you changed TEMPO since sending · …');
    expect(out).toContain('class="chat-job working"');
    expect(out).toContain('THINKING… attempt 2 of 3');
    expect(out).toContain('attempt 1 refused: key “Aminor”');
    expect(out).toContain('you changed TEMPO since sending');
  });
  it('cancelling: plain, says the planner unloads, CANCEL off', () => {
    const out = html({ kind: 'thinking', attempt: 1, note: null }, true);
    expect(out).toContain('CANCELLING…');
    expect(out).toContain('unloading the planner');
    expect(out).not.toContain('working');
    expect(out).toMatch(/disabled=""><span>CANCEL/);
  });
  it('failed: one rust line, what happened, nothing changed, RETRY and FORM ▸', () => {
    const out = html({ kind: 'failed', reasons: ['attempt 3 refused: bar 5 had 31/32 units'], cause: 'check' });
    expect(out).toContain('class="chat-er"');
    expect(out).toContain('NO ANSWER IN 3 ATTEMPTS');
    expect(out).toContain('Nothing changed');
    expect(out).toContain('RETRY');
    expect(out).toContain('FORM ▸');
  });
  it('offline: ASSISTANT OFF with the cause, RETRY and FORM ▸', () => {
    const out = html({ kind: 'offline', cause: 'Ollama did not answer at LLM_API_URL' });
    expect(out).toContain('ASSISTANT OFF');
    expect(out).toContain('Ollama did not answer at LLM_API_URL');
    expect(out).toContain('FORM ▸');
  });
  it('interrupted and cancelled: one shape (TU-2), a rust line, nothing changed, one RETRY, no FORM ▸', () => {
    expect(html({ kind: 'interrupted' })).toMatch(/INTERRUPTED.*RETRY/);
    const cancelled = html({ kind: 'cancelled' });
    expect(cancelled).toContain('class="chat-er" role="alert"');
    expect(cancelled).toMatch(/<b>CANCELLED<\/b> No reply\. Nothing changed\./);
    expect(cancelled.match(/<button/g)).toHaveLength(1);
    expect(cancelled).toMatch(/class="chat-ao"><span>RETRY/);
  });
  it('an outcome has no line', () => expect(html({ kind: 'outcome', replyId: 'r' })).toBe(''));
});
