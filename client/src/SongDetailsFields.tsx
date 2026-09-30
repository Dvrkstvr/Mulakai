import { Slider } from './Slider';
import type { EngineCapabilities } from './api';
import { durationReadout, unsupported } from './engineCaps';

interface Props {
  bpm: number;
  onBpmChange: (v: number) => void;
  duration: number;
  onDurationChange: (v: number) => void;
  keyScale: string;
  onKeyScaleChange: (v: string) => void;
  /** The PROMPT tab's extra engine, if any: controls it can't take stay in place as N/A
   * (engineCaps.ts). Omitted everywhere ACE-Step is the only engine. */
  caps?: EngineCapabilities | null;
}

/** A control an engine can't take, kept in place so the form doesn't reflow — disabled, with
 * an N/A readout (PLAN.md design point 6). The reason line sits under the grid. */
export function NaSetting({ label }: { label: string }) {
  return (
    <div className="setting setting-disabled">
      <div className="setting-head"><span>{label}</span><span className="val">N/A</span></div>
    </div>
  );
}

/** BPM/DURATION/KEY-SCALE trio, extracted from CreateView's PROMPT tab so other
 * generation flows (e.g. a future tab) can reuse the same three fields without
 * duplicating this JSX. Caller owns the state — see CreateView.tsx for the
 * canonical usage inside `.song-details-grid`. */
export function SongDetailsFields({ bpm, onBpmChange, duration, onDurationChange, keyScale, onKeyScaleChange, caps = null }: Props) {
  const bpmNa = unsupported('bpm', caps);
  const durationNa = unsupported('duration', caps);
  return (
    <>
      <Slider label="BPM" value={bpmNa ? 0 : bpm} min={0} max={300} step={1} disabled={bpmNa}
        readout={bpmNa ? 'N/A' : bpm === 0 ? 'AUTO' : undefined} onChange={onBpmChange} />
      <Slider label="DURATION" value={durationNa ? 0 : duration} min={0} max={600} step={5} disabled={durationNa}
        readout={durationReadout(duration, caps)} onChange={onDurationChange} />
      {unsupported('keyScale', caps) ? <NaSetting label="KEY / SCALE" /> : (
        <div className="setting">
          <div className="setting-head"><span>KEY / SCALE</span></div>
          <input placeholder="AUTO (e.g. C Major, Am)" value={keyScale} onChange={(e) => onKeyScaleChange(e.target.value)} />
        </div>
      )}
    </>
  );
}
