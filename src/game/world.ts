import {
  createAstronaut,
  isInvulnerable,
  spinOut,
  steadyUp,
  steerAstronaut,
  ASTRO_RADIUS,
  type Astronaut,
} from "./astronaut.ts";
import {
  createBooster,
  fireBooster,
  isBoosting,
  tickBooster,
  type Booster,
} from "./booster.ts";
import { classifyHit } from "./collision.ts";
import { hasLeft, spawnDebris, stepDebris, type Debris } from "./debris.ts";
import { RUN_SECONDS, stageAt } from "./difficulty.ts";
import { makeRng, pick, range, type Rng } from "./rng.ts";
import type { Phase } from "./types.ts";

export interface Input {
  aimX: number;
  aimY: number;
  /** A discrete press this frame, not a held button. */
  tapped: boolean;
}

export interface World {
  phase: Phase;
  elapsed: number;
  astro: Astronaut;
  booster: Booster;
  debris: Debris[];
  width: number;
  height: number;
  /** Viewport scale — one number keeps 1920x1080 and 390x844 the same game. */
  scale: number;
  rng: Rng;
  seed: number;
  spawnTimer: number;
  nextId: number;
  /** Counters the renderer diffs to fire sparks; the sim never reads them. */
  grazes: number;
  boosts: number;
  /** 0..1, decaying. Camera shake. */
  shake: number;
  /** Seconds since the run ended, so a click that kills doesn't also restart. */
  sinceEnd: number;
}

export interface WorldOptions {
  width: number;
  height: number;
  seed?: number;
}

/**
 * A phone is not a small desktop. Sizes and speeds are multiplied by this so
 * the astronaut occupies about the same fraction of the screen, and debris
 * crosses in about the same time, at either marking viewport.
 */
export function worldScale(width: number, height: number): number {
  return Math.min(1.4, Math.max(0.62, Math.min(width, height) / 620));
}

/** How many lanes of traffic the field is wide — wider screens spawn more. */
function density(world: World): number {
  return Math.max(1, world.width / (620 * world.scale));
}

export function createWorld(options: WorldOptions): World {
  const seed = options.seed ?? 1;
  const scale = worldScale(options.width, options.height);
  const world: World = {
    phase: "title",
    elapsed: 0,
    astro: createAstronaut(options.width / 2, options.height * 0.68, ASTRO_RADIUS * scale),
    booster: createBooster(),
    debris: [],
    width: options.width,
    height: options.height,
    scale,
    rng: makeRng(seed),
    seed,
    spawnTimer: 0.6,
    nextId: 1,
    grazes: 0,
    boosts: 0,
    shake: 0,
    sinceEnd: 0,
  };

  // Seed the title screen with a slow drift, well clear of the astronaut. The
  // opening screen is already the game, just without stakes — which is where
  // the player learns that the suit follows the pointer.
  for (let i = 0; i < 5; i += 1) {
    const rock = spawnDebris("rock", {
      rng: world.rng,
      id: world.nextId++,
      width: world.width,
      height: world.height,
      scale,
      speed: 0.7,
      targetX: world.astro.x,
      targetY: world.astro.y,
    });
    rock.y = range(world.rng, -world.height * 0.35, world.height * 0.42);
    world.debris.push(rock);
  }

  return world;
}

/** Start again, in place, so the caller keeps its reference. */
export function resetWorld(world: World): void {
  const fresh = createWorld({
    width: world.width,
    height: world.height,
    seed: Math.floor(world.rng() * 2 ** 31),
  });
  Object.assign(world, fresh, { phase: "flying" as Phase, sinceEnd: 0 });
}

function drift(world: World, dt: number): void {
  for (const piece of world.debris) stepDebris(piece, dt, world.astro.x, world.astro.y);
  world.debris = world.debris.filter((piece) => !hasLeft(piece, world.width, world.height));
  world.shake = Math.max(0, world.shake - dt * 2.4);
}

