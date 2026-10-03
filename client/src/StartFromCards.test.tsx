import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { StartFromCards } from './StartFromCards';
import { RecipeQuality } from './RecipeQuality';

// Static rendering reads each store's initial state (zustand's server snapshot), which is what a
// fresh Create opens on: AN IDEA and BALANCED.
const pressed = (html: string) => [...html.matchAll(/aria-pressed="true"[^>]*>(?:<span[^>]*>){1,2}([A-Z ]+)</g)].map((m) => m[1]);

describe('START FROM cards', () => {
  it('preselect AN IDEA on a fresh draft, one card per flow', () => {
    const html = renderToStaticMarkup(<StartFromCards />);
    expect(pressed(html)).toEqual(['AN IDEA']);
    expect(html).toContain('A SONG I HAVE');
    expect(html).toContain('ONE TRACK');
  });
});

describe('QUALITY chips', () => {
  it('light BALANCED by default, which leaves steps to AUTO', () => {
    const html = renderToStaticMarkup(<RecipeQuality stepsModel="acestep-v15-turbo" naReason={null} />);
    expect(pressed(html)).toEqual(['BALANCED']);
    expect(html).toContain('AUTO steps');
  });

  it('read N/A with the reason on an engine without step control', () => {
    const html = renderToStaticMarkup(<RecipeQuality stepsModel="" naReason="YUE2 has no step control" />);
    expect(html).toContain('N/A');
    expect(html).toContain('YUE2 has no step control');
    expect(html).not.toContain('<button');
  });
});
