import type { LyricTag } from './api';

/** A group of near-duplicate tags collapsed under one label — e.g. "Vocal ad-lib: Woo!" and
 * "Vocal ad-libs: Rrrra!" both become one "Vocal ad-lib" entry with both as examples, instead
 * of two rows that only differ by filler text. */
export interface Cluster {
  label: string;
  count: number;
  examples: string[];
}

export interface TagGuide {
  structure: Cluster[];
  vocalDelivery: Cluster[];
  transitions: Cluster[];
  languageCodes: LyricTag[];
  instrumentation: Cluster[];
}

/** Bundled-example artifacts like "0:29" — a timing note from one specific sample, not a
 * reusable annotation convention. */
const TIMESTAMP_RE = /^\d{1,2}:\d{2}$/;

/** Bare two-letter tags like [en]/[ko] — observed correlating with multilingual seed queries
 * (K-pop, etc.), consistent with marking a language switch mid-lyric. Not confirmed by any
 * ACE-Step doc, so the guide hedges this rather than asserting it. */
const LANGUAGE_CODE_RE = /^[a-z]{2}$/i;

const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());
const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Clusters tags whose text STARTS WITH one of `bases` (longest match wins), merging variants
 * like "ad-lib"/"ad-libs" under one canonical label. Leftover text after the base becomes an
 * example (pure numbers, e.g. "Verse 1"'s "1", are dropped — that's numbering, not content). */
function clusterByPrefix(tags: LyricTag[], bases: [string, string][]): { clusters: Cluster[]; unmatched: LyricTag[] } {
  const sorted = [...bases].sort((a, b) => b[0].length - a[0].length);
  const map = new Map<string, Cluster>();
  const unmatched: LyricTag[] = [];
  for (const t of tags) {
    const lower = t.tag.toLowerCase().trim();
    const hit = sorted.find(([base]) => {
      if (lower === base) return true;
      const next = lower[base.length];
      return lower.startsWith(base) && (next === undefined || /[\s:,-]/.test(next));
    });
    if (!hit) { unmatched.push(t); continue; }
    const [base, label] = hit;
    const cluster = map.get(label) ?? { label, count: 0, examples: [] };
    cluster.count += t.count;
    const remainder = clean(t.tag.trim().slice(base.length).replace(/^[\s:,-]+/, ''));
    if (remainder && !/^\d+$/.test(remainder)) cluster.examples.push(clean(t.tag));
    map.set(label, cluster);
  }
  return { clusters: [...map.values()], unmatched };
}

/** Clusters tags whose text ENDS WITH `suffixRe` into one `label` bucket — e.g. every
 * "___ fades out" variant becomes one "Fades Out" entry, subjects listed as examples. */
function clusterBySuffix(tags: LyricTag[], suffixRe: RegExp, label: string): { clusters: Cluster[]; unmatched: LyricTag[] } {
  const matched: LyricTag[] = [];
  const unmatched: LyricTag[] = [];
  for (const t of tags) (suffixRe.test(t.tag.trim()) ? matched : unmatched).push(t);
  if (!matched.length) return { clusters: [], unmatched };
  const cluster: Cluster = { label, count: 0, examples: [] };
  for (const t of matched) {
    cluster.count += t.count;
    const subject = clean(t.tag.trim().replace(suffixRe, ''));
    if (subject) cluster.examples.push(clean(t.tag));
  }
  return { clusters: [cluster], unmatched };
}

/** Loosest pass: buckets remaining tags by whichever instrument/section keyword they mention
 * first (priority order), so "Instrumentation & FX" reads as a handful of categories instead
 * of a 30+ row wall of one-off descriptions. Ungrouped tags stay individually visible under
 * their own label rather than being silently merged away. */
function clusterByKeyword(tags: LyricTag[], buckets: [string[], string][], fallbackLabel: string): Cluster[] {
  const map = new Map<string, Cluster>();
  // Most-frequent tag first, so a cluster's examples lead with its canonical member
  // ("Guitar Solo", 17x) rather than a one-off verbose phrase that merely sorts longer.
  for (const t of [...tags].sort((a, b) => b.count - a.count)) {
    const lower = t.tag.toLowerCase();
    const hit = buckets.find(([keywords]) => keywords.some((k) => lower.includes(k)));
    const label = hit ? hit[1] : fallbackLabel;
    const cluster = map.get(label) ?? { label, count: 0, examples: [] };
    cluster.count += t.count;
    cluster.examples.push(t.tag);
    map.set(label, cluster);
  }
  return [...map.values()];
}

/** `byFrequency: true` keeps clusterByKeyword's most-common-first example order; otherwise
 * (structure/vocal/transition combos) longest-first surfaces the most descriptive example. */
const finalizeClusters = (clusters: Cluster[], exampleCap = 4, byFrequency = false) =>
  clusters
    .map((c) => {
      const deduped = [...new Set(c.examples)];
      const examples = byFrequency ? deduped : deduped.sort((a, b) => b.length - a.length);
      return { ...c, examples: examples.slice(0, exampleCap) };
    })
    .sort((a, b) => b.count - a.count);

