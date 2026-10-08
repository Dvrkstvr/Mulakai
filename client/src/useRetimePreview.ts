import { useEffect, useState } from 'react';
import { api, RetimeError, type RetimeResult } from './api';
import { slightlyOff, type RetimeChoice } from './retimeRules';

/** Is the transcription's kept reading still here: `none` when the score never had one (a file, a reused cover). */
export type Kept = 'none' | 'checking' | 'kept' | 'gone';

export type RetimePreview =
  | { status: 'idle' }
  | { status: 'slight' }
  | { status: 'working' }
  | { status: 'ready'; result: RetimeResult }
  | { status: 'refused'; code: string; message: string };

const key = (c: RetimeChoice | null) => (c ? (c.mode === 'bpm' ? `bpm:${c.bpm}` : c.mode) : '');

/** RE-TIME's press-then-confirm (D-212): picking a mode rebuilds at once (CPU, under a second) so the consequence
 * line can name the real bars and dropped notes; RE-TIME then only applies that result. A no_bundle refusal turns
 * the row into TRANSCRIBE AGAIN. */
export function useRetimePreview(notationId: string | null | undefined, read: number | null, choice: RetimeChoice | null) {
  const [kept, setKept] = useState<Kept>(notationId ? 'checking' : 'none');
  const [preview, setPreview] = useState<RetimePreview>({ status: 'idle' });

  useEffect(() => {
    if (!notationId) return setKept('none');
    let live = true;
    setKept('checking');
    api.notationKept(notationId).then((ok) => { if (live) setKept(ok ? 'kept' : 'gone'); }, () => { if (live) setKept('kept'); });
    return () => { live = false; };
  }, [notationId]);

  const k = key(choice);
  useEffect(() => {
    if (!choice || !notationId || !read || kept !== 'kept') return setPreview({ status: 'idle' });
    if (choice.mode === 'bpm' && slightlyOff(read, choice.bpm)) return setPreview({ status: 'slight' });
    let live = true;
    setPreview({ status: 'working' });
    api.retimeScore(notationId, choice.mode, choice.mode === 'bpm' ? choice.bpm : null).then(
      (result) => { if (live) setPreview({ status: 'ready', result }); },
      (err: unknown) => {
        if (!live) return;
        const code = err instanceof RetimeError ? err.code : 'retime_failed';
        if (code === 'no_bundle') setKept('gone');
        setPreview({ status: 'refused', code, message: err instanceof Error ? err.message : String(err) });
      },
    );
    return () => { live = false; };
    // `k` stands for `choice`: a new object with the same mode must not rebuild again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k, notationId, read, kept]);

  return { kept, preview };
}
