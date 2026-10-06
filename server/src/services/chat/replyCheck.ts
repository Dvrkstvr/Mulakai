/**
 * One parsed turn reply -> a checked TurnReply or the reasons a retry sends back. Shape per action;
 * a recipe against recipeRules; an edit through the SCORE planner's own checkOps, then (when `apply`
 * is given) yue-server's apply and withLimits, reasons by applyReasons (all reused from score/).
 * Actions this version answers as a plain say are checked for shape only. Pure (I/O injected).
 */
import { applyReasons } from '../score/planAttempts.js';
import { checkOps } from '../score/opSchema.js';
import { withLimits } from '../score/scoreLimits.js';
import type { ApplyResult, Op, ScoreFacts } from '../score/planTypes.js';
import { SCALPEL_KINDS } from './actionSchema.js';
import { recipeProblems } from './recipeRules.js';
import type { LyricSection, Recipe, ScalpelKind, TurnAction, TurnReply } from './chatTypes.js';

export interface CheckContext {
  allowed: TurnAction[];
  /** Answered as a say in this version (turnActions.redirected): shape only. */
  shapeOnly: TurnAction[];
  facts: ScoreFacts | null;
  phraseBars: number;
}
export interface CheckDeps { apply?: (ops: Op[]) => Promise<ApplyResult> }
export type Checked = { ok: true; reply: TurnReply; applied: ApplyResult | null } | { ok: false; reasons: string[] };

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
  return { title, style, bpm, key, time_signature, language, engine, structure: [...structure], lyrics: sections };
}

async function checkEdit(json: Obj, message: string, assumptions: string[], ctx: CheckContext, deps: CheckDeps): Promise<Checked> {
  if (!Array.isArray(json.ops)) return fail('edit needs an ops list');
  const reply = (ops: Op[]): TurnReply => ({ action: 'edit', message, assumptions, ops });
  if (ctx.shapeOnly.includes('edit')) return { ok: true, reply: reply(json.ops as Op[]), applied: null };
  if (!ctx.facts) return fail('there is no song to edit yet: propose a recipe for a new song instead');
  const ops = checkOps({ ops: json.ops }, ctx.facts, ctx.phraseBars);
  if (!ops.ok) return fail(...ops.reasons);
  if (!deps.apply) return { ok: true, reply: reply(ops.ops), applied: null };
  const applied = withLimits(await deps.apply(ops.ops), { ops: ops.ops, sections: ctx.facts.sections });
  return applied.ok ? { ok: true, reply: reply(ops.ops), applied } : fail(...applyReasons(applied));
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
    case 'say': return { ok: true, reply: { action, message }, applied: null };
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
