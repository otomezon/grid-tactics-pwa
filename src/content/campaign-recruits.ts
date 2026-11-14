import type { CampaignUnit } from "../domain/models/game";
import { INITIAL_GAME_STATE } from "./maps/chapter-01";

// Prototype recruit content reuses the current archer fixture's provisional class,
// stats, growths, movement, and weapon setup rather than introducing new balance data.
const archerTemplate = INITIAL_GAME_STATE.units.find((unit) => unit.id === "unit_002");
if (!archerTemplate) throw new Error("The prototype archer template is unavailable.");

const {
  faction: _faction,
  position: _position,
  hasMoved: _hasMoved,
  hasActed: _hasActed,
  ...archerCampaignData
} = archerTemplate;

/** Optional Chapter 3 recruit. The existing archer fixture values remain provisional. */
export const CHAPTER_02_SCOUT_RECRUIT: CampaignUnit = {
  ...archerCampaignData,
  id: "recruit_scout",
  name: "斥候ミナ",
  stats: { ...archerCampaignData.stats },
  growthRates: { ...archerCampaignData.growthRates },
  usableWeaponTypes: [...archerCampaignData.usableWeaponTypes],
  inventory: [...archerCampaignData.inventory]
};
