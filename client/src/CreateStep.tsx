import type { ReactNode } from 'react';

/** One numbered step of a START FROM flow (PLAN.md "S2 — Guided Create", point 2): a
 * parallelogram number, the step's label row (with `sub` copy and right-aligned `actions`),
 * then its fields. `optional` steps get a quiet number, the ones the flow needs a bright one. */
export function CreateStep({ n, title, sub, actions, optional, children }: {
  n: number;
  title: string;
  sub?: ReactNode;
  actions?: ReactNode;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="create-step">
      <span className={optional ? 'step-num optional' : 'step-num'}>{n}</span>
      <div className="step-body">
        <div className="step-head">
          <span className="step-title">{title}</span>
          {sub && <span className="step-sub">{sub}</span>}
          {actions && <span className="step-actions">{actions}</span>}
        </div>
        {children}
      </div>
    </section>
  );
}
