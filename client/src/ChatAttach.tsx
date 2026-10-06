/** How a song reaches the chat (F-061, design/chat-reference.html 1a-1c, D-130, D-141): ATTACH ▾ with FILE… and
 * FROM LIBRARY… (its list says what READ will do), the drop target over the thread column, and the one chip above
 * the composer. Attaching only uploads or copies (`chatAttachStore`); nothing is read until READ on the card. */
import { useEffect, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { libraryApi } from './api/library';
import type { Song } from './api/types';
import { useChatAttachStore, type Attachment } from './chatAttachStore';
import {
  ATTACH, ATTACH_FILE, ATTACH_FILE_HINT, ATTACH_LIBRARY, ATTACH_LIBRARY_HINT, ATTACH_OFF, DROP_FORMATS, DROP_TITLE,
  LIBRARY_EMPTY, LIBRARY_FAILED, LIBRARY_LOADING, LIBRARY_SEARCH, attachChipLine, libraryRowHint, libraryRowMeta,
} from './chatReferenceCopy';
import './chatReference.css';

/** The file a drop carries: the first one (one chip per thread, D-141). */
const droppedFile = (dt: Pick<DataTransfer, 'files'> | null | undefined): File | null => dt?.files?.[0] ?? null;
const carriesFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');
const reason = (err: unknown) => (err instanceof Error ? err.message : String(err));

export function AttachChip({ a, onRemove }: { a: Attachment; onRemove: () => void }) {
  return (
    <div className={`chat-attach-chip ${a.phase}`}>
      <b>{a.name}</b>
      <span className="chat-hn">{attachChipLine(a)}</span>
      {a.phase === 'uploading' && <span className="chat-attach-bar"><i style={{ width: `${Math.round(a.progress * 100)}%` }} /></span>}
      <button type="button" className="chat-attach-x" aria-label="Remove attachment" onClick={onRemove}>✕</button>
    </div>
  );
}

interface MenuProps {
  /** null while the list loads. */
  songs: Song[] | null;
  error: string | null;
  query: string;
  onQuery: (q: string) => void;
  onFile: () => void;
  onPick: (song: Song) => void;
}

export function AttachMenu({ songs, error, query, onQuery, onFile, onPick }: MenuProps) {
  const list = error ? <div className="chat-attach-err">{`${LIBRARY_FAILED} ${error}`}</div>
    : songs === null ? <div className="chat-attach-note chat-hn">{LIBRARY_LOADING}</div>
      : songs.length === 0 ? <div className="chat-attach-note chat-hn">{LIBRARY_EMPTY}</div>
        : songs.map((s) => (
          <button key={s.id} type="button" role="menuitem" className="chat-attach-it song" onClick={() => onPick(s)}>
            <span className="chat-attach-song">{s.title}<span className="chat-hn">{libraryRowMeta(s.duration, s.engine)}</span></span>
            <span className="chat-hn">{libraryRowHint(s.engine)}</span>
          </button>
        ));
  return (
    <div className="chat-attach-menu" role="menu">
      <button type="button" role="menuitem" className="chat-attach-it" onClick={onFile}>
        <b>{ATTACH_FILE}</b><span className="chat-hn">{ATTACH_FILE_HINT}</span>
      </button>
      <div className="chat-attach-it head"><b>{ATTACH_LIBRARY}</b><span className="chat-hn">{ATTACH_LIBRARY_HINT}</span></div>
      <div className="chat-attach-it">
        <input className="chat-attach-search" aria-label={LIBRARY_SEARCH} placeholder={LIBRARY_SEARCH} value={query} onChange={(e) => onQuery(e.target.value)} />
      </div>
      <div className="chat-attach-list">{list}</div>
    </div>
  );
}

/** ATTACH ▾ beside the composer's field; greyed on a song's thread (D-130). */
export function ChatAttachControl({ threadId, off }: { threadId: string | null; off: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [songs, setSongs] = useState<Song[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const attachFile = useChatAttachStore((s) => s.attachFile);
  const attachLibrary = useChatAttachStore((s) => s.attachLibrary);

  useEffect(() => { // the library list, again as the search changes
    if (!open) return;
    let live = true;
    const t = setTimeout(() => {
      libraryApi.listSongs(query).then((s) => { if (live) { setSongs(s.filter((x) => !x.trashed_at)); setError(null); } })
        .catch((err: unknown) => { if (live) setError(reason(err)); });
    }, query ? 200 : 0);
    return () => { live = false; clearTimeout(t); };
  }, [open, query]);

  useEffect(() => { // a click outside or Escape closes it
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);

  return (
    <div className="chat-attach" ref={box}>
      <button
        type="button" className="chat-q chat-attach-btn" disabled={off || !threadId} title={off ? ATTACH_OFF : undefined}
        aria-expanded={open} onClick={() => setOpen((o) => !o)}
      ><span>{ATTACH}</span></button>
      <input
        ref={input} type="file" accept="audio/*" hidden aria-label="Attach an audio file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file && threadId) void attachFile(threadId, file);
        }}
      />
      {open && threadId && (
        <AttachMenu
          songs={songs} error={error} query={query} onQuery={setQuery}
          onFile={() => { setOpen(false); input.current?.click(); }}
          onPick={(s) => { setOpen(false); void attachLibrary(threadId, s.id, s.title); }}
        />
      )}
    </div>
  );
}

export const DropOverlay = () => (
  <div className="chat-drop-zone" aria-hidden="true">
    <b>{DROP_TITLE}</b>
    <span className="chat-hn">{DROP_FORMATS}</span>
  </div>
);

/** The thread column as a drop target (1a): only on the draft thread, only for a drag that carries files. */
export function ChatDropZone({ threadId, off, children }: { threadId: string | null; off: boolean; children: ReactNode }) {
  const [over, setOver] = useState(false);
  const depth = useRef(0); // dragenter/leave fire per child: count them
  const attachFile = useChatAttachStore((s) => s.attachFile);
  if (off || !threadId) return <div className="chat-drop">{children}</div>;
  return (
    <div
      className={`chat-drop${over ? ' over' : ''}`}
      onDragEnter={(e) => { if (!carriesFiles(e)) return; e.preventDefault(); depth.current += 1; setOver(true); }}
      onDragOver={(e) => { if (!carriesFiles(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
      onDragLeave={(e) => { if (!carriesFiles(e)) return; depth.current = Math.max(0, depth.current - 1); if (!depth.current) setOver(false); }}
      onDrop={(e) => {
        if (!carriesFiles(e)) return;
        e.preventDefault();
        depth.current = 0;
        setOver(false);
        const file = droppedFile(e.dataTransfer);
        if (file) void attachFile(threadId, file);
      }}
    >
      {children}
      {over && <DropOverlay />}
    </div>
  );
}
