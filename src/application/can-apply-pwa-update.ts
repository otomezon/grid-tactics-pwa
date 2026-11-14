export type PwaUpdateSaveStatus = "loading" | "ready" | "saving" | "saved" | "unavailable" | "failed" | "invalid";

export interface PwaUpdateSafetyInput {
  isTitleScreenVisible: boolean;
  battleOutcome: "playing" | "victory" | "defeat";
  deploymentPending: boolean;
  saveStatus: PwaUpdateSaveStatus;
  loadBlocked: boolean;
  backupActionPending: boolean;
  isStartingNextChapter: boolean;
  hasPendingMapEvents: boolean;
}

/** Allow a page-reloading update only from a stable, persisted campaign screen. */
export function canApplyPwaUpdate(input: PwaUpdateSafetyInput): boolean {
  const stableScreen = input.isTitleScreenVisible ||
    (!input.deploymentPending && input.battleOutcome !== "playing");

  return stableScreen &&
    input.saveStatus === "saved" &&
    !input.loadBlocked &&
    !input.backupActionPending &&
    !input.isStartingNextChapter &&
    !input.hasPendingMapEvents;
}
