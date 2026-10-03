/** Create's per-engine gating, derived from the engine's static descriptor (PLAN.md
 * "Engine picker UI decisions"). Pure, so the rules are unit-testable without a DOM. A null
 * engine means ACE-Step, the built-in one, where nothing is gated. */
import type { EngineCapabilities, EngineInfo } from './api';
import { VOCAL_LANGUAGES } from './songMeta';

/** Create fields that some engines can't take. */
export type GatedField = 'duration' | 'bpm' | 'keyScale' | 'timeSignature' | 'vocalLanguage' | 'takes' | 'instrumental';

type Engine = Pick<EngineInfo, 'label' | 'capabilities'>;

/** The control stays in place but shows N/A and is disabled. */
export function unsupported(field: GatedField, caps: EngineCapabilities | null): boolean {
  if (!caps) return false;
  switch (field) {
    case 'duration': return caps.duration === 'none';
    case 'bpm': case 'keyScale': case 'timeSignature': return caps.musicalMeta === 'none';
    // A style-text engine takes the language as style text too (YuE2: "English, …").
    case 'vocalLanguage': return caps.languages !== 'any' && caps.musicalMeta !== 'style-text';
    case 'takes': return !caps.takes;
    case 'instrumental': return !caps.instrumental;
  }
}

/** VOCAL LANGUAGE's options: AUTO plus the languages the engine sings. */
export function languageOptions(caps: EngineCapabilities | null): typeof VOCAL_LANGUAGES {
  const listed = caps?.languages;
  return !listed || listed === 'any' ? VOCAL_LANGUAGES : VOCAL_LANGUAGES.filter((o) => !o.value || listed.includes(o.value));
}

/** A language left over from another engine that this one doesn't sing counts as AUTO. */
export function liveLanguage(value: string, caps: EngineCapabilities | null): string {
  if (unsupported('vocalLanguage', caps)) return '';
  return languageOptions(caps).some((o) => o.value === value) ? value : '';
}

/** DURATION's readout: HeartMuLa-style engines take it as a ceiling. */
export function durationReadout(seconds: number, caps: EngineCapabilities | null): string {
  if (caps?.duration === 'none') return 'N/A';
  if (!seconds) return 'AUTO';
  return caps?.duration === 'max' ? `MAX ${seconds}s` : `${seconds}s`;
}

/** One line per gated or reinterpreted SONG DETAILS control, shown under the grid. */
export function songDetailNotes(engine: Engine | null): string[] {
  if (!engine) return [];
  const { label: l, capabilities: c } = engine;
  const notes: string[] = [];
  if (c.duration === 'none') notes.push(`DURATION — ${l} sets the length from the song it plans`);
  if (c.duration === 'max') notes.push(`DURATION — a cap for ${l}, not a target; it may end sooner`);
  if (c.musicalMeta === 'none') notes.push(`BPM, KEY / SCALE, TIME SIGNATURE — ${l} takes none of them`);
  if (c.musicalMeta === 'style-text') {
    notes.push(`BPM, KEY / SCALE, TIME SIGNATURE, VOCAL LANGUAGE — sent to ${l} as style text, a hint rather than a guarantee`);
  }
  if (c.languages !== 'any') notes.push(`VOCAL LANGUAGE — ${l} sings ${c.languages.join(', ')}, following the lyrics`);
  if (!c.takes) notes.push(`TAKES — ${l} makes one take per generation`);
  return notes;
}

/** The ACE-Step settings the panel swaps out for this engine's own controls. */
export function aceOnlyNote(engine: Engine): string {
  const parts = ['DIT MODEL', 'STEPS', 'GUIDANCE', 'ADVANCED'];
  if (!engine.capabilities.lmTools) parts.unshift('LM MODEL', 'THINKING', 'AI ENHANCE');
  if (!engine.capabilities.referenceAudio) parts.push('REFERENCE AUDIO');
  return `${parts.join(', ')} are ACE-Step settings — they don't apply to ${engine.label}`;
}

/** Why an engine can't be picked right now; '' when it can. */
export function unavailableReason(engine: Pick<EngineInfo, 'configured' | 'ready'>): string {
  if (!engine.configured) return 'not configured on the server';
  return engine.ready ? '' : 'not reachable — is its server running?';
}

/** Why an engine can't make a cover right now; '' when it can. */
export function coverUnavailableReason(engine: Pick<EngineInfo, 'configured' | 'ready' | 'coverReady'>): string {
  return unavailableReason(engine) || (engine.coverReady ? '' : 'covers are not set up — its transcriber is not answering');
}

/** The ENGINE row only appears once some extra engine is configured, so a default install
 * looks exactly as it did before engines existed. ACE-Step is always first. */
export function pickerEngines(engines: EngineInfo[]): EngineInfo[] {
  const extras = engines.filter((e) => e.id !== 'acestep' && e.configured);
  if (extras.length === 0) return [];
  const acestep = engines.find((e) => e.id === 'acestep');
  return acestep ? [acestep, ...extras] : extras;
}

/** COVER's ENGINE row: ACE-Step plus the extra engines that can cover right now (their
 * transcriber answers). Empty — no row — until one can, so a default install is unchanged. */
export function coverEngines(engines: EngineInfo[]): EngineInfo[] {
  const extras = engines.filter((e) => e.id !== 'acestep' && e.coverReady);
  if (extras.length === 0) return [];
  const acestep = engines.find((e) => e.id === 'acestep');
  return acestep ? [acestep, ...extras] : extras;
}
