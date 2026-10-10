import type { Layer } from './api';
import { SplitStemRow } from './SplitStemRow';
import { SplitStemsBar } from './SplitStemsBar';
import { useSplitSession } from './useSplitSession';

interface Props {
  layer: Layer;
  onChanged: () => Promise<void>;
  /** SCORE is still open for the song (F-027): a stem's claim says it ends score editing. */
  scoreOpen: boolean;
}

/** A layer's stems, open under its own lane once SPLIT starts (PLAN.md "Editor Redesign", PR 9). */
export function SplitTray({ layer, onChanged, scoreOpen }: Props) {
  const s = useSplitSession(layer, onChanged);
  return <SplitTrayView layer={layer} session={s} scoreOpen={scoreOpen} />;
}

type Session = Pick<ReturnType<typeof useSplitSession>,
  'stems' | 'status' | 'error' | 'failed' | 'ahead' | 'busyKind' | 'busyAll' | 'claim' | 'reextract' | 'splitAgain' | 'close'>;

/** DOWNLOAD ALL, SPLIT ALL AGAIN, CLOSE (which says what it discards), and a row per stem. Nothing when the layer has
 * no open split. */
export function SplitTrayView({ layer, session: s, scoreOpen }: { layer: Layer; session: Session; scoreOpen: boolean }) {
  if (!s.stems && !s.failed) return null;
  const unkept = s.stems?.filter((x) => !x.claimed).length ?? 0;
  const nextVersion = layer.versions.length + 1;
  return (
    <section className="split-tray" aria-label={`Stems of ${layer.name}`}>
      <div className="split-tray-head">
        <span className="split-tray-title">STEMS OF {layer.name.toUpperCase()}</span>
        {s.status && <span className="hint">{s.status}</span>}
        <button type="button" className="tab dock-quiet split-tray-close" onClick={() => void s.close()}
          title={unkept ? `closes the split; ${unkept} stem${unkept === 1 ? '' : 's'} not kept are discarded` : 'closes the split'}>
          <span>{unkept ? `CLOSE · DISCARD ${unkept} UNKEPT` : 'CLOSE'}</span>
        </button>
      </div>
      {s.stems && (
        <>
          <SplitStemsBar stems={s.stems} layerName={layer.name} busy={s.busyAll || s.busyKind !== null} ahead={s.ahead}
            onSplitAgain={() => void s.splitAgain()} />
          <div className="split-tray-rows">
            {s.stems.map((stem) => (
              <SplitStemRow key={stem.kind} stem={stem} layerName={layer.name} nextVersion={nextVersion}
                busy={s.busyAll || s.busyKind === stem.kind} scoreOpen={scoreOpen}
                onClaim={(action) => void s.claim(stem.kind, action)} onReextract={() => void s.reextract(stem.kind)} />
            ))}
          </div>
        </>
      )}
      {(s.error || s.failed) && <div className="error">{s.error || s.failed}</div>}
    </section>
  );
}
