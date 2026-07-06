import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-test-'));

const { getOutputMetadata, updateOutputMetadata } = await import('./outputMetadata.js');

describe('outputMetadata', () => {
  it('starts with sane defaults', () => {
    const meta = getOutputMetadata();
    expect(meta.artist).toBe('');
    expect(meta.encoder).toBe('Mulakai + ACE-Step 1.5');
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

  it('does not validate id3Version here — that happens at the route layer', () => {
    const meta = updateOutputMetadata({ encoder: 'Custom Encoder' });
    expect(meta.encoder).toBe('Custom Encoder');
  });
});
