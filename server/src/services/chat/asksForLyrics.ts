/**
 * Does a request ask about the words? (LD fix, F-095, D-251): code decides a follow-up's keep vs write, not the
 * planner (live, qwen3:14b said "write" to "mach es etwas schneller" 3 of 3). A word-list test in en / de / es,
 * case-insensitive, whole words, per clause (split at punctuation and but / and / aber / und / pero / y):
 * a clause asks when it has a rewrite verb, or names the words (lyrics, Text, letra, ...) while it says to change
 * them or does not say to keep them ("Text unverändert", "same lyrics", "sin cambiar la letra" keep). It does not
 * detect a new topic (D-251): such a follow-up usually names the words. Pure.
 */
const WORDS = new Set([
  'lyric', 'lyrics', 'word', 'words', 'verse', 'verses', 'chorus', 'choruses', 'line', 'lines', 'text',
  'texte', 'textzeile', 'textzeilen', 'songtext', 'songtexte', 'liedtext', 'liedtexte', 'strophe', 'strophen', 'refrain', 'refrains',
  'zeile', 'zeilen', 'wort', 'worte', 'wörter', 'letra', 'letras', 'estrofa', 'estrofas', 'estribillo', 'estribillos', 'verso',
  'versos', 'línea', 'líneas', 'palabra', 'palabras',
]);
/** Verb stems that always ask for new words (rewrite, rhyme, umschreiben, reim-, reescribe, rima-). */
const REWRITE = ['rewrit', 'rhym', 'umschreib', 'umgeschrieben', 'reescrib', 'rima'];
const REIM = new Set(['reim', 'reime', 'reimen', 'reimt', 'reimst']); // not a stem: "reimagine" is not about the words
/** Said to keep the words; the phrases are cut out before the change test ("don't change" is a keep). */
const KEEP = new Set(['keep', 'same', 'unchanged', 'unverändert', 'behalten', 'behalte', 'gleich', 'gleiche', 'gleichen', 'selben',
  'misma', 'mismas', 'mismo', 'mismos', 'mantén', 'manten', 'mantener', 'igual']);
const KEEP_PHRASES = [/\b(?:don'?t|do not|never) change\b/g, /\bnicht (?:ver)?ändern\b/g, /\b(?:sin|no) cambiar\b/g, /\bno cambies\b/g];
const CHANGE = new Set(['new', 'different', 'other', 'change', 'changed', 'neu', 'neue', 'neuen', 'neuer', 'neues', 'andere', 'anderen',
  'anderer', 'anders', 'ändern', 'ändere', 'ändert', 'nueva', 'nuevas', 'nuevo', 'nuevos', 'otra', 'otras', 'otro', 'otros', 'cambia',
  'cambiar', 'cambie', 'diferente', 'diferentes']);
const CLAUSE = /[,.;:!?]|\b(?:but|and|aber|und|sondern|pero|y)\b/;

const tokens = (s: string): string[] => s.split(/[^\p{L}']+/u).filter(Boolean);

function clauseAsks(clause: string): boolean {
  const words = tokens(clause);
  if (words.some((w) => REIM.has(w) || REWRITE.some((stem) => w.startsWith(stem)))) return true;
  if (words.some((w) => w.startsWith('schreib') || w === 'geschrieben') && words.includes('neu')) return true;
  if (!words.some((w) => WORDS.has(w))) return false;
  const rest = tokens(KEEP_PHRASES.reduce((s, re) => s.replace(re, ' keep '), clause));
  return rest.some((w) => CHANGE.has(w)) || !rest.some((w) => KEEP.has(w));
}

export function asksForLyrics(request: string): boolean {
  return request.toLowerCase().normalize('NFC').split(CLAUSE).some((c) => c && clauseAsks(c));
}
