import { INVENTORY_ITEMS_BY_ID } from "../content/items";
import { WEAPONS_BY_ID } from "../content/weapons";
import { canUnitUseWeapon } from "../domain/combat/combat";
import type { CampaignUnit } from "../domain/models/game";

type DeploymentInventorySource = Pick<CampaignUnit, "classId" | "usableWeaponTypes" | "inventory" | "equippedWeaponId">;

/**
 * Resolve the inventory shown in the deployment candidate's read-only detail panel.
 * Unknown item IDs are preserved by ID so malformed or future content is not hidden.
 */
export function getDeploymentUnitDetails(unit: DeploymentInventorySource) {
  const weapons = unit.inventory.flatMap((itemId, inventoryIndex) => {
    const weapon = WEAPONS_BY_ID[itemId];
    return weapon
      ? [{ ...weapon, inventoryIndex, isEquipped: unit.equippedWeaponId === weapon.id, isUsable: canUnitUseWeapon(unit, weapon) }]
      : [];
  });

  const items = unit.inventory.flatMap((itemId, inventoryIndex) => {
    if (WEAPONS_BY_ID[itemId]) return [];
    const definition = INVENTORY_ITEMS_BY_ID[itemId];
    return [{
      id: itemId,
      inventoryIndex,
      name: definition?.name ?? itemId,
      description: definition?.description ?? null
    }];
  });

  const equippedWeapon = unit.equippedWeaponId
    ? WEAPONS_BY_ID[unit.equippedWeaponId] ?? null
    : null;

  return { weapons, items, equippedWeapon };
}
