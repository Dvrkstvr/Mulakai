import { useEffect, useState, type ReactNode } from 'react';
import { api, type Song } from './api';
import { useCreateDraftStore } from './createDraftStore';
import { useReadLyricsStore } from './readLyricsStore';
import { useEngineCaps } from './useEngineCaps';
import { coverSourceKey, coverSourceReady, resolveCoverSource } from './coverSource';
import { liveLanguage } from './engineCaps';
import { hasWords } from './coverLyrics';
import { shouldAutoRead } from './autoReadLyrics';

type Health = { configured: boolean; ready: boolean };

/** READ LYRICS on COVER · YUE2 (PLAN.md "READ LYRICS on COVER · YUE2"): the words sung in the
 * source, read into LYRICS under the score's sections by when they're sung. Returns the button
 * for the score-actions row and the notes that go under it; nothing at all when no lyrics-server
 * is configured, the same no-row-until-available rule as ENGINE. */
export function useReadLyrics(songs: Song[], blocked: boolean): {
  button: ReactNode; notes: ReactNode; running: boolean;
  /** Whether a lyrics reader is set up and answering, so TRANSCRIBE may read an upload's words. */
  autoOn: boolean;
  /** TRANSCRIBE's own read once its score lands (PLAN.md "READ LYRICS With TRANSCRIBE for
   * Uploads"); `lyricsOpen` is transcribeStore.start's answer. */
  auto: (blob: Blob, label: string, lyricsOpen: boolean) => Promise<void>;
} {
  const audio = useCreateDraftStore((s) => s.audio);
  const lyrics = useCreateDraftStore((s) => s.lyrics);
  const vocalLanguage = useCreateDraftStore((s) => s.vocalLanguage);
  const rl = useReadLyricsStore();
  const { info } = useEngineCaps();
  const [health, setHealth] = useState<Health | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');
  const score = audio.yueScore;

  useEffect(() => {
    let live = true;
    void api.lyricsHealth().then((h) => live && setHealth(h), () => live && setHealth({ configured: false, ready: false }));
    return () => { live = false; };
  }, []);

  // LYRICS that READ LYRICS wrote follow the score until edited: a score landing, TRANSCRIBE
  // AGAIN, a section left out or put back.
  const dropped = score?.dropped?.join(',') ?? '';
  useEffect(() => { useReadLyricsStore.getState().follow(); }, [score?.abc, dropped]);

  const running = rl.stage === 'running' || preparing;
  const caps = info?.capabilities ?? null;
  const autoOn = !!health?.ready;
  const auto = async (blob: Blob, label: string, lyricsOpen: boolean) => {
    // Read from the stores, not this render: TRANSCRIBE ran for a while since it was clicked.
    const draft = useCreateDraftStore.getState();
    const go = shouldAutoRead({
      source: draft.audio.source, lyricsOpen, readerReady: autoOn,
      sourceKey: coverSourceKey(draft.audio), readSourceKey: useReadLyricsStore.getState().sourceKey,
    });
    if (!go) return;
    setConfirm(false);
    setError('');
    await useReadLyricsStore.getState().start(blob, label, liveLanguage(draft.vocalLanguage, caps), caps?.languages ?? 'any');
  };
  if (!health?.configured) return { button: null, notes: null, running, autoOn, auto };

  const userWords = hasWords(lyrics) && lyrics !== rl.placed;
  const armed = confirm && userWords && !blocked && !running;
  const ours = !!rl.reading && rl.sourceKey === coverSourceKey(audio);
  const heard = ours ? rl.reading!.language : '';
  const unsung = heard && caps && caps.languages !== 'any' && !caps.languages.includes(heard) ? heard : '';

  const run = async () => {
    if (userWords && !armed) { setConfirm(true); return; }
    setConfirm(false);
    setError('');
    setPreparing(true);
    try {
      const song = audio.source === 'library' ? songs.find((s) => s.id === audio.selectedSongId) : undefined;
      const blob = await resolveCoverSource(audio); // a library song is bounced down client-side first
      setPreparing(false);
      await rl.start(blob, song?.title ?? audio.uploadFile?.name ?? 'source', liveLanguage(vocalLanguage, caps), caps?.languages ?? 'any');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPreparing(false);
    }
  };

  const label = preparing ? 'PREPARING SOURCE…' : rl.stage === 'running' ? 'READING LYRICS…'
    : armed ? 'REPLACE LYRICS? CONFIRM' : 'READ LYRICS';
  const button = (
    <button className="acid-outline" onClick={run} onBlur={() => setConfirm(false)}
      disabled={!health.ready || !coverSourceReady(audio) || running || blocked}>
      <span>{label}</span>
    </button>
  );
  const o = ours ? rl.outcome : null;
  const notes = (
    <>
      <div className="hint">
        {armed ? 'Replaces the words in LYRICS with the ones read from the source.'
          : "READ LYRICS reads the words sung in the source into LYRICS · placed under the score's sections by when they're sung · about 10 seconds · nothing is saved to your library"}
      </div>
      {!health.ready && <div className="hint">READ LYRICS: lyrics-server is not answering — start it (start-all.bat does when it is installed)</div>}
      {(error || rl.error) && <div className="error">{error || rl.error}</div>}
      {o && <div className="hint">{outcomeLine(o.lines, o.leftOut, o.placed)}</div>}
      {o?.estimated && (
        <div className="warn-note">
          This score has no downbeat times — lines were placed on its tempo grid from 0 s, which can run a bar or more
          off · check where each one landed
        </div>
      )}
      {unsung && (
        <div className="warn-note">
          READ LYRICS heard the words in {unsung.toUpperCase()} — {info?.label ?? 'YUE2'} sings{' '}
          {caps?.languages === 'any' ? 'any language' : (caps?.languages ?? []).join(', ').toUpperCase()} · rewrite LYRICS in one of
          those, or expect the words to come out garbled
        </div>
      )}
    </>
  );
  return { button, notes, running, autoOn, auto };
}

function outcomeLine(lines: number, leftOut: number, placed: boolean): string {
  if (!lines && !leftOut) return "READ LYRICS heard no words — LYRICS hold the score's sections only";
  const where = placed ? ', each under the section it was sung in' : " — TRANSCRIBE to place them under the score's sections";
  const out = leftOut ? ` · ${leftOut} more fell in sections left out` : '';
  return `LYRICS hold the ${lines} lines read from the source${where}${out} · check them against the recording`;
}
