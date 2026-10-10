import { fmtTime } from './dockTarget';
import type { RailLyricsRow } from './railLyricsRows';
import type { Region } from './Waveform';

interface Props {
  rows: RailLyricsRow[];
  onSelect: (region: Region) => void;
}

/** The rail's LYRICS tab: the whole song's words, section by section. A heard section's header selects it; the
 * section the selection sits in is lit sky. Read-only here (editing comes with "New words", PR 7). */
export function RailLyrics({ rows, onSelect }: Props) {
  if (rows.length === 0) return <div className="rail-lyrics-empty hint">No lyrics on this song: instrumental, or none written yet.</div>;
  return (
    <div className="rail-lyrics">
      {rows.map((r, i) => (
        <div key={i} className={`rail-lyr${r.active ? ' on' : ''}`}>
          {r.region ? (
            <button type="button" className="rail-lyr-head" onClick={() => onSelect(r.region!)}
              aria-label={`Select ${r.label || 'intro'} at ${fmtTime(r.region.start)}`}>
              <span>[{r.label || 'intro'}]</span><em>{fmtTime(r.region.start)}</em>
            </button>
          ) : (
            <div className="rail-lyr-head off" title="not heard yet, so it can't be selected">
              <span>[{r.label || 'intro'}]</span><em>not timed</em>
            </div>
          )}
          {r.lines.map((l, n) => <div key={n} className="rail-lyr-line">{l}</div>)}
        </div>
      ))}
      <div className="hint">click a section's name to select it</div>
    </div>
  );
}
