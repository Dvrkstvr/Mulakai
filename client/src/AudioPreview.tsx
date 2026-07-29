import { PlayerWaveform } from './PlayerWaveform';
import { previewPlayback, usePreviewState } from './previewPlayback';

interface Props {
  src: string;
  /** Exclusivity identity in the shared preview slot — defaults to `src`. */
  previewKey?: string;
  /** Spoken context for the play button, e.g. the stem/voice name. */
  label?: string;
  height?: number;
  /** Known duration in seconds, so the readout can render before first play. */
  duration?: number;
  disabled?: boolean;
}

export const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/**
 * The inline audio-preview module (docs/design/DESIGN.md "Audio preview
 * module"): acid play/pause hexagon + waveform + click-to-seek + time
 * readout. All instances share the single previewPlayback slot.
 */
export function AudioPreview({ src, previewKey = src, label, height = 28, duration, disabled }: Props) {
  const state = usePreviewState();
  const current = state.key === previewKey;
  const playing = current && state.playing;
  const dur = current && state.duration > 0 ? state.duration : duration ?? 0;
  const time = current ? state.currentTime : 0;

  return (
    <div className="audio-preview">
      <button
        className={`preview-play${playing ? ' playing' : ''}`}
        disabled={disabled}
        onClick={() => previewPlayback.toggle(previewKey, src)}
        aria-label={`${playing ? 'pause' : 'play'} preview${label ? ` — ${label}` : ''}`}
      />
      <div className="audio-preview-wave">
        <PlayerWaveform
          audioUrl={src}
          duration={dur}
          playhead={time}
          height={height}
          onSeekFraction={(frac) => previewPlayback.seekFraction(previewKey, src, frac)}
        />
      </div>
      {dur > 0 && (
        <span className={`preview-time${playing ? ' playing' : ''}`}>
          {fmtTime(time)} / {fmtTime(dur)}
        </span>
      )}
    </div>
  );
}
