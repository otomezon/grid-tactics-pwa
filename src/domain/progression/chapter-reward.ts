export const ALL_SURVIVING_PLAYER_UNITS = "@all-surviving-player-units" as const;

export interface ChapterRewardDefinition {
  /** Stable unit ID, or ALL_SURVIVING_PLAYER_UNITS for every living deployed ally. */
  recipientUnitId: string | typeof ALL_SURVIVING_PLAYER_UNITS;
  /** ID of an item defined in src/content/items.ts. */
  itemId: string;
  /** Number of item copies to add; each copy occupies one inventory slot. */
  quantity: number;
}

export interface ChapterRewardRecord extends ChapterRewardDefinition {
  /** The concrete recipient unit ID after resolving a group reward. */
  recipientUnitId: string;
  recipientName: string;
  itemName: string;
}
