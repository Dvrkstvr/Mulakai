import { useMemo, useRef, useState } from 'react';
import { api, type Layer } from './api';
import { attempt } from './actionError';
import { latestOnly } from './latestOnly';
import { Waveform, type Region } from './Waveform';
import { AIGeneratingBackground } from './AIGeneratingBackground';
import { VolumeSlider } from './VolumeSlider';
import { laneSelect } from './editorSelection';
import { LaneMenu } from './LaneMenu';
import { LaneTakes } from './LaneTakes';
import type { TakeChip } from './laneTakeChips';

export const LANE_HEIGHT = 60;

type LayerPatch = { name?: string; volume?: number; muted?: boolean; solo?: boolean };

interface Props {
  layer: Layer;
  /** Full sibling list — needed to enforce solo exclusivity across the stack. */
  layers: Layer[];
  focused: boolean;
  duration: number;
  selection: Region | null;
  onSelect: (region: Region | null) => void;
  onFocus: () => void;
  onChanged: () => Promise<void>;
  onSeek: (seconds: number) => void;
  /** True while a repaint job targeting this (focused) lane is in flight — shows the AI shimmer overlay. */
  processing?: boolean;
  onSplit: () => void;
  /** The lane's take chips (laneTakes), the take heard in place if it is this lane's, and what a chip click does. */
  takes: { chips: TakeChip[]; hearing: string | null; onUse: (versionId: string) => void; onHear: (versionId: string) => void };
}

/**
 * One DAW-style lane: a slim control bar (name/volume/mute/solo) above the
 * waveform. Every lane takes a drag (select) and a double-click (seek); a
 * drag or a click on a lane that isn't focused focuses it too, the range
 * moving with the focus (`laneSelect`, PLAN.md "Editor Redesign", PR 4). No
 * per-lane playhead is drawn — a single shared overlay line spans all lanes
 * (see LayerStack.tsx).
 */
export function LayerLane({ layer, layers, focused, duration, selection, onSelect, onFocus, onChanged, onSeek, processing, onSplit, takes }: Props) {
  const [name, setName] = useState(layer.name);
  const [editingName, setEditingName] = useState(false);
  const [error, setError] = useState('');
  const [volumeDraft, setVolumeDraft] = useState<number | null>(null);
  const activeVersion = layer.versions.find((v) => v.active);
  const isBase = layer.kind === 'base';

  // Reloads even when a PATCH fails: a solo PATCHes several layers, and the reload
  // shows which of them landed.
  const patch = (label: string, updates: [string, LayerPatch][]) => attempt(label, async () => {
    try {
      await Promise.all(updates.map(([id, body]) => api.updateLayer(id, body)));
    } finally {
      await onChanged();
    }
  }, setError);
  const patchRef = useRef(patch);
  patchRef.current = patch;
  const sendVolume = useMemo(
    () => latestOnly((volume: number) => patchRef.current("couldn't set volume", [[layer.id, { volume }]])),
    [layer.id],
  );
  const changeVolume = (volume: number) => {
    setVolumeDraft(volume);
    void sendVolume(volume).finally(() => setVolumeDraft(null));
  };

  const del = () => void attempt("couldn't delete layer", async () => {
    await api.deleteLayer(layer.id);
    await onChanged();
  }, setError);

  /**
   * Plain click: exclusive solo — this layer becomes the only one soloed
   * (clicking the already-sole-soloed layer un-solos it, so it's a toggle
   * rather than a one-way ratchet). Shift-click: additive — only this
   * layer's solo flips, siblings are untouched, per standard DAW convention.
   */
  const handleSolo = (e: React.MouseEvent) => {
    if (e.shiftKey) {
      void patch("couldn't solo", [[layer.id, { solo: !layer.solo }]]);
      return;
    }
    const onlyThisSoloed = layers.every((l) => Boolean(l.solo) === (l.id === layer.id));
    const updates = layers
      .filter((l) => Boolean(l.solo) !== (onlyThisSoloed ? false : l.id === layer.id))
      .map((l): [string, LayerPatch] => [l.id, { solo: onlyThisSoloed ? false : l.id === layer.id }]);
    void patch("couldn't solo", updates);
  };

  const commitName = () => {
    setEditingName(false);
    const trimmed = name.trim();
    if (trimmed && trimmed !== layer.name) {
      void patch("couldn't rename layer", [[layer.id, { name: trimmed }]]).then((ok) => { if (!ok) setName(layer.name); });
    } else setName(layer.name);
  };

  return (
    <div className={`layer-lane${focused ? ' focused' : ''}`}>
      <div className="lane-controls" onClick={onFocus}>
        {editingName ? (
          <input
            className="layer-name-input"
            value={name}
            autoFocus
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') { setName(layer.name); setEditingName(false); } }}
          />
        ) : (
          <span className="layer-name" onClick={(e) => { e.stopPropagation(); setEditingName(true); }} title="click to rename">
            {layer.name.toUpperCase()}
          </span>
        )}
        <LaneTakes {...takes} />
        <span onClick={(e) => e.stopPropagation()}>
          <VolumeSlider value={volumeDraft ?? layer.volume} onChange={changeVolume} />
        </span>
        <span className="btn-row" onClick={(e) => e.stopPropagation()}>
          <button
            className={`toggle layer-toggle${layer.muted ? ' on rust' : ''}`}
            onClick={() => void patch(layer.muted ? "couldn't unmute" : "couldn't mute", [[layer.id, { muted: !layer.muted }]])}
          >
            <span>MUTE</span>
          </button>
          <button
            className={`toggle layer-toggle${layer.solo ? ' on' : ''}`}
            onClick={handleSolo}
            title="click: hear only this layer · shift-click: add it to the soloed layers"
          >
            <span>SOLO</span>
          </button>
        </span>
        <LaneMenu name={layer.name} isBase={isBase} takes={layer.versions.length}
          onRename={() => setEditingName(true)} onSplit={onSplit} onDelete={del} />
      </div>
      {error && <div className="error">{error}</div>}
      <div className="lane-waveform" onClick={focused ? undefined : onFocus}>
        {activeVersion && (
          <Waveform
            audioUrl={`/audio/${activeVersion.audio_file}`}
            duration={duration}
            selection={selection}
            onSelect={(r) => laneSelect(focused, r, onFocus, onSelect)}
            height={LANE_HEIGHT}
            onSeek={onSeek}
          />
        )}
        {focused && processing && (
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            <AIGeneratingBackground />
          </div>
        )}
      </div>
    </div>
  );
}
