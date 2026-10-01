import { useEffect, useState } from 'react';
import { api, type EngineId, type ScoreSize } from './api';
import { sizeFits } from './scoreCut';

/** One measurement per score: the review and GENERATE COVER both ask, and leaving sections out
 * re-sums locally rather than measuring again. A failed measurement is forgotten, so the next
 * render can retry it. */
const measured = new Map<string, Promise<ScoreSize | null>>();

function measure(engine: EngineId, abc: string): Promise<ScoreSize | null> {
  const key = `${engine}\n${abc}`;
  let pending = measured.get(key);
  if (!pending) {
    pending = api.scoreSize(engine, abc).catch((err: unknown) => {
      measured.delete(key);
      throw err;
    });
    measured.set(key, pending);
  }
  return pending;
}

interface SizeState {
  /** Null while measuring, when the engine can't say, or when it failed. */
  size: ScoreSize | null;
  error: string;
}

/** The planner-token size of a cover's whole score, per section (PLAN.md "YuE2 Covers: Pick the
 * Score's Sections"). `abc` is the full score, not the cut: the cut is summed from this. */
export function useScoreSize(engine: EngineId, abc: string | null): SizeState {
  const key = abc ? `${engine}\n${abc}` : '';
  const [state, setState] = useState<SizeState & { key: string }>({ key: '', size: null, error: '' });
  useEffect(() => {
    if (!abc) return;
    let live = true;
    measure(engine, abc).then(
      (size) => { if (live) setState({ key, size: sizeFits(abc, size) ? size : null, error: '' }); },
      (err: unknown) => { if (live) setState({ key, size: null, error: err instanceof Error ? err.message : String(err) }); },
    );
    return () => { live = false; };
  }, [engine, abc, key]);
  return state.key === key ? state : { size: null, error: '' };
}
