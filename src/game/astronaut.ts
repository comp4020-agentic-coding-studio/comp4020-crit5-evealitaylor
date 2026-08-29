/** Suit radius at reference scale. World scales it for the actual viewport. */
export const ASTRO_RADIUS = 18;

/**
 * How long a corner clip costs you.
 *
 * Long enough to be frightening — you watch yourself drift into whatever is
 * next and cannot do a thing about it — and short enough that riding it out
 * stays a real option rather than a formality.
 */
export const SPIN_DURATION = 1.4;

export interface Astronaut {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  /** Seconds of tumble left. Zero means the player is flying it. */
  spin: number;
  /** Facing, in radians. Leans into the turn while flying, whirls while spun. */
  angle: number;
  spinRate: number;
  /** Counts down after a clip, purely so the renderer can flash the suit. */
  flash: number;
  /** 0..1 throttle, drives the size of the boot flames. */
  thrust: number;
}

export function createAstronaut(x: number, y: number, r: number): Astronaut {
  return { x, y, vx: 0, vy: 0, r, spin: 0, angle: -Math.PI / 2, spinRate: 0, flash: 0, thrust: 0 };
}

/** The player has the stick. */
export function inControl(astronaut: Astronaut): boolean {
  return astronaut.spin <= 0;
}

/**
 * Spinning out also means untouchable.
 *
 * Without this, one clip in heavy traffic chains into a death the player could
 * not have avoided — they had no controls at the time — and the whole
 * "a corner hit is survivable" promise becomes a lie the first time the field
 * gets dense. The invulnerability is not a kindness; it is what makes the rule
 * honest.
 */
export function isInvulnerable(astronaut: Astronaut): boolean {
  return astronaut.spin > 0;
}

/** Knock the astronaut loose: control gone, momentum kept, tumbling. */
export function spinOut(astronaut: Astronaut, fromX: number, fromY: number, kick: number): void {
  const dx = astronaut.x - fromX;
  const dy = astronaut.y - fromY;
  const length = Math.hypot(dx, dy) || 1;
  astronaut.vx += (dx / length) * kick;
  astronaut.vy += (dy / length) * kick;
  astronaut.spin = SPIN_DURATION;
  astronaut.spinRate = (dx > 0 ? 1 : -1) * (6 + Math.abs(astronaut.vy) / 120);
  astronaut.flash = 0.4;
}

/** Cut a tumble short. Costs a booster charge; the caller pays it. */
export function steadyUp(astronaut: Astronaut): void {
  astronaut.spin = 0;
  astronaut.spinRate = 0;
  astronaut.vx *= 0.35;
  astronaut.vy *= 0.35;
}

const FOLLOW = 11; // how hard the boots chase the pointer
const DRAG = 5.5;
const CRUISE_SPEED = 780;
const BOOST_SPEED = 1900;

/**
 * Move the astronaut one step.
 *
 * The pointer is a destination, not a position: the boots accelerate towards it
 * and drag bleeds the speed off, so the suit has weight and overshoots slightly
 * on a hard turn. That momentum is the reason a spin-out is dangerous — you
 * keep whatever you had when you were hit.
 */
export function steerAstronaut(
  astronaut: Astronaut,
  aimX: number,
  aimY: number,
  dt: number,
  boosting: boolean,
  width: number,
  height: number,
  scale: number,
): void {
  if (astronaut.spin > 0) {
    astronaut.spin = Math.max(0, astronaut.spin - dt);
    astronaut.angle += astronaut.spinRate * dt;
    const glide = Math.exp(-1.1 * dt);
    astronaut.vx *= glide;
    astronaut.vy *= glide;
    astronaut.thrust = 0;
  } else {
    const dx = aimX - astronaut.x;
    const dy = aimY - astronaut.y;
    const pull = FOLLOW * (boosting ? 2.6 : 1);
    astronaut.vx += dx * pull * dt;
    astronaut.vy += dy * pull * dt;

    const damp = Math.exp(-DRAG * dt);
    astronaut.vx *= damp;
    astronaut.vy *= damp;

    const top = (boosting ? BOOST_SPEED : CRUISE_SPEED) * scale;
    const speed = Math.hypot(astronaut.vx, astronaut.vy);
    if (speed > top) {
      astronaut.vx = (astronaut.vx / speed) * top;
      astronaut.vy = (astronaut.vy / speed) * top;
    }

    // Face the way you are going, but only once actually going somewhere —
    // otherwise the sprite jitters while parked.
    if (speed > 12) {
      const want = Math.atan2(astronaut.vy, astronaut.vx);
      let turn = want - astronaut.angle;
      while (turn > Math.PI) turn -= Math.PI * 2;
      while (turn < -Math.PI) turn += Math.PI * 2;
      astronaut.angle += turn * Math.min(1, dt * 9);
    }
    astronaut.thrust = Math.min(1, speed / (CRUISE_SPEED * scale * 0.55));
  }

  astronaut.x += astronaut.vx * dt;
  astronaut.y += astronaut.vy * dt;
  astronaut.flash = Math.max(0, astronaut.flash - dt);

  // The edges are walls, not death. Dying to a screen edge you cannot see
  // would be a rule nothing on screen ever taught.
  const pad = astronaut.r;
  if (astronaut.x < pad) {
    astronaut.x = pad;
    astronaut.vx *= -0.35;
  } else if (astronaut.x > width - pad) {
    astronaut.x = width - pad;
    astronaut.vx *= -0.35;
  }
  if (astronaut.y < pad) {
    astronaut.y = pad;
    astronaut.vy *= -0.35;
  } else if (astronaut.y > height - pad) {
    astronaut.y = height - pad;
    astronaut.vy *= -0.35;
  }
}
