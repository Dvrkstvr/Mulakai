/** The composer's pending attachment (F-061): uploading with progress → attached / failed with the server's reason,
 * a library pick, ✕ (aborts an upload), a newer attach wins, and what SEND carries. */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ReferenceView, UploadOpts } from './api/chatReferences';

const { ApiError } = await vi.importActual<typeof import('./api/http')>('./api/http');
const chatReferencesApi = {
  uploadReference: vi.fn<(threadId: string, file: File, opts?: UploadOpts) => Promise<ReferenceView>>(),
  pickLibraryReference: vi.fn<(threadId: string, songId: string) => Promise<ReferenceView>>(),
};
vi.mock('./api/chatReferences', () => ({ chatReferencesApi }));
const { useChatAttachStore, attachBlocksSend, attachToSend } = await import('./chatAttachStore');

const ref = (over: Partial<ReferenceView> = {}): ReferenceView => ({
  id: 'r1', threadId: 't1', origin: 'upload', name: 'demo.mp3', sourceSongId: null, url: '/audio/references/r1.mp3', bytes: 10,
  seconds: 192, reading: null, createdAt: '', ...over,
});
const file = new File(['x'], 'demo.mp3', { type: 'audio/mpeg' });
const store = () => useChatAttachStore.getState();
const deferred = <T>() => { let resolve!: (v: T) => void; let reject!: (e: unknown) => void; const p = new Promise<T>((a, b) => { resolve = a; reject = b; }); return { p, resolve, reject }; };

beforeEach(() => { useChatAttachStore.setState({ byThread: {} }); vi.clearAllMocks(); });

describe('chatAttachStore', () => {
  it('a file uploads with progress, then is attached with its length; SEND carries its id', async () => {
    const d = deferred<ReferenceView>();
    chatReferencesApi.uploadReference.mockImplementation((_t, _f, opts) => { opts?.onProgress?.(0.41); return d.p; });
    const done = store().attachFile('t1', file);
    expect(store().byThread.t1).toEqual({ phase: 'uploading', name: 'demo.mp3', progress: 0.41 });
    expect(attachBlocksSend(store().byThread.t1)).toBe(true);
    d.resolve(ref());
    await done;
    expect(store().byThread.t1).toEqual({ phase: 'attached', name: 'demo.mp3', referenceId: 'r1', seconds: 192 });
    expect(attachBlocksSend(store().byThread.t1)).toBe(false);
    expect(attachToSend(store().byThread.t1)).toEqual({ referenceId: 'r1' });
  });

  it('a non-audio file fails with the server\'s reason; nothing rides on SEND', async () => {
    chatReferencesApi.uploadReference.mockRejectedValue(new ApiError('this is not an audio file', 400));
    await store().attachFile('t1', file);
    expect(store().byThread.t1).toEqual({ phase: 'failed', name: 'demo.mp3', reason: 'this is not an audio file' });
    expect(attachToSend(store().byThread.t1)).toBeNull();
    expect(attachBlocksSend(store().byThread.t1)).toBe(false);
  });

  it('a library pick is attached by its title', async () => {
    chatReferencesApi.pickLibraryReference.mockResolvedValue(ref({ id: 'r2', origin: 'library', name: 'Luz sobre el mar', seconds: 150 }));
    await store().attachLibrary('t1', 's9', 'Luz sobre el mar');
    expect(chatReferencesApi.pickLibraryReference).toHaveBeenCalledWith('t1', 's9');
    expect(store().byThread.t1).toEqual({ phase: 'attached', name: 'Luz sobre el mar', referenceId: 'r2', seconds: 150 });
  });

  it('✕ during an upload aborts it and its late answer changes nothing', async () => {
    const d = deferred<ReferenceView>();
    let signal: AbortSignal | undefined;
    chatReferencesApi.uploadReference.mockImplementation((_t, _f, opts) => { signal = opts?.signal; return d.p; });
    const done = store().attachFile('t1', file);
    store().remove('t1');
    expect(signal?.aborted).toBe(true);
    expect(store().byThread.t1).toBeUndefined();
    d.reject(new DOMException('aborted', 'AbortError'));
    await done;
    expect(store().byThread.t1).toBeUndefined();
  });

  it('a newer attach replaces the one still uploading', async () => {
    const first = deferred<ReferenceView>();
    chatReferencesApi.uploadReference.mockReturnValueOnce(first.p);
    const a = store().attachFile('t1', file);
    chatReferencesApi.pickLibraryReference.mockResolvedValue(ref({ id: 'r2', name: 'Other' }));
    await store().attachLibrary('t1', 's9', 'Other');
    first.resolve(ref());
    await a;
    expect(store().byThread.t1).toMatchObject({ phase: 'attached', referenceId: 'r2' });
  });

  it('sent clears the thread\'s chip and keeps other threads\'', async () => {
    chatReferencesApi.pickLibraryReference.mockResolvedValue(ref());
    await store().attachLibrary('t1', 's1', 'A');
    await store().attachLibrary('t2', 's1', 'A');
    store().sent('t1');
    expect(store().byThread.t1).toBeUndefined();
    expect(store().byThread.t2?.phase).toBe('attached');
  });
});
