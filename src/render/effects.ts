import { makeRng, range, type Rng } from "../game/rng.ts";

/* ------------------------------------------------------------------ stars */

interface Star {
  x: number;
  y: number;
  size: number;
  glow: number;
  phase: number;
}

export interface Starfield {
  layers: { depth: number; stars: Star[] }[];
  width: number;
  height: number;
  nebula: { x: number; y: number; r: number; hue: string }[];
}

/**
 * Three depths of stars. The near layer slides past noticeably faster than the
 * far one, which is the only thing telling the player they are moving — the
 * astronaut itself mostly holds station in the middle of the screen.
 */
export function createStarfield(width: number, height: number, seed = 4): Starfield {
  const rng = makeRng(seed);
  const area = (width * height) / (1280 * 720);
  const layers = [0.18, 0.45, 1].map((depth) => {
    const count = Math.round((depth < 0.3 ? 150 : depth < 0.6 ? 80 : 40) * Math.max(0.5, area));
    const stars: Star[] = [];
    for (let i = 0; i < count; i += 1) {
      stars.push({
        x: rng() * width,
        y: rng() * height,
        size: range(rng, 0.6, 1.1) + depth * 1.5,
        glow: range(rng, 0.35, 1),
        phase: rng() * Math.PI * 2,
      });
    }
    return { depth, stars };
  });

  const nebula = [
    { x: width * 0.22, y: height * 0.28, r: Math.max(width, height) * 0.45, hue: "138, 92, 246" },
    { x: width * 0.8, y: height * 0.66, r: Math.max(width, height) * 0.4, hue: "34, 211, 238" },
    { x: width * 0.55, y: height * 0.05, r: Math.max(width, height) * 0.35, hue: "236, 72, 153" },
  ];

  return { layers, width, height, nebula };
}

export function drawStarfield(
  ctx: CanvasRenderingContext2D,
  field: Starfield,
  scroll: number,
  time: number,
  calm: boolean,
): void {
  const { width, height } = field;

  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#070613");
  sky.addColorStop(0.55, "#0b0a1f");
  sky.addColorStop(1, "#120a24");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  for (const cloud of field.nebula) {
    const glow = ctx.createRadialGradient(cloud.x, cloud.y, 0, cloud.x, cloud.y, cloud.r);
    glow.addColorStop(0, `rgba(${cloud.hue}, 0.16)`);
    glow.addColorStop(1, `rgba(${cloud.hue}, 0)`);
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
  }

  for (const layer of field.layers) {
    for (const star of layer.stars) {
      const y = (star.y + scroll * layer.depth) % height;
      const twinkle = calm ? 1 : 0.65 + 0.35 * Math.sin(time * 2.4 + star.phase);
      ctx.globalAlpha = star.glow * twinkle;
      ctx.fillStyle = layer.depth > 0.6 ? "#dbe6ff" : "#8ea3d8";
      ctx.fillRect(star.x, y < 0 ? y + height : y, star.size, star.size);
    }
  }
  ctx.globalAlpha = 1;
}

/* -------------------------------------------------------------- particles */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  colour: string;
  spark: boolean;
}

/**
 * A tiny pool for hits, boosts and the docking celebration. Purely cosmetic —
 * it lives in the renderer so the simulation the tests step stays free of it.
 */
export class Particles {
  private items: Particle[] = [];
  private rng: Rng = makeRng(99);

  burst(x: number, y: number, count: number, colours: string[], speed: number, spark = true): void {
    for (let i = 0; i < count; i += 1) {
      const angle = this.rng() * Math.PI * 2;
      const power = range(this.rng, speed * 0.35, speed);
      const life = range(this.rng, 0.3, 0.85);
      this.items.push({
        x,
        y,
        vx: Math.cos(angle) * power,
        vy: Math.sin(angle) * power,
        life,
        maxLife: life,
        size: range(this.rng, 1.5, 4),
        colour: colours[Math.floor(this.rng() * colours.length) % colours.length],
        spark,
      });
    }
    if (this.items.length > 420) this.items.splice(0, this.items.length - 420);
  }

  trail(x: number, y: number, colour: string, spread: number): void {
    this.items.push({
      x: x + range(this.rng, -spread, spread),
      y: y + range(this.rng, -spread, spread),
      vx: range(this.rng, -20, 20),
      vy: range(this.rng, 40, 130),
      life: 0.35,
      maxLife: 0.35,
      size: range(this.rng, 1.5, 3.4),
      colour,
      spark: false,
    });
  }

  step(dt: number): void {
    for (const particle of this.items) {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= 0.97;
      particle.vy *= 0.97;
    }
    this.items = this.items.filter((particle) => particle.life > 0);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const particle of this.items) {
      const fade = particle.life / particle.maxLife;
      ctx.globalAlpha = Math.max(0, fade);
      ctx.fillStyle = particle.colour;
      const size = particle.size * (particle.spark ? fade : 1);
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  clear(): void {
    this.items = [];
  }
}
