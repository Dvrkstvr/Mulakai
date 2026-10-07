/** The sidebar's LYRICS and STRUCTURE as text (F-043): the draft keeps lyrics as `{tag, lines}` sections (D-112)
 * and the structure as tags; the person edits them as `[Verse 1]` blocks and "INTRO · VERSE · CHORUS". Parsing
 * never guesses: a line outside a section or an unknown name is a problem the field shows, and nothing is saved
 * until it is fixed. Whether the result is a valid recipe stays the server's call (`blockers`). Pure. */
import type { ChatLyricSection, ChatLyricTag, ChatSectionTag } from './api/chat';

const LYRIC_TAGS: ChatLyricTag[] = ['Verse', 'Pre-Chorus', 'Chorus', 'Bridge', 'Outro'];
const SECTION_TAGS: ChatSectionTag[] = ['Intro', ...LYRIC_TAGS];
const squash = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');
const canon = <T extends string>(tags: T[], name: string): T | null => tags.find((t) => squash(t) === squash(name)) ?? null;
const names = (tags: string[]) => `${tags.slice(0, -1).join(', ')} or ${tags.at(-1)}`;

export function sectionsToText(sections: ChatLyricSection[]): string {
  const total = new Map<string, number>();
  for (const s of sections) total.set(s.tag, (total.get(s.tag) ?? 0) + 1);
  const seen = new Map<string, number>();
  return sections.map((s) => {
    const n = (seen.get(s.tag) ?? 0) + 1;
    seen.set(s.tag, n);
    const head = total.get(s.tag)! > 1 ? `[${s.tag} ${n}]` : `[${s.tag}]`;
    return [head, ...s.lines].join('\n');
  }).join('\n\n');
}

export function textToSections(text: string): { sections: ChatLyricSection[]; problems: string[] } {
  const sections: ChatLyricSection[] = [];
  const problems: string[] = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    const head = line.match(/^\[\s*([^\]]*?)(?:\s+\d+)?\s*\]$/);
    if (head) {
      const tag = canon(LYRIC_TAGS, head[1]);
      if (tag) sections.push({ tag, lines: [] });
      else problems.push(`[${head[1]}] is not a sung section: use ${names(LYRIC_TAGS)}`);
      return;
    }
    const current = sections.at(-1);
    if (current) current.lines.push(line);
    else if (problems.length === 0) problems.push(`line ${i + 1} is outside a section: put [Verse] or [Chorus] above it`);
  });
  return { sections, problems };
}

export const structureText = (tags: ChatSectionTag[]): string => tags.map((t) => t.toUpperCase()).join(' · ');

export function parseStructure(text: string): { tags: ChatSectionTag[]; problems: string[] } {
  const tags: ChatSectionTag[] = [];
  const problems: string[] = [];
  for (const word of text.split(/[·,\s]+/).filter(Boolean)) {
    const tag = canon(SECTION_TAGS, word);
    if (tag) tags.push(tag);
    else problems.push(`${word.toUpperCase()} is not a section: use ${names(SECTION_TAGS)}`);
  }
  return { tags, problems };
}

/** The collapsed LYRICS field: its first header and line, and the sung line count; null with no lyrics. */
export function lyricsPreview(sections: ChatLyricSection[]): { head: string; first: string; count: number } | null {
  if (!sections.length) return null;
  const [{ tag, lines }] = sections;
  const head = sections.filter((s) => s.tag === tag).length > 1 ? `[${tag} 1]` : `[${tag}]`;
  return { head, first: lines[0] ?? '', count: sections.reduce((n, s) => n + s.lines.length, 0) };
}
