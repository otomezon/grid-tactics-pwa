import type { WeaponType } from "../domain/models/game";
import type { WeaponDefinition } from "../domain/combat/types";

/**
 * Playable prototype weapons only.
 *
 * iron_sword mirrors the illustrative weapon example in docs/game-design.md
 * §12.2. The other category entries reuse provisional sample values so the
 * combat prototype can be exercised; none of these values is approved balance.
 */
export const PROTOTYPE_WEAPONS: readonly WeaponDefinition[] = [
  {
    id: "iron_sword",
    name: "試作の鉄の剣",
    description: "操作確認用の仮武器。能力値は調整前。",
    weaponType: "sword",
    power: 5,
    hit: 90,
    critical: 0,
    minRange: 1,
    maxRange: 1,
    damageType: "physical"
  },
  {
    id: "iron_lance",
    name: "試作の鉄の槍",
    description: "操作確認用の仮武器。能力値は調整前。",
    weaponType: "lance",
    power: 5,
    hit: 90,
    critical: 0,
    minRange: 1,
    maxRange: 1,
    damageType: "physical"
  },
  {
    id: "iron_axe",
    name: "試作の鉄の斧",
    description: "操作確認用の仮武器。能力値は調整前。",
    weaponType: "axe",
    power: 5,
    hit: 90,
    critical: 0,
    minRange: 1,
    maxRange: 1,
    damageType: "physical"
  },
  {
    id: "short_bow",
    name: "試作の弓",
    description: "操作確認用の仮武器。射程2の試作品。",
    weaponType: "bow",
    power: 5,
    hit: 90,
    critical: 0,
    minRange: 2,
    maxRange: 2,
    damageType: "physical"
  },
  {
    id: "fire_tome",
    name: "試作の魔道書",
    description: "操作確認用の仮武器。能力値は調整前。",
    weaponType: "magic",
    power: 5,
    hit: 90,
    critical: 0,
    minRange: 1,
    maxRange: 2,
    damageType: "magical"
  }
];

export const WEAPON_ID_BY_TYPE: Record<WeaponType, string> = {
  sword: "iron_sword",
  lance: "iron_lance",
  axe: "iron_axe",
  bow: "short_bow",
  magic: "fire_tome"
};

export const WEAPONS_BY_ID: Readonly<Record<string, WeaponDefinition>> =
  Object.fromEntries(PROTOTYPE_WEAPONS.map((weapon) => [weapon.id, weapon]));
