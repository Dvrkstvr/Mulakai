import type { ScoreSize } from './api';
import type { CoverScore } from './coverDraft';
import { useCreateDraftStore } from './createDraftStore';
import { hasWords, sectionOutline } from './coverLyrics';
import { keptTokens, largestKept, splitScore, sungScore, toggleSection } from './scoreCut';

const count = (n: number) => n.toLocaleString('en-US');

/** The score's sections as a strip, in the Editor's section-strip idiom: kept sections are sky
 * (the scope of what will be sung), and a click leaves one out or puts it back (PLAN.md "YuE2
 * Covers: Pick the Score's Sections"). With a measurement, it sizes each by its planner tokens
 * and says whether the cut fits the budget; GENERATE COVER is off while it doesn't. */
export function ScoreSectionStrip({ score, size }: { score: CoverScore; size: ScoreSize | null }) {
  const lyrics = useCreateDraftStore((s) => s.lyrics);
  const patch = useCreateDraftStore((s) => s.patch);
  const patchAudio = useCreateDraftStore((s) => s.patchAudio);
  const { sections } = splitScore(score.abc);
  if (sections.length < 2) return null;

  const dropped = score.dropped ?? [];
  const toggle = (i: number) => {
    const next = toggleSection(sections.length, dropped, i);
    if (next === dropped) return;
    const updated = { ...score, dropped: next };
    patchAudio({ yueScore: updated });
    // A wordless outline (or an instrumental's empty LYRICS) follows the cut; words stay put.
    if (lyrics.trim() && !hasWords(lyrics)) patch({ lyrics: sectionOutline(sungScore(updated)) });
  };
  const tokens = size ? keptTokens(size, dropped) : null;
  const over = !!size && tokens! > size.budget;
  const left = sections.filter((_, i) => dropped.includes(i)).map((s) => s.name.toUpperCase());

  return (
    <div className="score-sections">
      <div className="field-label-row">
        <span className="section-label">SECTIONS</span>
        {size && <span className={over ? 'meta over' : 'meta'}>{count(tokens!)} / {count(size.budget)} TOKENS</span>}
      </div>
      <div className="section-strip">
        {sections.map((s, i) => {
          const kept = !dropped.includes(i);
          const weight = size ? size.sections[i].tokens : s.text.length;
          return (
            <button key={i} type="button" className={kept ? 'section-seg active' : 'section-seg dropped'}
              style={{ flex: `${Math.max(weight, 1)} 1 0` }} onClick={() => toggle(i)}
              title={`${s.name}${size ? ` · ${count(weight)} tokens` : ''} · click to ${kept ? 'leave it out' : 'put it back'}`}>
              <span>{s.name}</span>
            </button>
          );
        })}
      </div>
      {over && (
        <div className="warn-note">
          {count(tokens!)} / {count(size!.budget)} tokens — too long for YuE2&apos;s planner · leave sections out until
          it fits (the {largestKept(size!, dropped).join(' and ')} are the longest)
        </div>
      )}
      {left.length > 0 && (
        <div className="hint">
          covers {sections.length - left.length} of {sections.length} sections · leaves out {left.join(', ')}
          {score.previewJobId ? ' · the piano preview still plays the whole transcription' : ''}
        </div>
      )}
    </div>
  );
}
