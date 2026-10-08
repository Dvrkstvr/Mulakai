/**
 * One parsed turn reply -> a checked TurnReply or the reasons a retry sends back. Shape per action;
 * a recipe against recipeRules; an edit through the SCORE planner's own checkOps, then (when `apply`
 * is given) yue-server's apply and withLimits, reasons by applyReasons (all reused from score/).
 * Actions this version answers as a plain say are checked for shape only. SP-5's three guards
 * (replyGuards): an edit of a section the song lacks, a say naming another key than the HEADER's,
 * a rewritten lyric block in another language (only after an apply). C2 (F-058, D-227): with a pending plan an
 * edit is a revise, `{drop, ops}` read and merged by reviseReply.readRevise; a mark bounds only the returned ops
 * (D-214); the merged plan is applied once, and a refused apply goes back with the merge legend first. A drop that loses
 * pending ops on a request with no removal words goes back once (reviseKeep, CP-C2 r2). Pure (I/O injected).
 */
import { applyReasons } from '../score/planAttempts.js';
import { checkOps } from '../score/opSchema.js';
import { readRevise } from '../score/reviseReply.js';
import { withLimits } from '../score/scoreLimits.js';
import type { ApplyResult, Op, ScoreFacts, Since } from '../score/planTypes.js';
import { SCALPEL_KINDS } from './actionSchema.js';
import { markFit } from './markFit.js';
import { recipeProblems } from './recipeRules.js';
import { keepReason } from './reviseKeep.js';
import { lyricLanguageReasons, missingSectionReasons, sayKeyReasons, type DetectLanguage } from './replyGuards.js';
import type { LyricSection, Recipe, ScalpelKind, TurnAction, TurnReply } from './chatTypes.js';

export interface CheckContext {
  allowed: TurnAction[];
  /** Answered as a say in this version (turnActions.redirected): shape only. */
  shapeOnly: TurnAction[];
  facts: ScoreFacts | null;
  phraseBars: number;
  /** The person's request (the missing-section guard reads it). */
  request: string;
  /** C1 (D-176): the mark's bars; an edit outside them is retried (markFit). */
  markRange?: [number, number] | null;
  /** The person asked for the whole song (asksWholeSong): a whole-song op under a mark is allowed (C1 live B2). */
  markWhole?: boolean;
  /** C2 (F-058): the pending plan's ops this turn revises; absent = a fresh plan. */
  pending?: Op[];
  /** CP-C2 r2: the additive-drop guard is unspent (reviseKeep; turnCall spends it on its first refusal). */
  keepGuard?: boolean;
}
export interface CheckDeps { apply?: (ops: Op[]) => Promise<ApplyResult>; language?: DetectLanguage }
/** `revised`: a revise's NEW / CHANGED / SAME per merged op and the REMOVED pending ops (the card's `since`). */
export type Revised = Omit<Since, 'planId'>;
export type Checked = { ok: true; reply: TurnReply; applied: ApplyResult | null; revised?: Revised } | { ok: false; reasons: string[] };

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const strs = (v: unknown): v is string[] => Array.isArray(v) && v.every(isStr);
const fail = (...reasons: string[]): Checked => ({ ok: false, reasons });

function recipeOf(v: unknown): Recipe | string {
  if (!isObj(v)) return 'recipe is missing';
  const bad = ['title', 'style', 'key', 'time_signature', 'language', 'engine'].filter((k) => !isStr(v[k]));
  if (typeof v.bpm !== 'number') bad.push('bpm');
  if (!strs(v.structure)) bad.push('structure');
  const lyrics = Array.isArray(v.lyrics) && v.lyrics.every((s) => isObj(s) && isStr(s.tag) && strs(s.lines));
  if (!lyrics) bad.push('lyrics');
  if (bad.length) return `recipe fields missing or mistyped: ${bad.join(', ')}`;
  const { title, style, bpm, key, time_signature, language, engine, structure } = v as unknown as Recipe;
  const sections = (v.lyrics as LyricSection[]).map((s) => ({ tag: s.tag, lines: [...s.lines] }));
  const use = (['cover', 'borrow', 'none'] as const).find((u) => u === v.reference_use); // C3 (D-128): kept when valid
  return { title, style, bpm, key, time_signature, language, engine, structure: [...structure], lyrics: sections, ...(use ? { reference_use: use } : {}) };
}

