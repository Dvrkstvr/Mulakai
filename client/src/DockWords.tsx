import { AutoTextarea } from './AutoTextarea';
import { spanText, spliceWords, type WordsSpan } from './sectionWords';
import { HelpBox } from './HelpBox';

interface Props {
  span: WordsSpan;
  draft: string;
  songLyrics: string;
  onDraftChange: (text: string) => void;
}

/** REPAINT's words for the selected part (PLAN.md "Editor Redesign", PR 7): only the lines the selection covers, edited
 * in place in the song's text. They go with the repaint and become the song's lyrics if its take is kept. */
export function DockWords({ span, draft, songLyrics, onDraftChange }: Props) {
  const text = spanText(draft, span);
  const lines = text.split('\n').filter((l) => l.trim() && !/^\[[^\]]+\]$/.test(l.trim())).length;
  const changed = draft !== songLyrics;
  return (
    <div className="dock-words">
      <div className="setting-head">
        <span>WORDS FOR {span.label} · {lines} {lines === 1 ? 'LINE' : 'LINES'}</span>
        {changed && <button type="button" className="linkish" onClick={() => onDraftChange(songLyrics)}>RESET TO SONG</button>}
        <HelpBox kind="lyrics" layer="Base" current={text} onUse={(t) => onDraftChange(spliceWords(draft, span, t))} />
      </div>
      <AutoTextarea className="lyrics-textarea" value={text} onChange={(v) => onDraftChange(spliceWords(draft, span, v))} />
      <div className="lyrics-hint">
        {changed ? 'edited · ' : ''}sent with this repaint · they become the song&apos;s lyrics if you keep the take
      </div>
    </div>
  );
}
