import { Fragment, useState } from 'react';
import { useLuckyRoll } from './lmJob';
import type { CreateDraft } from './createDraft';
import { CreateBarChips } from './CreateBarChips';
import { useCreateBusy } from './useCreateBusy';

interface Props {
  onCreate: (draft: CreateDraft) => void;
  /** TO CREATE while Create is busy: opens it on the draft (or the idea it is thinking about). */
  onResume: () => void;
}

/** Slim capture row — hands off to the Create takeover screen immediately rather than
 * generating inline. A typed idea is carried over as `pendingQuery`; CreateView expands
 * it into a full draft via the LM and plays the "AI thinking" reveal there
 * (quickStartStore.ts) so the library never blocks on the LM call. */
export function CreateBar({ onCreate, onResume }: Props) {
  const [draft, setDraft] = useState('');
  const lucky = useLuckyRoll();
  const { busy } = useCreateBusy();

  const create = () => {
    onCreate(draft.trim() ? { genType: 'prompt', pendingQuery: draft.trim() } : {});
  };

  const feelingLucky = () => lucky.roll((sample) => setDraft(sample.caption));

  return (
    <Fragment>
      <div className={busy ? 'create-bar busy' : 'create-bar'}>
        {!busy && (
          <button
            className={lucky.rolling ? 'lucky-btn loading' : 'lucky-btn'}
            disabled={lucky.rolling}
            onClick={feelingLucky}
          >
            {lucky.rolling ? 'ROLLING…' : 'FEELING LUCKY'}
          </button>
        )}
        <CreateBarChips />
        {!busy && (
          <input
            placeholder="What do you want to make?"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
        )}
        {busy
          ? <button className="acid" onClick={onResume}>TO CREATE</button>
          : <button className="acid" onClick={create}>CREATE</button>}
      </div>
      {!busy && lucky.waitNote && <div className="hint">{lucky.waitNote}</div>}
      {!busy && lucky.error && <div className="error">{lucky.error} <button onClick={feelingLucky}>RETRY</button></div>}
    </Fragment>
  );
}
