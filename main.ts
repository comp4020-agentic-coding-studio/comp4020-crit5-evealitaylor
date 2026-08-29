import { Pointer } from "./src/input.ts";
import { createWorld, step, worldScale, type World } from "./src/game/world.ts";
import { Renderer } from "./src/render/scene.ts";

const canvas = document.querySelector<HTMLCanvasElement>("#stage");
const stage = document.querySelector<HTMLElement>("#stage-wrap");
const ctx = canvas?.getContext("2d");

if (canvas && stage && ctx) {
  const calmQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  let world: World = createWorld({
    width: window.innerWidth,
    height: window.innerHeight,
    seed: Math.floor(Math.random() * 2 ** 31),
  });

  const renderer = new Renderer(world.width, world.height);
  const pointer = new Pointer(stage, () => world.astro, {
    x: world.astro.x,
    y: world.astro.y,
  });

  function resize(): void {
    if (!canvas || !ctx) return;
    const width = window.innerWidth;
    const height = window.innerHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    world.width = width;
    world.height = height;
    world.scale = worldScale(width, height);
    world.astro.r = 18 * world.scale;
    world.astro.x = Math.min(Math.max(world.astro.r, world.astro.x), width - world.astro.r);
    world.astro.y = Math.min(Math.max(world.astro.r, world.astro.y), height - world.astro.r);
    renderer.resize(width, height);
  }

  resize();
  pointer.recentre(world.astro.x, world.astro.y);
  window.addEventListener("resize", resize);

  const STEP = 1 / 60;
  let previous = performance.now();
  let accumulator = 0;
  let shown = "";

  function frame(now: number): void {
    if (!ctx) return;
    const elapsed = Math.min(0.25, (now - previous) / 1000);
    previous = now;
    accumulator += elapsed;

    let steps = 0;
    while (accumulator >= STEP && steps < 5) {
      world = step(world, STEP, {
        aimX: pointer.aim.x,
        aimY: pointer.aim.y,
        tapped: pointer.takePress(),
      });
      accumulator -= STEP;
      steps += 1;
    }

    if (world.phase !== shown) {
      shown = world.phase;
      document.body.dataset.phase = shown;
    }

    renderer.draw(ctx, world, elapsed, now / 1000, calmQuery.matches);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}
