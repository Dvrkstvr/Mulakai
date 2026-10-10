/** ✦ HELP shows only when help is on (a local LLM, inside the action bar) and opens nothing on its own. */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AssistContext, type AssistSong } from './assistContext';
import { HelpBox } from './HelpBox';

const SONG: AssistSong = { base: { songId: 's1', caption: 'EDM', bpm: 128, key: null, layers: ['Base'], part: '' } };
const box = <HelpBox kind="layer" layer="Strings" current="" onUse={() => {}} />;

describe('HelpBox', () => {
  it('nothing when help is off', () => {
    expect(renderToStaticMarkup(box)).toBe('');
  });

  it('a closed ✦ HELP button when help is on', () => {
    const html = renderToStaticMarkup(<AssistContext.Provider value={SONG}>{box}</AssistContext.Provider>);
    expect(html).toContain('✦ HELP');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('help-box');
  });
});
