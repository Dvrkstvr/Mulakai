import { Slider } from './Slider';

/** Risk scale for repaint VARIANCE (audio_cover_strength inverse) — see docs/design/DESIGN.md#Color-tokens. */
const VARIANCE_BANDS = [
  { max: 33, color: 'var(--sky)', label: 'SUBTLE', text: 'stays close to the original, small tweaks only' },
  { max: 66, color: 'var(--acid)', label: 'BALANCED', text: 'noticeable change, source still recognizable' },
  { max: 100, color: 'var(--rust)', label: 'BOLD', text: 'high freedom, may diverge far from the source to follow the prompt' },
];

export function VarianceSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const band = VARIANCE_BANDS.find((b) => value <= b.max) ?? VARIANCE_BANDS[VARIANCE_BANDS.length - 1];
  return (
    <div className="variance-slider">
      <Slider label="VARIANCE" value={value} min={0} max={100} step={5} color={band.color} onChange={onChange} />
      <div className="variance-note" style={{ color: band.color }}>{band.label} — {band.text}</div>
    </div>
  );
}
