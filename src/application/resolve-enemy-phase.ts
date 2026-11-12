import { TERRAIN_DEFINITIONS } from "../content/terrain";
import { createAttackPlanForFaction, performEnemyAttack } from "./perform-attack";
import type { AttackPlan } from "./perform-attack";
import { calculateManhattanDistance } from "../domain/combat/grid-distance";
import { calculateReachableTiles } from "../domain/movement/calculate-reachable-tiles";
import type { GameMapDefinition, GameStateSnapshot, GameUnit, Position } from "../domain/models/game";
import { evaluateBattleOutcome, type BattleOutcome } from "../domain/rules/evaluate-battle-outcome";
import { applyFortRecovery } from "../domain/rules/apply-fort-recovery";
import { getClassTacticalRoles, getTacticalRoleLabel, getTacticalRolePriorityBonus } from "../content/tactical-roles";
import type { TacticalRole } from "../content/tactical-roles";
import type { FortRecoveryRecord } from "../domain/rules/apply-fort-recovery";

export type EnemyActionKind = "attacked" | "moved-and-attacked" | "moved" | "waited";

export type EnemyMovementReason =
  | { kind: "attack-after-move"; targetId: string; targetName: string }
  | { kind: "approach-player"; nearestPlayerDistanceBefore: number; nearestPlayerDistanceAfter: number };

export interface EnemyTargetScoreBreakdown {
  canDefeatTarget: boolean;
  killBonus: number;
  triangleBonus: number;
  lostHp: number;
  lowHpBonus: number;
  expectedDamage: number;
  expectedDamageBonus: number;
  counterExpectedDamage: number;
  counterDamagePenalty: number;
  counterLethalPenalty: number;
  rolePriorityBonus: number;
  totalScore: number;
}

export interface EnemyTargetEvaluation {
  targetId: string;
  targetName: string;
  targetRoles: readonly TacticalRole[];
  scoreBreakdown: EnemyTargetScoreBreakdown;
}

export interface EnemyActionLog {
  enemyId: string;
  enemyName: string;
  kind: EnemyActionKind;
  targetId?: string;
  targetName?: string;
  destination?: Position;
  targetRoles?: readonly TacticalRole[];
  targetRolePriorityBonus?: number;
  targetEvaluations?: readonly EnemyTargetEvaluation[];
  movementReason?: EnemyMovementReason;
  message: string;
}

export interface BeginEnemyPhaseResult {
  nextState: GameStateSnapshot;
  fortRecoveries: FortRecoveryRecord[];
}

export interface EnemyPhaseResult {
  nextState: GameStateSnapshot;
  outcome: BattleOutcome;
  actions: EnemyActionLog[];
  phaseStartRecoveries: FortRecoveryRecord[];
}

interface AttackCandidate {
  target: GameUnit;
  plan: AttackPlan;
  score: number;
  targetRoles: readonly TacticalRole[];
  targetRolePriorityBonus: number;
  scoreBreakdown: EnemyTargetScoreBreakdown;
}

interface TileCandidate {
  position: Position;
  score: number;
  attack?: AttackCandidate;
  movementReason: EnemyMovementReason;
}

const KILL_BONUS = 1000;
const TRIANGLE_BONUS = 40;
const LOW_HP_BONUS_PER_POINT = 0.5;
const EXPECTED_DAMAGE_WEIGHT = 5;
const COUNTER_DAMAGE_PENALTY_WEIGHT = 2;
const COUNTER_LETHAL_PENALTY = 500;

/** Begin the enemy phase after player input is locked and that state is saved. */
export function beginEnemyPhase(
  state: GameStateSnapshot,
  map: GameMapDefinition
): BeginEnemyPhaseResult {
  if (state.phase !== "player") {
    throw new Error("The player phase is not active.");
  }
  if (evaluateBattleOutcome(state, map) !== "playing") {
    throw new Error("The battle has already ended.");
  }

  const recovery = applyFortRecovery({ ...state, phase: "enemy" }, map, "enemy");
  return { nextState: recovery.nextState, fortRecoveries: recovery.recoveries };
}

