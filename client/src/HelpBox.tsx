import { useEffect, useState } from 'react';
import type { AssistKind } from './api/assist';
import { FIELD_NAME, REFINEMENTS, assistStatusLine } from './assistCopy';
import { useAssistSong, type AssistSong } from './assistContext';
import { useAssist } from './useAssist';

interface Props {
  kind: AssistKind;
  /** ADD LAYER: the picked track's label ('' = AUTO). REPAINT / words: the layer acted on. */
  layer: string;
  /** What the field holds now. */
  current: string;
  /** USE: put a suggestion in the field. */
  onUse: (text: string) => void;
}

/** ✦ HELP beside a field of the action bar (PLAN.md "Editor Redesign", the field helper): opens a box under the field
 * with suggestions from the local LLM — it already knows the song, the part and the lanes — one-tap refinements, a free
 * line and CONTINUE IN CHAT. Nothing changes until USE. Shown only when help is on (a local LLM is configured). */
export function HelpBox(props: Props) {
  const song = useAssistSong();
  const [open, setOpen] = useState(false);
  if (!song) return null;
  return (
    <span className="help">
      <button type="button" className={`tab help-btn${open ? ' on' : ''}`} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span>✦ HELP</span>
      </button>
      {open && <HelpPanel {...props} song={song} onClose={() => setOpen(false)} />}
    </span>
  );
}

function HelpPanel({ kind, layer, current, onUse, song, onClose }: Props & { song: AssistSong; onClose: () => void }) {
  const { phase, suggestions, ask } = useAssist();
  const [free, setFree] = useState('');
  const [lastAsk, setLastAsk] = useState('');
  const run = (a: string) => { setLastAsk(a); void ask({ ...song.base, kind, layer, current, ask: a }); };

  // The first suggestions come as the box opens; Escape closes it.
  useEffect(() => {
    run('');
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); onClose(); } };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const busy = phase.kind === 'waiting' || phase.kind === 'thinking';
  return (
    <div className="help-box" role="dialog" aria-label={`Help with ${FIELD_NAME[kind].toLowerCase()}`}>
      <div className="help-head">
        <span>✦ HELP WITH {FIELD_NAME[kind]}</span>
        <button type="button" className="tab dock-quiet" onClick={onClose}><span>✕</span></button>
      </div>
      <div className="help-chips">
        {REFINEMENTS[kind].map((r) => (
          <button key={r} type="button" className="tab dock-chip" disabled={busy} onClick={() => run(r)}><span>{r.toUpperCase()}</span></button>
        ))}
      </div>
      <form className="help-free" onSubmit={(e) => { e.preventDefault(); if (free.trim()) run(free.trim()); }}>
        <input value={free} onChange={(e) => setFree(e.target.value)} placeholder="or say what you want…" aria-label="What you want" />
        <button type="submit" className="tab" disabled={busy || !free.trim()}><span>ASK</span></button>
      </form>
      <div className={`help-status${phase.kind === 'failed' ? ' failed' : ''}`}>
        {assistStatusLine(phase)}
        {phase.kind === 'failed' && <button type="button" className="linkish" onClick={() => run(lastAsk)}>RETRY</button>}
      </div>
      {phase.kind === 'done' && suggestions.map((s, i) => (
        <div key={i} className="help-suggestion">
          <div className={kind === 'lyrics' ? 'help-text words' : 'help-text'}>{s.text}</div>
          {s.why && <div className="help-why">{s.why}</div>}
          <button type="button" className="tab help-use" onClick={() => { onUse(s.text); onClose(); }}><span>USE</span></button>
        </div>
      ))}
      {song.onContinueInChat && (
        <button type="button" className="linkish help-chat" onClick={song.onContinueInChat}>CONTINUE IN CHAT ▸</button>
      )}
    </div>
  );
}
