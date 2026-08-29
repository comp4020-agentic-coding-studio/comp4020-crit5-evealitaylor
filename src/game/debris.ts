import { pick, range, type Rng } from "./rng.ts";
import type { DebrisKind } from "./types.ts";

export interface Debris {
  id: number;
  kind: DebrisKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  angle: number;
  spinRate: number;
  /**
   * Seconds of warning flare before a powered rock commits to its run. A
   * telegraph is what separates "hard" from "unfair": the player is always
   * shown the shot before it is taken.
   */
  telegraph: number;
  /** Under power, and steering at whoever is in front of it. */
  propelled: boolean;
  /** Held until the telegraph burns out, then spent all at once. */
  launchSpeed: number;
  /** Stable per-piece randomness, so each one keeps its own silhouette. */
  seed: number;
}

/** Radius range at reference scale, per kind. */
const SIZES: Record<DebrisKind, readonly [number, number]> = {
  rock: [16, 34],
  shard: [11, 20],
  panel: [20, 38],
  bolts: [7, 12],
  satellite: [42, 62],
  asteroid: [18, 30],
  comet: [12, 19],
};

const PROPELLED: ReadonlySet<DebrisKind> = new Set<DebrisKind>(["asteroid", "comet"]);

export function isPropelled(kind: DebrisKind): boolean {
  return PROPELLED.has(kind);
}

export interface SpawnContext {
  rng: Rng;
  id: number;
  width: number;
  height: number;
  /** Viewport scale, so a phone and a desktop play the same game. */
  scale: number;
  /** Stage speed multiplier. */
  speed: number;
  targetX: number;
  targetY: number;
}

/**
 * Put a new piece of debris just off the top edge.
 *
 * The field always flows downward and the rocket sits above, so "forward" is
 * up: the same reading at 1920x1080 and at 390x844, where a sideways scroll
 * would give a phone almost no room to react.
 */
export function spawnDebris(kind: DebrisKind, ctx: SpawnContext): Debris {
  const { rng, scale } = ctx;
  const [min, max] = SIZES[kind];
  const r = range(rng, min, max) * scale;
  const propelled = isPropelled(kind);

  const x = range(rng, r, ctx.width - r);
  const y = -r - range(rng, 10, 90) * scale;

  const drift = range(rng, 96, 168) * scale * ctx.speed;
  const sideways = range(rng, -46, 46) * scale;

  return {
    id: ctx.id,
    kind,
    x,
    y,
    vx: propelled ? 0 : sideways,
    vy: propelled ? range(rng, 10, 24) * scale : drift,
    r,
    angle: range(rng, 0, Math.PI * 2),
    spinRate: range(rng, -1.9, 1.9) * (kind === "satellite" ? 0.25 : 1),
    telegraph: propelled ? (kind === "comet" ? 0.62 : 0.85) : 0,
    propelled,
    launchSpeed: (kind === "comet" ? range(rng, 620, 780) : range(rng, 430, 560)) * scale * ctx.speed,
    seed: rng(),
  };
}

/**
 * Advance one piece. A powered rock spends its telegraph creeping, then aims
 * once — at where the astronaut is at that instant — and never corrects. It
 * commits, so it is dodgeable by moving; a rock that tracked you forever would
 * be unbeatable rather than hard.
 */
export function stepDebris(debris: Debris, dt: number, targetX: number, targetY: number): void {
  if (debris.telegraph > 0) {
    debris.telegraph -= dt;
    if (debris.telegraph <= 0 && debris.propelled) {
      const dx = targetX - debris.x;
      const dy = targetY - debris.y;
      const length = Math.hypot(dx, dy) || 1;
      debris.vx = (dx / length) * debris.launchSpeed;
      debris.vy = (dy / length) * debris.launchSpeed;
      debris.spinRate *= 2.2;
    }
  }

  debris.x += debris.vx * dt;
  debris.y += debris.vy * dt;
  debris.angle += debris.spinRate * dt;
}

/** Gone for good — off the bottom, or far enough out the side to never return. */
export function hasLeft(debris: Debris, width: number, height: number): boolean {
  const margin = debris.r * 2 + 80;
  return (
    debris.y > height + margin ||
    debris.x < -margin ||
    debris.x > width + margin ||
    debris.y < -margin * 6
  );
}
