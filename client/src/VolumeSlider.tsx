import type { CSSProperties } from 'react';

interface Props {
  value: number;
  onChange: (v: number) => void;
}

/**
 * Slim lane-control volume slider: half the height of the DAW-fader
 * Slider.tsx (10px vs 20px), no handle. Track/fill/guides are siblings that
 * share the same skewX transform (not nested) so their edges line up — same
 * technique .pgram-slider uses. The fill is grey and grows with value; the
 * guide lines stay grey and visible even at 0 because they're their own
 * layer above the dark (empty) background, not just gaps in the fill.
 */
export function VolumeSlider({ value, onChange }: Props) {
  const style = { '--pct': value } as CSSProperties;
  return (
    <span className="vol-slider" style={style}>
      <input
        type="range" min={0} max={1} step={0.01} value={value}
        className="vol-slider-input"
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="vol-slider-track" />
      <span className="vol-slider-fill" />
      <span className="vol-slider-guides">
        <span className="vol-slider-guide" />
        <span className="vol-slider-guide" />
        <span className="vol-slider-guide" />
        <span className="vol-slider-guide" />
      </span>
    </span>
  );
}
