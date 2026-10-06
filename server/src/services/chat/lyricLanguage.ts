/**
 * Language-ID for the rewritten-lyric guard (replyGuards.lyricLanguageReasons): `eld` (Nito-ELD, a
 * pure-JS n-gram detector, Apache-2.0), its extra-small database restricted to SP-5's candidate
 * languages. Checked on SP-5's 531 recorded lyric sections (en/de/es/fr, 4-8 lines): 529 right, the
 * two others a German section filed as Spanish and "Hey, hey du!" repeated; 23 ms for all 531. Loaded
 * on first use (about 90 ms), never at server start.
 */
const CANDIDATES = ['en', 'de', 'es', 'fr', 'it', 'pt', 'nl', 'pl', 'sv', 'tr', 'ru'];

type Detector = { detect: (text: string) => { language: string } };
let detector: Promise<Detector> | null = null;

/** ISO 639-1 code, or null when nothing was detected. */
export async function detectLanguage(text: string): Promise<string | null> {
  detector ??= import('eld/extrasmall').then(({ eld }) => {
    eld.setLanguageSubset(CANDIDATES);
    return eld;
  });
  return (await detector).detect(text).language || null;
}
