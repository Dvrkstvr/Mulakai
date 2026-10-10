import { useState } from 'react';
import type { Layer, SongDetail } from './api';
import type { Region } from './Waveform';
import type { Section } from './lyricSections';
import { dockTarget, idleTarget, type DockVerb } from './dockTarget';
import { DockRepaint, type SectionLyrics } from './DockRepaint';
import { DockAddLayer } from './DockAddLayer';
import { DockSplit } from './DockSplit';
import { DockExport } from './DockExport';
import { DockScore } from './DockScore';
import { actionLabel, type VerbSpec } from './dockVerbs';
import type { ScoreVerbState } from './scoreVerbTypes';
import type { useEditorRepaintJob } from './useEditorRepaintJob';
import { useNextVersion } from './useLayerQueue';
import { scoreOpen } from './scoreEnds';
import { CLEAR_PICK, scoreTarget } from './scoreCopy';
import { useScoreStore } from './scoreStore';

export interface DockRepaintInputs {
  prompt: string;
  onPromptChange: (prompt: string) => void;
  job: ReturnType<typeof useEditorRepaintJob>;
  onRepaint: () => void;
  lyrics: SectionLyrics;
}

interface Props {
  /** The open action, or null: nothing opens on entry (PLAN.md "Editor Redesign", PR 5). */
  verb: DockVerb | null;
  /** The tabs on show (dockVerbs): SCORE only for a song the server says it applies to. */
  verbs: readonly VerbSpec[];
  score: ScoreVerbState;
  /** SCORE has a strip section or a timed lyric line to pick (D-074): only then the chip hints at picking. */
  scorePickable?: boolean;
  onVerb: (verb: DockVerb | null) => void;
  song: SongDetail;
  focusedLayer: Layer | undefined;
  selection: Region | null;
  onClearSelection: () => void;
  sections: Section[];
  repaint: DockRepaintInputs;
}

/** Ordinal of a layer's active version in its history (versions arrive newest first). */
function activeNumber(layer: Layer | undefined): number | null {
  const i = layer?.versions.findIndex((v) => v.active) ?? -1;
  return layer && i !== -1 ? layer.versions.length - i : null;
}

/**
 * The Editor's action bar (PLAN.md "Editor Redesign", PR 5; was the dock of "UI Redesign", S1): THIS chip → the
 * actions → the open action's body → consequence + commit. Nothing is open on entry: with no action open the chip names
 * what is selected; an open action's chip names what that action acts on. Clicking the open action again, ✕ CLOSE or
 * Escape closes it. A body stays mounted (hidden) once opened, so its fields survive a switch; ADD LAYER is always
 * mounted, so its fields start over once its layers land even while another action shows.
 */
export function ActionDock({ verb: picked, verbs, score, scorePickable = false, onVerb, song, focusedLayer, selection, onClearSelection, sections, repaint }: Props) {
  const verb = picked && verbs.some((v) => v.id === picked) ? picked : null; // SCORE went away (another song)
  const [opened, setOpened] = useState<Set<DockVerb>>(() => new Set(['repaint', 'addLayer']));
  if (verb && !opened.has(verb)) setOpened(new Set([...opened, verb]));
  const layerName = focusedLayer?.name ?? 'base';
  const duration = song.duration ?? 0;
  // SCORE's chip names the pick ("this", F-032, M2-1); ✕ clears the pick, not the range REPAINT keeps.
  const target = verb === 'score' ? scoreTarget(score, selection, scorePickable)
    : verb ? dockTarget(verb, layerName, selection, sections, duration) : idleTarget(layerName, selection, sections, duration);
  const clearPick = () => useScoreStore.getState().dispatch(song.id, { type: 'pick', pick: null });
  const repaintTarget = verb === 'repaint' ? target : dockTarget('repaint', layerName, selection, sections, duration);
  const nextVersion = useNextVersion(focusedLayer, song.id);
  const endsScore = scoreOpen(score); // F-027: an ACE-Step edit's line says it ends score editing

  const body = (v: DockVerb) => {
    if (v === 'repaint') {
      return <DockRepaint target={repaintTarget} layerName={layerName} nextVersion={nextVersion}
        activeVersion={activeNumber(focusedLayer)} selection={selection} duration={duration} scoreOpen={endsScore} {...repaint} />;
    }
    if (v === 'addLayer') return <DockAddLayer songId={song.id} layers={song.layers} songLyrics={song.lyrics} scoreOpen={endsScore} />;
    if (v === 'split') return focusedLayer ? <DockSplit songId={song.id} layer={focusedLayer} /> : null;
    if (v === 'score') return <DockScore songId={song.id} state={score} />;
    return <DockExport song={song} />;
  };

  return (
    <section className="action-dock" aria-label="Action dock">
      <div className="dock-head">
        <span className="dock-row-label">THIS</span>
        <span className={`scope-chip dock-target${target.warn ? ' warn' : ''}`}>{target.label}</span>
        {target.clearable && (
          <button type="button" className="tab dock-quiet" onClick={verb === 'score' ? clearPick : onClearSelection}>
            <span>{verb === 'score' ? CLEAR_PICK : '✕ WHOLE SONG'}</span>
          </button>
        )}
        <span className="dock-hint">{target.hint}</span>
        <div className="dock-verbs" role="tablist" aria-label="Verb">
          {verbs.map((v) => (
            <button key={v.id} type="button" role="tab" aria-selected={v.id === verb} aria-keyshortcuts={v.key}
              className={`tab dock-verb${v.id === verb ? ' active' : ''}`} onClick={() => onVerb(v.id === verb ? null : v.id)}>
              <span>{actionLabel(v, layerName)}</span><span className="kbd" aria-hidden="true">{v.key}</span>
            </button>
          ))}
          {verb && (
            <button type="button" className="tab dock-quiet" aria-keyshortcuts="Escape" onClick={() => onVerb(null)}>
              <span>✕ CLOSE</span><span className="kbd" aria-hidden="true">ESC</span>
            </button>
          )}
        </div>
      </div>
      {verbs.filter((v) => opened.has(v.id)).map((v) => (
        <div key={v.id} role="tabpanel" aria-label={v.label} className="dock-panel" hidden={v.id !== verb}>
          {body(v.id)}
        </div>
      ))}
    </section>
  );
}
