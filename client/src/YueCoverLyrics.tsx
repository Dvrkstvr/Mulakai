import { useCreateDraftStore } from './createDraftStore';
import { useReadLyricsStore } from './readLyricsStore';
import { useEngineCaps } from './useEngineCaps';
import { languageOptions, liveLanguage } from './engineCaps';
import { fitLyricsToSections, scoreSections } from './coverLyrics';
import { sungScore } from './scoreCut';
import { AutoTextarea } from './AutoTextarea';
import { CustomSelect } from './CustomSelect';
import { CreateStep } from './CreateStep';

/** A SONG I HAVE · YUE2, step 3 (the lyrics half of the old YueCoverGenerate.tsx): the words to
 * sing, FIT TO SCORE onto the score's sections, and VOCAL LANGUAGE. BPM / KEY / TIME SIGNATURE /
 * DURATION aren't offered — the score fixes them (PLAN.md point 5). */
export function YueCoverLyrics() {
  const lyrics = useCreateDraftStore((s) => s.lyrics);
  const vocalLanguage = useCreateDraftStore((s) => s.vocalLanguage);
  const audio = useCreateDraftStore((s) => s.audio);
  const patch = useCreateDraftStore((s) => s.patch);
  const readPlaced = useReadLyricsStore((s) => s.placed);
  const { info } = useEngineCaps();
  const caps = info?.capabilities ?? null;
  const score = audio.yueScore;
  const sung = score ? sungScore(score) : '';
  const sections = scoreSections(sung);
  const fromUpload = audio.source === 'upload' && !!score?.transcription;
  const read = !!lyrics && lyrics === readPlaced;

  return (
    <CreateStep n={3} title="LYRICS" sub={read ? 'read from the recording · edit freely' : undefined}
      actions={score && sections.length > 0 && (
        <button type="button" className="tag-guide-btn" onClick={() => patch({ lyrics: fitLyricsToSections(lyrics, sung) })}>
          <span>FIT TO SCORE</span>
        </button>
      )}>
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
    </CreateStep>
  );
}
