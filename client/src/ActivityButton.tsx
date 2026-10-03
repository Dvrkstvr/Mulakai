import { useActivityStore } from './activityStore';
import { useRunningRows } from './useRunningRows';

/** Header entry to the Activity drawer, naming how many jobs run right now. */
export function ActivityButton() {
  const open = useActivityStore((s) => s.drawerOpen);
  const setOpen = useActivityStore((s) => s.setDrawerOpen);
  const running = useRunningRows().length;
  return (
    <button
      type="button"
      className={open ? 'activity-btn open' : 'activity-btn'}
      aria-expanded={open}
      aria-controls="activity-drawer"
      onClick={() => setOpen(!open)}
    >
      <span>ACTIVITY{running > 0 && ` · ${running} RUNNING`}</span>
    </button>
  );
}
