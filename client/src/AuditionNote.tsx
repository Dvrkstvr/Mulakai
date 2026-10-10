interface Props {
  note: { layerName: string; heard: number; inUse: number | null; versionId: string };
  onBack: () => void;
  onUse: (versionId: string) => void;
}

/** The lilac line while a take is heard in place: HEARING BASE v2 · BACK TO v3 · USE v2 (PLAN.md "Editor Redesign",
 * PR 8; lilac = takes). */
export function AuditionNote({ note, onBack, onUse }: Props) {
  return (
    <div className="audition-note" role="status">
      <span className="audition-what">HEARING {note.layerName.toUpperCase()} v{note.heard} · same position · nothing saved</span>
      <button type="button" className="tab dock-quiet" onClick={onBack}><span>BACK TO {note.inUse ? `v${note.inUse}` : 'THE TAKE IN USE'}</span></button>
      <button type="button" className="tab audition-use" onClick={() => onUse(note.versionId)}><span>USE v{note.heard}</span></button>
    </div>
  );
}
