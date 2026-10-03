import type { ReactNode } from 'react';
import { GenerateButton } from './GenerateButton';

/** The foot of the RECIPE card: the flow's one filled acid commit, then its consequence copy
 * and blockers (`children`), then a failed submit with RETRY. */
export function RecipeCommit({ label, submitting, blocked, disabled, onClick, error, children }: {
  label: string;
  submitting: boolean;
  blocked: string | null;
  disabled: boolean;
  onClick: () => void;
  error: string;
  children?: ReactNode;
}) {
  return (
    <div className="recipe-commit">
      <GenerateButton submitting={submitting} blocked={blocked} label={label} disabled={disabled} onClick={onClick} />
      {children}
      {error && <div className="error">{error} <button onClick={onClick}>RETRY</button></div>}
    </div>
  );
}
