/** The start screen (D-099, F-043): asks the server once whether the chat is configured and opens CHAT on the
 * draft thread when it is; otherwise the Library, as today (the golden path leaves LLM_API_URL empty). The
 * first frame waits for that answer, at most BOOT_WAIT_MS, so neither screen flashes before the other. */
import { useEffect, useState } from 'react';
import { bootToChat } from './chatEntry';
import { useChatStore } from './chatStore';

export const BOOT_WAIT_MS = 2500;

/** `stillHome`: the person has not left the Library (opened a song, Settings, Create) while the status was read. */
export function useChatBoot(onChat: () => void, stillHome: () => boolean): boolean {
  const [booted, setBooted] = useState(false);
  useEffect(() => {
    let live = true;
    const timeout = new Promise<null>((r) => setTimeout(() => r(null), BOOT_WAIT_MS));
    void Promise.race([useChatStore.getState().loadStatus(), timeout]).then((status) => {
      if (!live) return;
      if (bootToChat(status, stillHome())) onChat();
      setBooted(true);
    });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return booted;
}
