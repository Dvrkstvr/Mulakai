import { useEffect, useMemo, useState } from 'react';
import { api, type SongDetail } from './api';
import { attempt } from './actionError';
import { auditionLayers, type Audition } from './laneTakeChips';

/** Hearing a take in place (PLAN.md "Editor Redesign", PR 8): the mix plays the auditioned take in its layer's place
 * at the same position; BACK returns to the take in use, USE makes it the take in use. Nothing is saved until USE. */
export function useAudition(song: SongDetail | null, reload: () => Promise<void>) {
  const [audition, setAudition] = useState<Audition | null>(null);
  const [error, setError] = useState('');
  const layers = useMemo(() => auditionLayers(song?.layers ?? [], audition), [song, audition]);
  const layer = audition ? song?.layers.find((l) => l.id === audition.layerId) : undefined;
  const number = (versionId: string | undefined) => {
    const i = layer?.versions.findIndex((v) => v.id === versionId) ?? -1;
    return layer && i !== -1 ? layer.versions.length - i : null;
  };
  const heard = number(audition?.versionId);
  const inUse = number(layer?.versions.find((v) => v.active)?.id);
  // The heard take was used (here or from TAKES) or deleted: the listen is over.
  const over = !!audition && (heard === null || heard === inUse);
  useEffect(() => { if (over) setAudition(null); }, [over]);

  const use = (versionId: string) => { setError(''); void attempt("couldn't use that take", async () => {
    await api.activateVersion(versionId);
    setAudition(null);
    await reload();
  }, setError); };

  return {
    /** The layers the mix plays. */
    layers,
    hearing: audition?.versionId ?? null,
    /** Alt-click: hear this take; again on the same take returns to the one in use. */
    hear: (layerId: string, versionId: string) =>
      setAudition((a) => (a?.versionId === versionId ? null : { layerId, versionId })),
    use,
    back: () => setAudition(null),
    /** USE (a chip click or the note's) failed. */
    error,
    /** For the note: the layer, the heard take's number and the take in use's. Null when nothing is auditioned. */
    note: audition && layer && heard !== null ? { layerName: layer.name, heard, inUse, versionId: audition.versionId } : null,
  };
}
