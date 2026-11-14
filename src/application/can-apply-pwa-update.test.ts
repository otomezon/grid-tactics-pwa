import { describe, expect, it } from "vitest";
import { canApplyPwaUpdate, type PwaUpdateSafetyInput } from "./can-apply-pwa-update";

const safeTitleScreen: PwaUpdateSafetyInput = {
  isTitleScreenVisible: true,
  battleOutcome: "playing",
  deploymentPending: false,
  saveStatus: "saved",
  loadBlocked: false,
  backupActionPending: false,
  isStartingNextChapter: false,
  hasPendingMapEvents: false
};

describe("canApplyPwaUpdate", () => {
  it("allows an update from the saved title screen", () => {
    expect(canApplyPwaUpdate(safeTitleScreen)).toBe(true);
  });

  it("waits while a battle is still in progress", () => {
    expect(canApplyPwaUpdate({ ...safeTitleScreen, isTitleScreenVisible: false })).toBe(false);
  });

  it("waits while deployment has not been confirmed", () => {
    expect(canApplyPwaUpdate({
      ...safeTitleScreen, isTitleScreenVisible: false, deploymentPending: true
    })).toBe(false);
  });

  it.each(["victory", "defeat"] as const)("allows a saved terminal result (%s)", (battleOutcome) => {
    expect(canApplyPwaUpdate({ ...safeTitleScreen, isTitleScreenVisible: false, battleOutcome })).toBe(true);
  });

  it.each(["loading", "ready", "saving", "unavailable", "failed", "invalid"] as const)(
    "waits while save status is %s",
    (saveStatus) => expect(canApplyPwaUpdate({ ...safeTitleScreen, saveStatus })).toBe(false)
  );

  it.each([
    ["loadBlocked", { loadBlocked: true }],
    ["backupActionPending", { backupActionPending: true }],
    ["isStartingNextChapter", { isStartingNextChapter: true }],
    ["hasPendingMapEvents", { hasPendingMapEvents: true }]
  ] as const)("waits when %s is active", (_name, override) => {
    expect(canApplyPwaUpdate({ ...safeTitleScreen, ...override })).toBe(false);
  });
});
