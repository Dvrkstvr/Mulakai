/** Reads once whether the chat is configured, so the header can show CHAT and OPEN CHAT (chatEntry.chatShown).
 * The app always starts on the Library (D-119, the owner's), so nothing waits for the answer. */
import { useEffect } from 'react';
import { useChatStore } from './chatStore';

export function useChatBoot(): void {
  useEffect(() => { void useChatStore.getState().loadStatus(); }, []);
}
