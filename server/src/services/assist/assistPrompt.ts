/**
 * The Editor's field helper (PLAN.md "Editor Redesign", ✦ HELP): what one help call asks the local LLM, and which of
 * its suggestions are kept. Three kinds: an ADD LAYER description, a REPAINT instruction, and the words of the selected
 * part rewritten. The song, the part and the layers are context the person never types. Pure.
 */
import type { ChatMessage } from '../score/planTypes.js';

export type AssistKind = 'layer' | 'repaint' | 'lyrics';

export interface AssistRequest {
  kind: AssistKind;
  songId: string;
  /** The song's style caption, BPM, key. */
  caption: string;
  bpm: number | null;
  key: string | null;
  /** The lanes the song has now (names). */
  layers: string[];
  /** ADD LAYER: the picked TRACK label ('' = AUTO). REPAINT / lyrics: the layer acted on. */
  layer: string;
  /** The selected part, e.g. `VERSE 2 · 1:17–1:48`, or '' for the whole song. */
  part: string;
  /** What the field holds now (the description, the instruction, or the part's words). */
  current: string;
  /** A one-tap refinement or the free line: what the person wants different. '' = first suggestions. */
  ask: string;
  /** Lyrics: the language the words are in (ISO 639-1), when known. */
  language?: string | null;
}

export interface Suggestion { text: string; why: string }

export const MAX_SUGGESTIONS = 3;

/** The reply's shape: two or three suggestions, each with a one-line reason. */
export const ASSIST_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['suggestions'],
  properties: {
    suggestions: {
      type: 'array', minItems: 1, maxItems: MAX_SUGGESTIONS,
      items: {
        type: 'object', additionalProperties: false, required: ['text', 'why'],
        properties: { text: { type: 'string' }, why: { type: 'string' } },
      },
    },
  },
} as const;

const TAG = /^\s*\[[^\]]+\]\s*$/;
/** A label the model sometimes puts before a prompt ("tags: deeper bass, …"); the field must hold the prompt only. */
const LEAD_LABEL = /^\s*(?:tags?|instructions?|descriptions?|prompt|caption)\s*:\s*/i;

const VOWELS = /[aeiouyäöüàâéèêëîïôûùœæ]+/g;

/** Rough sung syllables of a line: vowel groups per word, at least one per word with letters. Outside German a final
 * silent `e` after a consonant (`fade`, `rise`) is not counted. A guide for the model, not a rule. */
export function syllables(line: string, language: string | null = null): number {
  return (line.toLowerCase().match(/\p{L}+/gu) ?? []).reduce((n, w) => {
    let groups = (w.match(VOWELS) ?? []).length;
    if (language !== 'de' && groups > 1 && /[^aeiouy]e$/.test(w) && !/le$/.test(w)) groups -= 1;
    return n + Math.max(1, groups);
  }, 0);
}

const sungLines = (text: string) => text.split('\n').filter((l) => l.trim() && !TAG.test(l));

function songLine(r: AssistRequest): string {
  const facts = [r.caption && `style: ${r.caption}`, r.bpm && `${r.bpm} BPM`, r.key && `key ${r.key}`].filter(Boolean).join(' · ');
  const lanes = r.layers.length ? `lanes: ${r.layers.join(', ')}` : '';
  return [facts, lanes, r.part ? `the part: ${r.part}` : 'the part: the whole song'].filter(Boolean).join('\n');
}

const TASK: Record<AssistKind, (r: AssistRequest) => string> = {
  layer: (r) => `Write a description for a new ${r.layer ? `${r.layer} ` : ''}layer to be generated over this song by ACE-Step `
    + '(its "lego" task): instrument or voice, playing style, sound and mood, as comma-separated tags and short phrases, '
    + 'at most 25 words, fitting the song. No lyrics.',
  repaint: (r) => `Write an instruction for repainting ${r.part || 'the whole song'} of the ${r.layer || 'base'} layer with ACE-Step: `
    + 'what should change in the sound (arrangement, instruments, energy, mood), at most 25 words, as comma-separated tags '
    + 'and short phrases, with no label in front.',
  lyrics: (r) => `Rewrite the words of ${r.part || 'this part'} below${r.language ? ` (language: ${r.language}; keep it)` : ''}. `
    + 'Keep every [Tag] line as it is and the same number of sung lines; keep each line close to the syllable count '
    + 'given after it, so the new words fit the same melody. Return the whole part, lines separated by newlines.',
};

/** The messages for one help call. */
export function assistMessages(r: AssistRequest): ChatMessage[] {
  const current = r.kind === 'lyrics'
    ? r.current.split('\n').map((l) => (TAG.test(l) || !l.trim() ? l : `${l}   (${syllables(l, r.language ?? null)} syllables)`)).join('\n')
    : r.current;
  const user = [
    songLine(r),
    current.trim() ? `${r.kind === 'lyrics' ? 'the words now' : 'what the field says now'}:\n${current}` : '',
    TASK[r.kind](r),
    r.ask.trim() ? `The person wants: ${r.ask.trim()}` : '',
    `Give ${MAX_SUGGESTIONS} different suggestions, each with a one-line reason.`,
  ].filter(Boolean).join('\n\n');
  return [
    { role: 'system', content: 'You help write prompts and lyrics for an AI music editor. Answer only with the JSON asked for.' },
    { role: 'user', content: user },
  ];
}

/** The suggestions worth showing: non-empty, distinct, and for lyrics with the part's sung line count and its tags. */
export function keepSuggestions(r: AssistRequest, raw: unknown): Suggestion[] {
  const list = (raw as { suggestions?: unknown })?.suggestions;
  if (!Array.isArray(list)) return [];
  const want = sungLines(r.current).length;
  const tags = r.current.split('\n').filter((l) => TAG.test(l)).map((l) => l.trim());
  const seen = new Set<string>();
  return list.flatMap((s) => {
    const said: string = typeof s?.text === 'string' ? s.text.trim() : '';
    const text = r.kind === 'lyrics' ? said : said.replace(LEAD_LABEL, '').trim();
    const why: string = typeof s?.why === 'string' ? s.why.trim() : '';
    if (!text || seen.has(text) || text === r.current.trim()) return [];
    if (r.kind === 'lyrics' && want > 0) {
      if (sungLines(text).length !== want) return [];
      if (tags.some((t) => !text.split('\n').some((l) => l.trim() === t))) return [];
    }
    seen.add(text);
    return [{ text, why }];
  }).slice(0, MAX_SUGGESTIONS);
}
