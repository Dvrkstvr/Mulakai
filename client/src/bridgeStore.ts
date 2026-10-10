import { create } from 'zustand';

/** A part of a song handed between the Editor and the Chat (PLAN.md "Editor Redesign", PR 12): ASK CHAT ABOUT THIS
 * hands the Editor's selection to the song's chat, where it becomes the mark; a chat card's OPEN IN EDITOR hands the
 * chat's mark to the Editor, where it becomes the selection. Each side takes what was handed to it once. */
export interface Handoff { songId: string; seconds: [number, number] }

interface Bridge {
  toChat: Handoff | null;
  toEditor: Handoff | null;
  sendToChat: (h: Handoff) => void;
  sendToEditor: (h: Handoff | null) => void;
  /** The seconds handed to this song's chat, once. */
  takeForChat: (songId: string) => [number, number] | null;
  /** The seconds handed to this song's Editor, once. */
  takeForEditor: (songId: string) => [number, number] | null;
}

export const useBridgeStore = create<Bridge>((set, get) => ({
  toChat: null,
  toEditor: null,
  sendToChat: (h) => set({ toChat: h }),
  sendToEditor: (h) => set({ toEditor: h }),
  takeForChat: (songId) => {
    const h = get().toChat;
    if (!h || h.songId !== songId) return null;
    set({ toChat: null });
    return h.seconds;
  },
  takeForEditor: (songId) => {
    const h = get().toEditor;
    if (!h || h.songId !== songId) return null;
    set({ toEditor: null });
    return h.seconds;
  },
}));
