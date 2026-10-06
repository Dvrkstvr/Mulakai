/** CHAT's entries (the header switch, OPEN CHAT on a song) show when the server says the chat is configured
 * (LLM_API_URL and YUE_API_URL set). The app always starts on the Library (D-119, the owner's; D-099 had CHAT
 * as the start screen). Config, not reachability: a planner that does not answer is ASSISTANT OFF inside the
 * chat; `null` (an older server, a network error) hides CHAT. Pure. */
import type { ChatStatus } from './api/chat';

export const chatShown = (status: ChatStatus | null): boolean => status?.configured === true;

/** ASSISTANT OFF's cause while the chat is configured but the planner does not answer; null when it does
 * (or when the chat is not shown at all: then there is no entry to explain). */
export function assistantOffCause(status: ChatStatus | null): string | null {
  if (!chatShown(status) || status!.assistant === 'ok') return null;
  return status!.cause?.trim() || 'the assistant did not answer';
}
