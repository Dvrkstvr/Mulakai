/** The draft's fields in the sidebar (F-043, CH-4, CH-6, TU-4): editable at any time, also while a turn runs.
 * A field the last reply filled reads sky with ASSISTANT and its old value struck; one the person touched reads
 * YOURS; while the assistant thinks the empty ones are dashed FILLING…. Locked while a take renders and on a
 * song (TU-8, TU-10). Edits go through the one draft store; the server's blockers judge them. */
import { useMemo, useState } from 'react';
import type { ChatDraftFields as Fields, ChatDraftKey } from './api/chat';
import { ASSISTANT_TAG, ENGINE_FIXED, FILLING_TAG, FOLD, INSTRUMENTAL_FIELD, INSTRUMENTAL_HINT, LYRICS_HINT, YOURS_TAG } from './chatCopy';
import { fieldMark, liveFields, useChatDraftStore } from './chatDraftStore';
import { lyricsPreview, parseStructure, sectionsToText, structureText, textToSections } from './chatLyricsText';
import { LOCKED_HINT, SCORE_MARK, autoValue, fieldMark as referenceMark, missingNote } from './chatReferenceCopy';

type RowMark = 'assistant' | 'yours' | 'filling' | 'plain';
const show = (v: unknown) => (v === null || v === undefined || v === '' ? null : String(v));

/** A text kept locally while focused and parsed on blur; a problem keeps the text and says why. */
function ParsedText({ text, rows, disabled, label, onCommit }: {
  text: string; rows: number; disabled: boolean; label: string; onCommit: (t: string) => string[];
}) {
  const [local, setLocal] = useState<string | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  return (
    <>
      <textarea
        className="chat-fd-in" aria-label={label} rows={rows} disabled={disabled} value={local ?? text}
        onFocus={() => setLocal((l) => l ?? text)} onChange={(e) => setLocal(e.target.value)}
        onBlur={() => {
          if (local === null) return;
          const p = local === text ? [] : onCommit(local);
          setProblems(p);
          if (!p.length) setLocal(null);
        }}
      />
      {problems.map((p) => <div key={p} className="chat-fd-problem">{p}</div>)}
    </>
  );
}

