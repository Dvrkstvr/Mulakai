import { useEffect, useRef, useState } from 'react';
import { api, type Song } from './api';
import { useCreateDraftStore } from './createDraftStore';
import { useGenerationStore } from './generationStore';
import { useTranscribeStore } from './transcribeStore';
import { useEngineCaps } from './useEngineCaps';
import { coverSourceReady, resolveCoverSource } from './coverSource';
import { sectionOutline } from './coverLyrics';
import { YueScoreReview } from './YueScoreReview';
import { YueCoverGenerate } from './YueCoverGenerate';
import { YueCoverAnalyze } from './YueCoverAnalyze';

/** COVER on an extra engine (PLAN.md "YuE2 Melody Covers via SheetSage2", "Client cover
 * decisions"): SOURCE → TRANSCRIBE → review → GENERATE. The source picker sits above this;
 * the score lives in the draft, so style, lyrics or seed can change without transcribing again. */
export function YueCoverPanel({ songs, onBack, noCoverModel }: { songs: Song[]; onBack: () => void; noCoverModel: boolean }) {
  const audio = useCreateDraftStore((s) => s.audio);
  const lyrics = useCreateDraftStore((s) => s.lyrics);
  const reusedFrom = useCreateDraftStore((s) => s.reusedFrom);
  const patch = useCreateDraftStore((s) => s.patch);
  const patchAudio = useCreateDraftStore((s) => s.patchAudio);
  const tr = useTranscribeStore();
  const genJob = useGenerationStore((s) => s.job);
  const otherLock = useGenerationStore((s) => s.otherLock);
  const { id: engine, unavailable } = useEngineCaps();
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const score = audio.yueScore;

  // REUSE PROMPT on an engine cover: fetch the score it was made from, once.
  const reuse = audio.reuseScore;
  useEffect(() => {
    if (!reuse || score) return;
    let live = true;
    void api.coverSourceScore(reuse.engine, reuse.songId).then((abc) => {
      if (!live) return;
      patchAudio(abc
        ? { reuseScore: null, yueScore: { abc, source: `the score of ${reusedFrom ?? 'an earlier cover'}`, transcription: null, previewJobId: null } }
        : { reuseScore: null });
    });
    return () => { live = false; };
  }, [reuse, score, reusedFrom, patchAudio]);

  const running = tr.stage === 'running' || preparing;
  const locked = !!genJob || (!!otherLock && !running);
  const transcribe = async () => {
    setError('');
    setPreparing(true);
    try {
      const song = audio.source === 'library' ? songs.find((s) => s.id === audio.selectedSongId) : undefined;
      const blob = await resolveCoverSource(audio); // a library song is bounced down client-side first
      setPreparing(false);
      await tr.start(engine, blob, song?.title ?? audio.uploadFile?.name ?? 'source', song?.lyrics ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPreparing(false);
    }
  };

  const loadScoreFile = async (file: File | undefined) => {
    if (!file) return;
    const abc = await file.text();
    patchAudio({ yueScore: { abc, source: file.name, transcription: null, previewJobId: null } });
    if (!lyrics.trim()) patch({ lyrics: sectionOutline(abc) });
  };

  const label = preparing ? 'PREPARING SOURCE…'
    : tr.stage === 'running' ? `TRANSCRIBING… ${tr.progress != null ? Math.round(tr.progress * 100) : 0}%`
      : score?.transcription ? 'TRANSCRIBE AGAIN' : 'TRANSCRIBE';
  return (
    <>
      <div className="score-actions">
        <button className="acid-outline" disabled={!coverSourceReady(audio) || running || locked || unavailable} onClick={transcribe}>
          <span>{label}</span>
        </button>
        <button type="button" className="tag-guide-btn" disabled={running} onClick={() => fileRef.current?.click()}>
          <span>USE .ABC FILE</span>
        </button>
        <input ref={fileRef} type="file" accept=".abc,.txt,text/plain" hidden
          onChange={(e) => { void loadScoreFile(e.target.files?.[0]); e.target.value = ''; }} />
      </div>
      <div className="hint">
        TRANSCRIBE reads the source&apos;s melody into a score · nothing is saved to your library · USE .ABC FILE
        swaps in a score you corrected elsewhere
      </div>
      {(error || tr.error) && <div className="error">{error || tr.error}</div>}
      {reuse && !score && <span className="meta">loading the earlier cover&apos;s score…</span>}
      {score && <YueScoreReview engine={engine} score={score} />}
      <YueCoverGenerate onBack={onBack} blocked={running || locked}
        analyze={<YueCoverAnalyze blocked={running || locked} noModel={noCoverModel} />} />
    </>
  );
}
