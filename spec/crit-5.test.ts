import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";

import {
  ASTRO_RADIUS,
  SPIN_DURATION,
  inControl,
  isInvulnerable,
} from "../src/game/astronaut.ts";
import {
  BOOST_COOLDOWN,
  BOOST_DURATION,
  boosterCharge,
  createBooster,
  fireBooster,
  isBoosterReady,
  tickBooster,
} from "../src/game/booster.ts";
import { FATAL_FRACTION, classifyHit } from "../src/game/collision.ts";
import { RUN_SECONDS, progressAt } from "../src/game/difficulty.ts";
import { createWorld, step } from "../src/game/world.ts";
import type { World } from "../src/game/world.ts";

// ---------------------------------------------------------------------------
// The focused rule: what counts as a dead-on hit, a corner clip, and a miss.
//
// This is the rule the whole game turns on — it decides whether a run ends or
// merely goes wrong — so it is the one held to a test. It is a pure function of
// two circles, which is what keeps the test focused: no canvas, no timing, no
// DOM. Whether the rule *feels* fair is a question only playing can answer.
// ---------------------------------------------------------------------------
describe("the collision rule", () => {
  const astro = { x: 0, y: 0, r: ASTRO_RADIUS };
  const rock = { x: 0, y: 0, r: 22 };
  const contact = astro.r + rock.r;

  // Distance between centres, expressed as a fraction of the touching distance.
  const at = (fraction: number) =>
    classifyHit(astro, { ...rock, x: contact * fraction });

  it("ignores debris that never touches the astronaut", () => {
    expect(at(1.01)).toBe("miss");
    expect(at(3)).toBe("miss");
  });

  it("ends the run on a dead-on hit", () => {
    expect(at(0)).toBe("fatal");
    expect(at(FATAL_FRACTION * 0.5)).toBe("fatal");
  });

  it("only clips the corner just inside contact", () => {
    expect(at(0.99)).toBe("graze");
    expect(at(FATAL_FRACTION + 0.01)).toBe("graze");
  });

  it("keeps the fatal core strictly inside the graze band", () => {
    // If these ever met, every touch would be fatal and the spin-out
    // recovery — the thing that makes a hit survivable — would be unreachable.
    expect(FATAL_FRACTION).toBeGreaterThan(0);
    expect(FATAL_FRACTION).toBeLessThan(1);
    expect(at(FATAL_FRACTION - 0.01)).toBe("fatal");
    expect(at(FATAL_FRACTION + 0.01)).toBe("graze");
  });

  it("never gets safer as the debris gets closer", () => {
    const severity = { miss: 0, graze: 1, fatal: 2 };
    let previous = 0;
    for (let f = 1.5; f >= 0; f -= 0.01) {
      const now = severity[at(f)];
      expect(now).toBeGreaterThanOrEqual(previous);
      previous = now;
    }
    expect(previous).toBe(severity.fatal);
  });

  it("scales with the size of the debris, not a fixed distance", () => {
    const far = { x: 60, y: 0, r: 8 };
    expect(classifyHit(astro, far)).toBe("miss");
    expect(classifyHit(astro, { ...far, r: 60 })).not.toBe("miss");
  });
});

// ---------------------------------------------------------------------------
// The booster: scarce, on a timer, and the only way out of a spin.
// ---------------------------------------------------------------------------
describe("the booster", () => {
  it("starts ready, so the first tap always fires", () => {
    expect(isBoosterReady(createBooster())).toBe(true);
    expect(boosterCharge(createBooster())).toBe(1);
  });

  it("refuses to fire while it is recharging", () => {
    const first = fireBooster(createBooster());
    expect(first.fired).toBe(true);
    expect(isBoosterReady(first.booster)).toBe(false);
    expect(fireBooster(first.booster).fired).toBe(false);
  });

  it("is ready again after the cooldown, and not a moment before", () => {
    let { booster } = fireBooster(createBooster());
    booster = tickBooster(booster, BOOST_DURATION + BOOST_COOLDOWN - 0.1);
    expect(isBoosterReady(booster)).toBe(false);
    booster = tickBooster(booster, 0.2);
    expect(isBoosterReady(booster)).toBe(true);
  });

  it("refills the ring steadily, so the player can read the wait", () => {
    const { booster } = fireBooster(createBooster());
    const spent = boosterCharge(booster);
    const half = boosterCharge(tickBooster(booster, BOOST_DURATION + BOOST_COOLDOWN / 2));
    expect(spent).toBeLessThan(0.1);
    expect(half).toBeGreaterThan(spent);
    expect(half).toBeLessThan(1);
  });
});

// ---------------------------------------------------------------------------
// The run: it can be lost, it can be won, and a corner clip is survivable.
// ---------------------------------------------------------------------------
const DT = 1 / 60;

/** Fly a world forward with the astronaut parked on its aim point. */
function fly(world: World, seconds: number, tapped = false): World {
  let w = world;
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i += 1) {
    w = step(w, DT, { aimX: w.astro.x, aimY: w.astro.y, tapped: tapped && i === 0 });
  }
  return w;
}

function startedRun(): World {
  return step(createWorld({ width: 900, height: 600, seed: 7 }), DT, {
    aimX: 450,
    aimY: 300,
    tapped: true,
  });
}