export function ChatDraftFields({ filling, locked }: { filling: ChatDraftKey[]; locked: boolean }) {
  const s = useChatDraftStore();
  const f = useMemo(() => liveFields(s), [s]);
  const [lyricsOpen, setLyricsOpen] = useState(false);
  if (!f) return null;
  const edit = s.edit;

  // C3: a cover's FROM THE SCORE fields are locked; a borrow's carry REFERENCE until edited; a missing one reads AUTO.
  const scoreLocked = (k: ChatDraftKey) => s.draft?.reference?.use === 'cover' && !!s.draft.borrowed?.includes(k);
  const off = (k: ChatDraftKey) => locked || scoreLocked(k);
  const missing = (k: ChatDraftKey) => !!s.draft?.missing?.includes(k) && (f[k] === null || f[k] === '');
  const refTag = (keys: ChatDraftKey[]) => (locked ? null : keys.map((k) => (k in s.pending ? null : referenceMark(s.draft, k))).find(Boolean));
  const mark = (keys: ChatDraftKey[]): RowMark => {
    const marks = keys.map((k) => fieldMark(s, k));
    if (marks.includes('assistant')) return 'assistant';
    if (marks.includes('yours')) return 'yours';
    return keys.every((k) => filling.includes(k)) ? 'filling' : 'plain';
  };
  const old = (k: ChatDraftKey) => { const o = s.filled[k]?.old; return Array.isArray(o) ? null : show(o); };
  const row = (label: string, keys: ChatDraftKey[], children: React.ReactNode) => {
    const m = locked ? 'plain' : mark(keys);
    const struck = m === 'assistant' ? keys.map(old).filter(Boolean).join(' · ') : '';
    const ref = refTag(keys);
    const lost = locked ? [] : keys.filter(missing);
    return (
      <div className={`chat-fd ${m}${locked ? ' locked' : ''}`}>
        <div className="chat-fk">{label}</div>
        <div className="chat-fv">
          {struck && <s className="chat-old">{struck}</s>}
          {children}
          {m === 'assistant' && <em className="chat-tag">{ASSISTANT_TAG}</em>}
          {m === 'yours' && <em className="chat-tag yours">{YOURS_TAG}</em>}
          {m === 'filling' && <em className="chat-tag">{FILLING_TAG}</em>}
          {ref && <em className={`chat-tag ref${ref === SCORE_MARK ? ' score' : ''}`}>{ref}</em>}
          {!locked && ref === SCORE_MARK && keys.includes('bpm') && <div className="chat-hn">{LOCKED_HINT}</div>}
          {lost.map((k) => <div key={k} className="chat-fd-problem">{missingNote(k)}</div>)}
        </div>
      </div>
    );
  };
  const text = <K extends 'title' | 'style' | 'key' | 'timeSignature' | 'language'>(k: K, label: string, cls = '') => (
    <input
      className={`chat-fd-in ${cls}${missing(k) ? ' auto' : ''}`} aria-label={label} disabled={off(k)}
      placeholder={missing(k) ? autoValue(k) : undefined} value={f[k] ?? ''} onChange={(e) => edit(k, e.target.value as Fields[K])}
    />
  );
  const preview = lyricsPreview(f.lyrics);
  const instrumental = f.vocals === 'instrumental' && !preview; // F-097: typed lyrics make it sung (server, D-260)

  return (
    <div className="chat-fields">
      {row('TITLE', ['title'], text('title', 'Title'))}
      {row('STYLE', ['style'], text('style', 'Style'))}
      {row('TEMPO · KEY', ['bpm', 'key', 'timeSignature'], (
        <span className="chat-fd-group">
          <input className={`chat-fd-in narrow${missing('bpm') ? ' auto' : ''}`} aria-label="Tempo (BPM)" type="number" disabled={off('bpm')}
            placeholder={missing('bpm') ? autoValue('bpm') : undefined} value={f.bpm ?? ''}
            onChange={(e) => edit('bpm', e.target.value === '' ? null : Number(e.target.value))} />
          {text('key', 'Key', 'narrow')}
          {text('timeSignature', 'Meter', 'narrow')}
        </span>
      ))}
      {row('LANGUAGE', ['language'], text('language', 'Language', 'narrow'))}
      {row('STRUCTURE', ['structure'], (
        <ParsedText text={structureText(f.structure)} rows={2} disabled={off('structure')} label="Structure"
          onCommit={(t) => { const r = parseStructure(t); if (!r.problems.length) edit('structure', r.tags); return r.problems; }} />
      ))}
      {row('LYRICS', ['lyrics'], lyricsOpen || !preview ? (
        <span className="chat-fd-col">
          {instrumental && <span className="chat-ib">{INSTRUMENTAL_FIELD}</span>}
          <ParsedText text={sectionsToText(f.lyrics)} rows={preview ? 10 : 3} disabled={locked} label="Lyrics"
            onCommit={(t) => { const r = textToSections(t); if (!r.problems.length) edit('lyrics', r.sections); return r.problems; }} />
          <span className="chat-hn">{instrumental ? INSTRUMENTAL_HINT : LYRICS_HINT}{preview && <button type="button" className="chat-link" onClick={() => setLyricsOpen(false)}> {FOLD}</button>}</span>
        </span>
      ) : (
        <button type="button" className="chat-ly-preview" onClick={() => setLyricsOpen(true)}>
          {preview.head}<br />{preview.first}…<br /><span>▸ {preview.count} lines{f.language ? ` · ${f.language.toUpperCase()}` : ''}</span>
        </button>
      ))}
      {row('ENGINE', ['engine'], <span className="chat-ib">{ENGINE_FIXED}</span>)}
    </div>
  );
}
