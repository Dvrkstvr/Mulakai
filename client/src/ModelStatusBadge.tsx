import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState, type FocusEvent } from 'react';
import { useEngineStore } from './engineStore';
import { statusRows, statusSummary } from './modelStatus';
import { useModelStatusStore } from './modelStatusStore';
import { useNavigation } from './Navigation';

const SERVICES_POLL_MS = 30_000;
/** Long enough to cross the gap between the badge and the popover without it closing. */
const CLOSE_DELAY_MS = 150;

const checkServices = () => void useModelStatusStore.getState().checkServices();

/** The header's one status element: a summary badge, and on hover/focus a popover listing
 * every model and service the app talks to (modelStatus.ts builds the rows). */
export function ModelStatusBadge() {
  const acestep = useModelStatusStore((s) => s.acestep);
  const split = useModelStatusStore((s) => s.split);
  const lyrics = useModelStatusStore((s) => s.lyrics);
  const engines = useEngineStore((s) => s.engines);
  const enginesLoaded = useEngineStore((s) => s.loaded);
  const { goToSettings } = useNavigation();
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    checkServices();
    const timer = setInterval(checkServices, SERVICES_POLL_MS);
    return () => { clearInterval(timer); clearTimeout(closeTimer.current); };
  }, []);

  const rows = statusRows({ acestep, engines: enginesLoaded ? engines : null, split, lyrics });
  const summary = statusSummary(acestep, rows);

  const show = () => {
    clearTimeout(closeTimer.current);
    if (!open) checkServices();
    setOpen(true);
  };
  const hide = () => {
    clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  };
  const onBlur = (e: FocusEvent<HTMLSpanElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget)) hide();
  };

  return (
    <span className="model-status" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={onBlur}
      onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}>
      <button type="button" className={`model-status-badge ${summary.tone}`} aria-expanded={open}
        aria-label={`Model status: ${summary.text}`}>
        {/* keyed so the blip replays whenever the overall state flips (DESIGN.md "Status blips") */}
        <span key={summary.tone} className={`model-status-dot ${summary.tone}`} />
        <span className="model-status-label">MODELS</span>
        <span className="model-status-summary">{summary.text}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div className="model-status-popover" role="dialog" aria-label="Model status"
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}>
            <div className="model-status-head">MODEL STATUS</div>
            {rows.map((r) => (
              <div key={r.id} className="model-status-row">
                <span className={`model-status-dot ${r.state}`} />
                <span className="model-status-name">
                  {r.name}
                  <span className="model-status-role">{r.role}</span>
                </span>
                <span className={`model-status-state ${r.state}`}>{r.text}</span>
              </div>
            ))}
            <div className="model-status-foot">
              <span>engines and services are set up on the server</span>
              <button type="button" className="link-btn" onClick={() => { setOpen(false); goToSettings(); }}>
                <span>SETTINGS ›</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}
