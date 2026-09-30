/** LYRICS for a YuE2 cover follow the score's sections (PLAN.md "Cover spike results": 0.93 of
 * the melody kept with the score's tags, 0.66 with the source song's own). The score marks
 * them as `% verse` comments; these helpers turn that into lyric tags. Pure. */

/** Sections that carry no singing, so words are never placed under them. */
const UNSUNG = new Set(['Intro', 'Interlude', 'Instrumental']);
const TAG_LINE = /^\s*\[[^\]]*\]\s*$/;

/** `% pre-chorus` → `Pre-Chorus`, as yue-server's section_tags writes them. */
export function scoreSections(abc: string): string[] {
  return abc.split(/\r?\n/)
    .filter((line) => line.startsWith('% '))
    .map((line) => line.slice(2).trim().replace(/(^|[-\s])([a-z])/g, (_m, sep: string, c: string) => sep + c.toUpperCase()));
}

/** The score's section tags with nothing under them: an instrumental's lyrics, or a frame
 * to write words into. */
export function sectionOutline(abc: string): string {
  return scoreSections(abc).map((s) => `[${s}]`).join('\n\n');
}

/** Groups of sung lines, in order; tag lines only separate them and are dropped. */
function wordBlocks(lyrics: string): string[][] {
  const blocks: string[][] = [[]];
  for (const raw of lyrics.split(/\r?\n/)) {
    const line = raw.trim();
    if (TAG_LINE.test(line)) blocks.push([]);
    else if (line) blocks[blocks.length - 1].push(line);
  }
  return blocks.filter((b) => b.length > 0);
}

/** Re-tag `lyrics` onto the score's sections: each block of words, in order, goes under the
 * next section that is sung. Words left over when the sung sections run out join the last
 * one, so nothing typed is lost. Unchanged when the score marks no sections. */
export function fitLyricsToSections(lyrics: string, abc: string): string {
  const sections = scoreSections(abc);
  if (sections.length === 0) return lyrics;
  const blocks = wordBlocks(lyrics);
  const sung = sections.map((s, i) => (UNSUNG.has(s) ? -1 : i)).filter((i) => i >= 0);
  const body: string[][] = sections.map(() => []);
  blocks.forEach((block, n) => {
    const at = sung.length === 0 ? sections.length - 1 : sung[Math.min(n, sung.length - 1)];
    body[at].push(...block);
  });
  return sections.map((s, i) => [`[${s}]`, ...body[i]].join('\n')).join('\n\n');
}

/** Whether any line would be sung. Lyrics that are only section tags make an instrumental
 * cover — yue-server's rule, and upstream's (PLAN.md "YuE2: Align With Upstream's …"). */
export const hasWords = (lyrics: string): boolean =>
  lyrics.split(/\r?\n/).some((line) => line.trim() && !TAG_LINE.test(line));
