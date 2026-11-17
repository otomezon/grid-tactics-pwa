export type InventoryItemEffect =
  | { type: "heal"; amount: number };

export interface InventoryItemDefinition {
  id: string;
  name: string;
  description: string;
  category: "promotion" | "consumable";
  effect?: InventoryItemEffect;
}

export const PROMOTION_ITEM_ID = "promotion_seal";
export const HEALING_POTION_ID = "healing_potion";
export const HEALING_POTION_AMOUNT = 10;

export const INVENTORY_ITEMS: readonly InventoryItemDefinition[] = [
  {
    id: PROMOTION_ITEM_ID,
    name: "クラスチェンジの証",
    description: "基本職Lv.10以上の味方を一段階昇格させる。昇格時に1個消費する。",
    category: "promotion"
  },
  {
    id: HEALING_POTION_ID,
    name: "回復薬",
    description: "使用者自身のHPを回復する消費アイテム。回復量10は試作値で、正式なバランスではありません。",
    category: "consumable",
    effect: { type: "heal", amount: HEALING_POTION_AMOUNT }
  }
];

export const INVENTORY_ITEMS_BY_ID: Readonly<Record<string, InventoryItemDefinition>> =
  Object.fromEntries(INVENTORY_ITEMS.map((item) => [item.id, item]));
