import { useEffect, useRef, useState } from 'react';
import { api, type ModelInventory, type Song } from './api';
import { useCreateDraftStore } from './createDraftStore';
import { useTranscribeStore } from './transcribeStore';
import { useEngineCaps } from './useEngineCaps';
import { coverSourceReady, resolveCoverSource } from './coverSource';
import { engineLockedBy, sourceLockedBy } from './coverDraft';
import { useAnalyzeSourceAudio } from './useAnalyzeSourceAudio';
import { CoverSourcePicker } from './CoverSourcePicker';
import { CoverEngineChoice } from './EngineChoice';
import { sectionOutline } from './coverLyrics';
import { YueScoreReview } from './YueScoreReview';
import { YueCoverAnalyze } from './YueCoverAnalyze';
import { YueCoverLyrics } from './YueCoverLyrics';
import { YueCoverCommit } from './YueCoverCommit';
import { useReadLyrics } from './YueReadLyrics';
import { AutoTextarea } from './AutoTextarea';
import { CarriedPromptNote } from './CarriedPromptNote';
import type { Lookup } from './lookup';
import { CreateStep } from './CreateStep';
import { RecipeCard } from './RecipeCard';
import { GenTune } from './GenTune';

/** A SONG I HAVE on an extra engine (PLAN.md "YuE2 Melody Covers via SheetSage2", "Client cover
 * decisions"): PICK THE SONG → TRANSCRIBE → review → WHAT CHANGES? → LYRICS, then GENERATE COVER
 * on the RECIPE card. The score lives in the draft, so style, lyrics or seed can change without
 * transcribing again; step 1 holds everything that reads the source. */
export function YueCoverPanel({ songs, onBack, noCoverModel, inventory }: {
  songs: Song[]; onBack: () => void; noCoverModel: boolean; inventory: Lookup<ModelInventory> & { retry: () => void };
}) {
  const audio = useCreateDraftStore((s) => s.audio);
  const lyrics = useCreateDraftStore((s) => s.lyrics);
  const prompt = useCreateDraftStore((s) => s.prompt);
  const reusedFrom = useCreateDraftStore((s) => s.reusedFrom);
  const patch = useCreateDraftStore((s) => s.patch);
  const patchAudio = useCreateDraftStore((s) => s.patchAudio);
  const tr = useTranscribeStore();
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

  // Each store's `running` covers its job's wait in the server's queue too, so SOURCE and ENGINE
  // hold still from submit to result. Another job on the GPU holds nothing here: these queue.
  const transcribing = tr.stage === 'running' || preparing;
  const read = useReadLyrics(songs, transcribing);
  const running = transcribing || read.running;
  const analysis = useAnalyzeSourceAudio();
  const jobs = { transcribing, reading: read.running, analyzing: analysis.analyzing };
  // A generation doesn't hold it: GENERATE COVER sends the score, which the request carries.
  const lockedBy = sourceLockedBy({ ...jobs, generating: false });
  const transcribe = async () => {
    setError('');
    setPreparing(true);
    try {
      const song = audio.source === 'library' ? songs.find((s) => s.id === audio.selectedSongId) : undefined;
      const blob = await resolveCoverSource(audio); // a library song is bounced down client-side first
      setPreparing(false);
      const label = song?.title ?? audio.uploadFile?.name ?? 'source';
      const lyricsOpen = await tr.start(engine, blob, label, song?.lyrics ?? '');
      await read.auto(blob, label, lyricsOpen);
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
  const autoRead = audio.source === 'upload' && read.autoOn;
  return (
    <>
      <div className="create-steps">
        <CreateStep n={1} title="PICK THE SONG">
          <CoverSourcePicker songs={songs} lockedBy={lockedBy}
            satisfied={coverSourceReady(audio) || !!score || !!audio.reuseScore} />
          <div className="score-actions">
            <button className="acid-outline" disabled={!coverSourceReady(audio) || running || unavailable} onClick={transcribe}>
              <span>{label}</span>
            </button>
            {read.button}
            <button type="button" className="tag-guide-btn" disabled={running} onClick={() => fileRef.current?.click()}>
              <span>USE .ABC FILE</span>
            </button>
            <input ref={fileRef} type="file" accept=".abc,.txt,text/plain" hidden
              onChange={(e) => { void loadScoreFile(e.target.files?.[0]); e.target.value = ''; }} />
          </div>
          <div className="hint">
            TRANSCRIBE reads the source&apos;s melody into a score
            {autoRead && ' · then READ LYRICS reads its words into LYRICS, unless they hold yours'}
            {' '}· nothing is saved to your library · USE .ABC FILE swaps in a score you corrected elsewhere
          </div>
          {read.notes}
          {(error || tr.error) && <div className="error">{error || tr.error}</div>}
          {reuse && !score && <span className="meta">loading the earlier cover&apos;s score…</span>}
          {score && <YueScoreReview engine={engine} score={score} />}
        </CreateStep>
        <CreateStep n={2} title="WHAT CHANGES?">
          <AutoTextarea placeholder="Describe the cover — style, mood, instruments, voice. The melody comes from the score."
            value={prompt} onChange={(v) => patch({ prompt: v })} />
          <CarriedPromptNote />
          <YueCoverAnalyze analysis={analysis} blocked={running} noModel={noCoverModel} />
        </CreateStep>
        <YueCoverLyrics />
      </div>
      <RecipeCard stepsModel="" coverStepsAhead={score ? 1 : autoRead ? 3 : 2}
        engine={<CoverEngineChoice lockedBy={engineLockedBy(jobs)} />}
        tune={<GenTune inventory={inventory} stepsModel="" />}
        commit={<YueCoverCommit onBack={onBack} blocked={running} />} />
    </>
  );
}
