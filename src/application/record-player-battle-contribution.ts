import type { CombatResult } from "../domain/combat/types";
import type { CampaignUnitBattleRecord, GameStateSnapshot, GameUnit, UnitStats } from "../domain/models/game";
import type { LevelUpRecord } from "../domain/progression/level-up";

export interface PlayerBattleRecordInput {
  attacker: Pick<GameUnit, "id" | "name">;
  defenderId: string;
  defenderDefeated: boolean;
  result: CombatResult;
  experienceAwarded: number;
  levelUps: readonly LevelUpRecord[];
}

const STAT_KEYS: readonly (keyof UnitStats)[] = [
  "hp", "strength", "magic", "skill", "speed", "luck", "defense", "resistance"
];

function createEmptyRecord(attacker: PlayerBattleRecordInput["attacker"]): CampaignUnitBattleRecord {
  return {
    unitId: attacker.id,
    unitName: attacker.name,
    attacks: 0,
    strikes: 0,
    hits: 0,
    misses: 0,
    criticalHits: 0,
    damageDealt: 0,
    enemiesDefeated: 0,
    experienceAwarded: 0,
    levelUps: 0,
    statGains: {
      hp: 0, strength: 0, magic: 0, skill: 0,
      speed: 0, luck: 0, defense: 0, resistance: 0
    }
  };
}

/**
 * Adds one resolved player-initiated attack to the campaign ledger.
 * Only strikes whose actor is the initiating player are counted; enemy counters are excluded.
 */
export function recordPlayerBattleContribution(
  state: GameStateSnapshot,
  input: PlayerBattleRecordInput
): GameStateSnapshot {
  const previous = state.campaignUnitBattleRecords.find((record) => record.unitId === input.attacker.id)
    ?? createEmptyRecord(input.attacker);
  const playerStrikes = input.result.events.filter((event) =>
    event.attackerId === input.attacker.id && event.defenderId === input.defenderId
  );
  const hits = playerStrikes.filter((event) => event.hit);
  const statGains = { ...previous.statGains };

  for (const levelUp of input.levelUps) {
    for (const key of STAT_KEYS) statGains[key] += levelUp.gains[key] ?? 0;
  }

  const nextRecord: CampaignUnitBattleRecord = {
    ...previous,
    unitName: input.attacker.name,
    attacks: previous.attacks + 1,
    strikes: previous.strikes + playerStrikes.length,
    hits: previous.hits + hits.length,
    misses: previous.misses + playerStrikes.filter((event) => !event.hit).length,
    criticalHits: previous.criticalHits + hits.filter((event) => event.critical).length,
    damageDealt: previous.damageDealt + hits.reduce((total, event) => total + event.damage, 0),
    enemiesDefeated: previous.enemiesDefeated + (input.defenderDefeated ? 1 : 0),
    experienceAwarded: previous.experienceAwarded + input.experienceAwarded,
    levelUps: previous.levelUps + input.levelUps.length,
    statGains
  };

  const hasPrevious = state.campaignUnitBattleRecords.some((record) => record.unitId === input.attacker.id);
  return {
    ...state,
    campaignUnitBattleRecords: hasPrevious
      ? state.campaignUnitBattleRecords.map((record) => record.unitId === input.attacker.id ? nextRecord : record)
      : [...state.campaignUnitBattleRecords, nextRecord]
  };
}
