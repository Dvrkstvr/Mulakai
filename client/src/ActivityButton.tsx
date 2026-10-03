import { useActivityStore } from './activityStore';
import { useRunningRows } from './useRunningRows';
import { useQueueStore } from './queueStore';

/** Header entry to the Activity drawer, naming how many jobs run right now and wait behind them. */
export function ActivityButton() {
  const open = useActivityStore((s) => s.drawerOpen);
  const setOpen = useActivityStore((s) => s.setDrawerOpen);
  const running = useRunningRows().length;
  const next = useQueueStore((s) => s.queued.length);
  return (
    <button
      type="button"
      className={open ? 'activity-btn open' : 'activity-btn'}
      aria-expanded={open}
      aria-controls="activity-drawer"
      onClick={() => setOpen(!open)}
    >
      <span>ACTIVITY{running > 0 && ` · ${running} RUNNING`}{next > 0 && ` · ${next} NEXT`}</span>
    </button>
  );
}
