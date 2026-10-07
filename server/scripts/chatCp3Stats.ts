/**
 * CP-C3-ONLY (pipeline checkpoint, scope.md CR-8; not app code, never imported by src/): the pure part
 * of chatCp3.ts. Per-reference records -> summary numbers -> the stop lines of architecture.md "Test
 * strategy (C3)" 6 -> summary.md. Stop: a reading of a file of 4 min or less over 4 min; the follow-up
 * turn p50 over 15 s or the planner not fully on the GPU; the score read ok on fewer than 2 of the
 * audio files; `reference_use` right on fewer than 8 of 10; a hand-off over 5 s.
 */
import { percentile, type CreateResult, type StopLine } from './chatCp0Stats.js';

export type Step = 'WORDS' | 'SCORE' | 'CAPTION';
export const STEPS: Step[] = ['WORDS', 'SCORE', 'CAPTION'];
export interface Progress { t: number; text: string }
export interface PsModel { name: string; size: number; size_vram: number }
export interface PsSample { t: number; models: PsModel[] }

export interface ReadingRecord {
  jobId: string; status: string; error: string | null;
  /** READ pressed -> the reading job running; running -> done. */
  handoffMs: number | null; readingMs: number | null;
  steps: Record<Step, number | null>;
  seconds: number | null; readTo: number | null; plan: Record<string, string> | null;
  words: string; score: string; caption: string;
  /** The score part read and parsed (facts present). */
  scoreOk: boolean; coverable: string;
}
export interface FollowRecord {
  jobId: string | null; action: string | null; cause: string | null; reasons: string[];
  /** Reading done -> the follow-up job running; reading done -> the reply written. */
  handoffMs: number | null; turnMs: number | null;
  promptTokens: Array<number | null>; unloadMs: number | null;
  vramBeforeMiB: number | null; plannerOnGpu: boolean | null; plannerVram: string | null;
  referenceUse: string | null; finalUse: string | null; borrowed: string[]; missing: string[]; note: string | null;
}
export interface Leg {
  id: string; source: 'yue2' | 'acestep' | 'upload' | 'named' | 'non-audio'; name: string; lang: string;
  expect: 'cover' | 'borrow' | 'refuse'; text: string;
  attach: { status: number; ms: number; reason: string | null };
  ask: { action: string | null; turnMs: number | null; reasons: string[] } | null;
  /** The first reply when it was not an analyze card and the script asked again (`--retry`). */
  firstAsk?: { action: string | null; turnMs: number | null; reasons: string[] };
  reading: ReadingRecord | null; followUp: FollowRecord | null; create?: CreateResult;
}

/** Progress samples of one reading -> ms spent in each step (first sight -> the next step's or `end`). */
export function stepDurations(samples: Progress[], end: number): Record<Step, number | null> {
  const firsts = STEPS.map((s) => samples.find((p) => p.text.startsWith(s))?.t ?? null);
  const out = {} as Record<Step, number | null>;
  STEPS.forEach((s, i) => {
    const from = firsts[i];
    out[s] = from === null ? null : (firsts.slice(i + 1).find((t): t is number => t !== null) ?? end) - from;
  });
  return out;
}

/** Ollama /api/ps samples inside [from, to] -> the planner fully on the GPU (null: never seen loaded). */
export function plannerOnGpu(samples: PsSample[], from: number, to: number): { on: boolean | null; vram: string | null } {
  const models = samples.filter((s) => s.t >= from && s.t <= to).flatMap((s) => s.models);
  if (!models.length) return { on: null, vram: null };
  const worst = models.reduce((a, b) => (b.size_vram / b.size < a.size_vram / a.size ? b : a));
  const gib = (b: number) => (b / 2 ** 30).toFixed(1);
  return { on: models.every((m) => m.size_vram >= m.size), vram: `${gib(worst.size_vram)} of ${gib(worst.size)} GiB on the GPU` };
}

export const judged = (l: Leg) => l.expect !== 'refuse';
export const useRight = (l: Leg) => judged(l) && l.followUp?.referenceUse === l.expect;
const nums = (xs: Array<number | null | undefined>) => xs.filter((x): x is number => typeof x === 'number' && Number.isFinite(x));
const maxOf = (xs: number[]) => (xs.length ? Math.max(...xs) : null);

export function summarize(legs: Leg[]) {
  const read = legs.filter((l) => l.reading);
  const audio = legs.filter((l) => l.source === 'acestep' || l.source === 'upload');
  const shortMax = maxOf(nums(read.filter((l) => (l.reading!.seconds ?? Infinity) <= 240).map((l) => l.reading!.readingMs)));
  return {
    legs: legs.length,
    readingMaxShortS: shortMax === null ? null : shortMax / 1000,
    followP50S: (percentile(nums(legs.map((l) => l.followUp?.turnMs)), 50) ?? NaN) / 1000,
    plannerOff: legs.filter((l) => l.followUp?.plannerOnGpu === false).map((l) => l.id),
    plannerSeen: legs.filter((l) => l.followUp?.plannerOnGpu !== null && l.followUp?.plannerOnGpu !== undefined).length,
    scoreOk: audio.filter((l) => l.reading?.scoreOk).length, audioFiles: audio.length,
    useRight: legs.filter(useRight).length, useJudged: legs.filter(judged).length,
    handoffs: {
      unload: maxOf(nums(legs.map((l) => l.followUp?.unloadMs))),
      read: maxOf(nums(legs.map((l) => l.reading?.handoffMs))),
      followUp: maxOf(nums(legs.map((l) => l.followUp?.handoffMs))),
      create: maxOf(nums(legs.map((l) => l.create?.handoffMs))),
    },
  };
}
export type Summary = ReturnType<typeof summarize>;