function getAttackCandidates(
  state: GameStateSnapshot,
  map: GameMapDefinition,
  enemyId: string
): AttackCandidate[] {
  const enemy = state.units.find((unit) => unit.id === enemyId);
  if (!enemy || enemy.faction !== "enemy" || enemy.currentHp <= 0 || enemy.hasActed) return [];

  const targets = state.units
    .filter((unit) => unit.faction === "player" && unit.currentHp > 0)
    .sort((left, right) => compareIds(left.id, right.id));

  const candidates: AttackCandidate[] = [];
  for (const target of targets) {
    try {
      const plan = createAttackPlanForFaction(state, map, enemy.id, target.id, "enemy");
      const targetRoles = getClassTacticalRoles(target.classId);
      const targetRolePriorityBonus = targetRoles.reduce(
        (bonus, role) => bonus + getTacticalRolePriorityBonus(role),
        0
      );
      const scoreBreakdown = scoreAttack(enemy, target, plan, targetRolePriorityBonus);
      candidates.push({ target, plan, score: scoreBreakdown.totalScore, targetRoles, targetRolePriorityBonus, scoreBreakdown });
    } catch {
      // Out-of-range or otherwise invalid targets are not attack candidates.
    }
  }
  return candidates.sort(compareAttackCandidates);
}

function scoreAttack(enemy: GameUnit, target: GameUnit, plan: AttackPlan, rolePriorityBonus: number): EnemyTargetScoreBreakdown {
  const opening = plan.forecast.strikes[0];
  if (!opening) return {
    canDefeatTarget: false, killBonus: 0, triangleBonus: 0,
    lostHp: target.stats.hp - target.currentHp, lowHpBonus: 0,
    expectedDamage: 0, expectedDamageBonus: 0, counterExpectedDamage: 0,
    counterDamagePenalty: 0, counterLethalPenalty: 0, rolePriorityBonus,
    totalScore: Number.NEGATIVE_INFINITY
  };

  const expectedDamage = opening.normalDamage * opening.hitRate / 100;
  const canDefeatTarget = opening.hitRate > 0 && (
    opening.normalDamage >= target.currentHp ||
    (opening.criticalRate > 0 && opening.criticalDamage >= target.currentHp)
  );
  const killBonus = canDefeatTarget ? KILL_BONUS : 0;
  const triangleBonus = opening.weaponTriangleHitModifier > 0 ? TRIANGLE_BONUS : 0;
  const lostHp = target.stats.hp - target.currentHp;
  const lowHpBonus = lostHp * LOW_HP_BONUS_PER_POINT;
  const expectedDamageBonus = expectedDamage * EXPECTED_DAMAGE_WEIGHT;
  const counter = plan.forecast.strikes.find((strike) => strike.kind === "counter");
  const counterExpectedDamage = counter ? counter.normalDamage * counter.hitRate / 100 : 0;
  const counterDamagePenalty = counterExpectedDamage * COUNTER_DAMAGE_PENALTY_WEIGHT;
  const counterLethalPenalty = counter && counter.hitRate > 0 && (
    counter.normalDamage >= enemy.currentHp ||
    (counter.criticalRate > 0 && counter.criticalDamage >= enemy.currentHp)
  ) ? COUNTER_LETHAL_PENALTY : 0;
  const totalScore = killBonus + triangleBonus + lowHpBonus + expectedDamageBonus -
    counterDamagePenalty - counterLethalPenalty + rolePriorityBonus;
  return {
    canDefeatTarget, killBonus, triangleBonus, lostHp, lowHpBonus, expectedDamage,
    expectedDamageBonus, counterExpectedDamage, counterDamagePenalty,
    counterLethalPenalty, rolePriorityBonus, totalScore
  };
}

function toTargetEvaluations(candidates: readonly AttackCandidate[]): EnemyTargetEvaluation[] {
  return candidates.map(({ target, targetRoles, scoreBreakdown }) => ({
    targetId: target.id, targetName: target.name, targetRoles, scoreBreakdown
  }));
}

function formatTargetPriorityReason(candidate: AttackCandidate): string {
  if (candidate.targetRoles.length === 0 || candidate.targetRolePriorityBonus <= 0) return "";
  const labels = candidate.targetRoles.map(getTacticalRoleLabel).join("・");
  return `（${labels}を優先 +${candidate.targetRolePriorityBonus}点）`;
}

function compareAttackCandidates(left: AttackCandidate, right: AttackCandidate): number {
  return right.score - left.score || compareIds(left.target.id, right.target.id);
}

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function getTerrainScore(map: GameMapDefinition, position: Position): number {
  const terrainType = map.terrain[position.y]?.[position.x];
  if (!terrainType) return Number.NEGATIVE_INFINITY;
  const terrain = TERRAIN_DEFINITIONS[terrainType];
  return terrain.defenseBonus * 10 + terrain.avoidanceBonus;
}

