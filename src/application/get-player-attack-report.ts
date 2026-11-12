import { WEAPONS_BY_ID } from "../content/weapons";
import type { CombatStrikeKind } from "../domain/combat/types";
import type { AttackExecution } from "./perform-attack";

const STRIKE_KIND_LABELS: Record<CombatStrikeKind, string> = {
  initial: "先制攻撃",
  counter: "反撃",
  "follow-up": "追撃"
};

export interface PlayerAttackStrikeReport {
  actorId: string;
  targetId: string;
  kind: CombatStrikeKind;
  kindLabel: string;
  actorName: string;
  targetName: string;
  weaponName: string;
  outcome: "miss" | "hit" | "critical";
  damage: number;
  targetHpBefore: number;
  targetHpAfter: number;
  hitRate: number;
  criticalRate: number;
}

export interface PlayerAttackReport {
  attackerId: string;
  defenderId: string;
  attackerName: string;
  defenderName: string;
  defenderDefeated: boolean;
  defenderRemainingHp: number;
  experienceAwarded: number;
  levelUps: AttackExecution["levelUps"];
  strikes: PlayerAttackStrikeReport[];
}

/** Projects actual combat events for transient UI display; does not recalculate combat. */
export function getPlayerAttackReport(execution: AttackExecution): PlayerAttackReport {
  const namesById = new Map<string, string>([
    [execution.plan.input.attacker.unit.id, execution.plan.input.attacker.unit.name],
    [execution.plan.input.defender.unit.id, execution.plan.input.defender.unit.name]
  ]);

  return {
    attackerId: execution.plan.input.attacker.unit.id,
    defenderId: execution.plan.input.defender.unit.id,
    attackerName: execution.plan.input.attacker.unit.name,
    defenderName: execution.plan.input.defender.unit.name,
    defenderDefeated: execution.result.defenderHp <= 0,
    defenderRemainingHp: execution.result.defenderHp,
    experienceAwarded: execution.experienceAwarded,
    levelUps: execution.levelUps,
    strikes: execution.result.events.map((event) => ({
      actorId: event.attackerId,
      targetId: event.defenderId,
      kind: event.kind,
      kindLabel: STRIKE_KIND_LABELS[event.kind],
      actorName: namesById.get(event.attackerId) ?? event.attackerId,
      targetName: namesById.get(event.defenderId) ?? event.defenderId,
      weaponName: WEAPONS_BY_ID[event.weaponId]?.name ?? event.weaponId,
      outcome: !event.hit ? "miss" : event.critical ? "critical" : "hit",
      damage: event.damage,
      targetHpBefore: event.defenderHpBefore,
      targetHpAfter: event.defenderHpAfter,
      hitRate: event.hitRate,
      criticalRate: event.criticalRate
    }))
  };
}
