/** The start screen (D-099, F-043): CHAT when the server says the chat is configured (LLM_API_URL and
 * YUE_API_URL set), else the Library as today, so the golden path (LLM_API_URL empty) still opens there.
 * Config, not reachability: a planner that does not answer is ASSISTANT OFF inside the chat. Pure. */
import type { ChatStatus } from './api/chat';

export type StartView = 'chat' | 'library';

/** `null` = the status could not be read (an older server, a network error): the Library. */
export function startView(status: ChatStatus | null): StartView {
  return status?.configured === true ? 'chat' : 'library';
}

/** The boot's switch to CHAT: only while the person is still where the app started (the Library, no song open);
 * a song opened from Ctrl K before the status came back stays open. */
export const bootToChat = (status: ChatStatus | null, stillHome: boolean): boolean => stillHome && startView(status) === 'chat';

/** Whether CHAT shows at all (the header entry, OPEN CHAT on a song): only when configured. */
export const chatShown = (status: ChatStatus | null): boolean => startView(status) === 'chat';

/** ASSISTANT OFF's cause while the chat is configured but the planner does not answer; null when it does
 * (or when the chat is not shown at all: then there is no entry to explain). */
export function assistantOffCause(status: ChatStatus | null): string | null {
  if (!chatShown(status) || status!.assistant === 'ok') return null;
  return status!.cause?.trim() || 'the assistant did not answer';
}