function getNearestPlayerDistance(state: GameStateSnapshot, position: Position): number {
  const livingPlayers = state.units.filter(
    (unit) => unit.faction === "player" && unit.currentHp > 0
  );
  if (livingPlayers.length === 0) return Number.POSITIVE_INFINITY;
  return Math.min(
    ...livingPlayers.map((unit) => calculateManhattanDistance(position, unit.position))
  );
}

function createTileCandidates(
  state: GameStateSnapshot,
  map: GameMapDefinition,
  enemy: GameUnit
): TileCandidate[] {
  const reachable = calculateReachableTiles({
    terrain: map.terrain,
    start: enemy.position,
    movementPoints: enemy.move,
    movementType: enemy.movementType,
    occupiedPositions: state.units
      .filter((unit) => unit.id !== enemy.id && unit.currentHp > 0)
      .map((unit) => unit.position)
  });

  const nearestPlayerDistanceBefore = getNearestPlayerDistance(state, enemy.position);

  const candidates: TileCandidate[] = reachable.map((tile): TileCandidate => {
    const movedState: GameStateSnapshot = {
      ...state,
      units: state.units.map((unit) =>
        unit.id === enemy.id
          ? { ...unit, position: { x: tile.x, y: tile.y }, hasMoved: true }
          : unit
      )
    };
    const attack = getAttackCandidates(movedState, map, enemy.id)[0];
    const terrainScore = getTerrainScore(map, tile);
    if (attack) {
      return {
        position: { x: tile.x, y: tile.y },
        attack,
        score: 100_000 + attack.score * 10 + terrainScore,
        movementReason: {
          kind: "attack-after-move",
          targetId: attack.target.id,
          targetName: attack.target.name
        }
      };
    }

    const nearestDistance = getNearestPlayerDistance(state, tile);
    return {
      position: { x: tile.x, y: tile.y },
      score: -nearestDistance * 100 + terrainScore,
      movementReason: {
        kind: "approach-player",
        nearestPlayerDistanceBefore,
        nearestPlayerDistanceAfter: nearestDistance
      }
    };
  });
  return candidates.sort(compareTileCandidates);
}

function formatMovementReason(reason: EnemyMovementReason): string {
  if (reason.kind === "attack-after-move") {
    return `（移動後に攻撃可能な位置を優先：${reason.targetName}）`;
  }
  return `（最寄りの味方との距離 ${reason.nearestPlayerDistanceBefore}→${reason.nearestPlayerDistanceAfter}。同距離候補は地形評価で比較）`;
}

function compareTileCandidates(left: TileCandidate, right: TileCandidate): number {
  return right.score - left.score ||
    left.position.y - right.position.y ||
    left.position.x - right.position.x;
}

