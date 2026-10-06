/** The sidebar (CH-3, F-043): 360 px, open on first use, then as the person left it; collapsed, a 38 px rail
 * counts the fields filled. It commits nothing: its foot points at the card. */
import { useState, type ReactNode } from 'react';
import { HIDE_SIDEBAR, railLine } from './chatCopy';

const KEY = 'mulakai.chat.sidebar';
const readOpen = () => { try { return localStorage.getItem(KEY) !== 'closed'; } catch { return true; } };
const writeOpen = (open: boolean) => { try { localStorage.setItem(KEY, open ? 'open' : 'closed'); } catch { /* private window */ } };

interface Props {
  head: string;
  foot: string;
  filled: number;
  /** Above the fields: the song panel's VERSIONS row (TU-10). */
  top?: ReactNode;
  children: ReactNode;
}

export function ChatSidebar({ head, foot, filled, top, children }: Props) {
  const [open, setOpen] = useState(readOpen);
  const toggle = (next: boolean) => { setOpen(next); writeOpen(next); };
  if (!open) {
    return (
      <button type="button" className="chat-rail" aria-label="Show the form" onClick={() => toggle(true)}>
        ◂ FORM · <b>{railLine(filled)}</b>
      </button>
    );
  }
  return (
    <aside className="chat-sidebar" aria-label="Draft">
      <div className="chat-sidebar-hd">
        <span className="chat-lb">{head}</span>
        <button type="button" className="chat-link" onClick={() => toggle(false)}>{HIDE_SIDEBAR}</button>
      </div>
      <div className="chat-sidebar-body">
        {top}
        {children}
        <div className="chat-hn chat-sidebar-ft">{foot}</div>
      </div>
    </aside>
  );
}
