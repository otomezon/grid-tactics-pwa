import type { TerrainDefinition, TerrainType } from "../domain/models/game";

export const TERRAIN_DEFINITIONS: Record<TerrainType, TerrainDefinition> = {
  plain: {
    label: "平地",
    symbol: "・",
    movementCost: { infantry: 1, cavalry: 1 },
    defenseBonus: 0,
    avoidanceBonus: 0
  },
  road: {
    label: "道",
    symbol: "道",
    movementCost: { infantry: 1, cavalry: 1 },
    defenseBonus: 0,
    avoidanceBonus: 0
  },
  forest: {
    label: "森",
    symbol: "森",
    movementCost: { infantry: 2, cavalry: 3 },
    defenseBonus: 1,
    avoidanceBonus: 20
  },
  mountain: {
    label: "山",
    symbol: "山",
    movementCost: { infantry: 2, cavalry: null },
    defenseBonus: 1,
    avoidanceBonus: 20
  },
  fort: {
    label: "砦",
    symbol: "砦",
    movementCost: { infantry: 1, cavalry: 1 },
    defenseBonus: 2,
    avoidanceBonus: 20
  },
  wall: {
    label: "壁",
    symbol: "壁",
    movementCost: { infantry: null, cavalry: null },
    defenseBonus: 0,
    avoidanceBonus: 0
  },
  water: {
    label: "水",
    symbol: "水",
    movementCost: { infantry: null, cavalry: null },
    defenseBonus: 0,
    avoidanceBonus: 0
  }
};
