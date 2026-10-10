import { createContext, useContext } from 'react';
import type { AssistBody } from './api/assist';

/** What every ✦ HELP box in the action bar knows without being told (PLAN.md "Editor Redesign", the field helper): the
 * song, its lanes and the selected part. Null = help is off (no local LLM, or outside the Editor). */
export interface AssistSong {
  base: Pick<AssistBody, 'songId' | 'caption' | 'bpm' | 'key' | 'layers' | 'part'>;
  /** CONTINUE IN CHAT: the song's chat with the part marked; absent when the chat is off. */
  onContinueInChat?: () => void;
}

export const AssistContext = createContext<AssistSong | null>(null);

export const useAssistSong = () => useContext(AssistContext);
