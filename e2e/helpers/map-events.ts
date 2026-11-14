import { expect, type Page } from "@playwright/test";

type AcknowledgementInput = "click" | "tap";

interface AcknowledgePendingMapEventsOptions {
  input?: AcknowledgementInput;
}

/** Reads the persisted acknowledgement IDs, not only the dialog's transient UI state. */
async function readAcknowledgedEventIds(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("grid-tactics-pwa", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Could not open the save database."));
    });

    try {
      const record = await new Promise<{ data?: { acknowledgedMapEventIds?: unknown } } | undefined>((resolve, reject) => {
        const transaction = database.transaction("game-saves", "readonly");
        const request = transaction.objectStore("game-saves").get("auto");
        request.onsuccess = () => resolve(request.result as { data?: { acknowledgedMapEventIds?: unknown } } | undefined);
        request.onerror = () => reject(request.error ?? new Error("Could not read the auto save."));
      });
      const ids = record?.data?.acknowledgedMapEventIds;
      return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [];
    } finally {
      database.close();
    }
  });
}

/**
 * Acknowledges informational map events only after their acknowledgement is persisted.
 *
 * Waiting for the IndexedDB acknowledgement prevents a second click from racing the
 * asynchronous save while the same dialog is still mounted and its button is disabled.
 * Dialogue choices are deliberately not selected here; tests must express a deliberate
 * player choice rather than inventing branch intent.
 */
export async function acknowledgePendingMapEvents(
  page: Page,
  { input = "click" }: AcknowledgePendingMapEventsOptions = {}
): Promise<void> {
  const dialog = page.getByTestId("map-event-dialog");

  while (await dialog.count()) {
    const eventId = await dialog.getAttribute("data-event-id");
    if (!eventId) {
      throw new Error("The pending map event dialog has no event ID.");
    }

    if (await dialog.getByTestId("map-event-choice").count()) {
      throw new Error(
        `Map event "${eventId}" requires an explicit dialogue choice; the acknowledgement helper will not choose for the player.`
      );
    }

    const continueButton = dialog.getByRole("button", {
      name: /次のイベントへ|確認して続ける/
    });
    await expect(continueButton).toBeVisible();
    await expect(continueButton).toBeEnabled();

    if (input === "tap") await continueButton.tap();
    else await continueButton.click();

    await expect.poll(async () => {
      const acknowledgedIds = await readAcknowledgedEventIds(page);
      return acknowledgedIds.includes(eventId);
    }, {
      message: `Map event "${eventId}" should be persisted as acknowledged before the next dialog is handled.`
    }).toBe(true);

    await expect.poll(async () => {
      if (!(await dialog.count())) return null;
      return dialog.getAttribute("data-event-id");
    }).not.toBe(eventId);
  }

  await expect(dialog).toHaveCount(0);
}