export function stopLines(s: Summary): StopLine[] {
  const sec = (ms: number | null) => (ms === null ? 'n/a' : `${(ms / 1000).toFixed(1)} s`);
  const h = s.handoffs;
  const worst = maxOf(nums([h.unload, h.read, h.followUp, h.create]));
  return [
    { verdict: s.readingMaxShortS === null ? 'NO DATA' : s.readingMaxShortS > 240 ? 'STOP' : 'PASS',
      text: `slowest reading of a file of 4 min or less: ${s.readingMaxShortS === null ? 'n/a' : `${s.readingMaxShortS.toFixed(1)} s`} (stop over 240 s)` },
    { verdict: Number.isNaN(s.followP50S) ? 'NO DATA' : s.followP50S > 15 || s.plannerOff.length ? 'STOP' : 'PASS',
      text: `follow-up turn p50 ${Number.isNaN(s.followP50S) ? 'n/a' : `${s.followP50S.toFixed(1)} s`}; planner not fully on the GPU in ${s.plannerOff.length} of ${s.plannerSeen} seen${s.plannerOff.length ? ` (${s.plannerOff.join(', ')})` : ''} (stop over 15 s or any)` },
    { verdict: s.audioFiles === 0 ? 'NO DATA' : s.scoreOk < Math.min(2, s.audioFiles) ? 'STOP' : 'PASS',
      text: `score read ok on ${s.scoreOk} of ${s.audioFiles} audio files (stop under 2)` },
    { verdict: s.useJudged === 0 ? 'NO DATA' : s.useRight < Math.ceil(0.8 * s.useJudged) ? 'STOP' : 'PASS',
      text: `reference_use right on ${s.useRight} of ${s.useJudged} (stop under 8 of 10)` },
    { verdict: worst === null ? 'NO DATA' : worst > 5000 ? 'STOP' : 'PASS',
      text: `worst hand-off ${sec(worst)}: unload-to-empty ${sec(h.unload)}, READ-to-reading ${sec(h.read)}, reading-to-follow-up ${sec(h.followUp)}, CREATE-to-take ${sec(h.create)} (stop over 5 s)` },
  ];
}

export function summaryMarkdown(s: Summary, legs: Leg[], meta: { server: string; date: string; note?: string }): string {
  const c = (x: unknown) => (x === null || x === undefined || x === '' ? '-' : String(x).replace(/\|/g, '/').replace(/\n/g, ' '));
  const s1 = (ms: number | null | undefined) => (ms === null || ms === undefined ? null : (ms / 1000).toFixed(1));
  const row = (cells: unknown[]) => `| ${cells.map(c).join(' | ')} |`;
  return [
    `# CP-C3, reference songs (${meta.date})`, '', `Server ${meta.server}. ${meta.note ?? ''}`.trim(), '',
    '## Stop lines', '', ...stopLines(s).map((l) => `- ${l.verdict} ${l.text}`), '',
    '## Readings', '',
    '| ref | source | file s | plan | READ->run s | reading s | WORDS s | SCORE s | CAPTION s | words | score | caption | coverable |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|',
    ...legs.filter((l) => l.reading).map((l) => { const r = l.reading!; return row([l.id, l.source, r.seconds === null ? null : Math.round(r.seconds),
      r.plan && Object.values(r.plan).join('/'), s1(r.handoffMs), s1(r.readingMs), s1(r.steps.WORDS), s1(r.steps.SCORE), s1(r.steps.CAPTION), r.words, r.score, r.caption, r.coverable]); }), '',
    '## Turns and reference_use', '',
    '| ref | lang | expect | first reply | ask reply | ask s | follow-up | ->run s | turn s | prompt tok | unload ms | VRAM before | planner | model use | final use | borrowed | missing | note | right |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|',
    ...legs.map((l) => { const f = l.followUp; return row([l.id, l.lang, l.expect, l.firstAsk ? `${l.firstAsk.action}: ${l.firstAsk.reasons[0] ?? ''}` : null, l.ask?.action ?? (l.attach.status >= 400 ? `attach ${l.attach.status}: ${l.attach.reason}` : null), s1(l.ask?.turnMs),
      f?.action, s1(f?.handoffMs), s1(f?.turnMs), f?.promptTokens.filter((t) => t !== null).join('/'), f?.unloadMs, f?.vramBeforeMiB, f?.plannerVram,
      f?.referenceUse, f?.finalUse, f?.borrowed.join(' '), f?.missing.join(' '), f?.note ?? f?.reasons[0], judged(l) ? (useRight(l) ? 'yes' : 'NO') : 'n/a']); }), '',
    '## CREATE COVER', '',
    ...legs.filter((l) => l.create).map((l) => `- ${l.id}: ${l.create!.outcome}${l.create!.reason ? ` (${l.create!.reason})` : ''}, hand-off ${l.create!.handoffMs ?? '-'} ms, take ${s1(l.create!.takeMs) ?? '-'} s, song ${l.create!.songId ?? '-'}, ${l.create!.seconds ?? '-'} s audio`), '',
  ].join('\n');
}
