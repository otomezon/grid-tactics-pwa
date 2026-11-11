import { INVENTORY_ITEMS_BY_ID, type InventoryItemDefinition } from "../content/items";

export interface InventoryItemStack {
  id: string;
  quantity: number;
  definition: InventoryItemDefinition | undefined;
}

/**
 * Groups identical item IDs without changing inventory order or the underlying
 * save representation. Unknown IDs remain visible and are grouped as well.
 */
export function getInventoryItemStacks(itemIds: readonly string[]): InventoryItemStack[] {
  const quantities = new Map<string, number>();

  for (const itemId of itemIds) {
    quantities.set(itemId, (quantities.get(itemId) ?? 0) + 1);
  }

  return Array.from(quantities, ([id, quantity]) => ({
    id,
    quantity,
    definition: INVENTORY_ITEMS_BY_ID[id]
  }));
}
