/** RE-RENDER WHOLE SONG on a chat version card (C4, F-066 #5, D-268, D-270): its words, when it shows, and its click. */
import { chatEditApi, type ChatVersionBody } from './api/chatEdit';
import { useChatStore } from './chatStore';

export const RERENDER = 'RE-RENDER WHOLE SONG';
export const RERENDER_HINT = 'puts a whole-song edit card below: nothing renders until you APPLY it';
export const RERENDER_REFUSED = 'CANNOT RE-RENDER';

/** A splice saved as one (not the whole render it fell back to): the only version a whole re-render can improve on. */
export const canRerender = (v: ChatVersionBody, active: boolean) => active && !!v.splice && !v.fallback && !v.whole;

/** RE-RENDER WHOLE SONG's click: the server appends the edit card, then the thread is read again to show it.
 * Null when it landed, else why not (the server's reason, or the error). */
export async function askRerender(threadId: string, songId: string, versionId: string): Promise<string | null> {
  try {
    const out = await chatEditApi.rerenderWhole(threadId, versionId);
    if ('refused' in out) return out.refused;
    await useChatStore.getState().openSong(songId);
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}
