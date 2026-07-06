import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AIGeneratingBackground } from './AIGeneratingBackground';
import type { GenerationJob } from './generationStore';

const STAGE_LABEL: Record<GenerationJob['stage'], string> = {
  loading: 'LOADING MODEL',
  running: 'GENERATING',
  done: 'DONE',
  failed: 'FAILED',
};

function fmtElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

interface Props {
  job: GenerationJob;
  onRetry: () => void;
}

/** Pinned card at the top of the library grid while a song is generating — spans the
 * full grid width per docs/design/DESIGN.md's acid = "commit action in progress"
 * semantics, then shrinks to a normal row's footprint once done (see App.tsx, which
 * unmounts it shortly after the real song row appears from the library refresh). */
export function GeneratingCard({ job, onRetry }: Props) {
  const [now, setNow] = useState(Date.now());
  const failed = job.stage === 'failed';
  const shrunk = job.stage === 'done';

  useEffect(() => {
    if (shrunk) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [shrunk]);

  return (
    <motion.div
      layout
      className={failed ? 'row generating failed' : shrunk ? 'row generating shrunk' : 'row generating'}
      style={{ gridColumn: shrunk ? undefined : '1 / -1' }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      {!shrunk && !failed && <AIGeneratingBackground />}
      <div className="generating-body">
        <div className="row-main">
          <span className="song-title">{job.title}</span>
          {!shrunk && <span className="meta">{job.caption}</span>}
        </div>
        {!shrunk && (
          <div className="generating-status">
            <span className={failed ? 'stage-label failed' : 'stage-label'}>{STAGE_LABEL[job.stage]}</span>
            {!failed && <span className="meta">{fmtElapsed(now - job.startedAt)} elapsed</span>}
          </div>
        )}
      </div>
      {failed && (
        <div className="error">
          {job.error ?? 'generation failed'} <button onClick={onRetry}>RETRY</button>
        </div>
      )}
    </motion.div>
  );
}
