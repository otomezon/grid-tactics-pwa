import { describe, expect, it } from "vitest";
import { HEALING_POTION_ID, INVENTORY_ITEMS_BY_ID, PROMOTION_ITEM_ID } from "../content/items";
import { getInventoryItemStacks } from "./get-inventory-item-stacks";

describe("getInventoryItemStacks", () => {
  it("groups duplicate IDs while preserving first-seen order", () => {
    const stacks = getInventoryItemStacks([
      HEALING_POTION_ID,
      PROMOTION_ITEM_ID,
      HEALING_POTION_ID,
      "unknown_item",
      PROMOTION_ITEM_ID,
      HEALING_POTION_ID
    ]);

    expect(stacks).toEqual([
      {
        id: HEALING_POTION_ID,
        quantity: 3,
        definition: INVENTORY_ITEMS_BY_ID[HEALING_POTION_ID]
      },
      {
        id: PROMOTION_ITEM_ID,
        quantity: 2,
        definition: INVENTORY_ITEMS_BY_ID[PROMOTION_ITEM_ID]
      },
      {
        id: "unknown_item",
        quantity: 1,
        definition: undefined
      }
    ]);
  });

  it("returns an empty list for an empty inventory", () => {
    expect(getInventoryItemStacks([])).toEqual([]);
  });
});