describe("a run", () => {
  it("waits on the title screen until the player acts", () => {
    const world = createWorld({ width: 900, height: 600, seed: 7 });
    expect(world.phase).toBe("title");
    expect(fly(world, 3).phase).toBe("title");
  });

  it("starts flying on the first tap", () => {
    expect(startedRun().phase).toBe("flying");
  });

  it("can be lost — a dead-on hit ends it", () => {
    const world = startedRun();
    world.debris = [
      {
        ...world.debris[0],
        kind: "rock",
        x: world.astro.x,
        y: world.astro.y,
        vx: 0,
        vy: 0,
        r: 24,
        telegraph: 0,
      },
    ];
    expect(fly(world, DT).phase).toBe("lost");
  });

  it("can be won — reaching the rocket ends it too", () => {
    const world = startedRun();
    world.debris = [];
    world.elapsed = RUN_SECONDS - 0.5;
    const done = fly(world, 1);
    expect(done.phase).toBe("won");
    expect(progressAt(done.elapsed)).toBe(1);
  });

  it("survives a corner clip, but takes control away", () => {
    const world = startedRun();
    const contact = world.astro.r + 24;
    world.debris = [
      {
        ...world.debris[0],
        kind: "rock",
        x: world.astro.x + contact * 0.95,
        y: world.astro.y,
        vx: 0,
        vy: 0,
        r: 24,
        telegraph: 0,
      },
    ];
    const clipped = fly(world, DT);
    expect(clipped.phase).toBe("flying");
    expect(inControl(clipped.astro)).toBe(false);
    expect(clipped.astro.spin).toBeCloseTo(SPIN_DURATION, 1);
  });

  it("cannot be killed while already spinning out", () => {
    // Without this, one clip in heavy traffic chains straight into a death the
    // player had no way to avoid, and the recovery mechanic is a lie.
    const world = startedRun();
    world.astro.spin = SPIN_DURATION;
    expect(isInvulnerable(world.astro)).toBe(true);
    world.debris = [
      {
        ...world.debris[0],
        kind: "rock",
        x: world.astro.x,
        y: world.astro.y,
        vx: 0,
        vy: 0,
        r: 24,
        telegraph: 0,
      },
    ];
    expect(fly(world, DT).phase).toBe("flying");
  });

  it("gives control back on its own once the spin runs out", () => {
    const world = startedRun();
    world.debris = [];
    world.astro.spin = SPIN_DURATION;
    expect(inControl(fly(world, SPIN_DURATION + 0.1).astro)).toBe(true);
  });

  it("lets the booster cut a spin short — the choice the game turns on", () => {
    const world = startedRun();
    world.debris = [];
    // The tap that starts a run spends the booster, so arm it deliberately:
    // this test is about the rescue, not about what the opening tap costs.
    world.booster = createBooster();
    world.astro.spin = SPIN_DURATION;
    const rescued = fly(world, DT, true);
    expect(inControl(rescued.astro)).toBe(true);
    expect(isBoosterReady(rescued.booster)).toBe(false);
  });

  it("will not rescue a spin the booster cannot pay for", () => {
    const world = startedRun();
    world.debris = [];
    world.booster = fireBooster(createBooster()).booster;
    world.astro.spin = SPIN_DURATION;
    expect(inControl(fly(world, DT, true).astro)).toBe(false);
  });

  it("reaches an ending well inside the five minutes a stranger has", () => {
    expect(RUN_SECONDS).toBeLessThan(5 * 60);
  });
});

// ---------------------------------------------------------------------------
// The no-tutorial rule, made mechanical.
//
// "It teaches itself: no instructions anywhere, on screen or off" is the one
// spec line that cannot be argued with at the crit, and the easiest to break by
// accident — a stray "click to start" would do it. A person still has to judge
// whether the opening screen actually teaches; this only catches the words.
// ---------------------------------------------------------------------------
const DIST = resolve("dist");

function shipped(dir: string = DIST): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? shipped(path) : [path];
  });
}

const textFiles = shipped()
  .filter((path) => /\.(html|css|js)$/.test(path))
  .map((path) => ({
    name: relative(DIST, path).split(sep).join("/"),
    body: readFileSync(path, "utf8"),
  }));

describe("nothing explains the game", () => {
  const INSTRUCTIONAL = [
    "how to play",
    "instructions",
    "click to",
    "tap to",
    "press to",
    "press the",
    "use your",
    "use the",
    "move your",
    "move the",
    "avoid the",
    "dodge the",
    "hold to",
    "drag to",
    "controls",
    "tutorial",
  ];

  for (const { name, body } of textFiles) {
    const haystack = body.toLowerCase();
    it(`${name} tells the player nothing`, () => {
      const found = INSTRUCTIONAL.filter((phrase) => haystack.includes(phrase));
      expect(
        found,
        `the opening screen has to teach without words — ${name} says: ${found.join(", ")}`,
      ).toEqual([]);
    });
  }

  it("ships a page whose words a stranger never needs to read", () => {
    expect(textFiles.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// SENSOR — carries into next week's repo, whatever the brief is.
//
// Shipping the template's placeholder copy is the cheapest possible way to lose
// marks, and it is invisible locally because the page still looks fine. Wired
// into `check` so it can only happen once.
// ---------------------------------------------------------------------------
describe("sensor: no template boilerplate ships", () => {
  const LEFTOVERS = [
    "Replace this with",
    "TEMPLATE:",
    "COMP4020 prototype",
    "your prototype",
    "lorem ipsum",
  ];

  for (const { name, body } of textFiles) {
    it(`${name} is the student's own work`, () => {
      const found = LEFTOVERS.filter((phrase) =>
        body.toLowerCase().includes(phrase.toLowerCase()),
      );
      expect(found, `${name} still ships template copy: ${found.join(", ")}`).toEqual([]);
    });
  }
});
