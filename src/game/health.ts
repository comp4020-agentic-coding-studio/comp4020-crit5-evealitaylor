import type { HitKind } from "./types.ts";

/**
 * The suit takes damage rather than ending the run outright.
 *
 * This replaced instant death after a play session: hits happened often and
 * none of them killed, so the run never resolved. A pool fixes both halves at
 * once — every hit now costs something visible, and enough of them end the run.
 *
 * Six units, because it has to divide cleanly into the three colours the ring
 * shows and still let a dead-on hit cost meaningfully more than a clip:
 *
 *   6 5  green    fine
 *   4 3  amber    two dead-on hits from full, and you are here
 *   2 1  red      one more dead-on hit ends it
 *   0    gone
 */
export const HEALTH_MAX = 6;

/** A dead-on hit costs half the bar. Two of them from full, and the run ends. */
export const FATAL_DAMAGE = 3;

/** A corner clip costs one. Six of those also end the run — slowly. */
export const GRAZE_DAMAGE = 1;

export type HealthBand = "ok" | "hurt" | "critical";

/** Above this the ring is green; above the next one, amber; below, red. */
const OK_ABOVE = 4;
const HURT_ABOVE = 2;

export function healthBand(health: number): HealthBand {
  if (health > OK_ABOVE) return "ok";
  if (health > HURT_ABOVE) return "hurt";
  return "critical";
}

export function damageFor(hit: HitKind): number {
  if (hit === "fatal") return FATAL_DAMAGE;
  if (hit === "graze") return GRAZE_DAMAGE;
  return 0;
}

/** Never below zero, so the ring can't draw a negative arc. */
export function applyDamage(health: number, hit: HitKind): number {
  return Math.max(0, health - damageFor(hit));
}

export function isSpent(health: number): boolean {
  return health <= 0;
}

/** 0..1, for drawing. */
export function healthFraction(health: number): number {
  return Math.max(0, Math.min(1, health / HEALTH_MAX));
}