function executeEnemyAction(
  state: GameStateSnapshot,
  map: GameMapDefinition,
  enemyId: string
): { state: GameStateSnapshot; action: EnemyActionLog } {
  const currentEnemy = state.units.find((unit) => unit.id === enemyId);
  if (!currentEnemy || currentEnemy.currentHp <= 0) {
    throw new Error("The enemy unit is no longer available.");
  }

  const currentAttackCandidates = getAttackCandidates(state, map, enemyId);
  const currentAttack = currentAttackCandidates[0];
  if (currentAttack) {
    const result = performEnemyAttack(state, map, enemyId, currentAttack.target.id);
    const logs = result.result.events.map((event) =>
      event.hit
        ? `${event.critical ? "必殺" : "命中"}・${event.damage}ダメージ`
        : "攻撃ミス"
    ).join(" / ");
    return {
      state: result.nextState,
      action: {
        enemyId,
        enemyName: currentEnemy.name,
        kind: "attacked",
        targetId: currentAttack.target.id,
        targetName: currentAttack.target.name,
        ...(currentAttack.targetRoles.length > 0 ? {
          targetRoles: currentAttack.targetRoles,
          targetRolePriorityBonus: currentAttack.targetRolePriorityBonus
        } : {}),
        targetEvaluations: toTargetEvaluations(currentAttackCandidates),
        message: `${currentEnemy.name}は${currentAttack.target.name}に攻撃（${logs}）${formatTargetPriorityReason(currentAttack)}`
      }
    };
  }

  if (!currentEnemy.hasMoved) {
    const destination = createTileCandidates(state, map, currentEnemy)[0];
    if (destination) {
      const movedState: GameStateSnapshot = {
        ...state,
        units: state.units.map((unit) =>
          unit.id === enemyId
            ? { ...unit, position: destination.position, hasMoved: true }
            : unit
        )
      };
      const postMoveAttackCandidates = getAttackCandidates(movedState, map, enemyId);
      const postMoveAttack = postMoveAttackCandidates[0];
      if (postMoveAttack) {
        const result = performEnemyAttack(movedState, map, enemyId, postMoveAttack.target.id);
        const logs = result.result.events.map((event) =>
          event.hit
            ? `${event.critical ? "必殺" : "命中"}・${event.damage}ダメージ`
            : "攻撃ミス"
        ).join(" / ");
        return {
          state: result.nextState,
          action: {
            enemyId,
            enemyName: currentEnemy.name,
            kind: "moved-and-attacked",
            targetId: postMoveAttack.target.id,
            targetName: postMoveAttack.target.name,
            destination: destination.position,
            movementReason: destination.movementReason,
            ...(postMoveAttack.targetRoles.length > 0 ? {
              targetRoles: postMoveAttack.targetRoles,
              targetRolePriorityBonus: postMoveAttack.targetRolePriorityBonus
            } : {}),
            targetEvaluations: toTargetEvaluations(postMoveAttackCandidates),
            message: `${currentEnemy.name}は${positionText(destination.position)}へ移動し、${postMoveAttack.target.name}に攻撃（${logs}）${formatMovementReason(destination.movementReason)}${formatTargetPriorityReason(postMoveAttack)}`
          }
        };
      }

      return {
        state: {
          ...movedState,
          units: movedState.units.map((unit) =>
            unit.id === enemyId ? { ...unit, hasActed: true } : unit
          )
        },
        action: {
          enemyId,
          enemyName: currentEnemy.name,
          kind: "moved",
          destination: destination.position,
          movementReason: destination.movementReason,
          message: `${currentEnemy.name}は${positionText(destination.position)}へ移動${formatMovementReason(destination.movementReason)}`
        }
      };
    }
  }

  return {
    state: {
      ...state,
      units: state.units.map((unit) =>
        unit.id === enemyId ? { ...unit, hasActed: true } : unit
      )
    },
    action: {
      enemyId,
      enemyName: currentEnemy.name,
      kind: "waited",
      message: `${currentEnemy.name}は待機`
    }
  };
}

function positionText(position: Position): string {
  return `${position.x + 1}列${position.y + 1}行`;
}

/**
 * Resolves enemy units in lexical ID order. Candidate scoring is a deliberately
 * simple, deterministic interpretation of the initial AI design proposal.
 */
export function runEnemyPhase(
  state: GameStateSnapshot,
  map: GameMapDefinition
): EnemyPhaseResult {
  if (state.phase !== "enemy") {
    throw new Error("The enemy phase is not active.");
  }

  let currentState = state;
  const actions: EnemyActionLog[] = [];
  let outcome = evaluateBattleOutcome(currentState, map);
  let phaseStartRecoveries: FortRecoveryRecord[] = [];
  if (outcome !== "playing") {
    return { nextState: currentState, outcome, actions, phaseStartRecoveries };
  }

  const enemyIds = currentState.units
    .filter((unit) => unit.faction === "enemy" && unit.currentHp > 0 && !unit.hasActed)
    .map((unit) => unit.id)
    .sort(compareIds);

  for (const enemyId of enemyIds) {
    if (evaluateBattleOutcome(currentState, map) !== "playing") break;
    const enemy = currentState.units.find((unit) => unit.id === enemyId);
    if (!enemy) continue;

    const execution = executeEnemyAction(currentState, map, enemyId);
    currentState = execution.state;
    actions.push(execution.action);
    outcome = evaluateBattleOutcome(currentState, map);
    if (outcome !== "playing") break;
  }

  outcome = evaluateBattleOutcome(currentState, map);
  if (outcome === "playing") {
    const playerPhaseState: GameStateSnapshot = {
      ...currentState,
      phase: "player",
      turn: currentState.turn + 1,
      units: currentState.units.map((unit) => ({
        ...unit,
        hasMoved: false,
        hasActed: false
      }))
    };
    const recovery = applyFortRecovery(playerPhaseState, map, "player");
    currentState = recovery.nextState;
    phaseStartRecoveries = recovery.recoveries;
  }

  return {
    nextState: currentState,
    outcome,
    actions,
    phaseStartRecoveries
  };
}
