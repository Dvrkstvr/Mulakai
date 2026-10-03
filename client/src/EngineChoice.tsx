import type { EngineId, EngineInfo } from './api';
import { useCreateDraftStore } from './createDraftStore';
import { coverEngines, coverUnavailableReason, pickerEngines, unavailableReason } from './engineCaps';
import { useEngineStore } from './engineStore';
import { useEngineCaps } from './useEngineCaps';

type Choice = Pick<EngineInfo, 'id' | 'label' | 'configured' | 'ready' | 'coverReady'>;

interface Props {
  /** The engines this tab can offer, ACE-STEP first; none = no row. */
  choices: Choice[];
  value: EngineId;
  onPick: (id: EngineId) => void;
  /** Why an extra engine can't take this tab's job right now; '' when it can. */
  reasonFor: (e: Choice) => string;
  /** A job whose result belongs to this engine's draft, which holds the choice still until done. */
  lockedBy?: string | null;
}

/** ACE-STEP as the only engine there is: a fixed sky chip, nothing to pick. */
export function AceStepOnly() {
  return <div className="type-tabs"><span className="tab engine-tab active fixed"><span>ACE-STEP</span></span></div>;
}

/** The RECIPE card's ENGINE row: which model makes this flow's song (PLAN.md design point 11,
 * "Client cover decisions" for COVER, and "S2 — Guided Create"). Sky, not acid — picking an
 * engine targets where the request goes; GENERATE commits it. Until some extra engine can take
 * the flow's job it shows ACE-STEP fixed, so a default install has nothing to choose. */
export function EngineChoice({ choices: offered, value, onPick, reasonFor, lockedBy = null }: Props) {
  const engines = useEngineStore((s) => s.engines);
  const loaded = useEngineStore((s) => s.loaded);
  const { info, unavailable } = useEngineCaps();

  const choices = [...offered];
  // A reused draft can name an engine that can't take the job now: keep it visible (and
  // selected) so the draft says what it asks for, next to ACE-STEP as the way out.
  if (value !== 'acestep' && !choices.some((e) => e.id === value)) {
    if (!choices.some((e) => e.id === 'acestep')) {
      choices.unshift(engines.find((e) => e.id === 'acestep')
        ?? { id: 'acestep', label: 'ACE-STEP', configured: true, ready: true, coverReady: true });
    }
    choices.push(info ?? { id: value, label: value.toUpperCase(), configured: false, ready: false, coverReady: false });
  }
  if (choices.length === 0) return <AceStepOnly />;

  const reason = (e: Choice) => (e.id === 'acestep' ? '' : reasonFor(e));
  const selected = choices.find((e) => e.id === value);
  return (
    <>
      <div className="type-tabs">
        {choices.map((e) => (
          <button key={e.id} className={e.id === value ? 'tab engine-tab active' : 'tab engine-tab'}
            disabled={!!lockedBy || (!!reason(e) && e.id !== value)} title={reason(e) || undefined}
            onClick={() => onPick(e.id)}>
            <span>{e.label}</span>
          </button>
        ))}
      </div>
      {lockedBy && <div className="hint">ENGINE is locked while {lockedBy} runs — its result belongs to this engine&apos;s cover</div>}
      {choices.filter((e) => e.id !== value && reason(e)).map((e) => (
        <div key={e.id} className="hint">{e.label} — {reason(e)}</div>
      ))}
      {unavailable && loaded && selected && (
        <div className="warn-note">
          {selected.label} can&apos;t take a job right now ({reason(selected)}) — GENERATE is off until
          it&apos;s back, or switch to ACE-STEP.
        </div>
      )}
    </>
  );
}

/** AN IDEA's ENGINE row: every configured extra engine. */
export function PromptEngineChoice() {
  const engines = useEngineStore((s) => s.engines);
  const engine = useCreateDraftStore((s) => s.engine);
  const patch = useCreateDraftStore((s) => s.patch);
  return <EngineChoice choices={pickerEngines(engines)} value={engine} onPick={(id) => patch({ engine: id })} reasonFor={unavailableReason} />;
}

/** A SONG I HAVE's ENGINE row: engines that can cover. ONE TRACK is ACE-Step only. `lockedBy`
 * names a job reading the source for this engine (PLAN.md "COVER's Engine Holds Still Too"). */
export function CoverEngineChoice({ lockedBy = null }: { lockedBy?: string | null }) {
  const engines = useEngineStore((s) => s.engines);
  const engine = useCreateDraftStore((s) => s.audio.engine);
  const patchAudio = useCreateDraftStore((s) => s.patchAudio);
  return <EngineChoice choices={coverEngines(engines)} value={engine} onPick={(id) => patchAudio({ engine: id })} reasonFor={coverUnavailableReason} lockedBy={lockedBy} />;
}
