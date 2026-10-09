/**
 * One parsed turn reply -> a checked TurnReply or the reasons a retry sends back. Shape per action;
 * a recipe against recipeRules' planner fields (LD: its lines come after, from the lyrics call, so the
 * recipe comes back with no lines for turnCall); an edit through the SCORE
 * planner's own checkOps, then (when `apply` is given) yue-server's apply and withLimits, reasons by applyReasons (all reused from score/).
 * Actions this version answers as a plain say are checked for shape only. SP-5's three guards
 * (replyGuards): an edit of a section the song lacks, a say naming another key than the HEADER's,
 * a rewritten lyric block in another language (only after an apply). C2 (F-058, D-227): with a pending plan an
 * edit is a revise, `{drop, ops}` read and merged by reviseReply.readRevise; a mark bounds only the returned ops
 * (D-214); the merged plan is applied once, and a refused apply goes back with the merge legend first. A drop that loses
 * pending ops on an addition, or a start over that returns one unchanged, goes back once (reviseKeep, CP-C2); a start over
 * drops every pending op in code (C2 live B2), one returned unchanged too, and if nothing is left plans nothing (D-257).
 * Pure (I/O injected).
 */
import { applyReasons } from '../score/planAttempts.js';
import { checkOps } from '../score/opSchema.js';
import { readRevise } from '../score/reviseReply.js';
import { sameOp } from '../score/planRevise.js';
import { withLimits } from '../score/scoreLimits.js';
import type { ApplyResult, Op, ScoreFacts, Since } from '../score/planTypes.js';
import { SCALPEL_KINDS } from './actionSchema.js';
import { markFit } from './markFit.js';
import { plannedProblems } from './recipeRules.js';
import { reviseGuard, startsOver } from './reviseKeep.js';
import { lyricLanguageReasons, missingSectionReasons, sayKeyReasons, type DetectLanguage } from './replyGuards.js';
import type { Recipe, ScalpelKind, TurnAction, TurnReply } from './chatTypes.js';

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
  /** CP-C2: the reason heads of the unspent drop guards (reviseKeep; turnCall spends each on its first refusal). */
  guards?: string[];
}
export interface CheckDeps { apply?: (ops: Op[]) => Promise<ApplyResult>; language?: DetectLanguage }
/** `revised`: a revise's NEW / CHANGED / SAME per merged op and the REMOVED pending ops (the card's `since`). */
export type Revised = Omit<Since, 'planId'>;
/** A recipe's `recipe.lyrics` is empty until turnCall fills it (LD). */
/** `scrapped` (D-257): a start over left nothing to plan; the reply is a say and the pending plan goes. */
export type Checked = { ok: true; reply: TurnReply; applied: ApplyResult | null; revised?: Revised; scrapped?: true } | { ok: false; reasons: string[] };

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
  if (bad.length) return `recipe fields missing or mistyped: ${bad.join(', ')}`;
  const { title, style, bpm, key, time_signature, language, engine, structure } = v as unknown as Recipe;
  const use = (['cover', 'borrow', 'none'] as const).find((u) => u === v.reference_use); // C3 (D-128): kept when valid
  const vocals = (['sung', 'instrumental'] as const).find((x) => x === v.vocals); // F-097: kept when valid; turnLyrics settles it
  return { title, style, bpm, key, time_signature, language, engine, structure: [...structure], lyrics: [], ...(vocals ? { vocals } : {}), ...(use ? { reference_use: use } : {}) };
}

async function checkEdit(json: Obj, message: string, assumptions: string[], ctx: CheckContext, deps: CheckDeps): Promise<Checked> {
  if (!Array.isArray(json.ops)) return fail('edit needs an ops list');
  const reply = (ops: Op[]): TurnReply => ({ action: 'edit', message, assumptions, ops });
  const missing = ctx.facts ? missingSectionReasons(ctx.request, ctx.facts) : [];
  if (missing.length) return fail(...missing);
  if (ctx.shapeOnly.includes('edit')) return { ok: true, reply: reply(json.ops as Op[]), applied: null };
  if (!ctx.facts) return fail('there is no song to edit yet: propose a recipe for a new song instead');
  // C2 live B2: a start over drops every pending op, whatever the reply's drop says; what it returns is the plan (REMOVED shown).
  // D-257 (N1): a pending op it returns unchanged is scrapped too, once the start-over guard has sent it back; nothing left = a say
  const over = ctx.pending && startsOver(ctx.request) ? ctx.pending : null;
  const all = over?.map((_, k) => k + 1) ?? [];
  const fresh = over ? json.ops.filter((o) => !over.some((p) => sameOp(p, o as Op))) : json.ops;
  if (over && !fresh.length) {
    const guard = ctx.guards?.length ? reviseGuard(ctx.request, over, all, json.ops as Op[], ctx.guards) : null;
    return guard ? fail(guard) : { ok: true, reply: { action: 'say', message }, applied: null, scrapped: true };
  }
  const asked = over ? { ...json, drop: all, ops: fresh } : json;
  const revised = ctx.pending ? readRevise(asked, ctx.pending, ctx.facts, ctx.phraseBars) : null;
  const read = revised ?? checkOps({ ops: json.ops }, ctx.facts, ctx.phraseBars);
  if (!read.ok) return fail(...read.reasons);
  const returned = ctx.pending ? checkOps({ ops: json.ops }, ctx.facts, ctx.phraseBars, 0) : read; // a mark bounds these only (D-214)
  const outside = ctx.markRange && returned.ok ? markFit(returned.ops, ctx.markRange, ctx.facts, ctx.markWhole).reasons : [];
  if (outside.length) return fail(...outside);
  const keep = ctx.guards?.length && ctx.pending && revised?.ok && returned.ok ? reviseGuard(ctx.request, ctx.pending, asked.drop as number[], returned.ops, ctx.guards) : null;
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
      const read = recipeOf(json.recipe);
      if (isStr(read)) return fail(read);
      const problems = shapeOnly ? [] : plannedProblems(read);
      return problems.length ? fail(...problems) : { ok: true, reply: { action, message, assumptions, recipe: read }, applied: null };
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
