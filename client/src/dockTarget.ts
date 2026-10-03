import type { Region } from './Waveform';
import { findActiveSectionIndex, type Section } from './lyricSections';
import { REPAINT_MIN_SECONDS, REPAINT_MAX_SECONDS } from './repaintLimits';

export type DockVerb = 'repaint' | 'addLayer' | 'split' | 'export';

export interface DockTarget {
  label: string;
  /** Too short / too long for a repaint: the chip turns rust (`.warn`) and the commit stays off. */
  warn: boolean;
  /** Whether `✕ WHOLE SONG` is offered, i.e. there is a range to clear. */
  clearable: boolean;
  hint: string;
  /** The one whole section the range is exactly, uppercased, or null. */
  section: string | null;
}

export const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
export const fmtRange = (r: Region) => `${fmtTime(r.start)}–${fmtTime(r.end)}`;

const HINTS: Record<DockVerb, string> = {
  repaint: 'drag a waveform, click a section or a lyric line',
  addLayer: 'a new layer always spans the full length',
  split: 'split acts on the focused layer',
  export: 'what you hear is what you get',
};

/** The sky TARGET chip for a verb (PLAN.md "UI Redesign", S1 decision 2). */
export function dockTarget(verb: DockVerb, layerName: string, selection: Region | null, sections: Section[]): DockTarget {
  const layer = layerName.toUpperCase();
  const base = { warn: false, clearable: false, hint: HINTS[verb], section: null };
  if (verb === 'split') return { ...base, label: `${layer} · WHOLE LAYER` };
  if (verb !== 'repaint') return { ...base, label: 'WHOLE SONG' };
  if (!selection) return { ...base, label: `${layer} · WHOLE SONG` };

  const seconds = selection.end - selection.start;
  if (seconds < REPAINT_MIN_SECONDS) return { ...base, clearable: true, warn: true, label: `${fmtRange(selection)} · MIN ${REPAINT_MIN_SECONDS}s` };
  if (seconds > REPAINT_MAX_SECONDS) return { ...base, clearable: true, warn: true, label: `${fmtRange(selection)} · MAX ${REPAINT_MAX_SECONDS}s` };
  const index = findActiveSectionIndex(sections, selection);
  const section = index !== -1 && sections[index].label ? sections[index].label.toUpperCase() : null;
  return {
    ...base,
    clearable: true,
    section,
    label: section ? `${layer} · ${section} · ${fmtRange(selection)}` : `${layer} · ${fmtRange(selection)}`,
  };
}

/** `REPAINT VERSE 2` / `REPAINT 1:32–2:07` / `REPAINT VOCALS` (no range = the whole layer). */
export function repaintCommitLabel(layerName: string, selection: Region | null, section: string | null): string {
  if (!selection) return `REPAINT ${layerName.toUpperCase()}`;
  return `REPAINT ${section ?? fmtRange(selection)}`;
}

/** "Saves vocals v5 over VERSE 2 · v4 stays in VERSIONS · other layers untouched". */
export function repaintConsequence(layerName: string, nextVersion: number, activeVersion: number | null,
  selection: Region | null, section: string | null): string {
  const layer = layerName.toLowerCase();
  const over = !selection ? 'the whole layer' : section ?? fmtRange(selection);
  const kept = activeVersion ? ` · v${activeVersion} stays in VERSIONS` : '';
  return `Saves ${layer} v${nextVersion} over ${over}${kept} · other layers untouched`;
}
