import type { Astronaut } from "../game/astronaut.ts";
import type { Debris } from "../game/debris.ts";
import type { HealthBand } from "../game/health.ts";

const INK = "#151129";

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** A wobbly closed blob, stable for a given seed — every rock keeps its face. */
function lumpyPath(
  ctx: CanvasRenderingContext2D,
  r: number,
  points: number,
  seed: number,
  wobble: number,
): void {
  ctx.beginPath();
  for (let i = 0; i <= points; i += 1) {
    const angle = (i / points) * Math.PI * 2;
    const noise =
      Math.sin(angle * 3 + seed * 31.4) * 0.5 + Math.sin(angle * 5 + seed * 12.9) * 0.5;
    const radius = r * (1 - wobble * 0.5 + noise * wobble * 0.5);
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function cartoon(ctx: CanvasRenderingContext2D, fill: string, width: number): void {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineJoin = "round";
  ctx.lineWidth = width;
  ctx.strokeStyle = INK;
  ctx.stroke();
}

/* ------------------------------------------------------------- astronaut */

export interface AstronautStyle {
  /** 0..1 booster charge, drawn as the ring. */
  charge: number;
  ready: boolean;
  boosting: boolean;
  time: number;
  calm: boolean;
  /** 0..1 of the suit's health, drawn as an inner ring. */
  health: number;
  band: HealthBand;
}

/** Green while it's fine, amber once it isn't, red when one more hit does it. */
const BAND_COLOUR: Record<HealthBand, string> = {
  ok: "#4ade80",
  hurt: "#fbbf24",
  critical: "#f87171",
};

/**
 * The whole booster interface: a ring around the suit that empties when spent
 * and fills as it comes back. When it is full it breathes, which is the only
 * invitation the game ever offers to press anything.
 */
export function drawChargeRing(
  ctx: CanvasRenderingContext2D,
  astronaut: Astronaut,
  style: AstronautStyle,
): void {
  const r = astronaut.r;
  const pulse = style.calm ? 0 : Math.sin(style.time * 3.6) * 0.5 + 0.5;
  const radius = r * 2.05 + (style.ready ? pulse * r * 0.22 : 0);

  ctx.save();
  ctx.translate(astronaut.x, astronaut.y);
  ctx.lineCap = "round";

  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.lineWidth = Math.max(2, r * 0.16);
  ctx.strokeStyle = "rgba(140, 160, 210, 0.22)";
  ctx.stroke();

  if (style.charge > 0.001) {
    ctx.beginPath();
    ctx.arc(0, 0, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * style.charge);
    ctx.lineWidth = Math.max(2.5, r * 0.2);
    ctx.strokeStyle = style.ready ? "#67e8f9" : "rgba(103, 232, 249, 0.5)";
    if (style.ready) {
      ctx.shadowColor = "#22d3ee";
      ctx.shadowBlur = (12 + pulse * 18) * (style.calm ? 0.4 : 1);
    }
    ctx.stroke();
  }

  /* --- the suit, inside the booster ---------------------------------- */
  // Drawn inside the charge ring so the two never get confused: the outer one
  // is what you spend, the inner one is what you have left. Colour carries the
  // meaning, so it reads at a glance without ever counting the arc.
  const inner = r * 1.42;
  const colour = BAND_COLOUR[style.band];

  ctx.beginPath();
  ctx.arc(0, 0, inner, 0, Math.PI * 2);
  ctx.lineWidth = Math.max(2, r * 0.13);
  ctx.strokeStyle = "rgba(120, 140, 190, 0.2)";
  ctx.shadowBlur = 0;
  ctx.stroke();

  if (style.health > 0.001) {
    // The last band breathes, so running out is something you see coming.
    const urgent = style.band === "critical" && !style.calm;
    ctx.beginPath();
    ctx.arc(0, 0, inner, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * style.health);
    ctx.lineWidth = Math.max(2.5, r * 0.17);
    ctx.strokeStyle = colour;
    ctx.shadowColor = colour;
    ctx.shadowBlur = urgent ? 8 + pulse * 20 : 8;
    ctx.stroke();
  }

  ctx.restore();
}

export function drawAstronaut(
  ctx: CanvasRenderingContext2D,
  astronaut: Astronaut,
  style: AstronautStyle,
): void {
  const r = astronaut.r;
  const line = Math.max(1.6, r * 0.17);

  ctx.save();
  ctx.translate(astronaut.x, astronaut.y);
  ctx.rotate(astronaut.angle + Math.PI / 2);

  // Boot flames first, so they sit behind the suit.
  const throttle = style.boosting ? 1 : astronaut.thrust;
  if (throttle > 0.04) {
    const flicker = 0.75 + Math.sin(style.time * 30) * 0.25;
    const length = r * (style.boosting ? 3.4 : 1.5) * throttle * flicker;
    for (const side of [-1, 1]) {
      const x = side * r * 0.42;
      const y = r * 0.86;
      const flame = ctx.createLinearGradient(x, y, x, y + length);
      flame.addColorStop(0, "#fff7ed");
      flame.addColorStop(0.35, "#fbbf24");
      flame.addColorStop(1, "rgba(249, 115, 22, 0)");
      ctx.fillStyle = flame;
      ctx.beginPath();
      ctx.moveTo(x - r * 0.26, y);
      ctx.quadraticCurveTo(x, y + length * 1.1, x + r * 0.26, y);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Life-support pack, peeking out behind the shoulders.
  roundedRect(ctx, -r * 0.62, -r * 0.1, r * 1.24, r * 1.05, r * 0.28);
  cartoon(ctx, "#f97316", line);

  // Arms.
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * r * 0.72, r * 0.05);
    ctx.rotate(side * 0.5);
    roundedRect(ctx, -r * 0.22, -r * 0.34, r * 0.44, r * 0.86, r * 0.22);
    cartoon(ctx, "#eef1fb", line * 0.85);
    ctx.restore();
  }

  // Legs and boots.
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * r * 0.42, r * 0.42);
    roundedRect(ctx, -r * 0.26, -r * 0.1, r * 0.52, r * 0.92, r * 0.2);
    cartoon(ctx, "#e3e8f7", line * 0.85);
    roundedRect(ctx, -r * 0.3, r * 0.54, r * 0.6, r * 0.34, r * 0.14);
    cartoon(ctx, "#3b3663", line * 0.8);
    ctx.restore();
  }

  // Torso.
  roundedRect(ctx, -r * 0.62, -r * 0.5, r * 1.24, r * 1.2, r * 0.42);
  cartoon(ctx, "#f7f9ff", line);

  // Chest panel — three little lights, because a cartoon suit needs a gadget.
  roundedRect(ctx, -r * 0.3, -r * 0.16, r * 0.6, r * 0.34, r * 0.1);
  cartoon(ctx, "#cdd5ea", line * 0.6);
  for (let i = 0; i < 3; i += 1) {
    ctx.beginPath();
    ctx.arc(-r * 0.18 + i * r * 0.18, r * 0.01, r * 0.06, 0, Math.PI * 2);
    ctx.fillStyle = ["#4ade80", "#facc15", "#38bdf8"][i];
    ctx.fill();
  }

  // Helmet.
  ctx.beginPath();
  ctx.arc(0, -r * 0.62, r * 0.82, 0, Math.PI * 2);
  cartoon(ctx, "#ffffff", line);

  // Visor, and the glint that makes it read as glass.
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.6, r * 0.58, r * 0.5, 0, 0, Math.PI * 2);
  const visor = ctx.createLinearGradient(-r * 0.5, -r, r * 0.5, -r * 0.2);
  visor.addColorStop(0, "#1b2452");
  visor.addColorStop(0.6, "#2d3f7a");
  visor.addColorStop(1, "#0f1533");
  cartoon(ctx, "#1b2452", line * 0.8);
  ctx.fillStyle = visor;
  ctx.fill();
  ctx.clip();
  ctx.globalAlpha = 0.75;
  ctx.fillStyle = "#7dd3fc";
  ctx.beginPath();
  ctx.ellipse(-r * 0.22, -r * 0.78, r * 0.24, r * 0.12, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();

  // The flash of a clip taken.
  if (astronaut.flash > 0) {
    ctx.globalAlpha = Math.min(0.75, astronaut.flash * 1.6);
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.5, 0, Math.PI * 2);
    ctx.fillStyle = "#fb7185";
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

/* ---------------------------------------------------------------- debris */

export function drawDebris(
  ctx: CanvasRenderingContext2D,
  piece: Debris,
  time: number,
  targetX: number,
  targetY: number,
): void {
  const r = piece.r;
  const line = Math.max(1.5, r * 0.13);

  // A powered rock flares before it commits, and points at where it is going.
  // The player is always shown the shot before it is taken.
  if (piece.telegraph > 0 && piece.propelled) {
    const heat = 1 - piece.telegraph / (piece.kind === "comet" ? 0.62 : 0.85);
    ctx.save();
    ctx.globalAlpha = 0.25 + heat * 0.5;
    ctx.beginPath();
    ctx.arc(piece.x, piece.y, r * (1.5 + heat * 1.4), 0, Math.PI * 2);
    ctx.strokeStyle = piece.kind === "comet" ? "#67e8f9" : "#fb923c";
    ctx.lineWidth = Math.max(1.5, r * 0.12);
    ctx.stroke();

    if (heat > 0.45) {
      const dx = targetX - piece.x;
      const dy = targetY - piece.y;
      const length = Math.hypot(dx, dy) || 1;
      ctx.globalAlpha = (heat - 0.45) * 0.9;
      ctx.setLineDash([r * 0.5, r * 0.7]);
      ctx.beginPath();
      ctx.moveTo(piece.x + (dx / length) * r * 1.6, piece.y + (dy / length) * r * 1.6);
      ctx.lineTo(piece.x + (dx / length) * r * 5.5, piece.y + (dy / length) * r * 5.5);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  // Trails, drawn in world space before the body is rotated.
  if (piece.propelled && piece.telegraph <= 0) {
    const speed = Math.hypot(piece.vx, piece.vy) || 1;
    const tail = piece.kind === "comet" ? r * 9 : r * 4.5;
    const gradient = ctx.createLinearGradient(
      piece.x,
      piece.y,
      piece.x - (piece.vx / speed) * tail,
      piece.y - (piece.vy / speed) * tail,
    );
    const hot = piece.kind === "comet" ? "103, 232, 249" : "251, 146, 60";
    gradient.addColorStop(0, `rgba(${hot}, 0.75)`);
    gradient.addColorStop(1, `rgba(${hot}, 0)`);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(piece.x - (piece.vy / speed) * r * 0.8, piece.y + (piece.vx / speed) * r * 0.8);
    ctx.lineTo(piece.x - (piece.vx / speed) * tail, piece.y - (piece.vy / speed) * tail);
    ctx.lineTo(piece.x + (piece.vy / speed) * r * 0.8, piece.y - (piece.vx / speed) * r * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.translate(piece.x, piece.y);
  ctx.rotate(piece.angle);

  switch (piece.kind) {
    case "rock": {
      lumpyPath(ctx, r, 11, piece.seed, 0.34);
      cartoon(ctx, "#6d6884", line);
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = "#4b4664";
      for (let i = 0; i < 3; i += 1) {
        const angle = piece.seed * 20 + i * 2.1;
        ctx.beginPath();
        ctx.arc(Math.cos(angle) * r * 0.35, Math.sin(angle) * r * 0.35, r * 0.17, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      break;
    }
    case "shard": {
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(r * 0.7, -r * 0.1);
      ctx.lineTo(r * 0.35, r);
      ctx.lineTo(-r * 0.45, r * 0.8);
      ctx.lineTo(-r * 0.75, -r * 0.25);
      ctx.closePath();
      cartoon(ctx, "#a5e8fb", line);
      ctx.globalAlpha = 0.65;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(-r * 0.1, -r * 0.8);
      ctx.lineTo(r * 0.28, -r * 0.05);
      ctx.lineTo(0, r * 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      break;
    }
    case "panel": {
      roundedRect(ctx, -r, -r * 0.5, r * 2, r, r * 0.16);
      cartoon(ctx, "#dfe4f2", line);
      ctx.fillStyle = "#f97316";
      roundedRect(ctx, -r, -r * 0.5, r * 0.42, r, r * 0.16);
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.stroke();
      ctx.fillStyle = "#8b93ad";
      for (let i = 0; i < 4; i += 1) {
        ctx.beginPath();
        ctx.arc(-r * 0.3 + i * r * 0.42, 0, r * 0.09, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "bolts": {
      for (let i = 0; i < 4; i += 1) {
        const angle = piece.seed * 30 + i * 1.7;
        const distance = r * 0.75;
        ctx.beginPath();
        ctx.arc(
          Math.cos(angle) * distance,
          Math.sin(angle) * distance,
          r * 0.52,
          0,
          Math.PI * 2,
        );
        cartoon(ctx, i % 2 ? "#9aa3bd" : "#c3cade", line * 0.8);
      }
      break;
    }
    case "satellite": {
      for (const side of [-1, 1]) {
        roundedRect(ctx, side * r * 0.42 - (side < 0 ? r * 0.9 : 0), -r * 0.4, r * 0.9, r * 0.8, r * 0.08);
        cartoon(ctx, "#3b82f6", line);
        ctx.strokeStyle = "rgba(15, 20, 45, 0.55)";
        ctx.lineWidth = line * 0.5;
        for (let i = 1; i < 3; i += 1) {
          const x = side * r * 0.42 - (side < 0 ? r * 0.9 : 0) + (r * 0.9 * i) / 3;
          ctx.beginPath();
          ctx.moveTo(x, -r * 0.4);
          ctx.lineTo(x, r * 0.4);
          ctx.stroke();
        }
      }
      roundedRect(ctx, -r * 0.44, -r * 0.5, r * 0.88, r, r * 0.22);
      cartoon(ctx, "#e8ecf7", line);
      ctx.beginPath();
      ctx.arc(0, -r * 0.62, r * 0.3, Math.PI, 0);
      cartoon(ctx, "#cbd3e6", line * 0.8);
      break;
    }
    case "asteroid": {
      lumpyPath(ctx, r, 9, piece.seed, 0.4);
      cartoon(ctx, "#7c4a3a", line);
      ctx.save();
      lumpyPath(ctx, r, 9, piece.seed, 0.4);
      ctx.clip();
      const heat = ctx.createLinearGradient(0, -r, 0, r);
      heat.addColorStop(0, "rgba(251, 146, 60, 0.9)");
      heat.addColorStop(1, "rgba(251, 146, 60, 0)");
      ctx.fillStyle = heat;
      ctx.fillRect(-r, -r, r * 2, r * 2);
      ctx.restore();
      break;
    }
    case "comet": {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      cartoon(ctx, "#e0f7ff", line);
      ctx.globalAlpha = 0.7 + Math.sin(time * 8 + piece.seed * 10) * 0.2;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2);
      ctx.fillStyle = "#67e8f9";
      ctx.fill();
      ctx.globalAlpha = 1;
      break;
    }
  }

  ctx.restore();
}

/* ---------------------------------------------------------------- rocket */

/**
 * Home. It is on screen from the first second as a distant glint and grows all
 * the way in, so "how much is left" is answered by looking at it — no bar, no
 * number, nothing to read.
 */
export function drawRocket(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  time: number,
  hatch: number,
): void {
  const line = Math.max(1.2, size * 0.06);

  ctx.save();
  ctx.translate(x, y);

  const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 3.4);
  halo.addColorStop(0, "rgba(125, 211, 252, 0.28)");
  halo.addColorStop(1, "rgba(125, 211, 252, 0)");
  ctx.fillStyle = halo;
  ctx.fillRect(-size * 3.4, -size * 3.4, size * 6.8, size * 6.8);

  // Fins.
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * size * 0.5, size * 0.5);
    ctx.quadraticCurveTo(side * size * 1.5, size * 1.15, side * size * 0.95, size * 1.5);
    ctx.lineTo(side * size * 0.42, size * 1.5);
    ctx.closePath();
    cartoon(ctx, "#ef4444", line);
  }

  // Hull.
  ctx.beginPath();
  ctx.moveTo(0, -size * 1.75);
  ctx.quadraticCurveTo(size * 0.72, -size * 0.5, size * 0.66, size * 1.5);
  ctx.lineTo(-size * 0.66, size * 1.5);
  ctx.quadraticCurveTo(-size * 0.72, -size * 0.5, 0, -size * 1.75);
  ctx.closePath();
  cartoon(ctx, "#f4f6ff", line);

  ctx.beginPath();
  ctx.moveTo(0, -size * 1.75);
  ctx.quadraticCurveTo(size * 0.4, -size * 1.1, size * 0.34, -size * 0.72);
  ctx.lineTo(-size * 0.34, -size * 0.72);
  ctx.quadraticCurveTo(-size * 0.4, -size * 1.1, 0, -size * 1.75);
  ctx.closePath();
  cartoon(ctx, "#ef4444", line * 0.9);

  // Airlock. It opens as the astronaut arrives.
  ctx.beginPath();
  ctx.arc(0, -size * 0.05, size * 0.4, 0, Math.PI * 2);
  cartoon(ctx, "#1b2452", line);
  ctx.beginPath();
  ctx.arc(0, -size * 0.05, size * 0.4 * (0.35 + hatch * 0.6), 0, Math.PI * 2);
  ctx.fillStyle = `rgba(253, 230, 138, ${0.45 + hatch * 0.55})`;
  ctx.shadowColor = "#fde68a";
  ctx.shadowBlur = size * hatch * 1.2;
  ctx.fill();
  ctx.shadowBlur = 0;

  // Idling engine, so it reads as waiting rather than parked.
  const idle = 0.7 + Math.sin(time * 7) * 0.3;
  const plume = ctx.createLinearGradient(0, size * 1.5, 0, size * (1.5 + idle * 1.1));
  plume.addColorStop(0, "rgba(255, 247, 237, 0.9)");
  plume.addColorStop(1, "rgba(56, 189, 248, 0)");
  ctx.fillStyle = plume;
  ctx.beginPath();
  ctx.moveTo(-size * 0.32, size * 1.5);
  ctx.quadraticCurveTo(0, size * (1.6 + idle * 1.3), size * 0.32, size * 1.5);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}
