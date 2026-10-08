/** RE-TIME in the SCORE dock (RT-4, F-093, D-233): offered, refused with why, or nothing. */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DockRetime } from './DockRetime';
import { INITIAL_SCORE, type ScoreVerbState } from './scoreVerbTypes';
import type { ScoreStatusView } from './api';

const at = (retime: ScoreStatusView['retime'], over: Partial<ScoreVerbState> = {}) => renderToStaticMarkup(
  <DockRetime songId="s1" state={{ ...INITIAL_SCORE, phase: { kind: 'asking' }, status: { state: 'eligible', retime }, ...over }} />);

describe('DockRetime', () => {
  it('offered: the tempo read and HALF · DOUBLE · BPM… as sky choices', () => {
    const out = at({ state: 'offered', readBpm: 93.7 });
    expect(out).toContain('READ AS');
    expect(out).toContain('93.7 BPM');
    expect(out).toMatch(/HALF.*DOUBLE.*BPM…/);
    expect(out).not.toContain('disabled=""'); // 47 and 187 BPM are both in range
  });
  it('a chip that leaves 40-240 is off, with the reason', () => {
    expect(at({ state: 'offered', readBpm: 130 })).toMatch(/disabled="" title="DOUBLE is off: 260 BPM is over the limit"/);
  });
  it('refused: one quiet line with the reason; not a cover: nothing', () => {
    expect(at({ state: 'refused', reason: 'this take was edited since' })).toBe('<div class="hint retime-dock-off">RE-TIME · this take was edited since</div>');
    expect(at({ state: 'none' })).toBe('');
    expect(at(undefined)).toBe('');
  });
  it('the chips hold still while a plan or a render runs', () => {
    expect(at({ state: 'offered', readBpm: 93.7 }, { phase: { kind: 'rendering', line: '', startedAt: null } })).toMatch(/disabled="".*HALF/);
  });
});
