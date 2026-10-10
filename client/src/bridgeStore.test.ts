import { beforeEach, describe, expect, it } from 'vitest';
import { useBridgeStore } from './bridgeStore';

describe('useBridgeStore', () => {
  beforeEach(() => { useBridgeStore.setState({ toChat: null, toEditor: null }); });

  it("the song's chat takes the handed part once", () => {
    useBridgeStore.getState().sendToChat({ songId: 's1', seconds: [77, 108] });
    expect(useBridgeStore.getState().takeForChat('s1')).toEqual([77, 108]);
    expect(useBridgeStore.getState().takeForChat('s1')).toBeNull();
  });

  it("another song's chat or Editor never takes it", () => {
    useBridgeStore.getState().sendToChat({ songId: 's1', seconds: [77, 108] });
    useBridgeStore.getState().sendToEditor({ songId: 's1', seconds: [10, 20] });
    expect(useBridgeStore.getState().takeForChat('s2')).toBeNull();
    expect(useBridgeStore.getState().takeForEditor('s2')).toBeNull();
    expect(useBridgeStore.getState().takeForEditor('s1')).toEqual([10, 20]);
  });
});
