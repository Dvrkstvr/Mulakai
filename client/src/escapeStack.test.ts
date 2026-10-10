import { describe, expect, it, vi } from 'vitest';
import { handleEscape, pushEscape } from './escapeStack';

const press = (key = 'Escape', defaultPrevented = false) => {
  const e = { key, defaultPrevented, preventDefault: vi.fn() };
  handleEscape(e);
  return e;
};

describe('escapeStack', () => {
  it('Escape closes the newest overlay only', () => {
    const help = vi.fn();
    const exportMenu = vi.fn();
    const popHelp = pushEscape(help);
    const popExport = pushEscape(exportMenu);
    const e = press();
    expect(exportMenu).toHaveBeenCalledTimes(1);
    expect(help).not.toHaveBeenCalled();
    expect(e.preventDefault).toHaveBeenCalled();
    popExport();
    press();
    expect(help).toHaveBeenCalledTimes(1);
    popHelp();
  });

  it('with nothing open, Escape is left to the Editor', () => {
    const e = press();
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  it('other keys and an Escape already handled close nothing', () => {
    const close = vi.fn();
    const pop = pushEscape(close);
    press('Enter');
    press('Escape', true);
    expect(close).not.toHaveBeenCalled();
    pop();
  });

  it('closing an older overlay keeps the newer one on top', () => {
    const older = vi.fn();
    const newer = vi.fn();
    const popOlder = pushEscape(older);
    const popNewer = pushEscape(newer);
    popOlder();
    press();
    expect(newer).toHaveBeenCalledTimes(1);
    expect(older).not.toHaveBeenCalled();
    popNewer();
  });
});
