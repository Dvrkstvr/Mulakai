import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useCommandStore, type Command } from './commandStore';
import { paletteResults, visibleCommands } from './commandIndex';

/** Ctrl K palette (PLAN.md "UI Redesign", S3.1–S3.2): DESIGN.md's one documented exception to
 * the no-modal rule. It navigates and pre-fills; every commit still happens at its own button. */
export function CommandPalette() {
  const open = useCommandStore((s) => s.open);
  return open ? <PaletteDialog /> : null;
}

function PaletteDialog() {
  const sources = useCommandStore((s) => s.sources);
  const scope = useCommandStore((s) => s.scope);
  const setOpen = useCommandStore((s) => s.setOpen);
  const [query, setQuery] = useState('');
  const [scoped, setScoped] = useState(true);
  const [index, setIndex] = useState(0);
  // Where focus was when the palette opened, so closing it hands focus back there.
  const [returnFocus] = useState(() => document.activeElement as HTMLElement | null);
  const activeRef = useRef<HTMLButtonElement>(null);

  const groups = useMemo(
    () => paletteResults(visibleCommands(sources, scope, scoped), query),
    [sources, scope, scoped, query],
  );
  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const active = Math.min(index, Math.max(0, flat.length - 1));

  useEffect(() => { activeRef.current?.scrollIntoView({ block: 'nearest' }); }, [active]);

  const close = () => {
    setOpen(false);
    if (returnFocus?.isConnected) returnFocus.focus();
  };
  // After closing, so an item that focuses a field (a dock verb, a prompt) keeps that focus.
  const run = (item: Command) => {
    close();
    requestAnimationFrame(() => item.run());
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (flat.length) setIndex((active + (e.key === 'ArrowDown' ? 1 : flat.length - 1)) % flat.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (flat[active]) run(flat[active]);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (scope) { setScoped(!scoped); setIndex(0); }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  };

  let row = -1;
  return (
    <div className="palette-dim" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Command palette">
        <div className="palette-search">
          {scope && (
            <span className={scoped ? 'palette-scope' : 'palette-scope all'}>
              <span>{scoped ? `IN · ${scope.label.toUpperCase()}` : 'ALL'}</span>
            </span>
          )}
          <input
            autoFocus
            aria-label="Search or run anything"
            placeholder={scope && scoped ? 'Run something on this song…' : 'Search or run anything…'}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setIndex(0); }}
            onKeyDown={onKeyDown}
          />
          <span className="kbd">ESC</span>
        </div>
        <div className="palette-list">
          {groups.map((g) => (
            <div key={g.group} className="palette-group">
              <span className="palette-group-label">{g.group}</span>
              {g.items.map((item) => {
                row += 1;
                const i = row;
                return (
                  <button
                    key={item.id}
                    type="button"
                    tabIndex={-1}
                    ref={i === active ? activeRef : undefined}
                    className={i === active ? 'palette-item active' : 'palette-item'}
                    onMouseMove={() => { if (i !== active) setIndex(i); }}
                    onClick={() => run(item)}
                  >
                    <span className="palette-label">{item.label}</span>
                    {item.sub && <span className="palette-sub">{item.sub}</span>}
                    {item.key && <span className="kbd">{item.key}</span>}
                  </button>
                );
              })}
            </div>
          ))}
          {flat.length === 0 && <div className="palette-empty">Nothing matches “{query.trim()}”.</div>}
        </div>
        <div className="palette-foot">
          <span>↑↓ MOVE</span><span>↵ RUN</span>{scope && <span>TAB CHANGE SCOPE</span>}
          <span className="palette-foot-note">opens and fills in · every commit stays on its own button</span>
        </div>
      </div>
    </div>
  );
}
