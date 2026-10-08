import { useEffect, useReducer, useState } from 'react';
import { BpmChip } from './BpmChip';
import { BPM_CHIP, bpmField } from './bpmField';
import { chipBlocked, slightlyOff } from './retimeRules';
import { RETIME_ASK, RETIMING, retimeOffLine, retimeSlightDock } from './scoreCopy';
import { isRendering, isWaiting } from './scoreDockLines';
import { useScoreStore } from './scoreStore';
import type { ScoreVerbState } from './scoreVerbTypes';

type Mode = 'half' | 'double' | 'bpm';

/** RE-TIME in the SCORE dock (RT-4, F-093; design/retime.html C1-C4; D-240): on a cover that is still its
 * transcription, the tempo SheetSage2 read and HALF · DOUBLE · BPM… (sky choices, BPM… per D-211). A pick makes
 * the plan at once from the kept reading, no planner; the plan list, consequence line and APPLY & RENDER are
 * the dock's own. Elsewhere it says why not, in one quiet line; on a song that is not a cover, nothing. */
export function DockRetime({ songId, state }: { songId: string; state: ScoreVerbState }) {
  const offer = state.status?.retime;
  const [bpm, dispatch] = useReducer(bpmField, BPM_CHIP);
  const [busy, setBusy] = useState<Mode | null>(null);
  const planned = state.plan?.ops.length === 1 && state.plan.ops[0].op === 'RETIME' ? state.plan.ops[0] : null;
  const read = offer?.state === 'offered' ? offer.readBpm : null;
  const locked = bpm.kind === 'locked' ? bpm.bpm : null;
  const slight = read !== null && locked !== null && slightlyOff(read, locked);

  const run = async (mode: Mode, value: number | null) => {
    setBusy(mode);
    await useScoreStore.getState().retime(songId, mode, value);
    setBusy(null);
  };
  useEffect(() => {
    if (locked !== null && !slight) void run('bpm', locked);
    // a new lock is the only trigger; `run` is stable enough for that
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked, slight]);

  if (!offer || offer.state === 'none') return null;
  if (offer.state === 'refused') return <div className="hint retime-dock-off">{retimeOffLine(offer.reason)}</div>;
  const off = busy !== null || isWaiting(state) || isRendering(state);
  const pick = (mode: 'half' | 'double') => { dispatch({ type: 'reset' }); void run(mode, null); };
  const active = (m: Mode) => planned?.mode === m && state.phase.kind === 'ready';
  return (
    <>
      <div className="retime-row retime-dock">
        <span className="section-label">READ AS</span>
        <b>{read} BPM</b>
        <span className="hint">{RETIME_ASK}</span>
        <div className="dock-chips" role="radiogroup" aria-label="Re-time the score">
          {(['half', 'double'] as const).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={active(m)} disabled={off || !!chipBlocked(read!, m)}
              title={chipBlocked(read!, m) ?? undefined} className={`tab dock-chip${active(m) ? ' active' : ''}`}
              onClick={() => pick(m)}><span>{m.toUpperCase()}</span></button>
          ))}
          <BpmChip state={bpm} dispatch={dispatch} disabled={off} />
        </div>
      </div>
      {bpm.kind === 'open' && bpm.why && <div className="warn-note">{bpm.why} · type another, or click away to cancel</div>}
      {slight && <div className="hint">{retimeSlightDock(read!, locked!)}</div>}
      {busy && <div className="hint">{RETIMING}</div>}
    </>
  );
}
