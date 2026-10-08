import type { EngineCapabilities } from './api';
import type { CreateDraft } from './createDraft';
import type { CoverScore } from './coverDraft';
import { useCreateDraftStore } from './createDraftStore';
import { useGenerationStore } from './generationStore';
import { useEngineCaps } from './useEngineCaps';
import { useSettings, outputParams } from './settings';
import { AUTO_CONTROLS, useEngineSettings } from './engineSettings';
import { coverParams } from './engineRequest';
import { hasWords } from './coverLyrics';
import { keptTokens, splitScore, sungScore } from './scoreCut';
import { useScoreSize } from './useScoreSize';
import { recipeEtaKey } from './recipeCopy';
import { useCreateSubmit } from './useCreateSubmit';
import { RecipeCommit } from './RecipeCommit';

/** GENERATE COVER on an extra engine, at the foot of the RECIPE card (the commit half of the
 * old YueCoverGenerate.tsx): sings the draft's score, with the consequence line naming what is
 * left out and an instrumental. `blocked` = the panel's own jobs or another job's lock. */
export function YueCoverCommit({ onBack, blocked }: { onBack: () => void; blocked: boolean }) {
  const draft = useCreateDraftStore();
  const { title, prompt, lyrics, vocalLanguage, folderId } = draft;
  const score = draft.audio.yueScore;
  const { id: engine, info, unavailable } = useEngineCaps();
  const gen = useSettings((s) => s.gen);
  const controls = useEngineSettings((s) => s.values[engine]);
  const startCover = useGenerationStore((s) => s.startCover);
  const { submitting, error, submit } = useCreateSubmit(onBack, recipeEtaKey('audio', engine, '', gen.quality));

  const caps = info?.capabilities ?? null;
  const { size } = useScoreSize(engine, score?.abc ?? null);
  const overBudget = !!score && !!size && keptTokens(size, score.dropped) > size.budget;
  const leftOut = score?.dropped?.length
    ? splitScore(score.abc).sections.filter((_, i) => score.dropped!.includes(i)).map((s) => s.name.toUpperCase()) : [];
  const instrumental = !hasWords(lyrics);

  const generate = () => {
    if (score && caps) void submit(() => sing(score, caps));
  };
  const sing = async (score: CoverScore, caps: EngineCapabilities) => {
    const retry: CreateDraft = {
      genType: 'audio', coverEngine: engine, coverScore: score, prompt, lyrics,
      source: draft.audio.source, selectedSongId: draft.audio.selectedSongId ?? undefined,
      ...(folderId ? { folderId, folderName: draft.folderName } : {}),
    };
    return startCover(engine, coverParams(
      { title: title || 'Untitled', prompt, lyrics, vocalLanguage, folderId }, caps, gen,
      { ...AUTO_CONTROLS, ...controls }, outputParams(), { abc: sungScore(score), source: score.source, notationId: score.notationId },
    ) as { title: string; prompt: string }, retry);
  };

  return (
    <RecipeCommit label="GENERATE COVER" submitting={submitting} error={error} onClick={generate}
      disabled={submitting || blocked || unavailable || !score || !caps || overBudget}>
      <div className="hint">
        {info?.label ?? 'YUE2'} melody cover · keeps the source&apos;s melody, not its voice or sound
        {instrumental ? ' · no lyrics: an instrumental, where an instrument plays the melody, followed more loosely' : ''}
        {leftOut.length ? ` · leaves out ${leftOut.join(', ')}` : ''}
        {' '}· length follows the score · ~95 s per 3-minute song on an RTX 4080 · result will be saved as a new song ·
        later edits use ACE-Step
      </div>
      {!score && <div className="hint">TRANSCRIBE a source, or USE .ABC FILE, to get a score to cover</div>}
    </RecipeCommit>
  );
}
