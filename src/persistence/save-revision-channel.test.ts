import { afterEach, describe, expect, it, vi } from "vitest";
import { createSaveRevisionChannel } from "./save-revision-channel";

class FakeBroadcastChannel {
  static instances: FakeBroadcastChannel[] = [];

  onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
  messages: unknown[] = [];
  closed = false;

  constructor(readonly name: string) {
    FakeBroadcastChannel.instances.push(this);
  }

  postMessage(message: unknown): void {
    this.messages.push(message);
  }

  close(): void {
    this.closed = true;
  }

  dispatch(data: unknown): void {
    this.onmessage?.({ data } as MessageEvent<unknown>);
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  FakeBroadcastChannel.instances = [];
});

describe("createSaveRevisionChannel", () => {
  it("returns null when BroadcastChannel is unavailable", () => {
    vi.stubGlobal("BroadcastChannel", undefined);

    expect(createSaveRevisionChannel(() => undefined)).toBeNull();
  });

  it("receives only valid positive safe-integer revisions", () => {
    vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);
    const onRemoteRevision = vi.fn();
    createSaveRevisionChannel(onRemoteRevision);

    const channel = FakeBroadcastChannel.instances[0];
    expect(channel.name).toBe("grid-tactics-pwa:auto-save-revision:v1");
    channel.dispatch({ kind: "auto-save-revision-changed", savedAt: 1_700_000_000_000 });
    channel.dispatch({ kind: "other-message", savedAt: 1_700_000_000_001 });
    channel.dispatch({ kind: "auto-save-revision-changed", savedAt: -1 });
    channel.dispatch({ kind: "auto-save-revision-changed", savedAt: Number.MAX_SAFE_INTEGER + 1 });
    channel.dispatch(null);

    expect(onRemoteRevision).toHaveBeenCalledTimes(1);
    expect(onRemoteRevision).toHaveBeenCalledWith(1_700_000_000_000);
  });

  it("announces only the revision number and ignores invalid outbound values", () => {
    vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);
    const revisionChannel = createSaveRevisionChannel(() => undefined)!;
    const channel = FakeBroadcastChannel.instances[0];

    revisionChannel.announce(1_700_000_000_010);
    revisionChannel.announce(0);
    revisionChannel.announce(Number.POSITIVE_INFINITY);
    revisionChannel.announce(Number.MAX_SAFE_INTEGER + 1);

    expect(channel.messages).toEqual([
      { kind: "auto-save-revision-changed", savedAt: 1_700_000_000_010 }
    ]);
  });

  it("closes the underlying channel and releases its message handler", () => {
    vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);
    const onRemoteRevision = vi.fn();
    const revisionChannel = createSaveRevisionChannel(onRemoteRevision)!;
    const channel = FakeBroadcastChannel.instances[0];

    revisionChannel.close();
    channel.dispatch({ kind: "auto-save-revision-changed", savedAt: 1_700_000_000_020 });

    expect(channel.closed).toBe(true);
    expect(channel.onmessage).toBeNull();
    expect(onRemoteRevision).not.toHaveBeenCalled();
  });

  it("falls back cleanly when channel construction is rejected", () => {
    class UnavailableBroadcastChannel {
      constructor() {
        throw new Error("BroadcastChannel blocked");
      }
    }
    vi.stubGlobal("BroadcastChannel", UnavailableBroadcastChannel);

    expect(createSaveRevisionChannel(() => undefined)).toBeNull();
  });
});
