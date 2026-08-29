/**
 * A seeded random source. The simulation never touches Math.random, so a seed
 * plus a fixed timestep replays a run exactly — which is what lets the spec
 * tests step the world and assert on where things ended up.
 */
export type Rng = () => number;

/** mulberry32: small, fast, and good enough for scattering rocks. */
export function makeRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A float in [min, max). */
export function range(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min);
}

/** One item, uniformly. */
export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length) % items.length];
}
