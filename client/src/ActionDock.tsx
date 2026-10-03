import { useState } from 'react';
import type { Layer, SongDetail } from './api';
import type { Region } from './Waveform';
import type { Section } from './lyricSections';
import { dockTarget, type DockVerb } from './dockTarget';
import { DockRepaint, type SectionLyrics } from './DockRepaint';
import { DockAddLayer } from './DockAddLayer';
import { DockSplit } from './DockSplit';
import { DockExport } from './DockExport';
import type { useEditorRepaintJob } from './useEditorRepaintJob';
import { useNextVersion } from './useLayerQueue';

const VERBS: { id: DockVerb; label: string; key: string }[] = [
  { id: 'repaint', label: 'REPAINT', key: 'R' },
  { id: 'addLayer', label: 'ADD LAYER', key: 'L' },
  { id: 'split', label: 'SPLIT', key: 'S' },
  { id: 'export', label: 'EXPORT', key: 'E' },
];

export interface DockRepaintInputs {
  prompt: string;
  onPromptChange: (prompt: string) => void;
  job: ReturnType<typeof useEditorRepaintJob>;
  onRepaint: () => void;
  lyrics: SectionLyrics;
}

interface Props {
  verb: DockVerb;
  onVerb: (verb: DockVerb) => void;
  song: SongDetail;
  focusedLayer: Layer | undefined;
  selection: Region | null;
  onClearSelection: () => void;
  sections: Section[];
  repaint: DockRepaintInputs;
  onChanged: () => Promise<void>;
}

/** Ordinal of a layer's active version in its history (versions arrive newest first). */
function activeNumber(layer: Layer | undefined): number | null {
  const i = layer?.versions.findIndex((v) => v.active) ?? -1;
  return layer && i !== -1 ? layer.versions.length - i : null;
}

/**
 * The Editor's one place to act (PLAN.md "UI Redesign", S1): TARGET chip → verb tabs → the
 * verb's body → consequence + commit. A verb's body stays mounted (hidden) once opened, so its
 * fields survive a switch; ADD LAYER is always mounted, as its row used to be, so its fields
 * start over once its layers land even while another verb shows.
 */
export function ActionDock({ verb, onVerb, song, focusedLayer, selection, onClearSelection, sections, repaint, onChanged }: Props) {
  const [opened, setOpened] = useState<Set<DockVerb>>(() => new Set(['repaint', 'addLayer']));
  if (!opened.has(verb)) setOpened(new Set([...opened, verb]));
  const layerName = focusedLayer?.name ?? 'base';
  const duration = song.duration ?? 0;
  const target = dockTarget(verb, layerName, selection, sections, duration);
  const repaintTarget = verb === 'repaint' ? target : dockTarget('repaint', layerName, selection, sections, duration);
  const nextVersion = useNextVersion(focusedLayer, song.id);

  const body = (v: DockVerb) => {
    if (v === 'repaint') {
      return <DockRepaint target={repaintTarget} layerName={layerName} nextVersion={nextVersion}
        activeVersion={activeNumber(focusedLayer)} selection={selection} duration={duration} {...repaint} />;
    }
    if (v === 'addLayer') return <DockAddLayer songId={song.id} layers={song.layers} songLyrics={song.lyrics} />;
    if (v === 'split') return focusedLayer ? <DockSplit songId={song.id} layer={focusedLayer} onChanged={onChanged} /> : null;
    return <DockExport song={song} />;
  };

  return (
    <section className="action-dock" aria-label="Action dock">
      <div className="dock-head">
        <span className="dock-row-label">TARGET</span>
        <span className={`scope-chip dock-target${target.warn ? ' warn' : ''}`}>{target.label}</span>
        {target.clearable && (
          <button type="button" className="tab dock-quiet" onClick={onClearSelection}><span>✕ WHOLE SONG</span></button>
        )}
        <span className="dock-hint">{target.hint}</span>
        <div className="dock-verbs" role="tablist" aria-label="Verb">
          {VERBS.map((v) => (
            <button key={v.id} type="button" role="tab" aria-selected={v.id === verb} aria-keyshortcuts={v.key}
              className={`tab dock-verb${v.id === verb ? ' active' : ''}`} onClick={() => onVerb(v.id)}>
              <span>{v.label}</span><span className="kbd" aria-hidden="true">{v.key}</span>
            </button>
          ))}
        </div>
      </div>
      {VERBS.filter((v) => opened.has(v.id)).map((v) => (
        <div key={v.id} role="tabpanel" aria-label={v.label} className="dock-panel" hidden={v.id !== verb}>
          {body(v.id)}
        </div>
      ))}
    </section>
  );
}
