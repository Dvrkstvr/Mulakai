import type { RefineResult } from './api';
import { KNOWN_TIME_SIGNATURES, KNOWN_VOCAL_LANGUAGES, timeSignatureLabel, vocalLanguageLabel } from './songMeta';

interface SongFields {
  prompt: string;
  lyrics: string;
  bpm: number;
  keyScale: string;
  timeSignature: string;
  vocalLanguage: string;
  duration: number;
}

interface Props {
  refining: boolean;
  preview: RefineResult | null;
  error: string;
  current: SongFields;
  onRefine: () => void;
  onClose: () => void;
  onAccept: {
    prompt: (v: string) => void;
    lyrics: (v: string) => void;
    bpm: (v: number) => void;
    keyScale: (v: string) => void;
    timeSignature: (v: string) => void;
    vocalLanguage: (v: string) => void;
    duration: (v: number) => void;
  };
}

function AcceptButton({ applied, onClick }: { applied: boolean; onClick: () => void }) {
  return (
    <button className="refine-accept" disabled={applied} onClick={onClick}>
      {applied ? 'APPLIED' : 'ACCEPT'}
    </button>
  );
}

/**
 * Right-side rail showing the LM's refined prompt/lyrics/metadata one field at a
 * time. Accepting a field always overwrites — even a manually-set value — since
 * the user is explicitly choosing that field here, unlike Feature 1's AUTO-only
 * autofill on generate. "Applied" is derived by comparing current vs. preview
 * values, so it stays correct if the user edits a field back afterward.
 */
export function RefineRail({ refining, preview, error, current, onRefine, onClose, onAccept }: Props) {
  if (!refining && !preview && !error) return null;

  return (
    <aside className="rail refine-rail">
      <div className="refine-rail-panel">
        <div className="field-label-row">
          <span className="section-label">REFINED PREVIEW</span>
          <button className="rail-close" onClick={onClose}>&times;</button>
        </div>

        {refining && <div className="lm-note">Refining prompt &amp; lyrics with the LM…</div>}
        {error && <div className="error">{error} <button onClick={onRefine}>RETRY</button></div>}

        {preview && (
          <>
            <div className="refine-field">
              <div className="setting-head"><span>PROMPT</span></div>
              <p>{preview.caption}</p>
              <AcceptButton applied={current.prompt === preview.caption} onClick={() => onAccept.prompt(preview.caption)} />
            </div>

            <div className="refine-field">
              <div className="setting-head"><span>LYRICS</span></div>
              <pre>{preview.lyrics}</pre>
              <AcceptButton applied={current.lyrics === preview.lyrics} onClick={() => onAccept.lyrics(preview.lyrics)} />
            </div>

            {!!preview.bpm && (
              <div className="refine-field">
                <div className="setting-head"><span>BPM</span></div>
                <p>{preview.bpm}</p>
                <AcceptButton applied={current.bpm === preview.bpm} onClick={() => onAccept.bpm(preview.bpm!)} />
              </div>
            )}

            {!!preview.key_scale && (
              <div className="refine-field">
                <div className="setting-head"><span>KEY / SCALE</span></div>
                <p>{preview.key_scale}</p>
                <AcceptButton applied={current.keyScale === preview.key_scale} onClick={() => onAccept.keyScale(preview.key_scale!)} />
              </div>
            )}

            {!!preview.time_signature && KNOWN_TIME_SIGNATURES.has(preview.time_signature) && (
              <div className="refine-field">
                <div className="setting-head"><span>TIME SIGNATURE</span></div>
                <p>{timeSignatureLabel(preview.time_signature)}</p>
                <AcceptButton applied={current.timeSignature === preview.time_signature} onClick={() => onAccept.timeSignature(preview.time_signature!)} />
              </div>
            )}

            {!!preview.vocal_language && KNOWN_VOCAL_LANGUAGES.has(preview.vocal_language) && (
              <div className="refine-field">
                <div className="setting-head"><span>VOCAL LANGUAGE</span></div>
                <p>{vocalLanguageLabel(preview.vocal_language)}</p>
                <AcceptButton applied={current.vocalLanguage === preview.vocal_language} onClick={() => onAccept.vocalLanguage(preview.vocal_language!)} />
              </div>
            )}

            {!!preview.duration && (
              <div className="refine-field">
                <div className="setting-head"><span>DURATION</span></div>
                <p>{preview.duration}s</p>
                <AcceptButton applied={current.duration === preview.duration} onClick={() => onAccept.duration(preview.duration!)} />
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
