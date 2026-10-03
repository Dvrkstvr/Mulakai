import type { ReactNode } from 'react';
import { GenerateButton } from './GenerateButton';
import { queueSuffix } from './queueCopy';
import { useJobsAhead } from './queueStore';

/** The foot of the RECIPE card: the flow's one filled acid commit, then its consequence copy
 * (`children`) and, while ACE-Step is busy, when the new song starts — a busy GPU never holds
 * the commit, the server queues it (PLAN.md "UI Redesign", S4.7) — then a failed submit (a full
 * queue, say) with RETRY. */
export function RecipeCommit({ label, submitting, disabled, onClick, error, children }: {
  label: string;
  submitting: boolean;
  disabled: boolean;
  onClick: () => void;
  error: string;
  children?: ReactNode;
}) {
  const ahead = useJobsAhead();
  return (
    <div className="recipe-commit">
      <GenerateButton submitting={submitting} label={label} disabled={disabled} onClick={onClick} />
      {children}
      {ahead > 0 && <div className="hint queue-note">waits its turn{queueSuffix(ahead)}</div>}
      {error && <div className="error">{error} <button onClick={onClick}>RETRY</button></div>}
    </div>
  );
}
