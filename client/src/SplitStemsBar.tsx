import type { StemResult } from './api';
import { queueSuffix } from './queueCopy';
import { downloadAll, splitAgainKinds, stemDownloads } from './splitDownloads';

interface Props {
  stems: StemResult[];
  layerName: string;
  /** A claim, RE-EXTRACT or SPLIT ALL AGAIN is in flight. */
  busy: boolean;
  /** Jobs ahead in the queue (useJobsAhead). */
  ahead: number;
  onSplitAgain: () => void;
}

/** SPLIT ALL AGAIN's consequence line. */
function againLine(n: number, running: boolean, layerName: string, ahead: number): string {
  if (running) return 'SPLIT ALL AGAIN waits until every stem has settled';
  if (n === 0) return 'every stem is claimed · nothing left to split again';
  const what = n === 1 ? 'the unclaimed stem' : `the ${n} unclaimed stems`;
  return `SPLIT ALL AGAIN re-extracts ${what} from ${layerName.toUpperCase()} · replaces ${n === 1 ? 'its current take' : 'their current takes'}${queueSuffix(ahead)}`;
}

/** Above the SPLIT dock's stem rows: DOWNLOAD ALL (every ready, unclaimed take) and SPLIT ALL AGAIN (one queue job
 * re-takes every unclaimed stem; claimed ones stay), with its consequence line. */
export function SplitStemsBar({ stems, layerName, busy, ahead, onSplitAgain }: Props) {
  const downloads = stemDownloads(stems, layerName);
  const n = splitAgainKinds(stems).length;
  const running = stems.some((s) => s.status === 'running');
  return (
    <div className="split-stems-bar">
      <span className="btn-row">
        <button disabled={downloads.length === 0} onClick={() => downloadAll(downloads)}><span>DOWNLOAD ALL</span></button>
        <button disabled={running || busy || n === 0} onClick={onSplitAgain}><span>SPLIT ALL AGAIN</span></button>
      </span>
      <div className="hint">{againLine(n, running, layerName, ahead)}</div>
    </div>
  );
}
