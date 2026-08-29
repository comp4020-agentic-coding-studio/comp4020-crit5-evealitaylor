import { isBoosting, boosterCharge, isBoosterReady } from "../game/booster.ts";
import { rocketApproach } from "../game/difficulty.ts";
import { isInvulnerable } from "../game/astronaut.ts";
import type { Phase } from "../game/types.ts";
import type { World } from "../game/world.ts";
import { Particles, createStarfield, drawStarfield, type Starfield } from "./effects.ts";
import { drawAstronaut, drawChargeRing, drawDebris, drawRocket } from "./sprites.ts";

const DOCK_TIME = 1.5;

/**
 * Everything the player sees. The renderer watches the world's counters to
 * decide when to throw sparks, so the simulation never has to know that
 * particles exist.
 */
export class Renderer {
  private field: Starfield;
  private particles = new Particles();
  private scroll = 0;
  private seenGrazes = 0;
  private seenBoosts = 0;
  private seenPhase: Phase = "title";
  private dock = 0;

  constructor(width: number, height: number) {
    this.field = createStarfield(width, height);
  }

  resize(width: number, height: number): void {
    this.field = createStarfield(width, height);
  }

  private rocket(world: World): { x: number; y: number; size: number } {
    const approach = rocketApproach(world.elapsed);
    const full = Math.min(world.width, world.height) * 0.11;
    return {
      x: world.width / 2,
      y: world.height * 0.2,
      size: full * (0.06 + 0.94 * approach),
    };
  }

  draw(
    ctx: CanvasRenderingContext2D,
    world: World,
    dt: number,
    time: number,
    calm: boolean,
  ): void {
    const { astro } = world;
    const boosting = isBoosting(world.booster);

    /* --- events the renderer reacts to --------------------------------- */

    if (world.grazes > this.seenGrazes) {
      this.seenGrazes = world.grazes;
      this.particles.burst(astro.x, astro.y, 26, ["#fca5a5", "#fbbf24", "#fff7ed"], 340);
    }
    if (world.boosts > this.seenBoosts) {
      this.seenBoosts = world.boosts;
      this.particles.burst(astro.x, astro.y, 18, ["#67e8f9", "#ffffff"], 260, false);
    }
    if (world.phase !== this.seenPhase) {
      if (world.phase === "lost") {
        this.particles.burst(astro.x, astro.y, 64, ["#fb7185", "#fbbf24", "#ffffff"], 620);
      }
      if (world.phase === "flying" && this.seenPhase !== "title") this.particles.clear();
      this.seenPhase = world.phase;
      this.dock = 0;
    }
    if (world.phase === "won") {
      const was = this.dock;
      this.dock = Math.min(1, this.dock + dt / DOCK_TIME);
      const rocket = this.rocket(world);
      if (was < 1 && this.dock >= 1) {
        this.particles.burst(
          rocket.x,
          rocket.y,
          90,
          ["#fde68a", "#67e8f9", "#ffffff", "#a78bfa"],
          520,
        );
      }
    }
    if (boosting) {
      this.particles.trail(astro.x, astro.y + astro.r, "#38bdf8", astro.r * 0.6);
    }

    /* --- camera -------------------------------------------------------- */

    const speed = world.phase === "flying" ? 62 : 24;
    this.scroll += (speed * (boosting ? 3.2 : 1) + astro.vy * 0.06) * dt;
    this.particles.step(dt);

    ctx.save();
    if (!calm && world.shake > 0) {
      const power = world.shake * astro.r * 0.75;
      ctx.translate(Math.sin(time * 61) * power, Math.cos(time * 47) * power);
    }

    drawStarfield(ctx, this.field, this.scroll, time, calm);

    const rocket = this.rocket(world);
    drawRocket(ctx, rocket.x, rocket.y, rocket.size, time, world.phase === "won" ? this.dock : 0);

    for (const piece of world.debris) drawDebris(ctx, piece, time, astro.x, astro.y);

    /* --- the astronaut, and the ring that is its whole interface -------- */

    const hidden = world.phase === "won" && this.dock >= 1;
    if (!hidden) {
      const docked = world.phase === "won" ? this.dock : 0;
      const drawn = {
        ...astro,
        x: astro.x + (rocket.x - astro.x) * docked,
        y: astro.y + (rocket.y - astro.y) * docked,
        r: astro.r * (1 - docked * 0.7),
      };

      if (world.phase !== "lost" && world.phase !== "won") {
        drawChargeRing(ctx, drawn, {
          charge: boosterCharge(world.booster),
          ready: isBoosterReady(world.booster),
          boosting,
          time,
          calm,
        });
      }

      // A spun-out suit blinks, so the moment control comes back is visible.
      const blink = isInvulnerable(astro) && !calm ? 0.45 + 0.55 * Math.abs(Math.sin(time * 18)) : 1;
      ctx.globalAlpha = blink;
      drawAstronaut(ctx, drawn, {
        charge: boosterCharge(world.booster),
        ready: isBoosterReady(world.booster),
        boosting,
        time,
        calm,
      });
      ctx.globalAlpha = 1;
    }

    this.particles.draw(ctx);
    ctx.restore();

    /* --- endings ------------------------------------------------------- */

    if (world.phase === "lost" || world.phase === "won") {
      const fade = Math.min(1, world.sinceEnd / 0.9);
      ctx.fillStyle =
        world.phase === "lost"
          ? `rgba(8, 6, 18, ${0.55 * fade})`
          : `rgba(10, 14, 34, ${0.4 * fade})`;
      ctx.fillRect(0, 0, world.width, world.height);

      // The invitation to go again is the same breathing ring the player
      // already learned means "press" — no word required to say "again".
      if (world.sinceEnd > 0.9) {
        const pulse = calm ? 0.7 : 0.5 + 0.5 * Math.sin(time * 3.4);
        const radius = Math.min(world.width, world.height) * 0.075 * (1 + pulse * 0.12);
        ctx.save();
        ctx.translate(world.width / 2, world.height / 2);
        ctx.globalAlpha = 0.35 + pulse * 0.45;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.lineWidth = Math.max(3, radius * 0.09);
        ctx.strokeStyle = "#67e8f9";
        ctx.shadowColor = "#22d3ee";
        ctx.shadowBlur = 24;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, 0, radius * 0.16, 0, Math.PI * 2);
        ctx.fillStyle = "#67e8f9";
        ctx.fill();
        ctx.restore();
        ctx.globalAlpha = 1;
      }
    }
  }
}
