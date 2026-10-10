import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DockCommit } from './DockCommit';
import { SplitStemRow } from './SplitStemRow';
import { SCORE_ENDS } from './scoreCopy';
import type { StemResult } from './api';

const CLAUSE = `<span class="score-ends">${SCORE_ENDS}</span>`;

describe('the score clause in a consequence line (F-027, D-030)', () => {
  it('ends the dock commit line, in its own rust-body span', () => {
    const html = renderToStaticMarkup(<DockCommit consequence="Saves base v2" scoreEnds={SCORE_ENDS} label="REPAINT BASE" />);
    expect(html).toContain(`<span class="dock-consequence">Saves base v2 · ${CLAUSE}</span>`);
  });

  it('is absent when the line has none', () => {
    const html = renderToStaticMarkup(<DockCommit consequence="Saves base v2" scoreEnds={null} label="REPAINT BASE" />);
    expect(html).toContain('<span class="dock-consequence">Saves base v2</span>');
    expect(html).not.toContain('score-ends');
  });

  it("ends a ready stem's claim line while SCORE is open, and only then", () => {
    const stem: StemResult = { kind: 'vocals', status: 'done' };
    const row = (scoreOpen: boolean) => renderToStaticMarkup(
      <SplitStemRow stem={stem} layerName="base" nextVersion={2} busy={false} scoreOpen={scoreOpen} onClaim={() => {}} onReextract={() => {}} />,
    );
    expect(row(true)).toContain(`keep adds a lane · use saves base v2 · ${CLAUSE}`);
    expect(row(false)).toContain('keep adds a lane · use saves base v2</div>');
  });
});
