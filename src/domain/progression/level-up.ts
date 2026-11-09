import type { GameUnit, UnitStats } from "../models/game";
import { nextRandomUint32 } from "../random/xorshift32";

const EXPERIENCE_PER_LEVEL = 100;
const UINT32_RANGE = 0x1_0000_0000;
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

export interface LevelUpRecord {
  previousLevel: number;
  newLevel: number;
  gains: Partial<Record<keyof UnitStats, number>>;
}

export interface ExperienceApplication {
  unit: GameUnit;
  awardedExperience: number;
  rngState: number;
  levelUps: LevelUpRecord[];
}

/**
 * Adds experience and performs independent growth checks while EXP >= 100.
 * One Xorshift32 draw is consumed per stat per level-up, including capped stats.
 * Maximum HP can grow; current HP is intentionally preserved (no free healing).
 */
export function applyExperience(
  unit: GameUnit,
  awardedExperience: number,
  initialRngState: number,
  statCaps: UnitStats
): ExperienceApplication {
  if (!Number.isInteger(awardedExperience) || awardedExperience < 0) {
    throw new RangeError("Awarded experience must be a non-negative integer.");
  }

  if (
    !Number.isInteger(unit.experience) ||
    unit.experience < 0 ||
    unit.experience >= EXPERIENCE_PER_LEVEL
  ) {
    throw new RangeError("Unit experience must be between 0 and 99.");
  }

  if (awardedExperience === 0) {
    return {
      unit,
      awardedExperience,
      rngState: initialRngState,
      levelUps: []
    };
  }

  let experience = unit.experience + awardedExperience;
  let level = unit.level;
  let rngState = initialRngState;
  const stats: UnitStats = { ...unit.stats };
  const levelUps: LevelUpRecord[] = [];

  while (experience >= EXPERIENCE_PER_LEVEL) {
    experience -= EXPERIENCE_PER_LEVEL;
    const previousLevel = level;
    level += 1;
    const gains: Partial<Record<keyof UnitStats, number>> = {};

    for (const key of STAT_KEYS) {
      const step = nextRandomUint32(rngState);
      rngState = step.state;
      const roll = Math.floor((step.value / UINT32_RANGE) * 100);
      const growthRate = unit.growthRates[key];

      if (roll < growthRate && stats[key] < statCaps[key]) {
        stats[key] += 1;
        gains[key] = 1;
      }
    }

    levelUps.push({
      previousLevel,
      newLevel: level,
      gains
    });
  }

  return {
    unit: {
      ...unit,
      level,
      experience,
      stats
    },
    awardedExperience,
    rngState,
    levelUps
  };
}
