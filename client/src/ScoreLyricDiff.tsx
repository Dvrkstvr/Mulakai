import { Fragment } from 'react';
import type { ScoreLyricDiff as Diff } from './api';
import { diffNote, diffRows } from './scoreCopy';

/** A REWRITE LYRICS row's OLD / NEW columns, always open (M2-8, Q-049): a changed line is marked "~"
 * and its new words read at text tier; then the low note that the whole song re-renders (F-031 #3). */
export function ScoreLyricDiff({ diff, baseVersion }: { diff: Diff; baseVersion: number | null | undefined }) {
  return (
    <>
      <div className="score-diff">
        <span /><span className="score-diff-head">OLD</span><span className="score-diff-head">NEW</span>
        {diffRows(diff).map((r, i) => (
          <Fragment key={i}>
            <span aria-label={r.changed ? 'changed' : 'same'}>{r.changed ? '~' : ''}</span>
            <span>{r.old}</span>
            {r.changed ? <b>{r.new}</b> : <span>{r.new}</span>}
          </Fragment>
        ))}
      </div>
      <div className="score-op-note">{diffNote(diff, baseVersion)}</div>
    </>
  );
}
