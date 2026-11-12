import type { StrikeRoll } from "../combat/types";

const UINT32_RANGE = 0x1_0000_0000;
const FALLBACK_SEED = 0x6d2b79f5;

export interface RandomStep {
  value: number;
  state: number;
}

export interface CombatRollSequence {
  rolls: StrikeRoll[];
  /** RNG state after each pair of hit/critical rolls. Index 0 is the first strike. */
  statesAfterEachStrike: number[];
}

/** Generates a non-zero seed once when a new local game is first created. */
export function createRandomSeed(): number {
  try {
    const cryptoApi = globalThis.crypto;
    if (cryptoApi && typeof cryptoApi.getRandomValues === "function") {
      const values = new Uint32Array(1);
      cryptoApi.getRandomValues(values);
      return values[0] === 0 ? FALLBACK_SEED : values[0]!;
    }
  } catch {
    // Keep the prototype playable in restricted browser contexts.
  }
  return FALLBACK_SEED;
}

/** Advances one Xorshift32 step. Zero is excluded because it is an absorbing state. */
export function nextRandomUint32(state: number): RandomStep {
  if (!Number.isInteger(state) || state <= 0 || state > 0xffffffff) {
    throw new RangeError("RNG state must be a non-zero unsigned 32-bit integer.");
  }

  let value = state >>> 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;

  const nextState = value >>> 0;
  if (nextState === 0) {
    throw new Error("Xorshift32 unexpectedly produced its zero state.");
  }

  return { value: nextState, state: nextState };
}

/** Creates deterministic hit/critical rolls for the maximum forecast strike count. */
export function createCombatRollSequence(
  initialState: number,
  strikeCount: number
): CombatRollSequence {
  if (!Number.isInteger(strikeCount) || strikeCount < 0) {
    throw new RangeError("Strike count must be a non-negative integer.");
  }

  let state = initialState;
  const rolls: StrikeRoll[] = [];
  const statesAfterEachStrike: number[] = [];

  for (let index = 0; index < strikeCount; index += 1) {
    const hitStep = nextRandomUint32(state);
    const criticalStep = nextRandomUint32(hitStep.state);
    state = criticalStep.state;

    rolls.push({
      hitRoll: Math.floor((hitStep.value / UINT32_RANGE) * 100),
      criticalRoll: Math.floor((criticalStep.value / UINT32_RANGE) * 100)
    });
    statesAfterEachStrike.push(state);
  }

  return { rolls, statesAfterEachStrike };
}
