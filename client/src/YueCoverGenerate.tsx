import { useState } from 'react';
import type { CreateDraft } from './createDraft';
import { useCreateDraftStore } from './createDraftStore';
import { useGenerationStore } from './generationStore';
import { useEngineCaps } from './useEngineCaps';
import { useSettings, outputParams } from './settings';
import { AUTO_CONTROLS, useEngineSettings } from './engineSettings';
import { coverParams } from './engineRequest';
import { languageOptions, liveLanguage } from './engineCaps';
import { fitLyricsToSections, hasWords, scoreSections } from './coverLyrics';
import { AutoTextarea } from './AutoTextarea';
import { CustomSelect } from './CustomSelect';
import { CarriedPromptNote } from './CarriedPromptNote';
import { GenerateButton } from './GenerateButton';

/** The second half of COVER on an engine: what to sing the score as, and GENERATE COVER. BPM /
 * KEY / TIME SIGNATURE / DURATION aren't offered — the score fixes them (PLAN.md point 5). */
export function YueCoverGenerate({ onBack, blocked }: { onBack: () => void; blocked: boolean }) {
  const draft = useCreateDraftStore();
  const { title, prompt, lyrics, vocalLanguage, folderId, patch } = draft;
  const score = draft.audio.yueScore;
  const { id: engine, info, unavailable } = useEngineCaps();
  const gen = useSettings((s) => s.gen);
  const controls = useEngineSettings((s) => s.values[engine]);
  const genJob = useGenerationStore((s) => s.job);
  const startCover = useGenerationStore((s) => s.startCover);
  const dismiss = useGenerationStore((s) => s.dismiss);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const caps = info?.capabilities ?? null;
  const sections = score ? scoreSections(score.abc) : [];
  const instrumental = !hasWords(lyrics);
  const fromUpload = draft.audio.source === 'upload' && !!score?.transcription;

  const generate = async () => {
    if (!score || !caps) return;
    setError('');
    setSubmitting(true);
    const retry: CreateDraft = {
      genType: 'audio', coverEngine: engine, coverScore: score, prompt, lyrics,
      source: draft.audio.source, selectedSongId: draft.audio.selectedSongId ?? undefined,
      ...(folderId ? { folderId, folderName: draft.folderName } : {}),
    };
    try {
      await startCover(engine, coverParams(
        { title: title || 'Untitled', prompt, lyrics, vocalLanguage, folderId }, caps, gen,
        { ...AUTO_CONTROLS, ...controls }, outputParams(), { abc: score.abc, source: score.source },
      ) as { title: string; prompt: string }, retry);
      const failure = useGenerationStore.getState().job;
      if (failure?.stage === 'failed') {
        setError(failure.error ?? 'generation failed');
        dismiss();
        return;
      }
      onBack(); // the library's GeneratingCard takes it from here
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <AutoTextarea placeholder="Describe the cover — style, mood, instruments, voice. The melody comes from the score."
        value={prompt} onChange={(v) => patch({ prompt: v })} />
      <CarriedPromptNote />
      <div className="field-label-row">
        <span className="section-label">LYRICS</span>
        {score && sections.length > 0 && (
          <button type="button" className="tag-guide-btn" onClick={() => patch({ lyrics: fitLyricsToSections(lyrics, score.abc) })}>
            <span>FIT TO SCORE</span>
          </button>
        )}
      </div>
      <AutoTextarea className="lyrics-input" placeholder="[Verse]&#10;Words to sing — only section tags, or nothing, makes an instrumental cover"
        value={lyrics} onChange={(v) => patch({ lyrics: v })} />
      {sections.length > 0 && (
        <div className="hint">
          YuE2 follows the score&apos;s sections: {sections.map((s) => `[${s}]`).join(' ')} — FIT TO SCORE puts your words under them
          {fromUpload ? ' · match the melody\'s phrasing and syllable counts' : ''}
        </div>
      )}
      <CustomSelect label="VOCAL LANGUAGE" value={liveLanguage(vocalLanguage, caps)} options={languageOptions(caps)}
        onChange={(v) => patch({ vocalLanguage: v })} />

      <GenerateButton submitting={submitting} blocked={!!genJob} label="GENERATE COVER"
        disabled={submitting || !!genJob || blocked || unavailable || !score || !caps} onClick={generate} />
      <div className="hint">
        {info?.label ?? 'YUE2'} melody cover · keeps the source&apos;s melody, not its voice or sound
        {instrumental ? ' · no lyrics: an instrumental, where an instrument plays the melody, followed more loosely' : ''}
        {' '}· length follows the score · ~95 s per 3-minute song on an RTX 4080 · result will be saved as a new song ·
        later edits use ACE-Step
      </div>
      {!score && <div className="hint">TRANSCRIBE a source, or USE .ABC FILE, to get a score to cover</div>}
      {error && <div className="error">{error} <button onClick={generate}>RETRY</button></div>}
    </>
  );
}