const STRUCTURE_BASES: [string, string][] = [
  ['pre-chorus', 'Pre-Chorus'], ['post-chorus', 'Post-Chorus'], ['final chorus', 'Final Chorus'],
  ['final drop', 'Final Drop'], ['turntable break', 'Turntable Break'],
  ['instrumental break', 'Instrumental Break'], ['instrumental solo', 'Instrumental Solo'],
  ['instrumental intro', 'Instrumental Intro'], ['instrumental outro', 'Instrumental Outro'],
  ['instrumental drop', 'Instrumental Drop'], ['instrumental', 'Instrumental'],
  ['build-up', 'Build-Up'], ['buildup', 'Build-Up'],
  ['intro', 'Intro'], ['verse', 'Verse'], ['chorus', 'Chorus'], ['bridge', 'Bridge'],
  ['outro', 'Outro'], ['hook', 'Hook'], ['build', 'Build-Up'], ['drop', 'Drop'],
  ['breakdown', 'Breakdown'], ['interlude', 'Interlude'],
];

const VOCAL_BASES: [string, string][] = [
  ['vocal ad-libs', 'Vocal Ad-lib'], ['vocal ad-lib', 'Vocal Ad-lib'],
  ['vocalizing', 'Vocalizing'], ['screamed vocals', 'Screamed'], ['screamed', 'Screamed'],
  ['whispered', 'Whispered'], ['shouted', 'Shouted'], ['spoken', 'Spoken'],
  ['a cappella', 'A Cappella'], ['male lead', 'Male Lead'], ['female lead', 'Female Lead'],
  ['choir', 'Choir'], ['rap verse', 'Rap Verse'],
];

const TRANSITION_MARKERS = ['ends abruptly', 'final chord', 'cymbal crash', 'crescendo'];

const INSTRUMENT_BUCKETS: [string[], string][] = [
  [['guitar'], 'Guitar'],
  [['synth'], 'Synth / Electronic'],
  [['piano'], 'Piano / Keys'],
  [['brass', 'orchestral', 'string', 'fanfare'], 'Brass / Orchestral'],
  [['beat', 'drum', 'breakbeat'], 'Drums / Beat'],
  [['dj', 'scratch', 'turntable'], 'DJ / Turntable'],
];

/** Groups the raw probed tag list into a small set of teachable categories instead of a flat
 * 200-entry list — most of the long tail is the same handful of concepts wearing different
 * filler text ("Vocal ad-lib: Woo!" vs "Vocal ad-lib: Rrrra!"), not distinct vocabulary. */
export function buildTagGuide(tags: LyricTag[]): TagGuide {
  const withoutNoise = tags.filter((t) => !TIMESTAMP_RE.test(t.tag.toLowerCase().trim()));

  const { clusters: structureRaw, unmatched: afterStructure } = clusterByPrefix(withoutNoise, STRUCTURE_BASES);

  const vocalCandidates: LyricTag[] = [];
  const rest1: LyricTag[] = [];
  for (const t of afterStructure) {
    const lower = t.tag.toLowerCase();
    (VOCAL_BASES.some(([base]) => lower.includes(base)) ? vocalCandidates : rest1).push(t);
  }
  const { clusters: vocalRaw, unmatched: vocalUnmatched } = clusterByPrefix(vocalCandidates, VOCAL_BASES);
  // A vocal marker embedded mid-string (not at the start) won't prefix-match — fall back to
  // treating the whole tag as its own single-item cluster rather than dropping it.
  const vocalFallback = vocalUnmatched.map((t) => ({ label: titleCase(t.tag), count: t.count, examples: [] as string[] }));

  const transitionCandidates: LyricTag[] = [];
  const rest2: LyricTag[] = [];
  for (const t of rest1) {
    const lower = t.tag.toLowerCase();
    (lower.includes('fade') || TRANSITION_MARKERS.some((m) => lower.includes(m)) ? transitionCandidates : rest2).push(t);
  }
  const { clusters: fadeClusters, unmatched: afterFade } = clusterBySuffix(transitionCandidates, /\bfades?\s+out\.?$/i, 'Fades Out');
  const { clusters: finalHitClusters, unmatched: transitionLeftover } = clusterByPrefix(
    afterFade,
    [['final', 'Final Chord / Crash'], ['song ends abruptly', 'Ends Abruptly']],
  );
  const transitionFallback = transitionLeftover.map((t) => ({ label: titleCase(t.tag), count: t.count, examples: [] as string[] }));

  const languageCodes: LyricTag[] = [];
  const rest3: LyricTag[] = [];
  for (const t of rest2) (LANGUAGE_CODE_RE.test(t.tag.trim()) ? languageCodes : rest3).push(t);

  const instrumentation = clusterByKeyword(rest3, INSTRUMENT_BUCKETS, 'Other');

  return {
    structure: finalizeClusters(structureRaw, 3),
    vocalDelivery: finalizeClusters([...vocalRaw, ...vocalFallback]),
    transitions: finalizeClusters([...fadeClusters, ...finalHitClusters, ...transitionFallback]),
    languageCodes: languageCodes.sort((a, b) => b.count - a.count),
    instrumentation: finalizeClusters(instrumentation, 6, true),
  };
}
