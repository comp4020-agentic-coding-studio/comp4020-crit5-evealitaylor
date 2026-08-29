import type { DebrisKind } from "./types.ts";

/**
 * A run is two minutes.
 *
 * The spec gives a stranger five minutes to reach an ending, and a two-minute
 * run means someone can die twice and still see the rocket. Anything longer
 * spends that budget on one attempt.
 */
export const RUN_SECONDS = 120;

/** The final approach. The field thins so the ending is an arrival, not a coin flip. */
export const DOCK_SECONDS = 10;

export interface Stage {
  /** For reading the curve, not for showing anyone. */
  name: string;
  kinds: readonly DebrisKind[];
  /** Seconds between spawns at reference size; world scales this by area. */
  interval: number;
  /** Multiplier on how fast the field moves. */
  speed: number;
}

/**
 * The curve. Each stage introduces exactly one new idea and then gives the
 * player time to get used to it before the next one lands — the whole teaching
 * budget is spent here, since nothing is allowed to explain itself in words.
 */
const STAGES: readonly { until: number; stage: Stage }[] = [
  {
    // Learn that the suit follows you, and that touching things is bad, while
    // the field is too sparse for that lesson to cost a run.
    until: 20,
    stage: { name: "drift", kinds: ["rock"], interval: 1.55, speed: 0.78 },
  },
  {
    // Wreckage: flat panels tumble end over end, so the shape you have to read
    // changes as it falls.
    until: 45,
    stage: { name: "wreckage", kinds: ["rock", "shard", "panel"], interval: 1.08, speed: 1 },
  },
  {
    // The turn: something out here aims at you. It flares first, so the lesson
    // is teachable rather than a cheap shot.
    until: 75,
    stage: {
      name: "incoming",
      kinds: ["rock", "shard", "panel", "bolts", "asteroid"],
      interval: 0.82,
      speed: 1.16,
    },
  },
  {
    // Everything at once, plus satellites big enough that you thread a gap
    // rather than dodge a dot.
    until: RUN_SECONDS - DOCK_SECONDS,
    stage: {
      name: "storm",
      kinds: ["rock", "shard", "panel", "bolts", "asteroid", "satellite", "comet"],
      interval: 0.6,
      speed: 1.34,
    },
  },
  {
    // Nothing new spawns. What is already on screen still has to be survived.
    until: Number.POSITIVE_INFINITY,
    stage: { name: "docking", kinds: [], interval: Number.POSITIVE_INFINITY, speed: 1.34 },
  },
];

/** 0 at the airlock, 1 at the rocket. */
export function progressAt(elapsed: number): number {
  return Math.min(1, Math.max(0, elapsed / RUN_SECONDS));
}

export function stageAt(elapsed: number): Stage {
  for (const entry of STAGES) if (elapsed < entry.until) return entry.stage;
  return STAGES[STAGES.length - 1].stage;
}

/** True once the rocket is close enough to be the thing you are looking at. */
export function isDocking(elapsed: number): boolean {
  return elapsed >= RUN_SECONDS - DOCK_SECONDS;
}

/**
 * How big the rocket looks, 0..1. It is the only progress indicator in the
 * game: the destination itself grows, so "how far is left" needs no bar and no
 * number to read.
 */
export function rocketApproach(elapsed: number): number {
  // 0 for most of the run, so there is nothing sitting in the background to
  // read as scenery. It arrives with the docking stretch — the field thins and
  // the ship comes up to meet you, which is the ending rather than a gauge.
  const start = RUN_SECONDS - DOCK_SECONDS;
  return Math.min(1, Math.max(0, (elapsed - start) / DOCK_SECONDS));
}
