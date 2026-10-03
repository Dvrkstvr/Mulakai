import { useState, type ReactNode } from 'react';

/** `TUNE ▸` + one summary line (tuneSummary.ts); opens in place to the verb's full settings. Open state is per session. */
export function TuneDisclosure({ summary, children }: { summary: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`tune${open ? ' open' : ''}`}>
      <button type="button" className="tune-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        TUNE {open ? '▾' : '▸'} <span className="tune-summary">{summary}</span>
      </button>
      {open && <div className="tune-body">{children}</div>}
    </div>
  );
}
