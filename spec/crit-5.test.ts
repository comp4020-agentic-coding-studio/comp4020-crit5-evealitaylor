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
import { RUN_SECONDS, progressAt, rocketApproach } from "../src/game/difficulty.ts";
import {
  FATAL_DAMAGE,
  GRAZE_DAMAGE,
  HEALTH_MAX,
  applyDamage,
  healthBand,
  isSpent,
} from "../src/game/health.ts";
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

// ---------------------------------------------------------------------------
// The health pool. This exists because of a play session, not a spec line: the
// game was hit-heavy and death-free, so runs never resolved. These tests pin
// the shape of the fix — damage is graded, it runs out, and it runs out in the
// three bands the ring draws.
// ---------------------------------------------------------------------------
describe("the suit's health", () => {
  it("starts full and shows green", () => {
    expect(healthBand(HEALTH_MAX)).toBe("ok");
    expect(isSpent(HEALTH_MAX)).toBe(false);
  });

  it("costs more for a dead-on hit than for a corner clip", () => {
    expect(FATAL_DAMAGE).toBeGreaterThan(GRAZE_DAMAGE);
    expect(applyDamage(HEALTH_MAX, "fatal")).toBe(HEALTH_MAX - FATAL_DAMAGE);
    expect(applyDamage(HEALTH_MAX, "graze")).toBe(HEALTH_MAX - GRAZE_DAMAGE);
    expect(applyDamage(HEALTH_MAX, "miss")).toBe(HEALTH_MAX);
  });

  it("runs out, and cannot go below empty", () => {
    let health = HEALTH_MAX;
    for (let i = 0; i < 20; i += 1) health = applyDamage(health, "fatal");
    expect(health).toBe(0);
    expect(isSpent(health)).toBe(true);
  });

  it("passes through green, then amber, then red — never backwards", () => {
    const order = ["ok", "hurt", "critical"];
    let seen = 0;
    for (let health = HEALTH_MAX; health >= 1; health -= 1) {
      const band = healthBand(health);
      const at = order.indexOf(band);
      expect(at, `${band} at ${health} is out of order`).toBeGreaterThanOrEqual(seen);
      seen = at;
    }
    expect(order[seen]).toBe("critical");
  });

  it("gives every band at least one step of the bar to live in", () => {
    // A band no value maps to is a colour the player would never see.
    const bands = new Set<string>();
    for (let health = 1; health <= HEALTH_MAX; health += 1) bands.add(healthBand(health));
    expect([...bands].sort()).toEqual(["critical", "hurt", "ok"]);
  });

  it("takes more than one dead-on hit to end a run", () => {
    expect(Math.ceil(HEALTH_MAX / FATAL_DAMAGE)).toBeGreaterThan(1);
  });
});

