/** CHAT shows when configured (the app starts on the Library, D-119); ASSISTANT OFF's cause. */
import { describe, it, expect } from 'vitest';
import { assistantOffCause, chatShown } from './chatEntry';

describe('chatEntry', () => {
  it('shows CHAT only when the server says the chat is configured', () => {
    expect(chatShown({ configured: true, assistant: 'ok' })).toBe(true);
    expect(chatShown({ configured: false, assistant: 'off', cause: 'LLM_API_URL is not set' })).toBe(false);
  });

  it('an unreadable status (older server, network error) hides CHAT', () => {
    expect(chatShown(null)).toBe(false);
  });

  it('an unreachable planner is still CHAT (config, not reachability), with ASSISTANT OFF inside', () => {
    const off = { configured: true, assistant: 'off' as const, cause: 'Ollama did not answer at LLM_API_URL' };
    expect(chatShown(off)).toBe(true);
    expect(assistantOffCause(off)).toBe('Ollama did not answer at LLM_API_URL');
  });

  it('no cause when the assistant answers or the chat is not shown; a blank cause gets a fallback', () => {
    expect(assistantOffCause({ configured: true, assistant: 'ok' })).toBeNull();
    expect(assistantOffCause({ configured: false, assistant: 'off', cause: 'x' })).toBeNull();
    expect(assistantOffCause({ configured: true, assistant: 'off', cause: ' ' })).toBe('the assistant did not answer');
  });
});
