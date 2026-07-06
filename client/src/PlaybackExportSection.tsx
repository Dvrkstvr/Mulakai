import { useSettings, type AudioFormat } from './settings';
import { CustomSelect } from './CustomSelect';
import { Slider } from './Slider';

const FORMAT_OPTIONS: { label: string; value: AudioFormat; description?: string }[] = [
  { label: 'WAV', value: 'wav', description: 'Uncompressed, widest compatibility' },
  { label: 'WAV32', value: 'wav32', description: '32-bit float, highest fidelity' },
  { label: 'FLAC', value: 'flac', description: 'Lossless, smaller than WAV' },
  { label: 'MP3', value: 'mp3', description: 'Lossy, smallest, universal playback' },
  { label: 'OPUS', value: 'opus', description: 'Lossy, efficient at low size' },
  { label: 'AAC', value: 'aac', description: 'Lossy, common in Apple ecosystems' },
];

/** Default playback volume + Remaster/export format & steps — the two real ACE-Step
 * output params (docs/ace-step-1.5/API.md#4.2). Sample rate (fixed 48kHz by the model)
 * and bitrate aren't exposed by the API, so they aren't modeled here. */
export function PlaybackExportSection() {
  const exportSettings = useSettings((s) => s.exportSettings);
  const setExportSettings = useSettings((s) => s.setExportSettings);

  return (
    <div className="settings-card">
      <span className="section-label">PLAYBACK &amp; EXPORT</span>
      <div className="hint">applies the next time a player loads, and to future Remaster runs — doesn't touch anything currently open</div>

      <Slider
        label="DEFAULT VOLUME"
        value={Math.round(exportSettings.volume * 100)}
        min={0}
        max={100}
        step={5}
        onChange={(v) => setExportSettings({ volume: v / 100 })}
      />

      <CustomSelect
        label="DEFAULT EXPORT FORMAT"
        value={exportSettings.audioFormat}
        onChange={(v) => setExportSettings({ audioFormat: v as AudioFormat })}
        options={FORMAT_OPTIONS}
      />

      <Slider
        label="DEFAULT REMASTER STEPS"
        value={exportSettings.steps}
        min={1}
        max={200}
        step={1}
        info="Diffusion steps for the one-shot Remaster export pass — ACE-Step's documented Base-model ceiling is 200."
        onChange={(v) => setExportSettings({ steps: v })}
      />
    </div>
  );
}
