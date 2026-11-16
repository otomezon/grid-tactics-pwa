import type { GameStateSnapshot } from "../domain/models/game";

const SAVE_FILE_FORMAT = "grid-tactics-pwa-save";
const SAVE_FILE_FORMAT_VERSION = 1;

interface SaveFileEnvelope {
  format: typeof SAVE_FILE_FORMAT;
  formatVersion: typeof SAVE_FILE_FORMAT_VERSION;
  exportedAt: string;
  data: GameStateSnapshot;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Serializes the current save snapshot into a versioned, portable JSON file. */
export function createSaveFileContent(
  snapshot: GameStateSnapshot,
  exportedAt: Date = new Date()
): string {
  if (Number.isNaN(exportedAt.getTime())) {
    throw new Error("The export timestamp is invalid.");
  }

  const envelope: SaveFileEnvelope = {
    format: SAVE_FILE_FORMAT,
    formatVersion: SAVE_FILE_FORMAT_VERSION,
    exportedAt: exportedAt.toISOString(),
    data: snapshot
  };
  return JSON.stringify(envelope, null, 2);
}


/** Builds a stable, generation-specific filename for an exported local backup. */
export function createSaveBackupFileName(
  chapterId: string,
  generation: number,
  exportedAt: Date = new Date()
): string {
  if (!chapterId.trim()) {
    throw new Error("The backup chapter ID is invalid.");
  }
  if (!Number.isInteger(generation) || generation < 1 || generation > 3) {
    throw new Error("The backup generation is invalid.");
  }
  if (Number.isNaN(exportedAt.getTime())) {
    throw new Error("The export timestamp is invalid.");
  }

  const safeChapterId = chapterId.replace(/[^a-z0-9-]/gi, "-");
  const date = exportedAt.toISOString().slice(0, 10);
  return "grid-tactics-" + safeChapterId + "-backup-" + generation + "-" + date + ".json";
}

/** Metadata retained when a portable save envelope is inspected. */
export interface ParsedSaveFileEnvelope {
  formatVersion: typeof SAVE_FILE_FORMAT_VERSION;
  exportedAt: string;
  data: unknown;
}

/** Reads and validates the portable envelope without assuming its game snapshot is current. */
export function parseSaveFileEnvelopeContent(content: string): ParsedSaveFileEnvelope {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content) as unknown;
  } catch {
    throw new Error("ファイルの内容をJSONとして読み込めません。");
  }

  if (
    !isRecord(parsed) ||
    parsed.format !== SAVE_FILE_FORMAT ||
    parsed.formatVersion !== SAVE_FILE_FORMAT_VERSION ||
    typeof parsed.exportedAt !== "string" ||
    !Number.isFinite(Date.parse(parsed.exportedAt)) ||
    !Object.hasOwn(parsed, "data")
  ) {
    throw new Error("Grid Tacticsの対応するセーブファイル形式ではありません。");
  }

  return {
    formatVersion: SAVE_FILE_FORMAT_VERSION,
    exportedAt: parsed.exportedAt,
    data: parsed.data
  };
}

/** Reads the portable envelope. Game-state validation and migration happen separately. */
export function parseSaveFileContent(content: string): unknown {
  return parseSaveFileEnvelopeContent(content).data;
}
