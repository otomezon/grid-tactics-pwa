import { expect, type Page } from "@playwright/test";

/**
 * Acknowledges informational map events in browser tests.
 *
 * Wait for each persisted acknowledgement to update the pending event list
 * before inspecting the next dialog. The UI disables the button while the
 * acknowledgement is being saved, so checking only whether the dialog exists
 * can race the asynchronous save and attempt to click the same disabled button.
 *
 * Dialogue choices are deliberately not selected here: tests must choose a
 * branch explicitly rather than silently inventing player intent.
 */
export async function acknowledgePendingMapEvents(page: Page): Promise<void> {
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
    await continueButton.click();

    // The click handler persists asynchronously. Do not loop while the
    // previous dialog is still present and its action button is disabled.
    await expect.poll(async () => {
      if (!(await dialog.count())) return null;
      return dialog.getAttribute("data-event-id");
    }).not.toBe(eventId);
  }

  await expect(dialog).toHaveCount(0);
}
