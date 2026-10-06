/**
 * The draft -> the Create fields and title CREATE SONG hands to `startEngineGeneration` on YuE2
 * (`buildYue2Request` maps them on). Pure. The mapping is Guided Create's own: style is the PROMPT,
 * the key is spelled as songs store it (`Am` -> `A minor`, abcMeta.parseKey), a meter is stored as
 * its numerator (client songMeta.ts), and a language YuE2 does not list is left out (client
 * engineCaps.liveLanguage); the lyrics themselves carry it.
 */
import { parseKey } from '../engines/abcMeta.js';
import { YUE2_CAPABILITIES } from '../engines/yue2.js';
import type { CreateFields } from '../engines/types.js';
import type { DraftFields, LyricSection } from './chatTypes.js';

const sung = (s: LyricSection): string[] => s.lines.map((l) => l.trim()).filter(Boolean);
const block = (tag: string, lines: string[] = []) => [`[${tag}]`, ...lines].join('\n');

/** The sung text in `structure` order: a structure tag takes the next unplaced section with that
 * tag, else it is a bare (instrumental) tag; sections the structure does not place follow at the
 * end, so nothing written is lost. No sung line at all is '' (YuE2's instrumental skeleton, as
 * Guided Create's INSTRUMENTAL on YuE2). */
export function lyricsText(structure: string[] = [], sections: LyricSection[] = []): string {
  if (!sections.some((s) => sung(s).length > 0)) return '';
  const blocks: string[] = [];
  let next = 0;
  for (const tag of structure) {
    if (sections[next]?.tag === tag) blocks.push(block(tag, sung(sections[next++])));
    else blocks.push(block(tag));
  }
  for (const s of sections.slice(next)) blocks.push(block(s.tag, sung(s)));
  return `${blocks.join('\n\n')}\n`;
}

/** `4/4` -> `4`, the way Guided Create stores a meter; anything else as written. */
const meterValue = (m: string): string => (/^(\d+)\/\d+$/.exec(m.trim())?.[1] ?? m.trim());

export function draftFields(f: DraftFields): { title: string; fields: CreateFields } {
  const fields: CreateFields = { prompt: f.style?.trim() ?? '', lyrics: lyricsText(f.structure, f.lyrics) };
  if (f.bpm !== undefined && f.bpm > 0) fields.bpm = f.bpm;
  const key = parseKey(f.key);
  if (key) fields.key_scale = key;
  if (f.timeSignature?.trim()) fields.time_signature = meterValue(f.timeSignature);
  const languages = YUE2_CAPABILITIES.languages;
  if (f.language && (languages === 'any' || languages.includes(f.language))) fields.vocal_language = f.language;
  return { title: f.title?.trim() || 'Untitled', fields };
}
