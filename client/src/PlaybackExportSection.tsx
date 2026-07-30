import { useSettings } from './settings';
import {
  DEPTHS_BY_FORMAT, MP3_BITRATES, SAMPLE_RATES, clampDepth, depthLabel,
  type AudioFormat, type BitDepth, type Mp3Bitrate, type SampleRate,
} from './formatCaps';
import { CustomSelect } from './CustomSelect';
import { Slider } from './Slider';

const FORMAT_OPTIONS: { label: string; value: AudioFormat; description?: string }[] = [
  { label: 'FLAC', value: 'flac', description: 'Lossless, ~half of WAV, carries metadata' },
  { label: 'WAV', value: 'wav', description: 'Uncompressed, widest compatibility' },
  { label: 'MP3', value: 'mp3', description: 'Lossy, smallest, universal playback' },
];

const RATE_DESCRIPTION: Record<SampleRate, string> = {
  48000: 'Native rate — no resampling',
  44100: 'CD / distribution targets',
};

/**
 * Output format, rate and depth — applied once server-side to every produced
 * file (generation, repaint, Add Layer, stem splits). Generators are always
 * asked for a lossless master regardless of what's picked here, so nothing is
 * ever encoded twice. See PLAN.md "Output Format: Rate / Depth / Bitrate,
 * Everywhere". Also carries default playback volume and Remaster steps.
 */
export function PlaybackExportSection() {
  const exportSettings = useSettings((s) => s.exportSettings);
  const setExportSettings = useSettings((s) => s.setExportSettings);

  const depths = DEPTHS_BY_FORMAT[exportSettings.audioFormat];

  // Switching container re-clamps depth in the same update — FLAC can't hold the
  // 32-bit float WAV allows, so leaving the old value selected would show a depth
  // the encoder would silently ignore.
  const onFormat = (format: AudioFormat) =>
    setExportSettings({ audioFormat: format, bitDepth: clampDepth(format, exportSettings.bitDepth) });

  return (
    <div className="settings-card">
      <span className="section-label">PLAYBACK &amp; EXPORT</span>
      <div className="hint">applies to future generations, splits and Remaster runs — doesn't touch anything already in the library</div>

      <Slider
        label="DEFAULT VOLUME"
        value={Math.round(exportSettings.volume * 100)}
        min={0}
        max={100}
        step={5}
        onChange={(v) => setExportSettings({ volume: v / 100 })}
      />

      <CustomSelect
        label="OUTPUT FORMAT"
        value={exportSettings.audioFormat}
        onChange={(v) => onFormat(v as AudioFormat)}
        options={FORMAT_OPTIONS}
      />

      <CustomSelect
        label="SAMPLE RATE"
        value={String(exportSettings.sampleRate)}
        onChange={(v) => setExportSettings({ sampleRate: Number(v) as SampleRate })}
        options={SAMPLE_RATES.map((r) => ({
          label: `${r / 1000} kHz`.replace('44 kHz', '44.1 kHz'),
          value: String(r),
          description: RATE_DESCRIPTION[r],
        }))}
      />

      {depths.length > 0 && (
        <CustomSelect
          label="BIT DEPTH"
          value={String(exportSettings.bitDepth)}
          onChange={(v) => setExportSettings({ bitDepth: Number(v) as BitDepth })}
          options={depths.map((d) => ({
            label: depthLabel(exportSettings.audioFormat, d),
            value: String(d),
            description: d === depths[depths.length - 1] ? 'Highest this format holds' : undefined,
          }))}
        />
      )}

      {exportSettings.audioFormat === 'mp3' && (
        <CustomSelect
          label="BITRATE"
          value={String(exportSettings.mp3Bitrate)}
          onChange={(v) => setExportSettings({ mp3Bitrate: Number(v) as Mp3Bitrate })}
          options={MP3_BITRATES.map((b) => ({
            label: `${b} KBPS`,
            value: String(b),
            description: b === 320 ? 'Highest MP3 supports' : undefined,
          }))}
        />
      )}

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
