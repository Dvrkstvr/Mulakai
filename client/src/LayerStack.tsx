import { useState, type CSSProperties } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Layer } from './api';
import type { Region } from './Waveform';
import { AddLayerTrigger } from './AddLayerTrigger';
import { LayerLane, LANE_HEIGHT } from './LayerLane';
import { Timeline } from './Timeline';
import { ScrollArea } from './ScrollArea';
import { AIGeneratingBackground } from './AIGeneratingBackground';

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
  onSplit: (layerId: string) => void;
  onAddLayerExpandedChange?: (expanded: boolean) => void;
}

/**
 * DAW-style multi-lane waveform stack: a shared scrub timeline on top, then
 * one lane per layer (control bar above its full waveform — every layer,
 * focused or not, renders its whole waveform so the stack reads as a solid
 * bank of tooling rather than collapsing unfocused rows to a summary line),
 * stacked vertically. A single playhead line spans from the timeline through
 * every lane, since both share the same x-axis (no left column offset).
 */
export function LayerStack({ songId, layers, focusedLayerId, onFocus, onChanged, duration, playhead, selection, onSelect, onSeek, processing, onSplit, onAddLayerExpandedChange }: Props) {
  const playheadPct = duration > 0 ? Math.min(100, Math.max(0, (playhead / duration) * 100)) : 0;
  const [addingLayer, setAddingLayer] = useState(false);

  return (
    <div className="layer-stack">
      <div className="section-label">LAYERS</div>
      <ScrollArea className="stack-scrub">
        <div className="stack-scrub-inner">
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
                onSplit={() => onSplit(layer.id)}
              />
            ))}
            {/* Ghost lane — appears the instant ADD LAYER is submitted, before the
                real layer exists server-side, so the "something is happening"
                feedback is immediate rather than waiting on the job to resolve. */}
            <AnimatePresence>
              {addingLayer && (
                <motion.div
                  className="layer-lane layer-lane-ghost"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                >
                  <div className="lane-controls">
                    <span className="layer-name">NEW LAYER</span>
                    <span className="meta">generating…</span>
                  </div>
                  <div className="lane-waveform" style={{ height: LANE_HEIGHT }}>
                    <AIGeneratingBackground />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {/* Absolutely positioned against .stack-scrub-inner, spanning from the
              timeline through the last lane so it reads as one continuous playhead. */}
          {duration > 0 && (
            <div className="stack-playhead" style={{ '--playhead-pct': playheadPct } as CSSProperties} />
          )}
        </div>
      </ScrollArea>
      <AddLayerTrigger
        songId={songId}
        layers={layers}
        onDone={onChanged}
        onGeneratingChange={setAddingLayer}
        onExpandedChange={onAddLayerExpandedChange}
      />
    </div>
  );
}
