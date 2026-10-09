import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { BASE_UNDELETABLE, deleteLayerLine } from './laneMenuCopy';

interface Props {
  name: string;
  isBase: boolean;
  takes: number;
  onRename: () => void;
  onSplit: () => void;
  onDelete: () => void;
}

/** A lane's ⋯ menu: RENAME, SPLIT INTO STEMS, DELETE LAYER. Delete asks once, naming what goes; the base layer's is
 * off. Outside click, Escape or a scroll closes it. The panel is fixed to the viewport under the button, so the lane
 * list's scroll box can't clip it. */
export function LaneMenu({ name, isBase, takes, onRename, onSplit, onDelete }: Props) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [at, setAt] = useState<CSSProperties>({});
  const box = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); setOpen(false); } };
    const close = () => setOpen(false);
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', esc);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);
  useEffect(() => { if (!open) setConfirming(false); }, [open]);

  const pick = (run: () => void) => () => { setOpen(false); run(); };
  const toggle = () => {
    const r = btn.current?.getBoundingClientRect();
    if (r) setAt({ top: r.bottom + 6, right: window.innerWidth - r.right });
    setOpen((o) => !o);
  };

  return (
    <div className="lane-menu" ref={box} onClick={(e) => e.stopPropagation()}>
      <button ref={btn} type="button" className="lane-menu-btn" aria-haspopup="menu" aria-expanded={open} aria-label={`${name} layer actions`}
        onClick={toggle}><span>⋯</span></button>
      {open && (
        <div className="lane-menu-list" role="menu" style={at}>
          {confirming ? (
            <>
              <div className="lane-menu-note">{deleteLayerLine(name, takes)}</div>
              <button type="button" role="menuitem" className="lane-menu-it danger" onClick={pick(onDelete)}>DELETE {name.toUpperCase()}</button>
              <button type="button" role="menuitem" className="lane-menu-it" onClick={() => setConfirming(false)}>CANCEL</button>
            </>
          ) : (
            <>
              <button type="button" role="menuitem" className="lane-menu-it" onClick={pick(onRename)}>RENAME</button>
              <button type="button" role="menuitem" className="lane-menu-it" onClick={pick(onSplit)}>SPLIT INTO STEMS</button>
              <button type="button" role="menuitem" className="lane-menu-it danger" disabled={isBase}
                title={isBase ? BASE_UNDELETABLE : undefined} onClick={() => setConfirming(true)}>DELETE LAYER…</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