function titleStep(world: World, dt: number, input: Input): void {
  steerAstronaut(
    world.astro,
    input.aimX,
    input.aimY,
    dt,
    false,
    world.width,
    world.height,
    world.scale,
  );
  drift(world, dt);

  // Keep a little traffic moving behind the title so the screen reads as a
  // place, not a menu.
  world.spawnTimer -= dt;
  if (world.spawnTimer <= 0 && world.debris.length < 7) {
    world.debris.push(
      spawnDebris("rock", {
        rng: world.rng,
        id: world.nextId++,
        width: world.width,
        height: world.height,
        scale: world.scale,
        speed: 0.7,
        targetX: world.astro.x,
        targetY: world.astro.y,
      }),
    );
    world.spawnTimer = range(world.rng, 1.4, 2.6);
  }
}

function endStep(world: World, dt: number, input: Input): void {
  drift(world, dt);
  // A short lockout: the click that killed you must not also restart you before
  // you have seen what happened.
  if (input.tapped && world.sinceEnd > 0.9) resetWorld(world);
}

function flyingStep(world: World, dt: number, input: Input): void {
  world.elapsed += dt;
  world.booster = tickBooster(world.booster, dt);

  if (input.tapped) {
    const { booster, fired } = fireBooster(world.booster);
    if (fired) {
      world.booster = booster;
      world.boosts += 1;
      if (isInvulnerable(world.astro)) {
        // The decision the game is built around: pay the cooldown, get the
        // stick back now, rather than ride out the tumble and keep the charge.
        steadyUp(world.astro);
      } else {
        const dx = input.aimX - world.astro.x;
        const dy = input.aimY - world.astro.y;
        const length = Math.hypot(dx, dy);
        const kick = 620 * world.scale;
        if (length > 4) {
          world.astro.vx += (dx / length) * kick;
          world.astro.vy += (dy / length) * kick;
        } else {
          world.astro.vy -= kick;
        }
      }
    }
  }

  steerAstronaut(
    world.astro,
    input.aimX,
    input.aimY,
    dt,
    isBoosting(world.booster),
    world.width,
    world.height,
    world.scale,
  );

  const stage = stageAt(world.elapsed);
  if (stage.kinds.length > 0) {
    world.spawnTimer -= dt;
    if (world.spawnTimer <= 0) {
      world.debris.push(
        spawnDebris(pick(world.rng, stage.kinds), {
          rng: world.rng,
          id: world.nextId++,
          width: world.width,
          height: world.height,
          scale: world.scale,
          speed: stage.speed,
          targetX: world.astro.x,
          targetY: world.astro.y,
        }),
      );
      world.spawnTimer = (stage.interval / density(world)) * range(world.rng, 0.72, 1.32);
    }
  }

  drift(world, dt);

  if (!isInvulnerable(world.astro)) {
    for (const piece of world.debris) {
      const hit = classifyHit(world.astro, piece);
      if (hit === "miss") continue;
      if (hit === "fatal") {
        world.phase = "lost";
        world.sinceEnd = 0;
        world.shake = 1;
        world.astro.spinRate = 7;
        world.astro.flash = 0.6;
        return;
      }
      spinOut(world.astro, piece.x, piece.y, 280 * world.scale);
      world.grazes += 1;
      world.shake = Math.max(world.shake, 0.5);
      break;
    }
  }

  if (world.elapsed >= RUN_SECONDS) {
    world.elapsed = RUN_SECONDS;
    world.phase = "won";
    world.sinceEnd = 0;
  }
}

/**
 * One tick of the whole game. Mutates and returns the same world — a run
 * allocates enough already without a fresh state object sixty times a second.
 */
export function step(world: World, dt: number, input: Input): World {
  world.sinceEnd += dt;

  if (world.phase === "title") {
    if (!input.tapped) {
      titleStep(world, dt, input);
      return world;
    }
    // The tap that begins the run is also the tap that spends the booster, so
    // the first thing a player ever does teaches what the button costs — and
    // the ring refills in front of them during the safe opening stretch.
    world.phase = "flying";
    world.elapsed = 0;
  }

  if (world.phase === "lost" || world.phase === "won") {
    endStep(world, dt, input);
    return world;
  }

  flyingStep(world, dt, input);
  return world;
}
