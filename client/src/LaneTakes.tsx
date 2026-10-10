import type { TakeChip } from './laneTakeChips';

interface Props {
  chips: TakeChip[];
  /** The take being heard in place (A/B), if it is one of this lane's. */
  hearing: string | null;
  onUse: (versionId: string) => void;
  onHear: (versionId: string) => void;
}

/** A lane header's takes (PLAN.md "Editor Redesign", PR 8): lilac chips, the active one filled. A click uses that take;
 * alt-click hears it here at the same position without using it. A take still being made is a dashed chip. */
export function LaneTakes({ chips, hearing, onUse, onHear }: Props) {
  return (
    <span className="lane-takes" onClick={(e) => e.stopPropagation()}>
      {chips.map((c) => {
        if (c.kind === 'more') return <span key="more" className="lane-take more" title={`${c.count} older takes in TAKES`}>+{c.count}</span>;
        if (c.kind === 'running') {
          return <span key={c.key} className="lane-take running" title={c.queued ? `v${c.number} · waiting in the queue` : `v${c.number} · ${c.label}`}>v{c.number}…</span>;
        }
        const cls = `lane-take${c.active ? ' active' : ''}${hearing === c.versionId ? ' hearing' : ''}`;
        return (
          <button key={c.versionId} type="button" className={cls} aria-pressed={c.active}
            title={c.active ? `v${c.number} · in use` : `click: use v${c.number} · alt-click: hear it here`}
            onClick={(e) => (e.altKey ? onHear(c.versionId) : c.active ? undefined : onUse(c.versionId))}>
            v{c.number}
          </button>
        );
      })}
    </span>
  );
}
