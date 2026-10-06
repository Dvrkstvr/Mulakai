import { describe, it, expect, vi, beforeEach } from 'vitest';

const scoreMidi = vi.fn();
const songScoreMidi = vi.fn();
const saveBlob = vi.fn();
vi.mock('./api', () => ({ api: { scoreMidi: (abc: string) => scoreMidi(abc), songScoreMidi: (id: string) => songScoreMidi(id) } }));
vi.mock('./mixExport', () => ({ saveBlob: (b: Blob, n: string) => saveBlob(b, n) }));

const { convertAbcFile, downloadScoreMidi, downloadSongScoreMidi, midiFilename, useMidiNotice } = await import('./scoreMidi');

beforeEach(() => {
  vi.clearAllMocks();
  useMidiNotice.setState({ error: '' });
});

describe('midiFilename', () => {
  it('swaps an .abc or .txt extension for .mid', () => {
    expect(midiFilename('Copper Sky')).toBe('Copper Sky.mid');
    expect(midiFilename('take 2.ABC')).toBe('take 2.mid');
    expect(midiFilename('fixed.txt')).toBe('fixed.mid');
    expect(midiFilename('  ')).toBe('score.mid');
  });
});

describe('downloads', () => {
  it('saves the converted score under the name as a .mid', async () => {
    const file = new Blob(['MThd']);
    scoreMidi.mockResolvedValue(file);
    await downloadScoreMidi('X:1', 'Ellies City.abc');
    expect(scoreMidi).toHaveBeenCalledWith('X:1');
    expect(saveBlob).toHaveBeenCalledWith(file, 'Ellies City.mid');
  });

  it("saves the song's score under its title", async () => {
    songScoreMidi.mockResolvedValue(new Blob(['MThd']));
    await downloadSongScoreMidi('s1', 'Copper Sky');
    expect(songScoreMidi).toHaveBeenCalledWith('s1');
    expect(saveBlob.mock.calls[0][1]).toBe('Copper Sky.mid');
  });
});

describe('convertAbcFile', () => {
  /** No DOM here: a stand-in input whose click() "picks" `file`. */
  const pick = (file: File) => {
    const input = { files: [file], click() { void this.onchange?.(); } } as { files: File[]; accept?: string; onchange?: () => unknown; click: () => void };
    vi.stubGlobal('document', { createElement: () => input });
    convertAbcFile();
    vi.unstubAllGlobals();
    expect(input.accept).toBe('.abc,.txt,text/plain');
  };

  it('converts the picked file and downloads it', async () => {
    scoreMidi.mockResolvedValue(new Blob(['MThd']));
    pick(new File(['X:1 score'], 'tune.abc'));
    await vi.waitFor(() => expect(saveBlob).toHaveBeenCalled());
    expect(scoreMidi).toHaveBeenCalledWith('X:1 score');
    expect(saveBlob.mock.calls[0][1]).toBe('tune.mid');
    expect(useMidiNotice.getState().error).toBe('');
  });

  it("says why a file wasn't converted", async () => {
    scoreMidi.mockRejectedValue(new Error('Incomplete native two-voice ABC'));
    pick(new File(['junk'], 'other.abc'));
    await vi.waitFor(() => expect(useMidiNotice.getState().error).not.toBe(''));
    expect(useMidiNotice.getState().error).toBe('other.abc is not a YuE2 score: Incomplete native two-voice ABC');
    expect(saveBlob).not.toHaveBeenCalled();
  });
});
