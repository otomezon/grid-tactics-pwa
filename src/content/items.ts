export interface InventoryItemDefinition {
  id: string;
  name: string;
  description: string;
  category: "promotion";
}

/** Prototype promotion token; it is an item ID in the existing inventory array. */
export const PROMOTION_ITEM_ID = "promotion_seal";

export const INVENTORY_ITEMS: readonly InventoryItemDefinition[] = [
  {
    id: PROMOTION_ITEM_ID,
    name: "クラスチェンジの証",
    description: "基本職Lv.10以上の味方が昇格するために使う試作アイテム。",
    category: "promotion"
  }
];

export const INVENTORY_ITEMS_BY_ID: Readonly<Record<string, InventoryItemDefinition>> =
  Object.fromEntries(INVENTORY_ITEMS.map((item) => [item.id, item]));