async function checkEdit(json: Obj, message: string, assumptions: string[], ctx: CheckContext, deps: CheckDeps): Promise<Checked> {
  if (!Array.isArray(json.ops)) return fail('edit needs an ops list');
  const reply = (ops: Op[]): TurnReply => ({ action: 'edit', message, assumptions, ops });
  const missing = ctx.facts ? missingSectionReasons(ctx.request, ctx.facts) : [];
  if (missing.length) return fail(...missing);
  if (ctx.shapeOnly.includes('edit')) return { ok: true, reply: reply(json.ops as Op[]), applied: null };
  if (!ctx.facts) return fail('there is no song to edit yet: propose a recipe for a new song instead');
  const revised = ctx.pending ? readRevise(json, ctx.pending, ctx.facts, ctx.phraseBars) : null;
  const read = revised ?? checkOps({ ops: json.ops }, ctx.facts, ctx.phraseBars);
  if (!read.ok) return fail(...read.reasons);
  const returned = ctx.pending ? checkOps({ ops: json.ops }, ctx.facts, ctx.phraseBars, 0) : read; // a mark bounds these only (D-214)
  const outside = ctx.markRange && returned.ok ? markFit(returned.ops, ctx.markRange, ctx.facts, ctx.markWhole).reasons : [];
  if (outside.length) return fail(...outside);
  const keep = ctx.keepGuard && ctx.pending && revised?.ok && returned.ok ? keepReason(ctx.request, ctx.pending, json.drop as number[], returned.ops) : null;
  if (keep) return fail(keep);
  const revise = revised?.ok ? { legend: [revised.legend], revised: { marks: revised.merged.marks, removed: revised.merged.removed } } : null;
  const done = (applied: ApplyResult | null): Checked => ({ ok: true, reply: reply(read.ops), applied, ...(revise ? { revised: revise.revised } : {}) });
  if (!deps.apply) return done(null);
  const applied = withLimits(await deps.apply(read.ops), { ops: read.ops, sections: ctx.facts.sections, blocks: ctx.facts.lyric_blocks });
  if (!applied.ok) return fail(...(revise?.legend ?? []), ...applyReasons(applied));
  const language = deps.language ? await lyricLanguageReasons(applied, deps.language) : [];
  return language.length ? fail(...language) : done(applied);
}

export async function checkReply(json: unknown, ctx: CheckContext, deps: CheckDeps): Promise<Checked> {
  if (!isObj(json) || !isStr(json.action)) return fail('the reply is not a JSON object {"action": ...}');
  const action = json.action as TurnAction;
  if (!ctx.allowed.includes(action)) return fail(`action "${json.action}" is not one of ${ctx.allowed.join(', ')}`);
  if (!isStr(json.message) || !json.message.trim()) return fail('message is missing');
  const { message } = json;
  const assumptions = strs(json.assumptions) ? [...json.assumptions] : [];
  const shapeOnly = ctx.shapeOnly.includes(action);
  switch (action) {
    case 'say': {
      const key = ctx.facts ? sayKeyReasons(message, ctx.facts) : [];
      return key.length ? fail(...key) : { ok: true, reply: { action, message }, applied: null };
    }
    case 'ask':
      if (!strs(json.choices) || json.choices.length < 2 || json.choices.length > 4) return fail('ask needs 2-4 choices');
      return { ok: true, reply: { action, message, choices: [...json.choices] }, applied: null };
    case 'recipe': {
      const recipe = recipeOf(json.recipe);
      if (isStr(recipe)) return fail(recipe);
      const problems = shapeOnly ? [] : recipeProblems(recipe);
      return problems.length ? fail(...problems) : { ok: true, reply: { action, message, assumptions, recipe }, applied: null };
    }
    case 'edit': return checkEdit(json, message, assumptions, ctx, deps);
    case 'scalpel': {
      if (!SCALPEL_KINDS.includes(json.kind as ScalpelKind)) return fail(`scalpel kind "${String(json.kind)}" is not one of ${SCALPEL_KINDS.join(', ')}`);
      const reply: TurnReply = { action, message, kind: json.kind as ScalpelKind, target: isStr(json.target) ? json.target : '', details: isStr(json.details) ? json.details : '' };
      return { ok: true, reply, applied: null };
    }
    case 'analyze':
      return { ok: true, reply: { action, message, reference: isStr(json.reference) ? json.reference : '', plan: isStr(json.plan) ? json.plan : '' }, applied: null };
    default: return fail(`action "${String(action)}" is not one of ${ctx.allowed.join(', ')}`);
  }
}
