/** The sidebar (CH-3, F-043): 360 px, open on first use, then as the person left it; collapsed, a 38 px rail
 * counts the fields filled. It commits nothing: its foot points at the card. On a song, its references sit under
 * the versions with RE-ANALYZE and A/B (F-062). */
import { useState, type ReactNode } from 'react';
import { HIDE_SIDEBAR, railLine } from './chatCopy';
import { ChatReferencePanel } from './ChatReferencePanel';
import { useChatStore } from './chatStore';
import { useChatAb } from './useChatPlayback';

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
  const thread = useChatStore((s) => s.thread);
  const reanalyze = useChatStore((s) => s.reanalyze);
  const side = useChatAb((s) => s.side);
  const toggleAb = useChatAb((s) => s.toggle);
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
        {thread?.songId && thread.references?.length ? (
          <ChatReferencePanel references={thread.references} side={side} onAb={toggleAb} onReanalyze={reanalyze} />
        ) : null}
        {children}
        <div className="chat-hn chat-sidebar-ft">{foot}</div>
      </div>
    </aside>
  );
}
