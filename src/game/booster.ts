/** How long the jet boots actually burn. Long enough to cross a gap. */
export const BOOST_DURATION = 0.45;

/** And how long you wait for them afterwards. Long enough to regret it. */
export const BOOST_COOLDOWN = 9;

/**
 * One number: seconds until the boots are usable again. Above BOOST_COOLDOWN
 * the burn itself is still running, below it the tanks are refilling, and zero
 * means ready. Keeping it as a single countdown means there is no way to reach
 * a state where "firing" and "ready" disagree.
 */
export interface Booster {
  remaining: number;
}

export function createBooster(): Booster {
  return { remaining: 0 };
}

export function isBoosterReady(booster: Booster): boolean {
  return booster.remaining <= 0;
}

/** True while the burn is live — the fast, loud, brief part. */
export function isBoosting(booster: Booster): boolean {
  return booster.remaining > BOOST_COOLDOWN;
}

export function tickBooster(booster: Booster, dt: number): Booster {
  return { remaining: Math.max(0, booster.remaining - dt) };
}

/**
 * Spend it, if there is anything to spend. Returns whether it went — callers
 * need to know, because a tap that fires nothing must not also cancel a spin.
 */
export function fireBooster(booster: Booster): { booster: Booster; fired: boolean } {
  if (!isBoosterReady(booster)) return { booster, fired: false };
  return { booster: { remaining: BOOST_DURATION + BOOST_COOLDOWN }, fired: true };
}

/**
 * 0..1, for the ring drawn around the astronaut. The ring is the entire
 * booster interface: it empties when you spend it and fills as it comes back,
 * so the cooldown is legible without a number or a word anywhere near it.
 */
export function boosterCharge(booster: Booster): number {
  return 1 - Math.min(booster.remaining, BOOST_COOLDOWN) / BOOST_COOLDOWN;
}
