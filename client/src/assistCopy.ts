/** ✦ HELP's words (PLAN.md "Editor Redesign", the field helper): the one-tap refinements per field and the status line.
 * Pure. */
import type { AssistKind } from './api/assist';
import { startsAfter } from './queueCopy';

/** One-tap refinements: what each tap asks for, sent as the request's `ask`. */
export const REFINEMENTS: Record<AssistKind, string[]> = {
  layer: ['more specific', 'sparser', 'a different feel', 'closer to the song'],
  repaint: ['bolder change', 'subtler change', 'more energy', 'calmer'],
  lyrics: ['rhyme better', 'more emotional', 'simpler words', 'same syllables, new image', 'translate to German'],
};

export const FIELD_NAME: Record<AssistKind, string> = {
  layer: 'THE NEW LAYER',
  repaint: 'THE REPAINT',
  lyrics: 'THE WORDS',
};

export type AssistPhase =
  | { kind: 'idle' }
  | { kind: 'waiting'; position: number | null }
  | { kind: 'thinking'; seconds: number }
  | { kind: 'done'; count: number }
  | { kind: 'failed'; error: string };

/** The box's status line: when it starts (never a time), that the model is writing, or what went wrong. */
export function assistStatusLine(p: AssistPhase): string {
  switch (p.kind) {
    case 'idle': return 'suggestions use the song, the selected part and the lanes · nothing changes until you pick one';
    case 'waiting': return p.position ? `waiting for the GPU · ${startsAfter(p.position)}` : 'asking…';
    case 'thinking': return `writing suggestions… ${p.seconds} s`;
    case 'done': return p.count === 1 ? '1 suggestion · USE puts it in the field' : `${p.count} suggestions · USE puts one in the field`;
    case 'failed': return p.error;
  }
}
