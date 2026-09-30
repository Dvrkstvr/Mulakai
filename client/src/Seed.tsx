import { Toggle } from './Toggle';

/** RANDOM SEED toggle plus the seed field when it's off — shared by the settings panel's
 * ACE-Step blocks and EngineGenSettings. */
export function Seed({ random, seed, onRandom, onSeed }: {
  random: boolean; seed: number; onRandom: (v: boolean) => void; onSeed: (v: number) => void;
}) {
  return (
    <div className="setting">
      <Toggle label="RANDOM SEED" checked={random} onChange={onRandom} />
      {!random && (
        <input type="number" className="seed" value={seed} onChange={(e) => onSeed(Number(e.target.value))} />
      )}
    </div>
  );
}