/** Park a rock exactly where the suit is, so the next step is a dead-on hit. */
function hitDeadOn(world: World): void {
  world.debris = [
    {
      ...createWorld({ width: 900, height: 600, seed: 3 }).debris[0],
      kind: "rock",
      x: world.astro.x,
      y: world.astro.y,
      vx: 0,
      vy: 0,
      r: 24,
      telegraph: 0,
    },
  ];
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

  it("can be lost — enough hits end it", () => {
    // Spec line 2, and the reason the health pool exists at all: before it, a
    // player could be hit over and over and the run never resolved.
    const world = startedRun();
    world.debris = [];
    world.health = FATAL_DAMAGE;
    hitDeadOn(world);
    expect(fly(world, DT).phase).toBe("lost");
  });

  it("survives a dead-on hit with health to spare", () => {
    const world = startedRun();
    world.debris = [];
    hitDeadOn(world);
    const hurt = fly(world, DT);
    expect(hurt.phase).toBe("flying");
    expect(hurt.health).toBe(HEALTH_MAX - FATAL_DAMAGE);
    expect(inControl(hurt.astro)).toBe(false);
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
    expect(clipped.health).toBe(HEALTH_MAX - GRAZE_DAMAGE);
  });

  it("keeps the rocket out of sight until the run is nearly over", () => {
    // It used to grow through the whole run as a progress gauge, and read as
    // confusing background furniture instead. Now it is the ending arriving.
    expect(rocketApproach(0)).toBe(0);
    expect(rocketApproach(RUN_SECONDS * 0.5)).toBe(0);
    expect(rocketApproach(RUN_SECONDS * 0.85)).toBe(0);
    expect(rocketApproach(RUN_SECONDS)).toBe(1);
  });

  it("cannot be hit again while already spinning out", () => {
    // Without this, one clip in heavy traffic drains the whole bar in a handful
    // of frames, and the recovery mechanic is a lie.
    const world = startedRun();
    world.debris = [];
    world.astro.spin = SPIN_DURATION;
    expect(isInvulnerable(world.astro)).toBe(true);
    hitDeadOn(world);
    const after = fly(world, DT);
    expect(after.phase).toBe("flying");
    expect(after.health).toBe(HEALTH_MAX);
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
// Is the game actually playable to an ending?
//
// Every other test here checks a rule in isolation. None of them can tell me
// whether the rules add up to a game a person can finish — and once a hit
// started draining a pool instead of ending the run, the balance moved far
// enough that a careful player stopped reaching the rocket at all.
//
// So this plays the real simulation with a policy that stands in for someone
// paying attention: look a beat ahead, steer for the emptiest nearby space,
// and ride out a spin rather than spending the booster on it. Over a fixed set
// of seeds it has to both get home and die. A build where it never wins is
// unwinnable; one where it never loses is the bug the player reported.
// ---------------------------------------------------------------------------

/** Where an attentive player would move next: away from where debris is going. */
function attentiveAim(world: World): { x: number; y: number } {
  const { astro } = world;
  let best = { x: astro.x, y: astro.y, cost: Number.POSITIVE_INFINITY };
  for (let i = 0; i < 32; i += 1) {
    const angle = (i / 32) * Math.PI * 2;
    for (const reach of [80, 180]) {
      const x = Math.min(world.width - 30, Math.max(30, astro.x + Math.cos(angle) * reach * world.scale));
      const y = Math.min(world.height - 30, Math.max(30, astro.y + Math.sin(angle) * reach * world.scale));
      let cost = reach * 0.002;
      for (const piece of world.debris) {
        const lead = 0.55;
        const gap =
          Math.hypot(piece.x + piece.vx * lead - x, piece.y + piece.vy * lead - y) -
          (piece.r + astro.r);
        const near = 190 * world.scale;
        if (gap < near) cost += (near - gap) ** 2 / 900;
      }
      if (cost < best.cost) best = { x, y, cost };
    }
  }
  return best;
}

/** Play one whole run at 60fps and report how it ended. */
function playOut(seed: number): World {
  const world = createWorld({ width: 1920, height: 1080, seed });
  step(world, 1 / 60, { aimX: world.astro.x, aimY: world.astro.y, tapped: true });
  let guard = 0;
  while (world.phase === "flying" && guard < 60 * (RUN_SECONDS + 5)) {
    const aim = attentiveAim(world);
    step(world, 1 / 60, { aimX: aim.x, aimY: aim.y, tapped: false });
    guard += 1;
  }
  return world;
}

describe("the run, played end to end", () => {
  const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];
  const played = SEEDS.map(playOut);

  it("can be finished — someone paying attention reaches the rocket", () => {
    const won = played.filter((world) => world.phase === "won");
    expect(
      won.length,
      `no seed of ${SEEDS.length} reached the rocket, so the destination is decoration`,
    ).toBeGreaterThan(0);
  });

  it("can still be lost — attention alone is not a guarantee", () => {
    const lost = played.filter((world) => world.phase === "lost");
    expect(
      lost.length,
      `every seed of ${SEEDS.length} got home, which is what the player complained about`,
    ).toBeGreaterThan(0);
  });

  it("never ends in the same breath as it starts", () => {
    for (const world of played) {
      expect(world.elapsed).toBeGreaterThan(20);
    }
  });

  it("spends the health pool rather than ending on one unlucky hit", () => {
    for (const world of played.filter((w) => w.phase === "lost")) {
      expect(world.grazes).toBeGreaterThan(1);
    }
  });
});

// The sensors that used to sit here now live in spec/sensors.test.ts. They are
// harness rather than contract: this file retires with the crit-5 brief, and
// they carry forward.
