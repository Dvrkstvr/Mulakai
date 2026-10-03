/**
 * YuE2 (PLAN.md "Engine: YuE2"): an optional first-take engine, reached through
 * `yue-server/` (or a YuE2-Turbo `yue2-serve`) at YUE_API_URL. The descriptor drives
 * the Create UI's gating; `toRequest` maps Create fields onto the `POST /v1/jobs` body.
 */
import crypto from 'node:crypto';
import { config } from '../../config.js';
import { readAbcMeta } from './abcMeta.js';
import type { CreateFields, EngineCapabilities, SongEngine } from './types.js';

export const YUE2_CAPABILITIES: EngineCapabilities = {
  duration: 'none', // length follows the model's own score plan
  musicalMeta: 'style-text',
  referenceAudio: false,
  adapters: false,
  seed: true,
  languages: ['en', 'zh'],
  // Not a closed vocabulary: the tags upstream documents plus those the spike sang.
  sectionTags: ['Intro', 'Verse', 'Pre-Chorus', 'Chorus', 'Bridge', 'Outro'],
  lmTools: false,
  advanced: false,
  takes: false,
  instrumental: true, // blank LYRICS: a tags-only skeleton plus instrumental style (buildYue2Request)
  // CFG is YuE2's own control, not ACE-Step's GUIDANCE: YuE2's neutral value is 1.0,
  // so a persisted GUIDANCE of ~7 would silently apply heavy CFG (PLAN.md, yue-engine).
  extraControls: ['cfg', 'cot'],
  consequence: 'YuE2 · no duration control, no reference voice, no section strip · '
    + '~95 s per 3-minute song on an RTX 4080 · later edits use ACE-Step',
};

/** Blank lyrics still get a sung line from YuE2's planner; section tags alone plan no
 * vocal notes (PLAN.md, YuE2 spike follow-up checks). yue2-serve also rejects blanks. */
export const INSTRUMENTAL_LYRICS = '[Intro]\n\n[Verse]\n\n[Chorus]\n\n[Verse]\n\n[Chorus]\n\n[Outro]\n';
/** Upstream's instrumental style wording (skills/yue2-music/instrumental). yue-server also
 * moves any planned vocal notes to the instrument voice (PLAN.md, "YuE2: Align With
 * Upstream's `yue2-music` Skill"); a yue2-serve backend has only this text to go on. */
export const INSTRUMENTAL_CONDITIONS = ['no vocals', 'no singing', 'no choir', 'no spoken words'];

/** VOCAL LANGUAGE leads the style, as upstream writes it ("English, warm female vocal, …"). */
const LANGUAGE_NAMES: Record<string, string> = { en: 'English', zh: 'Chinese' };

/** Create stores a meter as its numerator (client songMeta.ts). */
const METER_TEXT: Record<string, string> = { '2': '2/4', '3': '3/4', '4': '4/4', '6': '6/8' };

/** YuE2's own default seed is a fixed 831001, so a seed is always sent. */
const randomSeed = (): number => crypto.randomInt(0, 2 ** 32);

function meterText(value: string | undefined): string {
  const v = value?.trim() ?? '';
  return /^\d+\/\d+$/.test(v) ? v : METER_TEXT[v] ?? '';
}

/** BPM / KEY / TIME SIGNATURE reach YuE2 only as style text, and only when not AUTO. */
function styleHints(fields: CreateFields): string[] {
  const hints: string[] = [];
  if (fields.bpm !== undefined && fields.bpm > 0) hints.push(`${Math.round(fields.bpm)} bpm`);
  if (fields.key_scale?.trim()) hints.push(fields.key_scale.trim());
  const meter = meterText(fields.time_signature);
  if (meter) hints.push(`${meter} time`);
  return hints;
}

function instrumentalStyle(prompt: string, hints: string[]): string[] {
  const conditions = INSTRUMENTAL_CONDITIONS.filter((c) => !prompt.toLowerCase().includes(c));
  return [/^instrumental\b/i.test(prompt) ? '' : 'Instrumental', prompt, ...hints, ...conditions];
}

function chooseSeed(fields: CreateFields, random: () => number): number {
  const fixed = fields.use_random_seed === false && fields.seed !== undefined && fields.seed >= 0;
  return fixed ? Math.min(Math.floor(fields.seed!), Number.MAX_SAFE_INTEGER) : random();
}

export function buildYue2Request(fields: CreateFields, random: () => number = randomSeed): Record<string, unknown> {
  const instrumental = !fields.lyrics?.trim();
  const prompt = fields.prompt?.trim() ?? '';
  const style = (instrumental ? instrumentalStyle(prompt, styleHints(fields))
    : [LANGUAGE_NAMES[fields.vocal_language ?? ''], prompt, ...styleHints(fields)])
    .filter(Boolean).join(', ');
  // Both wrappers 422 a blank style; say why in Create's terms instead.
  if (!style) throw new Error('YUE2 needs a PROMPT: it has no default style');
  const request: Record<string, unknown> = {
    style,
    lyrics: instrumental ? INSTRUMENTAL_LYRICS : fields.lyrics,
    seed: chooseSeed(fields, random),
  };
  if (fields.cfg !== undefined) request.cfg_scale = Math.min(20, Math.max(0, fields.cfg));
  if (fields.cot) request.cot = fields.cot;
  return request;
}

/** COVER on YUE2: the source score fixes tempo, key and meter, so BPM / KEY / TIME SIGNATURE
 * hints are dropped rather than argue with it, and `cot` is `melody` so the accompaniment
 * is free (point 5). Empty lyrics still send the tags-only skeleton: yue-server then moves
 * the score's vocal line to an instrument and sings nothing. */
export function buildYue2CoverRequest(fields: CreateFields, abc: string, random: () => number = randomSeed): Record<string, unknown> {
  const { bpm: _bpm, key_scale: _key, time_signature: _meter, ...rest } = fields;
  return { ...buildYue2Request({ ...rest, cot: 'melody' }, random), abc };
}

export const yue2Engine: SongEngine = {
  id: 'yue2',
  label: 'YUE2',
  url: config.yueUrl.replace(/\/+$/, ''),
  apiKey: config.yueApiKey,
  capabilities: YUE2_CAPABILITIES,
  toRequest: (fields) => buildYue2Request(fields),
  toCoverRequest: (fields, abc) => buildYue2CoverRequest(fields, abc),
  readMeta: ({ score }) => readAbcMeta(score),
};
