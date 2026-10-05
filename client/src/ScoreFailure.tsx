import { fillLabel, limitHint } from './scoreCopy';

interface Props {
  title: string;
  reasons: string[];
  /** What to do next, after the reasons. */
  tail: string;
  /** FILL: types the cut hint's words into the request field; sends nothing (Q-048). */
  onFill?: (words: string) => void;
}

/** A rust failure with one line per cause (a limit line that names a section reads as its hint, with FILL):
 * CHECK FAILED after a PLAN, REVISE FAILED over the kept plan (M2-7). */
export function ScoreFailure({ title, reasons, tail, onFill }: Props) {
  const hints = reasons.map(limitHint);
  const fill = hints.find(Boolean)?.fill;
  return (
    <div className="score-error" role="alert">
      <div>
        <b>{title}</b>
        {reasons.map((r, i) => {
          const h = hints[i];
          return <div key={i}>{h ? <><b>{h.title}</b> · {h.body}</> : r}</div>;
        })}
        {tail}
      </div>
      {fill && onFill && (
        <button type="button" className="tab dock-quiet" onClick={() => onFill(fill)}><span>{fillLabel(fill)}</span></button>
      )}
    </div>
  );
}
