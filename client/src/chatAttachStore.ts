/** The composer's pending attachment per thread (F-061, D-130): a file uploads at once with progress, or a library
 * song is picked; then attached (SEND carries `attach: {referenceId}`) or failed with the server's reason. Cleared
 * on SEND or ✕; ✕ aborts an upload. The reference row stays on the server until NEW CHAT. */
import { create } from 'zustand';
import type { ChatAttach } from './api/chat';
import { chatReferencesApi, type ReferenceView } from './api/chatReferences';

export type Attachment =
  | { phase: 'uploading'; name: string; progress: number }
  | { phase: 'attached'; name: string; referenceId: string; seconds: number | null }
  | { phase: 'failed'; name: string; reason: string };

interface ChatAttachStore {
  byThread: Record<string, Attachment>;
  attachFile: (threadId: string, file: File) => Promise<void>;
  attachLibrary: (threadId: string, songId: string, title: string) => Promise<void>;
  /** ✕ on the chip. */
  remove: (threadId: string) => void;
  /** The server has the message that carried it. */
  sent: (threadId: string) => void;
}

/** SEND waits while a file is still uploading (the message would go without it). */
export const attachBlocksSend = (a: Attachment | undefined): boolean => a?.phase === 'uploading';
export const attachToSend = (a: Attachment | undefined): ChatAttach | null =>
  a?.phase === 'attached' ? { referenceId: a.referenceId } : null;

const reasonOf = (err: unknown) => (err instanceof Error ? err.message : String(err));
/** The latest attach per thread: an older one's answer (or a ✕'d one) is dropped. */
const current = new Map<string, { token: symbol; abort?: AbortController }>();

export const useChatAttachStore = create<ChatAttachStore>((set) => {
  const put = (threadId: string, a: Attachment | null) => set((s) => {
    const byThread = { ...s.byThread };
    if (a) byThread[threadId] = a; else delete byThread[threadId];
    return { byThread };
  });

  function drop(threadId: string) {
    current.get(threadId)?.abort?.abort();
    current.delete(threadId);
    put(threadId, null);
  }

  /** Run one attach; only the latest per thread may write its outcome. */
  async function run(threadId: string, name: string, start: (mine: () => boolean, signal?: AbortSignal) => Promise<ReferenceView>, abort?: AbortController) {
    current.get(threadId)?.abort?.abort();
    const token = Symbol(threadId);
    current.set(threadId, { token, abort });
    const mine = () => current.get(threadId)?.token === token;
    try {
      const ref = await start(mine, abort?.signal);
      if (mine()) put(threadId, { phase: 'attached', name, referenceId: ref.id, seconds: ref.seconds });
    } catch (err) {
      if (mine()) put(threadId, { phase: 'failed', name, reason: reasonOf(err) });
    } finally {
      if (mine()) current.set(threadId, { token });
    }
  }

  return {
    byThread: {},
    attachFile: (threadId, file) => {
      put(threadId, { phase: 'uploading', name: file.name, progress: 0 });
      return run(threadId, file.name, (mine, signal) => chatReferencesApi.uploadReference(threadId, file, {
        signal, onProgress: (progress) => { if (mine()) put(threadId, { phase: 'uploading', name: file.name, progress }); },
      }), new AbortController());
    },
    attachLibrary: (threadId, songId, title) => {
      put(threadId, { phase: 'uploading', name: title, progress: 0 });
      return run(threadId, title, () => chatReferencesApi.pickLibraryReference(threadId, songId));
    },
    remove: drop,
    sent: drop,
  };
});
