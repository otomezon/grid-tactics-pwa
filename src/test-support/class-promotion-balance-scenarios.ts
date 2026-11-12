/**
 * Deterministic synthetic fixtures for promotion-balance regression tests.
 *
 * These are NOT playtest results or class-specific growth distributions.
 * Chapter 1 currently gives every prototype unit the same starting stats and
 * growth rates. The fixtures sample 1,024 deterministic Xorshift32 seeds using
 * the existing chapter-1 unit template, simulate nine level-ups (Lv. 1 to 10),
 * and choose the 10th / 50th / 90th percentile by total stat gains.
 *
 * Keep this module in test-support only. Do not import it into the game UI or
 * use its output to approve numeric class balance.
 */
import type { UnitStats } from "../domain/models/game";
import { applyExperience } from "../domain/progression/level-up";
import { getClassPromotionStatPreview } from "../domain/progression/class-change";
import {
  CLASS_PROMOTION_DEFINITIONS,
  CLASS_PROMOTION_TARGETS,
  PROTOTYPE_CLASS_STAT_CAPS
} from "../content/classes";
import { INITIAL_GAME_STATE } from "../content/maps/chapter-01";

const GROWTH_SEED_SAMPLE_SIZE = 1024;
const EXPERIENCE_TO_REACH_LEVEL_10 = 900;
const STAT_KEYS: readonly (keyof UnitStats)[] = [
  "hp",
  "strength",
  "magic",
  "skill",
  "speed",
  "luck",
  "defense",
  "resistance"
];

export type PrototypeGrowthProfileId = "low" | "median" | "high";

export interface PrototypeGrowthProfile {
  id: PrototypeGrowthProfileId;
  percentile: number;
  seed: number;
  level: 10;
  experience: 0;
  totalStatGains: number;
  stats: UnitStats;
  rngStateAfterGrowth: number;
}

export interface PrototypePromotionScenario {
  id: string;
  profileId: PrototypeGrowthProfileId;
  sourceClassId: string;
  targetClassId: string;
  startingStats: UnitStats;
  previewStats: UnitStats;
  requestedBonuses: Partial<UnitStats>;
  appliedBonuses: Partial<UnitStats>;
  changes: ReturnType<typeof getClassPromotionStatPreview>["changes"];
}

function cloneStats(stats: UnitStats): UnitStats {
  return { ...stats };
}

function countGains(before: UnitStats, after: UnitStats): number {
  return STAT_KEYS.reduce((total, key) => total + after[key] - before[key], 0);
}

function buildGrowthCandidates(): Array<{
  seed: number;
  totalStatGains: number;
  stats: UnitStats;
  rngStateAfterGrowth: number;
}> {
  const template = INITIAL_GAME_STATE.units.find((unit) => unit.id === "unit_001");
  if (!template) {
    throw new Error("Chapter 1 prototype growth template unit_001 is missing.");
  }

  const caps = PROTOTYPE_CLASS_STAT_CAPS[template.classId];
  if (!caps) {
    throw new Error("Prototype stat caps are missing for " + template.classId + ".");
  }

  return Array.from({ length: GROWTH_SEED_SAMPLE_SIZE }, (_, index) => {
    const seed = index + 1;
    const result = applyExperience(
      template,
      EXPERIENCE_TO_REACH_LEVEL_10,
      seed,
      caps
    );

    return {
      seed,
      totalStatGains: countGains(template.stats, result.unit.stats),
      stats: cloneStats(result.unit.stats),
      rngStateAfterGrowth: result.rngState
    };
  });
}

function selectProfile(
  candidates: ReturnType<typeof buildGrowthCandidates>,
  id: PrototypeGrowthProfileId,
  percentile: number
): PrototypeGrowthProfile {
  const sorted = [...candidates].sort((left, right) =>
    left.totalStatGains - right.totalStatGains || left.seed - right.seed
  );
  const index = Math.round((percentile / 100) * (sorted.length - 1));
  const selected = sorted[index];

  if (!selected) {
    throw new Error("Unable to select a synthetic growth profile.");
  }

  return {
    id,
    percentile,
    seed: selected.seed,
    level: 10,
    experience: 0,
    totalStatGains: selected.totalStatGains,
    stats: cloneStats(selected.stats),
    rngStateAfterGrowth: selected.rngStateAfterGrowth
  };
}

const growthCandidates = buildGrowthCandidates();

/**
 * Low / median / high are percentiles within this synthetic seed sweep only.
 * "High" does not mean near the approved (or still undecided) class cap.
 */
export const PROTOTYPE_GROWTH_PROFILES: readonly PrototypeGrowthProfile[] = [
  selectProfile(growthCandidates, "low", 10),
  selectProfile(growthCandidates, "median", 50),
  selectProfile(growthCandidates, "high", 90)
];

/**
 * Seven current provisional promotion definitions multiplied by three
 * synthetic profiles. The preview uses the same pure calculation helper as
 * the promotion command, but the placeholder content remains unapproved.
 */
export const PROTOTYPE_PROMOTION_SCENARIOS: readonly PrototypePromotionScenario[] =
  Object.entries(CLASS_PROMOTION_TARGETS).flatMap(([sourceClassId, targetClassId]) => {
    const definition = CLASS_PROMOTION_DEFINITIONS[sourceClassId];
    if (!definition || definition.toClassId !== targetClassId) {
      throw new Error("Promotion definition is missing or inconsistent for " + sourceClassId + ".");
    }

    return PROTOTYPE_GROWTH_PROFILES.map((profile) => {
      const startingStats = cloneStats(profile.stats);
      const preview = getClassPromotionStatPreview(startingStats, definition);

      return {
        id: sourceClassId + "-" + profile.id,
        profileId: profile.id,
        sourceClassId,
        targetClassId,
        startingStats,
        previewStats: cloneStats(preview.stats),
        requestedBonuses: { ...definition.statBonuses },
        appliedBonuses: { ...preview.appliedBonuses },
        changes: preview.changes
      };
    });
  });
