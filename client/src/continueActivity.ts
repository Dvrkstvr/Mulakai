/** What a Library CONTINUE card says is still open on its song (PLAN.md "The other screens"): a job running or
 * queued for it, in words ("repainting 1:02–1:31 · BASE"), and a split whose stems are not all kept ("3 stems
 * unkept"). Labels are the server queue's (repaintJobs.ts, replayJobs.ts, addLayerJobs.ts, stemSplit.ts). Pure. */
import type { QueueRunning, StemResult } from './api';

type QueuedJob = Pick<QueueRunning, 'kind' | 'songId' | 'layer' | 'label'>;

interface OpenSplit {
  songId: string;
  stage: 'running' | 'done' | 'failed';
  stems: Pick<StemResult, 'status' | 'claimed'>[];
}

/** One job in words, or null for a brief helper that is not work on the song (✦ HELP, word timings). */
export function jobDoing(job: QueuedJob): string | null {
  const label = (job.label ?? '').trim();
  const layer = job.layer ? ` · ${job.layer.toUpperCase()}` : '';
  let m: RegExpMatchArray | null;
  if (label === 'help' || label === 'word timings') return null;
  if ((m = label.match(/^repaint (.+)$/))) return `repainting ${m[1]}${layer}`;
  if ((m = label.match(/^alt:? (.+)$/))) return `rerolling ${m[1]}${layer}`;
  if ((m = label.match(/^similar:? (.+)$/))) return `more like ${m[1]}${layer}`;
  if ((m = label.match(/^add (.+)$/))) return `adding ${m[1].toLowerCase()}`;
  if (job.kind === 'split') return `splitting${layer || ' a layer'}`;
  if (job.kind === 'remaster') return 'remastering the mix';
  if (job.kind === 'plan') return 'planning a score edit';
  if (job.kind === 'scoreRender') return 'rendering a score edit';
  return label || null;
}

/** Everything still open on one song: the running job, then the queued ones ("· queued"), then unkept stems. */
export function songActivity(songId: string, running: QueuedJob | null, queued: QueuedJob[], split: OpenSplit | null): string[] {
  const out: string[] = [];
  const add = (s: string | null) => { if (s && !out.includes(s)) out.push(s); };
  if (running?.songId === songId) add(jobDoing(running));
  for (const job of queued) if (job.songId === songId) { const d = jobDoing(job); add(d && `${d} · queued`); }
  if (split?.songId === songId && split.stage === 'done') {
    const unkept = split.stems.filter((s) => s.status === 'done' && !s.claimed).length;
    if (unkept) add(`${unkept} stem${unkept === 1 ? '' : 's'} unkept`);
  }
  return out;
}
