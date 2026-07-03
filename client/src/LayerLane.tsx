import { useState } from 'react';
import { api, type Layer } from './api';
import { Waveform, type Region } from './Waveform';
import { AIGeneratingBackground } from './AIGeneratingBackground';
import { VolumeSlider } from './VolumeSlider';

export const LANE_HEIGHT = 60;

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
}

/**
 * One DAW-style lane: a slim control bar (name/volume/mute/solo) above the
 * waveform. Only the focused lane is interactive (drag-to-select,
 * double-click-seek); other lanes render the same `Waveform` component in
 * non-interactive mode so `audioUrl` never changes on focus swap (that's
 * what keeps the reveal animation from re-firing — see Waveform.tsx). No
 * per-lane playhead is drawn — a single shared overlay line spans all lanes
 * (see LayerStack.tsx).
 */
export function LayerLane({ layer, layers, focused, duration, selection, onSelect, onFocus, onChanged, onSeek, processing, onSplit }: Props) {
  const [name, setName] = useState(layer.name);
  const [editingName, setEditingName] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');
  const activeVersion = layer.versions.find((v) => v.active);
  const isBase = layer.kind === 'base';

  const patch = async (body: { name?: string; volume?: number; muted?: boolean; solo?: boolean }) => {
    await api.updateLayer(layer.id, body);
    await onChanged();
  };

  const del = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setConfirmDelete(false);
    setError('');
    try {
      await api.deleteLayer(layer.id);
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  /**
   * Plain click: exclusive solo — this layer becomes the only one soloed
   * (clicking the already-sole-soloed layer un-solos it, so it's a toggle
   * rather than a one-way ratchet). Shift-click: additive — only this
   * layer's solo flips, siblings are untouched, per standard DAW convention.
   */
  const handleSolo = async (e: React.MouseEvent) => {
    if (e.shiftKey) {
      await patch({ solo: !layer.solo });
      return;
    }
    const onlyThisSoloed = layers.every((l) => Boolean(l.solo) === (l.id === layer.id));
    const updates = layers
      .filter((l) => Boolean(l.solo) !== (onlyThisSoloed ? false : l.id === layer.id))
      .map((l) => api.updateLayer(l.id, { solo: onlyThisSoloed ? false : l.id === layer.id }));
    if (updates.length) await Promise.all(updates);
    await onChanged();
  };

  const commitName = () => {
    setEditingName(false);
    const trimmed = name.trim();
    if (trimmed && trimmed !== layer.name) patch({ name: trimmed });
    else setName(layer.name);
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
        <span onClick={(e) => e.stopPropagation()}>
          <VolumeSlider value={layer.volume} onChange={(v) => patch({ volume: v })} />
        </span>
        <span className="btn-row" onClick={(e) => e.stopPropagation()}>
          <button
            className={`toggle layer-toggle${layer.muted ? ' on rust' : ''}`}
            onClick={() => patch({ muted: !layer.muted })}
          >
            <span>MUTE</span>
          </button>
          <button
            className={`toggle layer-toggle${layer.solo ? ' on' : ''}`}
            onClick={handleSolo}
          >
            <span>SOLO</span>
          </button>
        </span>
        <button className="tab split-btn" onClick={(e) => { e.stopPropagation(); onSplit(); }} title="split into stems">
          <span>SPLIT</span>
        </button>
        <button
          className={`lane-delete-btn ${confirmDelete ? 'confirm-delete' : 'delete'}`}
          disabled={isBase}
          onClick={(e) => { e.stopPropagation(); del(); }}
          onBlur={() => setConfirmDelete(false)}
          title={isBase ? "the base layer can't be deleted" : confirmDelete ? 'confirm delete' : 'delete this layer'}
        >
          <span>{confirmDelete ? 'CONFIRM?' : 'X'}</span>
        </button>
      </div>
      {error && <div className="error">{error}</div>}
      <div className="lane-waveform">
        {activeVersion && (
          <Waveform
            audioUrl={`/audio/${activeVersion.audio_file}`}
            duration={duration}
            selection={selection}
            onSelect={onSelect}
            height={LANE_HEIGHT}
            interactive={focused}
            onFocus={onFocus}
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
