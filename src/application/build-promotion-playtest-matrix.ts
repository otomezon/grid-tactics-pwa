import { CLASS_PROMOTION_TARGETS } from "../content/classes";
import type { GameUnit, UnitStats } from "../domain/models/game";

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

export type PromotionPlaytestProfile = "low" | "median" | "upper";

export const PROMOTION_PLAYTEST_PROFILES: readonly {
  id: PromotionPlaytestProfile;
  label: string;
  targetPercentile: number;
}[] = [
  { id: "low", label: "低位（下位25%目安）", targetPercentile: 25 },
  { id: "median", label: "中央値（50%目安）", targetPercentile: 50 },
  { id: "upper", label: "上位（90%目安）", targetPercentile: 90 }
];

export interface PromotionPlaytestCandidateLike {
  key: string;
  unit: Pick<GameUnit, "classId" | "stats">;
}

export interface PromotionPlaytestMatrixSlot<T extends PromotionPlaytestCandidateLike> {
  id: string;
  classId: keyof typeof CLASS_PROMOTION_TARGETS;
  promotedClassId: string;
  profile: PromotionPlaytestProfile;
  profileLabel: string;
  targetPercentile: number;
  candidateCount: number;
  candidatePool: readonly T[];
  suggestedCandidate: T | null;
  suggestedPercentile: number | null;
}

/**
 * An average of the eight per-stat mid-ranks within one basic class.
 * This is a selection aid only: it is not a growth-rate measurement, a
 * near-cap test, or a statistical confidence estimate.
 */
export function getAverageClassStatPercentile<T extends PromotionPlaytestCandidateLike>(
  candidate: T,
  classCandidates: readonly T[]
): number | null {
  if (classCandidates.length < 3) return null;

  const average = STAT_KEYS.reduce((total, key) => {
    const values = classCandidates.map((entry) => entry.unit.stats[key]);
    const lower = values.filter((value) => value < candidate.unit.stats[key]).length;
    const equal = values.filter((value) => value === candidate.unit.stats[key]).length;
    const midRank = (lower + (equal - 1) / 2) / Math.max(1, values.length - 1);
    return total + midRank * 100;
  }, 0) / STAT_KEYS.length;

  return Math.round(average);
}

export function buildPromotionPlaytestMatrix<T extends PromotionPlaytestCandidateLike>(
  candidates: readonly T[]
): PromotionPlaytestMatrixSlot<T>[] {
  return (Object.keys(CLASS_PROMOTION_TARGETS) as Array<keyof typeof CLASS_PROMOTION_TARGETS>)
    .flatMap((classId) => {
      const promotedClassId = CLASS_PROMOTION_TARGETS[classId];
      if (!promotedClassId) return [];

      const classCandidates = candidates.filter((candidate) => candidate.unit.classId === classId);
      const ranked = classCandidates
        .map((candidate) => ({
          candidate,
          percentile: getAverageClassStatPercentile(candidate, classCandidates)
        }))
        .filter((entry): entry is { candidate: T; percentile: number } => entry.percentile !== null)
        .sort((left, right) =>
          left.percentile - right.percentile ||
          left.candidate.key.localeCompare(right.candidate.key)
        );
      const used = new Set<string>();

      return PROMOTION_PLAYTEST_PROFILES.map((profile) => {
        let suggestedCandidate: T | null = null;
        let suggestedPercentile: number | null = null;

        if (ranked.length >= 3) {
          const available = ranked
            .filter((entry) => !used.has(entry.candidate.key))
            .sort((left, right) =>
              Math.abs(left.percentile - profile.targetPercentile) -
                Math.abs(right.percentile - profile.targetPercentile) ||
              left.percentile - right.percentile ||
              left.candidate.key.localeCompare(right.candidate.key)
            );
          const selected = available[0];
          if (selected) {
            suggestedCandidate = selected.candidate;
            suggestedPercentile = selected.percentile;
            used.add(selected.candidate.key);
          }
        }

        return {
          id: classId + ":" + profile.id,
          classId,
          promotedClassId,
          profile: profile.id,
          profileLabel: profile.label,
          targetPercentile: profile.targetPercentile,
          candidateCount: classCandidates.length,
          candidatePool: classCandidates,
          suggestedCandidate,
          suggestedPercentile
        };
      });
    });
}
