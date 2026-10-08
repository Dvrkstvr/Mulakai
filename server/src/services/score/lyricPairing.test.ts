/** The one server pairing rule (D-216, D-066 d), cross-tested against yue-server: `read-sections.json` is the
 * song yue-server's own `test_score_lyrics.py` pins as `pairs(...) == {0: 0, 1: 1, 2: 2, 3: 6}`. */
import { describe, it, expect } from 'vitest';
import { contract } from '../../../test-fakes/fakeYue.js';
import { blockOf, kindOf, pairBlocks, sectionOf } from './lyricPairing.js';
import type { ScoreFacts } from './planTypes.js';

const read = contract('read-sections');
const facts = read.response.body.facts as ScoreFacts;

describe('kindOf (yue-server tag_word)', () => {
  it.each([
    ['[Verse 2]', 'verse'], ['verse', 'verse'], ['[Intro - Piano]', 'intro'], ['[Pre-Chorus]', 'pre-chorus'],
    ['pre-chorus', 'pre-chorus'], ['[Chorus]:', 'chorus'], ['', ''], ['Bridge', 'bridge'],
  ])('%s -> %s', (tag, kind) => expect(kindOf(tag)).toBe(kind));
});

describe('pairBlocks', () => {
  it('matches yue-server on read-sections.json: section positions 0,1,2,3 sing blocks 0,1,2,6', () => {
    const pairs = pairBlocks(facts.sections, facts.lyric_blocks);
    const positions = [...pairs].map(([s, b]) => [facts.sections.findIndex((x) => x.index === s), facts.lyric_blocks.findIndex((x) => x.index === b)]);
    expect(positions).toEqual([[0, 0], [1, 1], [2, 2], [3, 6]]);
  });
  it('the fixture\'s blocks are the ones its request lyrics hold (the cross-test reads the same song yue-server did)', () => {
    const tags = (read.request.body.lyrics as string).split('\n').filter((l) => l.startsWith('['));
    expect(facts.lyric_blocks.map((b) => b.tag)).toEqual(tags);
  });
  it('the k-th section of a kind sings the k-th block of it; extras on either side pair with nothing (python pairs())', () => {
    const labels = ['intro', 'verse', 'chorus', 'verse', 'chorus', 'chorus', 'pre-chorus', 'outro'];
    const sections = labels.map((label, i) => ({ index: i + 1, label }));
    const tags = ['[Intro]', '[Verse 1]', '[Chorus]', '[Verse 2]', '[Pre-Chorus]', '[Chorus]', '[Outro - fade]'];
    const blocks = tags.map((tag, i) => ({ index: i + 1, tag }));
    // yue-server: pairs(labels, blocks) == {0: 0, 1: 1, 2: 2, 3: 3, 4: 5, 6: 4, 7: 6} (third chorus sings nothing)
    expect([...pairBlocks(sections, blocks)]).toEqual([[1, 1], [2, 2], [3, 3], [4, 4], [5, 6], [7, 5], [8, 7]]);
  });
  it('untagged blocks pair with nothing labelled', () => {
    expect(pairBlocks([{ index: 1, label: 'verse' }], [{ index: 1, tag: '' }]).size).toBe(0);
  });
});

describe('blockOf / sectionOf', () => {
  it('the chorus section sings block 3; the outro block 7; the second chorus block has no section', () => {
    expect(blockOf(facts, 3)?.index).toBe(3);
    expect(blockOf(facts, 4)?.index).toBe(7);
    expect(sectionOf(facts, 5)).toBeUndefined();
    expect(sectionOf(facts, 7)?.index).toBe(4);
    expect(blockOf(facts, 99)).toBeUndefined();
  });
});
