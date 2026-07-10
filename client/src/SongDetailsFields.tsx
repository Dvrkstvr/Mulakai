import { Slider } from './Slider';

interface Props {
  bpm: number;
  onBpmChange: (v: number) => void;
  duration: number;
  onDurationChange: (v: number) => void;
  keyScale: string;
  onKeyScaleChange: (v: string) => void;
}

/** BPM/DURATION/KEY-SCALE trio, extracted from CreateView's PROMPT tab so other
 * generation flows (e.g. a future tab) can reuse the same three fields without
 * duplicating this JSX. Caller owns the state — see CreateView.tsx for the
 * canonical usage inside `.song-details-grid`. */
export function SongDetailsFields({ bpm, onBpmChange, duration, onDurationChange, keyScale, onKeyScaleChange }: Props) {
  return (
    <>
      <Slider label="BPM" value={bpm} min={0} max={300} step={1}
        readout={bpm === 0 ? 'AUTO' : undefined} onChange={onBpmChange} />
      <Slider label="DURATION" value={duration} min={0} max={600} step={5}
        readout={duration === 0 ? 'AUTO' : `${duration}s`} onChange={onDurationChange} />
      <div className="setting">
        <div className="setting-head"><span>KEY / SCALE</span></div>
        <input placeholder="AUTO (e.g. C Major, Am)" value={keyScale} onChange={(e) => onKeyScaleChange(e.target.value)} />
      </div>
    </>
  );
}
