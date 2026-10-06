/** The start-screen gate (D-099): configured → CHAT, anything else → the Library; ASSISTANT OFF's cause. */
import { describe, it, expect } from 'vitest';
import { assistantOffCause, chatShown, startView } from './chatEntry';

describe('chatEntry', () => {
  it('opens on CHAT only when the server says the chat is configured', () => {
    expect(startView({ configured: true, assistant: 'ok' })).toBe('chat');
    expect(startView({ configured: false, assistant: 'off', cause: 'LLM_API_URL is not set' })).toBe('library');
  });

  it('an unreadable status (older server, network error) opens the Library and hides CHAT', () => {
    expect(startView(null)).toBe('library');
    expect(chatShown(null)).toBe(false);
  });

  it('an unreachable planner is still CHAT (config, not reachability), with ASSISTANT OFF inside', () => {
    const off = { configured: true, assistant: 'off' as const, cause: 'Ollama did not answer at LLM_API_URL' };
    expect(startView(off)).toBe('chat');
    expect(assistantOffCause(off)).toBe('Ollama did not answer at LLM_API_URL');
  });

  it('no cause when the assistant answers or the chat is not shown; a blank cause gets a fallback', () => {
    expect(assistantOffCause({ configured: true, assistant: 'ok' })).toBeNull();
    expect(assistantOffCause({ configured: false, assistant: 'off', cause: 'x' })).toBeNull();
    expect(assistantOffCause({ configured: true, assistant: 'off', cause: ' ' })).toBe('the assistant did not answer');
  });
});
