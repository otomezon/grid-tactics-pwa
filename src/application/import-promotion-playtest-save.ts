import { getChapterById } from "../content/chapters";
import { SAVE_VERSION, type GameStateSnapshot } from "../domain/models/game";
import { migrateGameStateSnapshot } from "../persistence/migrations";
import { parseSaveFileEnvelopeContent } from "../persistence/save-file";

export interface ImportedPromotionPlaytestSave {
  snapshot: GameStateSnapshot;
  exportedAt: string;
  sourceSaveVersion: number;
  normalizedSaveVersion: typeof SAVE_VERSION;
  migrated: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Parses a user-selected portable save, migrates legacy snapshots in memory,
 * and validates the result against the registered chapter map. No persistence
 * or live campaign state is accessed by this importer.
 */
export function importPromotionPlaytestSaveContent(
  content: string
): ImportedPromotionPlaytestSave {
  const envelope = parseSaveFileEnvelopeContent(content);
  const value = envelope.data;

  if (!isRecord(value) || typeof value.chapterId !== "string") {
    throw new Error("セーブsnapshotの章IDを確認できません。");
  }
  if (typeof value.saveVersion !== "number" || !Number.isInteger(value.saveVersion)) {
    throw new Error("セーブsnapshotのsaveVersionを確認できません。");
  }

  const chapter = getChapterById(value.chapterId);
  if (!chapter) {
    throw new Error("未登録の章IDです: " + value.chapterId);
  }

  const migration = migrateGameStateSnapshot(value, chapter.map);
  if (!migration) {
    throw new Error(
      "saveVersion " + value.saveVersion + "または章マップ整合性の検証に失敗しました。"
    );
  }

  return {
    snapshot: migration.snapshot,
    exportedAt: envelope.exportedAt,
    sourceSaveVersion: value.saveVersion,
    normalizedSaveVersion: migration.snapshot.saveVersion,
    migrated: migration.migrated
  };
}
