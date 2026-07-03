import type { CSSProperties } from 'react';
import type { Layer } from './api';
import type { Region } from './Waveform';
import { AddLayerTrigger } from './AddLayerTrigger';
import { LayerLane } from './LayerLane';
import { Timeline } from './Timeline';

interface Props {
  songId: string;
  layers: Layer[];
  focusedLayerId: string | null;
  onFocus: (layerId: string) => void;
  onChanged: () => Promise<void>;
  duration: number;
  playhead: number;
  selection: Region | null;
  onSelect: (region: Region | null) => void;
  onSeek: (seconds: number) => void;
  processing?: boolean;
}

/**
 * DAW-style multi-lane waveform stack: a shared scrub timeline on top, then
 * one lane per layer (control bar above its full waveform — every layer,
 * focused or not, renders its whole waveform so the stack reads as a solid
 * bank of tooling rather than collapsing unfocused rows to a summary line),
 * stacked vertically. A single playhead line spans from the timeline through
 * every lane, since both share the same x-axis (no left column offset).
 */
export function LayerStack({ songId, layers, focusedLayerId, onFocus, onChanged, duration, playhead, selection, onSelect, onSeek, processing }: Props) {
  const playheadPct = duration > 0 ? Math.min(100, Math.max(0, (playhead / duration) * 100)) : 0;

  return (
    <div className="layer-stack">
      <div className="section-label">LAYERS</div>
      <div className="stack-scrub">
        <Timeline duration={duration} playhead={playhead} onSeek={onSeek} />
        <div className="lane-grid">
          {layers.map((layer) => (
            <LayerLane
              key={layer.id}
              layer={layer}
              layers={layers}
              focused={layer.id === focusedLayerId}
              duration={duration}
              selection={layer.id === focusedLayerId ? selection : null}
              onSelect={onSelect}
              onFocus={() => onFocus(layer.id)}
              onChanged={onChanged}
              onSeek={onSeek}
              processing={processing}
            />
          ))}
        </div>
        {/* Absolutely positioned against .stack-scrub, spanning from the timeline
            through the last lane so it reads as one continuous playhead. */}
        {duration > 0 && (
          <div className="stack-playhead" style={{ '--playhead-pct': playheadPct } as CSSProperties} />
        )}
      </div>
      <AddLayerTrigger songId={songId} layers={layers} onDone={onChanged} />
    </div>
  );
}
