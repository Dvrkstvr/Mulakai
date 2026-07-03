import { useState } from 'react';
import { api, type Layer } from './api';
import { Waveform, type Region } from './Waveform';
import { AIGeneratingBackground } from './AIGeneratingBackground';
import { VolumeSlider } from './VolumeSlider';

export const LANE_HEIGHT = 60;

interface Props {
  layer: Layer;
  focused: boolean;
  duration: number;
  selection: Region | null;
  onSelect: (region: Region | null) => void;
  onFocus: () => void;
  onChanged: () => Promise<void>;
  onSeek: (seconds: number) => void;
  /** True while a repaint job targeting this (focused) lane is in flight — shows the AI shimmer overlay. */
  processing?: boolean;
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
export function LayerLane({ layer, focused, duration, selection, onSelect, onFocus, onChanged, onSeek, processing }: Props) {
  const [name, setName] = useState(layer.name);
  const [editingName, setEditingName] = useState(false);
  const activeVersion = layer.versions.find((v) => v.active);

  const patch = async (body: { name?: string; volume?: number; muted?: boolean; solo?: boolean }) => {
    await api.updateLayer(layer.id, body);
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
            onClick={() => patch({ solo: !layer.solo })}
          >
            <span>SOLO</span>
          </button>
        </span>
      </div>
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
