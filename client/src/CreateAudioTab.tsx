import { useEffect, useState } from 'react';
import { api, type Song } from './api';
import { CustomSelect } from './CustomSelect';
import { VarianceSlider } from './SettingsPanel';
import { AIGeneratingBackground } from './AIGeneratingBackground';
import { motion } from 'framer-motion';
import type { CreateDraft, Source } from './createDraft';
import { useGenerationStore } from './generationStore';
import { useVoiceStore } from './voiceStore';
import { useModelsForTask } from './useModelsForTask';
import { activeLayers } from './mix/activeLayers';
import { decodeLayers } from './mix/decodeLayers';
import { bounceMix, encodeWav } from './mix/bounceMix';
import { AutoTextarea } from './AutoTextarea';

interface Props {
  songs: Song[];
  title: string;
  initialDraft: CreateDraft;
  onBack: () => void;
}

/** AUDIO tab: "create cover from audio" — a `cover` generation conditioned on an uploaded
 * file or a client-bounced mix of an existing library song, persisted as a brand-new song.
 * Owns all of its own source/model/variance state, isolated from the PROMPT tab. */
export function CreateAudioTab({ songs, title, initialDraft, onBack }: Props) {
  const [source, setSource] = useState<Source>(initialDraft.source ?? 'upload');
  const [librarySearch, setLibrarySearch] = useState('');
  const [selectedSongId, setSelectedSongId] = useState<string | null>(initialDraft.selectedSongId ?? null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [prompt, setPrompt] = useState(initialDraft.prompt ?? '');
  const [model, setModel] = useState('');
  // VARIANCE 0-1, inverse of audio_cover_strength — same convention as repaint's slider
  // (settings.ts's repaintStrength): higher VARIANCE = more freedom from the source.
  const [variance, setVariance] = useState(0.5);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const coverModels = useModelsForTask('cover');
  useEffect(() => {
    if (coverModels && !model) setModel(coverModels.find((n) => n.includes('xl-sft')) ?? coverModels[0] ?? '');
  }, [coverModels, model]);

  const genJob = useGenerationStore((s) => s.job);
  const startFromAudio = useGenerationStore((s) => s.startFromAudio);
  const dismiss = useGenerationStore((s) => s.dismiss);
  const voice = useVoiceStore();
  const busy = submitting || !!genJob;

  const visibleLibrary = songs.filter((s) => s.title.toLowerCase().includes(librarySearch.toLowerCase()));
  const sourceReady = source === 'upload' ? !!uploadFile : !!selectedSongId;
  const ready = sourceReady && !!model && (coverModels?.length ?? 0) > 0;

  /** The raw upload as-is, or the current audible mix of a library song bounced down
   * client-side (same decode/mix/encode pipeline RemasterAction.tsx uses). */
  const resolveSrcAudio = async (): Promise<Blob> => {
    if (source === 'upload') {
      if (!uploadFile) throw new Error('choose an audio file to upload');
      return uploadFile;
    }
    if (!selectedSongId) throw new Error('choose a song from your library');
    const detail = await api.songDetail(selectedSongId);
    const audible = activeLayers(detail.layers)
      .map((l) => ({ layer: l, version: l.versions.find((v) => v.active) }))
      .filter((x): x is { layer: typeof x.layer; version: NonNullable<typeof x.version> } => !!x.version);
    if (audible.length === 0) throw new Error('that song has no audible layers to use as a source');
    const mixCtx = new AudioContext();
    const decoded = await decodeLayers(
      audible.map((x, i) => ({ id: String(i), audioUrl: `/audio/${x.version.audio_file}`, volume: x.layer.volume })),
      mixCtx,
    );
    const mixed = await bounceMix(decoded);
    await mixCtx.close();
    return encodeWav(mixed);
  };

  const generate = async () => {
    setError('');
    setSubmitting(true);
    const draft: CreateDraft = { genType: 'audio', source, selectedSongId: selectedSongId ?? undefined, prompt };
    try {
      const srcAudio = await resolveSrcAudio();
      await startFromAudio(
        {
          title: title || 'Untitled', prompt, model, audio_cover_strength: 1 - variance,
          ...(voice.selectedVoiceId ? { voice_id: voice.selectedVoiceId } : {}),
        },
        srcAudio,
        draft,
        voice.uploadedRefFile ?? undefined,
      );
      const failure = useGenerationStore.getState().job;
      if (failure?.stage === 'failed') {
        setError(failure.error ?? 'generation failed');
        dismiss();
        return;
      }
      onBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="section-label">SOURCE</div>
      <div className="type-tabs">
        <button className={source === 'upload' ? 'tab active' : 'tab'} onClick={() => setSource('upload')}><span>UPLOAD</span></button>
        <button className={source === 'library' ? 'tab active' : 'tab'} onClick={() => setSource('library')}><span>FROM LIBRARY</span></button>
      </div>
      {source === 'upload' ? (
        <label className="dropzone">
          <input type="file" accept="audio/*" style={{ display: 'none' }} onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)} />
          {uploadFile ? uploadFile.name : 'drag audio file here or click to browse'}
        </label>
      ) : (
        <div className="song-picker">
          <input placeholder="Search your library…" value={librarySearch} onChange={(e) => setLibrarySearch(e.target.value)} />
          <div className="song-picker-list">
            {visibleLibrary.map((s) => (
              <div key={s.id} className={s.id === selectedSongId ? 'song-pick current' : 'song-pick'} onClick={() => setSelectedSongId(s.id)}>
                {s.title}
              </div>
            ))}
            {visibleLibrary.length === 0 && <div className="empty">No songs match.</div>}
          </div>
        </div>
      )}
      {coverModels === null ? (
        <span className="meta">checking available models…</span>
      ) : coverModels.length === 0 ? (
        <span className="meta" style={{ color: 'var(--rust-text)' }}>no downloaded model supports cover generation</span>
      ) : (
        <CustomSelect label="MODEL" value={model} onChange={setModel} options={coverModels.map((m) => ({ label: m.toUpperCase(), value: m }))} />
      )}
      <VarianceSlider value={Math.round(variance * 100)} onChange={(v) => setVariance(v / 100)} />

      <AutoTextarea
        placeholder="Optional — describe the change (style, mood, instruments). Leave blank to follow the source as-is."
        value={prompt}
        onChange={setPrompt}
      />

      <div className="generate-row">
        <motion.button
          className="acid"
          animate={submitting ? { skewX: 0, backgroundColor: 'transparent', color: '#D4FF00' } : { skewX: -10, backgroundColor: '#D4FF00', color: '#1C1D21' }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          style={{ position: 'relative', overflow: 'hidden' }}
          disabled={busy || !ready}
          onClick={generate}
        >
          {submitting ? (
            <>
              <AIGeneratingBackground />
              <span style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>STARTING…</span>
            </>
          ) : genJob ? 'A GENERATION IS ALREADY RUNNING' : 'GENERATE COVER'}
        </motion.button>
      </div>
      <div className="hint">Renders a new song conditioned on the chosen source track — can take several minutes.</div>
      {error && <div className="error">{error} <button onClick={generate}>RETRY</button></div>}
    </>
  );
}
