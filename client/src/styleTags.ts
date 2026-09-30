/** ACE-Step caption → YuE2 style tags (PLAN.md "ANALYZE AUDIO on COVER · YUE2"). ACE-Step's
 * analysis describes a track in prose; upstream YuE2's `style` is comma-separated tags, voice
 * first ("warm female vocal, contemporary pop, piano, rounded electric bass, …"). Pure: a
 * vocabulary match, not a model call. Never emits tempo, key, meter or language — a cover's
 * score fixes the first three and VOCAL LANGUAGE is prefixed server-side. */
import {
  GENDERS, GENRE, GENRE_COMPOUND, INSTRUMENT, LANGUAGE_WORDS, MOODS, NEGATIONS, RAP_HEADS, VOCAL_TRAITS,
  VOICE_HEADS, VOICE_MODIFIERS, type Category,
} from './styleTagVocab';

type Kind = 'voice' | 'genre' | 'mood' | 'instrument' | 'trait';
interface Found { kind: Kind; tag: string; at: number }

/** Output order (upstream's) and how many of each a prompt keeps. */
const ORDER: Kind[] = ['voice', 'genre', 'mood', 'instrument', 'trait'];
const CAP: Record<Kind, number> = { voice: 1, genre: 2, mood: 2, instrument: 4, trait: 2 };
/** Voice words that say where a vocal sits in the mix, not what it sounds like. */
const PLACEMENT = new Set(['lead', 'layered', 'processed']);
const MAX_HEAD = 3;

const tokenize = (clause: string): string[] =>
  (clause.toLowerCase().match(/[a-z0-9&'+-]+/g) ?? []).map((t) => t.replace(/'s$/, '').replace(/^-+|-+$/g, ''))
    .filter(Boolean);

function headKind(phrase: string): Kind | null {
  if (VOICE_HEADS.has(phrase) || RAP_HEADS.has(phrase)) return 'voice';
  if (phrase in VOCAL_TRAITS) return 'trait';
  if (INSTRUMENT.heads.has(phrase)) return 'instrument';
  if (GENRE.heads.has(phrase) || (!phrase.includes(' ') && GENRE_COMPOUND.test(phrase))) return 'genre';
  return null;
}

/** Up to `max` words directly left of `start` that `allowed` accepts, nearest last. */
function modifiersBefore(tokens: string[], start: number, used: boolean[], allowed: (t: string) => boolean, max: number): number {
  let from = start;
  while (from > 0 && start - from < max && !used[from - 1] && allowed(tokens[from - 1])) from--;
  return from;
}

/** "warm female vocal", "aggressive male rap", "male and female vocals"; a bare "rap" is a
 * trait, and a bare "lead vocal" says nothing. `duet` is the gender before an "and". */
function voiceTag(mods: string[], head: string, duet: string): Omit<Found, 'at'> | null {
  const rap = RAP_HEADS.has(head);
  const gender = mods.find((m) => GENDERS.has(m)) ?? '';
  const adjs = mods.filter((m) => !GENDERS.has(m) && !PLACEMENT.has(m)).slice(-2);
  if (duet && gender) return { kind: 'voice', tag: `${duet} and ${gender} ${rap ? 'rap' : 'vocals'}` };
  if (gender || adjs.length) return { kind: 'voice', tag: [...adjs, gender, rap ? 'rap' : 'vocal'].filter(Boolean).join(' ') };
  return rap ? { kind: 'trait', tag: 'rap' } : null;
}

/** Phrases in one clause, found right to left because a phrase's head is its last word
 * ("synth bassline" is a bassline, not a synth followed by a stray word). */
function scanClause(tokens: string[], offset: number): Found[] {
  const used = tokens.map(() => false);
  const found: Found[] = [];
  for (let end = tokens.length; end > 0; end--) {
    for (let len = Math.min(MAX_HEAD, end); len > 0; len--) {
      const start = end - len;
      if (used.slice(start, end).some(Boolean)) continue;
      const phrase = tokens.slice(start, end).join(' ');
      const kind = headKind(phrase);
      if (!kind) continue;
      const allowed = kind === 'voice' ? (t: string) => VOICE_MODIFIERS.has(t) || GENDERS.has(t)
        : kind === 'trait' ? () => false : (t: string) => (kind === 'genre' ? GENRE : INSTRUMENT as Category).modifiers.has(t);
      let from = modifiersBefore(tokens, start, used, allowed, kind === 'voice' ? 3 : 2);
      const duet = kind === 'voice' && tokens[from - 1] === 'and' && GENDERS.has(tokens[from - 2] ?? '') ? tokens[from - 2] : '';
      const mods = tokens.slice(from, start);
      if (duet) from -= 2;
      for (let i = from; i < end; i++) used[i] = true;
      if (NEGATIONS.has(tokens[from - 1] ?? '') || NEGATIONS.has(tokens[from - 2] ?? '')) break;
      const hit = kind === 'voice' ? voiceTag(mods, phrase, duet)
        : { kind, tag: kind === 'trait' ? VOCAL_TRAITS[phrase] : tokens.slice(from, end).join(' ') };
      if (hit) found.push({ ...hit, at: offset + from });
      break;
    }
  }
  tokens.forEach((t, i) => { if (!used[i] && MOODS.has(t)) found.push({ kind: 'mood', tag: t, at: offset + i }); });
  return found;
}

const tagWords = (tag: string): string[] => tag.split(/[\s-]+/);
/** "guitar" says nothing "electric guitar" doesn't; "rock" nothing "pop-rock" doesn't. */
const within = (a: string, b: string): boolean => a !== b && tagWords(a).every((w) => tagWords(b).includes(w));

function pick(found: Found[]): string[] {
  const all = found.sort((a, b) => a.at - b.at).filter((f, i, xs) => xs.findIndex((x) => x.tag === f.tag) === i);
  const kept = all.filter((f) => !all.some((o) => within(f.tag, o.tag)));
  return ORDER.flatMap((kind) => kept.filter((f) => f.kind === kind).slice(0, CAP[kind]).map((f) => f.tag));
}

const NOT_STYLE = [
  /\b\d+(\.\d+)?\s*bpm\b|\bbpm\b|\btempo\b/i,
  /^[a-g][#b♯♭]?\s*(major|minor|maj|min|m)?$|\bkey\b|\b(major|minor)\b/i,
  /^\d+\/\d+(\s*time)?$|\btime signature\b/i,
];

/** A caption that is already short comma-separated tags keeps them, minus the ones a cover
 * can't use. Null when it reads as prose. */
function asTagList(caption: string): string[] | null {
  const parts = caption.split(/[,;\n]/).map((p) => p.trim().replace(/\.$/, '')).filter(Boolean);
  if (parts.length < 3 || parts.some((p) => p.split(/\s+/).length > 4 || /[.!?]/.test(p))) return null;
  return parts.filter((p) => !NOT_STYLE.some((re) => re.test(p)) && !LANGUAGE_WORDS.has(p.toLowerCase()));
}

/** The caption's style as YuE2 tags, most important first. Empty when nothing is recognised;
 * the caller then keeps the prose, which YuE2 also accepts. */
export function captionToStyleTags(caption: string): string[] {
  const listed = asTagList(caption);
  if (listed) return listed.slice(0, 10);
  let offset = 0;
  const found = caption.split(/[.,;:!?()"\n]|\s[—–-]\s/).flatMap((clause) => {
    const tokens = tokenize(clause);
    const hits = scanClause(tokens, offset);
    offset += tokens.length + 1;
    return hits;
  });
  return pick(found);
}
