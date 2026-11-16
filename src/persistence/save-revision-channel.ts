const CHANNEL_NAME = "grid-tactics-pwa:auto-save-revision:v1";
const MESSAGE_KIND = "auto-save-revision-changed";

interface SaveRevisionMessage {
  kind: typeof MESSAGE_KIND;
  savedAt: number;
}

export interface SaveRevisionChannel {
  announce(savedAt: number): void;
  close(): void;
}

function isSaveRevisionMessage(value: unknown): value is SaveRevisionMessage {
  if (typeof value !== "object" || value === null) return false;
  const message = value as Partial<SaveRevisionMessage>;
  return message.kind === MESSAGE_KIND &&
    typeof message.savedAt === "number" &&
    Number.isSafeInteger(message.savedAt) &&
    message.savedAt > 0;
}

/**
 * Announces only the auto-save revision, never the save payload.
 * IndexedDB's transaction-level revision comparison remains authoritative;
 * this channel only lets already-open tabs stop sooner.
 */
export function createSaveRevisionChannel(
  onRemoteRevision: (savedAt: number) => void
): SaveRevisionChannel | null {
  if (typeof BroadcastChannel === "undefined") return null;

  let channel: BroadcastChannel;
  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
  } catch {
    return null;
  }

  channel.onmessage = (event: MessageEvent<unknown>) => {
    if (!isSaveRevisionMessage(event.data)) return;
    onRemoteRevision(event.data.savedAt);
  };

  return {
    announce(savedAt: number): void {
      if (!Number.isSafeInteger(savedAt) || savedAt <= 0) return;
      try {
        channel.postMessage({ kind: MESSAGE_KIND, savedAt } satisfies SaveRevisionMessage);
      } catch {
        // A channel failure must not weaken or interrupt the IndexedDB save path.
      }
    },
    close(): void {
      channel.onmessage = null;
      try {
        channel.close();
      } catch {
        // Closing a channel is best-effort cleanup.
      }
    }
  };
}
