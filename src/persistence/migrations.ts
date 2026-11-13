import { WEAPON_ID_BY_TYPE, WEAPONS_BY_ID } from "../content/weapons";
import type { GameMapDefinition, GameStateSnapshot, WeaponType } from "../domain/models/game";
import { SAVE_VERSION } from "../domain/models/game";
import { isValidGameStateSnapshot } from "../domain/models/validate-game-state";

const LEGACY_SAVE_VERSION = 1;
const VERSION_TWO_SAVE_VERSION = 2;
const PREVIOUS_SAVE_VERSION = 3;
const VERSION_FOUR_SAVE_VERSION = 4;
const VERSION_FIVE_SAVE_VERSION = 5;
const VERSION_SIX_SAVE_VERSION = 6;
const FALLBACK_RNG_STATE = 0x6d2b79f5;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function legacyRngState(value: Record<string, unknown>): number {
  const snapshot = JSON.stringify({
    chapterId: value.chapterId,
    turn: value.turn,
    units: Array.isArray(value.units) ? value.units.map((unit) => {
      if (!isRecord(unit)) return unit;
      return { id: unit.id, currentHp: unit.currentHp, position: unit.position, experience: unit.experience };
    }) : value.units
  });
  if (!snapshot) return FALLBACK_RNG_STATE;
  let hash = 0x811c9dc5;
  for (let index = 0; index < snapshot.length; index += 1) {
    hash ^= snapshot.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  const seed = hash >>> 0;
  return seed === 0 ? FALLBACK_RNG_STATE : seed;
}
function migrateLegacyUnit(candidate: unknown): unknown {
  if (!isRecord(candidate)) return candidate;
  const usableWeaponTypes = Array.isArray(candidate.usableWeaponTypes) ? candidate.usableWeaponTypes : [];
  const firstWeaponType = usableWeaponTypes.find(
    (weaponType): weaponType is WeaponType =>
      typeof weaponType === "string" && Object.hasOwn(WEAPON_ID_BY_TYPE, weaponType)
  );
  const defaultWeaponId = firstWeaponType ? WEAPON_ID_BY_TYPE[firstWeaponType] : undefined;
  const inventory = Array.isArray(candidate.inventory)
    ? candidate.inventory.map((itemId) =>
        itemId === "prototype_weapon" && defaultWeaponId ? defaultWeaponId : itemId
      )
    : candidate.inventory;
  const existingEquipped = candidate.equippedWeaponId;
  const equippedWeaponId =
    typeof existingEquipped === "string" && Array.isArray(inventory) &&
    inventory.includes(existingEquipped) && Object.hasOwn(WEAPONS_BY_ID, existingEquipped)
      ? existingEquipped
      : Array.isArray(inventory)
        ? inventory.find((itemId): itemId is string =>
            typeof itemId === "string" && Object.hasOwn(WEAPONS_BY_ID, itemId)
          ) ?? null
        : null;
  return { ...candidate, inventory, equippedWeaponId };
}
export interface GameStateMigrationResult {
  snapshot: GameStateSnapshot;
  migrated: boolean;
}
/** Adds durable dialogue choice selections in v7 while preserving previous migration behavior. */
export function migrateGameStateSnapshot(
  value: unknown,
  map: GameMapDefinition
): GameStateMigrationResult | null {
  if (isValidGameStateSnapshot(value, map)) return { snapshot: value, migrated: false };
  if (!isRecord(value)) return null;

  let candidate: unknown;
  if (value.saveVersion === VERSION_SIX_SAVE_VERSION) {
    candidate = {
      ...value,
      saveVersion: SAVE_VERSION,
      mapEventChoices: []
    };
  } else if (value.saveVersion === VERSION_FIVE_SAVE_VERSION) {
    candidate = {
      ...value,
      saveVersion: SAVE_VERSION,
      // v5 displayed messages only as transient status text, so their read state is unknowable.
      // Treat every event already marked as fired as acknowledged to avoid replaying old content.
      acknowledgedMapEventIds: Array.isArray(value.firedMapEventIds)
        ? [...value.firedMapEventIds]
        : [],
      mapEventChoices: []
    };
  } else if (value.saveVersion === VERSION_FOUR_SAVE_VERSION) {
    candidate = {
      ...value,
      saveVersion: SAVE_VERSION,
      firedMapEventIds: [],
      acknowledgedMapEventIds: [],
      mapEventChoices: []
    };
  } else if (value.saveVersion === PREVIOUS_SAVE_VERSION) {
    candidate = {
      ...value,
      saveVersion: SAVE_VERSION,
      campaignUnitBattleRecords: [],
      firedMapEventIds: [],
      acknowledgedMapEventIds: [],
      mapEventChoices: []
    };
  } else if (value.saveVersion === VERSION_TWO_SAVE_VERSION) {
    candidate = {
      ...value,
      saveVersion: SAVE_VERSION,
      reserveUnits: [],
      campaignUnitBattleRecords: [],
      firedMapEventIds: [],
      acknowledgedMapEventIds: [],
      mapEventChoices: []
    };
  } else if (value.saveVersion === LEGACY_SAVE_VERSION) {
    const units = Array.isArray(value.units) ? value.units.map(migrateLegacyUnit) : value.units;
    candidate = {
      ...value,
      saveVersion: SAVE_VERSION,
      rngState: legacyRngState(value),
      units,
      reserveUnits: [],
      campaignUnitBattleRecords: [],
      firedMapEventIds: [],
      acknowledgedMapEventIds: [],
      mapEventChoices: []
    };
  } else {
    return null;
  }
  if (!isValidGameStateSnapshot(candidate, map)) return null;
  return { snapshot: candidate, migrated: true };
}
