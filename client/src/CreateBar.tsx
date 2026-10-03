import { Fragment, useState } from 'react';
import { api } from './api';
import { useGpuBusy } from './queueStore';
import type { CreateDraft } from './createDraft';

interface Props {
  onCreate: (draft: CreateDraft) => void;
}

/** Slim capture row — hands off to the Create takeover screen immediately rather than
 * generating inline. A typed idea is carried over as `pendingQuery`; CreateView expands
 * it into a full draft via the LM and plays the "AI thinking" reveal there
 * (useThinkingQuery.ts) so the library never blocks on the LM call. */
export function CreateBar({ onCreate }: Props) {
  const [draft, setDraft] = useState('');
  const [luckyLoading, setLuckyLoading] = useState(false);
  const [luckyError, setLuckyError] = useState('');
  const gpuBusy = useGpuBusy();

  const create = () => {
    onCreate(draft.trim() ? { genType: 'prompt', pendingQuery: draft.trim() } : {});
  };

  const feelingLucky = async () => {
    setLuckyError('');
    setLuckyLoading(true);
    try {
      setDraft((await api.randomSample()).caption);
    } catch (err) {
      setLuckyError(err instanceof Error ? err.message : String(err));
    } finally {
      setLuckyLoading(false);
    }
  };


  return (
    <Fragment>
      <div className="create-bar">
        <button
          className={luckyLoading ? 'lucky-btn loading' : 'lucky-btn'}
          disabled={luckyLoading || gpuBusy}
          onClick={feelingLucky}
        >
          {luckyLoading ? 'ROLLING…' : 'FEELING LUCKY'}
        </button>
        <input
          placeholder="What do you want to make?"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button className="acid" onClick={create}>CREATE</button>
      </div>
      {luckyError && <div className="error">{luckyError} <button onClick={feelingLucky}>RETRY</button></div>}
    </Fragment>
  );
}
