import { ShaderCanvas } from './ShaderCanvas';

export function Toggle({ label, checked, onChange, ai, disabled }: {
  label: string; checked: boolean; onChange: (v: boolean) => void; ai?: boolean; disabled?: boolean;
}) {
  const cls = ['toggle', checked && 'on', checked && ai && 'toggle-ai', disabled && 'setting-disabled'].filter(Boolean).join(' ');
  return (
    <button className={cls} disabled={disabled} onClick={() => onChange(!checked)}>
      {checked && ai && (
        <div className="toggle-shader">
          <ShaderCanvas />
        </div>
      )}
      <span>{label}</span><span className="dot" />
    </button>
  );
}
