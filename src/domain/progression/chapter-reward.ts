export interface ChapterRewardDefinition {
  /** Stable ID of a living player unit that receives the reward. */
  recipientUnitId: string;
  /** ID of an item defined in src/content/items.ts. */
  itemId: string;
  /** Number of item copies to add; each copy occupies one inventory slot. */
  quantity: number;
}

export interface ChapterRewardRecord extends ChapterRewardDefinition {
  recipientName: string;
  itemName: string;
}
