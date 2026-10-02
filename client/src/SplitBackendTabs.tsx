import type { SplitHealth } from './api';
import type { Lookup } from './lookup';
import { splitBackendTitle, splitServiceLabel } from './splitBackend';

type Backend = 'acestep' | 'demucs';

interface Props {
  lookup: Lookup<SplitHealth> & { retry: () => void };
  model: Backend | null;
  onPick: (model: Backend) => void;
}

/** The ACE-STEP / UVR-or-DEMUCS picker shared by the Editor's SplitPanel and Create's
 * ScratchSplitPicker. A backend the server couldn't ask gets its own rust line with
 * RETRY; the other backend stays pickable. */
export function SplitBackendTabs({ lookup, model, onPick }: Props) {
  const health = lookup.data;
  if (lookup.error) {
    return (
      <div className="error">
        couldn't check split backends — {lookup.error} <button onClick={lookup.retry}>RETRY</button>
      </div>
    );
  }
  if (!health) return <span className="meta">checking available backends…</span>;

  const tab = (backend: Backend, label: string) => (
    <button
      className={`tab${model === backend ? ' active' : ''}`}
      disabled={!health[backend]}
      title={splitBackendTitle(health, backend)}
      onClick={() => onPick(backend)}
    >
      <span>{label}</span>
    </button>
  );

  return (
    <>
      {health.acestepError && (
        <div className="error">
          couldn't check ACE-Step — {health.acestepError} <button onClick={lookup.retry}>RETRY</button>
        </div>
      )}
      <div className="type-tabs">
        {tab('acestep', 'ACE-STEP')}
        {tab('demucs', splitServiceLabel(health))}
      </div>
    </>
  );
}
