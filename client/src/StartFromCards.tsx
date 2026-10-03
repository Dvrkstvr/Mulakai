import { START_FROM, type GenType } from './createDraft';
import { useCreateDraftStore } from './createDraftStore';

const ORDER: GenType[] = ['prompt', 'audio', 'complete'];

/** START FROM (PLAN.md "S2 — Guided Create", point 1): one card per flow, mapping 1:1 to the
 * draft's genType. Sky, not acid — a card targets which flow the shared draft feeds and commits
 * nothing, so switching keeps everything typed or picked under the others. */
export function StartFromCards() {
  const genType = useCreateDraftStore((s) => s.genType);
  const patch = useCreateDraftStore((s) => s.patch);
  return (
    <div className="start-from">
      <span className="section-label">START FROM</span>
      <div className="start-cards">
        {ORDER.map((t) => (
          <button key={t} type="button" className={t === genType ? 'start-card active' : 'start-card'}
            aria-pressed={t === genType} onClick={() => patch({ genType: t })}>
            <span className="start-card-inner">
              <span className="start-card-title">{START_FROM[t].title}</span>
              <span className="start-card-sub">{START_FROM[t].sub}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
