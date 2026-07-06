import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-test-'));

const { getOutputMetadata, updateOutputMetadata, setCoverArt, clearCoverArt } = await import('./outputMetadata.js');

describe('outputMetadata', () => {
  it('starts with sane defaults', () => {
    const meta = getOutputMetadata();
    expect(meta.artist).toBe('');
    expect(meta.encoder).toBe('Mulakai + ACE-Step 1.5');
    expect(meta.album).toBe('');
    expect(meta.genre).toBe('');
    expect(meta.coverArtFile).toBeNull();
    expect(meta.id3Version).toBe('4');
  });

  it('updates only the fields provided', () => {
    updateOutputMetadata({ artist: 'Copper Sky' });
    updateOutputMetadata({ id3Version: '3' });
    const meta = getOutputMetadata();
    expect(meta.artist).toBe('Copper Sky');
    expect(meta.id3Version).toBe('3');
    expect(meta.encoder).toBe('Mulakai + ACE-Step 1.5'); // untouched
  });

  it('rejects an id3Version outside 3/4 at the route layer, not here — service trusts its caller', () => {
    // service itself just persists whatever is passed; validation happens in routes/outputMetadata.ts
    const meta = updateOutputMetadata({ genre: 'synthwave' });
    expect(meta.genre).toBe('synthwave');
  });

  it('stores and clears cover art on disk', async () => {
    const withArt = await setCoverArt(Buffer.from('fake-png-bytes'), '.png');
    expect(withArt.coverArtFile).toBe('_cover-art.png');
    const filePath = path.join(process.env.DATA_DIR!, 'audio', withArt.coverArtFile!);
    expect(fs.existsSync(filePath)).toBe(true);

    const cleared = await clearCoverArt();
    expect(cleared.coverArtFile).toBeNull();
    expect(fs.existsSync(filePath)).toBe(false);
  });

  it('replacing cover art removes the old file', async () => {
    const first = await setCoverArt(Buffer.from('one'), '.jpg');
    const firstPath = path.join(process.env.DATA_DIR!, 'audio', first.coverArtFile!);
    const second = await setCoverArt(Buffer.from('two'), '.png');
    expect(fs.existsSync(firstPath)).toBe(false);
    expect(second.coverArtFile).toBe('_cover-art.png');
  });
});
