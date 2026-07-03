import type { CSSProperties } from 'react';
import { InfoTooltip } from './InfoTooltip';

interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  /** Overrides the numeric readout (e.g. "AUTO" at 0). */
  readout?: string | number;
  /** Fill/handle color — defaults to acid (see VarianceSlider for the risk-scale override). */
  color?: string;
  /** Explains what the setting does — rendered as a hover/focus "?" next to the label. */
  info?: string;
  /** Dims the control and blocks interaction (e.g. GUIDANCE on a Turbo model, which ignores CFG). */
  disabled?: boolean;
}

/**
 * Parallelogram DAW-fader slider per docs/design/DESIGN.md's shape grammar:
 * a solid parallelogram fill up to the value, a bigger parallelogram handle
 * notched at the boundary, and a dashed-outline parallelogram for the
 * unfilled remainder — three plain divs, not a reskinned native thumb (that
 * approach couldn't get a dashed track or an oversized handle). A fully
 * transparent native <input type="range"> is layered on top for real
 * drag/keyboard/touch/a11y behavior; the divs are purely decorative.
 */
export function Slider({ label, value, min, max, step, onChange, readout, color, info, disabled }: Props) {
  // Unitless 0–1 fraction (not a "%" string) so CSS calc() can scale it
  // against a length (100% - handle width) to keep the handle fully inside
  // the track at both ends — see .pgram-handle in index.css.
  const frac = (value - min) / (max - min);
  const style = { '--pct': frac, ...(color ? { '--fill': color } : {}) } as CSSProperties;
  return (
    <div className={disabled ? 'setting setting-disabled' : 'setting'}>
      <div className="setting-head">
        <span>{label}{info && <InfoTooltip text={info} />}</span>
        <span className="val" style={color ? { color } : undefined}>{readout ?? value}</span>
      </div>
      <div className="pgram-slider" style={style}>
        <input
          type="range" min={min} max={max} step={step} value={value}
          className="pgram-input"
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <div className="pgram-track" />
        <div className="pgram-fill" />
        <div className="pgram-handle" />
      </div>
    </div>
  );
}
