import { useEffect, type ReactNode } from 'react';
import { CustomSelect } from './CustomSelect';
import { useLookup, modelsFor, checkingModels } from './lookup';

/** A SONG I HAVE / ONE TRACK's own MODEL pick (only models that can run the flow's task):
 * loads the list, auto-picks `prefer`'s choice into an empty draft, and returns the select for
 * TUNE plus `problem` — the line that explains a commit held off by the list (loading, failed,
 * or no model can run the task), shown beside the commit since TUNE starts collapsed. */
export function useFlowModel({ task, name, model, setModel, prefer, none }: {
  task: 'cover' | 'complete';
  /** How the error line names the flow ("Cover", "Arrange"). */
  name: string;
  model: string;
  setModel: (m: string) => void;
  prefer: (models: string[]) => string;
  none: string;
}): { ready: boolean; noModel: boolean; preferred: string; control: ReactNode; problem: ReactNode } {
  const lookup = useLookup(() => modelsFor(task));
  const models = lookup.data;
  const preferred = models ? prefer(models) : '';
  useEffect(() => {
    if (models && !model) setModel(preferred);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [models, model]);

  const problem = lookup.error ? (
    <div className="error">couldn&apos;t check models for {name} — {lookup.error} <button onClick={lookup.retry}>RETRY</button></div>
  ) : models === null ? (
    <span className="meta">{checkingModels(lookup)}</span>
  ) : models.length === 0 ? (
    <span className="meta" style={{ color: 'var(--rust-text)' }}>{none}</span>
  ) : null;
  const control = problem ?? (
    <CustomSelect label="MODEL" value={model} onChange={setModel} options={(models ?? []).map((m) => ({ label: m.toUpperCase(), value: m }))} />
  );
  return { ready: !!model && (models?.length ?? 0) > 0, noModel: models?.length === 0, preferred, control, problem };
}
