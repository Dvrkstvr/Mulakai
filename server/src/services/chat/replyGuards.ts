/**
 * The three loop guards SP-5 added after real failures (prompt rules alone left them wrong), with the
 * spike's reason texts: a section word the request names that the song lacks (the model silently
 * picked another place), a `say` naming a key other than the HEADER's (after a TRANSPOSE it named
 * the old key 6 of 6 times), and a rewritten lyric block in another language than the block it
 * replaces (language-ID injected, lyricLanguage.ts). Pure (detection injected).
 */
import type { ApplyResult, ScoreFacts } from '../score/planTypes.js';

const SECTION_WORDS = ['intro', 'verse', 'pre-chorus', 'chorus', 'bridge', 'outro', 'interlude'];

/** An edit for a section the song does not have: answer say instead of substituting another place. */
export function missingSectionReasons(request: string, facts: ScoreFacts): string[] {
  const have = new Set(facts.sections.map((s) => s.label.toLowerCase()).filter(Boolean));
  const asked = SECTION_WORDS.find((w) => new RegExp(`\\b${w}\\b`, 'i').test(request) && !have.has(w));
  if (!asked) return [];
  return [`the request names the ${asked}, but this song has no ${asked} (its sections: ${[...have].sort().join(', ') || 'none marked'}): `
    + 'do not substitute another place; answer with action say and tell the person what the song has instead'];
}

const NAMED = /\b([A-G][#b♭♯]?)\s?(minor|major|m\b)/;
const MINOR_WORD = '(m\\b|minor|-?moll|menor)';

/** The HEADER key in the ways a reply may spell it ("Fm", "F minor", "f-Moll" is not matched: case). */
function keyPattern(key: string): RegExp {
  const minor = key.endsWith('m');
  const root = (minor ? key.slice(0, -1) : key).replace('b', '[b♭]').replace('#', '[#♯]');
  // SP-5 ended a major key with \b, which never matches after "F#"; (?!\w) does.
  return minor ? new RegExp(`\\b${root}\\s?${MINOR_WORD}`) : new RegExp(`\\b${root}(?![#♯b♭]|\\s?${MINOR_WORD})(?!\\w)`);
}

/** A say that names a key must name the HEADER's (the active version's). */
export function sayKeyReasons(message: string, facts: ScoreFacts): string[] {
  const named = NAMED.exec(message);
  const key = facts.header.key;
  if (!named || keyPattern(key).test(message)) return [];
  const minor = key.endsWith('m');
  // SP-5 tested startswith('m'), which "major" passes too.
  return [`you named the key ${named[1]}${named[2] === 'major' ? ' major' : ' minor'}, but the HEADER says K:${key} `
    + `(${minor ? key.slice(0, -1) : key} ${minor ? 'minor' : 'major'}) for the active version: quote the HEADER`];
}

export type DetectLanguage = (text: string) => Promise<string | null>;
/** Language-ID is unreliable under about 40 characters (SP-5: "Ooh la la ooh yeah"). */
const LID_MIN = 40;

/** A REWRITE_LYRICS keeps the language of the block it replaces (the verdict's diff has both). */
export async function lyricLanguageReasons(applied: ApplyResult, detect: DetectLanguage): Promise<string[]> {
  const out: string[] = [];
  for (const v of applied.verdicts) {
    const d = v.diff;
    if (v.op !== 'REWRITE_LYRICS' || !d) continue;
    const [oldText, newText] = [d.old.join(' '), d.new.join(' ')];
    if (oldText.length <= LID_MIN || newText.length <= LID_MIN) continue;
    const [was, now] = [await detect(oldText), await detect(newText)];
    if (was && now && was !== now) {
      out.push(`op ${v.index} (REWRITE_LYRICS): the new lines read as '${now}' but the block they replace reads as '${was}': `
        + `write them in the song's own language ('${was}')`);
    }
  }
  return out;
}
