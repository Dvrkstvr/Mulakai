import { CustomSelect } from './CustomSelect';
import { NaSetting, SongDetailsFields } from './SongDetailsFields';
import { TIME_SIGNATURES } from './songMeta';
import { useCreateDraftStore } from './createDraftStore';
import { useEngineCaps } from './useEngineCaps';
import { languageOptions, liveLanguage, songDetailNotes, unsupported } from './engineCaps';

/** AN IDEA's step 3, DETAILS: the song-details grid, each field AUTO until set. A field the
 * selected engine can't take stays in place as N/A, with its reason line under the grid. */
export function IdeaDetails() {
  const { bpm, keyScale, timeSignature, vocalLanguage, duration } = useCreateDraftStore();
  const patch = useCreateDraftStore((s) => s.patch);
  const { info: engine } = useEngineCaps();
  const caps = engine?.capabilities ?? null;

  return (
    <>
      <div className="song-details-grid">
        <SongDetailsFields
          bpm={bpm} onBpmChange={(v) => patch({ bpm: v })}
          duration={duration} onDurationChange={(v) => patch({ duration: v })}
          keyScale={keyScale} onKeyScaleChange={(v) => patch({ keyScale: v })} caps={caps}
        />
        {unsupported('timeSignature', caps) ? <NaSetting label="TIME SIGNATURE" /> : (
          <CustomSelect label="TIME SIGNATURE" value={timeSignature} onChange={(v) => patch({ timeSignature: v })} options={TIME_SIGNATURES} />
        )}
        {unsupported('vocalLanguage', caps) ? <NaSetting label="VOCAL LANGUAGE" /> : (
          <CustomSelect label="VOCAL LANGUAGE" value={liveLanguage(vocalLanguage, caps)} onChange={(v) => patch({ vocalLanguage: v })} options={languageOptions(caps)} />
        )}
      </div>
      {songDetailNotes(engine).map((note) => <div key={note} className="hint">{note}</div>)}
    </>
  );
}
